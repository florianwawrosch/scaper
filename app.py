import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st
from core.runs import list_runs, load_run, create_run
from core.config import format_date, translate
from core.ui import apply_global_styles, status_badge

st.set_page_config(
    page_title="Lead Pipeline",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Initialize language
if "language" not in st.session_state:
    st.session_state.language = "de"

apply_global_styles()

# ── Header ─────────────────────────────────────────────────────
head_l, head_r = st.columns([4, 1])
with head_l:
    st.markdown("# Lead Pipeline")
    st.markdown('<div class="subtitle">Scrape &rarr; Filter &rarr; Enrich &rarr; Export</div>', unsafe_allow_html=True)
with head_r:
    st.session_state.language = st.selectbox(
        "Sprache", ["de", "en"],
        index=0 if st.session_state.language == "de" else 1,
        format_func=lambda x: "Deutsch" if x == "de" else "English",
        key="lang_selector",
        label_visibility="collapsed",
    )

# ── New Run ────────────────────────────────────────────────────
st.markdown("---")

# If there's an active run waiting, go straight there
if st.session_state.get("current_run_id"):
    st.switch_page("pages/run_active.py")

st.markdown("## Neuen Run starten")
st.markdown('<div class="helper-text">Wähle eine Datenquelle, um einen neuen Run zu starten.</div>', unsafe_allow_html=True)

col1, col2, col3 = st.columns(3, gap="medium")

sources = [
    ("meta_ads_library", "Meta Ads Library",
     "Scrape aktive Werbung aus der Meta Ads Library.",
     "Keywords, Länder, Filter • Meta API Token nötig"),
    ("phantombuster_linkedin", "PhantomBuster Upload",
     "LinkedIn-Profile aus PhantomBuster-Export importieren.",
     "CSV / XLSX • Spalten werden automatisch erkannt"),
    ("job_portal", "Job Portal Scraper",
     "Job-Inserate von LinkedIn, Indeed oder Xing scrapen.",
     "Portal, Keywords, Region • In Entwicklung"),
]

for col, (source_key, name, desc, details) in zip([col1, col2, col3], sources):
    with col:
        st.markdown(f"""
        <div class="source-card">
            <h4>{name}</h4>
            <p>{desc}</p>
            <p style="margin-top: 0.75rem; font-size: 0.8rem; color: #9ca3af;">{details}</p>
        </div>
        """, unsafe_allow_html=True)

        disabled = source_key in ("meta_ads_library", "job_portal")
        label = "Bald verfügbar" if disabled else "Start"
        if st.button(label, key=f"btn_{source_key}", use_container_width=True,
                     type="primary" if not disabled else "secondary",
                     disabled=disabled):
            run = create_run(source_key)
            st.session_state["current_run_id"] = run.id
            st.switch_page("pages/run_active.py")

# ── Run History ────────────────────────────────────────────────
runs = list_runs()
if runs:
    st.markdown("---")
    st.markdown(f"## {translate('last_runs')}")

    for i, run in enumerate(runs[:10]):
        cols = st.columns([0.3, 3, 1, 1, 1])

        status_icons = {
            "draft": "📝", "scraping": "🔄", "dataset_ready": "📦",
            "in_progress": "⚙️", "completed": "✅", "failed": "❌",
        }

        with cols[0]:
            st.markdown(f"<div style='font-size: 1.2rem; margin-top: 0.5rem;'>{status_icons.get(run.status, '❓')}</div>", unsafe_allow_html=True)

        with cols[1]:
            created_date = format_date(run.created_at, "short")
            source_label = run.source.replace("_", " ").title()
            st.markdown(f"""
            <div class="run-row">
                <div>
                    <div class="run-title">{run.id}</div>
                    <div class="run-meta">{source_label} &middot; {created_date}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)

        with cols[2]:
            if run.classification_results:
                keep = sum(r.get("keep", 0) for r in run.classification_results.values())
                st.markdown(f"""
                <div style="text-align: center; padding-top: 0.5rem;">
                    <div style="font-size: 1.1rem; font-weight: 700; color: #10b981;">{keep}</div>
                    <div style="font-size: 0.75rem; color: #6b7280;">{translate("keep")}</div>
                </div>
                """, unsafe_allow_html=True)

        with cols[3]:
            if run.rating:
                stars = "★" * run.rating + "☆" * (5 - run.rating)
                st.markdown(f"""
                <div style="text-align: center; padding-top: 0.5rem;">
                    <div style="font-size: 0.85rem; letter-spacing: 1px; color: #f59e0b;">{stars}</div>
                    <div style="font-size: 0.75rem; color: #6b7280;">{run.rating}/5</div>
                </div>
                """, unsafe_allow_html=True)

        with cols[4]:
            if run.status == "completed":
                if st.button("Details", key=f"run_{run.id}", use_container_width=True):
                    st.session_state["view_run_id"] = run.id
                    st.switch_page("pages/run_history_detail.py")
            elif run.status in ("dataset_ready", "in_progress"):
                if st.button("Fortsetzen", key=f"run_{run.id}", use_container_width=True, type="primary"):
                    st.session_state["current_run_id"] = run.id
                    st.switch_page("pages/run_active.py")

        if i < len(runs) - 1 and i < 9:
            st.markdown('<div style="border-top: 1px solid #f3f4f6;"></div>', unsafe_allow_html=True)
