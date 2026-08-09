from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from statistics import mean
from typing import Any


FIELDS = [
    "chapter",
    "verse_count",
    "transcription_runtime",
    "WER",
    "CER",
    "aligned_verses",
    "recovered_verses",
    "unresolved_verses",
    "alignment_coverage",
    "combined_250ms",
    "combined_500ms",
    "combined_1000ms",
    "combined_2000ms",
    "median_start_drift_ms",
    "median_end_drift_ms",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Aggregate speech lab chapter reports.")
    parser.add_argument("--report", action="append", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model-output-dir", default="evaluation/speech_lab/model_outputs/faster-whisper-small")
    args = parser.parse_args()

    rows = [row_from_report(Path(path), Path(args.model_output_dir)) for path in args.report]
    rows.append(macro_average(rows))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {"rows": rows}
    output.with_suffix(".json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with output.with_suffix(".csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    output.with_suffix(".md").write_text(markdown_table(rows), encoding="utf-8")
    return 0


def row_from_report(path: Path, model_output_dir: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    result = data["results"][0]
    metrics = result["metrics"]
    chapter = result["chapter_id"]
    aligned_path = model_output_dir / f"{chapter}.aligned-v2.json"
    aligned = json.loads(aligned_path.read_text(encoding="utf-8"))
    transcription_runtime = aligned["metadata"].get("transcription_runtime_seconds")
    statuses = [verse["status"] for verse in aligned.get("verses", [])]
    by_tolerance = metrics["boundary_accuracy_by_tolerance"]
    return {
        "chapter": chapter,
        "verse_count": len(aligned.get("verses", [])),
        "transcription_runtime": transcription_runtime,
        "WER": metrics["wer"],
        "CER": metrics["cer"],
        "aligned_verses": sum(1 for status in statuses if status in {"aligned", "recovered_between_neighbors"}),
        "recovered_verses": sum(1 for status in statuses if status == "recovered_between_neighbors"),
        "unresolved_verses": len(metrics["unresolved_verses"]),
        "alignment_coverage": metrics["token_alignment_coverage"],
        "combined_250ms": by_tolerance["250"]["combined"],
        "combined_500ms": by_tolerance["500"]["combined"],
        "combined_1000ms": by_tolerance["1000"]["combined"],
        "combined_2000ms": by_tolerance["2000"]["combined"],
        "median_start_drift_ms": metrics["median_start_drift_ms"],
        "median_end_drift_ms": metrics["median_end_drift_ms"],
    }


def macro_average(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        field: "MACRO_AVG" if field == "chapter" else _avg([row[field] for row in rows])
        for field in FIELDS
    }


def _avg(values: list[Any]) -> float:
    return mean(float(value) for value in values if value is not None)


def markdown_table(rows: list[dict[str, Any]]) -> str:
    lines = [
        "| " + " | ".join(FIELDS) + " |",
        "| " + " | ".join("---" for _ in FIELDS) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(_fmt(row[field]) for field in FIELDS) + " |")
    return "\n".join(lines) + "\n"


def _fmt(value: Any) -> str:
    if isinstance(value, float):
        return f"{value:.4f}"
    return str(value)


if __name__ == "__main__":
    raise SystemExit(main())
