"""Scraper-Presets: gespeicherte Konfigurationen pro Datenquelle.

Presets werden als JSON in .presets/ gespeichert, jeweils benannt nach
<source>_<preset_name>.json.  Ein Preset enthält die Formularwerte, die
der User beim letzten Mal eingestellt hat, so dass er sie beim nächsten
Run nicht neu eingeben muss.
"""

import json
import os
from pathlib import Path
from datetime import date

PRESETS_DIR = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) / ".presets"


def _ensure_dir():
    PRESETS_DIR.mkdir(parents=True, exist_ok=True)


def _safe_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in name.strip())


def _serialize(obj):
    if isinstance(obj, date):
        return obj.isoformat()
    return obj


def save_preset(source: str, name: str, values: dict) -> str:
    _ensure_dir()
    safe = _safe_name(name)
    path = PRESETS_DIR / f"{source}_{safe}.json"
    data = {k: _serialize(v) for k, v in values.items()}
    data["_source"] = source
    data["_name"] = name
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return str(path)


def load_preset(source: str, name: str) -> dict | None:
    safe = _safe_name(name)
    path = PRESETS_DIR / f"{source}_{safe}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def list_presets(source: str) -> list[str]:
    _ensure_dir()
    prefix = f"{source}_"
    names = []
    for f in sorted(PRESETS_DIR.glob(f"{prefix}*.json")):
        try:
            data = json.loads(f.read_text())
            names.append(data.get("_name", f.stem.removeprefix(prefix)))
        except (json.JSONDecodeError, KeyError):
            names.append(f.stem.removeprefix(prefix))
    return names


def delete_preset(source: str, name: str) -> bool:
    safe = _safe_name(name)
    path = PRESETS_DIR / f"{source}_{safe}.json"
    if path.exists():
        path.unlink()
        return True
    return False


def get_last_preset(source: str) -> dict | None:
    """Letztes verwendetes Preset laden (nach Datei-Datum sortiert)."""
    _ensure_dir()
    prefix = f"{source}_"
    files = sorted(PRESETS_DIR.glob(f"{prefix}*.json"), key=os.path.getmtime, reverse=True)
    if not files:
        return None
    try:
        return json.loads(files[0].read_text())
    except (json.JSONDecodeError, KeyError):
        return None
