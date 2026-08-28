"""FastAPI Backend für Lead Pipeline."""

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from pathlib import Path

from core.runs import (
    list_runs, load_run, save_run, create_run,
    load_raw_dataset, save_raw_dataset,
    load_raw_mapping, save_raw_mapping,
    load_results, save_results,
)
from core.loaders import load_table, rows_from_df
from core.schema import CANONICAL_FIELDS, guess_mapping, rows_to_leads
from core.presets import list_presets, load_preset, save_preset, delete_preset
from core.scraping_config import get_source_config, SCRAPING_SOURCES
from core import criteria_store
from dataclasses import asdict
import json

app = FastAPI(title="Lead Pipeline API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartRunRequest(BaseModel):
    source: str
    scraper_config: Optional[dict] = None


class UpdateRunRequest(BaseModel):
    rating: Optional[int] = None
    feedback: Optional[str] = None
    status: Optional[str] = None


class ClassifyRequest(BaseModel):
    aiProvider: str = "gemini"
    aiModel: str = "gemini-2.0-flash"
    df_data: Optional[list] = None
    mapping: Optional[dict] = None
    apiKey: Optional[str] = None


class AnalyzeRequest(BaseModel):
    aiProvider: str = "gemini"
    aiModel: str = "gemini-2.0-flash"
    prompt: str
    column_name: str = "KI Analyse"
    apiKey: Optional[str] = None


class EnrichRequest(BaseModel):
    provider: str = "hunter_io"
    apiKey: Optional[str] = None
    nameColumn: Optional[str] = None     # column holding the person name (default "name")
    companyColumn: Optional[str] = None  # column holding company/domain (default "company")


class SavePresetRequest(BaseModel):
    name: str
    config: dict


def _run_to_dict(run) -> dict:
    return {
        "id": run.id,
        "source": run.source,
        "status": run.status,
        "created_at": run.created_at,
        "rating": run.rating,
        "feedback": run.feedback,
        "classification_results": run.classification_results,
        "scraper_config": run.scraper_config,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/config/providers")
async def provider_config():
    """Report which provider API keys are configured server-side (booleans only)."""
    return {
        "gemini":    bool(os.environ.get("GEMINI_API_KEY")),
        "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "openai":    bool(os.environ.get("OPENAI_API_KEY")),
        "meta_ads":  bool(os.environ.get("META_ADS_API_TOKEN")),
        "hunter_io": bool(os.environ.get("HUNTER_IO_API_KEY")),
        "findymail": bool(os.environ.get("FINDYMAIL_API_KEY")),
    }


@app.get("/api/runs")
async def get_runs():
    runs = list_runs()
    return [_run_to_dict(r) for r in runs]


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    run = load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "id": run.id,
        "source": run.source,
        "status": run.status,
        "created_at": run.created_at,
        "classification_results": run.classification_results,
        "rating": run.rating,
        "feedback": run.feedback,
        "scraper_config": run.scraper_config,
    }


def _do_meta_ads_scrape(run_id: str, cfg: dict):
    """Background task: call Meta Ads API and save dataset."""
    from core.meta_ads_scraper import scrape_meta_ads
    run = load_run(run_id)
    if not run:
        return
    try:
        token      = cfg.get("meta_ads_token") or os.environ.get("META_ADS_API_TOKEN", "")
        keywords   = cfg.get("keywords") or []
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.splitlines() if k.strip()]

        rows = scrape_meta_ads(
            access_token=token,
            search_terms=keywords,
            ad_reached_countries=cfg.get("countries") or cfg.get("ad_reached_countries") or ["DE", "AT"],
            ad_active_status=cfg.get("ad_status") or cfg.get("ad_active_status") or "ACTIVE",
            publisher_platforms=cfg.get("platforms") or cfg.get("publisher_platforms") or ["FACEBOOK", "INSTAGRAM"],
            languages=cfg.get("languages"),
            media_type=cfg.get("media_type", "ALL"),
            search_type=cfg.get("search_type", "KEYWORD_UNORDERED"),
            ad_delivery_date_min=cfg.get("ad_delivery_date_min"),
            ad_delivery_date_max=cfg.get("ad_delivery_date_max"),
            bylines=cfg.get("bylines"),
            limit=int(cfg.get("limit", 50)),
        )
        save_raw_dataset(run_id, rows)
        save_raw_mapping(run_id, {})
        run.status = "dataset_ready"
        run.scraper_config = {**cfg, "scraped_count": len(rows)}
    except Exception as e:
        run.status = "failed"
        run.scraper_config = {**cfg, "error": str(e)}
    save_run(run)


@app.post("/api/runs")
async def start_run(req: StartRunRequest, background_tasks: BackgroundTasks):
    run = create_run(req.source)
    cfg = req.scraper_config or {}
    run.scraper_config = cfg

    if req.source == "meta_ads_library":
        run.status = "scraping"
        save_run(run)
        background_tasks.add_task(_do_meta_ads_scrape, run.id, cfg)
    else:
        save_run(run)

    return _run_to_dict(run)


@app.patch("/api/runs/{run_id}")
async def update_run(run_id: str, req: UpdateRunRequest):
    run = load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if req.rating is not None:
        run.rating = req.rating
    if req.feedback is not None:
        run.feedback = req.feedback
    if req.status is not None:
        run.status = req.status
    save_run(run)
    return _run_to_dict(run)


@app.post("/api/runs/{run_id}/upload")
async def upload_data(run_id: str, file: UploadFile = File(...)):
    run = load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    contents = await file.read()
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    import io
    df = load_table(io.BytesIO(contents))
    os.unlink(tmp_path)

    if df is None:
        raise HTTPException(status_code=400, detail="Could not parse file")

    mapping = guess_mapping(list(df.columns), run.source)
    raw_data = df.to_dict(orient="records")
    save_raw_dataset(run_id, raw_data)
    save_raw_mapping(run_id, mapping)
    run.status = "dataset_ready"
    save_run(run)

    return {
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
        "mapping": mapping,
    }


@app.post("/api/runs/{run_id}/dataset")
async def save_dataset(run_id: str, data: dict):
    run = load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    df_data = data.get("df_data", [])
    mapping = data.get("mapping", {})
    save_raw_dataset(run_id, df_data)
    save_raw_mapping(run_id, mapping)
    run.status = "dataset_ready"
    save_run(run)
    return {"status": "saved"}


@app.get("/api/runs/{run_id}/dataset")
async def get_dataset(run_id: str):
    df_data = load_raw_dataset(run_id)
    mapping = load_raw_mapping(run_id)
    return {"df_data": df_data or [], "mapping": mapping or {}}


@app.get("/api/runs/{run_id}/results")
async def get_results(run_id: str):
    results = load_results(run_id)
    return {"results": results or []}


@app.post("/api/runs/{run_id}/classify")
async def classify(run_id: str, req: ClassifyRequest):
    run = load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Load dataset from storage or from request
    if req.df_data:
        df_data = req.df_data
        mapping = req.mapping or {}
    else:
        df_data = load_raw_dataset(run_id) or []
        mapping = load_raw_mapping(run_id) or {}

    if not df_data:
        raise HTTPException(status_code=400, detail="No dataset found for this run")

    import pandas as pd
    df = pd.DataFrame(df_data)
    rows = rows_from_df(df)
    leads = rows_to_leads(rows, mapping)
    criteria = criteria_store.load_criteria(run.source)

    # Route to correct AI provider
    provider = req.aiProvider.lower()
    model_name = req.aiModel

    try:
        if provider == "gemini":
            from core.gemini_classifier import classify_batch
            results = classify_batch(leads, criteria, api_key=req.apiKey, model_name=req.aiModel)

        elif provider == "anthropic":
            results = _classify_anthropic(leads, criteria, model_name, api_key=req.apiKey)

        elif provider == "openai":
            results = _classify_openai(leads, criteria, model_name, api_key=req.apiKey)

        else:
            from core.gemini_classifier import classify_batch
            results = classify_batch(leads, criteria)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

    stats = {
        "keep": sum(1 for r in results if r.decision == "keep"),
        "reject": sum(1 for r in results if r.decision == "reject"),
        "unklar": sum(1 for r in results if r.decision == "unklar"),
    }

    model_key = f"{provider}:{model_name}"
    run.classification_results[model_key] = stats
    save_results(run_id, [asdict(r) for r in results])
    run.status = "in_progress"
    save_run(run)

    return {
        "stats": stats,
        "results": [asdict(r) for r in results],
    }


def _classify_anthropic(leads, criteria, model_name: str, api_key: str = None):
    """Classify using Anthropic Claude."""
    import anthropic
    from core.gemini_classifier import build_prompt, _parse_response, ClassificationResult

    api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY fehlt")

    client = anthropic.Anthropic(api_key=api_key)
    results = []

    for lead in leads:
        try:
            prompt = build_prompt(lead, criteria)
            message = client.messages.create(
                model=model_name,
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}]
            )
            results.append(_parse_response(message.content[0].text))
        except Exception as e:
            from core.gemini_classifier import ClassificationResult
            results.append(ClassificationResult(decision="unklar", matched_rule=None, reason=f"Fehler: {e}"))

    return results


def _classify_openai(leads, criteria, model_name: str, api_key: str = None):
    """Classify using OpenAI."""
    import openai
    from core.gemini_classifier import build_prompt, _parse_response, ClassificationResult

    api_key = api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY fehlt")

    client = openai.OpenAI(api_key=api_key)
    results = []

    for lead in leads:
        try:
            prompt = build_prompt(lead, criteria)
            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=512,
            )
            results.append(_parse_response(response.choices[0].message.content))
        except Exception as e:
            results.append(ClassificationResult(decision="unklar", matched_rule=None, reason=f"Fehler: {e}"))

    return results


def _call_ai_single(provider: str, model_name: str, prompt: str, api_key: str = None) -> str:
    try:
        if provider == "gemini":
            import google.generativeai as genai
            key = api_key or os.environ.get("GEMINI_API_KEY", "")
            if not key:
                return "Fehler: GEMINI_API_KEY fehlt"
            genai.configure(api_key=key)
            model = genai.GenerativeModel(model_name)
            resp = model.generate_content(prompt)
            return resp.text.strip()
        elif provider == "anthropic":
            import anthropic
            key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
            if not key:
                return "Fehler: ANTHROPIC_API_KEY fehlt"
            client = anthropic.Anthropic(api_key=key)
            msg = client.messages.create(
                model=model_name, max_tokens=256,
                messages=[{"role": "user", "content": prompt}]
            )
            return msg.content[0].text.strip()
        elif provider == "openai":
            import openai
            key = api_key or os.environ.get("OPENAI_API_KEY", "")
            if not key:
                return "Fehler: OPENAI_API_KEY fehlt"
            client = openai.OpenAI(api_key=key)
            resp = client.chat.completions.create(
                model=model_name, max_tokens=256,
                messages=[{"role": "user", "content": prompt}]
            )
            return resp.choices[0].message.content.strip()
    except Exception as e:
        return f"Fehler: {e}"
    return "—"


@app.post("/api/runs/{run_id}/analyze")
async def analyze_run(run_id: str, req: AnalyzeRequest):
    run = load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    df_data = load_raw_dataset(run_id) or []
    if not df_data:
        raise HTTPException(status_code=400, detail="No dataset found for this run")

    provider = req.aiProvider.lower()
    values = []
    for row in df_data:
        row_text = "\n".join(
            f"{k}: {v}" for k, v in row.items()
            if v and str(v).strip() and k != "_idx"
        )
        full_prompt = f"{req.prompt}\n\nDaten:\n{row_text}\n\nAntworte nur kurz und direkt."
        value = _call_ai_single(provider, req.aiModel, full_prompt, api_key=req.apiKey)
        values.append(value)

    return {"column_name": req.column_name, "values": values}


@app.post("/api/runs/{run_id}/enrich")
async def enrich(run_id: str, req: EnrichRequest):
    run = load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    results = load_results(run_id) or []
    kept = [r for r in results if r.get("decision") == "keep"]

    if not kept:
        df_data = load_raw_dataset(run_id) or []
        kept = df_data

    enriched = []
    api_key = req.apiKey or os.environ.get(
        "HUNTER_IO_API_KEY" if req.provider == "hunter_io" else "FINDYMAIL_API_KEY"
    )
    if not api_key:
        raise HTTPException(status_code=400, detail=f"Kein API-Key für {req.provider} — bitte in den Einstellungen eintragen.")

    name_col    = req.nameColumn or "name"
    company_col = req.companyColumn or "company"

    first_error = None
    skipped_empty = 0

    for item in kept[:50]:  # limit for safety
        name = str(item.get(name_col, "") or "")
        company = str(item.get(company_col, "") or "")
        email = None

        if name and company:
            try:
                if req.provider == "hunter_io":
                    email = _enrich_hunter(name, company, api_key)
                elif req.provider == "findymail":
                    email = _enrich_findymail(name, company, api_key)
            except Exception as e:
                if first_error is None:
                    first_error = str(e)
        else:
            skipped_empty += 1

        enriched.append({**item, "email": email or "", "enriched": bool(email)})

    n_ok = len([e for e in enriched if e["enriched"]])
    # If nothing succeeded and there was an API error, surface it
    if n_ok == 0 and first_error:
        raise HTTPException(status_code=502, detail=f"{req.provider} API-Fehler: {first_error}")

    return {
        "enriched": n_ok,
        "total": len(enriched),
        "skipped_empty": skipped_empty,
        "error": first_error,
        "results": enriched,
    }


def _api_error_detail(e) -> str:
    import urllib.error
    if isinstance(e, urllib.error.HTTPError):
        try:
            body = json.loads(e.read().decode())
            msg = body.get("errors", [{}])[0].get("details") or body.get("message") or body.get("error") or str(body)[:150]
        except Exception:
            msg = ""
        return f"HTTP {e.code}: {msg}" if msg else f"HTTP {e.code}"
    return str(e)


def _enrich_hunter(name: str, company: str, api_key: str) -> Optional[str]:
    import urllib.request
    import urllib.error
    import urllib.parse
    parts = name.strip().split()
    first = parts[0] if parts else ""
    last = parts[-1] if len(parts) > 1 else ""
    params = urllib.parse.urlencode({
        "first_name": first, "last_name": last,
        "company": company, "api_key": api_key,
    })
    url = f"https://api.hunter.io/v2/email-finder?{params}"
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None  # no email found for this person — not an error
        raise RuntimeError(f"Hunter.io {_api_error_detail(e)}")
    except Exception as e:
        raise RuntimeError(f"Hunter.io: {e}")
    return data.get("data", {}).get("email")


def _enrich_findymail(name: str, company: str, api_key: str) -> Optional[str]:
    import urllib.request
    import urllib.error
    parts = name.strip().split()
    first = parts[0] if parts else ""
    last = parts[-1] if len(parts) > 1 else ""
    url = "https://app.findymail.com/api/search/name"
    payload = json.dumps({"name": f"{first} {last}", "domain": company}).encode()
    req_obj = urllib.request.Request(url, data=payload, headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req_obj, timeout=8) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise RuntimeError(f"FindyMail {_api_error_detail(e)}")
    except Exception as e:
        raise RuntimeError(f"FindyMail: {e}")
    return data.get("email")


@app.get("/api/sources")
async def get_sources():
    sources = []
    for key, cfg in SCRAPING_SOURCES.items():
        sources.append({
            "key": key,
            "label": cfg.get("name", key),
            "name": cfg.get("name", key),
            "description": cfg.get("description", ""),
            "config_schema": {f["key"]: f for f in cfg.get("fields", [])},
        })
    return sources


@app.get("/api/sources/{source_key}/presets")
async def get_presets(source_key: str):
    preset_names = list_presets(source_key)
    result = []
    for name in preset_names:
        if name.startswith("_"):
            continue
        cfg = load_preset(source_key, name) or {}
        result.append({
            "name": name,
            "config": {k: v for k, v in cfg.items() if not k.startswith("_")},
            "created_at": "",
        })
    return result


@app.post("/api/sources/{source_key}/presets")
async def save_source_preset(source_key: str, req: SavePresetRequest):
    save_preset(source_key, req.name, req.config)
    return {"name": req.name, "config": req.config, "created_at": ""}


@app.delete("/api/sources/{source_key}/presets/{preset_name}")
async def delete_source_preset(source_key: str, preset_name: str):
    delete_preset(source_key, preset_name)
    return {"deleted": True}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
