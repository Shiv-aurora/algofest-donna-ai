from __future__ import annotations

import os
from copy import deepcopy

from app.modules.scheduler_core import solve_schedule
from app.schemas import FeasibilityRequest, FeasibilityResponse


def _score(solution) -> float:
    return (
        10.0 * len(solution.unscheduled_tasks)
        + 3.0 * solution.switch_count
        + sum(solution.overflow_hours.values())
    )


def _constraint_labels(request: FeasibilityRequest) -> list[str]:
    labels = [f"block_slot:{slot_id}" for slot_id in request.extra_blocked_slot_ids]
    if request.base.preferences.no_saturday_work:
        labels.append("pref:no_saturday_work")
    for task in request.base.tasks:
        if task.deadline:
            labels.append(f"deadline:{task.id}")
    return labels


def _overflow_cap_hours() -> float:
    raw = os.getenv("FEASIBILITY_OVERFLOW_EPS_HOURS", "0")
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 0.0


def _is_valid_plan(solution, overflow_eps_hours: float) -> bool:
    total_overflow = float(sum(solution.overflow_hours.values()))
    return bool(solution.feasible) and len(solution.unscheduled_tasks) == 0 and total_overflow <= overflow_eps_hours


def _build_constrained_request(request: FeasibilityRequest, active_labels: set[str]):
    candidate = deepcopy(request.base)

    blocked = set(candidate.blocked_slot_ids)
    for label in active_labels:
        if label.startswith("block_slot:"):
            blocked.add(label.split(":", 1)[1])
    candidate.blocked_slot_ids = sorted(blocked)

    candidate.preferences.no_saturday_work = "pref:no_saturday_work" in active_labels

    allowed_deadlines = {label.split(":", 1)[1] for label in active_labels if label.startswith("deadline:")}
    any_deadline_constraints = any(task.deadline for task in candidate.tasks)
    if any_deadline_constraints:
        for task in candidate.tasks:
            if task.id not in allowed_deadlines:
                task.deadline = None

    return candidate


def _is_infeasible(request: FeasibilityRequest, active_labels: set[str]) -> bool:
    attempt_req = _build_constrained_request(request, active_labels)
    attempt = solve_schedule(attempt_req)
    overflow_eps = _overflow_cap_hours() if "cap:overflow" in active_labels else float("inf")
    return not _is_valid_plan(attempt, overflow_eps)


def _exact_minimal_conflict_set(request: FeasibilityRequest, labels: list[str]) -> list[str]:
    active = list(dict.fromkeys(labels))
    if not active:
        return []

    active_set = set(active)
    if not _is_infeasible(request, active_set):
        return []

    # Exact subset-minimal IIS extraction (deletion-based).
    idx = 0
    while idx < len(active):
        label = active[idx]
        candidate = set(active)
        candidate.discard(label)
        if candidate and _is_infeasible(request, candidate):
            active = [entry for entry in active if entry != label]
        else:
            idx += 1
    return active


def evaluate_feasibility(request: FeasibilityRequest) -> FeasibilityResponse:
    overflow_eps = _overflow_cap_hours()
    base_req = deepcopy(request.base)
    base_solution = solve_schedule(base_req)

    constrained = deepcopy(request.base)
    constrained.blocked_slot_ids = list({*constrained.blocked_slot_ids, *request.extra_blocked_slot_ids})
    constrained_solution = solve_schedule(constrained)

    cost_delta = _score(constrained_solution) - _score(base_solution)

    if _is_valid_plan(constrained_solution, overflow_eps):
        return FeasibilityResponse(
            feasible=True,
            cost_delta=round(cost_delta, 3),
            minimal_conflict_set=[],
            proposal=constrained_solution,
        )

    labels = ["cap:overflow", *_constraint_labels(request)]
    conflict_set = _exact_minimal_conflict_set(request, labels)
    if not conflict_set and labels:
        conflict_set = labels[:1]

    return FeasibilityResponse(
        feasible=False,
        cost_delta=round(cost_delta, 3),
        minimal_conflict_set=conflict_set,
        proposal=constrained_solution,
    )
