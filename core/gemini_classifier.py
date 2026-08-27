"""
Modul 2 -- Gemini-basierte Filterung.

Ersetzt die bisherige manuelle Loesung (CSV -> Google Sheets -> eine Spalte
mit einer Gemini-Formel druebergezogen) durch eine Klassifizierung, die:
  - pro Quelle ein eigenes, editierbares Kriterien-Set nutzt (criteria/*.yaml)
  - fuer jeden Lead eine klare keep/reject-Entscheidung + Begruendung liefert
  - bei "reject" sagt, WELCHE Regel gegriffen hat (fuer Nachvollziehbarkeit
    und um neue Regeln gezielt nachschaerfen zu koennen)
"""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Callable

from core.schema import Lead

_MODEL_ENV = "GEMINI_MODEL"
_DEFAULT_MODEL = "gemini-2.0-flash"


@dataclass
class ClassificationResult:
    decision: str          # "keep" | "reject" | "unklar"
    matched_rule: str | None
    reason: str
    niche: str | None = None   # id aus criteria["niches"], nur bei decision=="keep" gesetzt
    raw: str = ""


def _get_client():
    import google.generativeai as genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY fehlt. Bitte als Umgebungsvariable setzen (siehe .env.example)."
        )
    genai.configure(api_key=api_key)
    model_name = os.environ.get(_MODEL_ENV, _DEFAULT_MODEL)
    return genai.GenerativeModel(model_name)


def build_prompt(lead: Lead, criteria: dict) -> str:
    active_rules = [r for r in criteria.get("exclusion_rules", []) if r.get("active", True)]
    rules_text = "\n".join(
        f'- id="{r["id"]}": {r["label"]} -- {r["description"].strip()}'
        for r in active_rules
    )
    niches = sorted(criteria.get("niches", []), key=lambda n: n.get("priority", 999))
    niches_text = "\n".join(f'- id="{n["id"]}": {n["label"]}' for n in niches)
    niche_instruction = (
        f"""
NISCHEN (nur relevant wenn decision="keep", waehle die am besten passende):
{niches_text}
"""
        if niches
        else ""
    )
    return f"""Du bewertest Leads fuer eine Vertriebs-Pipeline.

ZIELPROFIL (das wollen wir BEHALTEN):
{criteria.get("target_profile", "").strip()}

AUSSCHLUSSREGELN (wenn EINE davon zutrifft: ablehnen):
{rules_text or "(keine aktiven Regeln)"}
{niche_instruction}
LEAD-DATEN:
{lead.classification_text()}

Antworte AUSSCHLIESSLICH als JSON-Objekt in dieser Form, ohne weiteren Text:
{{"decision": "keep" | "reject", "matched_rule": "<id der Regel oder null>", "niche": "<id der Nische oder null>", "reason": "<ein kurzer Satz auf Deutsch>"}}

Wenn keine Ausschlussregel eindeutig zutrifft und der Lead zum Zielprofil passt: decision="keep", matched_rule=null,
niche=<am besten passende Nischen-id>.
Wenn du unsicher bist, aber tendenziell nicht passt: decision="reject" mit der am ehesten zutreffenden Regel, niche=null.
"""


def _parse_response(text: str) -> ClassificationResult:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    try:
        data = json.loads(text)
        decision = str(data.get("decision", "unklar")).lower()
        if decision not in ("keep", "reject"):
            decision = "unklar"
        return ClassificationResult(
            decision=decision,
            matched_rule=data.get("matched_rule"),
            niche=data.get("niche") if decision == "keep" else None,
            reason=str(data.get("reason", "")),
            raw=text,
        )
    except (json.JSONDecodeError, AttributeError):
        return ClassificationResult(decision="unklar", matched_rule=None, reason=f"Antwort nicht parsbar: {text[:200]}", raw=text)


def classify_lead(lead: Lead, criteria: dict, model=None) -> ClassificationResult:
    model = model or _get_client()
    prompt = build_prompt(lead, criteria)
    response = model.generate_content(prompt)
    return _parse_response(response.text)


def classify_batch(
    leads: list[Lead],
    criteria: dict,
    progress_callback: Callable[[int, int], None] | None = None,
    pause_seconds: float = 0.0,
) -> list[ClassificationResult]:
    model = _get_client()
    results = []
    for i, lead in enumerate(leads, 1):
        try:
            results.append(classify_lead(lead, criteria, model=model))
        except Exception as exc:  # API-Fehler pro Zeile nicht den ganzen Batch abbrechen lassen
            results.append(ClassificationResult(decision="unklar", matched_rule=None, reason=f"Fehler: {exc}"))
        if progress_callback:
            progress_callback(i, len(leads))
        if pause_seconds:
            time.sleep(pause_seconds)
    return results
