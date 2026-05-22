from __future__ import annotations

import random
from collections import defaultdict

import numpy as np

from app.schemas import EnergyObservation, EnergyPredictRequest, EnergyPredictResponse


_rng = random.Random(91)
K = 5
LR = 0.02
L2 = 0.001

_USER_FACTORS: dict[str, np.ndarray] = {}
_ITEM_FACTORS: dict[str, np.ndarray] = {}


def _key(task_type: str, hour: int) -> str:
    return f"{task_type}:{hour:02d}"


def _init_vec() -> np.ndarray:
    return np.array([_rng.uniform(-0.1, 0.1) for _ in range(K)], dtype=float)


def _user(user_id: str) -> np.ndarray:
    if user_id not in _USER_FACTORS:
        _USER_FACTORS[user_id] = _init_vec()
    return _USER_FACTORS[user_id]


def _item(task_type: str, hour: int) -> np.ndarray:
    key = _key(task_type, hour)
    if key not in _ITEM_FACTORS:
        _ITEM_FACTORS[key] = _init_vec()
    return _ITEM_FACTORS[key]


def update_energy_model(observations: list[EnergyObservation]) -> None:
    for obs in observations:
        hour = max(0, min(23, obs.hour))
        u = _user(obs.user_id)
        v = _item(obs.task_type, hour)

        target = float(obs.ratio_actual_over_estimated)
        pred = float(np.dot(u, v))
        err = pred - target

        u_grad = err * v + L2 * u
        v_grad = err * u + L2 * v

        _USER_FACTORS[obs.user_id] = u - LR * u_grad
        _ITEM_FACTORS[_key(obs.task_type, hour)] = v - LR * v_grad


def predict_energy_scores(request: EnergyPredictRequest) -> EnergyPredictResponse:
    user_vec = _user(request.user_id)
    scores: dict[int, float] = {}

    for hour in request.hours:
        safe_hour = max(0, min(23, hour))
        item_vec = _item(request.task_type, safe_hour)
        ratio = float(np.dot(user_vec, item_vec))
        # lower actual/estimated ratio means better slot; invert for score
        score = 1.0 / max(0.15, abs(ratio) + 0.15)
        scores[safe_hour] = round(score, 4)

    return EnergyPredictResponse(scores=scores)
