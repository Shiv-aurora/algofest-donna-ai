# Donna Algo Service

FastAPI sidecar for Donna v2 algorithmic planning.

## Run locally

```bash
cd algo-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8090
```

Health:

```bash
curl http://localhost:8090/health
```
