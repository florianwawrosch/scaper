import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import streamlit as st
from dataclasses import asdict

from core.runs import (
    load_run, save_run,
    save_raw_dataset, load_raw_dataset,
    save_raw_mapping, load_raw_mapping,
    save_results, load_results,
)
from core.gemini_classifier import ClassificationResult
from core.loaders import load_table, rows_from_df
from core.schema import CANONICAL_FIELDS, guess_mapping, rows_to_leads
from core.gemini_classifier import classify_batch
from core.close_export import to_close_columns
from core.enrichment import mock_enrich, get_providers
from core.scraping_config import get_source_config
from core.config import format_date, translate
from core.ui import apply_global_styles, metric_card
from core import criteria_store

st.set_page_config(page_title="Active Run", page_icon="📊", layout="wide", initial_sidebar_state="collapsed")

apply_global_styles()

run_id = st.session_state.get("current_run_id")
if not run_id:
    st.error("Kein Run ausgewählt")
    st.stop()

run = load_run(run_id)
if not run:
    st.error(f"Run {run_id} nicht gefunden")
    st.stop()

col1, col2 = st.columns([3, 1])
with col1:
    st.markdown(f"# {run_id}")
    created_date = format_date(run.created_at, "short")
    status_labels = {"draft": "Draft", "scraping": "Scraping", "dataset_ready": "Dataset bereit", "in_progress": "In Bearbeitung", "completed": "Abgeschlossen"}
    status_label = status_labels.get(run.status, run.status)
    st.markdown(
        f'<div style="color: #6b7280; font-size: 0.95rem; margin-bottom: 1.5rem;">'
        f'{run.source.replace("_", " ").title()} • {created_date} • '
        f'<span style="font-weight:600; color:#374151;">{status_label}</span>'
        f'</div>',
        unsafe_allow_html=True
    )

def get_dataset():
    """Datensatz + Mapping aus Session-State oder von der Platte laden."""
    df_key, map_key = f"run_{run_id}_df", f"run_{run_id}_mapping"

    if df_key in st.session_state:
        df = st.session_state[df_key]
    else:
        raw = load_raw_dataset(run_id)
        df = pd.DataFrame(raw) if raw else None
        if df is not None:
            st.session_state[df_key] = df

    if map_key in st.session_state:
        mapping = st.session_state[map_key]
    else:
        mapping = load_raw_mapping(run_id)
        if mapping:
            st.session_state[map_key] = mapping

    return df, mapping


def get_results():
    """Klassifizierungs-Ergebnisse aus Session-State oder von der Platte laden."""
    key = f"run_{run_id}_results"
    if key in st.session_state:
        return st.session_state[key]
    stored = load_results(run_id)
    if not stored:
        return None
    results = [ClassificationResult(**r) for r in stored]
    st.session_state[key] = results
    return results


def build_output_df(df, results, criteria):
    """Rohdaten + Klassifizierung zu einer Tabelle zusammenfuehren."""
    rows = rows_from_df(df)
    out_rows = [
        {
            **row,
            **to_close_columns(result, criteria),
            "_decision": result.decision,
            "_reason": result.reason,
        }
        for row, result in zip(rows, results)
    ]
    return pd.DataFrame(out_rows)


tab1, tab2, tab3, tab4 = st.tabs([
    translate("scraping"),
    translate("review_filter"),
    translate("enrichment"),
    translate("export"),
])

source_labels = {
    "meta_ads_library": "Meta Ads Library",
    "phantombuster_linkedin": "PhantomBuster / LinkedIn",
}

with tab1:
    st.markdown("## Data Import")
    source_config = get_source_config(run.source)

    if not source_config:
        st.error(f"Unknown source: {run.source}")
    else:
        st.markdown(f"_{source_config['description']}_")
        st.markdown("---")

        df = None

        if run.source == "phantombuster_linkedin":
            col1, col2 = st.columns(2)
            with col1:
                uploaded = st.file_uploader("CSV/XLSX", type=["csv", "xlsx", "xls"], key="modul1_uploader", label_visibility="collapsed")
            with col2:
                if st.button("Test Data", key="load_test_data", use_container_width=True):
                    test_df = pd.DataFrame({
                        "fullName": ["John Coach", "Sarah Fitness", "Mike Tech", "Emma Manifestation", "David B2B"],
                        "companyName": ["High Ticket Academy", "Fit Pro Coaching", "Tech Startup Hub", "Manifestation Coaching", "Corporate Solutions"],
                        "personalWebsite": ["https://highticket.com", "https://fitpro.de", "", "https://manifest.de", "https://b2bsolutions.de"],
                        "linkedinHeadline": ["Business Coach", "Fitness Coach", "Tech Consultant", "Life Coach", "Business Development"],
                        "linkedinDescription": ["I help entrepreneurs scale", "Personal training", "Building tech solutions", "Manifest your dreams", "Corporate strategy"],
                    })
                    st.session_state[f"run_{run_id}_df"] = test_df
                    st.rerun()

            if uploaded:
                df = load_table(uploaded)
            elif f"run_{run_id}_df" in st.session_state:
                df = st.session_state[f"run_{run_id}_df"]

        elif run.source == "meta_ads_library":
            st.markdown("🚧 Meta Ads Library scraper coming soon")

        else:
            st.markdown(f"🚧 {source_config['name']} scraper in development")

        if df is not None:
            st.markdown(f"**{len(df)} rows** • {len(df.columns)} columns")
            st.markdown("---")

            st.markdown("### Column Mapping")
            mapping = guess_mapping(list(df.columns), run.source)
            cols = st.columns(len(CANONICAL_FIELDS))
            new_mapping = {}
            options = [""] + list(df.columns)
            for c, field in zip(cols, CANONICAL_FIELDS):
                with c:
                    current = mapping.get(field, "")
                    idx = options.index(current) if current in options else 0
                    new_mapping[field] = st.selectbox(field, options=options, index=idx, key=f"map_{field}")

            st.markdown("---")
            st.markdown("### Preview")
            st.dataframe(df.head(5), use_container_width=True, height=300)

            if st.button("→ Next", type="primary", use_container_width=True, key="modul1_confirm"):
                # Save raw dataset (immutable after Step 1)
                raw_data = df.to_dict(orient="records")
                raw_dataset_path = save_raw_dataset(run_id, raw_data)
                raw_mapping_path = save_raw_mapping(run_id, new_mapping)

                # Update Run status
                run.status = "dataset_ready"
                run.raw_dataset_file = raw_dataset_path
                run.raw_mapping_file = raw_mapping_path
                save_run(run)

                # Load into session state
                st.session_state[f"run_{run_id}_df"] = df
                st.session_state[f"run_{run_id}_mapping"] = new_mapping
                st.rerun()

with tab2:
    st.markdown("## Review & Filter")

    df, mapping = get_dataset()

    if df is None or mapping is None:
        st.info("Bitte zuerst im Tab **Scraping** Daten laden.")
    else:
        if get_results() is None:
            st.markdown("### Klassifizierung")
            model = st.selectbox(
                "Modell",
                ["Gemini"],
                key=f"model_{run_id}",
                help="ChatGPT und Claude sind noch nicht angebunden.",
            )
            st.markdown(
                '<div class="helper-text">ChatGPT und Claude folgen, sobald die Adapter gebaut sind. '
                'Ein erneuter Durchlauf mit anderem Modell wird als zusaetzliches Ergebnis gespeichert.</div>',
                unsafe_allow_html=True,
            )

            if st.button("→ Klassifizieren", type="primary", use_container_width=True, key="modul2_classify"):
                rows = rows_from_df(df)
                leads = rows_to_leads(rows, mapping)
                criteria = criteria_store.load_criteria(run.source)

                progress = st.progress(0.0, text="Laeuft...")
                def on_progress(done, total):
                    progress.progress(done / total, text=f"{done}/{total}")

                try:
                    results = classify_batch(leads, criteria, progress_callback=on_progress)

                    run.classification_results[model] = {
                        "keep": sum(1 for r in results if r.decision == "keep"),
                        "reject": sum(1 for r in results if r.decision == "reject"),
                        "unklar": sum(1 for r in results if r.decision == "unklar"),
                    }

                    save_results(run_id, [asdict(r) for r in results])
                    run.status = "in_progress"
                    save_run(run)
                    st.session_state[f"run_{run_id}_results"] = results
                    st.rerun()

                except RuntimeError as exc:
                    if "GEMINI_API_KEY" in str(exc):
                        st.error("Fehler: GEMINI_API_KEY ist nicht gesetzt")
                    else:
                        st.error(f"Fehler: {str(exc)}")
                except Exception as exc:
                    st.error(f"Fehler: {str(exc)[:150]}")

        else:
            results = get_results()
            criteria = criteria_store.load_criteria(run.source)
            out_df = build_output_df(df, results, criteria)

            keep_count = int((out_df["_decision"] == "keep").sum())
            reject_count = int((out_df["_decision"] == "reject").sum())
            unklar_count = int((out_df["_decision"] == "unklar").sum())

            col1, col2, col3 = st.columns(3)
            col1.markdown(metric_card(translate("keep"), keep_count, "#10b981"), unsafe_allow_html=True)
            col2.markdown(metric_card(translate("reject"), reject_count, "#ef4444"), unsafe_allow_html=True)
            col3.markdown(metric_card("Unklar", unklar_count, "#f59e0b"), unsafe_allow_html=True)

            # Unklar-Faelle brauchen eine menschliche Entscheidung, sonst fallen
            # sie stillschweigend aus dem Export.
            if unklar_count:
                st.markdown("---")
                st.markdown("### Manuelle Pruefung")
                st.markdown(
                    f'<div class="helper-text">{unklar_count} Leads konnten nicht eindeutig '
                    f'zugeordnet werden. Ohne Entscheidung landen sie <strong>nicht</strong> im Export.</div>',
                    unsafe_allow_html=True,
                )
                for idx in out_df.index[out_df["_decision"] == "unklar"]:
                    row = out_df.loc[idx]
                    label = row.get("name") or row.get("company") or f"Lead {idx}"
                    with st.expander(f"{label} — {row['_reason'][:80]}"):
                        c1, c2 = st.columns(2)
                        if c1.button("Behalten", key=f"unklar_keep_{run_id}_{idx}", use_container_width=True):
                            results[idx].decision = "keep"
                            save_results(run_id, [asdict(r) for r in results])
                            st.session_state[f"run_{run_id}_results"] = results
                            st.rerun()
                        if c2.button("Ablehnen", key=f"unklar_reject_{run_id}_{idx}", use_container_width=True):
                            results[idx].decision = "reject"
                            save_results(run_id, [asdict(r) for r in results])
                            st.session_state[f"run_{run_id}_results"] = results
                            st.rerun()

            st.markdown("---")
            st.markdown("### Ergebnisse")
            display_cols = [c for c in out_df.columns if not c.startswith("_")]
            st.dataframe(out_df[display_cols], use_container_width=True, height=350)

            if st.button("↻ Neu klassifizieren", key=f"reclassify_{run_id}"):
                st.session_state.pop(f"run_{run_id}_results", None)
                st.session_state.pop(f"run_{run_id}_enriched_df", None)
                st.rerun()

with tab3:
    st.markdown("## Enrichment")

    df, mapping = get_dataset()
    results = get_results()

    if df is None or results is None:
        st.info("Bitte zuerst **Scraping** und **Review & Filter** abschliessen.")
    else:
        criteria = criteria_store.load_criteria(run.source)
        out_df = build_output_df(df, results, criteria)
        keep_df = out_df[out_df["_decision"] == "keep"].copy()

        if len(keep_df) == 0:
            st.markdown("No leads to enrich (all rejected)")
        else:
            providers = get_providers()
            selected_provider = st.selectbox(
                "Enrichment Provider",
                providers,
                index=0,
                key="enrichment_provider_select",
                label_visibility="collapsed"
            )

            if st.button("→ Enrich", type="primary", use_container_width=True, key="modul3_enrich"):
                enriched_rows = []
                progress = st.progress(0.0, text="Enriching...")

                for idx, (_, row) in enumerate(keep_df.iterrows()):
                    name = row.get("name", "")
                    company = row.get("company", "")

                    if name and company:
                        enrichment_result = mock_enrich(name, company, selected_provider)
                        enriched_rows.append({
                            **row,
                            "email": enrichment_result.email,
                            "phone": enrichment_result.phone,
                            "enrichment_confidence": enrichment_result.confidence,
                            "enrichment_provider": enrichment_result.provider,
                        })
                    else:
                        enriched_rows.append(row)

                    progress.progress((idx + 1) / len(keep_df), text=f"{idx + 1}/{len(keep_df)}")

                st.session_state[f"run_{run_id}_enriched_df"] = pd.DataFrame(enriched_rows)
                st.rerun()

            if f"run_{run_id}_enriched_df" in st.session_state:
                enriched_df = st.session_state[f"run_{run_id}_enriched_df"]
                st.markdown("---")
                st.markdown("### Enriched Results")
                display_cols = [c for c in enriched_df.columns if not c.startswith("_")]
                st.dataframe(enriched_df[display_cols], use_container_width=True, height=350)

with tab4:
    st.markdown("## Export")

    df, mapping = get_dataset()
    results = get_results()

    if df is None or results is None:
        st.info("Bitte zuerst **Scraping** und **Review & Filter** abschliessen.")
    else:
        criteria = criteria_store.load_criteria(run.source)
        out_df = build_output_df(df, results, criteria)

        # Angereicherte Spalten zurueckspielen. Die Zeilenzahl kann abweichen,
        # wenn nach dem Enrichment neu klassifiziert wurde -- dann verwerfen.
        enriched_df = st.session_state.get(f"run_{run_id}_enriched_df")
        keep_ids = out_df.index[out_df["_decision"] == "keep"]
        if enriched_df is not None and len(enriched_df) == len(keep_ids):
            for col in ["email", "phone", "enrichment_confidence", "enrichment_provider"]:
                if col in enriched_df.columns:
                    out_df.loc[keep_ids, col] = enriched_df[col].values
        elif enriched_df is not None:
            st.warning("Klassifizierung hat sich nach dem Enrichment geaendert — bitte im Tab **Anreicherung** erneut anreichern.")

        keep_count = int((out_df["_decision"] == "keep").sum())
        reject_count = int((out_df["_decision"] == "reject").sum())
        unklar_count = int((out_df["_decision"] == "unklar").sum())

        col1, col2, col3 = st.columns(3)
        col1.markdown(metric_card(translate("keep"), keep_count, "#10b981"), unsafe_allow_html=True)
        col2.markdown(metric_card(translate("reject"), reject_count, "#ef4444"), unsafe_allow_html=True)
        col3.markdown(metric_card("Unklar", unklar_count, "#f59e0b"), unsafe_allow_html=True)

        if unklar_count:
            st.warning(f"{unklar_count} unklare Leads sind **nicht** im Export enthalten. Im Tab **Review & Filter** entscheiden.")

        st.markdown("---")
        st.markdown(f"### {translate('rating')}")
        col1, col2 = st.columns(2)
        with col1:
            rating = st.slider("Rating", 1, 5, run.rating or 3, key=f"rating_{run_id}", label_visibility="collapsed")
        with col2:
            models_used = list(run.classification_results.keys()) or ["Gemini"]
            best_model = st.selectbox("Bestes Modell", models_used, key=f"best_model_{run_id}", label_visibility="collapsed")

        feedback = st.text_area(
            "Feedback", value=run.feedback, key=f"feedback_{run_id}",
            height=80, placeholder="Notizen zu diesem Run...", label_visibility="collapsed",
        )

        if st.button(translate("save"), use_container_width=True, type="primary"):
            run.rating = rating
            run.feedback = feedback
            run.best_model = best_model
            run.status = "completed"
            save_run(run)
            st.success("Gespeichert — Run ist abgeschlossen.")

        st.markdown("---")
        st.markdown("### Download")

        # Standardmaessig nur qualifizierte Leads -- Rejects gehoeren nicht ins CRM.
        keep_only = st.checkbox("Nur qualifizierte Leads exportieren", value=True, key=f"keep_only_{run_id}")
        export_source = out_df[out_df["_decision"] == "keep"] if keep_only else out_df
        export_df = export_source[[c for c in out_df.columns if not c.startswith("_")]].copy()

        st.markdown(
            f'<div class="helper-text">{len(export_df)} Zeilen im Export.</div>',
            unsafe_allow_html=True,
        )

        st.download_button(
            translate("download_csv"),
            data=export_df.to_csv(index=False).encode("utf-8"),
            file_name=f"leads_{run_id}.csv",
            mime="text/csv",
            use_container_width=True,
            disabled=len(export_df) == 0,
        )
