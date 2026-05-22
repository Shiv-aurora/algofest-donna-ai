from __future__ import annotations

import math
from statistics import NormalDist

import numpy as np

from app.schemas import EstimateResponse, EstimatorObservation, EstimatorTask, QuantileEstimate


def _safe_log_hours(hours: float) -> float:
    return math.log(max(0.1, hours))


def _feature_vector(task: EstimatorTask) -> list[float]:
    f = task.features
    return [
        float(f.word_count) / 1000.0,
        float(f.page_count),
        float(max(0.0, f.prior_similar_hours)),
        float(max(0, min(6, f.day_of_week))),
        float(max(0.0, f.hours_slept_proxy - 7.0)),
        float(f.course_difficulty_index),
    ]


def _inverse_gamma_sample(rng: np.random.Generator, shape: float, scale: float) -> float:
    return 1.0 / rng.gamma(shape=shape, scale=1.0 / max(scale, 1e-9))


def _gibbs_posterior(
    history: list[EstimatorObservation], rng: np.random.Generator, iterations: int = 120, burn_in: int = 60
) -> dict:
    if not history:
        global_mean = _safe_log_hours(2.0)
        return {
            "mu": global_mean,
            "sigma2": 0.35,
            "delta": np.array([0.12, 0.08, 0.18, 0.02, -0.05, 0.08], dtype=float),
            "alpha": {},
            "beta": {},
            "gamma": {},
            "diag": {
                "history_count": 0,
                "global_log_mean": round(global_mean, 4),
                "global_log_var": 0.35,
                "tau_user2": 0.6,
                "tau_type2": 0.5,
            },
        }

    user_keys = sorted({entry.user_id for entry in history})
    type_keys = sorted({entry.task_type for entry in history})
    course_keys = sorted({entry.course_id for entry in history})
    user_index = {key: idx for idx, key in enumerate(user_keys)}
    type_index = {key: idx for idx, key in enumerate(type_keys)}
    course_index = {key: idx for idx, key in enumerate(course_keys)}

    y = np.array([_safe_log_hours(entry.hours) for entry in history], dtype=float)
    x = np.array([_feature_vector(entry) for entry in history], dtype=float)
    user_ids = np.array([user_index[entry.user_id] for entry in history], dtype=int)
    type_ids = np.array([type_index[entry.task_type] for entry in history], dtype=int)
    course_ids = np.array([course_index[entry.course_id] for entry in history], dtype=int)

    n = len(history)
    p = x.shape[1]

    user_members = [np.where(user_ids == idx)[0] for idx in range(len(user_keys))]
    type_members = [np.where(type_ids == idx)[0] for idx in range(len(type_keys))]
    course_members = [np.where(course_ids == idx)[0] for idx in range(len(course_keys))]

    # hierarchical conjugate priors
    mu0 = float(np.mean(y))
    v0 = 5.0
    a_sigma, b_sigma = 2.5, 1.2
    a_u, b_u = 2.0, 0.7
    a_t, b_t = 2.0, 0.6
    a_c, b_c = 2.0, 0.6
    tau_delta2 = 4.0

    mu = mu0
    alpha = np.zeros(len(user_keys), dtype=float)
    beta = np.zeros(len(type_keys), dtype=float)
    gamma = np.zeros(len(course_keys), dtype=float)
    delta = np.zeros(p, dtype=float)

    sigma2 = max(0.08, float(np.var(y)) + 0.15)
    tau_u2 = 0.9
    tau_t2 = 0.8
    tau_c2 = 0.8

    kept_mu: list[float] = []
    kept_sigma2: list[float] = []
    kept_tau_u2: list[float] = []
    kept_tau_t2: list[float] = []
    kept_alpha = np.zeros_like(alpha)
    kept_beta = np.zeros_like(beta)
    kept_gamma = np.zeros_like(gamma)
    kept_delta = np.zeros_like(delta)
    kept = 0

    for step in range(iterations):
        fixed_no_mu = alpha[user_ids] + beta[type_ids] + gamma[course_ids] + x @ delta
        resid = y - fixed_no_mu
        mu_var = 1.0 / (n / sigma2 + 1.0 / v0)
        mu_mean = mu_var * (resid.sum() / sigma2 + mu0 / v0)
        mu = float(rng.normal(mu_mean, math.sqrt(mu_var)))

        for idx, members in enumerate(user_members):
            if len(members) == 0:
                alpha[idx] = float(rng.normal(0.0, math.sqrt(tau_u2)))
                continue
            base = mu + beta[type_ids[members]] + gamma[course_ids[members]] + x[members] @ delta
            r = y[members] - base
            var = 1.0 / (len(members) / sigma2 + 1.0 / tau_u2)
            mean = var * (r.sum() / sigma2)
            alpha[idx] = float(rng.normal(mean, math.sqrt(var)))

        for idx, members in enumerate(type_members):
            if len(members) == 0:
                beta[idx] = float(rng.normal(0.0, math.sqrt(tau_t2)))
                continue
            base = mu + alpha[user_ids[members]] + gamma[course_ids[members]] + x[members] @ delta
            r = y[members] - base
            var = 1.0 / (len(members) / sigma2 + 1.0 / tau_t2)
            mean = var * (r.sum() / sigma2)
            beta[idx] = float(rng.normal(mean, math.sqrt(var)))

        for idx, members in enumerate(course_members):
            if len(members) == 0:
                gamma[idx] = float(rng.normal(0.0, math.sqrt(tau_c2)))
                continue
            base = mu + alpha[user_ids[members]] + beta[type_ids[members]] + x[members] @ delta
            r = y[members] - base
            var = 1.0 / (len(members) / sigma2 + 1.0 / tau_c2)
            mean = var * (r.sum() / sigma2)
            gamma[idx] = float(rng.normal(mean, math.sqrt(var)))

        for j in range(p):
            current_linear = mu + alpha[user_ids] + beta[type_ids] + gamma[course_ids] + x @ delta
            r = y - (current_linear - x[:, j] * delta[j])
            xj = x[:, j]
            var = 1.0 / ((xj @ xj) / sigma2 + 1.0 / tau_delta2)
            mean = var * ((xj @ r) / sigma2)
            delta[j] = float(rng.normal(mean, math.sqrt(var)))

        full = mu + alpha[user_ids] + beta[type_ids] + gamma[course_ids] + x @ delta
        sqe = float(np.sum((y - full) ** 2))
        sigma2 = _inverse_gamma_sample(rng, a_sigma + n / 2.0, b_sigma + 0.5 * sqe)
        tau_u2 = _inverse_gamma_sample(rng, a_u + len(alpha) / 2.0, b_u + 0.5 * float(np.sum(alpha**2)))
        tau_t2 = _inverse_gamma_sample(rng, a_t + len(beta) / 2.0, b_t + 0.5 * float(np.sum(beta**2)))
        tau_c2 = _inverse_gamma_sample(rng, a_c + len(gamma) / 2.0, b_c + 0.5 * float(np.sum(gamma**2)))

        if step >= burn_in:
            kept += 1
            kept_mu.append(mu)
            kept_sigma2.append(sigma2)
            kept_tau_u2.append(tau_u2)
            kept_tau_t2.append(tau_t2)
            kept_alpha += alpha
            kept_beta += beta
            kept_gamma += gamma
            kept_delta += delta

    if kept <= 0:
        kept = 1
        kept_mu = [mu]
        kept_sigma2 = [sigma2]
        kept_tau_u2 = [tau_u2]
        kept_tau_t2 = [tau_t2]
        kept_alpha = alpha.copy()
        kept_beta = beta.copy()
        kept_gamma = gamma.copy()
        kept_delta = delta.copy()

    posterior_alpha = {key: float(value) for key, value in zip(user_keys, kept_alpha / kept)}
    posterior_beta = {key: float(value) for key, value in zip(type_keys, kept_beta / kept)}
    posterior_gamma = {key: float(value) for key, value in zip(course_keys, kept_gamma / kept)}

    return {
        "mu": float(np.mean(kept_mu)),
        "sigma2": float(np.mean(kept_sigma2)),
        "delta": kept_delta / kept,
        "alpha": posterior_alpha,
        "beta": posterior_beta,
        "gamma": posterior_gamma,
        "diag": {
            "history_count": n,
            "global_log_mean": round(float(np.mean(kept_mu)), 4),
            "global_log_var": round(float(np.mean(kept_sigma2)), 4),
            "tau_user2": round(float(np.mean(kept_tau_u2)), 4),
            "tau_type2": round(float(np.mean(kept_tau_t2)), 4),
            "iterations": iterations,
            "burn_in": burn_in,
        },
    }


def estimate_quantiles(tasks: list[EstimatorTask], history: list[EstimatorObservation]) -> EstimateResponse:
    rng = np.random.default_rng(17)
    posterior = _gibbs_posterior(history, rng)
    mu_global = posterior["mu"]
    sigma = math.sqrt(max(0.04, posterior["sigma2"]))
    delta = posterior["delta"]
    alpha = posterior["alpha"]
    beta = posterior["beta"]
    gamma = posterior["gamma"]

    q25 = NormalDist().inv_cdf(0.25)
    q50 = NormalDist().inv_cdf(0.50)
    q75 = NormalDist().inv_cdf(0.75)
    q90 = NormalDist().inv_cdf(0.90)

    estimates: list[QuantileEstimate] = []
    for task in tasks:
        x = np.array(_feature_vector(task), dtype=float)
        mu = (
            mu_global
            + alpha.get(task.user_id, 0.0)
            + beta.get(task.task_type, 0.0)
            + gamma.get(task.course_id, 0.0)
            + float(np.dot(delta, x))
        )

        p25 = math.exp(mu + q25 * sigma)
        p50 = math.exp(mu + q50 * sigma)
        p75 = math.exp(mu + q75 * sigma)
        p90 = math.exp(mu + q90 * sigma)

        estimates.append(
            QuantileEstimate(
                task_id=task.task_id,
                p25=round(max(0.25, p25), 2),
                p50=round(max(0.25, p50), 2),
                p75=round(max(0.25, p75), 2),
                p90=round(max(0.25, p90), 2),
            )
        )

    return EstimateResponse(
        estimates=estimates,
        diagnostics=posterior["diag"],
    )
