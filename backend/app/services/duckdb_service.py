import duckdb
import pandas as pd
from pathlib import Path


DB_PATH = Path(
    r"C:\Deep Learning\AI_DATA_ANALYST_PROJECT\backend\app\database\analytics.duckdb"
)


class DuckDBService:

    def __init__(self):                                    # FIX 1: was __int__
        self.connection = duckdb.connect(str(DB_PATH))

    # ── Context manager support ───────────────────────────────────────────────
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def close(self):
        self.connection.close()

    # ── Table name helper ─────────────────────────────────────────────────────
    def get_table_name(self, dataset_id: int) -> str:
        return f"dataset_{dataset_id}"

    # ── Check if table exists ─────────────────────────────────────────────────
    def table_exists(self, dataset_id: int) -> bool:
        table_name = self.get_table_name(dataset_id)
        result = self.connection.execute(
            f"SELECT COUNT(*) FROM information_schema.tables "
            f"WHERE table_name = '{table_name}'"         # FIX 3: quotes around value
        ).fetchone()
        return result[0] > 0

    # ── Full DataFrame ────────────────────────────────────────────────────────
    def get_dataframe(self, dataset_id: int) -> pd.DataFrame:
        table_name = self.get_table_name(dataset_id)
        return self.connection.execute(
            f"SELECT * FROM {table_name}"
        ).fetchdf()

    # ── Preview (first N rows) ────────────────────────────────────────────────
    def preview(self, dataset_id: int, limit: int = 50) -> pd.DataFrame:
        table_name = self.get_table_name(dataset_id)
        return self.connection.execute(
            f"SELECT * FROM {table_name} LIMIT {limit}"
        ).fetchdf()

    # ── Schema ────────────────────────────────────────────────────────────────
    def get_schema(self, dataset_id: int) -> pd.DataFrame:
        table_name = self.get_table_name(dataset_id)
        return self.connection.execute(
            f"DESCRIBE {table_name}"                     # FIX 2: space added
        ).fetchdf()

    # ── Raw SQL execution ─────────────────────────────────────────────────────
    def execute_query(self, query: str) -> pd.DataFrame:
        return self.connection.execute(query).fetchdf()

    # ── Row count ─────────────────────────────────────────────────────────────
    def row_count(self, dataset_id: int) -> int:
        table_name = self.get_table_name(dataset_id)
        return self.connection.execute(
            f"SELECT COUNT(*) FROM {table_name}"
        ).fetchone()[0]

    # ── Column names ──────────────────────────────────────────────────────────
    def column_names(self, dataset_id: int) -> list[str]:
        table_name = self.get_table_name(dataset_id)
        columns = self.connection.execute(
            f"DESCRIBE {table_name}"
        ).fetchall()
        return [col[0] for col in columns]