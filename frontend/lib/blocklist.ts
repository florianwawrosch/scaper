// Blockliste: Facebook/Instagram-Seiten, die grundsätzlich aus
// Scrape-Ergebnissen ausgeschlossen werden. Gespeichert im Browser.

export interface BlockEntry {
  pageName: string;
  pageId?: string;
  addedAt: string;
}

const KEY = 'blocklist';

export function loadBlocklist(): BlockEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveBlocklist(list: BlockEntry[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export function addToBlocklist(pageName: string, pageId?: string): BlockEntry[] {
  const list = loadBlocklist();
  const name = pageName.trim();
  if (!name) return list;
  const exists = list.some(e =>
    e.pageName.toLowerCase() === name.toLowerCase() || (pageId && e.pageId === pageId));
  if (exists) return list;
  const next = [...list, { pageName: name, pageId, addedAt: new Date().toISOString() }];
  saveBlocklist(next);
  return next;
}

export function removeFromBlocklist(pageName: string): BlockEntry[] {
  const next = loadBlocklist().filter(e => e.pageName.toLowerCase() !== pageName.toLowerCase());
  saveBlocklist(next);
  return next;
}

/** Filter scrape rows: drop rows whose page_name/page_id is blocked. */
export function applyBlocklist(rows: Record<string, string>[]): { kept: Record<string, string>[]; blocked: number } {
  const list = loadBlocklist();
  if (list.length === 0) return { kept: rows, blocked: 0 };
  const names = new Set(list.map(e => e.pageName.toLowerCase()));
  const ids   = new Set(list.filter(e => e.pageId).map(e => e.pageId));
  const kept = rows.filter(r =>
    !names.has(String(r.page_name ?? '').toLowerCase()) && !ids.has(String(r.page_id ?? '')));
  return { kept, blocked: rows.length - kept.length };
}
