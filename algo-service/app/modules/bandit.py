from __future__ import annotations

import random
from collections import defaultdict

from app.schemas import NotifyDecisionRequest, NotifyDecisionResponse


_rng = random.Random(17)
# arm -> [alpha, beta]
_POSTERIORS: dict[str, list[float]] = defaultdict(lambda: [1.0, 1.0])


def _arm_id(hour: int, day: int, urgency: str) -> str:
    return f"{day:01d}:{hour:02d}:{urgency}"


def _adjacent_hours(hour: int) -> list[int]:
    values = [hour]
    for delta in (1, 2):
        values.append((hour + delta) % 24)
        values.append((hour - delta) % 24)
    return values


def _pooled_prior(day: int, hour: int, urgency: str) -> tuple[float, float]:
    alphas = []
    betas = []
    for h in _adjacent_hours(hour):
        a, b = _POSTERIORS[_arm_id(h, day, urgency)]
        alphas.append(a)
        betas.append(b)
    if not alphas:
        return 1.0, 1.0
    return max(1.0, sum(alphas) / len(alphas)), max(1.0, sum(betas) / len(betas))


def choose_arm(request: NotifyDecisionRequest) -> NotifyDecisionResponse:
    day = max(0, min(6, request.day_of_week))

    candidates = [
        _arm_id(hour, day, request.urgency_bucket)
        for hour in sorted(set(_adjacent_hours(request.hour_of_day)))
    ]

    best_arm = candidates[0]
    best_sample = -1.0

    for arm in candidates:
        hour = int(arm.split(":")[1])
        a0, b0 = _pooled_prior(day, hour, request.urgency_bucket)
        a, b = _POSTERIORS[arm]
        sample = _rng.betavariate((a + a0) / 2.0, (b + b0) / 2.0)
        if sample > best_sample:
            best_sample = sample
            best_arm = arm

    if request.acted_within_30m is not None:
        alpha, beta = _POSTERIORS[best_arm]
        if request.acted_within_30m:
            alpha += 1
        else:
            beta += 1
        _POSTERIORS[best_arm] = [alpha, beta]

    alpha, beta = _POSTERIORS[best_arm]
    expected = alpha / (alpha + beta)

    return NotifyDecisionResponse(
        selected_arm=best_arm,
        sample_value=round(best_sample, 4),
        posterior_alpha=round(alpha, 3),
        posterior_beta=round(beta, 3),
        expected_reward=round(expected, 4),
    )
