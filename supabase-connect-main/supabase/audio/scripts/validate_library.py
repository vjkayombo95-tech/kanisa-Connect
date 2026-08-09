"""Validate library sources and generated pipeline artifacts."""

from __future__ import annotations

import argparse

from lib.discovery import SUPPORTED_CONTENT_TYPES, discover_issues
from lib.logger import get_logger
from verify_pipeline import verify_pipeline

LOGGER = get_logger("validate_library")


def validate_library(content_type: str | None = None) -> list[str]:
    """Validate source completeness and generated pipeline artifacts."""

    content_types = [content_type] if content_type else list(SUPPORTED_CONTENT_TYPES)
    issues: list[str] = []

    for item in content_types:
        for issue in discover_issues(item):
            issues.append(f"{issue.content_type}/{issue.book} {issue.chapter}: {issue.reason}")

    issues.extend(verify_pipeline())
    return issues


def main() -> int:
    """CLI entry point for library validation."""

    parser = argparse.ArgumentParser(description="Validate source and pipeline artifacts.")
    parser.add_argument("--content", choices=SUPPORTED_CONTENT_TYPES, help="Optional content type to validate.")
    args = parser.parse_args()

    issues = validate_library(args.content)
    if issues:
        for issue in issues:
            LOGGER.error(issue)
            print(f"ERROR: {issue}")
        return 1

    LOGGER.info("Library validation passed")
    print("Library validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
