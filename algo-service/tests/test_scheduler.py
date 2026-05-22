from datetime import UTC, datetime, timedelta

from app.modules.feasibility import evaluate_feasibility
from app.modules.scheduler_core import solve_schedule
from app.schemas import FeasibilityRequest, SlotInput, SolveRequest, TaskInput


def make_request():
    base = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    slots = [
        SlotInput(id=f"s{i}", start=(base + timedelta(hours=i)).isoformat(), end=(base + timedelta(hours=i + 1)).isoformat())
        for i in range(8)
    ]
    tasks = [
        TaskInput(id='t1', title='Reading 1', task_type='reading', p75_hours=1, urgency=1.2),
        TaskInput(id='t2', title='Quiz 1', task_type='quiz', p75_hours=1, urgency=1.1, prereq_ids=['t1'])
    ]
    return SolveRequest(tasks=tasks, slots=slots, blocked_slot_ids=['s0'], latency_budget_ms=250)


def test_scheduler_hard_constraints_hold():
    result = solve_schedule(make_request())
    used_slots = [a.slot_id for a in result.assignments]
    assert len(used_slots) == len(set(used_slots))
    assert 's0' not in used_slots


def test_feasibility_returns_conflict_set_when_infeasible():
    req = make_request()
    extra = [slot.id for slot in req.slots]
    payload = FeasibilityRequest(base=req, extra_blocked_slot_ids=extra)
    result = evaluate_feasibility(payload)
    assert result.feasible is False
    assert len(result.minimal_conflict_set) >= 1
