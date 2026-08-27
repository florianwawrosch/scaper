import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from core.runs import load_run, create_run

st.set_page_config(page_title="Run History", page_icon="📊", layout="wide", initial_sidebar_state="collapsed")

st.markdown("""
<style>
    [data-testid="stMainBlockContainer"] {
        padding-top: 1.5rem;
    }
    h1 {
        font-size: 2rem !important;
        font-weight: 600 !important;
        letter-spacing: -0.01em !important;
        margin-bottom: 0.25rem !important;
    }
    .header-info {
        color: #6b7280;
        font-size: 0.95rem !important;
        margin-bottom: 1.5rem !important;
    }
</style>
""", unsafe_allow_html=True)

run_id = st.session_state.get("view_run_id")
if not run_id:
    st.error("No run selected")
    st.stop()

run = load_run(run_id)
if not run:
    st.error(f"Run {run_id} not found")
    st.stop()

st.markdown(f"# {run_id}")
st.markdown(f'<div class="header-info">{run.source.replace("_", " ").title()} • Status: {run.status} • {run.created_at[:10]}</div>', unsafe_allow_html=True)

col1, col2, col3 = st.columns([1, 1, 2])
with col1:
    if st.button("← Back", use_container_width=True):
        st.switch_page("app.py")

with col2:
    if st.button("Duplicate Run", use_container_width=True, type="primary"):
        new_run = create_run(run.source)
        st.session_state["current_run_id"] = new_run.id
        st.success(f"Run {new_run.id} created")
        st.switch_page("pages/run_active.py")

st.markdown("---")

st.markdown("### Summary")
col1, col2, col3 = st.columns(3)
with col1:
    st.markdown(f"**Status**\n{run.status}")
with col2:
    if run.rating:
        st.markdown(f"**Rating**\n{'⭐ ' * run.rating}")
    else:
        st.markdown("**Rating**\nNot rated")
with col3:
    if run.best_model:
        st.markdown(f"**Best Model**\n{run.best_model}")

if run.classification_results:
    st.markdown("---")
    st.markdown("### Results")
    for model, results in run.classification_results.items():
        st.markdown(f"**{model}:** {results.get('keep', 0)} Keep • {results.get('reject', 0)} Reject")

if run.feedback:
    st.markdown("---")
    st.markdown("### Feedback")
    st.markdown(f"_{run.feedback}_")
