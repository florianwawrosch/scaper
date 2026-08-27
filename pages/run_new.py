import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from core.runs import create_run
from core.ui import apply_global_styles
from core.config import translate

st.set_page_config(page_title="New Run", page_icon="📊", layout="wide", initial_sidebar_state="collapsed")

apply_global_styles()

st.markdown(f"# {translate('new_run')}")
st.markdown("_Wähle eine Datenquelle aus_")
st.markdown("---")

col1, col2 = st.columns(2, gap="large")

with col1:
    st.markdown("""
    <div style="padding: 2rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; transition: all 0.2s ease; cursor: pointer;">
        <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.75rem; color: #111;">Meta Ads Library</div>
        <div style="color: #6b7280; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
            Scrape active ads from Meta Ads Library.
            <br/><br/>
            <strong style="color: #374151;">Settings:</strong> Keywords, Countries, Filters<br/>
            <strong style="color: #374151;">Status:</strong> Background + Live Logging<br/>
            <strong style="color: #374151;">Requires:</strong> Meta API Token
        </div>
    </div>
    """, unsafe_allow_html=True)

    if st.button("Start", key="btn_meta", use_container_width=True, type="primary"):
        run = create_run("meta_ads_library")
        st.session_state["current_run_id"] = run.id
        st.switch_page("pages/run_active.py")

with col2:
    st.markdown("""
    <div style="padding: 2rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; transition: all 0.2s ease; cursor: pointer;">
        <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.75rem; color: #111;">PhantomBuster Upload</div>
        <div style="color: #6b7280; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
            Import PhantomBuster export (LinkedIn profiles).
            <br/><br/>
            <strong style="color: #374151;">Format:</strong> CSV or XLSX<br/>
            <strong style="color: #374151;">Columns:</strong> Auto-detected<br/>
            <strong style="color: #374151;">Preview:</strong> Mapping before import
        </div>
    </div>
    """, unsafe_allow_html=True)

    if st.button("Start", key="btn_pb", use_container_width=True, type="primary"):
        run = create_run("phantombuster_linkedin")
        st.session_state["current_run_id"] = run.id
        st.switch_page("pages/run_active.py")
