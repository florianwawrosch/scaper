import streamlit as st

st.set_page_config(page_title="Lead-Pipeline Dashboard", page_icon="\U0001F4CA", layout="wide")

st.title("Lead-Pipeline Dashboard")

st.markdown(
    """
Willkommen. Dieses Dashboard buendelt die Lead-Pipeline in drei Module:

1. **Scraping** -- Meta Ads Library (Python-Scraper), PhantomBuster (LinkedIn), spaeter Job-Portale.
2. **Validierung & Filterung** -- Gemini-Klassifizierung gegen editierbare, quellenabhaengige Kriterien.
3. **Anreicherung** -- E-Mail-/Kontaktdaten via Hunter.io / FindyMail.

**Heutiger Stand:** Modul 2 ist als eigenstaendige Seite nutzbar (CSV/XLSX hochladen, klassifizieren,
Ergebnis als CSV exportieren). Kriterien lassen sich unter "Kriterien" jederzeit erweitern, ohne Code
anzufassen. Modul 1 (Anbindung an den bestehenden Meta-Scraper) und Modul 3 (Hunter.io/FindyMail)
folgen, sobald `_ad_library_common.py` bzw. die API-Zugaenge vorliegen.

Navigation links in der Sidebar.
"""
)

with st.expander("Setup-Hinweis: Gemini API Key"):
    st.markdown(
        """
Fuer die Filterung wird ein `GEMINI_API_KEY` benoetigt (Umgebungsvariable oder `.env`-Datei,
siehe `.env.example`). Ohne Key laesst sich die Seite "Filterung" oeffnen, aber nicht klassifizieren.
"""
    )
