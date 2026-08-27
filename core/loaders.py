"""Einlesen von hochgeladenen CSV/XLSX-Dateien (Meta-Export, PhantomBuster-Export)
in eine Liste von dicts (eine pro Zeile), unabhaengig vom genauen Format."""
from __future__ import annotations

import io
from typing import Any

import pandas as pd


def load_table(uploaded_file) -> pd.DataFrame:
    name = getattr(uploaded_file, "name", "") or ""
    data = uploaded_file.read()
    buf = io.BytesIO(data)
    if name.lower().endswith((".xlsx", ".xls")):
        return pd.read_excel(buf, dtype=str).fillna("")
    # CSV: Trennzeichen automatisch erkennen (Komma oder Semikolon).
    try:
        return pd.read_csv(buf, dtype=str, sep=None, engine="python").fillna("")
    except Exception:
        buf.seek(0)
        return pd.read_csv(buf, dtype=str).fillna("")


def rows_from_df(df: pd.DataFrame) -> list[dict[str, Any]]:
    return df.to_dict(orient="records")
