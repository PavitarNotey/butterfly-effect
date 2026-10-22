"""Coordinate-only secondary-provider check, not a Metrica file importer."""

import math


def normalized_position(x: float, y: float):
    """Metrica CSV: (0,0) top left, (1,1) bottom right, centre (.5,.5)."""
    if not all(math.isfinite(n) for n in (x, y)):
        raise ValueError("Nonfinite normalized position")
    return ((x - 0.5) * 105, 0, (y - 0.5) * 68)
