"""Validate all generated Bible indexes before import or release."""

from __future__ import annotations

import argparse

from lib.bible_books import BIBLE_BOOKS
from lib.config import CONFIG
from lib.generated_validation import validate_generated_chapter, write_validation_summary
from providers.text_provider import SupabaseBibleProvider


def validate_generated_bible(*, require_average_confidence: bool = False) -> list[object]:
    """Validate every generated Bible chapter known to Supabase."""

    provider = SupabaseBibleProvider()
    results = []
    for book in BIBLE_BOOKS:
        for chapter in provider.chapter_numbers(book.english_name):
            expected_count = provider.verse_count(book.english_name, chapter)
            results.append(
                validate_generated_chapter(
                    book.english_name,
                    chapter,
                    expected_verse_count=expected_count,
                    require_qa=True,
                    require_average_confidence=require_average_confidence,
                )
            )
    write_validation_summary(results, CONFIG.reports_dir / "generated_bible_validation.json")
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate generated Bible indexes.")
    parser.add_argument("--require-average-confidence", action="store_true")
    args = parser.parse_args()

    results = validate_generated_bible(require_average_confidence=args.require_average_confidence)
    summary = {
        "total_books": len({result.book for result in results}),
        "total_chapters": len(results),
        "total_verses": sum(result.verse_count for result in results),
        "successful_chapters": sum(1 for result in results if result.passed),
        "failed_chapters": sum(1 for result in results if not result.passed),
        "warnings": sum(len(result.warnings) for result in results),
    }
    print(summary)
    for result in results:
        if not result.passed:
            print(result.to_dict())
    return 0 if all(result.passed for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
