import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from core.runs import create_run

st.set_page_config(page_title="Neuer Run", page_icon="✨", layout="wide", initial_sidebar_state="collapsed")

st.markdown("# ✨ Neuer Run")
st.markdown("_Wähle eine Datenquelle aus_")
st.markdown("---")

col1, col2 = st.columns(2, gap="large")

with col1:
    st.markdown("""
    <div style="padding: 2rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
        <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">📊 Meta Ads Library</div>
        <div style="color: #6b7280; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
            Durchsucht die Meta Ads Library nach Keywords und zieht aktive Ads.
            <br/><br/>
            <strong>Einstellungen:</strong> Keywords, Länder, Filter<br/>
            <strong>Status:</strong> Im Hintergrund + Live-Logging<br/>
            <strong>Braucht:</strong> Meta API Token
        </div>
    </div>
    """, unsafe_allow_html=True)

    if st.button("Starten", key="btn_meta", use_container_width=True, type="primary"):
        run = create_run("meta_ads_library")
        st.session_state["current_run_id"] = run.id
        st.success(f"Run {run.id} erstellt")
        st.switch_page("pages/4_Run_Detail.py")

with col2:
    st.markdown("""
    <div style="padding: 2rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
        <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">📤 PhantomBuster Upload</div>
        <div style="color: #6b7280; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
            Importiere einen PhantomBuster-Export (LinkedIn-Profile).
            <br/><br/>
            <strong>Format:</strong> CSV oder XLSX<br/>
            <strong>Spalten:</strong> Werden automatisch erkannt<br/>
            <strong>Voransicht:</strong> Mapping vor dem Import
        </div>
    </div>
    """, unsafe_allow_html=True)

    if st.button("Starten", key="btn_pb", use_container_width=True, type="primary"):
        st.session_state["upload_mode"] = True
        run = create_run("phantombuster_linkedin")
        st.session_state["current_run_id"] = run.id
        st.success(f"Run {run.id} erstellt")
        st.switch_page("pages/4_Run_Detail.py")
