import type { AnalysisConfig } from '@/lib/ai';
import type { DerivedRule } from '@/lib/ai';

/**
 * Single owner of the per-dataset AI-column config store
 * (localStorage `analysis_configs_<id>`), so the key template and the
 * config shape are not re-implemented in every page.
 */
const key = (id: string) => `analysis_configs_${id}`;

export function loadAiConfigs(id: string): AnalysisConfig[] {
  try {
    const raw = localStorage.getItem(key(id));
    if (raw) return JSON.parse(raw) as AnalysisConfig[];
  } catch {}
  return [];
}

export function saveAiConfigs(id: string, configs: AnalysisConfig[]): void {
  try { localStorage.setItem(key(id), JSON.stringify(configs)); } catch {}
}

/**
 * First derived rule whose column actually exists in the dataset —
 * the "Zielgruppe" switch pages use to filter classified rows.
 */
export function findDerivedRule(configs: AnalysisConfig[], fields: string[]): DerivedRule | null {
  for (const cfg of configs) {
    const rule = cfg.derived?.find(d => fields.includes(d.name));
    if (rule) return rule;
  }
  return null;
}

/**
 * Zielgruppen-Spalte + Trefferwert: eine Regel-Spalte (ältere Multi-Output-
 * Configs) oder die Ja/Nein-Spalte «ki_zielgruppe» (LinkedIn-KI-Spalte).
 */
export function findAudience(configs: AnalysisConfig[], fields: string[]): { column: string; value: string } | null {
  const rule = findDerivedRule(configs, fields);
  if (rule) return { column: rule.name, value: rule.then };
  if (configs.some(c => c.name === 'ki_zielgruppe') || fields.includes('ki_zielgruppe')) return { column: 'ki_zielgruppe', value: 'ja' };
  return null;
}
