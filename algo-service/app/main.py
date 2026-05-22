from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.modules.bandit import choose_arm
from app.modules.benchmark import build_benchmark_snapshot
from app.modules.energy_model import predict_energy_scores, update_energy_model
from app.modules.estimator import estimate_quantiles
from app.modules.feasibility import evaluate_feasibility
from app.modules.forecast import run_har_forecast
from app.modules.ingestion import ingest_syllabus
from app.modules.realtime import reoptimize_schedule
from app.modules.router_runtime import choose_route, update_route_outcome
from app.modules.scheduler_core import solve_schedule
from app.modules.survival import predict_start_probability
from app.schemas import (
    BenchmarkResult,
    EnergyObservation,
    EnergyPredictRequest,
    EnergyPredictResponse,
    EstimateRequest,
    EstimateResponse,
    FeasibilityRequest,
    FeasibilityResponse,
    ForecastRequest,
    ForecastResponse,
    IngestRequest,
    IngestResponse,
    NotifyDecisionRequest,
    NotifyDecisionResponse,
    ReoptimizeRequest,
    ReoptimizeResponse,
    RouterDecisionRequest,
    RouterDecisionResponse,
    SolveRequest,
    SolveResponse,
    SurvivalRequest,
    SurvivalResponse,
)

app = FastAPI(title="Donna Algo Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/v1/syllabus/ingest", response_model=IngestResponse)
def syllabus_ingest(request: IngestRequest) -> IngestResponse:
    return ingest_syllabus(request.syllabus_text, request.llm_candidates)


@app.post("/v1/estimate/quantiles", response_model=EstimateResponse)
def estimate(request: EstimateRequest) -> EstimateResponse:
    return estimate_quantiles(request.tasks, request.history)


@app.post("/v1/schedule/solve", response_model=SolveResponse)
def schedule_solve(request: SolveRequest) -> SolveResponse:
    return solve_schedule(request)


@app.post("/v1/schedule/feasibility", response_model=FeasibilityResponse)
def schedule_feasibility(request: FeasibilityRequest) -> FeasibilityResponse:
    return evaluate_feasibility(request)


@app.post("/v1/schedule/reoptimize", response_model=ReoptimizeResponse)
def schedule_reoptimize(request: ReoptimizeRequest) -> ReoptimizeResponse:
    return reoptimize_schedule(request)


@app.post("/v1/survival/predict", response_model=SurvivalResponse)
def survival_predict(request: SurvivalRequest) -> SurvivalResponse:
    return predict_start_probability(request)


@app.post("/v1/notify/decision", response_model=NotifyDecisionResponse)
def notify_decision(request: NotifyDecisionRequest) -> NotifyDecisionResponse:
    return choose_arm(request)


@app.post("/v1/forecast/workload", response_model=ForecastResponse)
def forecast_workload(request: ForecastRequest) -> ForecastResponse:
    return run_har_forecast(request)


@app.post("/v1/energy/update")
def energy_update(observations: list[EnergyObservation]) -> dict[str, int]:
    update_energy_model(observations)
    return {"updated": len(observations)}


@app.post("/v1/energy/predict", response_model=EnergyPredictResponse)
def energy_predict(request: EnergyPredictRequest) -> EnergyPredictResponse:
    return predict_energy_scores(request)


@app.post("/v1/router/decision", response_model=RouterDecisionResponse)
def router_decision(request: RouterDecisionRequest) -> RouterDecisionResponse:
    return choose_route(request)


@app.post("/v1/router/outcome")
def router_outcome(payload: dict) -> dict[str, bool]:
    route = str(payload.get("route", "trivial"))
    clarified = bool(payload.get("clarified", False))
    complexity = float(payload.get("complexity", 0.0) or 0.0)
    latency_budget_ms = int(payload.get("latency_budget_ms", 500) or 500)
    token_cost_cents = float(payload.get("token_cost_cents", 1.0) or 1.0)
    update_route_outcome(route, clarified, complexity, latency_budget_ms, token_cost_cents)
    return {"ok": True}


@app.get("/v1/metrics/benchmark", response_model=BenchmarkResult)
def metrics_benchmark() -> BenchmarkResult:
    return build_benchmark_snapshot()
