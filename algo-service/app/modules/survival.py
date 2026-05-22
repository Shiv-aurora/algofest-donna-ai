from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd
from lifelines import CoxPHFitter

from app.modules.common import clamp
from app.schemas import SurvivalRequest, SurvivalResponse


TYPE_EFFECT = {
    "reading": -0.18,
    "assignment": 0.05,
    "quiz": 0.12,
    "project": -0.08,
    "exam": 0.2,
}


_COX_STATE: dict[str, Any] = {
    "model": None,
    "columns": [],
}


def _row_from_sample(sample, task_types: list[str]) -> dict[str, float]:
    row = {
        "hours_until_deadline": float(sample.hours_until_deadline),
        "estimated_duration": float(sample.estimated_duration),
        "time_since_last_completed": float(sample.time_since_last_completed),
        "schedule_density": float(sample.schedule_density),
    }
    for task_type in task_types:
        row[f"task_{task_type}"] = 1.0 if sample.task_type == task_type else 0.0
    return row


def _build_training_dataframe(request: SurvivalRequest) -> pd.DataFrame:
    task_types = sorted({sample.task_type for sample in request.samples} | {row.task_type for row in request.history})
    if not task_types:
        task_types = ["assignment"]

    rows: list[dict[str, float]] = []
    if request.history:
        for event in request.history:
            row = _row_from_sample(event, task_types)
            row["duration"] = float(max(0.1, event.time_to_start_hours))
            row["event"] = 1 if event.started_on_time else 0
            rows.append(row)

    if len(rows) < 10:
        # bootstrap with weakly-informed synthetic rows to keep the Cox fitter stable.
        for sample in request.samples:
            row = _row_from_sample(sample, task_types)
            baseline = (
                0.8
                - 0.02 * float(sample.hours_until_deadline)
                - 0.14 * float(sample.estimated_duration)
                - 0.06 * float(sample.time_since_last_completed)
                - 0.40 * float(sample.schedule_density)
                + TYPE_EFFECT.get(sample.task_type, 0.0)
            )
            start_prob = clamp(1.0 / (1.0 + math.exp(-baseline)), 0.08, 0.92)
            row["duration"] = float(max(0.1, min(24.0, sample.hours_until_deadline * 0.6 + 0.8)))
            row["event"] = 1 if start_prob >= 0.5 else 0
            rows.append(row)
            row2 = dict(row)
            row2["duration"] = float(max(0.1, min(24.0, sample.hours_until_deadline * 0.8 + 1.3)))
            row2["event"] = 1 if start_prob >= 0.35 else 0
            rows.append(row2)

    df = pd.DataFrame(rows)
    return df


def _fit_cox_model(request: SurvivalRequest) -> tuple[CoxPHFitter | None, list[str]]:
    try:
        df = _build_training_dataframe(request)
        covariates = [column for column in df.columns if column not in {"duration", "event"}]
        if len(df) < 6 or df["event"].nunique() < 2:
            return None, covariates

        model = CoxPHFitter(penalizer=0.08)
        model.fit(df, duration_col="duration", event_col="event")
        _COX_STATE["model"] = model
        _COX_STATE["columns"] = covariates
        return model, covariates
    except Exception:
        return None, []


def _predict_with_fallback(sample) -> float:
    linear = (
        -0.022 * sample.hours_until_deadline
        -0.16 * sample.estimated_duration
        -0.08 * sample.time_since_last_completed
        -0.45 * sample.schedule_density
        + TYPE_EFFECT.get(sample.task_type, 0.0)
        + 0.75
    )
    hazard = math.exp(linear)
    start_prob = 1.0 - math.exp(-hazard * 0.7)
    return clamp(start_prob, 0.01, 0.99)


def predict_start_probability(request: SurvivalRequest) -> SurvivalResponse:
    if not request.samples:
        return SurvivalResponse(start_probabilities=[])

    model, covariates = _fit_cox_model(request)
    if model is None:
        model = _COX_STATE.get("model")
        covariates = list(_COX_STATE.get("columns", []))

    if model is None or not covariates:
        return SurvivalResponse(start_probabilities=[round(_predict_with_fallback(sample), 4) for sample in request.samples])

    # build prediction frame aligned to fitted covariates
    task_types = sorted(
        {
            key.split("_", 1)[1]
            for key in covariates
            if key.startswith("task_") and len(key.split("_", 1)) == 2
        }
    )
    pred_rows = []
    for sample in request.samples:
        row = _row_from_sample(sample, task_types)
        for column in covariates:
            row.setdefault(column, 0.0)
        pred_rows.append({column: row[column] for column in covariates})
    pred_df = pd.DataFrame(pred_rows, columns=covariates)

    try:
        baseline_hazard = model.baseline_cumulative_hazard_.iloc[:, 0]
        times = baseline_hazard.index.to_numpy(dtype=float)
        values = baseline_hazard.to_numpy(dtype=float)
        partial_hazard = model.predict_partial_hazard(pred_df).to_numpy(dtype=float)

        probs: list[float] = []
        for idx, sample in enumerate(request.samples):
            horizon = float(max(0.2, min(24.0, sample.hours_until_deadline)))
            h0 = float(np.interp(horizon, times, values, left=values[0], right=values[-1]))
            survival_prob = math.exp(-h0 * max(1e-8, partial_hazard[idx]))
            start_prob = clamp(1.0 - survival_prob, 0.01, 0.99)
            probs.append(round(start_prob, 4))
        return SurvivalResponse(start_probabilities=probs)
    except Exception:
        return SurvivalResponse(start_probabilities=[round(_predict_with_fallback(sample), 4) for sample in request.samples])
