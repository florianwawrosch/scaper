import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st
from core.runs import list_runs, load_run

st.set_page_config(
    page_title="Lead Pipeline",
    page_icon="✨",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
<style>
    [data-testid="stMainBlockContainer"] {
        padding-top: 2rem;
    }
    h1 {
        font-size: 2rem !important;
        font-weight: 600 !important;
        letter-spacing: -0.01em !important;
    }
    h2 {
        font-size: 1.3rem !important;
        font-weight: 600 !important;
        margin-top: 2rem !important;
        margin-bottom: 1rem !important;
    }
    .stButton > button {
        border-radius: 6px !important;
        height: 40px !important;
        font-weight: 500 !important;
    }
</style>
""", unsafe_allow_html=True)

# Header
st.markdown("# ✨ Lead Pipeline")
st.markdown("_Scrape • Klassifiziere • Exportiere_")

col1, col2, col3 = st.columns([1, 1, 1])
with col3:
    if st.button("+ Neuer Run", use_container_width=True, type="primary"):
        st.switch_page("pages/3_Neuer_Run.py")

st.markdown("---")

# Runs list
runs = list_runs()

if not runs:
    st.markdown("")
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown("""
        <div style="text-align: center; padding: 3rem 1rem;">
            <p style="color: #6b7280; font-size: 1rem; margin: 0;">Noch keine Runs erstellt</p>
            <p style="color: #9ca3af; font-size: 0.9rem; margin-top: 0.5rem;">Klicke oben auf "+ Neuer Run" um zu starten</p>
        </div>
        """, unsafe_allow_html=True)
else:
    st.markdown("## Letzte Runs")

    for i, run in enumerate(runs[:10]):
        status_icon = {
            "in_progress": "🔄",
            "completed": "✅",
            "failed": "❌",
        }.get(run.status, "❓")

        col1, col2, col3, col4 = st.columns([2.5, 1, 1, 1.5])

        with col1:
            st.markdown(f"""
            <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                    <span>{status_icon}</span>
                    <span style="font-weight: 600; font-size: 0.95rem;">{run.id}</span>
                </div>
                <div style="color: #6b7280; font-size: 0.85rem;">
                    {run.source.replace('_', ' ').title()} • {run.created_at[:10]}
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
                    <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.2rem;">behalten</div>
                </div>
                """, unsafe_allow_html=True)

        with col3:
            if run.rating:
                stars = "⭐ " * run.rating
                st.markdown(f"""
                <div style="text-align: center;">
                    <div style="font-size: 0.9rem;">{stars}</div>
                    <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.2rem;">{run.rating}/5</div>
                </div>
                """, unsafe_allow_html=True)

        with col4:
            if st.button("Öffnen", key=f"run_{run.id}", use_container_width=True):
                st.session_state["current_run_id"] = run.id
                st.switch_page("pages/4_Run_Detail.py")

        if i < len(runs) - 1 and i < 9:
            st.divider()
