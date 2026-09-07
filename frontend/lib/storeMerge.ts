import Papa from 'papaparse';

/**
 * Konfliktschutz im gemeinsamen Speicher: Hat ein Kollege denselben Key
 * geändert, seit dieses Gerät ihn zuletzt gesehen hat, lehnt der Server das
 * Schreiben ab (409). Hier wird der lokale Stand mit dem Serverstand
 * zusammengeführt — reine Funktionen, getestet.
 *
 * Grenze: Listen werden vereinigt (beide Seiten bleiben, bei gleicher ID gewinnt
 * lokal). Eine Löschung auf der einen Seite kann so wieder auftauchen, wenn die
 * andere Seite gleichzeitig etwas anderes geändert hat — dafür geht nichts verloren.
 */

type Row = Record<string, unknown>;
const parse = (s: string): unknown => { try { return JSON.parse(s); } catch { return undefined; } };
const isObj = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);

/** Listen von Objekten nach Schlüssel vereinigen: Server-Reihenfolge, lokal gewinnt bei gleichem Schlüssel, Neues hinten */
function unionBy(local: Row[], server: Row[], keyOf: (r: Row) => string): Row[] {
  const byKey = new Map<string, Row>();
  for (const r of server) byKey.set(keyOf(r), r);
  for (const r of local) byKey.set(keyOf(r), r);
  return [...byKey.values()];
}

const ID_LISTS = ['user_presets', 'usage_log', 'trash_items'];
const MAP_KEYS = ['presets', 'preset_flags', 'preset_overrides', 'app_budget'];

/** Lokalen und Server-Wert eines kleinen Keys zusammenführen; merged=false heißt: Server gewinnt unverändert */
export function mergeValues(key: string, local: string, server: string): { value: string; merged: boolean } {
  const l = parse(local), s = parse(server);
  const serverWins = { value: server, merged: false };
  if (l === undefined || s === undefined) return serverWins;

  if ((ID_LISTS.includes(key) || key.startsWith('analysis_configs_')) && Array.isArray(l) && Array.isArray(s)) {
    const rows = (a: unknown[]) => a.filter(isObj);
    const keyOf = (r: Row) => String(r.id ?? r.name ?? JSON.stringify(r));
    return { value: JSON.stringify(unionBy(rows(l), rows(s), keyOf)), merged: true };
  }
  if (key === 'blocklist' && Array.isArray(l) && Array.isArray(s)) {
    const rows = (a: unknown[]) => a.filter(isObj);
    return { value: JSON.stringify(unionBy(rows(l), rows(s), r => String(r.pageName ?? ''))), merged: true };
  }
  if (MAP_KEYS.includes(key) && isObj(l) && isObj(s)) {
    return { value: JSON.stringify({ ...s, ...l }), merged: true };
  }
  if (key.startsWith('csv_run_') && isObj(l) && isObj(s)) {
    // Meta: lokal gewinnt bei Feldern, die Spaltenliste wird vereinigt (KI-Spalten beider Seiten)
    const fields = [...new Set([...(Array.isArray(s.fields) ? s.fields : []), ...(Array.isArray(l.fields) ? l.fields : [])])];
    return { value: JSON.stringify({ ...s, ...l, fields }), merged: true };
  }
  return serverWins;
}

/**
 * Zwei Stände desselben Datensatzes zusammenführen: gleiche Zeilenzahl
 * vorausgesetzt (Zeilen werden über den Index zugeordnet). Spalten beider
 * Seiten bleiben; bei gleicher Spalte gewinnt der lokale Wert, wenn er nicht
 * leer ist. null = nicht zusammenführbar (Server gewinnt).
 */
export function mergeCsvText(local: string, server: string): string | null {
  const opts = { header: true as const, skipEmptyLines: true as const };
  const l = Papa.parse<Record<string, string>>(local, opts);
  const s = Papa.parse<Record<string, string>>(server, opts);
  if (l.data.length !== s.data.length || l.data.length === 0) return null;
  const fields = [...new Set([...(s.meta.fields ?? []), ...(l.meta.fields ?? [])])];
  const rows = s.data.map((sr, i) => {
    const lr = l.data[i];
    const out: Record<string, string> = {};
    for (const f of fields) {
      const lv = lr[f] ?? '';
      out[f] = lv !== '' ? lv : (sr[f] ?? '');
    }
    return out;
  });
  return Papa.unparse(rows, { columns: fields });
}
