# Lead Pipeline

Scrape → Filter → Enrich → Export für High-Ticket-Coach-Leads.
Die komplette App läuft als **Next.js-App auf Vercel** — Scraping, KI-Analyse
und Enrichment laufen serverseitig in Vercel-Routen, ein separates Backend ist
nicht nötig.

## Wichtig: Wo die API-Keys liegen

**Alle Keys stehen als Umgebungsvariablen in Vercel** (Project → Settings →
Environments → Environment Variables). Sie stehen bewusst NICHT im Code —
Code liegt auf GitHub, dort eingecheckte Keys gelten als geleakt und werden
von Meta/OpenAI automatisch gesperrt.

Der Server liest die Variablen zur Laufzeit (`frontend/lib/serverKeys.ts`
definiert alle akzeptierten Namen). Aktuell verwendete Namen:

| Dienst | Variable (weitere Varianten werden akzeptiert) |
|---|---|
| Meta Ads Library | `META_API_KEY` |
| OpenAI / ChatGPT | `OPENAI_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| Anthropic Claude | `ANTHROPIC_API_KEY` |
| FindyMail | `FINDYMAIL_API_KEY` |
| Hunter.io | `HUNTER_IO_API_KEY` |
| App-Passwortschutz | `APP_PASSWORD` (optional) |

Nach dem Anlegen/Ändern einer Variable: einmal **Redeploy** — Vercel übernimmt
Variablen erst beim nächsten Deploy. Kontrolle im Browser:
`/api/keys/available` zeigt als JSON, welche Keys der Server sieht (nur
Booleans, nie die Werte). In den App-Einstellungen erscheint für serverseitige
Keys das blaue Badge „✓ Server-Key aktiv". Keys, die man in den
App-Einstellungen einträgt, liegen nur im jeweiligen Browser (localStorage)
und haben Vorrang vor den Server-Keys.

## Architektur

```
frontend/                    Next.js-App (deployt auf Vercel)
  app/api/scrape/            Meta Ads Library Scraper (TypeScript-Port)
  app/api/ai/analyze/        KI-Analyse: Gemini / Claude / OpenAI via REST
  app/api/enrich/            E-Mail-Enrichment: Hunter.io + FindyMail
  app/api/keys/              Keys für eingeloggte Browser (nur mit APP_PASSWORD)
  app/api/keys/available/    Welche Keys der Server hat (Booleans)
  app/api/backend/[...path]/ Proxy zu einem optionalen Python-Backend
  lib/serverKeys.ts          Env-Variablen-Namen ↔ Provider-Zuordnung
  lib/blocklist.ts           Blockliste (immer ausgeschlossene Seiten)
  lib/csvStorage.ts          IndexedDB-Speicher für Scrape-/CSV-Daten

main.py + core/              Optionales FastAPI-Backend (Railway) — wird nur
                             gebraucht, wenn ein separater Server läuft; die
                             App funktioniert komplett ohne.
pages/ + app.py              Alte Streamlit-Oberfläche (Vorgänger, ungenutzt)
```

## Datenfluss

1. **Scrapen**: Suchmaske → `/api/scrape` (Server hängt `META_API_KEY` an) →
   Ergebnis landet als CSV in IndexedDB im Browser → Datentabelle.
2. **KI-Spalten**: „+ KI-Spalte" in der Tabelle → Spalte speichern →
   Analysieren → `/api/ai/analyze` in 20er-Chunks → Ergebnisse werden in die
   gespeicherte CSV geschrieben (überleben Reload).
3. **Enrichment**: „Enrichment starten →" → eigene Seite, nur konfigurierte
   Provider → `/api/enrich` → E-Mails als Spalte `email_enriched`.
4. **Export**: ↓ CSV / ↓ XLSX direkt aus der Tabelle.

Die Blockliste (Einstellungen → Blockliste, 🚫 in der Tabelle) filtert
unerwünschte Seiten aus allen künftigen Scrapes.

## Lokal entwickeln

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

Keys lokal: `frontend/.env.local` mit denselben Variablennamen wie oben.
