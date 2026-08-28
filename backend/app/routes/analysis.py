# routers/analysis.py
# ─────────────────────────────────────────────────────────────────────────────
# PURPOSE  : Expose all Phase 2 + 3 results via clean REST endpoints.
#            All endpoints just READ from the Analysis table — no computation
#            happens here. Everything was pre-computed on upload.
#
# ENDPOINTS:
#   GET /analysis/{dataset_id}/profile    → column metadata, shape, quality score
#   GET /analysis/{dataset_id}/quality    → null counts, duplicates, quality score
#   GET /analysis/{dataset_id}/stats      → EDA results (correlation, outliers, etc.)
#   GET /analysis/{dataset_id}/insights   → ranked InsightObjects list
#   GET /analysis/{dataset_id}/full       → everything in one response (for dashboard)
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.connection import SessionLocal
from app.models.tables import Analysis, Dataset
from app.services.security import decode_access_token


router = APIRouter(
    prefix="/analysis",
    tags=["analysis"]
)


# ── DB session dependency ─────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Helper: fetch analysis or 404 ────────────────────────────────────────────
def _get_analysis(dataset_id: int, token: dict, db: Session) -> Analysis:
    """
    Shared helper used by every endpoint.
    Checks:
      1. Dataset exists
      2. Analysis row exists (or auto-generates if missing)
    """
    if dataset_id == 999:
        # Return virtual demo Analysis object
        mock_analysis = Analysis(
            id=999,
            dataset_id=999,
            profile={
                "total_rows": 15420,
                "total_columns": 10,
                "memory_usage_mb": 2.14,
                "columns": [
                    {"name": "Transaction_ID", "dtype": "int64", "semantic_type": "identifier", "null_pct": 0.0, "unique_count": 15420},
                    {"name": "Date", "dtype": "object", "semantic_type": "datetime", "null_pct": 0.0, "unique_count": 365, "is_timeseries": True},
                    {"name": "Region", "dtype": "object", "semantic_type": "categorical", "null_pct": 0.8, "unique_count": 5},
                    {"name": "Product_Category", "dtype": "object", "semantic_type": "categorical", "null_pct": 0.0, "unique_count": 4},
                    {"name": "Sales_Amount", "dtype": "float64", "semantic_type": "numeric", "null_pct": 1.2, "unique_count": 8420, "min": 49.99, "max": 12499.00, "mean": 1845.60},
                    {"name": "Units_Sold", "dtype": "int64", "semantic_type": "numeric", "null_pct": 0.0, "unique_count": 85, "min": 1, "max": 150, "mean": 14.8},
                    {"name": "Discount_Pct", "dtype": "float64", "semantic_type": "numeric", "null_pct": 0.0, "unique_count": 25, "min": 0.0, "max": 0.45, "mean": 0.12},
                    {"name": "Profit", "dtype": "float64", "semantic_type": "numeric", "null_pct": 1.5, "unique_count": 9110, "min": -450.00, "max": 4800.00, "mean": 512.40},
                    {"name": "Customer_Segment", "dtype": "object", "semantic_type": "categorical", "null_pct": 0.0, "unique_count": 3}
                ]
            },
            quality={
                "quality_score": 96.5,
                "score": 96.5,
                "total_null_cells": 539,
                "null_percentage": 0.35,
                "duplicate_rows": 0
            },
            statistics={
                "correlations": {
                    "strong_pairs": [
                        {"col1": "Sales_Amount", "col2": "Profit", "correlation": 0.84},
                        {"col1": "Units_Sold", "col2": "Sales_Amount", "correlation": 0.72}
                    ]
                },
                "categorical_distributions": {
                    "Product_Category": {"Electronics": 6120, "Cloud Services": 4350, "Hardware": 3210, "Software Licenses": 1740}
                },
                "outliers": {
                    "Sales_Amount": 42,
                    "Profit": 18
                }
            },
            insights=[
                {
                    "finding": "Cloud Services segment demonstrates highest profit margin (41.2%) across all categories.",
                    "evidence": "Mean profit is $780 per transaction vs $340 for standard Hardware.",
                    "severity": "positive",
                    "rank_score": 9.4,
                    "affected_columns": ["Product_Category", "Profit"]
                }
            ],
            summary="Global Tech Sales dataset comprises 15,420 transaction records across 10 features with a 96.5/100 quality score. Strong correlation exists between Sales and Profit (r = +0.84)."
        )
        return mock_analysis

    dataset = db.query(Dataset).filter_by(id=dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    analysis = db.query(Analysis).filter_by(dataset_id=dataset_id).first()
    if not analysis or not analysis.profile:
        from app.services.analysis_orchestrator import run_full_analysis
        try:
            run_full_analysis(dataset_id=dataset_id, session=db)
            analysis = db.query(Analysis).filter_by(dataset_id=dataset_id).first()
        except Exception as e:
            print(f"On-demand analysis generation notice: {e}")

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found for this dataset.")

    return analysis




# ── GET /analysis/{dataset_id}/profile ───────────────────────────────────────
@router.get("/{dataset_id}/profile")
def get_profile(
    dataset_id: int,
    token: dict = Depends(decode_access_token),
    db: Session = Depends(get_db),
):
    """
    Returns structural metadata for every column:
    dtype, semantic_type, null%, unique count, min/max/mean,
    is_timeseries flag, quality_score, duplicate rows.

    Frontend uses this to build the column summary panel.
    """
    analysis = _get_analysis(dataset_id, token, db)
    if not analysis.profile:
        raise HTTPException(status_code=404, detail="Profile not yet computed.")
    return {"dataset_id": dataset_id, "profile": analysis.profile}


# ── GET /analysis/{dataset_id}/quality ───────────────────────────────────────
@router.get("/{dataset_id}/quality")
def get_quality(
    dataset_id: int,
    token: dict = Depends(decode_access_token),
    db: Session = Depends(get_db),
):
    """
    Returns the data quality report:
    overall quality_score (0–100), duplicate rows, total null cells.
    Also returns per-column null details from the full profile.

    Frontend uses this for the quality gauge / health card.
    """
    analysis = _get_analysis(dataset_id, token, db)
    if not analysis.quality:
        raise HTTPException(status_code=404, detail="Quality report not yet computed.")

    # Pull per-column null details from profile for richer response
    col_null_details = []
    if analysis.profile:
        for col in analysis.profile.get("columns", []):
            if col.get("null_pct", 0) > 0:
                col_null_details.append({
                    "column": col["name"],
                    "null_pct": col["null_pct"],
                    "null_count": col["null_count"],
                })

    return {
        "dataset_id": dataset_id,
        "quality": analysis.quality,
        "column_null_details": col_null_details,
    }


# ── GET /analysis/{dataset_id}/stats ─────────────────────────────────────────
@router.get("/{dataset_id}/stats")
def get_stats(
    dataset_id: int,
    token: dict = Depends(decode_access_token),
    db: Session = Depends(get_db),
):
    """
    Returns full EDA results:
    descriptive_stats, correlation matrix + strong pairs,
    outliers per column, distribution shapes, top/bottom values,
    and timeseries block (only present if is_timeseries=True).

    Frontend uses this to render charts and stat tables.
    """
    analysis = _get_analysis(dataset_id, token, db)
    if not analysis.statistics:
        raise HTTPException(status_code=404, detail="Statistics not yet computed.")
    return {"dataset_id": dataset_id, "statistics": analysis.statistics}


# ── GET /analysis/{dataset_id}/insights ──────────────────────────────────────
@router.get("/{dataset_id}/insights")
def get_insights(
    dataset_id: int,
    token: dict = Depends(decode_access_token),
    db: Session = Depends(get_db),
    category: str = None,        # optional filter: anomaly | quality | trend | correlation | distribution
    severity: str = None,        # optional filter: critical | high | medium | low
    limit: int = 20,             # default top 20 insights
):
    """
    Returns ranked InsightObjects — highest rank_score first.
    Each object has: finding, evidence, category, severity, rank_score, affected_columns.

    Optional query params:
      ?category=anomaly   → only anomaly insights
      ?severity=critical  → only critical insights
      ?limit=10           → top 10 only

    This is the most impressive endpoint — shows recruiter that you built
    an automated insight discovery engine, not just a dashboard.
    """
    analysis = _get_analysis(dataset_id, token, db)
    if not analysis.insights:
        raise HTTPException(status_code=404, detail="Insights not yet computed.")

    insights: list = analysis.insights

    # Filter by category if provided
    if category:
        insights = [i for i in insights if i.get("category") == category]

    # Filter by severity if provided
    if severity:
        insights = [i for i in insights if i.get("severity") == severity]

    # Already sorted by rank_score from InsightService, just apply limit
    insights = insights[:limit]

    return {
        "dataset_id": dataset_id,
        "total_returned": len(insights),
        "insights": insights,
    }


# ── GET /analysis/{dataset_id}/full ──────────────────────────────────────────
@router.get("/{dataset_id}/full")
def get_full_analysis(
    dataset_id: int,
    token: dict = Depends(decode_access_token),
    db: Session = Depends(get_db),
):
    """
    Returns everything in one shot:
    profile + quality + statistics + top 10 insights + AI summary (if available).

    The frontend dashboard page calls this single endpoint on load.
    Avoids 4 separate API calls.
    """
    analysis = _get_analysis(dataset_id, token, db)

    # Auto-generate summary if missing on legacy/existing records
    if not analysis.summary and analysis.profile:
        from app.services.narrator_service import generate_summary
        try:
            generate_summary(dataset_id=dataset_id, session=db)
        except Exception as e:
            print(f"On-the-fly summary generation notice: {e}")

    return {
        "dataset_id": dataset_id,
        "profile":    analysis.profile,
        "quality":    analysis.quality,
        "statistics": analysis.statistics,
        "top_insights": (analysis.insights or [])[:10],
        "ai_summary": analysis.summary,
    }