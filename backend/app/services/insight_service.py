# services/insight_service.py

class InsightService:

    def __init__(self, profile: dict, statistics: dict):
        self.profile = profile
        self.statistics = statistics
        self.insights: list[dict] = []

    # ── Main entry point ──────────────────────────────────────────────────────
    def run(self) -> list[dict]:
        self._quality_insights()
        self._outlier_insights()
        self._correlation_insights()
        self._distribution_insights()
        self._timeseries_insights()
        self._stats_summary_insights()  # BUG 1 FIX: self._sta incomplete tha
        self._rank_and_sort()
        return self.insights

    # ── 1. Quality insights ───────────────────────────────────────────────────
    def _quality_insights(self):
        quality_score = self.profile.get("quality_score", 100)
        dup_rows = self.profile.get("duplicate_rows", 0)
        total_rows = self.profile.get("shape", {}).get("rows", 1)

        # BUG 2 FIX: indentation galat thi — self._add quality summary
        # hamesha add karo chahe score kuch bhi ho
        self._add({
            "finding": (
                f"Dataset quality score is {quality_score}/100 — "
                f"{'excellent' if quality_score >= 90 else 'good' if quality_score >= 70 else 'poor'} data quality."
            ),
            "evidence": {"quality_score": quality_score},
            "category": "quality",
            "severity": "low" if quality_score >= 90 else "medium",
            "affected_columns": [],
        })

        # Low score — additional warning
        if quality_score < 70:
            severity = "critical" if quality_score < 50 else "high"
            self._add({
                "finding": f"Dataset quality score is {quality_score}/100 — significant reliability issues.",
                "evidence": {"quality_score": quality_score},
                "category": "quality",
                "severity": severity,
                "affected_columns": [],
            })

        # Duplicate rows
        if dup_rows > 0:
            dup_pct = round(dup_rows / total_rows * 100, 1)
            severity = "high" if dup_pct > 10 else "medium"
            self._add({
                "finding": f"{dup_rows} duplicate rows found ({dup_pct}% of dataset).",
                "evidence": {"duplicate_rows": dup_rows, "duplicate_pct": dup_pct},
                "category": "quality",
                "severity": severity,
                "affected_columns": [],
            })

        # Per-column null warnings
        for col_info in self.profile.get("columns", []):
            null_pct = col_info.get("null_pct", 0)
            if null_pct >= 0.3:
                severity = "critical" if null_pct >= 0.5 else "high"
                self._add({
                    "finding": f"Column '{col_info['name']}' has {round(null_pct*100,1)}% missing values.",
                    "evidence": {"null_pct": null_pct, "null_count": col_info.get("null_count")},
                    "category": "quality",
                    "severity": severity,
                    "affected_columns": [col_info["name"]],
                })
            elif null_pct >= 0.1:
                self._add({
                    "finding": f"Column '{col_info['name']}' has {round(null_pct*100,1)}% missing values — worth reviewing.",
                    "evidence": {"null_pct": null_pct},
                    "category": "quality",
                    "severity": "medium",
                    "affected_columns": [col_info["name"]],
                })

    # ── 2. Outlier insights ───────────────────────────────────────────────────
    def _outlier_insights(self):
        outliers: dict = self.statistics.get("outliers", {})
        for col, info in outliers.items():
            outlier_pct = info.get("outlier_pct", 0)
            if outlier_pct < 0.001:
                continue

            severity = "critical" if outlier_pct > 0.15 else "high" if outlier_pct > 0.05 else "medium"
            self._add({
                "finding": (
                    f"Column '{col}' has {round(outlier_pct*100,1)}% outlier values "
                    f"(outside [{info['lower_bound']}, {info['upper_bound']}])."
                ),
                "evidence": {
                    "outlier_pct": outlier_pct,
                    "outlier_count": info.get("outlier_count"),
                    "lower_bound": info.get("lower_bound"),
                    "upper_bound": info.get("upper_bound"),
                },
                "category": "anomaly",
                "severity": severity,
                "affected_columns": [col],
            })

    # ── 3. Correlation insights ───────────────────────────────────────────────
    def _correlation_insights(self):
        corr_data = self.statistics.get("correlation", {})
        strong_pairs: list = corr_data.get("strong_pairs", [])

        for pair in strong_pairs:
            r = pair.get("r", 0)
            direction = pair.get("direction", "positive")
            strength = pair.get("strength", "strong")
            col_a = pair.get("col_a")
            col_b = pair.get("col_b")

            severity = "high" if abs(r) >= 0.9 else "medium"
            self._add({
                "finding": (
                    f"'{col_a}' and '{col_b}' have a {strength} {direction} "
                    f"correlation (r={r}). These two metrics move "
                    f"{'together' if direction=='positive' else 'in opposite directions'}."
                ),
                "evidence": {"r": r, "direction": direction, "strength": strength},
                "category": "correlation",
                "severity": severity,
                "affected_columns": [col_a, col_b],
            })

    # ── 4. Distribution insights ──────────────────────────────────────────────
    def _distribution_insights(self):
        # BUG 3 FIX: indentation galat thi — severity aur self._add loop ke
        # andar hone chahiye, bahar nahi
        shapes: dict = self.statistics.get("distribution_shapes", {})
        for col, info in shapes.items():
            skewness = info.get("skewness", 0)
            shape = info.get("shape", "normal")

            severity = "high" if abs(skewness) > 3 else "medium" if abs(skewness) > 1 else "low"
            self._add({
                "finding": f"Column '{col}' has a {shape} distribution (skewness={round(skewness, 2)}).",
                "evidence": {"skewness": skewness, "shape": shape},
                "category": "distribution",
                "severity": severity,
                "affected_columns": [col],
            })

    # ── 5. Stats summary insights ─────────────────────────────────────────────
    def _stats_summary_insights(self):
        stats = self.statistics.get("descriptive_stats", {})
        for col, info in stats.items():
            self._add({
                "finding": (
                    f"Column '{col}': mean={info.get('mean')}, "
                    f"std={info.get('std')}, "
                    f"range=[{info.get('min')}, {info.get('max')}]."
                ),
                "evidence": info,
                "category": "distribution",
                "severity": "low",
                "affected_columns": [col],
            })

    # ── 6. Time-series insights ───────────────────────────────────────────────
    def _timeseries_insights(self):
        ts: dict = self.statistics.get("timeseries")
        if not ts:
            return

        metric_col = ts.get("metric_col", "metric")
        trend = ts.get("trend_direction")
        mom = ts.get("mom_growth_pct")
        spike = ts.get("biggest_spike")
        drop = ts.get("biggest_drop")

        if trend in ("upward", "downward"):
            severity = "high" if trend == "downward" else "medium"
            self._add({
                "finding": f"'{metric_col}' shows a clear {trend} trend over the dataset's time range.",
                "evidence": {"trend_direction": trend},
                "category": "trend",
                "severity": severity,
                "affected_columns": [metric_col],
            })

        if mom is not None:
            severity = "critical" if mom < -20 else "high" if mom < -10 else "medium" if mom < 0 else "low"
            word = "declined" if mom < 0 else "grew"
            self._add({
                "finding": f"'{metric_col}' {word} by {abs(mom)}% month-over-month.",
                "evidence": {"mom_growth_pct": mom},
                "category": "trend",
                "severity": severity,
                "affected_columns": [metric_col],
            })

        if spike and spike.get("pct_change") is not None:
            pct = spike.get("pct_change")
            if isinstance(pct, (int, float)) and abs(pct) > 20:
                self._add({
                    "finding": f"'{metric_col}' spiked by {pct}% on {spike.get('date')}.",
                    "evidence": spike,
                    "category": "anomaly",
                    "severity": "high",
                    "affected_columns": [metric_col],
                })

        if drop and drop.get("pct_change") is not None:
            pct = drop.get("pct_change")
            if isinstance(pct, (int, float)) and abs(pct) > 20:
                self._add({
                    "finding": f"'{metric_col}' dropped by {abs(pct)}% on {drop.get('date')}.",
                    "evidence": drop,
                    "category": "anomaly",
                    "severity": "high",
                    "affected_columns": [metric_col],
                })

    # ── Ranking ───────────────────────────────────────────────────────────────
    def _rank_and_sort(self):
        severity_map = {"critical": 1.0, "high": 0.75, "medium": 0.4, "low": 0.1}
        category_map = {"anomaly": 1.0, "quality": 0.9, "trend": 0.8, "correlation": 0.7, "distribution": 0.5}

        for insight in self.insights:
            sev_score = severity_map.get(insight.get("severity", "low"), 0.1)
            cat_score = category_map.get(insight.get("category", "distribution"), 0.5)
            evidence_keys = len(insight.get("evidence", {}))
            evidence_score = min(evidence_keys / 5, 1.0)
            rank = (sev_score * 0.5) + (cat_score * 0.3) + (evidence_score * 0.2)
            insight["rank_score"] = round(rank, 4)

        self.insights.sort(key=lambda x: x["rank_score"], reverse=True)

    # ── Helper ────────────────────────────────────────────────────────────────
    def _add(self, insight: dict):
        self.insights.append(insight)