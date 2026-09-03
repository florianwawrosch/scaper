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
| App-Login | `APP_USER` + `APP_PASSWORD` — **Pflicht**, ohne beide ist die App gesperrt (siehe unten) |
| Login-Alarm per Mail | `LOGIN_ALERT_TO` + `RESEND_API_KEY` (optional `LOGIN_ALERT_FROM`) — oder `LOGIN_ALERT_WEBHOOK` |

Nach dem Anlegen/Ändern einer Variable: einmal **Redeploy** — Vercel übernimmt
Variablen erst beim nächsten Deploy. Kontrolle im Browser:
`/api/keys/available` zeigt als JSON, welche Keys der Server sieht (nur
Booleans, nie die Werte). In den App-Einstellungen erscheint für serverseitige
Keys das blaue Badge „✓ Server-Key aktiv". Keys, die man in den
App-Einstellungen einträgt, liegen nur im jeweiligen Browser (localStorage)
und haben Vorrang vor den Server-Keys.

## Login — die App ist ohne Zugangsdaten gesperrt

Die Server-Keys werden bei **jeder** Anfrage an `/api/scrape`, `/api/ai/analyze`
und `/api/enrich` eingesetzt. Deshalb ist die App **fail-closed**: Solange
`APP_USER` und `APP_PASSWORD` nicht beide gesetzt sind, ist sie nicht „offen",
sondern gesperrt — jede Seite landet auf `/login` (das sagt, welche Variable
fehlt), jeder API-Aufruf bekommt `503`. Es gibt keinen Zustand, in dem die Keys
ohne Login nutzbar wären.

1. Vercel → Project → **Settings → Environment Variables**
2. `APP_USER` und `APP_PASSWORD` anlegen (Production; optional auch Preview)
3. **Redeploy** — Variablen greifen erst beim nächsten Deploy

Danach: Login einmal pro Browser, das Session-Cookie gilt **ein Jahr**
(Facebook-Style). Das Cookie enthält nicht das Passwort, sondern einen
HMAC-Token aus User+Passwort — wer eines von beiden in Vercel ändert, loggt
damit alle Geräte aus. Die Gate-Logik liegt in `frontend/proxy.ts`, die
Vergleiche sind zeitkonstant (`frontend/lib/auth.ts`).

### Sicherheits-Mail bei jeder Anmeldung

Wie bei Google/Amazon: jede erfolgreiche Anmeldung löst eine Mail aus — Zeit,
ungefährer Standort, IP, Gerät, plus „Warst du das nicht? → Zugangsdaten in
Vercel ändern". Weil Sessions ein Jahr halten, ist eine Anmeldung selten und
der Alarm entsprechend aussagekräftig. Versand (beides optional, beides geht
parallel):

- **E-Mail über Resend**: `RESEND_API_KEY` (resend.com, kostenloser Tarif
  reicht) + `LOGIN_ALERT_TO` (Empfänger, kommagetrennt mehrere). Absender
  optional über `LOGIN_ALERT_FROM`, sonst `Scaper <onboarding@resend.dev>`.
- **Webhook**: `LOGIN_ALERT_WEBHOOK` — bekommt ein JSON mit `subject`, `text`,
  `html`, `ip`, `city`, `country`, `device`, `time`. Passt direkt auf einen
  Zapier-Catch-Hook → Gmail „Send Email" (Subject = `subject`, Body =
  `html`), oder Make/Slack.

Ist keins von beiden gesetzt, passiert nichts (kein Fehler). Der Versand läuft
nach der Antwort und kann den Login weder verzögern noch scheitern lassen.
Logik: `frontend/lib/loginNotify.ts`.

Lokal (`npm run dev`) gilt dasselbe über `frontend/.env.local`.

## Architektur

```
frontend/                    Next.js-App (deployt auf Vercel)
  app/api/scrape/            Meta Ads Library Scraper (TypeScript-Port)
  app/api/ai/analyze/        KI-Analyse: Gemini / Claude / OpenAI via REST
  app/api/enrich/            E-Mail-Enrichment: Hunter.io + FindyMail
  app/api/keys/              Keys für eingeloggte Browser (nur mit APP_PASSWORD)
  app/api/keys/available/    Welche Keys der Server hat (Booleans)
  lib/serverKeys.ts          Env-Variablen-Namen ↔ Provider-Zuordnung
  lib/blocklist.ts           Blockliste (immer ausgeschlossene Seiten)
  lib/csvStorage.ts          IndexedDB-Speicher für Scrape-/CSV-Daten
  lib/csvRuns.ts             Laden/Speichern eines Datensatzes (CSV + Meta)
  lib/ai.ts                  KI-Pipeline: Prompts, Chunks, Multi-Output-Split,
                             Enum-Validierung, Regel-Spalten, feld_hash-Cache
  lib/aiTemplates.ts         KI-Spalten-Vorlagen (eingebaut + eigene), Instant Load, Overrides
  lib/analysisConfigs.ts     KI-Spalten-Konfiguration pro Datensatz

main.py + core/              Altes FastAPI-Backend (Railway) — vom Frontend
                             nicht mehr angebunden; die App läuft komplett
                             auf Vercel. Nur noch Referenz für die Portierung.
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
4. **Export**: ↓ CSV / ↓ XLSX direkt aus der Tabelle (alle Spalten, Filter
   und Abwahl der Tabelle gelten). **↓ Outreach** erscheint, sobald eine
   E-Mail-Spalte da ist: nur Zielgruppen-Treffer mit gefundener E-Mail, auf
   die Spalten `email, first_name, last_name, company, website,
   linkedin_profile` + Kontext (`headline, job_title, themenfeld, haupttyp,
   quelle`) gemappt — direkt in Smartlead/Instantly/Lemlist importierbar, die
   Kontextspalten als Personalisierungs-Variablen. Mapping in
   `frontend/lib/outreachExport.ts`.

KI- und Enrichment-Aufrufe wiederholen 429/5xx-Antworten der Provider kurz
mit Backoff (`frontend/lib/serverRetry.ts`), damit ein Rate-Limit-Hickser
nicht sofort zur `Fehler:`-Zeile wird; Timeouts werden bewusst nicht
wiederholt.

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

## KI-Spalten-Vorlagen & Instant Load

KI-Spalten müssen nicht bei jedem Datensatz neu konfiguriert werden — sie
lassen sich als **Vorlage** speichern, laden und automatisch anhängen:

- **Speichern (in der Tabelle)**: ⚙ an einer KI-Spalte → «☆ Als Vorlage
  speichern» sichert diese Spalte (Name, Prompt, Splits, Regeln). Über den
  Toolbar-Button **☆ Vorlage** → «Aktuelle KI-Spalten als Vorlage speichern»
  werden alle KI-Spalten des Datensatzes als eine Vorlage gesichert.
  Provider/Modell werden nicht mitgespeichert; beim Laden wird der erste
  verfügbare Provider gewählt (Claude bevorzugt).
- **Laden (in der Tabelle)**: **☆ Vorlage** → «Laden» hängt die Spalten an
  (bereits vorhandene Spaltennamen werden übersprungen), **▶** hängt an und
  füllt sofort aus. Kein Dialog, kein Neuanlegen.
- **⚡ Instant Load**: Pro Vorlage lässt sich in Einstellungen → **KI-Vorlagen**
  (oder direkt beim Speichern) festlegen, dass sie bei **CSV/Excel-Upload**
  und/oder **Meta-Scrape** automatisch angehängt wird — ohne Auswahl-Dialog.
  Mit **▶ direkt ausfüllen lassen** startet die KI dazu sofort nach dem Import
  (kostet Credits). Der LinkedIn-Dialog erscheint nur noch, wenn die erkannte
  Vorlage nicht ohnehin schon per Instant Load geladen wurde.
- **Verwalten**: Einstellungen → **KI-Vorlagen** — eigene Vorlagen anlegen
  («+ Neue Vorlage»), Name/Beschreibung/Spalten/Prompts bearbeiten, Spalten
  hinzufügen oder entfernen, löschen; eingebaute Vorlagen (LinkedIn v5,
  KEEP/DROP) behalten die Prompt-Override-Logik («↺ Standard»). Die
  Instant-Load-Schalter gelten für eingebaute und eigene Vorlagen.

Ablage im Browser (localStorage): eigene Vorlagen in `user_presets`,
Instant-Load-Schalter in `preset_flags`, Prompt-Overrides eingebauter Vorlagen
in `preset_overrides`. Die Logik (`applyPresets`, `presetsForSource`,
`presetFromConfigs`) liegt in `frontend/lib/aiTemplates.ts`.

## Tests

```bash
cd frontend
npm run test:unit   # Bibliotheks-Tests (Vorlagen, Login-Token, Retry, Outreach-Mapping) — ohne Server
npm run dev         # in einem zweiten Terminal
npm run e2e         # Playwright-Durchläufe gegen http://localhost:3000 (Login per APP_USER/APP_PASSWORD)
npm run e2e -- templates   # nur Tests, deren Dateiname "templates" enthält
```

- `tests/unit/` kompiliert die getesteten `lib/*.ts` nach `tests/unit/.out` und
  führt alle `*.test.{js,mjs}` in Node aus (localStorage-Shim, `@/`-Alias).
- `e2e/` fährt die App wie ein Nutzer durch: CSV-Upload, LinkedIn-Vorlage,
  KI-Spalten (mit gemocktem `/api/ai/analyze`), Vorlagen/Instant Load,
  Enrichment-Filter, Tabelle, Outreach-Export, Einstellungen. Voraussetzung:
  laufender Dev-Server, `.env.local` mit `APP_USER`/`APP_PASSWORD` und dieselben
  Werte als Umgebungsvariablen (Standard `florian`/`testpass123`), Chromium
  (`npx playwright install chromium` oder `PLAYWRIGHT_BROWSERS_PATH`).
  Screenshots landen in `e2e/.shots/`.

## Lokal entwickeln

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

Keys lokal: `frontend/.env.local` mit denselben Variablennamen wie oben.
