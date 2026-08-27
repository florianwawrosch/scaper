"""Data Enrichment - Find emails, contact info, etc."""
from dataclasses import dataclass
from typing import Optional

ENRICHMENT_PROVIDERS = {
    "hunter_io": {
        "name": "Hunter.io",
        "description": "Find work emails",
        "requires_api_key": True,
        "env_var": "HUNTER_IO_API_KEY",
    },
    "findymail": {
        "name": "FindyMail",
        "description": "Find professional emails",
        "requires_api_key": True,
        "env_var": "FINDYMAIL_API_KEY",
    },
    "clearbit": {
        "name": "Clearbit",
        "description": "Company & person enrichment",
        "requires_api_key": True,
        "env_var": "CLEARBIT_API_KEY",
    },
    "apollo_io": {
        "name": "Apollo.io",
        "description": "Email finder & verification",
        "requires_api_key": True,
        "env_var": "APOLLO_IO_API_KEY",
    },
}


@dataclass
class EnrichmentResult:
    """Result from enrichment provider"""
    email: Optional[str] = None
    phone: Optional[str] = None
    confidence: float = 0.0
    provider: str = ""
    metadata: dict = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


def get_providers() -> list:
    """Get list of available enrichment providers"""
    return list(ENRICHMENT_PROVIDERS.keys())


def get_provider_info(provider_key: str) -> dict:
    """Get info about a specific provider"""
    return ENRICHMENT_PROVIDERS.get(provider_key, {})


def mock_enrich(name: str, company: str, provider: str = "hunter_io") -> EnrichmentResult:
    """Mock enrichment - returns dummy data for testing"""
    # In production, this would call actual APIs
    domain = company.lower().replace(" ", "").replace("&", "and")[:10]
    email = f"{name.lower().split()[0]}@{domain}.com"

    return EnrichmentResult(
        email=email,
        phone=None,
        confidence=0.75,
        provider=provider,
        metadata={
            "source": "mock_data",
            "enriched_at": "2026-08-27",
        },
    )
