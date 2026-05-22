from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class CandidateTuple(BaseModel):
    item: str
    type: str = "assignment"
    due_date: str | None = None
    weight: float = 1.0
    confidence: float = 0.7


class IngestTask(BaseModel):
    id: str
    title: str
    type: str
    due_date: str | None = None
    weight: float = 1.0
    confidence: float = 0.7


class Edge(BaseModel):
    from_task_id: str
    to_task_id: str
    confidence: float = 0.5


class IngestConflict(BaseModel):
    task_id: str
    field: Literal["type", "due_date"]
    llm_value: str | None = None
    verifier_value: str | None = None
    llm_confidence: float = 0.5
    verifier_confidence: float = 0.5


class IngestRequest(BaseModel):
    syllabus_text: str = ""
    llm_candidates: list[CandidateTuple] = Field(default_factory=list)
    course_context: dict[str, Any] = Field(default_factory=dict)


class IngestResponse(BaseModel):
    tasks: list[IngestTask]
    prereq_edges: list[Edge]
    conflicts: list[IngestConflict]
    stats: dict[str, Any]


class FeatureVector(BaseModel):
    word_count: float = 0.0
    page_count: float = 0.0
    prior_similar_hours: float = 0.0
    day_of_week: int = 0
    hours_slept_proxy: float = 7.0
    course_difficulty_index: float = 0.0


class EstimatorTask(BaseModel):
    task_id: str
    user_id: str
    task_type: str
    course_id: str
    features: FeatureVector = Field(default_factory=FeatureVector)


class EstimatorObservation(BaseModel):
    user_id: str
    task_type: str
    course_id: str
    hours: float
    features: FeatureVector = Field(default_factory=FeatureVector)


class QuantileEstimate(BaseModel):
    task_id: str
    p25: float
    p50: float
    p75: float
    p90: float


class EstimateRequest(BaseModel):
    tasks: list[EstimatorTask]
    history: list[EstimatorObservation] = Field(default_factory=list)


class EstimateResponse(BaseModel):
    estimates: list[QuantileEstimate]
    diagnostics: dict[str, Any]


class TaskInput(BaseModel):
    id: str
    title: str
    task_type: str = "assignment"
    course_id: str = "general"
    deadline: str | None = None
    p75_hours: float = 1.0
    urgency: float = 1.0
    energy_profile: str = "balanced"
    prereq_ids: list[str] = Field(default_factory=list)


class SlotInput(BaseModel):
    id: str
    start: str
    end: str
    blocked: bool = False


class Preferences(BaseModel):
    no_saturday_work: bool = False
    max_switches: int | None = None
    grace_hours: int = 0


class SolveRequest(BaseModel):
    tasks: list[TaskInput]
    slots: list[SlotInput]
    blocked_slot_ids: list[str] = Field(default_factory=list)
    latency_budget_ms: int = 500
    preferences: Preferences = Field(default_factory=Preferences)
    warm_start: dict[str, str] = Field(default_factory=dict)


class ScheduleAssignment(BaseModel):
    task_id: str
    slot_id: str
    start: str
    end: str
    minutes: int


class SolveResponse(BaseModel):
    feasible: bool
    assignments: list[ScheduleAssignment]
    objective_breakdown: dict[str, float]
    overflow_hours: dict[str, float]
    unscheduled_tasks: list[str]
    switch_count: int
    route: str = "scheduler_core"
    solver_status: str = "unknown"
    latency_ms: float = 0.0


class FeasibilityRequest(BaseModel):
    base: SolveRequest
    extra_blocked_slot_ids: list[str] = Field(default_factory=list)


class FeasibilityResponse(BaseModel):
    feasible: bool
    cost_delta: float
    minimal_conflict_set: list[str]
    proposal: SolveResponse


class ReoptimizeRequest(BaseModel):
    base: SolveRequest
    changed_task_ids: list[str] = Field(default_factory=list)
    prior_solution: list[ScheduleAssignment] = Field(default_factory=list)


class ReoptimizeResponse(BaseModel):
    initial_feasible: SolveResponse
    improved: SolveResponse
    anytime: dict[str, Any]


class SurvivalSample(BaseModel):
    hours_until_deadline: float
    estimated_duration: float
    task_type: str
    time_since_last_completed: float
    schedule_density: float


class SurvivalTrainingEvent(BaseModel):
    hours_until_deadline: float
    estimated_duration: float
    task_type: str
    time_since_last_completed: float
    schedule_density: float
    time_to_start_hours: float = 4.0
    started_on_time: bool = True


class SurvivalRequest(BaseModel):
    samples: list[SurvivalSample]
    history: list[SurvivalTrainingEvent] = Field(default_factory=list)


class SurvivalResponse(BaseModel):
    start_probabilities: list[float]


class NotifyDecisionRequest(BaseModel):
    user_id: str
    hour_of_day: int
    day_of_week: int
    urgency_bucket: Literal["low", "medium", "high"] = "medium"
    acted_within_30m: bool | None = None


class NotifyDecisionResponse(BaseModel):
    selected_arm: str
    sample_value: float
    posterior_alpha: float
    posterior_beta: float
    expected_reward: float


class ForecastPoint(BaseModel):
    date: str
    load: float


class ForecastRequest(BaseModel):
    history: list[ForecastPoint]
    horizon_weeks: int = 4


class ForecastResponse(BaseModel):
    forecast: list[ForecastPoint]
    coefficients: dict[str, float]


class EnergyObservation(BaseModel):
    user_id: str
    task_type: str
    hour: int
    ratio_actual_over_estimated: float


class EnergyPredictRequest(BaseModel):
    user_id: str
    task_type: str
    hours: list[int]


class EnergyPredictResponse(BaseModel):
    scores: dict[int, float]


class RouterDecisionRequest(BaseModel):
    complexity: float = 0.0
    latency_budget_ms: int = 500
    token_cost_cents: float = 0.0


class RouterDecisionResponse(BaseModel):
    route: Literal["trivial", "standard", "complex"]
    confidence: float
    rationale: str


class BenchmarkResult(BaseModel):
    generated_at: datetime
    metrics: dict[str, Any]
