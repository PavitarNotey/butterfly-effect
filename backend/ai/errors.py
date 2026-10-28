class AIError(Exception):
    """Safe application error; never includes provider bodies or settings."""

    def __init__(self, message: str, status: int = 503):
        """Store a safe public message and HTTP status; omit raw provider error bodies."""
        super().__init__(message)
        self.status = status
