from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
HF_CACHE = Path.home() / ".cache" / "huggingface" / "hub"
MODEL_CACHE_IDS = {
    "faster-whisper-small": HF_CACHE / "models--Systran--faster-whisper-small",
    "faster-whisper-medium": HF_CACHE / "models--Systran--faster-whisper-medium",
}


@dataclass
class CleanupItem:
    path: str
    category: str
    size_bytes: int
    safe_to_remove: bool
    reason: str


def audit_cleanup(
    *,
    remove_python_cache: bool = False,
    remove_temp_downloads: bool = False,
    remove_models: set[str] | None = None,
) -> list[CleanupItem]:
    remove_models = remove_models or set()
    items: list[CleanupItem] = []
    for model_id, path in MODEL_CACHE_IDS.items():
        if path.exists():
            items.append(
                CleanupItem(
                    path=str(path),
                    category="model_cache",
                    size_bytes=path_size(path),
                    safe_to_remove=model_id in remove_models,
                    reason="explicit --remove-model required; small should be retained unless explicitly requested",
                )
            )
    for root in (REPO_ROOT / "evaluation", REPO_ROOT / "supabase" / "audio"):
        for path in root.rglob("__pycache__"):
            items.append(
                CleanupItem(
                    path=str(path),
                    category="python_cache",
                    size_bytes=path_size(path),
                    safe_to_remove=remove_python_cache,
                    reason="rebuildable Python bytecode cache",
                )
            )
    for pattern in ("*.incomplete", "*.lock", "*.tmp"):
        for path in HF_CACHE.rglob(pattern) if HF_CACHE.exists() else []:
            items.append(
                CleanupItem(
                    path=str(path),
                    category="temp_download",
                    size_bytes=path_size(path),
                    safe_to_remove=remove_temp_downloads,
                    reason="temporary Hugging Face download/cache artifact",
                )
            )
    for path in (
        REPO_ROOT / "evaluation" / "speech_lab" / "model_outputs",
        REPO_ROOT / "evaluation" / "speech_lab" / "reports",
        REPO_ROOT / "evaluation" / "speech_lab" / "golden",
    ):
        if path.exists():
            items.append(
                CleanupItem(
                    path=str(path),
                    category="preserved_benchmark_artifact",
                    size_bytes=path_size(path),
                    safe_to_remove=False,
                    reason="preserve benchmark outputs, reports, workbooks, and Golden Reference artifacts",
                )
            )
    return items


def cleanup(items: list[CleanupItem], *, dry_run: bool) -> None:
    if dry_run:
        return
    for item in items:
        if item.safe_to_remove:
            path = Path(item.path)
            if path.is_dir():
                shutil.rmtree(path)
            elif path.exists():
                path.unlink()


def path_size(path: Path) -> int:
    if path.is_file():
        return path.stat().st_size
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())


def free_space(path: Path = REPO_ROOT) -> int:
    return shutil.disk_usage(path).free


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit and safely clean evaluation cache artifacts.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--remove-python-cache", action="store_true")
    parser.add_argument("--remove-temp-downloads", action="store_true")
    parser.add_argument("--remove-model", action="append", default=[])
    args = parser.parse_args()
    items = audit_cleanup(
        remove_python_cache=args.remove_python_cache,
        remove_temp_downloads=args.remove_temp_downloads,
        remove_models=set(args.remove_model),
    )
    recoverable = sum(item.size_bytes for item in items if item.safe_to_remove)
    payload = {
        "dry_run": args.dry_run,
        "free_space_before_bytes": free_space(),
        "recoverable_bytes": recoverable,
        "expected_free_space_after_removal_bytes": free_space() + recoverable,
        "items": [asdict(item) for item in items],
    }
    print(json.dumps(payload, indent=2))
    cleanup(items, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
