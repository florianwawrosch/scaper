import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from core.runs import load_run, create_run
from core.config import format_date, translate
from core.ui import apply_global_styles, status_badge

st.set_page_config(page_title="Run History", page_icon="📊", layout="wide", initial_sidebar_state="collapsed")

apply_global_styles()

run_id = st.session_state.get("view_run_id")
if not run_id:
    st.error("No run selected")
    st.stop()

run = load_run(run_id)
if not run:
    st.error(f"Run {run_id} not found")
    st.stop()

created_date = format_date(run.created_at, "short")
st.markdown(f"# {run_id}")
st.markdown(
    f'<div style="color: #6b7280; font-size: 0.95rem; margin-bottom: 1.5rem;">'
    f'{run.source.replace("_", " ").title()} • {created_date} • {status_badge(run.status)}'
    f'</div>',
    unsafe_allow_html=True
)

has_raw_dataset = bool(run.raw_dataset_file)

col1, col2, col3 = st.columns([1, 1.5, 1.5])
with col1:
    if st.button("← Back", use_container_width=True):
        st.switch_page("app.py")

with col2:
    if has_raw_dataset:
        if st.button("↻ Neu filtern (gleicher Datensatz)", use_container_width=True, type="primary"):
            st.session_state["current_run_id"] = run.id
            st.switch_page("pages/run_active.py")

with col3:
    if st.button("Neu scrapen (Duplikat)", use_container_width=True):
        new_run = create_run(run.source)
        st.session_state["current_run_id"] = new_run.id
        st.success(f"Run {new_run.id} created")
        st.switch_page("pages/run_active.py")

if has_raw_dataset:
    st.markdown(
        '<div class="helper-text">💡 "Neu filtern" nutzt den bereits gescrapten Datensatz erneut mit anderen Filtereinstellungen. '
        '"Neu scrapen" startet einen komplett neuen Scrape.</div>',
        unsafe_allow_html=True
    )

st.markdown("---")

st.markdown("### Summary")
col1, col2, col3 = st.columns(3)
with col1:
    st.markdown(f"**Status**")
    st.markdown(status_badge(run.status), unsafe_allow_html=True)
with col2:
    if run.rating:
        stars = "★" * run.rating + "☆" * (5 - run.rating)
        st.markdown(f"**{translate('rating')}**")
        st.markdown(f'<span style="letter-spacing: 2px; font-size: 1.1rem;">{stars}</span>', unsafe_allow_html=True)
    else:
        st.markdown(f"**{translate('rating')}**")
        st.markdown("_Not rated_")
with col3:
    if run.best_model:
        st.markdown(f"**{translate('best_model')}**")
        st.markdown(run.best_model)

if run.classification_results:
    st.markdown("---")
    st.markdown("### Results")
    for model, results in run.classification_results.items():
        st.markdown(f"**{model}:** {results.get('keep', 0)} {translate('keep')} • {results.get('reject', 0)} {translate('reject')}")

if run.feedback:
    st.markdown("---")
    st.markdown(f"### {translate('feedback')}")
    st.markdown(f"_{run.feedback}_")
