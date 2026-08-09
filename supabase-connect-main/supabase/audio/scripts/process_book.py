"""Batch process every discovered chapter in a book."""

from __future__ import annotations

import argparse
from dataclasses import dataclass

from lib.discovery import SourceChapter, discover_book
from lib.exceptions import AudioPipelineError
from lib.logger import get_logger
from lib.manifest import load_manifest
from lib.run_reports import ProgressDisplay, RunTracker, is_manifest_complete, write_run_reports
from process_chapter import can_skip_completed_chapter, process_chapter

LOGGER = get_logger("process_book")


@dataclass(frozen=True)
class BookProcessingOptions:
    """Options for processing a whole book."""

    content_type: str = "bible"
    resume: bool = False
    force: bool = False
    dry_run: bool = False
    verbose: bool = False


def process_book(book: str, options: BookProcessingOptions | None = None) -> RunTracker:
    """Process all discovered chapters in a book, continuing after failures."""

    opts = options or BookProcessingOptions()
    chapters = discover_book(opts.content_type, book)
    tracker = RunTracker()
    progress = ProgressDisplay(_display_book(book), len(chapters))

    try:
        for chapter in sorted(chapters, key=lambda item: item.chapter):
            chapter_label = f"{chapter.book} {chapter.chapter}"
            if _should_skip(chapter, opts):
                tracker.record_skipped(chapter.book)
                progress.update(chapter_label, "skipped")
                continue
            try:
                process_chapter(
                    chapter.audio_path,
                    book=chapter.book,
                    chapter=chapter.chapter,
                    content_type=chapter.content_type,
                    force=opts.force,
                    resume=opts.resume,
                    dry_run=opts.dry_run,
                )
            except Exception as exc:
                reason = _failure_reason(exc)
                LOGGER.error("Chapter failed: %s: %s", chapter_label, reason)
                tracker.record_failed(chapter.book, chapter.chapter, reason)
                progress.update(chapter_label, "failed")
                continue
            tracker.record_completed(chapter.book)
            progress.update(chapter_label, "completed")
    finally:
        progress.close()

    write_run_reports(tracker)
    return tracker


def main() -> int:
    """CLI entry point for book processing."""

    parser = argparse.ArgumentParser(description="Process every discovered chapter in a book.")
    parser.add_argument("--book", required=True, help="Book name, for example genesis.")
    parser.add_argument("--content", default="bible", help="Content type. Defaults to bible.")
    parser.add_argument("--resume", action="store_true", help="Skip completed chapter manifests.")
    parser.add_argument("--force", action="store_true", help="Re-run chapters even when complete.")
    parser.add_argument("--dry-run", action="store_true", help="Run without writing chapter artifacts.")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging.")
    args = parser.parse_args()

    if args.verbose:
        LOGGER.setLevel("DEBUG")

    tracker = process_book(
        args.book,
        BookProcessingOptions(
            content_type=args.content,
            resume=args.resume,
            force=args.force,
            dry_run=args.dry_run,
            verbose=args.verbose,
        ),
    )
    return 1 if tracker.failed else 0


def _should_skip(chapter: SourceChapter, options: BookProcessingOptions) -> bool:
    """Return whether a chapter should be skipped for resume mode."""

    if options.force or not options.resume:
        return False
    manifest = load_manifest(chapter.book, chapter.chapter)
    return is_manifest_complete(manifest) and can_skip_completed_chapter(chapter.book, chapter.chapter)


def _failure_reason(exc: Exception) -> str:
    """Return a user-facing failure reason."""

    if isinstance(exc, AudioPipelineError):
        return str(exc)
    return f"{type(exc).__name__}: {exc}"


def _display_book(book: str) -> str:
    """Normalize a book name for display."""

    return book.replace("_", " ").strip().title()


if __name__ == "__main__":
    raise SystemExit(main())
