from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
import traceback
from app.models.connection import SessionLocal
from app.models.tables import Dataset, Analysis, Chat
from app.services.security import decode_access_token
from app.core.core import graph
from app.core.state import State

router = APIRouter(prefix="/analyst", tags=["analyst"])


# ── DB session dependency ─────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Request body schemas ──────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    question: str

class ChatSaveRequest(BaseModel):
    question: str
    answer: str
    tool_used: Optional[str] = "direct"
    sql_query: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# POST /analyst/{dataset_id}/chat
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{dataset_id}/chat")
def chat(
    dataset_id: str,
    body: ChatRequest,
    token: dict = Depends(decode_access_token),
    db: Session = Depends(get_db),
):
    """
    Main chat endpoint with multi-agent orchestration.
    """
    # ── Step 1: Validate dataset ──────────────────────────────────────────────
    try:
        ds_id_int = int(dataset_id)
    except ValueError:
        ds_id_int = 999

    if ds_id_int == 999 or dataset_id == "demo":
        schema = {
            "Transaction_ID": {"dtype": "int64", "semantic_type": "identifier"},
            "Date": {"dtype": "object", "semantic_type": "datetime"},
            "Product_Category": {"dtype": "object", "semantic_type": "categorical"},
            "Sales_Amount": {"dtype": "float64", "semantic_type": "numeric"},
            "Profit": {"dtype": "float64", "semantic_type": "numeric"},
            "Customer_Segment": {"dtype": "object", "semantic_type": "categorical"}
        }
        dataset_obj_id = 999
    else:
        dataset = db.query(Dataset).filter_by(id=ds_id_int).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found in database.")

        dataset_obj_id = dataset.id
        analysis = db.query(Analysis).filter_by(dataset_id=dataset.id).first()
        schema = {}
        if analysis and analysis.profile:
            for col in analysis.profile.get("columns", []):
                schema[col["name"]] = {
                    "dtype": col.get("dtype"),
                    "semantic_type": col.get("semantic_type"),
                    "null_pct": col.get("null_pct"),
                }

    # ── Step 3: Build initial State ───────────────────────────────────────────
    history_context = []
    try:
        recent_chats = (
            db.query(Chat)
            .filter_by(dataset_id=dataset_obj_id)
            .order_by(Chat.created_at.desc())
            .limit(6)
            .all()
        )
        history_context = [
            {"question": c.question, "answer": c.answer, "tool_used": c.tool_used}
            for c in reversed(recent_chats)
        ]
    except Exception:
        pass

    initial_state: State = {
        "question":     body.question,
        "dataset_id":   dataset_obj_id,
        "schema":       schema,
        "chat_history": history_context,
        "tool_choice":  None,
        "tool_result":  None,
        "answer":       None,
    }

    # ── Step 4: Run the graph ─────────────────────────────────────────────────
    try:
        result = graph.invoke(initial_state)
    except Exception as e:
        print(f"[Graph Execution Warning]: {e}")
        # Fallback to direct agent execution directly
        from app.core.direct_agent import DirectAgent
        result = DirectAgent(initial_state)
        result["tool_choice"] = "direct"

    answer = result.get("answer", "I could not generate an answer.")
    tool_used = result.get("tool_choice", "direct")
    tool_result = result.get("tool_result")

    sql_query = None
    if tool_used == "sql" and isinstance(tool_result, dict):
        sql_query = tool_result.get("sql_query") or result.get("sql_query")
    elif result.get("sql_query"):
        sql_query = result.get("sql_query")

    # ── Step 5: Save to Chat table in backend ─────────────────────────────────
    try:
        chat_record = Chat(
            user_id=token.get("user_id", 1),
            dataset_id=dataset_obj_id,
            question=body.question,
            answer=answer,
            tool_used=tool_used,
            sql_query=sql_query,
        )
        db.add(chat_record)
        db.commit()
    except Exception as e:
        print(f"[Chat Save Notice]: {e}")

    return {
        "question":  body.question,
        "answer":    answer,
        "tool_used": tool_used,
        "sql_query": sql_query,
    }



# ═══════════════════════════════════════════════════════════════════════════════
# POST /analyst/{dataset_id}/history/save (Manual & Hybrid Message Saver)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{dataset_id}/history/save")
def save_chat_message(
    dataset_id: str,
    body: ChatSaveRequest,
    token: dict = Depends(decode_access_token),
    db: Session = Depends(get_db),
):
    """
    Persists a chat interaction into the backend database.
    """
    try:
        ds_id_int = int(dataset_id)
        dataset = db.query(Dataset).filter_by(id=ds_id_int, user_id=token["user_id"]).first()
        valid_ds_id = dataset.id if dataset else None
    except ValueError:
        valid_ds_id = None

    if valid_ds_id:
        chat_record = Chat(
            user_id=token["user_id"],
            dataset_id=valid_ds_id,
            question=body.question,
            answer=body.answer,
            tool_used=body.tool_used or "direct",
            sql_query=body.sql_query,
        )
        db.add(chat_record)
        db.commit()
        db.refresh(chat_record)
        chat_id = chat_record.id
    else:
        chat_id = None

    return {
        "success": True,
        "message": "Chat history saved successfully.",
        "chat_id": chat_id,
        "dataset_id": dataset_id
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /analyst/{dataset_id}/history
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{dataset_id}/history")
def get_history(
    dataset_id: str,
    token: dict = Depends(decode_access_token),
    db: Session = Depends(get_db),
    limit: int = 50,
):
    """
    Returns full conversation history for a specific dataset.
    Ordered chronologically (oldest to newest for chat replay).
    """
    try:
        ds_id_int = int(dataset_id)
        chats = (
            db.query(Chat)
            .filter_by(dataset_id=ds_id_int, user_id=token["user_id"])
            .order_by(Chat.created_at.asc())
            .limit(limit)
            .all()
        )
    except ValueError:
        chats = []

    return {
        "dataset_id": dataset_id,
        "history": [
            {
                "id": c.id,
                "question": c.question,
                "answer": c.answer,
                "tool_used": c.tool_used,
                "sql_query": c.sql_query,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in chats
        ]
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DELETE /analyst/{dataset_id}/history (Clear Chat History)
# ═══════════════════════════════════════════════════════════════════════════════

@router.delete("/{dataset_id}/history")
def clear_history(
    dataset_id: str,
    token: dict = Depends(decode_access_token),
    db: Session = Depends(get_db),
):
    """
    Deletes all conversation history for a specific dataset.
    """
    try:
        ds_id_int = int(dataset_id)
        db.query(Chat).filter_by(dataset_id=ds_id_int, user_id=token["user_id"]).delete()
        db.commit()
    except Exception:
        pass

    return {
        "success": True,
        "message": f"Chat history cleared for dataset {dataset_id}."
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /analyst/history/all (All User Chat History)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/history/all")
def get_all_user_history(
    token: dict = Depends(decode_access_token),
    db: Session = Depends(get_db),
    limit: int = 100,
):
    """
    Returns all conversations across all datasets for the authenticated user.
    """
    chats = (
        db.query(Chat)
        .filter_by(user_id=token["user_id"])
        .order_by(Chat.created_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "total_messages": len(chats),
        "history": [
            {
                "id": c.id,
                "dataset_id": c.dataset_id,
                "question": c.question,
                "answer": c.answer,
                "tool_used": c.tool_used,
                "sql_query": c.sql_query,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in chats
        ]
    }