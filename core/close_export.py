"""Bildet ein ClassificationResult auf die Spaltennamen ab, die ihr bereits im
Close-Import-Format verwendet (siehe close_import_*.xlsx):
  - "Ist agentur / Konkurrent"
  - "ist Konzerncoach / JA/Nein"
  - "High Ticket Coach?"
  - "Branche / Nische"
  - "Hinweise (Setter/Closer/Erstgespräch)"
So laesst sich das Ergebnis 1:1 in den bestehenden Close-Import uebernehmen.
"""
from __future__ import annotations

from core.gemini_classifier import ClassificationResult

JA = "Ja"
NEIN = "Nein"


def to_close_columns(result: ClassificationResult, criteria: dict) -> dict[str, str]:
    is_reject = result.decision == "reject"
    rule = result.matched_rule or ""

    niche_labels = {n["id"]: n["label"] for n in criteria.get("niches", [])}

    return {
        "Ist agentur / Konkurrent": JA if (is_reject and rule == "competitor") else NEIN,
        "ist Konzerncoach / JA/Nein": JA if (is_reject and rule == "konzerncoach") else NEIN,
        "High Ticket Coach?": (
            NEIN if (is_reject and rule == "no_high_ticket") else (JA if result.decision == "keep" else "")
        ),
        "Branche / Nische": niche_labels.get(result.niche or "", ""),
        "Hinweise (Setter/Closer/Erstgespräch)": result.reason,
    }
