"""Pure authoring helpers shared by the goal and dummy recipes; no runtime interpolation."""

import json
from itertools import pairwise


def slopes(route, axis):
    h = [b[0] - a[0] for a, b in pairwise(route)]
    d = [(b[axis] - a[axis]) / dt for a, b, dt in zip(route, route[1:], h)]
    result = [d[0]]
    for i in range(1, len(route) - 1):
        if d[i - 1] * d[i] <= 0:
            result.append(0)
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            result.append((w1 + w2) / (w1 / d[i - 1] + w2 / d[i]))
    return [*result, d[-1]]


def sample_route(route, t):
    i = next(
        (i for i, (_, b) in enumerate(pairwise(route)) if t <= b[0]),
        len(route) - 2,
    )
    a, b = route[i : i + 2]
    h = b[0] - a[0]
    u = (t - a[0]) / h
    result = []
    for axis in (1, 2):
        m = slopes(route, axis)
        result.append(
            (2 * u**3 - 3 * u**2 + 1) * a[axis]
            + (u**3 - 2 * u**2 + u) * h * m[i]
            + (-2 * u**3 + 3 * u**2) * b[axis]
            + (u**3 - u**2) * h * m[i + 1]
        )
    return result


def canonical_text(value, depth=0):
    """Readable metadata and one compact line per baked key, avoiding a large
    whitespace-only increase in the frontend's exact-raw-text source import.
    """
    indent = "  " * depth
    child = indent + "  "
    if isinstance(value, dict):
        if set(value) in ({"t", "position"}, {"t", "yaw"}):
            return json.dumps(value, separators=(",", ":"))
        return (
            "{\n"
            + ",\n".join(
                child + json.dumps(k) + ": " + canonical_text(v, depth + 1)
                for k, v in value.items()
            )
            + "\n"
            + indent
            + "}"
        )
    if isinstance(value, list):
        if not value or all(isinstance(v, (int, float)) for v in value):
            return json.dumps(value, separators=(",", ":"))
        return (
            "[\n"
            + ",\n".join(child + canonical_text(v, depth + 1) for v in value)
            + "\n"
            + indent
            + "]"
        )
    return json.dumps(value)

