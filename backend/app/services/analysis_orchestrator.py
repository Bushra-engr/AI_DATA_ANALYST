import math
from sqlalchemy.orm import Session
from app.models.tables import Analysis, Dataset
from app.services.profiler_service import ProfilerService
from app.services.eda_service import EDAService
from app.services.insight_service import InsightService
from app.services.narrator_service import generate_summary


def sanitize_for_json(obj):
    """
    Recursively replaces Infinity, -Infinity, and NaN with None/valid JSON values
    so PostgreSQL JSON data type never rejects the input.
    """
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    return obj


def run_full_analysis(dataset_id: int, session: Session) -> None:

    dataset = session.query(Dataset).filter_by(id=dataset_id).first()

    # ── Step 1: Profile ───────────────────────────────────────────────────────
    dataset.status = "PROFILING"
    session.commit()

    profiler = ProfilerService(dataset_id)
    profile_data = sanitize_for_json(profiler.run())

    # ── Step 2: EDA ───────────────────────────────────────────────────────────
    dataset.status = "ANALYSING"
    session.commit()

    eda = EDAService(dataset_id, profile=profile_data)
    statistics_data = sanitize_for_json(eda.run())

    # ── Step 3: Insights ──────────────────────────────────────────────────────
    insight_svc = InsightService(profile=profile_data, statistics=statistics_data)
    insights_data = sanitize_for_json(insight_svc.run())

    # ── Save to PostgreSQL ────────────────────────────────────────────────────
    analysis = session.query(Analysis).filter_by(dataset_id=dataset_id).first()
    if analysis is None:
        analysis = Analysis(dataset_id=dataset_id)
        session.add(analysis)

    total_rows = profile_data.get("total_rows") or profile_data.get("shape", {}).get("rows", 0)
    total_cols = profile_data.get("total_columns") or profile_data.get("shape", {}).get("columns", 0)
    total_nulls = profile_data.get("total_null_cells", 0)
    null_pct = round((total_nulls / max(1, total_rows * total_cols)) * 100, 2) if total_rows and total_cols else 0.0

    analysis.profile    = profile_data
    analysis.quality    = {
        "score":            profile_data.get("quality_score", 95.0),
        "quality_score":    profile_data.get("quality_score", 95.0),
        "duplicate_rows":   profile_data.get("duplicate_rows", 0),
        "total_null_cells": total_nulls,
        "null_percentage":  null_pct,
    }
    analysis.statistics = statistics_data

    analysis.insights   = insights_data
    session.commit()

    # ── Step 4: LLM Summary (Phase 3 last step) ───────────────────────────────
    try:
        generate_summary(dataset_id=dataset_id, session=session)
    except Exception as e:
        print(f"Summary generation error (non-fatal): {e}")

    # ── Done ──────────────────────────────────────────────────────────────────
    dataset.status = "READY"
    session.commit()