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
| Gemeinsamer Speicher | `DATABASE_URL` (Postgres, z.B. Neon über Vercel → Storage) — ohne sie sieht jeder Browser nur seine eigenen Daten (siehe unten) |
| Login-Alarm per Mail | `LOGIN_ALERT_TO` + `RESEND_API_KEY` (optional `LOGIN_ALERT_FROM`) — oder `LOGIN_ALERT_WEBHOOK` |

Nach dem Anlegen/Ändern einer Variable: einmal **Redeploy** — Vercel übernimmt
Variablen erst beim nächsten Deploy. Kontrolle im Browser:
`/api/keys/available` zeigt als JSON, welche Keys der Server sieht (nur
Booleans, nie die Werte). Unter Einstellungen → **Integrationen** zeigt die
App je Dienst, ob der Server einen Key hat, wie die Variable heißt und wo man
sie setzt (mit Link). **In der App selbst lassen sich keine Keys eintragen** —
sie liegen ausschließlich auf dem Server, damit alle Kollegen dieselben Dienste
nutzen und auf keinem Rechner ein Key zurückbleibt. Optional `ENV_SETTINGS_URL`
setzen (Direktlink zur Seite mit den Umgebungsvariablen), dann verlinken die
Einstellungen direkt dorthin statt auf das Vercel-Dashboard.

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

## Gemeinsamer Speicher — ein Stand für alle Kollegen

Datensätze (Meta + CSV-Text), KI-Spalten-Konfigurationen und -Caches,
gespeicherte KI-Spalten, gespeicherte Suchen und die Blockliste liegen in
einem Key-Value-Store auf dem Server (`frontend/lib/serverStore.ts`,
Route `/api/store`). Jeder Browser hält nur eine Kopie als Cache
(localStorage + IndexedDB): beim Öffnen der App und beim Zurückkehren in den
Tab wird der Serverstand eingespielt, jede Änderung sofort hochgeladen
(`frontend/lib/store.ts`). Bei Konflikten gewinnt der Server; Löschungen
bleiben als Tombstone stehen, damit ein Gerät mit altem Stand sie nicht wieder
hochlädt. CSV-Texte werden gzip-komprimiert übertragen und nur beim Öffnen
eines Datensatzes geladen. **Anzeige-Einstellungen bleiben im Browser, API-Keys
liegen nur auf dem Server.** Ohne Datenbank oder bei Fehlern erscheint ein
Hinweisbanner; sonst bleibt der Speicher unsichtbar.

Statt einer Nutzerverwaltung trägt jeder neue Datensatz den **Standort beim
Anlegen** («Wien, AT» — aus der IP über die Vercel-Geo-Header, Route
`/api/whoami`, Logik in `frontend/lib/origin.ts`). Er steht im Verlauf und in
der Datensatz-Liste; lokal (localhost) bleibt das Feld leer.

Einrichten (einmalig): Vercel → Projekt → **Storage** → **Create Database** →
**Neon (Postgres)** → mit dem Projekt verbinden. Das setzt `DATABASE_URL`
automatisch; danach einmal **Redeploy**. Die Tabelle `lp_store` legt die App
beim ersten Zugriff selbst an; beim ersten Laden lädt jeder Browser seine
bisherigen lokalen Daten hoch (Migration). Ohne `DATABASE_URL` läuft die App
weiter wie bisher, nur lokal — Einstellungen → Daten zeigt die Anleitung.
Lokal (`npm run dev`) dient ein Datei-Store unter `frontend/.data/store/`
als Ersatz; E2E-Tests bekommen über das Cookie `lp_ns` jeweils einen
eigenen Namensraum.

## Architektur

```
frontend/                    Next.js-App (deployt auf Vercel)
  app/api/scrape/            Meta Ads Library Scraper (TypeScript-Port)
  app/api/ai/analyze/        KI-Analyse: Gemini / Claude / OpenAI via REST
  app/api/enrich/            E-Mail-Enrichment: Hunter.io + FindyMail
  app/api/keys/              Keys für eingeloggte Browser (nur mit APP_PASSWORD)
  app/api/keys/available/    Welche Keys der Server hat (Booleans)
  app/api/enrich/account/    Guthaben + Abrechnungsregel je Enrichment-Anbieter
  app/api/store/             Gemeinsamer Speicher (Manifest, get/put/delete, wipe)
  app/hooks/                 Seiten-Logik als Hooks: useScrapeForm, useCsvImport,
                             useAiColumns (csv/[id]), useEnrichmentRun, useTableState
  app/components/            DataTable, FilterDropdown, EnrichmentPanel (+ enrichment/),
                             AiColumnMenu, TemplateSaveForm, AiColumnEditor, StoreGate, …
  app/settings/              page.tsx (Sidebar) + IntegrationsTab, AiColumnsTab
                             (+ templates/), BlocklistTab, DataTab, DesignTab
  app/theme.ts               Design-Tokens (CSS-Variablen) + Monospace-Style
  lib/serverKeys.ts          Env-Variablen-Namen ↔ Provider-Zuordnung
  lib/blocklist.ts           Blockliste (immer ausgeschlossene Seiten)
  lib/store.ts               Sync-Schicht: lokaler Cache ↔ gemeinsamer Speicher (pur getestet)
  lib/serverStore.ts         Server-Treiber: Postgres (Neon) oder Dateien (Entwicklung)
  lib/csvStorage.ts          IndexedDB-Cache für CSV-Texte (+ Abgleich mit dem Server)
  lib/csvRuns.ts             Laden/Speichern/Löschen eines Datensatzes (CSV + Meta)
  lib/ai.ts                  KI-Pipeline: Prompts, Chunks, Multi-Output-Split,
                             Enum-Validierung, Regel-Spalten, feld_hash-Cache
  lib/aiTemplates.ts         Gespeicherte KI-Spalten (eingebaut + eigene), Lade-Schalter, Overrides
  lib/analysisConfigs.ts     KI-Spalten-Konfiguration pro Datensatz
  lib/tableQuery.ts          Filtern/Sortieren/Link-Erkennung der Tabelle (pur, getestet)
  lib/tableExport.ts         CSV/XLSX-Download (xlsx wird erst beim Klick geladen)
  lib/enrichMapping.ts       Spalten-Vorschläge fürs Enrichment (pur, getestet)
  lib/outreachExport.ts      Outreach-CSV-Mapping (pur, getestet)
  lib/savedSearches.ts       Gespeicherte Suchen der Scrape-Maske
  lib/backup.ts              Backup/Restore/Wipe aller Daten (lokal + gemeinsamer Speicher)
  lib/leadKeys.ts            Lead-Identität (Schlüssel) + Abgleich (pur, getestet)
  lib/leadIndex.ts           Index bekannter Leads aus allen anderen Datensätzen

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
   Provider. **Was holen?** E-Mail (Hunter.io oder FindyMail, aus Name +
   Firma/Domain) und/oder Telefonnummer (nur FindyMail, aus der LinkedIn-URL).
   Die Spalten-Zuordnung ist vorbelegt (Vorschlag anhand der Spaltennamen,
   Beispielwert daneben). Vor dem Start eine **zweistufige Bestätigung**:
   Guthaben live vom Anbieter (`/api/enrich/account`), Kosten «bis zu N
   Credits» je Feld plus Abrechnungsregel des Anbieters (beide berechnen nur
   Treffer), ab 100 Leads zusätzlich ein Häkchen. Der Lauf verarbeitet alle
   Chargen à 50 Zeilen automatisch, speichert nach jeder Charge und lässt sich
   abbrechen. Ergebnis: Spalten `email_enriched` / `phone_enriched` im
   Datensatz — Tabelle, CSV/XLSX und Outreach-Export (`phone`). Bereits
   gefüllte Zeilen werden beim nächsten Start übersprungen. Hinweis: Der
   FindyMail-Telefon-Endpunkt (`/api/search/phone`) ist nach Doku umgesetzt,
   aber ohne Live-Key nicht gegen die echte API getestet.
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

Die KI-Analyse schickt 20er-Chunks an `/api/ai/analyze`; bei Claude und
OpenAI laufen drei Chunks gleichzeitig (12 parallele Provider-Aufrufe), bei
Gemini wegen des Free-Tier-Limits nur einer (`PARALLEL_CHUNKS` in
`frontend/lib/ai.ts`). Ergebnisse erscheinen chunkweise in der Tabelle, auch
wenn Chunks in anderer Reihenfolge fertig werden.

Die Blockliste (Einstellungen → Blockliste, 🚫 in der Tabelle) filtert
unerwünschte Seiten aus allen künftigen Scrapes.

## LinkedIn-Klassifizierung

Beim Upload einer LinkedIn-CSV (erkannt an Spalten wie `voller_name`,
`jobtitel`, `headline`, `linkedin_url`) bietet ein Dialog die eingebaute
KI-Spalte **LinkedIn-Klassifizierung** an — sofern sie nicht ohnehin per
Lade-Schalter automatisch angehängt wird:

- **Eine Spalte, eine Antwort**: `ki_zielgruppe` = ja/nein. Der Prompt
  (Uriels Regeln: was die Person ANBIETET vs. wen sie anspricht; Coach/Trainer
  vs. Agentur; selbstständig vs. angestellt) entscheidet in einem Aufruf pro
  Zeile. Keine Sub-Spalten, keine Regel-Spalten.
- **feld_hash-Cache**: Erneutes ▶ klassifiziert nur Zeilen, die neu sind,
  deren Eingabewerte sich geändert haben oder die fehlgeschlagen waren —
  unveränderte Zeilen kosten keine API-Credits. Prompt-/Modell-Änderung
  invalidiert alles.
- **Prompt zentral pflegen**: Einstellungen → **KI-Spalten** → ✎ Bearbeiten.
  Titel, KI-Modell, KI-Version und Prompt sind auch bei eingebauten Spalten
  änderbar („↺ Standard" setzt zurück); neue Importe nutzen die Anpassung.
- **Auswertung**: Chips über der Tabelle zeigen Fortschritt und die
  Verteilung der Antworten (ja/nein, KEEP/DROP) — Klick auf einen Chip
  filtert die Tabelle (und damit auch den Export). „⌗ Statistik nach
  quelle_person" zeigt die Zielgruppen-Quote pro Big Player.
- **Gezieltes Enrichment / Outreach**: Enrichment-Seite und Outreach-CSV
  nehmen standardmäßig nur Zeilen mit `ki_zielgruppe = ja` — spart Credits.

Ältere Datensätze mit der früheren Multi-Output-Variante (sieben
pipe-getrennte Werte + Regel-Spalte) laufen weiter: die Regel-Spalte bleibt
sichtbar, die Einzelwerte sind in der Tabelle ausgeblendet (im Export
enthalten). Prompt und Eingabespalten stehen in `frontend/lib/aiTemplates.ts`.

## Lead-Gedächtnis: Duplikate und bereits Angeschriebene

Beim wiederholten Scrapen tauchen dieselben Seiten und Personen wieder auf.
Der Viewer gleicht jeden neuen Datensatz einmal automatisch (und per
«⟲ Abgleich» jederzeit) mit allen anderen Datensätzen dieses Browsers ab —
über Meta-Seiten-ID, LinkedIn-URL, E-Mail, notfalls Seitenname
(`frontend/lib/leadKeys.ts`). Ergebnis sind zwei Spalten im Datensatz:

- `bekannt_aus` — Name des ältesten Datensatzes, der den Lead schon enthält
  (leer = neu). Chips «neu: N» und «bekannt aus «…»: N» filtern die Tabelle.
- `exportiert_am` — Datum des Outreach-Exports. Wird beim Abgleich aus anderen
  Datensätzen übernommen, damit ein Lead nicht in zwei Kampagnen landet.

Der **↓ Outreach**-Export lässt Zeilen mit `exportiert_am` weg (der Toast
nennt die Zahl) und markiert die exportierten Zeilen mit dem heutigen Datum.
Ohne zweiten Datensatz werden keine Spalten angelegt.

## Daten: Backup, Wiederherstellung, Löschen

Unter Einstellungen → **Verbrauch** steht ein Protokoll aller KI- und
Enrichment-Läufe (Datensatz, Spalte bzw. Felder, Modell, Zeilen, Token laut
Anbieter, Dauer) mit Summen je Modell über die letzten 30 Tage. Die Kosten sind
Richtwerte aus `frontend/lib/aiPricing.ts` (USD je 1 Mio. Token) — dort neue
Modelle und Preise nachtragen. Das Protokoll liegt im gemeinsamen Speicher
(`usage_log`, max. 500 Einträge) und wird zweistufig geleert.

Unter Einstellungen → **Daten** stehen der Zustand des gemeinsamen Speichers
(mit Einrichtungs-Anleitung, falls keine Datenbank verbunden ist), der Bestand
(Datensätze, Zeilen, KI-Spalten, Suchen, Speicherbelegung), **Backup
herunterladen** (eine JSON-Datei mit allen Datensätzen inkl. CSV-Text,
KI-Spalten-Konfigurationen und -Caches, gespeicherten KI-Spalten, Suchen,
Blockliste — nie API-Keys), **Backup wiederherstellen** (Vorschau, dann
zusammenführen oder vorhandene Datensätze überschreiben; wiederhergestellte
Daten landen auch im gemeinsamen Speicher) und **Alle Daten löschen** — in
diesem Browser und im gemeinsamen Speicher, also für alle. Logik in
`frontend/lib/backup.ts`.

## Gespeicherte KI-Spalten & automatisches Laden

Eine gespeicherte KI-Spalte hat genau: **Titel** (Spaltenname), **KI-Modell**
(Claude / GPT / Gemini), **KI-Version** (z.B. `claude-sonnet-5`), **Prompt**
und drei Lade-Schalter: **bei CSV**, **bei Meta**, **▶ direkt**. Sie ist
immer genau eine Spalte in der Tabelle.

- **In der Tabelle**: der eine Button **+ KI-Spalte** öffnet ein Menü —
  «Neue KI-Spalte» (leer, eigener Prompt, ⚙ geht auf) oder eine gespeicherte
  laden. Jede gespeicherte KI-Spalte ist pro Datensatz nur einmal ladbar
  (bereits geladene stehen als «✓ in Tabelle»); mit ▶ direkt füllt sie sich
  beim Laden sofort aus (kostet Credits). Fehlen Eingabespalten (LinkedIn auf
  Meta-Daten), ist die Zeile ausgegraut.
- **Speichern**: ⚙ an einer KI-Spalte → «☆ In Einstellungen speichern»
  (Titel = Spaltenname, nur die Schalter werden abgefragt). Die Spalte merkt
  sich ihre Herkunft, damit sie nicht doppelt geladen wird.
- **Automatisch laden**: Mit **bei CSV** / **bei Meta** wird die KI-Spalte
  beim Import ohne Dialog angehängt, mit **▶ direkt** sofort ausgefüllt.
- **Verwalten**: Einstellungen → **KI-Spalten** — eine Tabellenzeile je
  KI-Spalte, Schalter direkt in der Zeile, ✎ Bearbeiten öffnet den
  Inline-Editor, ⧉ kopiert eine eingebaute als eigene, 🗑 löscht (zweistufig),
  «+ Neue KI-Spalte» legt eine leere an (▶ direkt vorbelegt).

Ablage im gemeinsamen Speicher: eigene KI-Spalten in `user_presets`,
Lade-Schalter in `preset_flags`, Anpassungen eingebauter in
`preset_overrides`. Ältere «Vorlagen» mit mehreren Spalten werden beim ersten
Laden in einzelne KI-Spalten zerlegt. Die Logik (`applyPresets`,
`presetsForSource`, `presetFromConfigs`, `isPresetLoaded`) liegt in
`frontend/lib/aiTemplates.ts`.

## Tests

```bash
cd frontend
npm run test:unit   # Bibliotheks-Tests (KI-Spalten, Sync-Logik, Store-Treiber, Login-Token, Retry, Outreach-Mapping) — ohne Server
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
Ohne `DATABASE_URL` nutzt die Entwicklung den Datei-Store `frontend/.data/store/`
(gitignored) als gemeinsamen Speicher.
