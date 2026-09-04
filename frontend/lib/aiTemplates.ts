// Gespeicherte KI-Spalten (Einstellungen → KI-Spalten). Eine KI-Spalte hat:
// Titel, KI-Modell, Version, Prompt und die Lade-Schalter (bei CSV, bei Meta,
// direkt ausfüllen). Intern ist das ein ImportPreset mit genau EINER Spalte —
// eingebaut (Code + Override) oder eigene (localStorage).
// Die LinkedIn-Klassifizierung ist Uriels Sheet-Vorlage (v5): EIN Prompt, EIN
// Aufruf pro Zeile, EINE Tabellenspalte. Die sieben pipe-getrennten Werte und
// die Zielgruppen-Regel bleiben als versteckte Datensatz-Spalten (Export,
// Filter, Statistik) erhalten.

import type { AnalysisConfig } from '@/lib/ai';
import type { DerivedRule } from '@/lib/ai';
import { defaultModel, modelsFor } from '@/lib/ai';
import { loadAiConfigs, saveAiConfigs } from '@/lib/analysisConfigs';
import { AI_PROVIDERS } from '@/lib/ai';
import { loadSettings } from '@/lib/settings';

/** Import-Quelle, bei der eine KI-Spalte automatisch geladen werden kann */
export type PresetSource = 'csv' | 'meta';
export const PRESET_SOURCES: { key: PresetSource; label: string }[] = [
  { key: 'csv',  label: 'CSV/Excel-Upload' },
  { key: 'meta', label: 'Meta-Scrape' },
];

/** Lade-Schalter einer KI-Spalte (Einstellungen → KI-Spalten) */
export interface PresetFlags {
  /** Bei diesen Quellen automatisch anhängen, ohne Dialog */
  autoAdd?: Partial<Record<PresetSource, boolean>>;
  /** Sofort ausfüllen, sobald die Spalte angehängt wird — Import oder Menü (kostet Credits) */
  autoRun?: boolean;
}

/** Die Spalte einer KI-Spalte; KI-Modell optional (sonst erster Provider mit Key) */
export type PresetColumn = Omit<AnalysisConfig, 'id' | 'model' | 'provider' | 'presetId'> & { provider?: string; model?: string };

export interface ImportPreset extends PresetFlags {
  id: string;
  name: string;
  description?: string;
  promptVersion?: string;
  columns: PresetColumn[];
  /** Vom Nutzer gespeicherte KI-Spalte (localStorage) — frei editier-/löschbar */
  userDefined?: boolean;
}

const LINKEDIN_V5_PROMPT = `Bestimme aus den LinkedIn-Daten, was diese Person beruflich anbietet.

WICHTIGSTE REGEL: Unterscheide, was die Person ANBIETET, von dem, WEN sie
anspricht. Ein Begriff im Profil beschreibt oft die Zielgruppe.
- "Marketing fuer Coaches" ist eine Agentur, kein Coach.
- "Automatisierung fuer Immobilienmakler" ist kein Immobilienmakler.
- "Positionierung fuer Steuerberater" ist kein Steuerberater.
Umgekehrt gilt: wer Vertriebstraining, Akquise oder LinkedIn-Strategie
LEHRT, ist Trainer oder Coach, keine Agentur. Agentur ist nur, wer die
Arbeit fuer den Kunden AUSFUEHRT.

Weitere Regeln:
1. Nur die heutige Taetigkeit zaehlt. Eine Ausbildung oder ein Stichwort in
   den Faehigkeiten reicht nicht.
2. Marketingagentur heisst: Ads, SEO, Funnels, Social Media, Webdesign
   werden fuer fremde Firmen ausgefuehrt. Ein angestellter
   Marketingmanager ist keine Agentur.
3. Grosse Firma und angestellte Rolle: haupttyp Konzern. Die Firmengroesse
   ist ein Hinweis, kein Beweis. Wer bei einer grossen Firma als Inhaber
   oder Gruender gefuehrt wird, hat sein Profil oft an ein Netzwerk oder
   einen Verband gehaengt. Dann zaehlen Jobtitel und Selbstbeschreibung
   mehr als die Firmenangabe.
4. Coach und Trainer sind bei dieser Zielgruppe der Normalfall. Waehle
   Berater nur, wenn wirklich Beratung und kein Training verkauft wird.
   Waehle Sonstiges nur, wenn gar nichts erkennbar ist.
5. bietet_coaching auf ja oder wahrscheinlich, sobald ein Angebot zur
   Weiterentwicklung von Menschen erkennbar ist: Coaching, Mentoring,
   Training, Seminare, Ausbildung.
6. Die Firmenbeschreibung und die Specialities sagen genauer, was verkauft
   wird, als die Selbstvermarktungszeile der Person. Nutze sie zuerst.
7. Bei duenner Datenlage sicherheit niedrig.

Antworte mit GENAU SIEBEN Werten, getrennt durch senkrechte Striche, ohne
Erklaerung, ohne Zeilenumbruch. Nutze die Werte exakt wie geschrieben.

1 haupttyp: Coach, Trainer, Berater, Agentur, Dienstleister, Software, Handel, Bildung, Arzt, Finanzen, Immobilien, Konzern, Sonstiges
2 bietet_coaching: ja, wahrscheinlich, nein
3 marketing_agentur: ja, wahrscheinlich, nein
4 themenfeld: Beziehung, Spiritualitaet, Persoenlichkeit, Fitness, Gesundheit, Ernaehrung, Business, Marketing, Vertrieb, Finanzen, Handwerk, Beauty, Bildung, Recht, Immobilien, Sonstiges
5 anbieterstatus: selbststaendig, angestellt, unternehmen, unklar
6 rollenbezug: eigenes_angebot, nur_zielgruppe, beides, unklar
7 sicherheit: hoch, mittel, niedrig

Beispiel: Coach | ja | nein | Beziehung | selbststaendig | eigenes_angebot | hoch

Daten der Person:`;

const LINKEDIN_INPUT_COLUMNS = [
  'voller_name', 'jobtitel', 'firma', 'branche', 'firmengroesse',
  'firmenbeschreibung', 'specialities', 'headline', 'skills', 'beschreibung',
];

const LINKEDIN_OUTPUT_FIELDS = [
  'ki_haupttyp', 'ki_bietet_coaching', 'ki_marketing_agentur', 'ki_themenfeld',
  'ki_anbieterstatus', 'ki_rollenbezug', 'ki_sicherheit',
];

// Erlaubte Werte je Feld (Sheet-Spalten D–J) — Antworten außerhalb werden
// als Fehler markiert und beim nächsten Lauf erneut versucht
const LINKEDIN_OUTPUT_ENUMS: Record<string, string[]> = {
  ki_haupttyp: ['Coach', 'Trainer', 'Berater', 'Agentur', 'Dienstleister', 'Software', 'Handel', 'Bildung', 'Arzt', 'Finanzen', 'Immobilien', 'Konzern', 'Sonstiges'],
  ki_bietet_coaching: ['ja', 'wahrscheinlich', 'nein'],
  ki_marketing_agentur: ['ja', 'wahrscheinlich', 'nein'],
  ki_themenfeld: ['Beziehung', 'Spiritualitaet', 'Persoenlichkeit', 'Fitness', 'Gesundheit', 'Ernaehrung', 'Business', 'Marketing', 'Vertrieb', 'Finanzen', 'Handwerk', 'Beauty', 'Bildung', 'Recht', 'Immobilien', 'Sonstiges'],
  ki_anbieterstatus: ['selbststaendig', 'angestellt', 'unternehmen', 'unklar'],
  ki_rollenbezug: ['eigenes_angebot', 'nur_zielgruppe', 'beides', 'unklar'],
  ki_sicherheit: ['hoch', 'mittel', 'niedrig'],
};

/** Zielgruppe = bietet Coaching, ist keine Agentur, ist selbstständig/Unternehmen */
const LINKEDIN_ZIELGRUPPE_RULE: DerivedRule = {
  name: 'ki_zielgruppe',
  allOf: [
    { field: 'ki_bietet_coaching',   anyOf: ['ja', 'wahrscheinlich'] },
    { field: 'ki_marketing_agentur', anyOf: ['nein'] },
    { field: 'ki_anbieterstatus',    anyOf: ['selbststaendig', 'unternehmen'] },
  ],
  then: 'ja',
  else: 'nein',
};

const PRESET_LINKEDIN: ImportPreset = {
  id: 'linkedin_klassifizierung_v5',
  name: 'LinkedIn-Klassifizierung (v5)',
  description: 'Uriels Klassifizierung: 1 KI-Aufruf, 7 Werte (Haupttyp, Coaching, Agentur, Themenfeld, Status, Rollenbezug, Sicherheit) + Zielgruppen-Regel als Detail-Spalten',
  promptVersion: 'v5',
  columns: [
    {
      name: 'ki_klassifizierung',
      prompt: LINKEDIN_V5_PROMPT,
      inputColumns: LINKEDIN_INPUT_COLUMNS,
      outputFields: LINKEDIN_OUTPUT_FIELDS,
      outputEnums: LINKEDIN_OUTPUT_ENUMS,
      derived: [LINKEDIN_ZIELGRUPPE_RULE],
      promptVersion: 'v5',
    },
  ],
};

const PRESET_KEEP_DROP: ImportPreset = {
  id: 'keep_drop',
  name: 'Einfache KEEP/DROP-Klassifizierung',
  description: 'Eine Spalte: Ist die Zeile ein relevanter Lead? KEEP oder DROP.',
  columns: [
    {
      name: 'ki_bewertung',
      prompt: 'Klassifiziere diese Zeile nach Relevanz als Lead. Antworte mit genau einem Wort: KEEP oder DROP',
    },
  ],
};

const ALL_PRESETS: ImportPreset[] = [PRESET_LINKEDIN, PRESET_KEEP_DROP];

// ── Overrides: Titel/Modell/Prompt/Version einer eingebauten KI-Spalte in den Einstellungen
//    anpassen (z.B. wenn Uriel v6 baut), ohne Code zu ändern ──
const OVERRIDES_KEY = 'preset_overrides';

export interface PromptOverride {
  prompt: string;
  promptVersion?: string;
  /** neuer Spaltentitel */
  name?: string;
  provider?: string;
  model?: string;
}
type OverrideStore = Record<string, Record<string, PromptOverride>>; // presetId → columnName → override

function loadOverrides(): OverrideStore {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}'); } catch { return {}; }
}

export function savePromptOverride(presetId: string, columnName: string, o: PromptOverride): void {
  const all = loadOverrides();
  all[presetId] = { ...all[presetId], [columnName]: o };
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(all)); } catch {}
}

export function resetPresetOverrides(presetId: string): void {
  const all = loadOverrides();
  delete all[presetId];
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(all)); } catch {}
}

export function hasOverride(presetId: string): boolean {
  return !!loadOverrides()[presetId];
}

/** Original-Spaltennamen einer eingebauten KI-Spalte (Override-Schlüssel), in Spaltenreihenfolge */
export function builtinColumnNames(presetId: string): string[] {
  return ALL_PRESETS.find(p => p.id === presetId)?.columns.map(c => c.name) ?? [];
}

/** Eingebaute KI-Spalten mit gespeicherten Anpassungen zusammengeführt */
function builtinPresets(): ImportPreset[] {
  const overrides = loadOverrides();
  return ALL_PRESETS.map(p => {
    const po = overrides[p.id];
    if (!po) return p;
    // Override-Schlüssel ist der ORIGINAL-Spaltenname; der Titel selbst darf umbenannt sein
    const columns = p.columns.map(col => {
      const o = po[col.name];
      if (!o) return col;
      const merged: PresetColumn = { ...col, name: o.name?.trim() || col.name, prompt: o.prompt, promptVersion: o.promptVersion ?? col.promptVersion };
      if (o.provider) { merged.provider = o.provider; merged.model = o.model; }
      return merged;
    });
    return {
      ...p,
      columns,
      // Preset-Label folgt der (ersten) Spalten-Version, damit Modal & Chips stimmen
      promptVersion: columns.find(c => c.promptVersion)?.promptVersion ?? p.promptVersion,
    };
  });
}

// ── Eigene KI-Spalten: im ⚙-Panel oder in den Einstellungen gespeichert ──
const USER_PRESETS_KEY = 'user_presets';

export function loadUserPresets(): ImportPreset[] {
  let list: ImportPreset[];
  try {
    const raw = JSON.parse(localStorage.getItem(USER_PRESETS_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    list = raw
      .filter((p): p is ImportPreset => !!p && typeof p.id === 'string' && Array.isArray(p.columns))
      .map(p => ({ ...p, userDefined: true }));
  } catch { return []; }
  // Migration: ältere «Vorlagen» mit mehreren Spalten → eine KI-Spalte je Spalte
  // (gleiche Schalter), damit jede einzeln ladbar, editierbar, löschbar ist
  if (list.some(p => p.columns.length !== 1)) {
    const flags = loadFlags();
    const next: ImportPreset[] = [];
    for (const p of list) {
      if (p.columns.length === 1) { next.push(p); continue; }
      p.columns.forEach((col, i) => {
        const id = i === 0 ? p.id : `${p.id}_${i + 1}`;
        next.push({ id, name: col.name, description: p.description, promptVersion: col.promptVersion ?? p.promptVersion, columns: [col], userDefined: true });
        if (i > 0 && flags[p.id]) flags[id] = flags[p.id];
      });
    }
    writeUserPresets(next);
    try { localStorage.setItem(FLAGS_KEY, JSON.stringify(flags)); } catch {}
    return next.filter(p => p.columns.length > 0);
  }
  return list.filter(p => p.columns.length > 0);
}

function writeUserPresets(list: ImportPreset[]): void {
  // Flags leben separat (preset_flags), damit ein Preset-Objekt schlank bleibt
  const slim = list.map(p => ({
    id: p.id, name: p.name, description: p.description, promptVersion: p.promptVersion,
    columns: p.columns, userDefined: true,
  }));
  try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(slim)); } catch {}
}

/** KI-Spalte anlegen oder (gleiche id) überschreiben */
export function saveUserPreset(preset: ImportPreset): ImportPreset {
  const list = loadUserPresets();
  const next: ImportPreset = { ...preset, userDefined: true };
  const i = list.findIndex(p => p.id === preset.id);
  if (i >= 0) list[i] = next; else list.push(next);
  writeUserPresets(list);
  if (preset.autoAdd !== undefined || preset.autoRun !== undefined) {
    setPresetFlags(preset.id, { autoAdd: preset.autoAdd, autoRun: preset.autoRun });
  }
  return next;
}

export function deleteUserPreset(id: string): void {
  writeUserPresets(loadUserPresets().filter(p => p.id !== id));
  const flags = loadFlags();
  delete flags[id];
  try { localStorage.setItem(FLAGS_KEY, JSON.stringify(flags)); } catch {}
}

/** Eindeutige Preset-ID (Zeitstempel + Zufall, damit auch schnelle Doppel-Saves nicht kollidieren) */
export function newPresetId(prefix = 'user'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Aus bestehenden KI-Spalten-Configs eine Vorlage bauen (KI-Modell wird übernommen, Config-ID nicht) */
export function presetFromConfigs(name: string, configs: AnalysisConfig[], extra?: Partial<ImportPreset>): ImportPreset {
  const columns: PresetColumn[] = configs.map(c => ({
    name: c.name, prompt: c.prompt, provider: c.provider, model: c.model,
    inputColumns: c.inputColumns, outputFields: c.outputFields, outputEnums: c.outputEnums, derived: c.derived,
    // "v5*" (angepasst) wird als eigene Version mitgenommen, sonst leer
    promptVersion: c.promptVersion?.replace(/\*$/, '') || undefined,
  }));
  return {
    id: newPresetId(),
    name: name.trim() || `Vorlage ${new Date().toLocaleDateString('de-DE')}`,
    columns,
    userDefined: true,
    ...extra,
  };
}

// ── Instant-Load-Flags (für eingebaute UND eigene Vorlagen) ──
const FLAGS_KEY = 'preset_flags';
type FlagStore = Record<string, PresetFlags>;

function loadFlags(): FlagStore {
  try {
    const raw = JSON.parse(localStorage.getItem(FLAGS_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}

export function getPresetFlags(id: string): PresetFlags {
  return loadFlags()[id] ?? {};
}

/**
 * Lade-Schalter einer KI-Spalte speichern. «direkt ausfüllen» (autoRun) gilt
 * überall, wo die Spalte angehängt wird — Instant Load beim Import UND «Laden»
 * aus dem Tabellen-Menü — und ist deshalb unabhängig von autoAdd.
 */
export function setPresetFlags(id: string, flags: PresetFlags): void {
  const all = loadFlags();
  const autoAdd = Object.fromEntries(Object.entries(flags.autoAdd ?? {}).filter(([, v]) => v));
  const merged: PresetFlags = {};
  if (Object.keys(autoAdd).length) merged.autoAdd = autoAdd;
  if (flags.autoRun) merged.autoRun = true;
  if (Object.keys(merged).length) all[id] = merged; else delete all[id];
  try { localStorage.setItem(FLAGS_KEY, JSON.stringify(all)); } catch {}
}

/** Alle Vorlagen (eingebaut + eigene) inkl. Prompt-Overrides und Instant-Load-Flags */
export function getEffectivePresets(): ImportPreset[] {
  const flags = loadFlags();
  return [...builtinPresets(), ...loadUserPresets()].map(p => {
    const f = flags[p.id];
    return f ? { ...p, autoAdd: f.autoAdd, autoRun: f.autoRun } : p;
  });
}

/** Vorlagen, die bei dieser Quelle automatisch geladen werden sollen */
export function presetsForSource(source: PresetSource): ImportPreset[] {
  return getEffectivePresets().filter(p => p.autoAdd?.[source]);
}

/**
 * Eingabespalten, die die Vorlage voraussetzt, aber im Datensatz fehlen.
 * Leer = anwendbar. Vorlagen ohne inputColumns nutzen alle Spalten und
 * passen immer.
 */
export function presetMissingInputs(p: ImportPreset, fields: string[]): string[] {
  const have = new Set(fields.map(f => f.toLowerCase()));
  const missing = new Set<string>();
  for (const col of p.columns) for (const c of col.inputColumns ?? []) if (!have.has(c.toLowerCase())) missing.add(c);
  return [...missing];
}

/** LinkedIn-Import automatisch erkennen: min. 2 typische Spalten vorhanden */
export function detectPreset(fields: string[]): ImportPreset | null {
  const set = new Set(fields.map(f => f.trim().toLowerCase()));
  const markers = ['linkedin_url', 'voller_name', 'headline', 'jobtitel', 'linkedin_id', 'verbindungsgrad'];
  const hits = markers.filter(m => set.has(m)).length;
  if (hits < 2) return null;
  return getEffectivePresets().find(p => p.id === PRESET_LINKEDIN.id) ?? PRESET_LINKEDIN;
}

/**
 * Provider für neue Vorlagen-Spalten: anthropic bevorzugt (der v5-Prompt ist
 * auf Claude abgestimmt), sonst der erste Provider mit Key (Browser oder Server).
 */
export function pickPresetProvider(serverKeys: Record<string, boolean> = {}): string {
  const local = loadSettings().apiKeys as Record<string, string>;
  const ids = AI_PROVIDERS.map(p => p.id);
  return ['anthropic', ...ids].find(p => local[p] || serverKeys[p]) ?? ids[0];
}

/** Provider mit Key (Browser oder Server) — für die Modellwahl gespeicherter KI-Spalten */
export function availableProviders(serverKeys: Record<string, boolean> = {}): string[] {
  const local = loadSettings().apiKeys as Record<string, string>;
  return AI_PROVIDERS.map(p => p.id).filter(p => local[p] || serverKeys[p]);
}

/**
 * KI-Spalte in fertige AnalysisConfigs umwandeln. Das in ihr gespeicherte
 * Modell wird genommen, wenn sein Provider einen Key hat (providers), sonst der
 * Fallback-Provider mit Standardmodell. Merkt sich die Herkunft (presetId).
 */
function presetToConfigs(preset: ImportPreset, provider: string, providers?: string[]): AnalysisConfig[] {
  return preset.columns.map(col => {
    const { provider: wanted, model: wantedModel, ...rest } = col;
    const usable = !!wanted && (!providers || providers.includes(wanted));
    const prov = usable ? wanted! : provider;
    const model = usable && wantedModel && modelsFor(prov).includes(wantedModel) ? wantedModel : defaultModel(prov);
    return { id: newPresetId('cfg'), provider: prov, model, presetId: preset.id, ...rest };
  });
}

/** Ist diese KI-Spalte im Datensatz schon geladen? (Herkunft oder belegter Spaltenname) */
export function isPresetLoaded(preset: ImportPreset, configs: AnalysisConfig[]): boolean {
  if (configs.some(c => c.presetId === preset.id)) return true;
  const taken = new Set(configs.flatMap(ownedNames));
  return preset.columns.every(c => taken.has(c.name));
}

/** Alle Spaltennamen, die eine Config belegt (Roh-Antwort, Splits, Regeln) */
function ownedNames(c: PresetColumn): string[] {
  return [c.name, ...(c.outputFields ?? []), ...(c.derived?.map(d => d.name) ?? [])];
}

export const AUTORUN_KEY = (runId: string) => `autorun_analysis_${runId}`;

/**
 * Config-IDs, die der Viewer nach dem Laden sofort ausführen soll.
 * Legacy-Wert "1" (alte Version des Import-Dialogs) = erste Config mit Prompt.
 */
export function readAutorunIds(runId: string): string[] | 'first' | null {
  try {
    const raw = localStorage.getItem(AUTORUN_KEY(runId));
    if (!raw) return null;
    if (raw === '1') return 'first';
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : null;
  } catch { return null; }
}

function appendAutorunIds(runId: string, ids: string[]): void {
  if (ids.length === 0) return;
  const prev = readAutorunIds(runId);
  const list = Array.isArray(prev) ? prev : [];
  try { localStorage.setItem(AUTORUN_KEY(runId), JSON.stringify([...list, ...ids.filter(i => !list.includes(i))])); } catch {}
}

export interface ApplyResult {
  /** Neu angehängte Configs (Spalten, die es noch nicht gab) */
  added: AnalysisConfig[];
  /** Vorlagen, deren Spalten schon alle vorhanden waren */
  skipped: ImportPreset[];
  /** Configs, die der Viewer direkt ausfüllen soll */
  autoRun: AnalysisConfig[];
}

/**
 * KI-Spalten in einen Datensatz laden: Configs werden an die bestehenden
 * ANGEHÄNGT (schon geladene übersprungen), gespeichert und — bei autoRun
 * («direkt ausfüllen») bzw. forceAutoRun — zum sofortigen Ausfüllen vorgemerkt.
 * Ein Code-Pfad für Import-Dialog, Instant-Load und das «+ KI-Spalte»-Menü.
 */
export function applyPresets(
  runId: string,
  presets: ImportPreset[],
  provider: string,
  opts: { /** true/false überschreibt den Schalter der KI-Spalte, undefined = Schalter gilt */ forceAutoRun?: boolean; providers?: string[] } = {},
): ApplyResult {
  const configs = loadAiConfigs(runId);
  const taken = new Set(configs.flatMap(ownedNames));
  const loadedIds = new Set(configs.map(c => c.presetId).filter(Boolean));
  const added: AnalysisConfig[] = [];
  const skipped: ImportPreset[] = [];
  const autoRun: AnalysisConfig[] = [];
  for (const preset of presets) {
    // Dieselbe KI-Spalte nie zweimal: weder per Herkunft noch per belegtem Spaltennamen
    if (loadedIds.has(preset.id)) { skipped.push(preset); continue; }
    const fresh = presetToConfigs(preset, provider, opts.providers).filter(c => !ownedNames(c).some(n => taken.has(n)));
    if (fresh.length === 0) { skipped.push(preset); continue; }
    fresh.forEach(c => ownedNames(c).forEach(n => taken.add(n)));
    loadedIds.add(preset.id);
    added.push(...fresh);
    if (opts.forceAutoRun ?? preset.autoRun) autoRun.push(...fresh.filter(c => c.prompt.trim()));
  }
  if (added.length) saveAiConfigs(runId, [...configs, ...added]);
  appendAutorunIds(runId, autoRun.map(c => c.id));
  return { added, skipped, autoRun };
}
