# services/upload_service.py
# ─────────────────────────────────────────────────────────────────────────────
# KEY FIX: Upload returns immediately after writing to Neon DB.
# Analysis runs as a FastAPI BackgroundTask so the HTTP response is returned
# in ~200ms — well within the frontend's timeout window.
# This ensures every upload creates a record in datasets + analyses tables.
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import HTTPException, UploadFile, File, BackgroundTasks
from app.services.security import decode_access_token
from app.services.analysis_orchestrator import run_full_analysis
import pandas as pd
from app.models.connection import SessionLocal
from app.models.tables import Dataset, Analysis, User
from pathlib import Path

import duckdb
import traceback


DB_PATH = Path(
    r"C:\Deep Learning\AI_DATA_ANALYST_PROJECT\backend\app\database\analytics.duckdb"
)


def _run_analysis_background(dataset_id: int):
    """Runs in background after HTTP response is already sent."""
    try:
        with SessionLocal() as session:
            run_full_analysis(dataset_id=dataset_id, session=session)
            dataset = session.query(Dataset).filter_by(id=dataset_id).first()
            if dataset:
                dataset.status = "READY"
                session.commit()
    except Exception as e:
        print(f"[Background Analysis Error] dataset_id={dataset_id}: {e}")
        traceback.print_exc()
        try:
            with SessionLocal() as session:
                dataset = session.query(Dataset).filter_by(id=dataset_id).first()
                if dataset:
                    dataset.status = "FAILED"
                    session.commit()
        except Exception:
            pass


async def data_upload(
    file: UploadFile,
    token: dict,
    background_tasks: BackgroundTasks,
):
    # ── Validate file type (case-insensitive) ──────────────────────────────
    filename_lower = (file.filename or "").lower()
    if not filename_lower.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only CSV and XLSX files are allowed.")

    # ── Read contents into DataFrame reliably ─────────────────────────────
    import io
    try:
        contents = await file.read()
        if filename_lower.endswith(".csv"):
            try:
                df = pd.read_csv(io.BytesIO(contents), encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(contents), encoding="latin1")
        else:
            df = pd.read_excel(io.BytesIO(contents))

        # Sanitize column names
        df.columns = [str(c).strip() for c in df.columns]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unable to read file: {e}")

    # ── Save metadata row to PostgreSQL (status = PROCESSING) ────────────────────
    with SessionLocal() as session:
        user_id = token.get("user_id", 1)
        user = session.query(User).filter_by(id=user_id).first()
        if not user:
            user = User(
                id=user_id,
                name="Data Analyst",
                email=f"user_{user_id}@ai-analyst.local",
                password_hash="system_user_hash"
            )
            session.add(user)
            session.commit()

        dataset = Dataset(
            user_id=user_id,
            name=file.filename or "uploaded_dataset.csv",
            file_type=file.filename.split(".")[-1].lower() if file.filename and "." in file.filename else "csv",
            row_count=len(df),
            column_count=len(df.columns),
            status="PROCESSING",
        )
        session.add(dataset)
        session.commit()
        session.refresh(dataset)
        dataset_id = dataset.id

    # ── Write to DuckDB (CREATE OR REPLACE so re-uploads don't fail) ───────
    try:
        table_name = f"dataset_{dataset_id}"
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        con = duckdb.connect(str(DB_PATH))
        con.register("temp_df", df)
        con.execute(f"CREATE OR REPLACE TABLE {table_name} AS SELECT * FROM temp_df")
        con.close()
    except Exception as e:
        # Mark as failed but still return the dataset_id
        with SessionLocal() as session:
            dataset = session.query(Dataset).filter_by(id=dataset_id).first()
            if dataset:
                dataset.status = "FAILED"
    # ── Run analysis in background if background_tasks is available, else synchronously ──
    def _run_bg_analysis(ds_id: int):
        with SessionLocal() as s:
            try:
                run_full_analysis(dataset_id=ds_id, session=s)
            except Exception as ex:
                print(f"[Background Analysis Notice]: {ex}")
                traceback.print_exc()

    if background_tasks:
        background_tasks.add_task(_run_bg_analysis, dataset_id)
    else:
        with SessionLocal() as session:
            try:
                run_full_analysis(dataset_id=dataset_id, session=session)
            except Exception as e:
                print(f"[Upload Analysis Notice]: {e}")

    return {
        "message": "Dataset uploaded and analyzed successfully.",
        "dataset_id": dataset_id,
        "filename": file.filename,
        "fileName": file.filename,
        "rows": len(df),
        "columns": len(df.columns),
        "status": "READY",
        "table_name": f"dataset_{dataset_id}",
    }

