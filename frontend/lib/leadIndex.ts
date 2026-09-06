import { loadCsvRun, listCsvRuns } from './csvRuns';
import { addToIndex, type KnownEntry } from './leadKeys';

/**
 * Alle anderen Datensätze dieses Browsers laden und einen Index bekannter
 * Leads bauen. Älteste Datensätze zuerst, damit «bekannt aus» die erste
 * Quelle nennt. Kaputte Einträge werden übersprungen.
 */
export async function buildKnownIndex(excludeId: string): Promise<{ index: Map<string, KnownEntry>; datasets: number }> {
  // Älteste zuerst, damit «bekannt aus» die erste Quelle nennt
  const metas = listCsvRuns().filter(m => m.id !== excludeId).reverse();
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
