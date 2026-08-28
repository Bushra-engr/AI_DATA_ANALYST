# services/profiler_service.py
# ─────────────────────────────────────────────────────────────────────────────
# PURPOSE  : Extract structural metadata about every column in a dataset.
#            Called automatically right after upload completes.
#            Output is saved into Analysis.profile (JSON column in PostgreSQL).
#
# WHAT IT DOES:
#   - Reads the DataFrame from DuckDB
#   - Figures out column types (numeric, categorical, datetime)
#   - Detects if the dataset has a time column → sets is_timeseries flag
#   - Calculates null %, unique count, basic stats per column
#   - Assigns a simple semantic_type label per column (used later by LLM)
#   - Computes an overall quality_score (0–100)
#   - Returns one clean dict → saved as Analysis.profile
# ─────────────────────────────────────────────────────────────────────────────

import pandas as pd
from app.services.duckdb_service import DuckDBService


class ProfilerService:

    def __init__(self, dataset_id: int):
        self.dataset_id = dataset_id
        self.db = DuckDBService()
        self.df: pd.DataFrame = self.db.get_dataframe(dataset_id)

    # ── Main entry point ─────────────────────────────────────────────────────
    def run(self) -> dict:
        """
        Run full profiling on the dataset.
        Returns a dict that gets stored in Analysis.profile.
        """
        df = self.df

        num_cols = df.select_dtypes(include="number").columns.tolist()
        cat_cols = df.select_dtypes(include="object").columns.tolist()
        date_cols = self._detect_date_columns(df)

        # is_timeseries = True only if at least one proper date/time column found
        is_timeseries = len(date_cols) > 0

        column_profiles = []
        for col in df.columns:
            column_profiles.append(self._profile_column(df, col, date_cols))

        quality_score = self._compute_quality_score(df)

        return {
            "total_rows": int(df.shape[0]),
            "total_columns": int(df.shape[1]),
            "shape": {"rows": int(df.shape[0]), "columns": int(df.shape[1])},
            "num_cols": num_cols,
            "cat_cols": cat_cols,
            "date_cols": date_cols,
            "is_timeseries": is_timeseries,
            "duplicate_rows": int(df.duplicated().sum()),
            "total_null_cells": int(df.isnull().sum().sum()),
            "memory_usage_kb": round(df.memory_usage(deep=True).sum() / 1024, 2),
            "quality_score": quality_score,
            "columns": column_profiles,
        }


    # ── Per-column profiling ──────────────────────────────────────────────────
    def _profile_column(self, df: pd.DataFrame, col: str, date_cols: list) -> dict:
        """Build a metadata dict for a single column."""
        series = df[col]
        null_count = int(series.isnull().sum())
        null_pct = round(null_count / len(series), 4)
        unique_count = int(series.nunique())
        cardinality = "high" if unique_count > 50 else "low"
        semantic_type = self._guess_semantic_type(col, series, date_cols)

        info = {
            "name": col,
            "dtype": str(series.dtype),
            "semantic_type": semantic_type,
            "null_count": null_count,
            "null_pct": null_pct,
            "unique_count": unique_count,
            "cardinality": cardinality,
        }

        # Extra stats for numeric columns
        if pd.api.types.is_numeric_dtype(series):
            info.update({
                "min": round(float(series.min()), 4) if not series.isnull().all() else None,
                "max": round(float(series.max()), 4) if not series.isnull().all() else None,
                "mean": round(float(series.mean()), 4) if not series.isnull().all() else None,
                "std": round(float(series.std()), 4) if not series.isnull().all() else None,
                "skewness": round(float(series.skew()), 4) if not series.isnull().all() else None,
            })

        # Top value counts for categorical columns
        if pd.api.types.is_object_dtype(series):
            top_values = series.value_counts().head(5).to_dict()
            # Convert keys to str to make JSON-safe
            info["top_values"] = {str(k): int(v) for k, v in top_values.items()}

        return info

    # ── Date column detection ─────────────────────────────────────────────────
    def _detect_date_columns(self, df: pd.DataFrame) -> list:
        """
        Find columns that look like dates.
        Checks dtype first (datetime64), then tries parsing object columns
        whose names contain date-like keywords.
        """
        date_cols = []
        date_keywords = ["date", "time", "day", "month", "year", "timestamp", "created", "updated"]

        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                date_cols.append(col)
            elif pd.api.types.is_object_dtype(df[col]):
                # Check column name hint first (cheap)
                if any(kw in col.lower() for kw in date_keywords):
                    try:
                        pd.to_datetime(df[col].dropna().head(20), infer_datetime_format=True)
                        date_cols.append(col)
                    except Exception:
                        pass

        return date_cols

    # ── Semantic type guesser ─────────────────────────────────────────────────
    def _guess_semantic_type(self, col: str, series: pd.Series, date_cols: list) -> str:
        """
        Assign a human-readable semantic type label.
        This is used by the LLM and frontend to classify column roles.
        """
        col_lower = col.lower()

        if col in date_cols or pd.api.types.is_datetime64_any_dtype(series):
            return "datetime"

        if pd.api.types.is_numeric_dtype(series):
            return "numeric"

        id_keywords = ["id", "uuid", "key", "code", "ref"]
        if any(kw in col_lower for kw in id_keywords) and series.nunique() > (0.6 * len(series)):
            return "identifier"

        geo_keywords = ["city", "country", "region", "state", "location", "lat", "lon", "zip"]
        if any(kw in col_lower for kw in geo_keywords):
            return "categorical"

        if pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series):
            return "categorical"

        return "unknown"


    # ── Quality score ─────────────────────────────────────────────────────────
    def _compute_quality_score(self, df: pd.DataFrame) -> int:
        """
        Simple 0–100 quality score.

        Formula:
          completeness  (40%) → how few nulls
          uniqueness    (30%) → how few duplicate rows
          type_validity (30%) → all columns have a recognizable dtype

        Returns an integer between 0 and 100.
        """
        total_cells = df.shape[0] * df.shape[1]
        null_cells = int(df.isnull().sum().sum())
        completeness = 1 - (null_cells / total_cells) if total_cells > 0 else 1

        dup_rows = int(df.duplicated().sum())
        uniqueness = 1 - (dup_rows / len(df)) if len(df) > 0 else 1

        # All object columns that could reasonably be parsed as numeric → bad type
        mixed_type_cols = 0
        for col in df.select_dtypes(include="object").columns:
            converted = pd.to_numeric(df[col], errors="coerce")
            if converted.notna().mean() > 0.8:  # >80% values are actually numeric
                mixed_type_cols += 1
        type_validity = 1 - (mixed_type_cols / len(df.columns)) if len(df.columns) > 0 else 1

        score = (completeness * 0.4) + (uniqueness * 0.3) + (type_validity * 0.3)
        return int(round(score * 100))