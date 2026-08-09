from __future__ import annotations

import subprocess
import time
import tracemalloc
from contextlib import AbstractContextManager

from .models import ResourceUsage


class ResourceMonitor(AbstractContextManager["ResourceMonitor"]):
    def __enter__(self) -> "ResourceMonitor":
        self.started_at = time.perf_counter()
        tracemalloc.start()
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        self.finished_at = time.perf_counter()
        self.peak_ram_mb = peak / (1024 * 1024)
        self.peak_vram_mb, self.gpu_utilization_percent = sample_nvidia_smi()

    def usage(self) -> ResourceUsage:
        return ResourceUsage(
            processing_time_seconds=self.finished_at - self.started_at,
            peak_ram_mb=getattr(self, "peak_ram_mb", None),
            peak_vram_mb=getattr(self, "peak_vram_mb", None),
            gpu_utilization_percent=getattr(self, "gpu_utilization_percent", None),
            cpu_utilization_percent=None,
        )


def sample_nvidia_smi() -> tuple[float | None, float | None]:
    command = [
        "nvidia-smi",
        "--query-gpu=memory.used,utilization.gpu",
        "--format=csv,noheader,nounits",
    ]
    try:
        completed = subprocess.run(command, check=False, capture_output=True, text=True, timeout=2)
    except (FileNotFoundError, subprocess.SubprocessError):
        return None, None
    if completed.returncode != 0 or not completed.stdout.strip():
        return None, None
    first = completed.stdout.strip().splitlines()[0]
    parts = [part.strip() for part in first.split(",")]
    try:
        return float(parts[0]), float(parts[1])
    except (IndexError, ValueError):
        return None, None
