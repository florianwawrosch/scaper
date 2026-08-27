"""FastAPI Backend für Lead Pipeline."""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
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
from core.gemini_classifier import classify_batch, ClassificationResult
from core.presets import list_presets, load_preset, save_preset
from core.scraping_config import get_source_config
from core import criteria_store
from dataclasses import asdict

app = FastAPI(title="Lead Pipeline API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunSchema(BaseModel):
    id: str
    source: str
    status: str
    created_at: str
    rating: int
    feedback: str
    classification_results: dict


class StartRunRequest(BaseModel):
    source: str
    scraper_config: Optional[dict] = None


@app.get("/api/runs")
async def get_runs():
    """Alle Runs auflisten."""
    runs = list_runs()
    return [
        {
            "id": r.id,
            "source": r.source,
            "status": r.status,
            "created_at": r.created_at,
            "rating": r.rating,
            "feedback": r.feedback,
            "classification_results": r.classification_results,
        }
        for r in runs
    ]


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    """Einen Run laden."""
    run = load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "id": run.id,
        "source": run.source,
        "status": run.status,
        "created_at": run.created_at,
        "raw_dataset_file": run.raw_dataset_file,
        "raw_mapping_file": run.raw_mapping_file,
        "classification_results": run.classification_results,
        "rating": run.rating,
        "feedback": run.feedback,
        "best_model": run.best_model,
        "scraper_config": run.scraper_config,
    }


@app.post("/api/runs")
async def start_run(req: StartRunRequest):
    """Neuen Run starten."""
    run = create_run(req.source)
    if req.scraper_config:
        run.scraper_config = req.scraper_config
    save_run(run)
    return {
        "id": run.id,
        "source": run.source,
        "status": run.status,
        "created_at": run.created_at,
    }


@app.post("/api/runs/{run_id}/upload")
async def upload_data(run_id: str, file: UploadFile = File(...)):
    """Datei für PhantomBuster Upload."""
    run = load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    contents = await file.read()
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    df = load_table(open(tmp_path, "rb"))
    os.unlink(tmp_path)

    if df is None:
        raise HTTPException(status_code=400, detail="Could not parse file")

    return {
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
    }


@app.post("/api/runs/{run_id}/dataset")
async def save_dataset(run_id: str, data: dict):
    """Raw Dataset + Mapping speichern."""
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
    """Raw Dataset laden."""
    df_data = load_raw_dataset(run_id)
    mapping = load_raw_mapping(run_id)
    return {
        "df_data": df_data,
        "mapping": mapping,
    }


@app.post("/api/runs/{run_id}/classify")
async def classify(run_id: str, data: dict):
    """Daten klassifizieren."""
    run = load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    df_data = data.get("df_data", [])
    mapping = data.get("mapping", {})
    model = data.get("model", "Gemini")

    import pandas as pd
    df = pd.DataFrame(df_data)
    rows = rows_from_df(df)
    leads = rows_to_leads(rows, mapping)
    criteria = criteria_store.load_criteria(run.source)

    results = classify_batch(leads, criteria)

    run.classification_results[model] = {
        "keep": sum(1 for r in results if r.decision == "keep"),
        "reject": sum(1 for r in results if r.decision == "reject"),
        "unklar": sum(1 for r in results if r.decision == "unklar"),
    }

    save_results(run_id, [asdict(r) for r in results])
    run.status = "in_progress"
    save_run(run)

    return {
        "keep": run.classification_results[model]["keep"],
        "reject": run.classification_results[model]["reject"],
        "unklar": run.classification_results[model]["unklar"],
    }


@app.get("/api/sources")
async def get_sources():
    """Alle Datenquellen mit Konfiguration."""
    from core.scraping_config import SCRAPING_SOURCES
    return SCRAPING_SOURCES


@app.get("/api/sources/{source_key}/presets")
async def get_presets(source_key: str):
    """Presets für eine Quelle."""
    presets = list_presets(source_key)
    return {"presets": presets}


@app.post("/api/sources/{source_key}/presets")
async def save_source_preset(source_key: str, data: dict):
    """Preset speichern."""
    name = data.get("name", "default")
    values = data.get("values", {})
    save_preset(source_key, name, values)
    return {"saved": True}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Static files für React Frontend (wird später aufgebaut)
frontend_path = Path(__file__).parent / "frontend" / "out"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
