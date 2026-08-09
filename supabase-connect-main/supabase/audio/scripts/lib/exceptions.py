"""Exception hierarchy for the Kanisa Connect audio pipeline."""


class AudioPipelineError(Exception):
    """Base class for expected audio pipeline failures."""


class ConfigurationError(AudioPipelineError):
    """Raised when required pipeline configuration is invalid."""


class AudioValidationError(AudioPipelineError):
    """Raised when an audio file fails validation."""


class TranscriptionError(AudioPipelineError):
    """Raised when transcription cannot be completed."""


class AlignmentError(AudioPipelineError):
    """Raised when alignment cannot be completed."""


class IndexBuildError(AudioPipelineError):
    """Raised when a verse index cannot be built."""


class IndexValidationError(AudioPipelineError):
    """Raised when a verse index fails validation."""


class IndexImportError(AudioPipelineError):
    """Raised when a verse index cannot be imported."""
