"""Config-Optionen für verschiedene Scraping-Quellen"""

SCRAPING_SOURCES = {
    "meta_ads_library": {
        "name": "Meta Ads Library",
        "description": "Scrape active ads from Meta Ads Library",
        "fields": [
            {
                "key": "keywords",
                "label": "Keywords",
                "type": "text_area",
                "placeholder": "Enter keywords (one per line)",
                "required": True,
            },
            {
                "key": "countries",
                "label": "Countries",
                "type": "multiselect",
                "options": ["US", "DE", "UK", "FR", "IT", "AT", "CH"],
                "default": ["DE"],
                "required": True,
            },
            {
                "key": "page_limit",
                "label": "Pages per keyword",
                "type": "number",
                "value": 5,
                "min": 1,
                "max": 50,
            },
            {
                "key": "max_results",
                "label": "Max results per page",
                "type": "number",
                "value": 10,
                "min": 1,
                "max": 100,
            },
        ],
    },
    "phantombuster_linkedin": {
        "name": "PhantomBuster Upload",
        "description": "Import LinkedIn profiles from PhantomBuster export",
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
        "description": "Scrape job listings from various job portals",
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
                "label": "Job Title Keywords",
                "type": "text_area",
                "placeholder": "e.g. Coach, Trainer, Consultant",
                "required": True,
            },
            {
                "key": "location",
                "label": "Location",
                "type": "text",
                "placeholder": "City or region",
                "required": True,
            },
            {
                "key": "max_pages",
                "label": "Max pages to scrape",
                "type": "number",
                "value": 3,
                "min": 1,
                "max": 10,
            },
        ],
    },
}


def get_source_config(source_key: str) -> dict:
    """Get config for a specific source"""
    return SCRAPING_SOURCES.get(source_key, {})


def list_sources() -> list:
    """List all available sources"""
    return list(SCRAPING_SOURCES.keys())
