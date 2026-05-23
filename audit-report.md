# Donna v2 Audit Report

## Summary Table

| # | Algorithm | Status | Classification |
|---|---|---|---|
| 1 | Ingestion + CRF verifier | PARTIAL | real implementation |
| 2 | Bayesian estimator | PARTIAL | real implementation |
| 3 | CP-SAT scheduler | PASS | real implementation |
| 4 | Feasibility + IIS | FAIL | broken |
| 5 | LNS reoptimize | FAIL | broken |
| 6 | Cox survival | PASS | real implementation |
| 7 | Thompson sampling bandit | PARTIAL | real but untrained |
| 8 | HAR forecaster | PARTIAL | real but untrained |
| 9 | Matrix factorization | PARTIAL | real but untrained |
| 10 | Router policy | FAIL | broken |
| 11 | Benchmark endpoint | PARTIAL | real implementation + hardcoded fields |
| 12 | Frontend audit (dev:stack) | FAIL | broken environment path (docker unavailable) |
| 13 | Telegram bot E2E | FAIL | not-configured |

## 1. INGESTION + CRF VERIFIER

- Status: **PARTIAL**
- Honest classification: **real implementation**
- Smoke test command run:
```bash
curl -sS -b /tmp/donna-audit/cookies.txt -H "x-csrf-token: $CSRF" -H 'content-type: application/json' --data @/tmp/donna-audit/ingest_payload.json http://127.0.0.1:8787/api/v2/syllabus/ingest
```
- Raw output (first 30 lines):
```text
{"ok":true,"tasks":[{"id":"essay-1-due-oct-15","title":"Essay 1 due Oct 15","type":"assignment","due_date":"2026-10-01T23:59:00Z","weight":1,"confidence":0.652},{"id":"midterm-oct-22","title":"Midterm Oct 22","type":"assignment","due_date":"2026-10-22T23:59:00Z","weight":1,"confidence":0.657},{"id":"final-project-due-dec-1","title":"Final project due Dec 1","type":"assignment","due_date":"2026-12-01T23:59:00Z","weight":1,"confidence":0.639}],"prereq_edges":[],"conflicts":[],"stats":{"llm_candidates":0,"verifier_candidates":3,"task_count":3,"edge_count":0,"conflict_count":0,"verifier_model":"linear_chain_crf"},"llmUsage":null}
```
- Code evidence:
```python
_DATE_CRF = LinearChainCRF(... transition_weights={('<s>', 'B-DATE'): 1.2, ...}, emission_weights={'B-DATE': {'is_month': 2.9, ...}, 'I-DATE': {'is_day_number': 2.0, ...}})
```
- Verdict explanation: Extracted 3 items but misparsed `Oct 15` as `2026-10-01` and assigned generic types, so strict deadline/type check fails. CRF itself is real with non-empty transition/emission weights.

## 2. BAYESIAN ESTIMATOR

- Status: **PARTIAL**
- Honest classification: **real implementation**
- Smoke test command run:
```bash
POST 20x /api/v2/events/work then POST /api/v2/plan/solve; also POST /v1/estimate/quantiles with synthetic history
```
- Raw output (first 30 lines):
```text
{"ok":true,"routeDecision":{"route":"trivial","reason":"low_complexity","complexity":0.038},"fallback":false,"intent":null,"explanation":null,"usage":{"intent":null,"explanation":null},"estimateBands":[{"task_id":"essay-new","p25":2.31,"p50":3.44,"p75":5.12,"p90":7.33}],"workloadForecast":[{"date":"week+1","load":1.136},{"date":"week+2","load":0.977},{"date":"week+3","load":0.86},{"date":"week+4","load":0.745}],"latencyMs":21,"result":{"feasible":true,"assignments":[{"task_id":"essay-new","slot_id":"s1","start":"2026-10-29T08:00:00Z","end":"2026-10-29T10:00:00Z","minutes":120}],"objective_breakdown":{"slot_assignments":1,"switches":0,"overflow_total":0},"overflow_hours":{"essay-new":0},"unscheduled_tasks":[],"switch_count":0,"route":"scheduler_core","solver_status":"optimal","latency_ms":8.17}}
TIME_TOTAL=0.022452
{"estimates":[{"task_id":"essay-new","p25":1.69,"p50":2.17,"p75":2.79,"p90":3.5}],"diagnostics":{"history_count":20,"global_log_mean":0.4746,"global_log_var":0.1374,"tau_user2":0.4271,"tau_type2":0.4076,"iterations":120,"burn_in":60}}
```
- Code evidence:
```python
posterior = _gibbs_posterior(history, rng)
p50 = math.exp(mu + q50 * sigma)
```
- Verdict explanation: v2 flow failed target: after 20 events, P50 was 3.44 (outside [1.7,2.3]), indicating work-event telemetry is not feeding inference here. Direct estimator with supplied history produced non-hardcoded quantiles near 2h, so model logic is present.

## 3. CP-SAT SCHEDULER

- Status: **PASS**
- Honest classification: **real implementation**
- Smoke test command run:
```bash
curl ...03_solve5.json and ...03_solve50.json to /api/v2/plan/solve
```
- Raw output (first 30 lines):
```text
{"ok":true,"routeDecision":{"route":"trivial","reason":"low_complexity","complexity":0.028},"fallback":false,"intent":null,"explanation":null,"usage":{"intent":null,"explanation":null},"estimateBands":[{"task_id":"t1","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"t2","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"t3","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"t4","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"t5","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85}],"workloadForecast":[{"date":"week+1","load":3.372},{"date":"week+2","load":2.923},{"date":"week+3","load":2.638},{"date":"week+4","load":2.367}],"latencyMs":22,"result":{"feasible":true,"assignments":[{"task_id":"t4","slot_id":"sl6","start":"2026-10-01T13:00:00Z","end":"2026-10-01T14:00:00Z","minutes":60},{"task_id":"t1","slot_id":"sl8","start":"2026-10-01T15:00:00Z","end":"2026-10-01T16:00:00Z","minutes":60},{"task_id":"t3","slot_id":"sl11","start":"2026-10-01T18:00:00Z","end":"2026-10-01T19:00:00Z","minutes":60},{"task_id":"t5","slot_id":"sl13","start":"2026-10-01T20:00:00Z","end":"2026-10-01T21:00:00Z","minutes":60},{"task_id":"t2","slot_id":"sl15","start":"2026-10-01T22:00:00Z","end":"2026-10-01T23:00:00Z","minutes":60}],"objective_breakdown":{"slot_assignments":5,"switches":0,"overflow_total":0},"overflow_hours":{"t1":0,"t2":0,"t3":0,"t4":0,"t5":0},"unscheduled_tasks":[],"switch_count":0,"route":"scheduler_core","solver_status":"optimal","latency_ms":14.06}}
TIME_TOTAL=0.023427
{"ok":true,"routeDecision":{"route":"standard","reason":"moderate_complexity","complexity":0.034},"fallback":false,"intent":null,"explanation":null,"usage":{"intent":null,"explanation":null},"estimateBands":[{"task_id":"T1","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T2","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T3","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T4","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T5","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T6","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T7","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T8","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T9","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T10","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T11","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T12","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T13","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T14","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T15","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T16","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T17","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T18","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T19","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T20","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T21","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T22","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T23","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T24","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T25","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T26","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T27","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T28","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T29","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T30","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T31","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T32","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T33","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T34","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T35","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T36","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T37","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T38","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T39","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T40","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T41","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T42","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T43","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T44","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T45","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T46","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T47","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T48","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T49","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85},{"task_id":"T50","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85}],"workloadForecast":[{"date":"week+1","load":113.452},{"date":"week+2","load":235.831},{"date":"week+3","load":476.213},{"date":"week+4","load":949.783}],"latencyMs":1041,"result":{"feasible":true,"assignments":[{"task_id":"T38","slot_id":"sl1","start":"2026-10-01T08:00:00Z","end":"2026-10-01T09:00:00Z","minutes":60},{"task_id":"T40","slot_id":"sl2","start":"2026-10-01T09:00:00Z","end":"2026-10-01T10:00:00Z","minutes":60},{"task_id":"T16","slot_id":"sl3","start":"2026-10-01T10:00:00Z","end":"2026-10-01T11:00:00Z","minutes":60},{"task_id":"T42","slot_id":"sl4","start":"2026-10-01T11:00:00Z","end":"2026-10-01T12:00:00Z","minutes":60},{"task_id":"T4","slot_id":"sl5","start":"2026-10-01T12:00:00Z","end":"2026-10-01T13:00:00Z","minutes":60},{"task_id":"T47","slot_id":"sl6","start":"2026-10-01T13:00:00Z","end":"2026-10-01T14:00:00Z","minutes":60},{"task_id":"T39","slot_id":"sl7","start":"2026-10-01T14:00:00Z","end":"2026-10-01T15:00:00Z","minutes":60},{"task_id":"T18","slot_id":"sl8","start":"2026-10-01T15:00:00Z","end":"2026-10-01T16:00:00Z","minutes":60},{"task_id":"T50","slot_id":"sl9","start":"2026-10-01T16:00:00Z","end":"2026-10-01T17:00:00Z","minutes":60},{"task_id":"T49","slot_id":"sl10","start":"2026-10-01T17:00:00Z","end":"2026-10-01T18:00:00Z","minutes":60},{"task_id":"T43","slot_id":"sl11","start":"2026-10-01T18:00:00Z","end":"2026-10-01T19:00:00Z","minutes":60},{"task_id":"T36","slot_id":"sl12","start":"2026-10-01T19:00:00Z","end":"2026-10-01T20:00:00Z","minutes":60},{"task_id":"T41","slot_id":"sl13","start":"2026-10-01T20:00:00Z","end":"2026-10-01T21:00:00Z","minutes":60},{"task_id":"T48","slot_id":"sl14","start":"2026-10-01T21:00:00Z","end":"2026-10-01T22:00:00Z","minutes":60},{"task_id":"T1","slot_id":"sl15","start":"2026-10-01T22:00:00Z","end":"2026-10-01T23:00:00Z","minutes":60},{"task_id":"T14","slot_id":"sl16","start":"2026-10-01T23:00:00Z","end":"2026-10-02T00:00:00Z","minutes":60},{"task_id":"T44","slot_id":"sl17","start":"2026-10-02T00:00:00Z","end":"2026-10-02T01:00:00Z","minutes":60},{"task_id":"T17","slot_id":"sl18","start":"2026-10-02T01:00:00Z","end":"2026-10-02T02:00:00Z","minutes":60},{"task_id":"T19","slot_id":"sl19","start":"2026-10-02T02:00:00Z","end":"2026-10-02T03:00:00Z","minutes":60},{"task_id":"T20","slot_id":"sl20","start":"2026-10-02T03:00:00Z","end":"2026-10-02T04:00:00Z","minutes":60}],"objective_breakdown":{"slot_assignments":20,"switches":19,"overflow_total":30},"overflow_hours":{"T1":0,"T2":1,"T3":1,"T4":0,"T5":1,"T6":1,"T7":1,"T8":1,"T9":1,"T10":1,"T11":1,"T12":1,"T13":1,"T14":0,"T15":1,"T16":0,"T17":0,"T18":0,"T19":0,"T20":0,"T21":1,"T22":1,"T23":1,"T24":1,"T25":1,"T26":1,"T27":1,"T28":1,"T29":1,"T30":1,"T31":1,"T32":1,"T33":1,"T34":1,"T35":1,"T36":0,"T37":1,"T38":0,"T39":0,"T40":0,"T41":0,"T42":0,"T43":0,"T44":0,"T45":1,"T46":1,"T47":0,"T48":0,"T49":0,"T50":0},"unscheduled_tasks":["T2","T3","T5","T6","T7","T8","T9","T10","T11","T12","T13","T15","T21","T22","T23","T24","T25","T26","T27","T28","T29","T30","T31","T32","T33","T34","T35","T37","T45","T46"],"switch_count":19,"route":"scheduler_core","solver_status":"feasible","latency_ms":1031.18}}
TIME_TOTAL=1.042146
```
- Code evidence:
```python
from ortools.sat.python import cp_model
model = cp_model.CpModel()
model.Add(slot_sum <= 1)
model.Add(planned + overflow[i] >= required_minutes)
model.Minimize(sum(objective_terms))
```
- Verdict explanation: 5-task case met criteria: all 5 placed in ~23ms total request latency. 50-task latency recorded ~1.04s (captured as requested).

## 4. FEASIBILITY + IIS

- Status: **FAIL**
- Honest classification: **broken**
- Smoke test command run:
```bash
curl ...04_feasibility.json to /api/v2/plan/feasibility
```
- Raw output (first 30 lines):
```text
{"ok":true,"result":{"feasible":true,"cost_delta":0,"minimal_conflict_set":[],"proposal":{"feasible":true,"assignments":[{"task_id":"f1","slot_id":"fs1","start":"2026-10-01T08:00:00Z","end":"2026-10-01T09:00:00Z","minutes":60},{"task_id":"f1","slot_id":"fs2","start":"2026-10-01T09:00:00Z","end":"2026-10-01T10:00:00Z","minutes":60},{"task_id":"f2","slot_id":"fs3","start":"2026-10-01T10:00:00Z","end":"2026-10-01T11:00:00Z","minutes":60},{"task_id":"f3","slot_id":"fs4","start":"2026-10-01T11:00:00Z","end":"2026-10-01T12:00:00Z","minutes":60}],"objective_breakdown":{"slot_assignments":4,"switches":2,"overflow_total":8},"overflow_hours":{"f1":2,"f2":3,"f3":3},"unscheduled_tasks":[],"switch_count":2,"route":"scheduler_core","solver_status":"optimal","latency_ms":6.23}}}
TIME_TOTAL=0.018894
```
- Code evidence:
```python
while idx < len(active):
    candidate = set(active); candidate.discard(label)
    if candidate and _is_infeasible(request, candidate):
        active = [entry for entry in active if entry != label]
```
- Verdict explanation: Obvious infeasible case returned feasible=true with overflow; conflict set is empty, so IIS minimality test cannot pass. IIS deletion loop exists in code but runtime behavior did not trigger it.

## 5. LNS REOPTIMIZE

- Status: **FAIL**
- Honest classification: **broken**
- Smoke test command run:
```bash
solve 30-task baseline then /api/v2/plan/reoptimize with changed deadline
```
- Raw output (first 30 lines):
```text
{"ok":true,"result":{"initial_feasible":{"feasible":true,"assignments":[{"task_id":"r4","slot_id":"rsl1","start":"2026-10-02T08:00:00Z","end":"2026-10-02T09:00:00Z","minutes":60},{"task_id":"r7","slot_id":"rsl3","start":"2026-10-02T10:00:00Z","end":"2026-10-02T11:00:00Z","minutes":60},{"task_id":"r1","slot_id":"rsl5","start":"2026-10-02T12:00:00Z","end":"2026-10-02T13:00:00Z","minutes":60},{"task_id":"r13","slot_id":"rsl6","start":"2026-10-02T13:00:00Z","end":"2026-10-02T14:00:00Z","minutes":60},{"task_id":"r28","slot_id":"rsl7","start":"2026-10-02T14:00:00Z","end":"2026-10-02T15:00:00Z","minutes":60},{"task_id":"r18","slot_id":"rsl8","start":"2026-10-02T15:00:00Z","end":"2026-10-02T16:00:00Z","minutes":60},{"task_id":"r9","slot_id":"rsl10","start":"2026-10-02T17:00:00Z","end":"2026-10-02T18:00:00Z","minutes":60},{"task_id":"r8","slot_id":"rsl11","start":"2026-10-02T18:00:00Z","end":"2026-10-02T19:00:00Z","minutes":60},{"task_id":"r19","slot_id":"rsl12","start":"2026-10-02T19:00:00Z","end":"2026-10-02T20:00:00Z","minutes":60},{"task_id":"r15","slot_id":"rsl13","start":"2026-10-02T20:00:00Z","end":"2026-10-02T21:00:00Z","minutes":60},{"task_id":"r6","slot_id":"rsl14","start":"2026-10-02T21:00:00Z","end":"2026-10-02T22:00:00Z","minutes":60},{"task_id":"r29","slot_id":"rsl16","start":"2026-10-02T23:00:00Z","end":"2026-10-03T00:00:00Z","minutes":60},{"task_id":"r30","slot_id":"rsl18","start":"2026-10-03T01:00:00Z","end":"2026-10-03T02:00:00Z","minutes":60},{"task_id":"r3","slot_id":"rsl19","start":"2026-10-03T02:00:00Z","end":"2026-10-03T03:00:00Z","minutes":60},{"task_id":"r24","slot_id":"rsl21","start":"2026-10-03T04:00:00Z","end":"2026-10-03T05:00:00Z","minutes":60},{"task_id":"r11","slot_id":"rsl24","start":"2026-10-03T07:00:00Z","end":"2026-10-03T08:00:00Z","minutes":60},{"task_id":"r20","slot_id":"rsl25","start":"2026-10-03T08:00:00Z","end":"2026-10-03T09:00:00Z","minutes":60},{"task_id":"r5","slot_id":"rsl27","start":"2026-10-03T10:00:00Z","end":"2026-10-03T11:00:00Z","minutes":60},{"task_id":"r25","slot_id":"rsl28","start":"2026-10-03T11:00:00Z","end":"2026-10-03T12:00:00Z","minutes":60},{"task_id":"r14","slot_id":"rsl29","start":"2026-10-03T12:00:00Z","end":"2026-10-03T13:00:00Z","minutes":60},{"task_id":"r16","slot_id":"rsl31","start":"2026-10-03T14:00:00Z","end":"2026-10-03T15:00:00Z","minutes":60},{"task_id":"r22","slot_id":"rsl32","start":"2026-10-03T15:00:00Z","end":"2026-10-03T16:00:00Z","minutes":60},{"task_id":"r12","slot_id":"rsl33","start":"2026-10-03T16:00:00Z","end":"2026-10-03T17:00:00Z","minutes":60},{"task_id":"r21","slot_id":"rsl34","start":"2026-10-03T17:00:00Z","end":"2026-10-03T18:00:00Z","minutes":60},{"task_id":"r26","slot_id":"rsl35","start":"2026-10-03T18:00:00Z","end":"2026-10-03T19:00:00Z","minutes":60},{"task_id":"r23","slot_id":"rsl36","start":"2026-10-03T19:00:00Z","end":"2026-10-03T20:00:00Z","minutes":60},{"task_id":"r2","slot_id":"rsl37","start":"2026-10-03T20:00:00Z","end":"2026-10-03T21:00:00Z","minutes":60},{"task_id":"r17","slot_id":"rsl38","start":"2026-10-03T21:00:00Z","end":"2026-10-03T22:00:00Z","minutes":60},{"task_id":"r27","slot_id":"rsl39","start":"2026-10-03T22:00:00Z","end":"2026-10-03T23:00:00Z","minutes":60},{"task_id":"r10","slot_id":"rsl40","start":"2026-10-03T23:00:00Z","end":"2026-10-04T00:00:00Z","minutes":60}],"objective_breakdown":{"slot_assignments":30,"switches":20,"overflow_total":0},"overflow_hours":{"r1":0,"r2":0,"r3":0,"r4":0,"r5":0,"r6":0,"r7":0,"r8":0,"r9":0,"r10":0,"r11":0,"r12":0,"r13":0,"r14":0,"r15":0,"r16":0,"r17":0,"r18":0,"r19":0,"r20":0,"r21":0,"r22":0,"r23":0,"r24":0,"r25":0,"r26":0,"r27":0,"r28":0,"r29":0,"r30":0},"unscheduled_tasks":[],"switch_count":20,"route":"scheduler_core","solver_status":"feasible","latency_ms":112.89},"improved":{"feasible":true,"assignments":[{"task_id":"r30","slot_id":"rsl1","start":"2026-10-02T08:00:00Z","end":"2026-10-02T09:00:00Z","minutes":60},{"task_id":"r1","slot_id":"rsl2","start":"2026-10-02T09:00:00Z","end":"2026-10-02T10:00:00Z","minutes":60},{"task_id":"r7","slot_id":"rsl4","start":"2026-10-02T11:00:00Z","end":"2026-10-02T12:00:00Z","minutes":60},{"task_id":"r29","slot_id":"rsl5","start":"2026-10-02T12:00:00Z","end":"2026-10-02T13:00:00Z","minutes":60},{"task_id":"r9","slot_id":"rsl6","start":"2026-10-02T13:00:00Z","end":"2026-10-02T14:00:00Z","minutes":60},{"task_id":"r27","slot_id":"rsl7","start":"2026-10-02T14:00:00Z","end":"2026-10-02T15:00:00Z","minutes":60},{"task_id":"r4","slot_id":"rsl9","start":"2026-10-02T16:00:00Z","end":"2026-10-02T17:00:00Z","minutes":60},{"task_id":"r23","slot_id":"rsl10","start":"2026-10-02T17:00:00Z","end":"2026-10-02T18:00:00Z","minutes":60},{"task_id":"r8","slot_id":"rsl12","start":"2026-10-02T19:00:00Z","end":"2026-10-02T20:00:00Z","minutes":60},{"task_id":"r18","slot_id":"rsl13","start":"2026-10-02T20:00:00Z","end":"2026-10-02T21:00:00Z","minutes":60},{"task_id":"r10","slot_id":"rsl14","start":"2026-10-02T21:00:00Z","end":"2026-10-02T22:00:00Z","minutes":60},{"task_id":"r19","slot_id":"rsl16","start":"2026-10-02T23:00:00Z","end":"2026-10-03T00:00:00Z","minutes":60},{"task_id":"r28","slot_id":"rsl18","start":"2026-10-03T01:00:00Z","end":"2026-10-03T02:00:00Z","minutes":60},{"task_id":"r6","slot_id":"rsl19","start":"2026-10-03T02:00:00Z","end":"2026-10-03T03:00:00Z","minutes":60},{"task_id":"r21","slot_id":"rsl20","start":"2026-10-03T03:00:00Z","end":"2026-10-03T04:00:00Z","minutes":60},{"task_id":"r25","slot_id":"rsl21","start":"2026-10-03T04:00:00Z","end":"2026-10-03T05:00:00Z","minutes":60},{"task_id":"r15","slot_id":"rsl23","start":"2026-10-03T06:00:00Z","end":"2026-10-03T07:00:00Z","minutes":60},{"task_id":"r20","slot_id":"rsl24","start":"2026-10-03T07:00:00Z","end":"2026-10-03T08:00:00Z","minutes":60},{"task_id":"r26","slot_id":"rsl26","start":"2026-10-03T09:00:00Z","end":"2026-10-03T10:00:00Z","minutes":60},{"task_id":"r22","slot_id":"rsl28","start":"2026-10-03T11:00:00Z","end":"2026-10-03T12:00:00Z","minutes":60},{"task_id":"r13","slot_id":"rsl29","start":"2026-10-03T12:00:00Z","end":"2026-10-03T13:00:00Z","minutes":60},{"task_id":"r24","slot_id":"rsl30","start":"2026-10-03T13:00:00Z","end":"2026-10-03T14:00:00Z","minutes":60},{"task_id":"r11","slot_id":"rsl32","start":"2026-10-03T15:00:00Z","end":"2026-10-03T16:00:00Z","minutes":60},{"task_id":"r12","slot_id":"rsl33","start":"2026-10-03T16:00:00Z","end":"2026-10-03T17:00:00Z","minutes":60},{"task_id":"r2","slot_id":"rsl34","start":"2026-10-03T17:00:00Z","end":"2026-10-03T18:00:00Z","minutes":60},{"task_id":"r17","slot_id":"rsl35","start":"2026-10-03T18:00:00Z","end":"2026-10-03T19:00:00Z","minutes":60},{"task_id":"r16","slot_id":"rsl37","start":"2026-10-03T20:00:00Z","end":"2026-10-03T21:00:00Z","minutes":60},{"task_id":"r14","slot_id":"rsl38","start":"2026-10-03T21:00:00Z","end":"2026-10-03T22:00:00Z","minutes":60},{"task_id":"r3","slot_id":"rsl39","start":"2026-10-03T22:00:00Z","end":"2026-10-03T23:00:00Z","minutes":60},{"task_id":"r5","slot_id":"rsl40","start":"2026-10-03T23:00:00Z","end":"2026-10-04T00:00:00Z","minutes":60}],"objective_breakdown":{"slot_assignments":30,"switches":19,"overflow_total":0},"overflow_hours":{"r1":0,"r2":0,"r3":0,"r4":0,"r5":0,"r6":0,"r7":0,"r8":0,"r9":0,"r10":0,"r11":0,"r12":0,"r13":0,"r14":0,"r15":0,"r16":0,"r17":0,"r18":0,"r19":0,"r20":0,"r21":0,"r22":0,"r23":0,"r24":0,"r25":0,"r26":0,"r27":0,"r28":0,"r29":0,"r30":0},"unscheduled_tasks":[],"switch_count":19,"route":"scheduler_core","solver_status":"feasible","latency_ms":209.68},"anytime":{"first_solution_budget_ms":80,"improvement_budget_ms":500,"destroy_ratio_range":[0.1,0.2],"changed_task_count":1,"iterations":2,"best_objective":47.5,"timeline":[{"iter":0,"objective":50,"assignments":30,"elapsed_ms":113.52},{"iter":1,"objective":47.5,"candidate_objective":47.5,"destroy_ratio":0.1,"elapsed_ms":323.88},{"iter":2,"objective":47.5,"candidate_objective":48.5,"destroy_ratio":0.15,"elapsed_ms":529.39}],"anytime_guarantee":"best_non_worsening"}}}
TIME_TOTAL=0.535715
SHARE_RATIO=0.0333 INITIAL_LAT_MS=112.89
```
- Code evidence:
```python
trial_request.warm_start = _destroy_local_neighborhood(...)
while elapsed < budget_ms:
    candidate = solve_schedule(trial_request)
    if objective <= best_obj: best_solution = candidate
```
- Verdict explanation: >100ms first-feasible and only 3.33% assignment overlap vs baseline (required >70%), so incremental behavior failed acceptance.

## 6. COX SURVIVAL

- Status: **PASS**
- Honest classification: **real implementation**
- Smoke test command run:
```bash
curl /v1/survival/predict with empty history and with 30 synthetic events
```
- Raw output (first 30 lines):
```text
{"start_probabilities":[0.1435]}
{"start_probabilities":[0.7922]}
```
- Code evidence:
```python
model = CoxPHFitter(penalizer=0.08)
model.fit(df, duration_col='duration', event_col='event')
```
- Verdict explanation: Empty-history path returned sensible default without crash; adding history changed predictions materially, indicating fitted-data usage.

## 7. THOMPSON SAMPLING BANDIT

- Status: **PARTIAL**
- Honest classification: **real but untrained**
- Smoke test command run:
```bash
20 calls to /api/v2/notify/decision (10 reward=1 then 10 reward=0)
```
- Raw output (first 30 lines):
```text
{"ok":true,"result":{"selected_arm":"2:13:medium","sample_value":0.9043,"posterior_alpha":2,"posterior_beta":1,"expected_reward":0.6667}}
{"ok":true,"result":{"selected_arm":"2:13:medium","sample_value":0.9634,"posterior_alpha":3,"posterior_beta":1,"expected_reward":0.75}}
{"ok":true,"result":{"selected_arm":"2:15:medium","sample_value":0.9257,"posterior_alpha":2,"posterior_beta":1,"expected_reward":0.6667}}
{"ok":true,"result":{"selected_arm":"2:16:medium","sample_value":0.9934,"posterior_alpha":2,"posterior_beta":1,"expected_reward":0.6667}}
{"ok":true,"result":{"selected_arm":"2:13:medium","sample_value":0.9803,"posterior_alpha":4,"posterior_beta":1,"expected_reward":0.8}}
{"ok":true,"result":{"selected_arm":"2:12:medium","sample_value":0.8243,"posterior_alpha":2,"posterior_beta":1,"expected_reward":0.6667}}
{"ok":true,"result":{"selected_arm":"2:12:medium","sample_value":0.9442,"posterior_alpha":3,"posterior_beta":1,"expected_reward":0.75}}
{"ok":true,"result":{"selected_arm":"2:13:medium","sample_value":0.8969,"posterior_alpha":5,"posterior_beta":1,"expected_reward":0.8333}}
{"ok":true,"result":{"selected_arm":"2:14:medium","sample_value":0.8984,"posterior_alpha":2,"posterior_beta":1,"expected_reward":0.6667}}
{"ok":true,"result":{"selected_arm":"2:12:medium","sample_value":0.9958,"posterior_alpha":4,"posterior_beta":1,"expected_reward":0.8}}
{"ok":true,"result":{"selected_arm":"2:13:medium","sample_value":0.9972,"posterior_alpha":5,"posterior_beta":2,"expected_reward":0.7143}}
{"ok":true,"result":{"selected_arm":"2:13:medium","sample_value":0.986,"posterior_alpha":5,"posterior_beta":3,"expected_reward":0.625}}
{"ok":true,"result":{"selected_arm":"2:12:medium","sample_value":0.7578,"posterior_alpha":4,"posterior_beta":2,"expected_reward":0.6667}}
{"ok":true,"result":{"selected_arm":"2:15:medium","sample_value":0.8696,"posterior_alpha":2,"posterior_beta":2,"expected_reward":0.5}}
{"ok":true,"result":{"selected_arm":"2:16:medium","sample_value":0.9295,"posterior_alpha":2,"posterior_beta":2,"expected_reward":0.5}}
{"ok":true,"result":{"selected_arm":"2:14:medium","sample_value":0.7345,"posterior_alpha":2,"posterior_beta":2,"expected_reward":0.5}}
{"ok":true,"result":{"selected_arm":"2:14:medium","sample_value":0.845,"posterior_alpha":2,"posterior_beta":3,"expected_reward":0.4}}
{"ok":true,"result":{"selected_arm":"2:16:medium","sample_value":0.8357,"posterior_alpha":2,"posterior_beta":3,"expected_reward":0.4}}
{"ok":true,"result":{"selected_arm":"2:12:medium","sample_value":0.5539,"posterior_alpha":4,"posterior_beta":3,"expected_reward":0.5714}}
{"ok":true,"result":{"selected_arm":"2:14:medium","sample_value":0.8149,"posterior_alpha":2,"posterior_beta":4,"expected_reward":0.3333}}
```
- Code evidence:
```python
if request.acted_within_30m:
    alpha += 1
else:
    beta += 1
```
- Verdict explanation: Alpha/beta updates are real, but updates occur on selected adjacent-hour arms rather than strictly one fixed arm each call, so strict fixed-arm expectation is partial.

## 8. HAR FORECASTER

- Status: **PARTIAL**
- Honest classification: **real but untrained**
- Smoke test command run:
```bash
curl /v1/forecast/workload with empty history and 12-week synthetic pattern
```
- Raw output (first 30 lines):
```text
{"forecast":[{"date":"week+1","load":10.0},{"date":"week+2","load":10.0},{"date":"week+3","load":10.0},{"date":"week+4","load":10.0}],"coefficients":{"beta_d":0.5,"beta_w":0.3,"beta_m":0.2,"bias":0.0}}
{"forecast":[{"date":"week+1","load":5.655},{"date":"week+2","load":12.279},{"date":"week+3","load":3.38},{"date":"week+4","load":15.833}],"coefficients":{"beta_d":-0.84219,"beta_w":-8.11705,"beta_m":10.62784,"bias":-3.90527}}
```
- Code evidence:
```python
day = values[t-1]; week = mean(values[t-7:t]); month = mean(values[t-30:t])
coeff = np.linalg.lstsq(X, Y, rcond=None)
```
- Verdict explanation: Graceful default exists for empty history. Patterned input drives non-constant forecasts via HAR terms, but resulting trajectory is unstable for this synthetic run.

## 9. MATRIX FACTORIZATION

- Status: **PARTIAL**
- Honest classification: **real but untrained**
- Smoke test command run:
```bash
curl /v1/energy/predict (empty), POST /v1/energy/update 50 obs, curl /v1/energy/predict
```
- Raw output (first 30 lines):
```text
{"scores":{"8":5.9452,"9":6.1931,"10":5.9394,"20":6.3835}}
{"updated":50}
{"scores":{"8":6.2163,"9":6.5513,"10":6.3681,"20":6.403}}
```
- Code evidence:
```python
u_grad = err * v + L2 * u
v_grad = err * u + L2 * v
_USER_FACTORS[...] = u - LR * u_grad
```
- Verdict explanation: Latent-factor updates are real and outputs change after training; however, the intended morning-preference recovery was not clearly reflected in scores.

## 10. ROUTER POLICY

- Status: **FAIL**
- Honest classification: **broken**
- Smoke test command run:
```bash
POST /api/v2/plan/solve with trivial and complex messages
```
- Raw output (first 30 lines):
```text
{"ok":true,"routeDecision":{"route":"trivial","reason":"low_complexity","complexity":0.046},"fallback":false,"intent":null,"explanation":null,"usage":{"intent":null,"explanation":null},"estimateBands":[{"task_id":"x","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85}],"workloadForecast":[{"date":"week+1","load":0.533},{"date":"week+2","load":0.461},{"date":"week+3","load":0.403},{"date":"week+4","load":0.345}],"latencyMs":12,"result":{"feasible":true,"assignments":[{"task_id":"x","slot_id":"q5","start":"2026-10-05T13:00:00Z","end":"2026-10-05T14:00:00Z","minutes":60}],"objective_breakdown":{"slot_assignments":1,"switches":0,"overflow_total":0},"overflow_hours":{"x":0},"unscheduled_tasks":[],"switch_count":0,"route":"scheduler_core","solver_status":"optimal","latency_ms":5.05}}
{"ok":true,"routeDecision":{"route":"trivial","reason":"low_complexity","complexity":0.322},"fallback":false,"intent":null,"explanation":null,"usage":{"intent":null,"explanation":null},"estimateBands":[{"task_id":"x","p25":1.84,"p50":2.74,"p75":4.08,"p90":5.85}],"workloadForecast":[{"date":"week+1","load":0.533},{"date":"week+2","load":0.461},{"date":"week+3","load":0.403},{"date":"week+4","load":0.345}],"latencyMs":10,"result":{"feasible":true,"assignments":[{"task_id":"x","slot_id":"q5","start":"2026-10-05T13:00:00Z","end":"2026-10-05T14:00:00Z","minutes":60}],"objective_breakdown":{"slot_assignments":1,"switches":0,"overflow_total":0},"overflow_hours":{"x":0},"unscheduled_tasks":[],"switch_count":0,"route":"scheduler_core","solver_status":"optimal","latency_ms":4.15}}
```
- Code evidence:
```python
if _MODEL is None or not _TRAINED: route = _heuristic_route(...)
if complexity < 0.25 ... return 'trivial'
```
- Verdict explanation: Both prompts routed to trivial and showed no LLM usage/token separation. This fails expected route differentiation behavior.

## 11. BENCHMARK ENDPOINT AUDIT

- Status: **PARTIAL**
- Honest classification: **real implementation + hardcoded fields**
- Smoke test command run:
```bash
curl /api/v2/metrics/benchmark; run /tmp/donna-audit/benchmark_harness_30seeds.py
```
- Raw output (first 30 lines):
```text
{"ok":true,"generated_at":"2026-05-21T17:01:16.223613Z","metrics":{"scheduler":{"25":{"p50_ms":483.96,"p99_ms":517.25,"feasible_rate":1,"avg_ms":488.35},"50":{"p50_ms":509.3,"p99_ms":512.22,"feasible_rate":1,"avg_ms":509.84},"100":{"p50_ms":564.18,"p99_ms":569.16,"feasible_rate":0,"avg_ms":564.7},"150":{"p50_ms":574.01,"p99_ms":588.44,"feasible_rate":0,"avg_ms":575.08}},"token_baseline":{"v1_per_turn":2500,"v2_small":250,"v2_complex":800},"cost_estimate":{"usd_per_1k_turns_baseline":0.85,"usd_per_1k_turns_v2":0.09}}}
{
  "25": {
    "p50_ms": 482.11,
    "p99_ms": 524.25,
    "avg_ms": 485.11,
    "feasible_rate": 1.0
  },
  "50": {
    "p50_ms": 509.88,
    "p99_ms": 516.81,
    "avg_ms": 510.34,
    "feasible_rate": 0.8
  },
  "100": {
    "p50_ms": 568.82,
    "p99_ms": 587.06,
    "avg_ms": 569.82,
    "feasible_rate": 0.0
  },
  "150": {
    "p50_ms": 579.27,
    "p99_ms": 609.29,
    "avg_ms": 580.49,
    "feasible_rate": 0.0
  }
}
```
- Code evidence:
```python
for n in (25,50,100,150):
  for _ in range(6): result = solve_schedule(req)
metrics['token_baseline']={...hardcoded...}; metrics['cost_estimate']={...hardcoded...}
```
- Verdict explanation: Scheduler rows are measured from live solver runs. Token and cost metrics are hardcoded constants, and endpoint uses only 6 runs per size; separate 30-seed harness executed and included.

## 12. FRONTEND AUDIT

- Status: **FAIL**
- Honest classification: **broken**
- Smoke test command run:
```bash
npm run dev:stack; fallback probe via npm run dev:web + Playwright
```
- Raw output (first 30 lines):
```text
dev:stack error: unable to get image 'donna-algo': Cannot connect to the Docker daemon...
HAS_FEASIBILITY false
HAS_QUANTILE false
HAS_HEATMAP false
HAS_ROUTING false
```
- Verdict explanation: Required full-stack run failed because Docker daemon is unavailable. Fallback browser probe on Vite app did not confirm feasibility chip, quantile bands, heatmap, or routing indicator rendering.

### Frontend component status
- Feasibility chip: **BROKEN**
- Quantile bands: **WIRED-BUT-EMPTY**
- Workload heatmap: **WIRED-BUT-EMPTY**
- Routing+latency indicator: **WIRED-BUT-EMPTY**
- Screenshots: `/tmp/donna-audit/frontend_home.png`, `/tmp/donna-audit/frontend_dashboard.png`

## 13. TELEGRAM BOT

- Status: **FAIL**
- Honest classification: **not-configured**
- Smoke test command run:
```bash
Check .env/.env.example/docker-compose for TELEGRAM_BOT_TOKEN and attempt stack start
```
- Raw output (first 30 lines):
```text
.env missing
.env.example TELEGRAM_BOT_TOKEN=
docker compose warned TELEGRAM_BOT_TOKEN not set
```
- Verdict explanation: Credentials are not configured in this environment, so real phone-to-bot roundtrip could not be run.

## Honest Capability Statement
- Ingestion+CRF extracts tasks/dates with a weighted CRF, but currently misreads some dates/types.
- Bayesian estimator runs real hierarchical Gibbs quantile inference when history is passed, but v2 work-event logging is not wired into tested solve inference.
- CP-SAT scheduler is a real OR-Tools optimization solver with constraints and objective.
- Feasibility/IIS logic exists, but current feasibility semantics with overflow blocked the intended infeasibility demonstration.
- Reoptimizer runs destroy/repair iterations, but behaved like broad reshuffling in this test.
- Survival uses lifelines Cox PH fit/predict and adapts to provided history.
- Bandit performs online Beta posterior updates with Thompson-style sampling across nearby arms.
- HAR forecaster uses daily/weekly/monthly lag regression with fallback defaults.
- Matrix factorization updates latent user/item vectors via SGD and returns dynamic scores.
- Router includes heuristic plus gradient-boosted path, but tested prompts did not route as expected.
- Benchmark endpoint computes scheduler timings but still includes hardcoded token/cost values.
