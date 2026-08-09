"""Process all discovered books for a content type."""

from __future__ import annotations

import argparse

from lib.discovery import SUPPORTED_CONTENT_TYPES, available_books
from lib.logger import get_logger
from lib.run_reports import RunTracker, write_run_reports
from process_book import BookProcessingOptions, process_book

LOGGER = get_logger("process_library")


def process_library(
    content_type: str,
    *,
    resume: bool = False,
    force: bool = False,
    dry_run: bool = False,
    verbose: bool = False,
) -> RunTracker:
    """Process all books available for a content type sequentially."""

    if content_type not in SUPPORTED_CONTENT_TYPES:
        supported = ", ".join(SUPPORTED_CONTENT_TYPES)
        raise ValueError(f"Unsupported content type '{content_type}'. Expected one of: {supported}")

    aggregate = RunTracker()
    for book in available_books(content_type):
        LOGGER.info("Processing book: %s", book)
        tracker = process_book(
            book,
            BookProcessingOptions(
                content_type=content_type,
                resume=resume,
                force=force,
                dry_run=dry_run,
                verbose=verbose,
            ),
        )
        aggregate.books_processed.update(tracker.books_processed)
        aggregate.chapters_processed += tracker.chapters_processed
        aggregate.completed += tracker.completed
        aggregate.failed += tracker.failed
        aggregate.skipped += tracker.skipped
        aggregate.failures.extend(tracker.failures)

    write_run_reports(aggregate)
    return aggregate


def main() -> int:
    """CLI entry point for library processing."""

    parser = argparse.ArgumentParser(description="Process all books in a content library.")
    parser.add_argument("--content", required=True, choices=SUPPORTED_CONTENT_TYPES)
    parser.add_argument("--resume", action="store_true", help="Skip completed chapter manifests.")
    parser.add_argument("--force", action="store_true", help="Re-run chapters even when complete.")
    parser.add_argument("--dry-run", action="store_true", help="Run without writing chapter artifacts.")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging.")
    args = parser.parse_args()

    if args.verbose:
        LOGGER.setLevel("DEBUG")

    tracker = process_library(
        args.content,
        resume=args.resume,
        force=args.force,
        dry_run=args.dry_run,
        verbose=args.verbose,
    )
    return 1 if tracker.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
