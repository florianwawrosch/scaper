"""Meta Ads Library API scraper."""

import json
import urllib.error
import urllib.request
import urllib.parse

API_URL = "https://graph.facebook.com/v21.0/ads_archive"

FIELDS = [
    "id",
    "page_name",
    "page_id",
    "ad_creative_bodies",
    "ad_creative_link_captions",
    "ad_creative_link_descriptions",
    "ad_creative_link_titles",
    "ad_delivery_start_time",
    "ad_delivery_stop_time",
    "ad_snapshot_url",
    "bylines",
    "publisher_platforms",
    "languages",
    "eu_total_reach",
]


def scrape_meta_ads(
    access_token: str,
    search_terms: list,
    ad_reached_countries: list = None,
    ad_active_status: str = "ACTIVE",
    publisher_platforms: list = None,
    languages: list = None,
    media_type: str = "ALL",
    search_type: str = "KEYWORD_UNORDERED",
    ad_delivery_date_min: str = None,
    ad_delivery_date_max: str = None,
    bylines: str = None,
    search_page_ids: list = None,
    limit: int = 50,
) -> list:
    if not access_token:
        raise RuntimeError("META_ADS_API_TOKEN fehlt — bitte in den Einstellungen eintragen.")

    if not ad_reached_countries:
        ad_reached_countries = ["DE", "AT"]
    if not publisher_platforms:
        publisher_platforms = ["FACEBOOK", "INSTAGRAM"]

    all_results = []

    for term in search_terms:
        if not term.strip():
            continue

        def jl(lst):
            return json.dumps(lst, separators=(',', ':'))

        params = {
            "access_token": access_token,
            "search_terms": term.strip(),
            "ad_reached_countries": jl(ad_reached_countries),
            "ad_active_status": ad_active_status,
            "fields": ",".join(FIELDS),
            "limit": min(int(limit), 100),
        }

        if publisher_platforms:
            params["publisher_platforms"] = jl(publisher_platforms)
        if languages:
            params["languages"] = jl(languages)
        if media_type and media_type != "ALL":
            params["media_type"] = media_type
        if search_type:
            params["search_type"] = search_type
        if ad_delivery_date_min:
            params["ad_delivery_date_min"] = ad_delivery_date_min
        if ad_delivery_date_max:
            params["ad_delivery_date_max"] = ad_delivery_date_max
        if bylines:
            params["bylines"] = bylines
        if search_page_ids:
            params["search_page_ids"] = json.dumps(
                [s.strip() for s in search_page_ids if s.strip()]
            )

        collected = 0
        url = f"{API_URL}?{urllib.parse.urlencode(params)}"

        while url and collected < limit:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "LeadPipeline/1.0"})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    raw = resp.read().decode()
            except urllib.error.HTTPError as e:
                raw = e.read().decode()
                try:
                    err_data = json.loads(raw)
                    msg = err_data.get("error", {}).get("message", raw[:200])
                except Exception:
                    msg = raw[:200]
                raise RuntimeError(f"Meta API HTTP {e.code}: {msg}")
            except Exception as e:
                raise RuntimeError(f"Netzwerkfehler: {e}")

            try:
                data = json.loads(raw)
            except Exception:
                raise RuntimeError(f"Ungültige API-Antwort: {raw[:200]}")

            if "error" in data:
                err = data["error"]
                raise RuntimeError(f"Meta API Fehler ({err.get('code', '?')}): {err.get('message', str(err))}")

            ads = data.get("data", [])
            for ad in ads:
                if collected >= limit:
                    break
                all_results.append(_flatten(ad, term))
                collected += 1

            next_url = data.get("paging", {}).get("next")
            url = next_url if (next_url and collected < limit) else None

    return all_results


def _flatten(ad: dict, search_term: str) -> dict:
    bodies       = ad.get("ad_creative_bodies") or []
    captions     = ad.get("ad_creative_link_captions") or []
    descriptions = ad.get("ad_creative_link_descriptions") or []
    titles       = ad.get("ad_creative_link_titles") or []
    platforms    = ad.get("publisher_platforms") or []
    langs        = ad.get("languages") or []

    return {
        "id":           ad.get("id", ""),
        "page_name":    ad.get("page_name", ""),
        "page_id":      str(ad.get("page_id", "")),
        "ad_text":      " | ".join(bodies),
        "ad_title":     " | ".join(titles),
        "ad_description": " | ".join(descriptions),
        "ad_caption":   " | ".join(captions),
        "platforms":    ", ".join(platforms),
        "languages":    ", ".join(langs),
        "start_date":   ad.get("ad_delivery_start_time", ""),
        "stop_date":    ad.get("ad_delivery_stop_time", ""),
        "snapshot_url": ad.get("ad_snapshot_url", ""),
        "bylines":      ad.get("bylines", ""),
        "reach":        str(ad.get("eu_total_reach", "")),
        "search_term":  search_term,
    }
