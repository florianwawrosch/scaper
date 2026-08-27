import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from core.runs import load_run

st.set_page_config(page_title="Run Detail", page_icon="📊", layout="wide")

run_id = st.session_state.get("current_run_id")
if not run_id:
    st.error("Kein Run ausgewählt. Geh zur Startseite zurück.")
    st.stop()

run = load_run(run_id)
if not run:
    st.error(f"Run {run_id} nicht gefunden.")
    st.stop()

st.title(f"📊 Run {run_id}")
st.caption(f"Quelle: {run.source} • Status: {run.status} • Erstellt: {run.created_at}")

tab1, tab2, tab3, tab4 = st.tabs(["📥 Modul 1: Scraping", "🤖 Modul 2: Klassifizierung", "✨ Modul 3: Anreicherung", "🎯 Review & Export"])

with tab1:
    st.subheader("Modul 1: Daten-Import")
    if run.source == "meta_ads_library":
        st.info("🚧 Meta Scraper: noch in Entwicklung (braucht `_ad_library_common.py`)")
        st.markdown("""
        - Keywords eingeben
        - Länder auswählen
        - Filter setzen (page_limit, max_pages)
        - "Scrape starten" → läuft im Hintergrund
        """)
    elif run.source == "phantombuster_upload":
        st.markdown("**CSV/XLSX hochladen:**")
        uploaded = st.file_uploader("PhantomBuster-Export", type=["csv", "xlsx", "xls"])
        if uploaded:
            st.success(f"Datei geladen: {uploaded.name}")
            st.info("Voransicht würde hier angezeigt (Spalten-Mapping)")
            if st.button("Bestätigen & zu Modul 2"):
                st.success("Daten an Modul 2 übergeben!")

with tab2:
    st.subheader("Modul 2: Automatische Klassifizierung")

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**KI-Modelle auswählen:**")
        models = st.multiselect(
            "Welche Modelle sollen klassifizieren?",
            ["Gemini", "ChatGPT (OpenAI)", "Claude (Anthropic)"],
            default=["Gemini"],
            key="models_select"
        )
    with col2:
        st.markdown("**Status:**")
        if models:
            for model in models:
                st.caption(f"🔄 {model}: würde jetzt klassifizieren...")

    if st.button("Klassifizierung starten", type="primary", use_container_width=True):
        st.info("🚧 Klassifizierung läuft... (Mock: würde 180 behalten, 62 rausgefiltert)")
        # Hier würde die echte Klassifizierung laufen

with tab3:
    st.subheader("Modul 3: Datenen-Anreicherung")
    st.info("🚧 Hunter.io / FindyMail: noch in Entwicklung")
    st.markdown("""
    - E-Mails/Kontakte pro Lead suchen
    - Verifizieren
    - Ausgabe mit Erfolgsquote
    """)

with tab4:
    st.subheader("Review, Feedback & Export")

    col1, col2 = st.columns([2, 1])
    with col1:
        st.markdown("**Ergebnis überprüfen:**")
        st.info("Klassifizierung-Ergebnisse würden hier als Tabelle angezeigt")
    with col2:
        st.markdown("**Bewertung:**")
        rating = st.slider("Rating (1-5 Sterne)", 1, 5, 3, key="rating_slider")
        feedback = st.text_area("Konkretes Feedback:", key="feedback_area")
        best_model = st.selectbox("Bestes Modell:", ["Gemini", "ChatGPT", "Claude"], key="best_model_select")

        if st.button("Feedback speichern", use_container_width=True):
            run.rating = rating
            run.feedback = feedback
            run.best_model = best_model
            st.success("Feedback gespeichert!")

    st.divider()
    st.markdown("**Export:**")
    st.download_button(
        "📥 CSV für Close herunterladen",
        data="dummy csv export",
        file_name=f"run_{run_id}_export.csv",
        mime="text/csv",
        use_container_width=True
    )
