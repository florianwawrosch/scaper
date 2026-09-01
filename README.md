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
  lib/csvRuns.ts             Laden/Speichern eines Datensatzes (CSV + Meta)
  lib/ai.ts                  KI-Pipeline: Prompts, Chunks, Multi-Output-Split,
                             Enum-Validierung, Regel-Spalten, feld_hash-Cache
  lib/aiTemplates.ts         Import-Vorlagen (LinkedIn v5, KEEP/DROP) + Overrides
  lib/analysisConfigs.ts     KI-Spalten-Konfiguration pro Datensatz

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

## LinkedIn-Klassifizierung (Uriels Sheet-System in der App)

Das System aus dem Google Sheet `ki_linkedin_klassifizierung` ist komplett in
die App überführt. Beim Upload einer LinkedIn-CSV (erkannt an Spalten wie
`voller_name`, `jobtitel`, `headline`, `linkedin_url`) bietet ein Dialog die
Vorlage **LinkedIn-Klassifizierung (v5)** an:

- **1 KI-Aufruf pro Zeile → 8 Spalten**: Der v5-Prompt liefert sieben
  pipe-getrennte Werte (`ki_haupttyp`, `ki_bietet_coaching`,
  `ki_marketing_agentur`, `ki_themenfeld`, `ki_anbieterstatus`,
  `ki_rollenbezug`, `ki_sicherheit`), die automatisch in Einzelspalten
  gesplittet werden. `ki_zielgruppe` (ja/nein) ist eine **deterministische
  Regel** über diese Werte — kein eigener KI-Aufruf: Coaching = ja/wahrscheinlich
  UND keine Marketing-Agentur UND selbstständig/Unternehmen.
- **Enum-Validierung**: Nur die im Sheet definierten Werte sind erlaubt.
  Falsche Schreibweise wird korrigiert („coach" → „Coach"), ungültige
  Antworten werden rot als `Fehler: …` markiert und beim nächsten ▶
  automatisch erneut versucht.
- **feld_hash-Cache**: Erneutes ▶ klassifiziert nur Zeilen, die neu sind,
  deren Eingabewerte sich geändert haben oder die fehlgeschlagen waren —
  unveränderte Zeilen kosten keine API-Credits. Prompt-/Modell-Änderung
  invalidiert alles.
- **Prompt zentral pflegen**: Einstellungen → **KI-Vorlagen**. Dort den
  Prompt editieren (z.B. wenn eine v6 existiert), Version benennen,
  „↺ Standard" setzt zurück. Neue Importe nutzen automatisch die
  angepasste Version; das Spalten-Label zeigt Provider · Modell · Version.
- **Auswertung**: Chips über der Tabelle zeigen Fortschritt und
  Zielgruppen-Quote — Klick auf einen Chip filtert die Tabelle (und damit
  auch den Export). „⌗ Statistik nach quelle_person" zeigt die Quote pro
  Big Player, sortiert nach Trefferquote.
- **Gezieltes Enrichment**: Die Enrichment-Seite enricht standardmäßig nur
  Zeilen mit `ki_zielgruppe = ja` — spart Hunter.io/FindyMail-Credits.

Der eingebaute v5-Prompt, die Eingabespalten, die erlaubten Werte und die
Zielgruppen-Regel stehen in `frontend/lib/aiTemplates.ts`.

## Lokal entwickeln

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

Keys lokal: `frontend/.env.local` mit denselben Variablennamen wie oben.
