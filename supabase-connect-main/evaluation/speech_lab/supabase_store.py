from __future__ import annotations

import json
import os
from dataclasses import asdict
from pathlib import Path
from typing import Any

import requests
try:
    from dotenv import dotenv_values, load_dotenv
except ImportError:  # pragma: no cover - declared dependency may be absent in minimal test envs
    dotenv_values = None
    load_dotenv = None

from .corpus import chapter_by_id
from .models import EvaluationResult, Transcript

DEFAULT_ENV_FILE = Path(__file__).resolve().parent / ".env.evaluation"
DEFAULT_EVALUATION_ENV_FILE = DEFAULT_ENV_FILE
FORBIDDEN_VITE_SERVICE_ROLE = "VITE_SUPABASE_" + "SERVICE_ROLE_KEY"


class EvaluationSupabaseStoreError(RuntimeError):
    """Raised when evaluation-only Supabase persistence fails."""


class EvaluationSupabaseStore:
    """Persist golden references and report payloads in isolated evaluation tables."""

    def __init__(
        self,
        url: str | None = None,
        service_role_key: str | None = None,
        *,
        env_file: str | Path | None = DEFAULT_ENV_FILE,
    ) -> None:
        if url is None or service_role_key is None:
            load_evaluation_environment(env_file)
        _reject_vite_service_role(os.environ)
        self.url = (url or os.environ.get("SUPABASE_URL") or "").rstrip("/")
        self.service_role_key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not self.url or not self.service_role_key:
            raise EvaluationSupabaseStoreError(_missing_credentials_message(env_file))
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": self.service_role_key,
                "authorization": f"Bearer {self.service_role_key}",
                "content-type": "application/json",
                "prefer": "return=representation",
            }
        )

    @classmethod
    def from_env_file(cls, path: str | Path | None = None) -> "EvaluationSupabaseStore":
        env_path = Path(path) if path is not None else DEFAULT_ENV_FILE
        load_evaluation_environment(env_path)
        return cls(env_file=env_path)

    def upsert_golden_reference(self, transcript: Transcript, *, imported_by: str | None = None) -> dict[str, Any]:
        chapter = chapter_by_id(transcript.chapter_id)
        payload = {
            "chapter_id": transcript.chapter_id,
            "book": chapter.book,
            "chapter": chapter.chapter,
            "translation_code": transcript.metadata.get("translation_code", "sw-biblica"),
            "source_name": transcript.metadata.get("source_name"),
            "source_hash": transcript.metadata.get("source_hash"),
            "reference_payload": transcript.to_dict(),
            "imported_by": imported_by,
            "metadata": {
                key: value
                for key, value in transcript.metadata.items()
                if key not in {"translation_code", "source_name", "source_hash"}
            },
        }
        rows = self._request(
            "POST",
            "/rest/v1/evaluation_golden_references?on_conflict=chapter_id",
            json=[payload],
            headers={"prefer": "resolution=merge-duplicates,return=representation"},
        )
        return rows[0]

    def load_golden_reference(self, chapter_id: str) -> Transcript:
        rows = self._request(
            "GET",
            f"/rest/v1/evaluation_golden_references?chapter_id=eq.{chapter_id}&select=reference_payload&limit=1",
        )
        if not rows:
            raise EvaluationSupabaseStoreError(f"No golden reference found for {chapter_id}")
        return Transcript.from_dict(rows[0]["reference_payload"])

    def list_golden_references(self) -> list[dict[str, Any]]:
        return self._request(
            "GET",
            "/rest/v1/evaluation_golden_references?select=chapter_id,book,chapter,translation_code,source_name,imported_at&order=chapter_id.asc",
        )

    def upsert_model_output(
        self,
        *,
        run_id: str,
        model_id: str,
        provider: str,
        transcript: Transcript,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = {
            "run_id": run_id,
            "model_id": model_id,
            "provider": provider,
            "chapter_id": transcript.chapter_id,
            "output_payload": transcript.to_dict(),
            "metadata": metadata or {},
        }
        rows = self._request("POST", "/rest/v1/evaluation_model_outputs", json=[payload])
        return rows[0]

    def model_outputs(self, run_id: str, model_id: str | None = None) -> list[Transcript]:
        query = f"/rest/v1/evaluation_model_outputs?run_id=eq.{run_id}&select=output_payload&order=chapter_id.asc"
        if model_id:
            query += f"&model_id=eq.{model_id}"
        rows = self._request("GET", query)
        return [Transcript.from_dict(row["output_payload"]) for row in rows]

    def store_report(self, *, run_id: str, report_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        rows = self._request(
            "POST",
            "/rest/v1/evaluation_benchmark_reports",
            json=[{"run_id": run_id, "report_type": report_type, "report_payload": payload}],
        )
        return rows[0]

    def store_results(self, run_id: str, results: list[EvaluationResult], report_type: str = "comparison") -> dict[str, Any]:
        return self.store_report(
            run_id=run_id,
            report_type=report_type,
            payload={"run_id": run_id, "results": [asdict(result) for result in results]},
        )

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = self.session.request(method, f"{self.url}{path}", timeout=60, **kwargs)
        if response.status_code >= 400:
            raise EvaluationSupabaseStoreError(
                f"Supabase {method} {path} failed: {response.status_code} {_redact(response.text, self.service_role_key)}"
            )
        if not response.text:
            return []
        return json.loads(response.text)


def load_evaluation_environment(path: str | Path | None = DEFAULT_ENV_FILE, *, override: bool = False) -> Path:
    env_path = Path(path) if path is not None else DEFAULT_ENV_FILE
    if not env_path.exists():
        raise EvaluationSupabaseStoreError(_missing_credentials_message(env_path))
    loaded_values = load_evaluation_env_file(env_path, override=override)
    _reject_vite_service_role(loaded_values)
    return env_path


def load_evaluation_env_file(path: str | Path = DEFAULT_ENV_FILE, *, override: bool = False) -> dict[str, str]:
    env_path = Path(path)
    if not env_path.exists():
        raise EvaluationSupabaseStoreError(_missing_credentials_message(env_path))
    if load_dotenv is not None:
        load_dotenv(env_path, override=override)
    values = _dotenv_values(env_path)
    if load_dotenv is None:
        for key, value in values.items():
            if override or key not in os.environ:
                os.environ[key] = value
    _reject_vite_service_role(values)
    return values


def _reject_vite_service_role(values: dict[str, str] | os._Environ[str]) -> None:
    if values.get(FORBIDDEN_VITE_SERVICE_ROLE):
        raise EvaluationSupabaseStoreError(
            f"{FORBIDDEN_VITE_SERVICE_ROLE} must never be set. "
            "Use SUPABASE_SERVICE_ROLE_KEY only in the evaluation env file."
        )


def _redact(value: str, secret: str | None) -> str:
    redacted = value
    for token in (secret, os.environ.get("SUPABASE_SERVICE_ROLE_KEY")):
        if token:
            redacted = redacted.replace(token, "[REDACTED]")
    return redacted


def _dotenv_values(path: Path) -> dict[str, str]:
    if dotenv_values is not None:
        return {
            key: value
            for key, value in dotenv_values(path).items()
            if key is not None and value is not None
        }

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _missing_credentials_message(path: str | Path | None = DEFAULT_ENV_FILE) -> str:
    env_path = Path(path) if path is not None else DEFAULT_ENV_FILE
    loaded_values = _dotenv_values(env_path) if env_path.exists() else {}
    supabase_url_present = bool(os.environ.get("SUPABASE_URL") or loaded_values.get("SUPABASE_URL"))
    service_role_present = bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or loaded_values.get("SUPABASE_SERVICE_ROLE_KEY"))
    return (
        "Evaluation credentials are required. "
        f"env_file={env_path}; "
        f"env_file_exists={env_path.exists()}; "
        f"SUPABASE_URL_present={supabase_url_present}; "
        f"SUPABASE_SERVICE_ROLE_KEY_present={service_role_present}"
    )
