import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import streamlit as st
from core.runs import load_run, save_run, save_raw_dataset, load_raw_dataset, save_raw_mapping, load_raw_mapping
from core.loaders import load_table, rows_from_df
from core.schema import CANONICAL_FIELDS, guess_mapping, rows_to_leads
from core.gemini_classifier import classify_batch
from core.close_export import to_close_columns
from core.enrichment import mock_enrich, get_providers
from core.scraping_config import get_source_config
from core.config import format_date, translate
from core.ui import apply_global_styles
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

    # Load raw dataset if not in session state
    if f"run_{run_id}_df" not in st.session_state:
        raw_data = load_raw_dataset(run_id)
        if raw_data:
            df = pd.DataFrame(raw_data)
            st.session_state[f"run_{run_id}_df"] = df
        else:
            df = None
    else:
        df = st.session_state[f"run_{run_id}_df"]

    # Load mapping if not in session state
    if f"run_{run_id}_mapping" not in st.session_state:
        mapping = load_raw_mapping(run_id)
        if mapping:
            st.session_state[f"run_{run_id}_mapping"] = mapping
    else:
        mapping = st.session_state[f"run_{run_id}_mapping"]

    if df is None or mapping is None:
        st.markdown("👈 Upload data in **Scraping** tab first")
    else:

        if f"run_{run_id}_results" not in st.session_state:
            st.markdown("### Classify")
            col1, col2 = st.columns(2)
            with col1:
                models = st.multiselect(
                    "AI Models",
                    ["Gemini", "ChatGPT (OpenAI)", "Claude (Anthropic)"],
                    default=["Gemini"],
                    key="models_select",
                    label_visibility="collapsed"
                )
            with col2:
                st.markdown("")
                st.markdown("_Ready to classify_")

            if st.button("→ Classify", type="primary", use_container_width=True, key="modul2_classify"):
                rows = rows_from_df(df)
                leads = rows_to_leads(rows, mapping)
                criteria = criteria_store.load_criteria(run.source)

                progress = st.progress(0.0, text="Running...")
                def on_progress(done, total):
                    progress.progress(done / total, text=f"{done}/{total}")

                try:
                    results = classify_batch(leads, criteria, progress_callback=on_progress)

                    keep_count = sum(1 for r in results if r.decision == "keep")
                    reject_count = sum(1 for r in results if r.decision == "reject")
                    unklar_count = sum(1 for r in results if r.decision == "unklar")

                    for model in models:
                        run.classification_results[model] = {
                            "keep": keep_count,
                            "reject": reject_count,
                            "unklar": unklar_count,
                        }

                    st.session_state[f"run_{run_id}_results"] = results
                    save_run(run)
                    st.rerun()

                except RuntimeError as exc:
                    if "GEMINI_API_KEY" in str(exc):
                        st.error("Error: GEMINI_API_KEY not set")
                    else:
                        st.error(f"Error: {str(exc)}")
                except Exception as exc:
                    st.error(f"Error: {str(exc)[:150]}")

        else:
            results = st.session_state[f"run_{run_id}_results"]
            rows = rows_from_df(df)
            criteria = criteria_store.load_criteria(run.source)

            out_rows = []
            for row, result in zip(rows, results):
                out_rows.append({
                    **row,
                    **to_close_columns(result, criteria),
                    "_decision": result.decision,
                    "_reason": result.reason,
                })
            out_df = pd.DataFrame(out_rows)

            keep_count = (out_df["_decision"] == "keep").sum()
            reject_count = (out_df["_decision"] == "reject").sum()

            col1, col2, col3 = st.columns(3)
            col1.markdown(f"<div style='text-align: center;'><div style='font-size: 1.5rem; font-weight: 600; color: #10b981;'>{int(keep_count)}</div><div style='font-size: 0.85rem; color: #6b7280;'>Keep</div></div>", unsafe_allow_html=True)
            col2.markdown(f"<div style='text-align: center;'><div style='font-size: 1.5rem; font-weight: 600; color: #ef4444;'>{int(reject_count)}</div><div style='font-size: 0.85rem; color: #6b7280;'>Reject</div></div>", unsafe_allow_html=True)

            st.markdown("---")
            st.markdown("### Results")
            display_cols = [c for c in out_df.columns if not c.startswith("_")]
            st.dataframe(out_df[display_cols], use_container_width=True, height=350)

with tab3:
    st.markdown("## Enrichment")

    # Load data if needed
    if f"run_{run_id}_df" not in st.session_state:
        raw_data = load_raw_dataset(run_id)
        if raw_data:
            df = pd.DataFrame(raw_data)
            st.session_state[f"run_{run_id}_df"] = df
        else:
            df = None
    else:
        df = st.session_state[f"run_{run_id}_df"]

    if f"run_{run_id}_mapping" not in st.session_state:
        mapping = load_raw_mapping(run_id)
        if mapping:
            st.session_state[f"run_{run_id}_mapping"] = mapping
    else:
        mapping = st.session_state[f"run_{run_id}_mapping"]

    if f"run_{run_id}_df" not in st.session_state or f"run_{run_id}_results" not in st.session_state:
        st.markdown("👈 Complete **Scraping** and **Review & Filter** tabs first")
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
            })
        out_df = pd.DataFrame(out_rows)

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

    # Load data if needed
    if f"run_{run_id}_df" not in st.session_state:
        raw_data = load_raw_dataset(run_id)
        if raw_data:
            df = pd.DataFrame(raw_data)
            st.session_state[f"run_{run_id}_df"] = df
        else:
            df = None
    else:
        df = st.session_state[f"run_{run_id}_df"]

    if f"run_{run_id}_mapping" not in st.session_state:
        mapping = load_raw_mapping(run_id)
        if mapping:
            st.session_state[f"run_{run_id}_mapping"] = mapping
    else:
        mapping = st.session_state[f"run_{run_id}_mapping"]

    if f"run_{run_id}_results" not in st.session_state or f"run_{run_id}_df" not in st.session_state:
        st.markdown("👈 Complete **Scraping** and **Review & Filter** tabs first")
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
            })
        out_df = pd.DataFrame(out_rows)

        # Use enriched data if available
        if f"run_{run_id}_enriched_df" in st.session_state:
            enriched_df = st.session_state[f"run_{run_id}_enriched_df"]
            # Merge enriched data back to full dataframe
            keep_ids = out_df[out_df["_decision"] == "keep"].index
            for col in ["email", "phone", "enrichment_confidence", "enrichment_provider"]:
                if col in enriched_df.columns:
                    out_df.loc[keep_ids, col] = enriched_df[col].values

        keep_count = (out_df["_decision"] == "keep").sum()
        reject_count = (out_df["_decision"] == "reject").sum()

        col1, col2, col3 = st.columns(3)
        col1.markdown(f"<div style='text-align: center;'><div style='font-size: 1.5rem; font-weight: 600; color: #10b981;'>{int(keep_count)}</div><div style='font-size: 0.85rem; color: #6b7280;'>Keep</div></div>", unsafe_allow_html=True)
        col2.markdown(f"<div style='text-align: center;'><div style='font-size: 1.5rem; font-weight: 600; color: #ef4444;'>{int(reject_count)}</div><div style='font-size: 0.85rem; color: #6b7280;'>Reject</div></div>", unsafe_allow_html=True)

        st.markdown("---")
        st.markdown("### Rating")
        col1, col2 = st.columns(2)
        with col1:
            rating = st.slider("Rating", 1, 5, run.rating if run.rating else 3, key="rating_slider", label_visibility="collapsed")
        with col2:
            best_model = st.selectbox("Best Model", ["Gemini", "ChatGPT", "Claude"], key="best_model_select", index=0, label_visibility="collapsed")

        feedback = st.text_area("Feedback", value=run.feedback, key="feedback_area", height=80, placeholder="Your notes...", label_visibility="collapsed")

        if st.button("Save", use_container_width=True, type="primary"):
            run.rating = rating
            run.feedback = feedback
            run.best_model = best_model
            run.status = "completed"
            save_run(run)
            st.success("Saved!")

        st.markdown("---")
        st.markdown("### Download")
        export_df = out_df[[c for c in out_df.columns if not c.startswith("_")]].copy()
        csv_data = export_df.to_csv(index=False).encode("utf-8")

        st.download_button(
            "Download CSV",
            data=csv_data,
            file_name=f"leads_{run_id}.csv",
            mime="text/csv",
            use_container_width=True
        )
