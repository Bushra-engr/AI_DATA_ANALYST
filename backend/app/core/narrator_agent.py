# agents/narrator_agent.py
# ─────────────────────────────────────────────────────────────────────────────
# TWO FUNCTIONS:
#
# AnswerNarrator(state) — LangGraph node
#   Called at the END of every graph run.
#   Takes tool_result (SQL rows OR insights list OR None)
#   Returns human-readable answer string → saved as state["answer"]
#
# SummaryNarrator(dataset_id, session) — standalone utility
#   Called from analysis_orchestrator.py after insights are saved.
#   Takes Analysis.insights → generates 3-4 paragraph business summary
#   Saves to Analysis.summary in PostgreSQL
#   NOT a graph node — called directly
# ─────────────────────────────────────────────────────────────────────────────

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from sqlalchemy.orm import Session
from app.core.llm_provider import llm
from app.core.state import State
from app.models.tables import Analysis


# ═══════════════════════════════════════════════════════════════════════════════
# FUNCTION 1 — LangGraph node
# Called after sql_agent or insight_agent completes
# ═══════════════════════════════════════════════════════════════════════════════

def AnswerNarrator(state: State) -> dict:
    """
    Final node in the graph.
    Receives tool_result and question → generates clean human answer.

    Handles three cases:
      - tool_result has "rows"     → SQL result → tabular answer
      - tool_result has "insights" → insight list → narrative answer
      - tool_result has "error"    → something failed → friendly error message
    """
    question = state.get("question", "")
    tool_result = state.get("tool_result")

    # ── Detect what kind of result we have ───────────────────────────────────
    if isinstance(tool_result, dict) and "error" in tool_result:
        # Something went wrong in sql_agent or insight_agent
        return {
            "answer": (
                f"I encountered an issue while processing your question: "
                f"{tool_result.get('error', 'Unknown error')}. "
                f"Please try rephrasing your question."
            )
        }

    # ── Normal path — generate answer ────────────────────────────────────────
    prompt = ChatPromptTemplate.from_messages([
        ("system", """
You are a helpful Data Analyst Assistant.

Use the Tool Result data to answer the User Question accurately and clearly.

RULES:
1. Be concise, professional, and friendly.
2. If the result contains rows/numbers, highlight the key values.
3. If the result contains insights, explain them in plain business language.
4. Do not mention technical terms like "SQL", "DataFrame", "JSON", or "tool_result".
5. If the data is empty, say so politely and suggest the user try a different question.
6. Keep your answer under 150 words unless the data requires more detail.
"""),
        ("human", """
User Question: {question}

Data: {tool_result}
""")
    ])

    chain = prompt | llm | StrOutputParser()

    answer = chain.invoke({
        "question": question,
        "tool_result": str(tool_result),
    })

    return {"answer": answer}


# ═══════════════════════════════════════════════════════════════════════════════
# FUNCTION 2 — Standalone utility (Phase 3 last step)
# Called from analysis_orchestrator.py after InsightService completes
# ═══════════════════════════════════════════════════════════════════════════════

def SummaryNarrator(dataset_id: int, session: Session) -> None:
    """
    Reads Analysis.insights for a dataset.
    Sends top 10 insights to LLM.
    Generates a business summary paragraph.
    Saves to Analysis.summary.

    Called from orchestrator — not a graph node.
    Returns nothing — saves directly to DB.
    """

    # ── Fetch analysis row ────────────────────────────────────────────────────
    analysis = session.query(Analysis).filter(
        Analysis.dataset_id == dataset_id
    ).first()

    if not analysis or not analysis.insights:
        return   # nothing to summarize

    # Top 10 by rank_score (already sorted by InsightService)
    top_insights = analysis.insights[:10]

    # ── Build prompt ──────────────────────────────────────────────────────────
    prompt = ChatPromptTemplate.from_messages([
        ("system", """
You are a Senior Data Analyst writing an executive summary.

You will receive a list of automatically discovered insights from a dataset.
Write a clear, professional 3-4 paragraph summary of the most important findings.

RULES:
1. Write for a business audience — no technical jargon.
2. Group related findings together.
3. Highlight the most critical issues first.
4. End with 1-2 actionable recommendations.
5. Do not use bullet points — write in flowing paragraphs.
6. Keep it under 300 words.
"""),
        ("human", """
Dataset Insights:
{insights}

Write the executive summary:
""")
    ])

    chain = prompt | llm | StrOutputParser()

    try:
        summary = chain.invoke({
            "insights": str(top_insights)
        })

        # ── Save to DB ────────────────────────────────────────────────────────
        analysis.summary = summary
        session.commit()

    except Exception:
        # If LLM fails, summary stays None — not a critical error
        pass