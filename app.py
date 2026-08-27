import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
import streamlit as st
from core.runs import list_runs, create_run
from core.config import format_date, translate
from core.ui import apply_global_styles, metric_card
from core.loaders import load_table
from core.schema import CANONICAL_FIELDS, guess_mapping

st.set_page_config(page_title="Lead Pipeline", page_icon="📊", layout="wide", initial_sidebar_state="collapsed")

if "language" not in st.session_state:
    st.session_state.language = "de"

apply_global_styles()

# ── Header ─────────────────────────────────────────────────────
h1, h2 = st.columns([5, 1])
with h1:
    st.markdown("# Lead Pipeline")
with h2:
    st.session_state.language = st.selectbox(
        "Lang", ["de", "en"], index=0 if st.session_state.language == "de" else 1,
        format_func=lambda x: "DE" if x == "de" else "EN",
        key="lang", label_visibility="collapsed",
    )

# ── New Run (compact) ──────────────────────────────────────────
st.markdown("---")

source_options = {
    "phantombuster_linkedin": "PhantomBuster (LinkedIn)",
    "meta_ads_library": "Meta Ads Library (coming soon)",
    "job_portal": "Job Portal Scraper (coming soon)",
}

c1, c2 = st.columns([2, 3])
with c1:
    selected_source = st.selectbox(
        "Datenquelle", list(source_options.keys()),
        format_func=lambda k: source_options[k],
        key="source_select",
    )

# Conditional UI based on source
with c2:
    if selected_source == "phantombuster_linkedin":
        uploaded = st.file_uploader(
            "CSV / XLSX hochladen", type=["csv", "xlsx", "xls"],
            key="home_uploader", label_visibility="collapsed",
        )
    elif selected_source == "meta_ads_library":
        st.markdown('<div class="helper-text" style="margin-top:0.5rem;">Meta Ads Library Scraper ist noch in Entwicklung.</div>', unsafe_allow_html=True)
        uploaded = None
    else:
        st.markdown('<div class="helper-text" style="margin-top:0.5rem;">Job Portal Scraper ist noch in Entwicklung.</div>', unsafe_allow_html=True)
        uploaded = None

# Show preview + mapping + start button if file uploaded
if selected_source == "phantombuster_linkedin" and uploaded:
    df = load_table(uploaded)
    if df is not None:
        st.markdown(f'<div class="helper-text" style="margin-top:0.5rem;">{len(df)} Zeilen &middot; {len(df.columns)} Spalten</div>', unsafe_allow_html=True)

        with st.expander("Spaltenzuordnung & Vorschau", expanded=False):
            mapping = guess_mapping(list(df.columns), selected_source)
            cols = st.columns(len(CANONICAL_FIELDS))
            new_mapping = {}
            options = [""] + list(df.columns)
            for col, field in zip(cols, CANONICAL_FIELDS):
                with col:
                    current = mapping.get(field, "")
                    idx = options.index(current) if current in options else 0
                    new_mapping[field] = st.selectbox(field, options=options, index=idx, key=f"hmap_{field}")

            st.dataframe(df.head(5), use_container_width=True, height=200)

        if st.button("Run starten", type="primary", use_container_width=False, key="start_run"):
            from core.runs import save_raw_dataset, save_raw_mapping, save_run
            run = create_run(selected_source)
            raw_data = df.to_dict(orient="records")
            run.raw_dataset_file = save_raw_dataset(run.id, raw_data)
            run.raw_mapping_file = save_raw_mapping(run.id, new_mapping)
            run.status = "dataset_ready"
            save_run(run)
            st.session_state[f"run_{run.id}_df"] = df
            st.session_state[f"run_{run.id}_mapping"] = new_mapping
            st.session_state["current_run_id"] = run.id
            st.switch_page("pages/run_active.py")

# Test data shortcut
if selected_source == "phantombuster_linkedin" and not uploaded:
    if st.button("Mit Testdaten starten", key="test_data_btn"):
        from core.runs import save_raw_dataset, save_raw_mapping, save_run
        test_df = pd.DataFrame({
            "fullName": ["John Coach", "Sarah Fitness", "Mike Tech", "Emma Manifestation", "David B2B"],
            "companyName": ["High Ticket Academy", "Fit Pro Coaching", "Tech Startup Hub", "Manifestation Coaching", "Corporate Solutions"],
            "personalWebsite": ["https://highticket.com", "https://fitpro.de", "", "https://manifest.de", "https://b2bsolutions.de"],
            "linkedinHeadline": ["Business Coach", "Fitness Coach", "Tech Consultant", "Life Coach", "Business Development"],
            "linkedinDescription": ["I help entrepreneurs scale", "Personal training", "Building tech solutions", "Manifest your dreams", "Corporate strategy"],
        })
        mapping = guess_mapping(list(test_df.columns), selected_source)
        run = create_run(selected_source)
        run.raw_dataset_file = save_raw_dataset(run.id, test_df.to_dict(orient="records"))
        run.raw_mapping_file = save_raw_mapping(run.id, mapping)
        run.status = "dataset_ready"
        save_run(run)
        st.session_state[f"run_{run.id}_df"] = test_df
        st.session_state[f"run_{run.id}_mapping"] = mapping
        st.session_state["current_run_id"] = run.id
        st.switch_page("pages/run_active.py")

# ── Run History (compact table) ────────────────────────────────
runs = list_runs()
if runs:
    st.markdown("---")
    st.markdown("### Letzte Runs")

    # Build table data
    table_data = []
    for run in runs[:15]:
        status_map = {
            "draft": "Entwurf", "scraping": "Scraping", "dataset_ready": "Bereit",
            "in_progress": "In Bearbeitung", "completed": "Abgeschlossen",
        }
        keep = ""
        if run.classification_results:
            k = sum(r.get("keep", 0) for r in run.classification_results.values())
            keep = str(k)

        rating_str = ""
        if run.rating:
            rating_str = f"{'★' * run.rating}{'☆' * (5 - run.rating)}"

        table_data.append({
            "Status": status_map.get(run.status, run.status),
            "Quelle": run.source.replace("_", " ").title(),
            "Datum": format_date(run.created_at, "short"),
            "Behalten": keep,
            "Rating": rating_str,
            "_id": run.id,
            "_status": run.status,
        })

    # Render compact rows
    for i, row in enumerate(table_data):
        cols = st.columns([1.2, 1.5, 1, 0.8, 1, 1])

        with cols[0]:
            st.markdown(f'<div style="font-size:0.82rem;color:#6b7280;padding-top:0.4rem;">{row["Status"]}</div>', unsafe_allow_html=True)
        with cols[1]:
            st.markdown(f'<div style="font-size:0.82rem;padding-top:0.4rem;">{row["Quelle"]}</div>', unsafe_allow_html=True)
        with cols[2]:
            st.markdown(f'<div style="font-size:0.82rem;color:#6b7280;padding-top:0.4rem;">{row["Datum"]}</div>', unsafe_allow_html=True)
        with cols[3]:
            if row["Behalten"]:
                st.markdown(f'<div style="font-size:0.82rem;color:#10b981;font-weight:600;padding-top:0.4rem;">{row["Behalten"]}</div>', unsafe_allow_html=True)
        with cols[4]:
            if row["Rating"]:
                st.markdown(f'<div style="font-size:0.75rem;color:#f59e0b;padding-top:0.4rem;">{row["Rating"]}</div>', unsafe_allow_html=True)
        with cols[5]:
            if row["_status"] == "completed":
                if st.button("Details", key=f"r_{row['_id']}", use_container_width=True):
                    st.session_state["view_run_id"] = row["_id"]
                    st.switch_page("pages/run_history_detail.py")
            elif row["_status"] in ("dataset_ready", "in_progress"):
                if st.button("Fortsetzen", key=f"r_{row['_id']}", use_container_width=True, type="primary"):
                    st.session_state["current_run_id"] = row["_id"]
                    st.switch_page("pages/run_active.py")
