"""Run-Management: History, State, Feedback für die komplette Pipeline."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import Any

RUNS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".runs")


@dataclass
class ModuleState:
    """State eines Modul-Schritts."""
    name: str  # "modul_1_scraping", "modul_2_klassifizierung", "modul_3_anreicherung"
    status: str  # "pending", "in_progress", "completed", "failed"
    started_at: str = ""
    completed_at: str = ""
    result_count: int = 0
    error: str = ""
    config: dict = field(default_factory=dict)


@dataclass
class Run:
    """Ein Run durch die ganze Pipeline."""
    id: str  # eindeutige ID (timestamp oder uuid)
    created_at: str
    updated_at: str
    status: str  # "scraping" (Step 1 in progress), "dataset_ready" (Step 1 done, can reprocess), "completed"

    # Raw Dataset (immutable nach Step 1)
    raw_dataset_file: str = ""  # pfad zu .runs/{run_id}_raw.json
    raw_mapping_file: str = ""  # pfad zu .runs/{run_id}_raw_mapping.json

    # Pipeline-Schritte
    modules: dict[str, ModuleState] = field(default_factory=dict)

    # Klassifizierung: Modell-Ergebnisse
    classification_results: dict[str, Any] = field(default_factory=dict)  # {modell: {keep: 180, reject: 62}}

    # Feedback
    rating: int = 0  # 1-5
    feedback: str = ""
    best_model: str = ""  # welches Modell war am besten?

    # Metadaten
    source: str = ""  # "meta_ads_library", "phantombuster_upload"
    data_file: str = ""  # pfad zu den rohdetaten
    final_export: str = ""  # pfad zum finalen export

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "status": self.status,
            "raw_dataset_file": self.raw_dataset_file,
            "raw_mapping_file": self.raw_mapping_file,
            "modules": {k: asdict(v) for k, v in self.modules.items()},
            "classification_results": self.classification_results,
            "rating": self.rating,
            "feedback": self.feedback,
            "best_model": self.best_model,
            "source": self.source,
            "data_file": self.data_file,
            "final_export": self.final_export,
        }

    @classmethod
    def from_dict(cls, data: dict) -> Run:
        modules = {
            k: ModuleState(
                name=v["name"],
                status=v["status"],
                started_at=v.get("started_at", ""),
                completed_at=v.get("completed_at", ""),
                result_count=v.get("result_count", 0),
                error=v.get("error", ""),
                config=v.get("config", {}),
            )
            for k, v in data.get("modules", {}).items()
        }
        return cls(
            id=data["id"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            status=data["status"],
            raw_dataset_file=data.get("raw_dataset_file", ""),
            raw_mapping_file=data.get("raw_mapping_file", ""),
            modules=modules,
            classification_results=data.get("classification_results", {}),
            rating=data.get("rating", 0),
            feedback=data.get("feedback", ""),
            best_model=data.get("best_model", ""),
            source=data.get("source", ""),
            data_file=data.get("data_file", ""),
            final_export=data.get("final_export", ""),
        )


def create_run(source: str) -> Run:
    """Erstelle einen neuen Run."""
    now = datetime.now().isoformat()
    run_id = now.replace(":", "-").replace(".", "-")[:19]
    os.makedirs(RUNS_DIR, exist_ok=True)

    run = Run(
        id=run_id,
        created_at=now,
        updated_at=now,
        status="in_progress",
        source=source,
        modules={
            "modul_1": ModuleState(name="Modul 1: Scraping", status="pending"),
            "modul_2": ModuleState(name="Modul 2: Klassifizierung", status="pending"),
            "modul_3": ModuleState(name="Modul 3: Anreicherung", status="pending"),
        },
    )
    save_run(run)
    return run


def save_run(run: Run) -> None:
    """Speichere einen Run."""
    os.makedirs(RUNS_DIR, exist_ok=True)
    path = os.path.join(RUNS_DIR, f"{run.id}.json")
    run.updated_at = datetime.now().isoformat()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(run.to_dict(), f, ensure_ascii=False, indent=2)


def load_run(run_id: str) -> Run | None:
    """Lade einen Run."""
    path = os.path.join(RUNS_DIR, f"{run_id}.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return Run.from_dict(json.load(f))


def list_runs() -> list[Run]:
    """Alle Runs in umgekehrter Reihenfolge (neuste zuerst)."""
    os.makedirs(RUNS_DIR, exist_ok=True)
    runs = []
    for fname in sorted(os.listdir(RUNS_DIR), reverse=True):
        if fname.endswith(".json") and not fname.endswith("_raw.json") and not fname.endswith("_mapping.json"):
            run = load_run(fname[:-5])
            if run:
                runs.append(run)
    return runs


def save_raw_dataset(run_id: str, df_data: list[dict]) -> str:
    """Speichere den Raw Dataset (immutable nach Step 1)."""
    os.makedirs(RUNS_DIR, exist_ok=True)
    path = os.path.join(RUNS_DIR, f"{run_id}_raw.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(df_data, f, ensure_ascii=False, indent=2)
    return path


def load_raw_dataset(run_id: str) -> list[dict] | None:
    """Lade den Raw Dataset."""
    path = os.path.join(RUNS_DIR, f"{run_id}_raw.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_raw_mapping(run_id: str, mapping: dict) -> str:
    """Speichere das Raw Mapping (immutable nach Step 1)."""
    os.makedirs(RUNS_DIR, exist_ok=True)
    path = os.path.join(RUNS_DIR, f"{run_id}_raw_mapping.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    return path


def load_raw_mapping(run_id: str) -> dict | None:
    """Lade das Raw Mapping."""
    path = os.path.join(RUNS_DIR, f"{run_id}_raw_mapping.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)
