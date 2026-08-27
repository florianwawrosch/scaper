"""
Vereinheitlichtes Lead-Schema.

Beide Scraper-Quellen (Meta Ads Library, PhantomBuster/LinkedIn) liefern
unterschiedliche Spalten. Fuer Modul 2 (Filterung) reicht es, die paar Felder
zu kennen, die inhaltlich fuer eine Ja/Nein-Entscheidung relevant sind. Die
komplette Rohzeile bleibt trotzdem erhalten (siehe `extra`), damit spaeter
nichts verloren geht (z.B. fuer Modul 3 / Export).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# Kanonische Felder, auf die jede Quelle gemappt wird.
CANONICAL_FIELDS = [
    "name",          # Personen- oder Page-/Firmenname
    "company",       # Firmenname
    "website",       # Haupt-Website/Domain
    "headline",       # Kurzbeschreibung / Jobtitel
    "description",   # Laengerer Freitext (Bio, Ad-Text, LinkedIn-About)
]

# Vorbelegte Spalten-Zuordnung fuer bekannte Quellen. Wird in der UI als
# Vorschlag angezeigt, kann dort korrigiert werden (z.B. sobald die exakten
# Meta-Spalten aus _ad_library_common.py bekannt sind).
DEFAULT_MAPPINGS: dict[str, dict[str, str]] = {
    "phantombuster_linkedin": {
        "name": "fullName",
        "company": "companyName",
        "website": "personalWebsite",
        "headline": "linkedinHeadline",
        "description": "linkedinDescription",
    },
    "phantombuster_upload": {
        "name": "fullName",
        "company": "companyName",
        "website": "personalWebsite",
        "headline": "linkedinHeadline",
        "description": "linkedinDescription",
    },
    "meta_ads_library": {
        # Platzhalter-Vorschlag, bis die echten PAGE_COLS aus
        # _ad_library_common.py vorliegen. In der UI frei anpassbar.
        "name": "page_name",
        "company": "beneficiary_payers",
        "website": "display_link",
        "headline": "",
        "description": "",
    },
}


@dataclass
class Lead:
    name: str = ""
    company: str = ""
    website: str = ""
    headline: str = ""
    description: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def classification_text(self) -> str:
        """Text, der Gemini zur Bewertung vorgelegt wird."""
        parts = [
            f"Name: {self.name}",
            f"Firma: {self.company}",
            f"Website: {self.website}",
            f"Headline/Jobtitel: {self.headline}",
            f"Beschreibung: {self.description}",
        ]
        return "\n".join(p for p in parts if p.split(": ", 1)[1].strip())


def guess_mapping(columns: list[str], source: str | None = None) -> dict[str, str]:
    """Liefert eine Start-Zuordnung kanonisches Feld -> Spaltenname.

    Nutzt zuerst die hinterlegte Default-Zuordnung fuer die Quelle (falls
    bekannt und die Spalte tatsaechlich existiert), sonst eine simple
    Fuzzy-Suche ueber Spaltennamen.
    """
    cols_lower = {c.lower(): c for c in columns}
    mapping: dict[str, str] = {f: "" for f in CANONICAL_FIELDS}

    preset = DEFAULT_MAPPINGS.get(source or "", {})
    for field_name, col in preset.items():
        if col and col in columns:
            mapping[field_name] = col

    guesses = {
        "name": ["fullname", "full_name", "name", "page_name"],
        "company": ["companyname", "company_name", "company", "beneficiary_payers", "firma"],
        "website": ["personalwebsite", "website", "website1", "display_link", "domain"],
        "headline": ["linkedinheadline", "headline", "jobtitle", "linkedinjobtitle"],
        "description": ["linkedindescription", "description", "bio", "about"],
    }
    for field_name, candidates in guesses.items():
        if mapping.get(field_name):
            continue
        for cand in candidates:
            if cand in cols_lower:
                mapping[field_name] = cols_lower[cand]
                break
    return mapping


def rows_to_leads(rows: list[dict[str, Any]], mapping: dict[str, str]) -> list[Lead]:
    leads = []
    for row in rows:
        leads.append(
            Lead(
                name=str(row.get(mapping.get("name", ""), "") or ""),
                company=str(row.get(mapping.get("company", ""), "") or ""),
                website=str(row.get(mapping.get("website", ""), "") or ""),
                headline=str(row.get(mapping.get("headline", ""), "") or ""),
                description=str(row.get(mapping.get("description", ""), "") or ""),
                extra=row,
            )
        )
    return leads
