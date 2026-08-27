import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from core.runs import load_run, create_run
from core.config import format_date, translate
from core.ui import apply_global_styles, status_badge, metric_card, section_header

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

st.markdown(f"""
<div class="app-header">
    <div class="tag-label">Run Detail · {run.source.replace("_", " ").title()}</div>
    <h1 style="font-family:'Cormorant Garamond',serif!important;font-weight:300!important;font-size:clamp(24px,3.5vw,36px)!important;color:var(--ink)!important;margin:0 0 8px!important;">{run_id}</h1>
    <div style="display:flex;align-items:center;gap:16px;">
        <span class="num" style="font-size:12px;color:var(--ink-faint)!important;">{created_date}</span>
        {status_badge(run.status)}
    </div>
</div>
""", unsafe_allow_html=True)

has_raw_dataset = bool(run.raw_dataset_file)

col1, col2, col3 = st.columns([1, 1.5, 1.5])
with col1:
    if st.button("← Zurück", use_container_width=True):
        st.switch_page("app.py")

with col2:
    if has_raw_dataset:
        if st.button("↻ Neu filtern", use_container_width=True, type="primary"):
            st.session_state["current_run_id"] = run.id
            st.switch_page("pages/run_active.py")

with col3:
    if st.button("Duplikat erstellen", use_container_width=True):
        new_run = create_run(run.source)
        st.session_state["current_run_id"] = new_run.id
        st.switch_page("pages/run_active.py")

if has_raw_dataset:
    st.markdown(
        '<div class="callout">'
        '<div class="callout-title">Info</div>'
        '<p><b>Neu filtern</b> nutzt den bereits gescrapten Datensatz mit anderen Filtereinstellungen. '
        '<b>Duplikat</b> startet einen komplett neuen Scrape.</p></div>',
        unsafe_allow_html=True,
    )

st.markdown("---")
st.markdown(section_header("01", "Zusammenfassung"), unsafe_allow_html=True)

if run.classification_results:
    kpi_html = '<div class="kpi-grid">'
    for model, results in run.classification_results.items():
        kpi_html += metric_card(f"{model} — Keep", results.get("keep", 0), "good")
        kpi_html += metric_card(f"{model} — Reject", results.get("reject", 0), "bad")
        if results.get("unklar", 0):
            kpi_html += metric_card(f"{model} — Unklar", results.get("unklar", 0), "warn")
    kpi_html += '</div>'
    st.markdown(kpi_html, unsafe_allow_html=True)

col1, col2 = st.columns(2)
with col1:
    if run.rating:
        stars = "★" * run.rating + "☆" * (5 - run.rating)
        st.markdown(
            f'<div class="panel-2" style="padding:16px 18px;">'
            f'<div style="font-family:JetBrains Mono,monospace!important;font-size:9.5px!important;letter-spacing:0.2em!important;text-transform:uppercase!important;color:var(--ink-faint)!important;margin-bottom:8px!important;">{translate("rating")}</div>'
            f'<div style="font-size:1.2rem;color:var(--gold)!important;letter-spacing:3px;">{stars}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
with col2:
    if run.best_model:
        st.markdown(
            f'<div class="panel-2" style="padding:16px 18px;">'
            f'<div style="font-family:JetBrains Mono,monospace!important;font-size:9.5px!important;letter-spacing:0.2em!important;text-transform:uppercase!important;color:var(--ink-faint)!important;margin-bottom:8px!important;">{translate("best_model")}</div>'
            f'<div style="font-size:14px;color:var(--ink)!important;font-weight:500;">{run.best_model}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

if run.feedback:
    st.markdown("---")
    st.markdown(
        f'<div class="callout">'
        f'<div class="callout-title">{translate("feedback")}</div>'
        f'<p>{run.feedback}</p></div>',
        unsafe_allow_html=True,
    )
