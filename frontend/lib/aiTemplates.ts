// Standard-KI-Spalten-Vorlagen, die beim CSV/LinkedIn-Import geladen werden.
// Die LinkedIn-Klassifizierung ist Uriels Sheet-Vorlage (ki_linkedin_klassifizierung, v5):
// EIN Prompt liefert sieben pipe-getrennte Werte, die in einzelne Spalten
// gesplittet werden; die Zielgruppen-Entscheidung ist eine deterministische
// Regel über die Ausgaben — keine eigene KI-Frage.

import type { AnalysisConfig } from '@/app/components/AnalysisPanel';
import type { DerivedRule } from '@/lib/ai';
import { defaultModel } from '@/lib/ai';
import { loadAiConfigs, saveAiConfigs } from '@/lib/analysisConfigs';
import { AI_PROVIDERS } from '@/lib/ai';
import { loadSettings } from '@/lib/settings';

/** Import-Quelle, für die eine Vorlage automatisch geladen werden kann */
export type PresetSource = 'csv' | 'meta';
export const PRESET_SOURCES: { key: PresetSource; label: string }[] = [
  { key: 'csv',  label: 'CSV/Excel-Upload' },
  { key: 'meta', label: 'Meta-Scrape' },
];

/** Instant-Load-Schalter einer Vorlage (Einstellungen → KI-Vorlagen) */
export interface PresetFlags {
  /** Spalten bei diesen Quellen automatisch anhängen, ohne Dialog */
  autoAdd?: Partial<Record<PresetSource, boolean>>;
  /** Nach dem automatischen Anhängen sofort ausfüllen lassen (kostet Credits) */
  autoRun?: boolean;
}

export type PresetColumn = Omit<AnalysisConfig, 'id' | 'model' | 'provider'>;

export interface ImportPreset extends PresetFlags {
  id: string;
  name: string;
  description?: string;
  promptVersion?: string;
  columns: PresetColumn[];
  /** Vom Nutzer gespeicherte Vorlage (localStorage) — frei editier-/löschbar */
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
  description: 'Uriels Vorlage: 1 KI-Aufruf → 7 Spalten (Haupttyp, Coaching, Agentur, Themenfeld, Status, Rollenbezug, Sicherheit) + Zielgruppen-Regel',
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

// ── Overrides: Prompt/Version einer Vorlage zentral in den Einstellungen
//    anpassen (z.B. wenn Uriel v6 baut), ohne Code zu ändern ──
const OVERRIDES_KEY = 'preset_overrides';

export interface PromptOverride { prompt: string; promptVersion?: string }
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

/** Eingebaute Vorlagen mit gespeicherten Prompt-Anpassungen zusammengeführt */
function builtinPresets(): ImportPreset[] {
  const overrides = loadOverrides();
  return ALL_PRESETS.map(p => {
    const po = overrides[p.id];
    if (!po) return p;
    const columns = p.columns.map(col => {
      const o = po[col.name];
      return o ? { ...col, prompt: o.prompt, promptVersion: o.promptVersion ?? col.promptVersion } : col;
    });
    return {
      ...p,
      columns,
      // Preset-Label folgt der (ersten) Spalten-Version, damit Modal & Chips stimmen
      promptVersion: columns.find(c => c.promptVersion)?.promptVersion ?? p.promptVersion,
    };
  });
}

// ── Eigene Vorlagen: aus dem ⚙-Panel / der Tabelle gespeicherte KI-Spalten ──
const USER_PRESETS_KEY = 'user_presets';

export function loadUserPresets(): ImportPreset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_PRESETS_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((p): p is ImportPreset => !!p && typeof p.id === 'string' && Array.isArray(p.columns))
      .map(p => ({ ...p, userDefined: true }));
  } catch { return []; }
}

function writeUserPresets(list: ImportPreset[]): void {
  // Flags leben separat (preset_flags), damit ein Preset-Objekt schlank bleibt
  const slim = list.map(p => ({
    id: p.id, name: p.name, description: p.description, promptVersion: p.promptVersion,
    columns: p.columns, userDefined: true,
  }));
  try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(slim)); } catch {}
}

/** Vorlage anlegen oder (gleiche id) überschreiben */
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

/** Aus bestehenden KI-Spalten-Configs eine Vorlage bauen (Provider/Modell/ID werden NICHT übernommen) */
export function presetFromConfigs(name: string, configs: AnalysisConfig[], extra?: Partial<ImportPreset>): ImportPreset {
  const columns: PresetColumn[] = configs.map(c => ({
    name: c.name, prompt: c.prompt,
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

export function setPresetFlags(id: string, flags: PresetFlags): void {
  const all = loadFlags();
  const autoAdd = Object.fromEntries(Object.entries(flags.autoAdd ?? {}).filter(([, v]) => v));
  const merged: PresetFlags = {};
  if (Object.keys(autoAdd).length) merged.autoAdd = autoAdd;
  // "Direkt ausfüllen" ohne Instant-Load ergibt keinen Sinn — dann verwerfen
  if (flags.autoRun && merged.autoAdd) merged.autoRun = true;
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

/** Preset in fertige AnalysisConfigs umwandeln (Provider/Modell = erster verfügbarer) */
export function presetToConfigs(preset: ImportPreset, provider: string): AnalysisConfig[] {
  return preset.columns.map(col => ({
    id: newPresetId('cfg'),
    provider,
    model: defaultModel(provider),
    ...col,
  }));
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
 * Vorlagen in einen Datensatz laden: Spalten werden an die bestehenden
 * KI-Configs ANGEHÄNGT (gleichnamige übersprungen), gespeichert und — bei
 * autoRun bzw. forceAutoRun — zum sofortigen Ausfüllen vorgemerkt.
 * Ein Code-Pfad für Import-Dialog, Instant-Load und «Vorlage laden» im Viewer.
 */
export function applyPresets(
  runId: string,
  presets: ImportPreset[],
  provider: string,
  opts: { forceAutoRun?: boolean } = {},
): ApplyResult {
  const configs = loadAiConfigs(runId);
  const taken = new Set(configs.flatMap(ownedNames));
  const added: AnalysisConfig[] = [];
  const skipped: ImportPreset[] = [];
  const autoRun: AnalysisConfig[] = [];
  for (const preset of presets) {
    const fresh = presetToConfigs(preset, provider).filter(c => !ownedNames(c).some(n => taken.has(n)));
    if (fresh.length === 0) { skipped.push(preset); continue; }
    fresh.forEach(c => ownedNames(c).forEach(n => taken.add(n)));
    added.push(...fresh);
    if (opts.forceAutoRun || preset.autoRun) autoRun.push(...fresh.filter(c => c.prompt.trim()));
  }
  if (added.length) saveAiConfigs(runId, [...configs, ...added]);
  appendAutorunIds(runId, autoRun.map(c => c.id));
  return { added, skipped, autoRun };
}
