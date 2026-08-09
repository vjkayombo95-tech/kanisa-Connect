from __future__ import annotations

import os
import sys
from pathlib import Path

from .corpus import chapter_by_id
from .supabase_store import DEFAULT_ENV_FILE, load_evaluation_env_file
from .verse_alignment import CanonicalVerse


REPO_ROOT = Path(__file__).resolve().parents[2]
TEXT_PROVIDER_PATH = REPO_ROOT / "supabase" / "audio" / "scripts"


def load_canonical_verses_from_supabase(
    chapter_id: str,
    *,
    env_file: str | Path | None = DEFAULT_ENV_FILE,
    translation_code: str = "sw-biblica",
) -> list[CanonicalVerse]:
    values = load_evaluation_env_file(env_file or DEFAULT_ENV_FILE)
    url = values.get("SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = values.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if str(TEXT_PROVIDER_PATH) not in sys.path:
        sys.path.insert(0, str(TEXT_PROVIDER_PATH))
    from providers.text_provider import SupabaseBibleProvider

    chapter = chapter_by_id(chapter_id)
    provider = SupabaseBibleProvider(url=url, key=key)
    return [
        CanonicalVerse(verse=item.verse, text=item.text)
        for item in provider.get_chapter(chapter.book, chapter.chapter, translation_code)
    ]
