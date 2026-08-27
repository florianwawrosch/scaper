import os
import sys
import json
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import streamlit as st
from core.runs import load_run, save_run, ModuleState
from core.loaders import load_table, rows_from_df
from core.schema import CANONICAL_FIELDS, guess_mapping, rows_to_leads
from core.gemini_classifier import classify_batch
from core.close_export import to_close_columns
from core import criteria_store

st.set_page_config(page_title="Run Detail", page_icon="📊", layout="wide")

run_id = st.session_state.get("current_run_id")
if not run_id:
    st.error("Kein Run ausgewählt. Geh zur Startseite zurück.")
    st.stop()

run = load_run(run_id)
if not run:
    st.error(f"Run {run_id} nicht gefunden.")
    st.stop()

st.title(f"📊 Run {run_id}")
st.caption(f"Quelle: {run.source} • Status: {run.status} • Erstellt: {run.created_at}")

tab1, tab2, tab3, tab4 = st.tabs(["📥 Modul 1: Scraping", "🤖 Modul 2: Klassifizierung", "✨ Modul 3: Anreicherung", "🎯 Review & Export"])

source_labels = {
    "meta_ads_library": "Meta Ads Library",
    "phantombuster_upload": "PhantomBuster / LinkedIn",
}

with tab1:
    st.subheader("Modul 1: Daten-Import")
    if run.source == "meta_ads_library":
        st.info("🚧 Meta Scraper: noch in Entwicklung (braucht `_ad_library_common.py`)")
        st.markdown("""
        - Keywords eingeben
        - Länder auswählen
        - Filter setzen (page_limit, max_pages)
        - "Scrape starten" → läuft im Hintergrund
        """)
    elif run.source == "phantombuster_linkedin":
        st.markdown("**CSV/XLSX hochladen:**")
        uploaded = st.file_uploader("PhantomBuster-Export", type=["csv", "xlsx", "xls"], key="modul1_uploader")
        if uploaded:
            st.success(f"Datei geladen: {uploaded.name}")
            df = load_table(uploaded)
            st.info(f"{len(df)} Zeilen, {len(df.columns)} Spalten")

            st.subheader("Spalten-Zuordnung")
            st.caption("Vorschlag automatisch erkannt -- bei Bedarf korrigieren.")
            mapping = guess_mapping(list(df.columns), run.source)
            cols = st.columns(len(CANONICAL_FIELDS))
            new_mapping = {}
            options = [""] + list(df.columns)
            for c, field in zip(cols, CANONICAL_FIELDS):
                with c:
                    current = mapping.get(field, "")
                    idx = options.index(current) if current in options else 0
                    new_mapping[field] = st.selectbox(field, options=options, index=idx, key=f"map_{field}")

            st.subheader("Voransicht (erste 5 Zeilen)")
            st.dataframe(df.head(5), use_container_width=True)

            if st.button("Bestätigen & zu Modul 2", type="primary", use_container_width=True, key="modul1_confirm"):
                st.session_state[f"run_{run_id}_df"] = df
                st.session_state[f"run_{run_id}_mapping"] = new_mapping
                st.success("Daten gespeichert! Gehe zu Modul 2.")
                st.rerun()

with tab2:
    st.subheader("Modul 2: Automatische Klassifizierung")

    if f"run_{run_id}_df" not in st.session_state:
        st.info("Bitte lade zuerst Daten in Modul 1 hoch.")
    else:
        df = st.session_state[f"run_{run_id}_df"]
        mapping = st.session_state[f"run_{run_id}_mapping"]

        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**KI-Modelle auswählen:**")
            models = st.multiselect(
                "Welche Modelle sollen klassifizieren?",
                ["Gemini", "ChatGPT (OpenAI)", "Claude (Anthropic)"],
                default=["Gemini"],
                key="models_select"
            )
        with col2:
            st.markdown("**Status:**")
            if run.classification_results:
                for model_key, result in run.classification_results.items():
                    keep = result.get("keep", 0)
                    reject = result.get("reject", 0)
                    st.caption(f"✅ {model_key}: {keep} behalten, {reject} abgelehnt")
            else:
                if models:
                    for model in models:
                        st.caption(f"⏳ {model}: bereit")

        if st.button("Klassifizierung starten", type="primary", use_container_width=True, key="modul2_classify"):
            rows = rows_from_df(df)
            leads = rows_to_leads(rows, mapping)

            criteria_key = source_labels.get(run.source, run.source)
            criteria = criteria_store.load_criteria(run.source)

            progress = st.progress(0.0, text="Starte Klassifizierung...")

            def on_progress(done, total):
                progress.progress(done / total, text=f"{done}/{total} klassifiziert")

            try:
                results = classify_batch(leads, criteria, progress_callback=on_progress)

                for model in models:
                    keep_count = sum(1 for r in results if r.decision == "keep")
                    reject_count = sum(1 for r in results if r.decision == "reject")
                    unklar_count = sum(1 for r in results if r.decision == "unklar")

                    run.classification_results[model] = {
                        "keep": keep_count,
                        "reject": reject_count,
                        "unklar": unklar_count,
                    }

                st.session_state[f"run_{run_id}_results"] = results
                save_run(run)
                st.success(f"Klassifizierung abgeschlossen! {keep_count} behalten, {reject_count} abgelehnt")
                st.rerun()

            except RuntimeError as exc:
                st.error(str(exc))

with tab3:
    st.subheader("Modul 3: Datenen-Anreicherung")
    st.info("🚧 Hunter.io / FindyMail: noch in Entwicklung")
    st.markdown("""
    - E-Mails/Kontakte pro Lead suchen
    - Verifizieren
    - Ausgabe mit Erfolgsquote
    """)

with tab4:
    st.subheader("Review, Feedback & Export")

    if f"run_{run_id}_results" not in st.session_state or f"run_{run_id}_df" not in st.session_state:
        st.info("Bitte führe zunächst Modul 1 und 2 aus.")
    else:
        df = st.session_state[f"run_{run_id}_df"]
        results = st.session_state[f"run_{run_id}_results"]
        mapping = st.session_state[f"run_{run_id}_mapping"]

        rows = rows_from_df(df)
        criteria = criteria_store.load_criteria(run.source)

        out_rows = []
        for row, result in zip(rows, results):
            out_rows.append({
                **row,
                **to_close_columns(result, criteria),
                "_decision": result.decision,
                "_reason": result.reason,
                "_niche": result.niche or "",
            })
        out_df = pd.DataFrame(out_rows)

        col1, col2, col3 = st.columns(3)
        keep_count = (out_df["_decision"] == "keep").sum()
        reject_count = (out_df["_decision"] == "reject").sum()
        unklar_count = (out_df["_decision"] == "unklar").sum()

        col1.metric("Behalten", int(keep_count))
        col2.metric("Rausgefiltert", int(reject_count))
        col3.metric("Unklar", int(unklar_count))

        st.subheader("Klassifizierungsergebnisse")
        display_cols = [c for c in out_df.columns if not c.startswith("_")]
        st.dataframe(out_df[display_cols], use_container_width=True, height=400)

        st.divider()
        st.subheader("Feedback & Rating")

        col1, col2 = st.columns(2)
        with col1:
            rating = st.slider("Rating (1-5 Sterne)", 1, 5, 3, key="rating_slider", value=run.rating if run.rating else 3)
        with col2:
            best_model = st.selectbox("Bestes Modell:", ["Gemini", "ChatGPT", "Claude"], key="best_model_select", index=0 if not run.best_model else ["Gemini", "ChatGPT", "Claude"].index(run.best_model) if run.best_model in ["Gemini", "ChatGPT", "Claude"] else 0)

        feedback = st.text_area("Konkretes Feedback:", value=run.feedback, key="feedback_area", height=100)

        if st.button("Feedback speichern", use_container_width=True):
            run.rating = rating
            run.feedback = feedback
            run.best_model = best_model
            save_run(run)
            st.success("Feedback gespeichert!")

        st.divider()
        st.subheader("Export")

        export_df = out_df[[c for c in out_df.columns if not c.startswith("_")]].copy()
        csv_data = export_df.to_csv(index=False).encode("utf-8")

        st.download_button(
            "📥 CSV für Close herunterladen",
            data=csv_data,
            file_name=f"run_{run_id}_export.csv",
            mime="text/csv",
            use_container_width=True
        )
