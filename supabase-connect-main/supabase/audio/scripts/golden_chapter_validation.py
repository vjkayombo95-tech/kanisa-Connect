"""Process and validate production golden Bible chapters."""

from __future__ import annotations

import argparse

from lib.config import CONFIG
from lib.generated_validation import validate_generated_chapter, write_validation_summary
from process_chapter import process_chapter
from providers.text_provider import SupabaseBibleProvider


GOLDEN_CHAPTERS = (
    ("Genesis", 1),
    ("Psalm", 23),
    ("Matthew", 5),
    ("John", 3),
    ("Romans", 8),
)


def run_golden_suite(*, resume: bool = True, force: bool = False, verbose: bool = False) -> list[object]:
    """Process and validate representative golden chapters."""

    provider = SupabaseBibleProvider()
    results = []
    for book, chapter in GOLDEN_CHAPTERS:
        process_chapter(
            book=book,
            chapter=chapter,
            content_type="bible",
            resume=resume,
            force=force,
        )
        expected_count = provider.verse_count(book, chapter)
        result = validate_generated_chapter(
            book,
            chapter,
            expected_verse_count=expected_count,
            require_qa=True,
            require_average_confidence=True,
        )
        results.append(result)
        if not result.passed:
            break
        if verbose:
            print(result.to_dict())
    write_validation_summary(results, CONFIG.reports_dir / "golden_chapter_validation.json")
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Run golden chapter validation suite.")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--no-resume", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    results = run_golden_suite(resume=not args.no_resume, force=args.force, verbose=args.verbose)
    for result in results:
        print(result.to_dict())
    return 0 if all(result.passed for result in results) and len(results) == len(GOLDEN_CHAPTERS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
