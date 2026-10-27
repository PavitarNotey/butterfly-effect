class AIError(Exception):
    """Safe application error; never includes provider bodies or settings."""

    def __init__(self, message: str, status: int = 503):
        super().__init__(message)
        self.status = status
