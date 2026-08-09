from __future__ import annotations

from ..models import ModelSpec
from .base import SpeechModelAdapter
from .manifest import ManifestProvider
from .placeholder import PlaceholderProvider


class ProviderFactory:
    def create(self, spec: ModelSpec) -> SpeechModelAdapter:
        if spec.provider == "manifest":
            return ManifestProvider(spec)
        return PlaceholderProvider(spec)
