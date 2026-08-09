"""Validate one generated chapter index and QA output."""

from __future__ import annotations

import argparse

from lib.generated_validation import validate_generated_chapter
from providers.text_provider import SupabaseBibleProvider


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate one generated chapter.")
    parser.add_argument("--book", required=True)
    parser.add_argument("--chapter", required=True, type=int)
    parser.add_argument("--expected-verses", type=int)
    parser.add_argument("--database-count", action="store_true")
    parser.add_argument("--require-average-confidence", action="store_true")
    args = parser.parse_args()

    expected = args.expected_verses
    if args.database_count:
        expected = len(SupabaseBibleProvider().get_chapter(args.book, args.chapter))
    result = validate_generated_chapter(
        args.book,
        args.chapter,
        expected_verse_count=expected,
        require_average_confidence=args.require_average_confidence,
    )
    print(result.to_dict())
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
