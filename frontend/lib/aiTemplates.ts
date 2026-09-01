// Standard-KI-Spalten-Vorlagen, die beim CSV/LinkedIn-Import geladen werden.
// Die LinkedIn-Klassifizierung ist Uriels Sheet-Vorlage (ki_linkedin_klassifizierung, v5):
// EIN Prompt liefert sieben pipe-getrennte Werte, die in einzelne Spalten
// gesplittet werden; die Zielgruppen-Entscheidung ist eine deterministische
// Regel über die Ausgaben — keine eigene KI-Frage.

import type { AnalysisConfig } from '@/app/components/AnalysisPanel';
import type { DerivedRule } from '@/lib/ai';
import { defaultModel } from '@/lib/ai';

export interface ImportPreset {
  id: string;
  name: string;
  description?: string;
  promptVersion?: string;
  columns: Omit<AnalysisConfig, 'id' | 'model' | 'provider'>[];
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
export function getEffectivePresets(): ImportPreset[] {
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

/** LinkedIn-Import automatisch erkennen: min. 2 typische Spalten vorhanden */
export function detectPreset(fields: string[]): ImportPreset | null {
  const set = new Set(fields.map(f => f.trim().toLowerCase()));
  const markers = ['linkedin_url', 'voller_name', 'headline', 'jobtitel', 'linkedin_id', 'verbindungsgrad'];
  const hits = markers.filter(m => set.has(m)).length;
  if (hits < 2) return null;
  return getEffectivePresets().find(p => p.id === PRESET_LINKEDIN.id) ?? PRESET_LINKEDIN;
}

/** Preset in fertige AnalysisConfigs umwandeln (Provider/Modell = erster verfügbarer) */
export function presetToConfigs(preset: ImportPreset, provider: string): AnalysisConfig[] {
  return preset.columns.map((col, idx) => ({
    id: `cfg_${Date.now()}_${idx}`,
    provider,
    model: defaultModel(provider),
    ...col,
  }));
}
