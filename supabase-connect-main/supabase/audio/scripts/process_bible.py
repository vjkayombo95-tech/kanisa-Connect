"""Production batch processor for the complete Bible."""

from __future__ import annotations

import argparse

from lib.bible_books import BIBLE_BOOKS
from lib.config import CONFIG
from lib.generated_validation import validate_generated_chapter, write_validation_summary
from lib.run_reports import RunTracker, write_run_reports
from process_chapter import process_chapter
from providers.text_provider import SupabaseBibleProvider


def process_bible(*, resume: bool = True, force: bool = False, verbose: bool = False) -> RunTracker:
    """Process every Bible chapter, isolating failures and writing reports."""

    provider = SupabaseBibleProvider()
    tracker = RunTracker()
    validation_results = []
    for book in BIBLE_BOOKS:
        try:
            chapters = provider.chapter_numbers(book.english_name)
        except Exception as exc:
            tracker.record_failed(book.english_name, 0, f"Unable to load chapter list: {exc}")
            continue
        for chapter in chapters:
            label = f"{book.english_name} {chapter}"
            try:
                if verbose:
                    print(f"Processing {label}")
                process_chapter(
                    book=book.english_name,
                    chapter=chapter,
                    content_type="bible",
                    resume=resume,
                    force=force,
                )
                expected_count = provider.verse_count(book.english_name, chapter)
                validation = validate_generated_chapter(
                    book.english_name,
                    chapter,
                    expected_verse_count=expected_count,
                    require_qa=True,
                )
                validation_results.append(validation)
                if not validation.passed:
                    tracker.record_failed(book.english_name, chapter, "; ".join(validation.issues))
                    continue
                tracker.record_completed(book.english_name)
            except Exception as exc:
                tracker.record_failed(book.english_name, chapter, f"{type(exc).__name__}: {exc}")
                continue
    write_run_reports(tracker)
    write_validation_summary(validation_results, CONFIG.reports_dir / "process_bible_validation.json")
    return tracker


def main() -> int:
    parser = argparse.ArgumentParser(description="Process the complete Bible audio library.")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--no-resume", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    tracker = process_bible(resume=not args.no_resume, force=args.force, verbose=args.verbose)
    print(
        {
            "completed": tracker.completed,
            "failed": tracker.failed,
            "skipped": tracker.skipped,
            "chapters_processed": tracker.chapters_processed,
        }
    )
    return 1 if tracker.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
