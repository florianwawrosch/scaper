import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st
from core.runs import list_runs, load_run

st.set_page_config(page_title="Lead-Pipeline Dashboard", page_icon="🚀", layout="wide")

st.title("🚀 Lead-Pipeline Dashboard")

col1, col2 = st.columns([2, 1])
with col1:
    st.markdown("**Automatisierte Lead-Verarbeitung:** Scrape → Klassifiziere → Reichere an → Export")
with col2:
    if st.button("➕ Neuer Run", type="primary", use_container_width=True):
        st.switch_page("pages/3_Neuer_Run.py")

st.divider()

st.subheader("Runs")
runs = list_runs()

if not runs:
    st.info("Noch keine Runs. Klick '➕ Neuer Run' oben, um zu starten.")
else:
    for run in runs[:10]:  # letzte 10 Runs
        status_icon = {
            "in_progress": "🔄",
            "completed": "✅",
            "failed": "❌",
        }.get(run.status, "❓")

        with st.container(border=True):
            col1, col2, col3, col4 = st.columns([2, 1, 1, 2])
            with col1:
                st.markdown(f"**{status_icon} Run {run.id}**")
                st.caption(f"{run.source} • {run.created_at[:10]}")
            with col2:
                if run.modules.get("modul_2"):
                    klassifiziert = run.classification_results
                    keep = sum(r.get("keep", 0) for r in klassifiziert.values())
                    reject = sum(r.get("reject", 0) for r in klassifiziert.values())
                    st.metric("Behalten", keep)
            with col3:
                if run.rating:
                    st.metric("Rating", f"{'⭐' * run.rating}")
                else:
                    st.caption("Kein Rating")
            with col4:
                if st.button("Öffnen", key=f"run_{run.id}", use_container_width=True):
                    st.session_state["current_run_id"] = run.id
                    st.switch_page("pages/4_Run_Detail.py")

with st.expander("ℹ️ Wie funktioniert's?"):
    st.markdown(
        """
1. **Neuer Run:** Wähle Quelle (Meta Scraper oder PhantomBuster-Upload)
2. **Klassifizierung:** KI-Modelle klassifizieren die Leads (Auto, mehrere parallel)
3. **Review:** Schau die Ergebnisse an, bearbeite manuell nach
4. **Anreicherung:** E-Mails/Kontakte finden
5. **Export:** Close-Import oder Download

Jeder Run wird als separater Workflow gespeichert mit voller History.
"""
    )
