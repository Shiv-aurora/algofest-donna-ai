from __future__ import annotations

import math
import time
from collections import defaultdict

from ortools.sat.python import cp_model

from app.modules.common import minutes_between, parse_iso
from app.schemas import ScheduleAssignment, SlotInput, SolveRequest, SolveResponse, TaskInput

ENERGY_COST = {
    "deep": {"morning": 1, "afternoon": 2, "evening": 5},
    "reading": {"morning": 2, "afternoon": 3, "evening": 3},
    "assignment": {"morning": 3, "afternoon": 2, "evening": 2},
    "quiz": {"morning": 2, "afternoon": 2, "evening": 3},
    "project": {"morning": 2, "afternoon": 2, "evening": 4},
}


def _is_slot_eligible(task: TaskInput, slot: SlotInput, blocked_slot_ids: set[str], grace_hours: int) -> bool:
    if slot.blocked or slot.id in blocked_slot_ids:
        return False
    return not _is_deadline_blocked(task, slot, grace_hours)


def _hour_bucket(hour: int) -> str:
    if hour < 12:
        return "morning"
    if hour < 18:
        return "afternoon"
    return "evening"


def _slot_duration(slot: SlotInput) -> int:
    minutes = minutes_between(slot.start, slot.end)
    return max(15, minutes)


def _is_deadline_blocked(task: TaskInput, slot: SlotInput, grace_hours: int) -> bool:
    if not task.deadline:
        return False
    deadline = parse_iso(task.deadline)
    start = parse_iso(slot.start)
    if not deadline or not start:
        return False
    return start.timestamp() > deadline.timestamp() + grace_hours * 3600


def _fallback_solve(request: SolveRequest) -> SolveResponse:
    assignments: list[ScheduleAssignment] = []
    task_remaining = {task.id: max(30, int(task.p75_hours * 60)) for task in request.tasks}
    blocked_ids = set(request.blocked_slot_ids)

    for slot in request.slots:
        if slot.id in blocked_ids or slot.blocked:
            continue
        duration = _slot_duration(slot)
        best_task = None
        best_score = -1.0
        for task in request.tasks:
            if task_remaining[task.id] <= 0:
                continue
            score = float(task.urgency) + 0.5 * float(task_remaining[task.id])
            if score > best_score:
                best_task = task
                best_score = score
        if not best_task:
            continue
        task_remaining[best_task.id] -= duration
        assignments.append(
            ScheduleAssignment(
                task_id=best_task.id,
                slot_id=slot.id,
                start=slot.start,
                end=slot.end,
                minutes=duration,
            )
        )

    unscheduled = [task_id for task_id, remaining in task_remaining.items() if remaining > 0]
    return SolveResponse(
        feasible=True,
        assignments=assignments,
        objective_breakdown={"fallback": 1.0},
        overflow_hours={task_id: round(max(0, remaining) / 60.0, 2) for task_id, remaining in task_remaining.items()},
        unscheduled_tasks=unscheduled,
        switch_count=max(0, len(assignments) - 1),
        route="fallback",
        solver_status="fallback",
        latency_ms=0.0,
    )


def _compute_objective_from_slot_map(
    request: SolveRequest,
    slot_task: list[int | None],
    durations: list[int],
    task_index: dict[str, int],
) -> tuple[float, dict[str, float], int]:
    tasks = request.tasks
    slots = request.slots
    grace = max(0, request.preferences.grace_hours)
    blocked_ids = set(request.blocked_slot_ids)

    planned_minutes = [0 for _ in tasks]
    energy_cost = 0.0
    switch_count = 0
    prereq_penalty = 0.0

    for s, task_idx in enumerate(slot_task):
        if task_idx is None:
            continue
        task = tasks[task_idx]
        slot = slots[s]
        planned_minutes[task_idx] += durations[s]
        task_profile = task.energy_profile if task.energy_profile in ENERGY_COST else task.task_type
        mapping = ENERGY_COST.get(task_profile, ENERGY_COST.get("assignment", {}))
        hour = parse_iso(slot.start).hour if parse_iso(slot.start) else 12
        energy_cost += float(mapping.get(_hour_bucket(hour), 2))

        if not _is_slot_eligible(task, slot, blocked_ids, grace):
            energy_cost += 1_000.0

    for s in range(1, len(slot_task)):
        left = slot_task[s - 1]
        right = slot_task[s]
        if left is not None and right is not None and left != right:
            switch_count += 1

    overflow_total = 0.0
    overflow_sq = 0.0
    unscheduled_penalty = 0.0
    overflow_map: dict[str, float] = {}
    for idx, task in enumerate(tasks):
        required = max(15, int(task.p75_hours * 60))
        overflow = max(0, required - planned_minutes[idx])
        overflow_hours = overflow / 60.0
        overflow_map[task.id] = round(overflow_hours, 2)
        overflow_total += overflow_hours
        overflow_sq += overflow * overflow
        if planned_minutes[idx] == 0:
            unscheduled_penalty += float(max(1, round(task.urgency * 10)))

    # prerequisite cumulative-order violation penalty
    prereq_pairs: list[tuple[int, int]] = []
    for child in tasks:
        child_idx = task_index.get(child.id)
        if child_idx is None:
            continue
        for prereq_id in child.prereq_ids:
            pre_idx = task_index.get(prereq_id)
            if pre_idx is not None:
                prereq_pairs.append((pre_idx, child_idx))

    task_slots: dict[int, list[int]] = defaultdict(list)
    for slot_idx, task_idx in enumerate(slot_task):
        if task_idx is not None:
            task_slots[task_idx].append(slot_idx)

    for pre_idx, child_idx in prereq_pairs:
        pre_slots = task_slots.get(pre_idx, [])
        child_slots = task_slots.get(child_idx, [])
        if child_slots and not pre_slots:
            prereq_penalty += 500.0
            continue
        if pre_slots and child_slots and min(child_slots) < min(pre_slots):
            prereq_penalty += 300.0

    score = energy_cost + 2.0 * switch_count + overflow_sq + unscheduled_penalty + prereq_penalty
    breakdown = {
        "slot_assignments": float(sum(1 for entry in slot_task if entry is not None)),
        "switches": float(switch_count),
        "overflow_total": float(round(overflow_total, 3)),
    }
    return score, breakdown, switch_count


def _build_slot_map(
    request: SolveRequest,
    assignments: list[ScheduleAssignment],
    slot_index: dict[str, int],
    task_index: dict[str, int],
) -> list[int | None]:
    slot_task: list[int | None] = [None] * len(request.slots)
    for assignment in assignments:
        s_idx = slot_index.get(assignment.slot_id)
        t_idx = task_index.get(assignment.task_id)
        if s_idx is None or t_idx is None:
            continue
        slot_task[s_idx] = t_idx
    return slot_task


def _slot_map_to_assignments(
    request: SolveRequest,
    slot_task: list[int | None],
    durations: list[int],
    slot_index: dict[str, int],
) -> list[ScheduleAssignment]:
    assignments: list[ScheduleAssignment] = []
    for s_idx, t_idx in enumerate(slot_task):
        if t_idx is None:
            continue
        slot = request.slots[s_idx]
        task = request.tasks[t_idx]
        assignments.append(
            ScheduleAssignment(
                task_id=task.id,
                slot_id=slot.id,
                start=slot.start,
                end=slot.end,
                minutes=durations[s_idx],
            )
        )
    assignments.sort(key=lambda entry: slot_index[entry.slot_id])
    return assignments


def _tabu_warm_restart(
    request: SolveRequest,
    initial_assignments: list[ScheduleAssignment],
    durations: list[int],
    task_index: dict[str, int],
    slot_index: dict[str, int],
) -> tuple[list[ScheduleAssignment], dict[str, float], int]:
    # Warm restart local search for larger schedules using tabu memory.
    slot_task = _build_slot_map(request, initial_assignments, slot_index, task_index)
    current = list(slot_task)
    best = list(slot_task)
    best_score, _, _ = _compute_objective_from_slot_map(request, best, durations, task_index)
    current_score = best_score
    tabu: dict[str, int] = {}
    tenure = 7
    max_iters = min(160, max(60, len(request.tasks)))

    blocked_ids = set(request.blocked_slot_ids)
    grace = max(0, request.preferences.grace_hours)

    def can_place(task_idx: int | None, slot_idx: int) -> bool:
        if task_idx is None:
            return True
        task = request.tasks[task_idx]
        slot = request.slots[slot_idx]
        return _is_slot_eligible(task, slot, blocked_ids, grace)

    def candidate_move_signatures() -> list[tuple[str, list[int | None], str]]:
        candidates: list[tuple[str, list[int | None], str]] = []
        occupied = [idx for idx, value in enumerate(current) if value is not None]
        free = [idx for idx, value in enumerate(current) if value is None]
        if not occupied:
            return candidates

        sample_slots = occupied[: min(len(occupied), 40)]
        for s in sample_slots:
            task_idx = current[s]
            if task_idx is None:
                continue
            for step in (-3, -2, -1, 1, 2, 3):
                target = s + step
                if target < 0 or target >= len(current):
                    continue
                if current[target] is not None:
                    continue
                if not can_place(task_idx, target):
                    continue
                nxt = list(current)
                nxt[s] = None
                nxt[target] = task_idx
                candidates.append((f"shift:{s}:{target}", nxt, "shift"))

            for target in free[:16]:
                if target == s or not can_place(task_idx, target):
                    continue
                nxt = list(current)
                nxt[s] = None
                nxt[target] = task_idx
                candidates.append((f"reassign:{s}:{target}", nxt, "reassign"))

        for idx_a in range(min(len(sample_slots), 24)):
            for idx_b in range(idx_a + 1, min(len(sample_slots), 24)):
                a = sample_slots[idx_a]
                b = sample_slots[idx_b]
                ta, tb = current[a], current[b]
                if ta is None or tb is None:
                    continue
                if not can_place(ta, b) or not can_place(tb, a):
                    continue
                nxt = list(current)
                nxt[a], nxt[b] = nxt[b], nxt[a]
                candidates.append((f"swap:{a}:{b}", nxt, "swap"))
        return candidates

    for iteration in range(max_iters):
        for key in list(tabu):
            tabu[key] -= 1
            if tabu[key] <= 0:
                del tabu[key]

        candidates = candidate_move_signatures()
        if not candidates:
            break

        chosen_key = None
        chosen_state = None
        chosen_score = float("inf")
        for key, state, _move_type in candidates:
            score, _, _ = _compute_objective_from_slot_map(request, state, durations, task_index)
            is_tabu = key in tabu
            if is_tabu and score >= best_score:
                continue
            if score < chosen_score:
                chosen_score = score
                chosen_key = key
                chosen_state = state

        if chosen_state is None or chosen_key is None:
            break

        current = chosen_state
        current_score = chosen_score
        tabu[chosen_key] = tenure
        if current_score < best_score:
            best_score = current_score
            best = list(current)

        if iteration > 15 and abs(best_score - current_score) < 1e-6:
            continue

    assignments = _slot_map_to_assignments(request, best, durations, slot_index)
    _score, breakdown, switch_count = _compute_objective_from_slot_map(request, best, durations, task_index)
    return assignments, breakdown, switch_count


def solve_schedule(request: SolveRequest) -> SolveResponse:
    if not request.tasks or not request.slots:
        return SolveResponse(
            feasible=True,
            assignments=[],
            objective_breakdown={"empty": 0.0},
            overflow_hours={},
            unscheduled_tasks=[],
            switch_count=0,
            route="scheduler_core",
            solver_status="empty",
            latency_ms=0.0,
        )

    start_time = time.perf_counter()

    try:
        model = cp_model.CpModel()
        tasks = request.tasks
        slots = request.slots
        blocked_slot_ids = set(request.blocked_slot_ids)
        grace = max(0, request.preferences.grace_hours)

        task_index = {task.id: idx for idx, task in enumerate(tasks)}
        slot_index = {slot.id: idx for idx, slot in enumerate(slots)}
        durations = [_slot_duration(slot) for slot in slots]

        x = {}
        for i, task in enumerate(tasks):
            for s, slot in enumerate(slots):
                var = model.NewBoolVar(f"x_{i}_{s}")
                x[(i, s)] = var
                if slot.blocked or slot.id in blocked_slot_ids or _is_deadline_blocked(task, slot, grace):
                    model.Add(var == 0)

        y = [model.NewBoolVar(f"y_{i}") for i in range(len(tasks))]
        overflow = [model.NewIntVar(0, 24 * 60, f"overflow_{i}") for i in range(len(tasks))]
        overflow_sq = [model.NewIntVar(0, (24 * 60) ** 2, f"overflow_sq_{i}") for i in range(len(tasks))]

        occupied = [model.NewBoolVar(f"occ_{s}") for s in range(len(slots))]

        for s in range(len(slots)):
            slot_sum = sum(x[(i, s)] for i in range(len(tasks)))
            model.Add(slot_sum <= 1)
            model.Add(slot_sum == occupied[s])

        for i, task in enumerate(tasks):
            required_minutes = max(15, int(task.p75_hours * 60))
            planned = sum(x[(i, s)] * durations[s] for s in range(len(slots)))
            model.Add(planned + overflow[i] >= required_minutes)
            count_slots = sum(x[(i, s)] for s in range(len(slots)))
            model.Add(count_slots >= y[i])
            model.Add(count_slots <= len(slots) * y[i])
            model.AddMultiplicationEquality(overflow_sq[i], [overflow[i], overflow[i]])

        # prerequisite order constraints
        prereq_pairs: list[tuple[int, int]] = []
        for child in tasks:
            for prereq_id in child.prereq_ids:
                if prereq_id in task_index and child.id in task_index:
                    prereq_pairs.append((task_index[prereq_id], task_index[child.id]))

        for j, i in prereq_pairs:
            for k in range(len(slots)):
                left = sum(x[(j, s)] for s in range(k + 1))
                right = sum(x[(i, s)] for s in range(k + 1))
                model.Add(left + (1 - y[i]) * len(slots) >= right)

        # switching cost
        switches = []
        for s in range(1, len(slots)):
            same_task = model.NewBoolVar(f"same_{s}")
            same_terms = []
            for i in range(len(tasks)):
                z = model.NewBoolVar(f"z_{i}_{s}")
                model.AddBoolAnd([x[(i, s - 1)], x[(i, s)]]).OnlyEnforceIf(z)
                model.AddBoolOr([x[(i, s - 1)].Not(), x[(i, s)].Not()]).OnlyEnforceIf(z.Not())
                same_terms.append(z)
            model.Add(sum(same_terms) == same_task)

            sw = model.NewBoolVar(f"switch_{s}")
            model.Add(sw >= occupied[s - 1] + occupied[s] - 1 - same_task)
            switches.append(sw)

        objective_terms = []
        # energy mismatch term
        for i, task in enumerate(tasks):
            task_profile = task.energy_profile if task.energy_profile in ENERGY_COST else task.task_type
            mapping = ENERGY_COST.get(task_profile, ENERGY_COST.get("assignment", {}))
            for s, slot in enumerate(slots):
                hour = parse_iso(slot.start).hour if parse_iso(slot.start) else 12
                mismatch = mapping.get(_hour_bucket(hour), 2)
                objective_terms.append(mismatch * x[(i, s)])

        # context switches
        objective_terms.extend(2 * sw for sw in switches)

        # overflow quadratic and urgency penalty for unscheduled tasks
        for i, task in enumerate(tasks):
            objective_terms.append(overflow_sq[i])
            urgency = int(max(1, round(task.urgency * 10)))
            objective_terms.append(urgency * (1 - y[i]))

        model.Minimize(sum(objective_terms))

        # warm start hints
        for task_id, slot_id in request.warm_start.items():
            if task_id in task_index and slot_id in slot_index:
                model.AddHint(x[(task_index[task_id], slot_index[slot_id])], 1)

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = max(0.05, request.latency_budget_ms / 1000)
        solver.parameters.num_search_workers = 8

        status = solver.Solve(model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            fallback = _fallback_solve(request)
            fallback.solver_status = "infeasible_fallback"
            fallback.feasible = False
            fallback.latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return fallback

        assignments: list[ScheduleAssignment] = []
        overflow_hours: dict[str, float] = {}

        by_slot = defaultdict(list)
        for i, task in enumerate(tasks):
            overflow_hours[task.id] = round(solver.Value(overflow[i]) / 60.0, 2)
            for s, slot in enumerate(slots):
                if solver.Value(x[(i, s)]) > 0:
                    by_slot[s].append(task.id)
                    assignments.append(
                        ScheduleAssignment(
                            task_id=task.id,
                            slot_id=slot.id,
                            start=slot.start,
                            end=slot.end,
                            minutes=durations[s],
                        )
                    )

        assignments.sort(key=lambda entry: slot_index[entry.slot_id])

        unscheduled = [task.id for i, task in enumerate(tasks) if solver.Value(y[i]) == 0]
        switch_count = sum(1 for sw in switches if solver.Value(sw) > 0)

        objective_breakdown = {
            "slot_assignments": float(len(assignments)),
            "switches": float(switch_count),
            "overflow_total": float(sum(overflow_hours.values())),
        }

        # For larger instances, apply tabu warm restart using warm start + CP-SAT incumbent.
        if len(tasks) > 100:
            tabu_assignments, tabu_breakdown, tabu_switches = _tabu_warm_restart(
                request=request,
                initial_assignments=assignments,
                durations=durations,
                task_index=task_index,
                slot_index=slot_index,
            )
            assignments = tabu_assignments
            switch_count = tabu_switches
            objective_breakdown = {
                **tabu_breakdown,
                "warm_restart": 1.0,
                "tabu_tenure": 7.0,
            }
            # recompute overflow/unscheduled from tabu-improved assignment map.
            slot_task = _build_slot_map(request, assignments, slot_index, task_index)
            planned = [0 for _ in tasks]
            for s_idx, t_idx in enumerate(slot_task):
                if t_idx is not None:
                    planned[t_idx] += durations[s_idx]
            overflow_hours = {}
            unscheduled = []
            for idx, task in enumerate(tasks):
                required = max(15, int(task.p75_hours * 60))
                remaining = max(0, required - planned[idx])
                overflow_hours[task.id] = round(remaining / 60.0, 2)
                if planned[idx] <= 0:
                    unscheduled.append(task.id)

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        status_name = {
            cp_model.OPTIMAL: "optimal",
            cp_model.FEASIBLE: "feasible",
        }.get(status, "unknown")

        return SolveResponse(
            feasible=True,
            assignments=assignments,
            objective_breakdown=objective_breakdown,
            overflow_hours=overflow_hours,
            unscheduled_tasks=unscheduled,
            switch_count=switch_count,
            route="scheduler_core",
            solver_status=status_name,
            latency_ms=latency_ms,
        )
    except Exception:
        fallback = _fallback_solve(request)
        fallback.solver_status = "exception_fallback"
        fallback.latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return fallback
