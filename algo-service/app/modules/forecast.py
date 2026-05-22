from __future__ import annotations

from datetime import timedelta

import numpy as np

from app.schemas import ForecastPoint, ForecastRequest, ForecastResponse


def _to_series(history: list[ForecastPoint]) -> tuple[list[str], np.ndarray]:
    ordered = sorted(history, key=lambda x: x.date)
    dates = [item.date for item in ordered]
    values = np.array([item.load for item in ordered], dtype=float)
    return dates, values


def run_har_forecast(request: ForecastRequest) -> ForecastResponse:
    if len(request.history) < 8:
        base = request.history[-1].load if request.history else 10.0
        output = []
        for idx in range(request.horizon_weeks):
            output.append(ForecastPoint(date=f"week+{idx+1}", load=round(base, 3)))
        return ForecastResponse(
            forecast=output,
            coefficients={"beta_d": 0.5, "beta_w": 0.3, "beta_m": 0.2, "bias": 0.0},
        )

    dates, values = _to_series(request.history)

    x_rows = []
    y = []
    for t in range(7, len(values)):
        day = values[t - 1]
        week = float(np.mean(values[max(0, t - 7):t]))
        month = float(np.mean(values[max(0, t - 30):t]))
        x_rows.append([day, week, month, 1.0])
        y.append(values[t])

    X = np.array(x_rows, dtype=float)
    Y = np.array(y, dtype=float)
    coeff, *_ = np.linalg.lstsq(X, Y, rcond=None)
    beta_d, beta_w, beta_m, bias = coeff.tolist()

    forecast_values = list(values)
    out = []
    for idx in range(request.horizon_weeks):
        t = len(forecast_values)
        day = forecast_values[t - 1]
        week = float(np.mean(forecast_values[max(0, t - 7):t]))
        month = float(np.mean(forecast_values[max(0, t - 30):t]))
        pred = beta_d * day + beta_w * week + beta_m * month + bias
        pred = max(0.0, float(pred))
        forecast_values.append(pred)
        out.append(ForecastPoint(date=f"week+{idx+1}", load=round(pred, 3)))

    return ForecastResponse(
        forecast=out,
        coefficients={
            "beta_d": round(beta_d, 5),
            "beta_w": round(beta_w, 5),
            "beta_m": round(beta_m, 5),
            "bias": round(bias, 5),
        },
    )
