import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import streamlit as st

from core import criteria_store
from core.loaders import load_table, rows_from_df
from core.schema import CANONICAL_FIELDS, guess_mapping, rows_to_leads
from core.gemini_classifier import classify_batch

st.set_page_config(page_title="Modul 2 -- Filterung", page_icon="\U0001F50D", layout="wide")
st.title("Modul 2 -- Validierung & Filterung")

sources = criteria_store.list_sources()
source_labels = {
    "meta_ads_library": "Meta Ads Library",
    "phantombuster_linkedin": "PhantomBuster / LinkedIn",
}

col1, col2 = st.columns([2, 1])
with col1:
    uploaded = st.file_uploader("CSV oder XLSX hochladen (Meta-Export oder PhantomBuster-Export)", type=["csv", "xlsx", "xls"])
with col2:
    source = st.selectbox(
        "Quelle",
        options=sources,
        format_func=lambda s: source_labels.get(s, s),
    )

if uploaded is not None:
    df = load_table(uploaded)
    st.success(f"{len(df)} Zeilen geladen, {len(df.columns)} Spalten.")
    st.dataframe(df.head(10), use_container_width=True)

    st.subheader("Spalten-Zuordnung")
    st.caption("Vorschlag automatisch erkannt -- bei Bedarf korrigieren.")
    mapping = guess_mapping(list(df.columns), source)
    cols = st.columns(len(CANONICAL_FIELDS))
    new_mapping = {}
    options = [""] + list(df.columns)
    for c, field in zip(cols, CANONICAL_FIELDS):
        with c:
            current = mapping.get(field, "")
            idx = options.index(current) if current in options else 0
            new_mapping[field] = st.selectbox(field, options=options, index=idx, key=f"map_{field}")

    criteria = criteria_store.load_criteria(source)
    with st.expander(f"Aktive Kriterien fuer '{source_labels.get(source, source)}'", expanded=False):
        st.markdown(f"**Zielprofil:** {criteria.get('target_profile', '')}")
        for rule in criteria.get("exclusion_rules", []):
            status = "aktiv" if rule.get("active", True) else "inaktiv"
            st.markdown(f"- [{status}] **{rule['label']}** -- {rule['description']}")
        st.caption("Kriterien anpassen/erweitern: Seite 'Kriterien'.")

    max_rows = st.number_input("Max. Zeilen verarbeiten (0 = alle)", min_value=0, value=0, step=10)

    if st.button("Klassifizieren", type="primary"):
        rows = rows_from_df(df)
        if max_rows:
            rows = rows[:max_rows]
        leads = rows_to_leads(rows, new_mapping)

        progress = st.progress(0.0, text="Starte ...")

        def on_progress(done, total):
            progress.progress(done / total, text=f"{done}/{total} klassifiziert")

        try:
            results = classify_batch(leads, criteria, progress_callback=on_progress)
        except RuntimeError as exc:
            st.error(str(exc))
            st.stop()

        out_rows = []
        for row, result in zip(rows, results):
            out_rows.append(
                {
                    **row,
                    "gemini_decision": result.decision,
                    "gemini_matched_rule": result.matched_rule or "",
                    "gemini_reason": result.reason,
                }
            )
        out_df = pd.DataFrame(out_rows)

        st.session_state["last_result"] = out_df
        st.success("Fertig.")

if "last_result" in st.session_state:
    out_df = st.session_state["last_result"]
    st.subheader("Ergebnis")

    counts = out_df["gemini_decision"].value_counts()
    m1, m2, m3 = st.columns(3)
    m1.metric("Behalten", int(counts.get("keep", 0)))
    m2.metric("Rausgefiltert", int(counts.get("reject", 0)))
    m3.metric("Unklar", int(counts.get("unklar", 0)))

    tab_keep, tab_reject, tab_all = st.tabs(["Behalten", "Rausgefiltert", "Alle"])
    with tab_keep:
        st.dataframe(out_df[out_df["gemini_decision"] == "keep"], use_container_width=True)
    with tab_reject:
        st.dataframe(out_df[out_df["gemini_decision"] == "reject"], use_container_width=True)
    with tab_all:
        st.dataframe(out_df, use_container_width=True)

    st.download_button(
        "Ergebnis als CSV herunterladen",
        data=out_df.to_csv(index=False).encode("utf-8"),
        file_name="leads_klassifiziert.csv",
        mime="text/csv",
    )
