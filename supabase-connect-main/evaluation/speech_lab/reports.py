from __future__ import annotations

import csv
import html
import json
from collections import defaultdict
from pathlib import Path

from .models import EvaluationResult


class Leaderboard:
    def rank(self, results: list[EvaluationResult]) -> list[dict[str, object]]:
        grouped: dict[str, list[EvaluationResult]] = defaultdict(list)
        for result in results:
            grouped[result.model_id].append(result)

        rows: list[dict[str, object]] = []
        for model_id, items in grouped.items():
            rows.append(
                {
                    "model_id": model_id,
                    "model_name": items[0].model_name,
                    "chapters": len(items),
                    "accepted_chapters": sum(1 for item in items if item.accepted),
                    "avg_wer": sum(item.metrics.wer for item in items) / len(items),
                    "avg_cer": sum(item.metrics.cer for item in items) / len(items),
                    "avg_boundary_accuracy": sum(item.metrics.boundary_accuracy for item in items) / len(items),
                    "avg_alignment_accuracy": sum(item.metrics.alignment_accuracy for item in items) / len(items),
                    "avg_processing_time_seconds": sum(item.resources.processing_time_seconds for item in items) / len(items),
                    "avg_peak_ram_mb": _avg([item.resources.peak_ram_mb for item in items]),
                    "avg_peak_vram_mb": _avg([item.resources.peak_vram_mb for item in items]),
                }
            )

        return sorted(
            rows,
            key=lambda row: (
                -int(row["accepted_chapters"]),
                float(row["avg_wer"]),
                -float(row["avg_boundary_accuracy"]),
                float(row["avg_processing_time_seconds"]),
            ),
        )


class ComparisonReportGenerator:
    def __init__(self, output_dir: str | Path = "evaluation/speech_lab/reports") -> None:
        self.output_dir = Path(output_dir)

    def generate(self, results: list[EvaluationResult], run_id: str = "latest") -> dict[str, Path]:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        leaderboard = Leaderboard().rank(results)
        payload = {
            "run_id": run_id,
            "results": [result.to_dict() for result in results],
            "leaderboard": leaderboard,
        }
        paths = {
            "json": self.output_dir / f"{run_id}.json",
            "csv": self.output_dir / f"{run_id}.csv",
            "markdown": self.output_dir / f"{run_id}.md",
            "html": self.output_dir / f"{run_id}.html",
        }
        self._write_json(paths["json"], payload)
        self._write_csv(paths["csv"], results)
        self._write_markdown(paths["markdown"], run_id, leaderboard, results)
        self._write_html(paths["html"], run_id, leaderboard, results)
        return paths

    def _write_json(self, path: Path, payload: dict[str, object]) -> None:
        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")

    def _write_csv(self, path: Path, results: list[EvaluationResult]) -> None:
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(_result_row(results[0]).keys()) if results else ["model_id"])
            writer.writeheader()
            for result in results:
                writer.writerow(_result_row(result))

    def _write_markdown(
        self,
        path: Path,
        run_id: str,
        leaderboard: list[dict[str, object]],
        results: list[EvaluationResult],
    ) -> None:
        lines = [f"# Speech Evaluation Report: {run_id}", "", "## Leaderboard", ""]
        lines.append("| Rank | Model | Accepted | Avg WER | Avg CER | Boundary | Time (s) |")
        lines.append("| --- | --- | ---: | ---: | ---: | ---: | ---: |")
        for index, row in enumerate(leaderboard, start=1):
            lines.append(
                f"| {index} | {row['model_name']} | {row['accepted_chapters']}/{row['chapters']} | "
                f"{float(row['avg_wer']):.4f} | {float(row['avg_cer']):.4f} | "
                f"{float(row['avg_boundary_accuracy']):.4f} | {float(row['avg_processing_time_seconds']):.2f} |"
            )
        lines.extend(["", "## Chapter Results", ""])
        lines.append("| Model | Chapter | Text Mode | Canonical WER | Canonical CER | Spoken WER | Boundary | Resolution | Token Coverage | High Conf | Start Drift | End Drift | Missing | Unresolved | Accepted |")
        lines.append("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |")
        for result in results:
            lines.append(
                f"| {result.model_name} | {result.chapter_id} | {result.metrics.text_reference_mode} | "
                f"{_fmt(result.metrics.canonical_text_wer)} | {_fmt(result.metrics.canonical_text_cer)} | "
                f"{_fmt(result.metrics.spoken_reference_wer)} | "
                f"{result.metrics.boundary_accuracy:.4f} | {_fmt(result.metrics.verse_resolution_rate)} | "
                f"{_fmt(result.metrics.token_alignment_coverage)} | {_fmt(result.metrics.high_confidence_alignment_rate)} | "
                f"{_fmt(result.metrics.mean_start_drift_ms)} | {_fmt(result.metrics.mean_end_drift_ms)} | "
                f"{','.join(str(item) for item in result.metrics.missing_verses)} | "
                f"{','.join(str(item) for item in result.metrics.unresolved_verses)} | "
                f"{'yes' if result.accepted else 'no'} |"
            )
        warnings = sorted({result.metrics.text_metric_warning for result in results if result.metrics.text_metric_warning})
        if warnings:
            lines.extend(["", "## Text Metric Warnings", ""])
            lines.extend(f"- {warning}" for warning in warnings)
        lines.extend(["", "## Boundary Accuracy By Tolerance", ""])
        lines.append("| Model | Chapter | Tolerance (ms) | Start | End | Combined | Combined Correct | Denominator |")
        lines.append("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |")
        for result in results:
            for tolerance, values in result.metrics.boundary_accuracy_by_tolerance.items():
                lines.append(
                    f"| {result.model_name} | {result.chapter_id} | {tolerance} | "
                    f"{float(values['start']):.4f} | {float(values['end']):.4f} | {float(values['combined']):.4f} | "
                    f"{int(values['combined_correct'])} | {int(values['denominator'])} |"
                )
        lines.extend(["", "## Per-Verse Boundary Diagnostics", ""])
        lines.append(
            "| Verse | Status | Coverage | Matched | Reference | Candidate Start | Golden Start | Start Drift | "
            "Candidate End | Golden End | End Drift | Pass 500 | Pass 1000 | Pass 2000 | Failure Reason |"
        )
        lines.append("| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |")
        for result in results:
            for row in result.metrics.per_verse_boundary_diagnostics:
                lines.append(
                    f"| {row['verse']} | {row['alignment_status']} | {_fmt(row.get('coverage'))} | "
                    f"{_blank(row.get('matched_tokens'))} | {_blank(row.get('reference_tokens'))} | "
                    f"{_blank(row.get('candidate_start_ms'))} | {row['golden_start_ms']} | {_blank(row.get('start_drift_ms'))} | "
                    f"{_blank(row.get('candidate_end_ms'))} | {row['golden_end_ms']} | {_blank(row.get('end_drift_ms'))} | "
                    f"{'yes' if row['passes_500_ms'] else 'no'} | {'yes' if row['passes_1000_ms'] else 'no'} | "
                    f"{'yes' if row['passes_2000_ms'] else 'no'} | {row['failure_reason']} |"
                )
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    def _write_html(
        self,
        path: Path,
        run_id: str,
        leaderboard: list[dict[str, object]],
        results: list[EvaluationResult],
    ) -> None:
        rows = "\n".join(
            "<tr>"
            f"<td>{index}</td><td>{html.escape(str(row['model_name']))}</td>"
            f"<td>{row['accepted_chapters']}/{row['chapters']}</td>"
            f"<td>{float(row['avg_wer']):.4f}</td><td>{float(row['avg_cer']):.4f}</td>"
            f"<td>{float(row['avg_boundary_accuracy']):.4f}</td>"
            f"<td>{float(row['avg_processing_time_seconds']):.2f}</td>"
            "</tr>"
            for index, row in enumerate(leaderboard, start=1)
        )
        detail_rows = "\n".join(
            "<tr>"
            f"<td>{html.escape(result.model_name)}</td><td>{result.chapter_id}</td>"
            f"<td>{result.metrics.wer:.4f}</td><td>{result.metrics.cer:.4f}</td>"
            f"<td>{result.metrics.boundary_accuracy:.4f}</td><td>{_fmt(result.metrics.alignment_coverage)}</td>"
            f"<td>{_fmt(result.metrics.mean_start_drift_ms)}</td><td>{_fmt(result.metrics.mean_end_drift_ms)}</td>"
            f"<td>{'yes' if result.accepted else 'no'}</td>"
            "</tr>"
            for result in results
        )
        path.write_text(
            f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Speech Evaluation Report {html.escape(run_id)}</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.45; }}
    table {{ border-collapse: collapse; width: 100%; margin: 1rem 0 2rem; }}
    th, td {{ border: 1px solid #d8dee4; padding: 0.5rem; text-align: left; }}
    th {{ background: #f6f8fa; }}
  </style>
</head>
<body>
  <h1>Speech Evaluation Report: {html.escape(run_id)}</h1>
  <h2>Leaderboard</h2>
  <table><thead><tr><th>Rank</th><th>Model</th><th>Accepted</th><th>WER</th><th>CER</th><th>Boundary</th><th>Time</th></tr></thead><tbody>{rows}</tbody></table>
  <h2>Chapter Results</h2>
  <table><thead><tr><th>Model</th><th>Chapter</th><th>WER</th><th>CER</th><th>Boundary</th><th>Coverage</th><th>Start Drift</th><th>End Drift</th><th>Accepted</th></tr></thead><tbody>{detail_rows}</tbody></table>
</body>
</html>
""",
            encoding="utf-8",
        )


def _avg(values: list[float | None]) -> float | None:
    present = [value for value in values if value is not None]
    return sum(present) / len(present) if present else None


def _fmt(value: float | None) -> str:
    return "-" if value is None else f"{value:.4f}"


def _blank(value: object) -> str:
    return "-" if value is None else str(value)


def _result_row(result: EvaluationResult) -> dict[str, object]:
    return {
        "model_id": result.model_id,
        "model_name": result.model_name,
        "chapter_id": result.chapter_id,
        "wer": result.metrics.wer,
        "cer": result.metrics.cer,
        "canonical_text_wer": result.metrics.canonical_text_wer,
        "canonical_text_cer": result.metrics.canonical_text_cer,
        "spoken_reference_wer": result.metrics.spoken_reference_wer,
        "spoken_reference_cer": result.metrics.spoken_reference_cer,
        "canonical_token_similarity": result.metrics.canonical_token_similarity,
        "word_order_similarity": result.metrics.word_order_similarity,
        "semantic_similarity": result.metrics.semantic_similarity,
        "text_reference_mode": result.metrics.text_reference_mode,
        "text_metric_warning": result.metrics.text_metric_warning,
        "boundary_accuracy": result.metrics.boundary_accuracy,
        "alignment_accuracy": result.metrics.alignment_accuracy,
        "alignment_accuracy_deprecated": result.metrics.alignment_accuracy_deprecated,
        "alignment_accuracy_description": result.metrics.alignment_accuracy_description,
        "average_word_confidence": result.metrics.average_word_confidence,
        "verse_confidence": result.metrics.verse_confidence,
        "verse_resolution_rate": result.metrics.verse_resolution_rate,
        "token_alignment_coverage": result.metrics.token_alignment_coverage,
        "high_confidence_alignment_rate": result.metrics.high_confidence_alignment_rate,
        "combined_boundary_accuracy_1000ms": result.metrics.combined_boundary_accuracy_1000ms,
        "combined_boundary_accuracy_2000ms": result.metrics.combined_boundary_accuracy_2000ms,
        "boundary_accuracy_250_start": result.metrics.boundary_accuracy_by_tolerance.get("250", {}).get("start"),
        "boundary_accuracy_250_end": result.metrics.boundary_accuracy_by_tolerance.get("250", {}).get("end"),
        "boundary_accuracy_250_combined": result.metrics.boundary_accuracy_by_tolerance.get("250", {}).get("combined"),
        "boundary_accuracy_500_start": result.metrics.boundary_accuracy_by_tolerance.get("500", {}).get("start"),
        "boundary_accuracy_500_end": result.metrics.boundary_accuracy_by_tolerance.get("500", {}).get("end"),
        "boundary_accuracy_500_combined": result.metrics.boundary_accuracy_by_tolerance.get("500", {}).get("combined"),
        "boundary_accuracy_1000_start": result.metrics.boundary_accuracy_by_tolerance.get("1000", {}).get("start"),
        "boundary_accuracy_1000_end": result.metrics.boundary_accuracy_by_tolerance.get("1000", {}).get("end"),
        "boundary_accuracy_1000_combined": result.metrics.boundary_accuracy_by_tolerance.get("1000", {}).get("combined"),
        "boundary_accuracy_2000_start": result.metrics.boundary_accuracy_by_tolerance.get("2000", {}).get("start"),
        "boundary_accuracy_2000_end": result.metrics.boundary_accuracy_by_tolerance.get("2000", {}).get("end"),
        "boundary_accuracy_2000_combined": result.metrics.boundary_accuracy_by_tolerance.get("2000", {}).get("combined"),
        "mean_start_drift_ms": result.metrics.mean_start_drift_ms,
        "median_start_drift_ms": result.metrics.median_start_drift_ms,
        "mean_end_drift_ms": result.metrics.mean_end_drift_ms,
        "median_end_drift_ms": result.metrics.median_end_drift_ms,
        "missing_verses": ",".join(str(item) for item in result.metrics.missing_verses),
        "duplicated_verses": ",".join(str(item) for item in result.metrics.duplicated_verses),
        "unresolved_verses": ",".join(str(item) for item in result.metrics.unresolved_verses),
        "alignment_coverage": result.metrics.alignment_coverage,
        "processing_time_seconds": result.resources.processing_time_seconds,
        "peak_ram_mb": result.resources.peak_ram_mb,
        "peak_vram_mb": result.resources.peak_vram_mb,
        "gpu_utilization_percent": result.resources.gpu_utilization_percent,
        "cpu_utilization_percent": result.resources.cpu_utilization_percent,
        "accepted": result.accepted,
        "notes": "; ".join(result.notes),
    }
