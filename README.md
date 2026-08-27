# Lead-Pipeline Dashboard

Drei-Module-Pipeline fuer High-Ticket-Coach-Leads:

1. **Scraping** -- Meta Ads Library (bestehender Python-Scraper), PhantomBuster (LinkedIn), spaeter Job-Portale.
2. **Validierung & Filterung** -- Gemini-Klassifizierung gegen editierbare, quellenabhaengige Kriterien.
3. **Anreicherung** -- E-Mail-/Kontaktdaten via Hunter.io / FindyMail.

## Stand

Modul 2 ist als Streamlit-Seite nutzbar. Modul 1 (Anbindung an den bestehenden Meta-Scraper,
`_ad_library_common.py`) und Modul 3 (Hunter.io/FindyMail) folgen.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # GEMINI_API_KEY eintragen
```

## Starten

```bash
streamlit run app.py
```

## Struktur

```
app.py                      Dashboard-Startseite
pages/1_Filterung.py        Modul 2: Upload -> Spalten-Mapping -> Gemini-Klassifizierung -> Export
pages/2_Kriterien.py        Modul 2: Ausschlussregeln pro Quelle verwalten (ohne Code-Aenderung)
core/schema.py              Vereinheitlichtes Lead-Schema + Spalten-Mapping-Vorschlaege
core/criteria_store.py      Laden/Speichern der Kriterien (criteria/*.yaml)
core/gemini_classifier.py   Prompt-Bau + Gemini-Aufruf + Antwort-Parsing
core/loaders.py             CSV/XLSX-Upload einlesen
criteria/*.yaml             Editierbare Zielprofile + Ausschlussregeln je Quelle
```

## Kriterien erweitern

Neue Ausschlussmuster (z.B. wenn ein neuer Typ von "Fehlläufern" auffaellt) werden auf der Seite
"Kriterien" hinzugefuegt -- landet als neue Regel in `criteria/<quelle>.yaml`, sofort wirksam,
kein Redeploy noetig.
