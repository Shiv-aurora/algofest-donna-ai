from app.modules.bandit import choose_arm
from app.modules.estimator import estimate_quantiles
from app.schemas import EstimateRequest, EstimatorTask, FeatureVector, NotifyDecisionRequest


def test_estimator_quantiles_monotonic():
    req = EstimateRequest(
        tasks=[
            EstimatorTask(
                task_id='t1',
                user_id='u1',
                task_type='assignment',
                course_id='c1',
                features=FeatureVector(word_count=1200, page_count=8, prior_similar_hours=2.1)
            )
        ],
        history=[]
    )
    res = estimate_quantiles(req.tasks, req.history)
    est = res.estimates[0]
    assert est.p25 <= est.p50 <= est.p75 <= est.p90


def test_bandit_updates_on_feedback():
    req = NotifyDecisionRequest(user_id='u1', hour_of_day=10, day_of_week=2, urgency_bucket='high')
    first = choose_arm(req)
    second = choose_arm(
        NotifyDecisionRequest(
            user_id='u1',
            hour_of_day=10,
            day_of_week=2,
            urgency_bucket='high',
            acted_within_30m=True
        )
    )
    assert second.posterior_alpha >= first.posterior_alpha
