"""
Laedt/speichert die editierbaren Filterkriterien (Modul 2) aus YAML-Dateien
in criteria/<source>.yaml. Das ist bewusst dateibasiert statt in einer DB,
damit man die Kriterien notfalls auch direkt im Editor anpassen kann.
"""
from __future__ import annotations

import copy
import os
import uuid
from typing import Any

import yaml

CRITERIA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "criteria")


def list_sources() -> list[str]:
    if not os.path.isdir(CRITERIA_DIR):
        return []
    return sorted(
        f[:-5] for f in os.listdir(CRITERIA_DIR)
        if f.endswith(".yaml")
    )


def _path(source: str) -> str:
    return os.path.join(CRITERIA_DIR, f"{source}.yaml")


def load_criteria(source: str) -> dict[str, Any]:
    path = _path(source)
    if not os.path.exists(path):
        return {
            "source": source,
            "target_profile": "",
            "exclusion_rules": [],
            "notes": [],
        }
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    data.setdefault("exclusion_rules", [])
    data.setdefault("notes", [])
    data.setdefault("target_profile", "")
    data.setdefault("source", source)
    return data


def save_criteria(source: str, data: dict[str, Any]) -> None:
    os.makedirs(CRITERIA_DIR, exist_ok=True)
    with open(_path(source), "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)


def add_rule(source: str, label: str, description: str, active: bool = True) -> dict[str, Any]:
    """Fuegt eine neue Ausschlussregel hinzu -- die zentrale Stelle, ueber die
    das System erweiterbar bleibt, wenn neue Fehlläufer-Muster auffallen."""
    data = load_criteria(source)
    rule = {
        "id": uuid.uuid4().hex[:8],
        "label": label,
        "description": description,
        "active": active,
    }
    data["exclusion_rules"].append(rule)
    save_criteria(source, data)
    return rule


def update_rule(source: str, rule_id: str, **changes: Any) -> None:
    data = load_criteria(source)
    for rule in data["exclusion_rules"]:
        if rule["id"] == rule_id:
            rule.update(changes)
            break
    save_criteria(source, data)


def delete_rule(source: str, rule_id: str) -> None:
    data = load_criteria(source)
    data["exclusion_rules"] = [r for r in data["exclusion_rules"] if r["id"] != rule_id]
    save_criteria(source, data)


def clone_default_for_new_source(source: str, template_source: str = "meta_ads_library") -> dict[str, Any]:
    template = load_criteria(template_source)
    data = copy.deepcopy(template)
    data["source"] = source
    save_criteria(source, data)
    return data
