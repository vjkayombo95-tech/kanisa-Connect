"""Verify generated audio pipeline artifacts and QA reports."""

from __future__ import annotations

from pathlib import Path

from lib.config import CONFIG
from lib.filesystem import read_json
from lib.logger import get_logger
from lib.models import VerseIndex, VerseTiming
from lib.qa import sha256_file, verify_hash_report, write_dashboard
from validate_index import validate_index

LOGGER = get_logger("verify_pipeline")


def verify_pipeline() -> list[str]:
    """Verify manifests, artifacts, hashes, indexes, and failed reports."""

    issues: list[str] = []
    manifests_dir = CONFIG.reports_dir / "manifests"
    if not manifests_dir.exists():
        return [f"Missing manifests directory: {manifests_dir}"]

    manifest_paths = sorted(manifests_dir.glob("*.json"))
    if not manifest_paths:
        return [f"No manifests found in {manifests_dir}"]

    for manifest_path in manifest_paths:
        try:
            manifest = read_json(manifest_path)
        except Exception as exc:
            issues.append(f"Invalid manifest JSON {manifest_path}: {exc}")
            continue

        chapter_key = manifest_path.stem
        expected = _expected_paths(manifest)
        for label, path in expected.items():
            if path is None or not path.exists():
                issues.append(f"Missing {label} for {chapter_key}: {path}")

        index_path = expected.get("index")
        if index_path and index_path.exists():
            issues.extend(_verify_index(index_path, expected.get("audio")))

        hash_path = CONFIG.reports_dir / "hashes" / manifest_path.name
        if not hash_path.exists():
            issues.append(f"Missing hash report for {chapter_key}: {hash_path}")
        else:
            issues.extend(verify_hash_report(hash_path))
            issues.extend(_verify_hashes(hash_path, expected))

        summary_path = CONFIG.reports_dir / "summary" / manifest_path.name
        html_path = CONFIG.reports_dir / "html" / f"{chapter_key}.html"
        if not summary_path.exists():
            issues.append(f"Missing summary report for {chapter_key}: {summary_path}")
        else:
            issues.extend(_verify_summary(summary_path))
        if not html_path.exists():
            issues.append(f"Missing HTML report for {chapter_key}: {html_path}")

    write_dashboard()
    return issues


def main() -> int:
    """CLI entry point for pipeline verification."""

    issues = verify_pipeline()
    if issues:
        for issue in issues:
            LOGGER.error(issue)
            print(f"ERROR: {issue}")
        return 1

    LOGGER.info("Pipeline verification passed")
    print("Pipeline verification passed")
    return 0


def _expected_paths(manifest: dict[str, object]) -> dict[str, Path | None]:
    """Return expected artifact paths for a manifest."""

    audio_path = Path(str(manifest["audio_path"])) if manifest.get("audio_path") else None
    book = str(manifest.get("book", "")).replace(" ", "_")
    chapter = manifest.get("chapter")
    return {
        "audio": audio_path,
        "transcript": (
            CONFIG.transcripts_dir / f"{audio_path.stem}.transcript.json"
            if audio_path
            else None
        ),
        "alignment": (
            CONFIG.alignments_dir / book / f"{chapter}.json"
            if book and chapter is not None
            else None
        ),
        "index": (
            CONFIG.indexes_dir / book / f"{chapter}.json"
            if book and chapter is not None
            else None
        ),
    }


def _verify_index(index_path: Path, audio_path: Path | None) -> list[str]:
    """Validate one index JSON artifact."""

    issues: list[str] = []
    try:
        data = read_json(index_path)
        verses = [_verse_from_json(item) for item in data.get("verses", [])]
        validate_index(
            VerseIndex(
                audio_path=audio_path or Path(str(data.get("audio_path", ""))),
                index_path=index_path,
                verses=verses,
                metadata={
                    "book": data.get("book"),
                    "chapter": data.get("chapter"),
                },
            )
        )
    except Exception as exc:
        issues.append(f"Invalid index {index_path}: {exc}")
    return issues


def _verify_hashes(
    hash_path: Path,
    expected_paths: dict[str, Path | None],
) -> list[str]:
    """Check hashes in one hash report against expected files."""

    issues: list[str] = []
    hashes = read_json(hash_path)
    for label, path in expected_paths.items():
        expected_hash = hashes.get(label)
        actual_hash = sha256_file(path)
        if path is not None and path.exists() and expected_hash != actual_hash:
            issues.append(f"Hash mismatch for {label}: {path}")
    return issues


def _verify_summary(summary_path: Path) -> list[str]:
    """Check one summary report for failed status."""

    summary = read_json(summary_path)
    if summary.get("status") == "FAIL":
        return [f"Failed summary report: {summary_path}"]
    return []


def _verse_from_json(item: object) -> VerseTiming:
    """Parse a verse entry from production index JSON."""

    if not isinstance(item, dict):
        raise ValueError("Verse entry must be an object")
    return VerseTiming(
        verse_id=str(item.get("verse", item.get("verse_id"))),
        start_seconds=float(item.get("start", item.get("start_seconds"))),
        end_seconds=float(item.get("end", item.get("end_seconds"))),
        text=str(item.get("text", "")),
        confidence=float(item.get("confidence", 0.0) or 0.0),
        duration=float(item.get("duration", 0.0) or 0.0),
        word_count=int(item.get("word_count", 0) or 0),
    )


if __name__ == "__main__":
    raise SystemExit(main())
