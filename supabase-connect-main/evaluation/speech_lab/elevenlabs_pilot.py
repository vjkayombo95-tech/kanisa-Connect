from __future__ import annotations

import json
import os
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None


MAX_PILOT_TEXT_CHARS = 500
DEFAULT_MODEL_ID = "eleven_multilingual_v2"
DEFAULT_VERSION = "rc-3.4.0"
DEFAULT_ENV_FILE = Path("supabase/functions/.env.local")


class ElevenLabsPilotError(RuntimeError):
    pass


@dataclass(frozen=True)
class PilotPlan:
    test_id: str
    text: str
    character_count: int
    voice_id_redacted: str
    model_id: str
    audio_version: str
    destination_bucket: str
    destination_path: str
    existing_output: str
    estimated_api_requests: int
    dry_run: bool


def redact(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return f"{value[:2]}..."
    return f"{value[:4]}...{value[-4:]}"


def load_env_file(path: str | Path | None) -> None:
    env_path = Path(path) if path else DEFAULT_ENV_FILE
    if not env_path.exists():
        return
    if load_dotenv:
        load_dotenv(env_path, override=False)
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        if not name or name in os.environ:
            continue
        os.environ[name] = value.strip().strip('"').strip("'")


def validate_test_id(test_id: str) -> str:
    cleaned = test_id.strip()
    if not cleaned:
        raise ElevenLabsPilotError("test-id is required")
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-")
    if any(char not in allowed for char in cleaned):
        raise ElevenLabsPilotError("test-id must use uppercase letters, numbers, underscore, or dash only")
    return cleaned


def load_sample_text(path: str | Path) -> str:
    text = Path(path).read_text(encoding="utf-8").strip()
    if not text:
        raise ElevenLabsPilotError("pilot text sample is blank")
    if len(text) > MAX_PILOT_TEXT_CHARS:
        raise ElevenLabsPilotError(f"pilot text exceeds {MAX_PILOT_TEXT_CHARS} characters")
    if text.count("\n") > 1:
        raise ElevenLabsPilotError("pilot text must be one short sample, not multiple paragraphs")
    return text


def destination_path(voice_id: str, test_id: str) -> str:
    safe_voice = "".join(char if char.isalnum() or char in "._-" else "-" for char in voice_id)
    safe_test = "".join(char if char.isalnum() or char in "._-" else "-" for char in test_id)
    return f"elevenlabs/{safe_voice}/{safe_test}.mp3"


def build_plan(
    *,
    test_id: str,
    text_file: str | Path,
    env_file: str | Path | None = None,
    dry_run: bool,
    existing_output: str = "not_checked",
) -> PilotPlan:
    load_env_file(env_file)
    cleaned_test_id = validate_test_id(test_id)
    text = load_sample_text(text_file)
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "")
    if not voice_id:
        raise ElevenLabsPilotError("ELEVENLABS_VOICE_ID is required for pilot planning")
    model_id = os.getenv("ELEVENLABS_MODEL_ID", DEFAULT_MODEL_ID)
    audio_version = os.getenv("BIBLE_AUDIO_VERSION", DEFAULT_VERSION)
    return PilotPlan(
        test_id=cleaned_test_id,
        text=text,
        character_count=len(text),
        voice_id_redacted=redact(voice_id),
        model_id=model_id,
        audio_version=audio_version,
        destination_bucket="bible-audio-pilot",
        destination_path=destination_path(voice_id, cleaned_test_id),
        existing_output=existing_output,
        estimated_api_requests=0 if dry_run else 1,
        dry_run=dry_run,
    )


def request_payload(plan: PilotPlan, *, confirm_billable_generation: bool, diagnostic: bool = False) -> dict[str, object]:
    return {
        "pilot": True,
        "testId": plan.test_id,
        "text": plan.text,
        "dryRun": plan.dry_run or diagnostic,
        "confirmBillableGeneration": confirm_billable_generation,
        "diagnostic": diagnostic,
    }


def invoke_edge_function(
    *,
    function_url: str,
    access_token: str,
    payload: dict[str, object],
    local_pilot_token: str | None = None,
) -> dict[str, object]:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    if local_pilot_token:
        headers["x-kanisa-pilot-token"] = local_pilot_token
    request = urllib.request.Request(
        function_url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise ElevenLabsPilotError(_format_http_error(error.code, body)) from error
    except ConnectionResetError as error:
        raise ElevenLabsPilotError(
            "pilot request connection reset: the outcome is ambiguous and may have reached the Edge Function. "
            "Do not retry billable generation until Supabase Function logs are checked."
        ) from error
    except TimeoutError as error:
        raise ElevenLabsPilotError(
            "pilot request timed out: the outcome is ambiguous and may have reached the Edge Function. "
            "Do not retry billable generation until Supabase Function logs are checked."
        ) from error
    except socket.timeout as error:
        raise ElevenLabsPilotError(
            "pilot request socket timed out: the outcome is ambiguous and may have reached the Edge Function. "
            "Do not retry billable generation until Supabase Function logs are checked."
        ) from error
    except urllib.error.URLError as error:
        reason = getattr(error, "reason", "network error")
        safe_reason = reason.__class__.__name__ if not isinstance(reason, str) else reason
        raise ElevenLabsPilotError(
            f"pilot request network error: {safe_reason}. The request may not have reached the Edge Function; "
            "check Supabase Function logs before any billable retry."
        ) from error
    except json.JSONDecodeError as error:
        raise ElevenLabsPilotError("pilot function returned a non-JSON response; check Supabase Function logs.") from error


def _format_http_error(status: int, body: str) -> str:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        payload = {"message": "Function returned a non-JSON error response."}
    safe_payload = _safe_error_payload(payload)
    return f"pilot function returned HTTP {status}: {json.dumps(safe_payload, ensure_ascii=False)}"


def _safe_error_payload(payload: object) -> dict[str, object]:
    if not isinstance(payload, dict):
        return {"message": "Function returned an unexpected error response."}
    allowed = {
        "ok",
        "success",
        "stage",
        "error_code",
        "message",
        "provider_status",
        "retryable",
        "test_id",
        "diagnostic",
        "voiceSource",
        "voiceIdRedacted",
        "modelId",
        "audioVersion",
        "estimatedApiRequests",
    }
    return {key: value for key, value in payload.items() if key in allowed}


def plan_to_safe_dict(plan: PilotPlan) -> dict[str, object]:
    redacted_destination = plan.destination_path
    parts = redacted_destination.split("/")
    if len(parts) >= 3:
        parts[1] = plan.voice_id_redacted
        redacted_destination = "/".join(parts)
    return {
        "test_id": plan.test_id,
        "dry_run": plan.dry_run,
        "character_count": plan.character_count,
        "voice_id_redacted": plan.voice_id_redacted,
        "model_id": plan.model_id,
        "audio_version": plan.audio_version,
        "destination_bucket": plan.destination_bucket,
        "destination_path": redacted_destination,
        "existing_output": plan.existing_output,
        "estimated_api_requests": plan.estimated_api_requests,
    }
