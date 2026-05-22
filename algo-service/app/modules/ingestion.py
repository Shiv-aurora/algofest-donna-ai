from __future__ import annotations

import hashlib
import math
import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable

from dateutil import parser as date_parser

from app.schemas import CandidateTuple, Edge, IngestConflict, IngestResponse, IngestTask

_MONTHS = ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")
_MONTH_TO_INDEX = {month: idx + 1 for idx, month in enumerate(_MONTHS)}
_TYPE_KEYWORDS = {
    "quiz": ["quiz", "mcq"],
    "reading": ["reading", "chapter"],
    "assignment": ["assignment", "problem set", "pset", "homework", "hw", "essay"],
    "exam": ["midterm", "final", "exam"],
    "project": ["project", "milestone"],
}
_TOKEN_REGEX = re.compile(r"[A-Za-z]+|\d{1,4}|[^\w\s]")
_DATE_WORDS = {"due", "deadline", "submit", "submits", "submitted", "on", "by"}


def _logsumexp(values: Iterable[float]) -> float:
    values_list = list(values)
    if not values_list:
        return float("-inf")
    anchor = max(values_list)
    if anchor == float("-inf"):
        return anchor
    return anchor + math.log(sum(math.exp(value - anchor) for value in values_list))


@dataclass(slots=True)
class LinearChainCRF:
    labels: tuple[str, ...]
    transition_weights: dict[tuple[str, str], float]
    emission_weights: dict[str, dict[str, float]]
    default_transition: float = -1.4

    def _transition(self, prev_label: str, label: str) -> float:
        return self.transition_weights.get((prev_label, label), self.default_transition)

    def _emission(self, label: str, features: set[str]) -> float:
        weights = self.emission_weights.get(label, {})
        score = 0.0
        for feature in features:
            score += weights.get(feature, 0.0)
        return score

    def decode(self, sequence_features: list[set[str]]) -> tuple[list[str], float]:
        if not sequence_features:
            return [], 0.0

        scores: list[dict[str, tuple[float, str | None]]] = []
        for pos, features in enumerate(sequence_features):
            row: dict[str, tuple[float, str | None]] = {}
            for label in self.labels:
                emission = self._emission(label, features)
                if pos == 0:
                    row[label] = (self._transition("<s>", label) + emission, None)
                    continue

                best_prev = None
                best_score = float("-inf")
                for prev in self.labels:
                    prev_score = scores[pos - 1][prev][0]
                    candidate = prev_score + self._transition(prev, label) + emission
                    if candidate > best_score:
                        best_score = candidate
                        best_prev = prev
                row[label] = (best_score, best_prev)
            scores.append(row)

        best_last = None
        best_last_score = float("-inf")
        for label in self.labels:
            candidate = scores[-1][label][0] + self._transition(label, "</s>")
            if candidate > best_last_score:
                best_last_score = candidate
                best_last = label

        assert best_last is not None
        decoded = [best_last]
        for pos in range(len(sequence_features) - 1, 0, -1):
            prev = scores[pos][decoded[-1]][1]
            assert prev is not None
            decoded.append(prev)
        decoded.reverse()

        # posterior token confidence from forward/backward marginals
        forward: list[dict[str, float]] = []
        for pos, features in enumerate(sequence_features):
            row: dict[str, float] = {}
            for label in self.labels:
                emission = self._emission(label, features)
                if pos == 0:
                    row[label] = self._transition("<s>", label) + emission
                else:
                    row[label] = _logsumexp(
                        forward[pos - 1][prev] + self._transition(prev, label) + emission for prev in self.labels
                    )
            forward.append(row)

        backward: list[dict[str, float]] = [{label: 0.0 for label in self.labels} for _ in sequence_features]
        backward[-1] = {label: self._transition(label, "</s>") for label in self.labels}
        for pos in range(len(sequence_features) - 2, -1, -1):
            row: dict[str, float] = {}
            for label in self.labels:
                row[label] = _logsumexp(
                    self._transition(label, nxt)
                    + self._emission(nxt, sequence_features[pos + 1])
                    + backward[pos + 1][nxt]
                    for nxt in self.labels
                )
            backward[pos] = row

        log_z = _logsumexp(forward[-1][label] + self._transition(label, "</s>") for label in self.labels)
        token_confidences: list[float] = []
        for pos, label in enumerate(decoded):
            marginal = math.exp(forward[pos][label] + backward[pos][label] - log_z)
            token_confidences.append(max(0.0, min(1.0, marginal)))

        confidence = sum(token_confidences) / len(token_confidences)
        return decoded, round(confidence, 4)


_DATE_CRF = LinearChainCRF(
    labels=("B-DATE", "I-DATE", "O"),
    transition_weights={
        ("<s>", "B-DATE"): 1.2,
        ("<s>", "O"): 0.9,
        ("<s>", "I-DATE"): -4.0,
        ("B-DATE", "I-DATE"): 1.8,
        ("B-DATE", "O"): 0.5,
        ("I-DATE", "I-DATE"): 1.3,
        ("I-DATE", "O"): 0.8,
        ("O", "O"): 1.1,
        ("O", "B-DATE"): 0.7,
        ("O", "I-DATE"): -2.0,
        ("B-DATE", "</s>"): 0.4,
        ("I-DATE", "</s>"): 0.7,
        ("O", "</s>"): 0.9,
    },
    emission_weights={
        "B-DATE": {
            "bias": -0.6,
            "is_month": 2.9,
            "is_day_number": 0.3,
            "prev_due_keyword": 1.2,
            "next_day_number": 0.8,
        },
        "I-DATE": {
            "bias": -0.8,
            "is_month": 0.4,
            "is_day_number": 2.0,
            "is_year_number": 1.6,
            "prev_month": 1.2,
            "prev_day_number": 1.1,
            "is_comma": 0.6,
        },
        "O": {
            "bias": 1.0,
            "is_month": -1.0,
            "is_day_number": -0.8,
            "is_year_number": -1.0,
            "prev_due_keyword": -0.7,
            "next_day_number": -0.5,
        },
    },
)

_TYPE_CRF = LinearChainCRF(
    labels=("QUIZ", "READING", "ASSIGNMENT", "EXAM", "PROJECT", "O"),
    transition_weights={
        ("<s>", "O"): 0.8,
        ("<s>", "ASSIGNMENT"): 0.4,
        ("<s>", "READING"): 0.4,
        ("<s>", "QUIZ"): 0.4,
        ("<s>", "EXAM"): 0.4,
        ("<s>", "PROJECT"): 0.4,
        ("O", "O"): 1.1,
        ("O", "ASSIGNMENT"): 0.6,
        ("O", "READING"): 0.6,
        ("O", "QUIZ"): 0.6,
        ("O", "EXAM"): 0.6,
        ("O", "PROJECT"): 0.6,
        ("ASSIGNMENT", "ASSIGNMENT"): 1.0,
        ("READING", "READING"): 1.0,
        ("QUIZ", "QUIZ"): 1.0,
        ("EXAM", "EXAM"): 1.0,
        ("PROJECT", "PROJECT"): 1.0,
        ("ASSIGNMENT", "</s>"): 0.5,
        ("READING", "</s>"): 0.5,
        ("QUIZ", "</s>"): 0.5,
        ("EXAM", "</s>"): 0.5,
        ("PROJECT", "</s>"): 0.5,
        ("O", "</s>"): 0.6,
    },
    emission_weights={
        "QUIZ": {"bias": -0.8, "kw_quiz": 2.6, "kw_exam": 0.2},
        "READING": {"bias": -0.8, "kw_reading": 2.5},
        "ASSIGNMENT": {"bias": -0.3, "kw_assignment": 2.2},
        "EXAM": {"bias": -0.9, "kw_exam": 2.8, "kw_quiz": 0.3},
        "PROJECT": {"bias": -0.9, "kw_project": 2.8},
        "O": {"bias": 1.0, "kw_quiz": -1.0, "kw_reading": -1.0, "kw_assignment": -0.8, "kw_exam": -1.0, "kw_project": -1.0},
    },
)


def _slug(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if cleaned:
        return cleaned[:42]
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:10]


def _tokenize(text: str) -> list[str]:
    return _TOKEN_REGEX.findall(text)


def _date_token_features(tokens: list[str], idx: int) -> set[str]:
    token = tokens[idx]
    lower = token.lower()
    prev = tokens[idx - 1].lower() if idx > 0 else ""
    nxt = tokens[idx + 1].lower() if idx + 1 < len(tokens) else ""
    features = {"bias"}

    if lower[:3] in _MONTH_TO_INDEX:
        features.add("is_month")
    if token.isdigit():
        num = int(token)
        if 1 <= num <= 31:
            features.add("is_day_number")
        if 1900 <= num <= 2100:
            features.add("is_year_number")
    if prev in _DATE_WORDS:
        features.add("prev_due_keyword")
    if prev[:3] in _MONTH_TO_INDEX:
        features.add("prev_month")
    if prev.isdigit() and 1 <= int(prev) <= 31:
        features.add("prev_day_number")
    if nxt.isdigit() and 1 <= int(nxt) <= 31:
        features.add("next_day_number")
    if token == ",":
        features.add("is_comma")
    return features


def _type_token_features(tokens: list[str], idx: int) -> set[str]:
    token = tokens[idx].lower()
    features = {"bias"}
    for label, keywords in _TYPE_KEYWORDS.items():
        if any(token == keyword or token in keyword.split() for keyword in keywords):
            features.add(f"kw_{label}")
    return features


def _parse_due_from_span(tokens: list[str], labels: list[str]) -> tuple[str | None, float]:
    span = [tokens[idx] for idx, label in enumerate(labels) if label in {"B-DATE", "I-DATE"}]
    if not span:
        return None, 0.2

    joined = " ".join(span).replace(" ,", ",")
    canonical = re.search(
        r"(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+([0-2]?\d|3[01])(?:\s*,\s*(20\d{2}|19\d{2}))?",
        joined,
    )
    if canonical:
        month_idx = _MONTH_TO_INDEX[canonical.group(1).lower()[:3]]
        day = int(canonical.group(2))
        year = int(canonical.group(3)) if canonical.group(3) else 2026
        return f"{year:04d}-{month_idx:02d}-{day:02d}T23:59:00Z", 0.9
    year_match = re.search(r"\b(20\d{2}|19\d{2})\b", joined)
    try:
        parsed = date_parser.parse(joined, fuzzy=True, default=date_parser.parse("2026-01-01T23:59:00"))
        if parsed.year < 2000:
            parsed = parsed.replace(year=2026)
        iso = f"{parsed.year:04d}-{parsed.month:02d}-{parsed.day:02d}T23:59:00Z"
        confidence = 0.76 + (0.12 if year_match else 0.0)
        return iso, min(0.95, confidence)
    except Exception:
        pass

    # Fallback: sliding-window parse for partially-tagged CRF spans.
    for width in range(min(6, len(tokens)), 1, -1):
        for start in range(0, len(tokens) - width + 1):
            chunk = " ".join(tokens[start : start + width]).replace(" ,", ",")
            try:
                parsed = date_parser.parse(chunk, fuzzy=True, default=date_parser.parse("2026-01-01T23:59:00"))
                if parsed.year < 2000:
                    parsed = parsed.replace(year=2026)
                iso = f"{parsed.year:04d}-{parsed.month:02d}-{parsed.day:02d}T23:59:00Z"
                return iso, 0.62
            except Exception:
                continue
    return None, 0.35


def _predict_type(text: str) -> tuple[str, float]:
    tokens = _tokenize(text)
    if not tokens:
        return "assignment", 0.35
    features = [_type_token_features(tokens, idx) for idx in range(len(tokens))]
    labels, confidence = _TYPE_CRF.decode(features)
    counts: dict[str, int] = defaultdict(int)
    for label in labels:
        if label != "O":
            counts[label.lower()] += 1

    lower_text = text.lower()
    if "project" in lower_text:
        return "project", max(0.55, min(0.97, confidence))
    if "midterm" in lower_text or "exam" in lower_text:
        return "exam", max(0.55, min(0.97, confidence))
    if "essay" in lower_text:
        return "assignment", max(0.55, min(0.97, confidence))

    if not counts:
        return "assignment", max(0.35, confidence * 0.5)

    best_type = max(counts.items(), key=lambda item: item[1])[0]
    return best_type, max(0.45, min(0.97, confidence))


def _predict_due(text: str) -> tuple[str | None, float]:
    tokens = _tokenize(text)
    if not tokens:
        return None, 0.2
    features = [_date_token_features(tokens, idx) for idx in range(len(tokens))]
    labels, confidence = _DATE_CRF.decode(features)
    due_date, span_conf = _parse_due_from_span(tokens, labels)
    return due_date, max(confidence, span_conf)


def _extract_crf_candidates(syllabus_text: str) -> list[CandidateTuple]:
    candidates: list[CandidateTuple] = []
    lines = [line.strip() for line in syllabus_text.splitlines() if line.strip()]
    segments: list[str] = []
    for line in lines:
        parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", line) if part.strip()]
        segments.extend(parts if parts else [line])
    for line in segments:
        if len(line) < 8:
            continue
        due_date, due_conf = _predict_due(line)
        task_type, type_conf = _predict_type(line)
        if due_conf < 0.4 and type_conf < 0.4:
            continue
        title = re.sub(r"\s+", " ", line)[:120]
        candidates.append(
            CandidateTuple(
                item=title,
                type=task_type,
                due_date=due_date,
                weight=1.0,
                confidence=round((due_conf + type_conf) / 2, 3),
            )
        )
    return candidates


def _infer_edges(tasks: list[IngestTask]) -> list[Edge]:
    by_number: dict[str, dict[str, IngestTask]] = defaultdict(dict)
    pattern = re.compile(r"\b(\d{1,2})\b")
    for task in tasks:
        match = pattern.search(task.title)
        if match:
            by_number[match.group(1)][task.type] = task

    edges: list[Edge] = []
    for _number, typed in by_number.items():
        reading = typed.get("reading")
        quiz = typed.get("quiz")
        assignment = typed.get("assignment")
        if reading and quiz:
            edges.append(Edge(from_task_id=reading.id, to_task_id=quiz.id, confidence=0.72))
        if reading and assignment:
            edges.append(Edge(from_task_id=reading.id, to_task_id=assignment.id, confidence=0.65))
    return edges


def ingest_syllabus(syllabus_text: str, llm_candidates: list[CandidateTuple]) -> IngestResponse:
    verifier_candidates = _extract_crf_candidates(syllabus_text)

    merged: dict[str, IngestTask] = {}
    conflicts: list[IngestConflict] = []

    verifier_by_key = {_slug(c.item): c for c in verifier_candidates}
    for llm in llm_candidates:
        key = _slug(llm.item)
        verify = verifier_by_key.get(key)

        inferred_type, verifier_type_conf = _predict_type(verify.item if verify else llm.item)
        inferred_due, verifier_due_conf = _predict_due(verify.item if verify else llm.item)

        chosen_type = llm.type or inferred_type
        chosen_due = llm.due_date or inferred_due

        if verify and llm.type and inferred_type != llm.type:
            conflicts.append(
                IngestConflict(
                    task_id=key,
                    field="type",
                    llm_value=llm.type,
                    verifier_value=inferred_type,
                    llm_confidence=llm.confidence,
                    verifier_confidence=verifier_type_conf,
                )
            )
            chosen_type = inferred_type if verifier_type_conf >= llm.confidence else llm.type

        if verify and llm.due_date and inferred_due and inferred_due != llm.due_date:
            conflicts.append(
                IngestConflict(
                    task_id=key,
                    field="due_date",
                    llm_value=llm.due_date,
                    verifier_value=inferred_due,
                    llm_confidence=llm.confidence,
                    verifier_confidence=verifier_due_conf,
                )
            )
            chosen_due = inferred_due if verifier_due_conf >= llm.confidence else llm.due_date

        merged[key] = IngestTask(
            id=key,
            title=llm.item,
            type=chosen_type,
            due_date=chosen_due,
            weight=llm.weight,
            confidence=max(llm.confidence, verifier_type_conf, verifier_due_conf),
        )

    # include rule extracted items not seen by LLM pass
    for verifier in verifier_candidates:
        key = _slug(verifier.item)
        if key in merged:
            continue
        merged[key] = IngestTask(
            id=key,
            title=verifier.item,
            type=verifier.type,
            due_date=verifier.due_date,
            weight=verifier.weight,
            confidence=verifier.confidence,
        )

    tasks = list(merged.values())
    edges = _infer_edges(tasks)
    return IngestResponse(
        tasks=tasks,
        prereq_edges=edges,
        conflicts=conflicts,
        stats={
            "llm_candidates": len(llm_candidates),
            "verifier_candidates": len(verifier_candidates),
            "task_count": len(tasks),
            "edge_count": len(edges),
            "conflict_count": len(conflicts),
            "verifier_model": "linear_chain_crf",
        },
    )
