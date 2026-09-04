// Gespeicherte KI-Spalten (Einstellungen → KI-Spalten). Eine KI-Spalte hat:
// Titel, KI-Modell (Anbieter), KI-Version (Modell), Prompt und die Lade-Schalter
// (bei CSV, bei Meta, direkt ausfüllen). Intern ist das ein ImportPreset mit
// genau EINER Spalte — eingebaut (Code + Override) oder eigene (localStorage).
// Ein Prompt, ein Aufruf pro Zeile, eine Antwort, eine Tabellenspalte.

import type { AnalysisConfig } from '@/lib/ai';
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

/** Die Spalte einer KI-Spalte — immer mit konkretem Anbieter (provider) und Modell */
export type PresetColumn = Omit<AnalysisConfig, 'id' | 'presetId'>;

export interface ImportPreset extends PresetFlags {
  id: string;
  name: string;
  description?: string;
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

Entscheide danach, ob die Person zur Zielgruppe gehoert. Zielgruppe = ja,
wenn ALLE drei Punkte zutreffen:
- Sie bietet selbst Coaching, Training, Mentoring, Seminare oder Ausbildung an
  (erkennbar oder wahrscheinlich).
- Sie ist KEINE Marketingagentur (fuehrt keine Ads, SEO, Funnels oder Webdesign
  fuer fremde Firmen aus).
- Sie ist selbststaendig oder fuehrt ein Unternehmen (nicht angestellt).

Antworte mit GENAU EINEM Wort, ohne Erklaerung: ja oder nein.

Daten der Person:`;

const LINKEDIN_INPUT_COLUMNS = [
  'voller_name', 'jobtitel', 'firma', 'branche', 'firmengroesse',
  'firmenbeschreibung', 'specialities', 'headline', 'skills', 'beschreibung',
];

const PRESET_LINKEDIN: ImportPreset = {
  id: 'linkedin_klassifizierung_v5',
  name: 'LinkedIn-Klassifizierung',
  description: 'Uriels LinkedIn-Prompt: Ist die Person ein selbstständiger Coach/Trainer (keine Agentur)? Antwort ja oder nein.',
  columns: [
    {
      name: 'ki_zielgruppe',
      prompt: LINKEDIN_V5_PROMPT,
      inputColumns: LINKEDIN_INPUT_COLUMNS,
      provider: 'anthropic',
      model: 'claude-sonnet-5',
    },
  ],
};

const PRESET_KEEP_DROP: ImportPreset = {
  id: 'keep_drop',
  name: 'Einfache KEEP/DROP-Klassifizierung',
  description: 'Ist die Zeile ein relevanter Lead? Antwort KEEP oder DROP.',
  columns: [
    {
      name: 'ki_bewertung',
      prompt: 'Klassifiziere diese Zeile nach Relevanz als Lead. Antworte mit genau einem Wort: KEEP oder DROP',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
    },
  ],
};

const ALL_PRESETS: ImportPreset[] = [PRESET_LINKEDIN, PRESET_KEEP_DROP];

// ── Overrides: Titel/Modell/Prompt/Version einer eingebauten KI-Spalte in den Einstellungen
//    anpassen (z.B. wenn Uriel v6 baut), ohne Code zu ändern ──
const OVERRIDES_KEY = 'preset_overrides';

export interface PromptOverride {
  prompt: string;
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
      const merged: PresetColumn = { ...col, name: o.name?.trim() || col.name, prompt: o.prompt };
      if (o.provider) { merged.provider = o.provider; merged.model = o.model && modelsFor(o.provider).includes(o.model) ? o.model : defaultModel(o.provider); }
      return merged;
    });
    return { ...p, columns };
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
  // Migration 1: ältere «Vorlagen» mit mehreren Spalten → eine KI-Spalte je Spalte
  // (gleiche Schalter), damit jede einzeln ladbar, editierbar, löschbar ist
  let changed = false;
  if (list.some(p => p.columns.length !== 1)) {
    const flags = loadFlags();
    const next: ImportPreset[] = [];
    for (const p of list) {
      if (p.columns.length === 1) { next.push(p); continue; }
      p.columns.forEach((col, i) => {
        const id = i === 0 ? p.id : `${p.id}_${i + 1}`;
        next.push({ id, name: col.name, description: p.description, columns: [col], userDefined: true });
        if (i > 0 && flags[p.id]) flags[id] = flags[p.id];
      });
    }
    list = next.filter(p => p.columns.length > 0);
    try { localStorage.setItem(FLAGS_KEY, JSON.stringify(flags)); } catch {}
    changed = true;
  }
  // Migration 2: KI-Spalten ohne konkretes Modell bekommen den ersten Anbieter mit Key
  for (const p of list) {
    const col = p.columns[0];
    if (!col.provider || !modelsFor(col.provider).length) { col.provider = pickPresetProvider(); col.model = defaultModel(col.provider); changed = true; }
    else if (!col.model || !modelsFor(col.provider).includes(col.model)) { col.model = defaultModel(col.provider); changed = true; }
  }
  if (changed) writeUserPresets(list);
  return list;
}

function writeUserPresets(list: ImportPreset[]): void {
  // Flags leben separat (preset_flags), damit ein Preset-Objekt schlank bleibt
  const slim = list.map(p => ({ id: p.id, name: p.name, description: p.description, columns: p.columns, userDefined: true }));
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

/** Aus bestehenden KI-Spalten-Configs eine KI-Spalte bauen (Anbieter + Modell werden übernommen, Config-ID nicht) */
export function presetFromConfigs(name: string, configs: AnalysisConfig[], extra?: Partial<ImportPreset>): ImportPreset {
  const columns: PresetColumn[] = configs.map(c => ({
    name: c.name, prompt: c.prompt, provider: c.provider, model: c.model,
    inputColumns: c.inputColumns, outputFields: c.outputFields, outputEnums: c.outputEnums, derived: c.derived,
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
 * KI-Spalte in fertige AnalysisConfigs umwandeln. Anbieter + Modell der
 * KI-Spalte werden genommen, wenn der Anbieter einen Key hat (providers), sonst
 * der Fallback-Anbieter mit seinem ersten Modell. Merkt sich die Herkunft (presetId).
 */
function presetToConfigs(preset: ImportPreset, provider: string, providers?: string[]): AnalysisConfig[] {
  return preset.columns.map(col => {
    const usable = !!col.provider && (!providers || providers.includes(col.provider));
    const prov = usable ? col.provider : provider;
    const model = usable && modelsFor(prov).includes(col.model) ? col.model : defaultModel(prov);
    return { ...col, id: newPresetId('cfg'), provider: prov, model, presetId: preset.id };
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
