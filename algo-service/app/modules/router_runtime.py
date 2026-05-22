from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier

from app.schemas import RouterDecisionRequest, RouterDecisionResponse


ROUTES = ("trivial", "standard", "complex")
ROUTE_INDEX = {route: idx for idx, route in enumerate(ROUTES)}
_MODEL: GradientBoostingClassifier | None = None
_TRAINED = False


@dataclass(slots=True)
class RouterLogEvent:
    complexity: float
    latency_budget_ms: int
    token_cost_cents: float
    selected_route: str
    clarified: bool


_LOGS: list[RouterLogEvent] = []


def _features(complexity: float, latency_budget_ms: int, token_cost_cents: float) -> np.ndarray:
    return np.array(
        [
            max(0.0, min(1.0, complexity)),
            max(0.05, min(5.0, latency_budget_ms / 1000.0)),
            max(0.0, min(15.0, token_cost_cents)),
            max(0.0, min(1.0, complexity * latency_budget_ms / 1800.0)),
            max(0.0, min(1.0, token_cost_cents / max(1.0, latency_budget_ms / 250.0))),
        ],
        dtype=float,
    )


def _heuristic_route(complexity: float, latency_budget_ms: int, token_cost_cents: float) -> tuple[str, float, str]:
    if complexity < 0.25 and latency_budget_ms <= 450 and token_cost_cents <= 1.5:
        return "trivial", 0.84, "Deterministic low-complexity branch."
    if complexity < 0.7 and latency_budget_ms <= 900:
        return "standard", 0.74, "Moderate complexity branch."
    return "complex", 0.71, "High-complexity branch."


def _train_router_model() -> None:
    global _MODEL, _TRAINED
    if len(_LOGS) < 24:
        _TRAINED = False
        return

    x_rows = []
    y_rows = []
    weights = []
    for event in _LOGS:
        x_rows.append(_features(event.complexity, event.latency_budget_ms, event.token_cost_cents))
        route = event.selected_route if event.selected_route in ROUTE_INDEX else "standard"
        # Cost-sensitive promotion: clarified trivial decisions become standard labels.
        if event.clarified and route == "trivial":
            route = "standard"
        y_rows.append(ROUTE_INDEX[route])
        weights.append(2.2 if event.clarified else 1.0)

    x = np.vstack(x_rows)
    y = np.array(y_rows, dtype=int)
    w = np.array(weights, dtype=float)
    if len(np.unique(y)) < 2:
        _TRAINED = False
        return

    model = GradientBoostingClassifier(
        n_estimators=120,
        learning_rate=0.06,
        max_depth=3,
        random_state=7,
    )
    model.fit(x, y, sample_weight=w)
    _MODEL = model
    _TRAINED = True


def choose_route(request: RouterDecisionRequest) -> RouterDecisionResponse:
    c = max(0.0, min(1.0, request.complexity))
    latency = max(50, request.latency_budget_ms)
    token = max(0.0, request.token_cost_cents)
    if len(_LOGS) >= 24 and (not _TRAINED or len(_LOGS) % 10 == 0):
        _train_router_model()

    if _MODEL is None or not _TRAINED:
        route, confidence, rationale = _heuristic_route(c, latency, token)
        return RouterDecisionResponse(route=route, confidence=confidence, rationale=f"{rationale} model=fallback_tree")

    x = _features(c, latency, token).reshape(1, -1)
    probs = _MODEL.predict_proba(x)[0]
    class_order = list(_MODEL.classes_)
    aligned = np.zeros(len(ROUTES), dtype=float)
    for idx, class_id in enumerate(class_order):
        if 0 <= int(class_id) < len(ROUTES):
            aligned[int(class_id)] = probs[idx]

    token_cost = np.array([0.0, 1.0, 3.2], dtype=float)
    clarification_penalty = np.array([1.4, 1.0, 0.7], dtype=float)
    latency_penalty = np.array(
        [
            max(0.0, (250.0 - latency) / 250.0),
            max(0.0, (420.0 - latency) / 420.0),
            max(0.0, (700.0 - latency) / 700.0),
        ],
        dtype=float,
    )

    expected_costs = []
    for action_idx in range(len(ROUTES)):
        mismatch = float(np.sum(aligned * np.abs(np.arange(len(ROUTES)) - action_idx)))
        expected = token_cost[action_idx] + clarification_penalty[action_idx] * mismatch + latency_penalty[action_idx]
        expected_costs.append(expected)

    best_idx = int(np.argmin(np.array(expected_costs, dtype=float)))
    route = ROUTES[best_idx]
    confidence = float(max(0.5, min(0.98, aligned[best_idx] + 0.2)))
    rationale = "model=gradient_boosted_cost_sensitive"
    return RouterDecisionResponse(route=route, confidence=confidence, rationale=rationale)


def update_route_outcome(
    route: str,
    clarified: bool,
    complexity: float = 0.0,
    latency_budget_ms: int = 500,
    token_cost_cents: float = 1.0,
) -> None:
    normalized_route = route if route in ROUTE_INDEX else "standard"
    _LOGS.append(
        RouterLogEvent(
            complexity=max(0.0, min(1.0, complexity)),
            latency_budget_ms=max(50, int(latency_budget_ms)),
            token_cost_cents=max(0.0, float(token_cost_cents)),
            selected_route=normalized_route,
            clarified=bool(clarified),
        )
    )
    # bounded in-memory log
    if len(_LOGS) > 5000:
        del _LOGS[: len(_LOGS) - 5000]
