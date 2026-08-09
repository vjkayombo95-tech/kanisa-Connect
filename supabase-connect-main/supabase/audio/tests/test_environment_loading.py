"""Tests for audio engine environment loading."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from lib.environment import load_audio_environment


SUPABASE_ENV_KEYS = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
]


def test_env_local_is_loaded(tmp_path: Path, monkeypatch, caplog) -> None:
    """The audio engine should load project-root .env.local."""

    audio_root = _audio_root(tmp_path)
    env_path = tmp_path / ".env.local"
    env_path.write_text(
        "\n".join(
            [
                "SUPABASE_URL=https://local.supabase.test",
                "SUPABASE_ANON_KEY=local-anon-key",
                "SUPABASE_SERVICE_ROLE_KEY=local-service-key",
            ]
        ),
        encoding="utf-8",
    )
    _clear_env(monkeypatch)

    with caplog.at_level(logging.INFO, logger="audio_environment"):
        loaded_path = load_audio_environment(audio_root, tmp_path, override=True)

    assert loaded_path == env_path
    assert os.environ["SUPABASE_URL"] == "https://local.supabase.test"
    assert os.environ["SUPABASE_ANON_KEY"] == "local-anon-key"
    assert os.environ["SUPABASE_SERVICE_ROLE_KEY"] == "local-service-key"
    assert "Loaded environment from:" in caplog.text
    assert str(env_path) in caplog.text
    assert "local-service-key" not in caplog.text


def test_env_staging_local_is_loaded_when_higher_priority_files_are_absent(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """The loader should fall through to project-root .env.staging.local."""

    audio_root = _audio_root(tmp_path)
    env_path = tmp_path / ".env.staging.local"
    env_path.write_text(
        "\n".join(
            [
                "SUPABASE_URL=https://staging.supabase.test",
                "SUPABASE_ANON_KEY=staging-anon-key",
                "SUPABASE_SERVICE_ROLE_KEY=staging-service-key",
            ]
        ),
        encoding="utf-8",
    )
    _clear_env(monkeypatch)

    loaded_path = load_audio_environment(audio_root, tmp_path, override=True)

    assert loaded_path == env_path
    assert os.environ["SUPABASE_URL"] == "https://staging.supabase.test"
    assert os.environ["SUPABASE_ANON_KEY"] == "staging-anon-key"
    assert os.environ["SUPABASE_SERVICE_ROLE_KEY"] == "staging-service-key"


def test_vite_supabase_variables_are_mapped(tmp_path: Path, monkeypatch) -> None:
    """React Vite Supabase variables should populate Python SUPABASE keys."""

    audio_root = _audio_root(tmp_path)
    env_path = tmp_path / ".env.local"
    env_path.write_text(
        "\n".join(
            [
                "VITE_SUPABASE_URL=https://vite.supabase.test",
                "VITE_SUPABASE_ANON_KEY=vite-anon-key",
            ]
        ),
        encoding="utf-8",
    )
    _clear_env(monkeypatch)

    loaded_path = load_audio_environment(audio_root, tmp_path, override=True)

    assert loaded_path == env_path
    assert os.environ["SUPABASE_URL"] == "https://vite.supabase.test"
    assert os.environ["SUPABASE_ANON_KEY"] == "vite-anon-key"


def _audio_root(project_root: Path) -> Path:
    audio_root = project_root / "supabase" / "audio"
    audio_root.mkdir(parents=True)
    return audio_root


def _clear_env(monkeypatch) -> None:
    for key in SUPABASE_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
