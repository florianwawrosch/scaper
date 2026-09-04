import { loadCsvRun } from './csvRuns';
import { addToIndex, type KnownEntry } from './leadKeys';

/**
 * Alle anderen Datensätze dieses Browsers laden und einen Index bekannter
 * Leads bauen. Älteste Datensätze zuerst, damit «bekannt aus» die erste
 * Quelle nennt. Kaputte Einträge werden übersprungen.
 */
export async function buildKnownIndex(excludeId: string): Promise<{ index: Map<string, KnownEntry>; datasets: number }> {
  const metas: { id: string; createdAt: string; filename: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('csv_run_')) continue;
    const id = key.slice('csv_run_'.length);
    if (id === excludeId) continue;
    try {
      const m = JSON.parse(localStorage.getItem(key) ?? '{}');
      metas.push({ id, createdAt: String(m.createdAt ?? ''), filename: String(m.filename ?? id) });
    } catch {}
  }
  metas.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const index = new Map<string, KnownEntry>();
  let datasets = 0;
  for (const m of metas) {
    try {
      const { rows } = await loadCsvRun(m.id);
      addToIndex(index, rows, { datasetId: m.id, filename: m.filename });
      datasets++;
    } catch {}
  }
  return { index, datasets };
}
