from __future__ import annotations

import random
import time
from copy import deepcopy

from app.modules.common import parse_iso
from app.modules.scheduler_core import solve_schedule
from app.schemas import ReoptimizeRequest, ReoptimizeResponse, ScheduleAssignment, SolveResponse


_rng = random.Random(42)


def _warm_start_map(request: ReoptimizeRequest) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for assignment in request.prior_solution:
        mapping[assignment.task_id] = assignment.slot_id
    return mapping


def _objective(solution) -> float:
    return (
        8.0 * len(solution.unscheduled_tasks)
        + 2.5 * solution.switch_count
        + sum(solution.overflow_hours.values())
    )


def _destroy_warm_start(mapping: dict[str, str], changed_task_ids: list[str], fraction: float = 0.2) -> dict[str, str]:
    mutable = dict(mapping)
    for task_id in changed_task_ids:
        mutable.pop(task_id, None)

    keys = list(mutable.keys())
    _rng.shuffle(keys)
    remove_count = max(0, int(len(keys) * fraction))
    for key in keys[:remove_count]:
        mutable.pop(key, None)
    return mutable


def _destroy_local_neighborhood(
    mapping: dict[str, str],
    changed_task_ids: list[str],
    task_slot: dict[str, str],
    task_deadline_ts: dict[str, float],
    fraction: float,
) -> dict[str, str]:
    mutable = dict(mapping)
    all_task_ids = list(task_slot.keys())
    if not all_task_ids:
        return mutable

    desired = max(1, int(len(all_task_ids) * fraction))
    neighborhood = set(changed_task_ids)

    anchor_deadlines = [task_deadline_ts.get(task_id) for task_id in changed_task_ids if task_deadline_ts.get(task_id) is not None]
    if anchor_deadlines:
        anchor = min(anchor_deadlines)
        ranked_by_deadline = sorted(
            [task_id for task_id in all_task_ids if task_id not in neighborhood],
            key=lambda task_id: abs((task_deadline_ts.get(task_id, anchor)) - anchor),
        )
        for task_id in ranked_by_deadline:
            neighborhood.add(task_id)
            if len(neighborhood) >= desired:
                break

    if len(neighborhood) < desired:
        leftover = [task_id for task_id in all_task_ids if task_id not in neighborhood]
        _rng.shuffle(leftover)
        for task_id in leftover:
            neighborhood.add(task_id)
            if len(neighborhood) >= desired:
                break

    for task_id in neighborhood:
        mutable.pop(task_id, None)
    return mutable


def _solution_from_prior(request: ReoptimizeRequest) -> SolveResponse:
    slot_ids = {slot.id for slot in request.base.slots}
    task_ids = {task.id for task in request.base.tasks}
    assignments: list[ScheduleAssignment] = []
    seen_slots = set()
    seen_tasks = set()
    for assignment in request.prior_solution:
        if assignment.slot_id not in slot_ids or assignment.task_id not in task_ids:
            continue
        if assignment.slot_id in seen_slots or assignment.task_id in seen_tasks:
            continue
        seen_slots.add(assignment.slot_id)
        seen_tasks.add(assignment.task_id)
        assignments.append(assignment)

    overflow_hours = {task.id: 0.0 for task in request.base.tasks}
    unscheduled = [task.id for task in request.base.tasks if task.id not in seen_tasks]
    for task in request.base.tasks:
        if task.id in seen_tasks:
            continue
        overflow_hours[task.id] = float(max(0.0, task.p75_hours))

    return SolveResponse(
        feasible=len(unscheduled) == 0,
        assignments=assignments,
        objective_breakdown={"slot_assignments": float(len(assignments)), "switches": 0.0, "overflow_total": float(sum(overflow_hours.values()))},
        overflow_hours=overflow_hours,
        unscheduled_tasks=unscheduled,
        switch_count=0,
        route="scheduler_core",
        solver_status="warm_start_seed",
        latency_ms=0.0,
    )


def reoptimize_schedule(request: ReoptimizeRequest) -> ReoptimizeResponse:
    started = time.perf_counter()
    warm_map = _warm_start_map(request)
    first_solution_budget_ms = min(80, max(40, request.base.latency_budget_ms // 4))
    task_deadline_ts = {
        task.id: (parse_iso(task.deadline).timestamp() if task.deadline and parse_iso(task.deadline) else 0.0)
        for task in request.base.tasks
    }
    task_slot = {assignment.task_id: assignment.slot_id for assignment in request.prior_solution}

    initial_feasible = _solution_from_prior(request) if request.prior_solution else solve_schedule(deepcopy(request.base))
    best_solution = initial_feasible
    best_obj = _objective(initial_feasible)
    timeline: list[dict] = [
        {
            "iter": 0,
            "objective": round(best_obj, 4),
            "assignments": len(initial_feasible.assignments),
            "elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
        }
    ]

    budget_ms = max(500, request.base.latency_budget_ms)
    iteration = 1
    while (time.perf_counter() - started) * 1000 < budget_ms:
        elapsed_ms = (time.perf_counter() - started) * 1000
        remaining = max(60, int(budget_ms - elapsed_ms))
        fraction = 0.10 + 0.05 * ((iteration - 1) % 3)

        trial_request = deepcopy(request.base)
        trial_request.latency_budget_ms = min(180, remaining)
        trial_request.warm_start = _destroy_local_neighborhood(
            mapping=warm_map,
            changed_task_ids=request.changed_task_ids,
            task_slot=task_slot,
            task_deadline_ts=task_deadline_ts,
            fraction=fraction,
        )
        candidate = solve_schedule(trial_request)
        objective = _objective(candidate)
        if objective <= best_obj:
            best_obj = objective
            best_solution = candidate

        timeline.append(
            {
                "iter": iteration,
                "objective": round(best_obj, 4),
                "candidate_objective": round(objective, 4),
                "destroy_ratio": round(fraction, 2),
                "elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
            }
        )
        iteration += 1
        if remaining <= 80:
            break

    return ReoptimizeResponse(
        initial_feasible=initial_feasible,
        improved=best_solution,
        anytime={
            "first_solution_budget_ms": first_solution_budget_ms,
            "improvement_budget_ms": budget_ms,
            "destroy_ratio_range": [0.1, 0.2],
            "changed_task_count": len(request.changed_task_ids),
            "iterations": iteration - 1,
            "best_objective": round(best_obj, 4),
            "timeline": timeline,
            "anytime_guarantee": "best_non_worsening",
        },
    )
