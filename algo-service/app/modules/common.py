from __future__ import annotations

from datetime import datetime


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def minutes_between(start: str, end: str) -> int:
    s = parse_iso(start)
    e = parse_iso(end)
    if not s or not e:
        return 0
    return max(0, int((e - s).total_seconds() // 60))


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))
