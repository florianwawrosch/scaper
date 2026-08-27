import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import streamlit as st

from core import criteria_store
from core.loaders import load_table, rows_from_df
from core.schema import CANONICAL_FIELDS, guess_mapping, rows_to_leads
from core.gemini_classifier import classify_batch
from core.close_export import to_close_columns

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
                    **to_close_columns(result, criteria),
                    "_decision": result.decision,  # intern fuer Sortierung/Metriken, nicht Teil des Close-Imports
                    "_manuell_raus": False,
                    "_manueller_grund": "",
                }
            )
        out_df = pd.DataFrame(out_rows)

        st.session_state["last_result"] = out_df
        st.session_state["last_source"] = source
        st.success("Fertig.")

if "last_result" in st.session_state:
    out_df = st.session_state["last_result"]
    result_source = st.session_state.get("last_source", sources[0] if sources else "")
    st.subheader("Ergebnis")

    counts = out_df["_decision"].value_counts()
    m1, m2, m3 = st.columns(3)
    m1.metric("Behalten", int(counts.get("keep", 0)))
    m2.metric("Rausgefiltert", int(counts.get("reject", 0)))
    m3.metric("Unklar", int(counts.get("unklar", 0)))

    tab_keep, tab_reject, tab_all = st.tabs(["Behalten (manuell pruefen)", "Rausgefiltert", "Alle"])

    with tab_keep:
        st.caption(
            "Grenzfaelle wie z.B. Manifestationscoach o.ae. per KI zwar als "
            "'High-Ticket-Coach' erkannt, inhaltlich aber zu abwegig? Hier ankreuzen, "
            "Grund eintragen und uebernehmen -- optional gleich als neue Regel speichern."
        )
        keep_mask = out_df["_decision"] == "keep"
        edited = st.data_editor(
            out_df[keep_mask],
            use_container_width=True,
            key="keep_editor",
            column_config={
                "_manuell_raus": st.column_config.CheckboxColumn("Manuell ablehnen?"),
                "_manueller_grund": st.column_config.TextColumn("Grund (z.B. 'Manifestationscoach, zu irrational')"),
            },
            disabled=[c for c in out_df.columns if c not in ("_manuell_raus", "_manueller_grund")],
        )

        if st.button("Manuelle Ablehnungen uebernehmen"):
            out_df.loc[edited.index, "_manuell_raus"] = edited["_manuell_raus"]
            out_df.loc[edited.index, "_manueller_grund"] = edited["_manueller_grund"]
            to_reject = out_df["_manuell_raus"] & (out_df["_decision"] == "keep")
            out_df.loc[to_reject, "_decision"] = "reject"
            out_df.loc[to_reject, "High Ticket Coach?"] = "Nein"
            out_df.loc[to_reject, "Hinweise (Setter/Closer/Erstgespräch)"] = (
                "Manuell abgelehnt: " + out_df.loc[to_reject, "_manueller_grund"]
            )
            st.session_state["last_result"] = out_df
            st.success(f"{int(to_reject.sum())} Zeile(n) manuell abgelehnt.")
            st.rerun()

        new_rules_pending = out_df.loc[
            (out_df["_manuell_raus"]) & (out_df["_manueller_grund"].str.strip() != ""),
            "_manueller_grund",
        ].unique().tolist()
        if new_rules_pending:
            with st.expander("Als neue Ausschlussregel(n) speichern"):
                for grund in new_rules_pending:
                    if st.button(f"Regel anlegen: '{grund}'", key=f"newrule_{hash(grund)}"):
                        criteria_store.add_rule(result_source, label=grund[:60], description=grund)
                        st.success("Regel gespeichert. Wirkt ab der naechsten Klassifizierung.")

    with tab_reject:
        st.dataframe(out_df[out_df["_decision"] == "reject"], use_container_width=True)
    with tab_all:
        st.dataframe(out_df, use_container_width=True)

    export_df = out_df.drop(columns=["_decision", "_manuell_raus", "_manueller_grund"])
    st.download_button(
        "Ergebnis als CSV herunterladen (Close-Import-Format)",
        data=export_df.to_csv(index=False).encode("utf-8"),
        file_name="leads_klassifiziert.csv",
        mime="text/csv",
    )
