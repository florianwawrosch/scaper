"""Config-Optionen für verschiedene Scraping-Quellen.

Meta Ads Library API parameters based on:
  - https://www.facebook.com/ads/library/api/
  - https://developers.facebook.com/docs/marketing-api/reference/ads_archive/
"""

SCRAPING_SOURCES = {
    "meta_ads_library": {
        "name": "Meta Ads Library",
        "description": "Aktive Werbeanzeigen aus der Meta Ad Library durchsuchen und exportieren.",
        "fields": [
            {
                "key": "search_terms",
                "label": "Suchbegriffe",
                "type": "text_area",
                "placeholder": "z.B. High Ticket Coach\nManifestation\nOnline Business",
                "help": "Ein Suchbegriff pro Zeile. Alle werden nacheinander abgefragt.",
                "required": True,
            },
            {
                "key": "ad_reached_countries",
                "label": "Länder",
                "type": "multiselect",
                "options": ["AT", "DE", "CH", "US", "GB", "FR", "IT", "ES", "NL", "BE", "PL", "CZ", "HU", "RO", "SE", "NO", "DK", "FI", "PT", "IE", "AU", "CA", "BR", "MX", "IN"],
                "default": ["AT", "DE"],
                "help": "ISO-Ländercodes. Pflichtfeld für die API.",
                "required": True,
            },
            {
                "key": "ad_active_status",
                "label": "Status",
                "type": "selectbox",
                "options": ["ACTIVE", "ALL", "INACTIVE"],
                "default": "ACTIVE",
                "help": "ACTIVE = nur laufende Anzeigen, ALL = alle, INACTIVE = abgelaufene.",
            },
            {
                "key": "publisher_platforms",
                "label": "Plattformen",
                "type": "multiselect",
                "options": ["FACEBOOK", "INSTAGRAM", "AUDIENCE_NETWORK", "MESSENGER"],
                "default": ["FACEBOOK", "INSTAGRAM"],
                "help": "Auf welchen Plattformen die Anzeige geschaltet wird.",
            },
            {
                "key": "languages",
                "label": "Sprachen",
                "type": "multiselect",
                "options": ["de", "en", "fr", "it", "es", "pt", "nl", "pl", "cs", "hu", "ro", "sv", "no", "da", "fi"],
                "default": ["de"],
                "help": "Sprachfilter für Anzeigentexte.",
            },
            {
                "key": "media_type",
                "label": "Medientyp",
                "type": "selectbox",
                "options": ["ALL", "IMAGE", "VIDEO", "MEME", "NONE"],
                "default": "ALL",
                "help": "Typ des Werbemittels filtern.",
            },
            {
                "key": "search_type",
                "label": "Suchtyp",
                "type": "selectbox",
                "options": ["KEYWORD_UNORDERED", "KEYWORD_EXACT_PHRASE"],
                "default": "KEYWORD_UNORDERED",
                "help": "KEYWORD_UNORDERED = beliebige Reihenfolge, KEYWORD_EXACT_PHRASE = exakte Phrase.",
            },
            {
                "key": "ad_delivery_date_min",
                "label": "Anzeige ab (Datum)",
                "type": "date",
                "help": "Nur Anzeigen, die ab diesem Datum ausgeliefert wurden.",
                "required": False,
            },
            {
                "key": "ad_delivery_date_max",
                "label": "Anzeige bis (Datum)",
                "type": "date",
                "help": "Nur Anzeigen, die bis zu diesem Datum ausgeliefert wurden.",
                "required": False,
            },
            {
                "key": "bylines",
                "label": "Bezahlt von (Byline)",
                "type": "text",
                "placeholder": "z.B. Firmenname GmbH",
                "help": "Filter nach 'Bezahlt von'-Angabe der Anzeige.",
                "required": False,
            },
            {
                "key": "search_page_ids",
                "label": "Facebook Page IDs",
                "type": "text_area",
                "placeholder": "z.B. 123456789\n987654321",
                "help": "Nur Anzeigen von bestimmten Facebook-Seiten. Eine Page-ID pro Zeile.",
                "required": False,
            },
            {
                "key": "limit",
                "label": "Max Ergebnisse pro Suchbegriff",
                "type": "number",
                "value": 50,
                "min": 1,
                "max": 500,
                "help": "Maximale Anzahl Anzeigen pro Suchbegriff.",
            },
        ],
    },
    "phantombuster_linkedin": {
        "name": "PhantomBuster Upload",
        "description": "LinkedIn-Profile aus PhantomBuster CSV/XLSX-Export importieren.",
        "fields": [
            {
                "key": "file_upload",
                "label": "CSV/XLSX File",
                "type": "file_uploader",
                "file_types": ["csv", "xlsx", "xls"],
                "required": True,
            },
        ],
    },
    "job_portal": {
        "name": "Job Portal Scraper",
        "description": "Stellenanzeigen von Job-Portalen scrapen (in Entwicklung).",
        "fields": [
            {
                "key": "portal",
                "label": "Portal",
                "type": "selectbox",
                "options": ["LinkedIn", "Indeed", "Xing"],
                "required": True,
            },
            {
                "key": "keywords",
                "label": "Suchbegriffe",
                "type": "text_area",
                "placeholder": "z.B. Coach, Trainer, Berater",
                "required": True,
            },
            {
                "key": "location",
                "label": "Ort",
                "type": "text",
                "placeholder": "Stadt oder Region",
                "required": True,
            },
            {
                "key": "max_pages",
                "label": "Max Seiten",
                "type": "number",
                "value": 3,
                "min": 1,
                "max": 10,
            },
        ],
    },
}


def get_source_config(source_key: str) -> dict:
    return SCRAPING_SOURCES.get(source_key, {})


def list_sources() -> list:
    return list(SCRAPING_SOURCES.keys())
