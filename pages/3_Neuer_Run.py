import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from core.runs import create_run

st.set_page_config(page_title="Neuer Run", page_icon="➕", layout="wide")
st.title("➕ Neuer Run")

st.markdown("Wähle die Datenquelle für diesen Run aus.")

col1, col2 = st.columns(2)

with col1:
    st.subheader("1️⃣ Meta Ads Library Scraper")
    st.markdown(
        """
Durchsucht die Meta Ads Library nach Keywords und zieht aktive Ads.
- **Einstellungen:** Keywords, Länder, Filter
- **Status:** Im Hintergrund + Live-Logging
- **Braucht:** Meta API Token
"""
    )
    if st.button("Meta Scraper starten", key="btn_meta", use_container_width=True, type="primary"):
        run = create_run("meta_ads_library")
        st.session_state["current_run_id"] = run.id
        st.success(f"Run {run.id} erstellt. Konfiguration lädt...")
        st.switch_page("pages/4_Run_Detail.py")

with col2:
    st.subheader("2️⃣ PhantomBuster-Export hochladen")
    st.markdown(
        """
Importiere einen PhantomBuster-Export (LinkedIn-Profile).
- **Format:** CSV oder XLSX
- **Spalten:** Werden automatisch erkannt
- **Voransicht:** Sieh das Mapping, bevor es lädt
"""
    )
    if st.button("PhantomBuster-CSV hochladen", key="btn_pb", use_container_width=True, type="primary"):
        st.session_state["upload_mode"] = True
        run = create_run("phantombuster_upload")
        st.session_state["current_run_id"] = run.id
        st.success(f"Run {run.id} erstellt. Upload-Seite lädt...")
        st.switch_page("pages/4_Run_Detail.py")
