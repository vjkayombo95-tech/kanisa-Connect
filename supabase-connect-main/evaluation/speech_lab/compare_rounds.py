from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from statistics import mean
from typing import Any


METRICS = {
    "WER": ("WER", "lower"),
    "CER": ("CER", "lower"),
    "token_alignment_coverage": ("alignment_coverage", "higher"),
    "unresolved_verses": ("unresolved_verses", "lower"),
    "combined_500ms": ("combined_500ms", "higher"),
    "combined_1000ms": ("combined_1000ms", "higher"),
    "combined_2000ms": ("combined_2000ms", "higher"),
    "median_start_drift_ms": ("median_start_drift_ms", "lower"),
    "median_end_drift_ms": ("median_end_drift_ms", "lower"),
    "transcription_runtime": ("transcription_runtime", "lower"),
}

FIELDS = ["chapter", "metric", "small", "medium", "absolute_difference", "percentage_improvement", "winner"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare Faster-Whisper Small and Medium aggregate rows.")
    parser.add_argument("--small", required=True)
    parser.add_argument("--medium", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    small_rows = _rows_by_chapter(Path(args.small))
    medium_rows = _rows_by_chapter(Path(args.medium))
    rows: list[dict[str, Any]] = []
    for chapter in sorted(set(small_rows) & set(medium_rows)):
        if chapter == "MACRO_AVG":
            continue
        rows.extend(_compare_chapter(chapter, small_rows[chapter], medium_rows[chapter]))
    rows.extend(_macro_rows(rows))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {"rows": rows}
    output.with_suffix(".json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    with output.with_suffix(".csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    output.with_suffix(".md").write_text(_markdown(rows), encoding="utf-8")
    return 0


def _rows_by_chapter(path: Path) -> dict[str, dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {row["chapter"]: row for row in payload["rows"]}


def _compare_chapter(chapter: str, small: dict[str, Any], medium: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for metric, (field, direction) in METRICS.items():
        small_value = float(small[field])
        medium_value = float(medium[field])
        difference = medium_value - small_value
        if direction == "lower":
            improvement = (small_value - medium_value) / small_value if small_value else 0.0
            winner = "medium" if medium_value < small_value else "small" if small_value < medium_value else "tie"
        else:
            improvement = (medium_value - small_value) / small_value if small_value else 0.0
            winner = "medium" if medium_value > small_value else "small" if small_value > medium_value else "tie"
        rows.append(
            {
                "chapter": chapter,
                "metric": metric,
                "small": small_value,
                "medium": medium_value,
                "absolute_difference": difference,
                "percentage_improvement": improvement * 100,
                "winner": winner,
            }
        )
    return rows


def _macro_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output = []
    for metric in METRICS:
        metric_rows = [row for row in rows if row["metric"] == metric]
        small = mean(row["small"] for row in metric_rows)
        medium = mean(row["medium"] for row in metric_rows)
        direction = METRICS[metric][1]
        difference = medium - small
        if direction == "lower":
            improvement = (small - medium) / small if small else 0.0
            winner = "medium" if medium < small else "small" if small < medium else "tie"
        else:
            improvement = (medium - small) / small if small else 0.0
            winner = "medium" if medium > small else "small" if small > medium else "tie"
        output.append(
            {
                "chapter": "MACRO_AVG",
                "metric": metric,
                "small": small,
                "medium": medium,
                "absolute_difference": difference,
                "percentage_improvement": improvement * 100,
                "winner": winner,
            }
        )
    return output


def _markdown(rows: list[dict[str, Any]]) -> str:
    lines = [
        "| " + " | ".join(FIELDS) + " |",
        "| " + " | ".join("---" for _ in FIELDS) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(_fmt(row[field]) for field in FIELDS) + " |")
    return "\n".join(lines) + "\n"


def _fmt(value: Any) -> str:
    return f"{value:.4f}" if isinstance(value, float) else str(value)


if __name__ == "__main__":
    raise SystemExit(main())
