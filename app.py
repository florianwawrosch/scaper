import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st
from core.runs import list_runs, load_run
from core.config import get_language, format_date, translate
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

# Header with language selector
col1, col2, col3 = st.columns([1, 1, 0.5])
with col3:
    st.session_state.language = st.selectbox(
        "Language",
        ["de", "en"],
        index=0 if st.session_state.language == "de" else 1,
        format_func=lambda x: "DE" if x == "de" else "EN",
        key="lang_selector"
    )

st.markdown("# Lead Pipeline")
st.markdown("_Scrape → Filter → Enrich → Export_")

col1, col2, col3 = st.columns([1, 1, 1])
with col3:
    if st.button(f"+ {translate('new_run')}", use_container_width=True, type="primary"):
        st.switch_page("pages/run_new.py")

st.markdown("---")

# Runs list
runs = list_runs()

if not runs:
    st.markdown("")
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown(f"""
        <div style="text-align: center; padding: 3rem 1rem;">
            <p style="color: #6b7280; font-size: 1rem; margin: 0;">{translate('no_runs')}</p>
            <p style="color: #9ca3af; font-size: 0.9rem; margin-top: 0.5rem;">Klicke oben auf "+ {translate('new_run')}" um zu starten</p>
        </div>
        """, unsafe_allow_html=True)
else:
    st.markdown(f"## {translate('last_runs')}")

    for i, run in enumerate(runs[:10]):
        status_icons = {
            "draft": "📝",
            "scraping": "🔄",
            "dataset_ready": "📦",
            "in_progress": "⚙️",
            "completed": "✅",
            "failed": "❌",
        }
        status_icon = status_icons.get(run.status, "❓")

        col1, col2, col3, col4 = st.columns([2.5, 1, 1, 1.5])

        with col1:
            created_date = format_date(run.created_at, "short")
            st.markdown(f"""
            <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                    <span>{status_icon}</span>
                    <span style="font-weight: 600; font-size: 0.95rem;">{run.id}</span>
                </div>
                <div style="color: #6b7280; font-size: 0.85rem;">
                    {run.source.replace('_', ' ').title()} • {created_date}
                </div>
            </div>
            """, unsafe_allow_html=True)

        with col2:
            if run.classification_results:
                klassifiziert = run.classification_results
                keep = sum(r.get("keep", 0) for r in klassifiziert.values())
                st.markdown(f"""
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: 600; color: #10b981;">{keep}</div>
                    <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.2rem;">{translate('keep')}</div>
                </div>
                """, unsafe_allow_html=True)

        with col3:
            if run.rating:
                stars = "★" * run.rating + "☆" * (5 - run.rating)
                st.markdown(f"""
                <div style="text-align: center;">
                    <div style="font-size: 0.9rem; letter-spacing: 2px;">{stars}</div>
                    <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.2rem;">{run.rating}/5</div>
                </div>
                """, unsafe_allow_html=True)

        with col4:
            if st.button("View", key=f"run_{run.id}", use_container_width=True):
                st.session_state["view_run_id"] = run.id
                st.switch_page("pages/run_history_detail.py")

        if i < len(runs) - 1 and i < 9:
            st.divider()
