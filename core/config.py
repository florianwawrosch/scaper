"""Global configuration - Localization, Date formats, UI settings."""
from dataclasses import dataclass
from datetime import datetime

# Supported languages
LANGUAGES = {
    "de": "Deutsch",
    "en": "English",
}

# Date format configurations per language
DATE_FORMATS = {
    "de": {
        "short": "%d.%m.%Y",  # 27.08.2026
        "long": "%d. %B %Y",  # 27. August 2026
        "time": "%H:%M",  # 14:30
        "datetime_short": "%d.%m.%Y %H:%M",  # 27.08.2026 14:30
    },
    "en": {
        "short": "%m/%d/%Y",  # 08/27/2026
        "long": "%B %d, %Y",  # August 27, 2026
        "time": "%I:%M %p",  # 02:30 PM
        "datetime_short": "%m/%d/%Y %I:%M %p",  # 08/27/2026 02:30 PM
    },
}

# Month names for long date format
MONTH_NAMES = {
    "de": ["Januar", "Februar", "März", "April", "Mai", "Juni",
           "Juli", "August", "September", "Oktober", "November", "Dezember"],
    "en": ["January", "February", "March", "April", "May", "June",
           "July", "August", "September", "October", "November", "December"],
}

# UI Labels per language
LABELS = {
    "de": {
        "new_run": "Neuer Run",
        "scraping": "Scraping",
        "review_filter": "Review & Filter",
        "enrichment": "Anreicherung",
        "export": "Export",
        "upload_data": "Daten hochladen",
        "test_data": "Test Daten",
        "column_mapping": "Spaltenzuordnung",
        "preview": "Vorschau",
        "next": "→ Weiter",
        "classify": "→ Klassifizieren",
        "enrich": "→ Anreichern",
        "keep": "Behalten",
        "reject": "Ablehnen",
        "rating": "Bewertung",
        "feedback": "Feedback",
        "best_model": "Bestes Modell",
        "save": "Speichern",
        "download_csv": "CSV herunterladen",
        "completed": "Abgeschlossen",
        "in_progress": "In Bearbeitung",
        "draft": "Entwurf",
        "last_runs": "Letzte Runs",
        "no_runs": "Noch keine Runs erstellt",
        "start": "Start",
    },
    "en": {
        "new_run": "New Run",
        "scraping": "Scraping",
        "review_filter": "Review & Filter",
        "enrichment": "Enrichment",
        "export": "Export",
        "upload_data": "Upload Data",
        "test_data": "Test Data",
        "column_mapping": "Column Mapping",
        "preview": "Preview",
        "next": "→ Next",
        "classify": "→ Classify",
        "enrich": "→ Enrich",
        "keep": "Keep",
        "reject": "Reject",
        "rating": "Rating",
        "feedback": "Feedback",
        "best_model": "Best Model",
        "save": "Save",
        "download_csv": "Download CSV",
        "completed": "Completed",
        "in_progress": "In Progress",
        "draft": "Draft",
        "last_runs": "Recent Runs",
        "no_runs": "No runs created yet",
        "start": "Start",
    },
}


def get_language() -> str:
    """Get current language from Streamlit session state, default to German."""
    import streamlit as st
    return st.session_state.get("language", "de")


def format_date(dt: datetime | str, format_type: str = "short", language: str = None) -> str:
    """
    Format a datetime object or ISO string according to language preferences.

    Args:
        dt: datetime object or ISO string
        format_type: "short", "long", "time", "datetime_short"
        language: Language code ("de", "en"), defaults to current session language

    Returns:
        Formatted date string
    """
    if language is None:
        language = get_language()

    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))

    if language not in DATE_FORMATS:
        language = "de"

    if format_type not in DATE_FORMATS[language]:
        format_type = "short"

    fmt = DATE_FORMATS[language][format_type]

    # Handle German month names for long format
    if format_type == "long" and language == "de":
        month_name = MONTH_NAMES["de"][dt.month - 1]
        return dt.strftime(f"%d. {month_name} %Y")

    return dt.strftime(fmt)


def get_label(key: str, language: str = None) -> str:
    """Get localized label for a key."""
    if language is None:
        language = get_language()

    if language not in LABELS:
        language = "de"

    return LABELS[language].get(key, key)


def translate(key: str) -> str:
    """Shorthand for get_label."""
    return get_label(key)
