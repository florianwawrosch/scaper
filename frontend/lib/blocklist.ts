// Blockliste: Facebook/Instagram-Seiten, die grundsätzlich aus
// Scrape-Ergebnissen ausgeschlossen werden. Gespeichert im Browser.
// Zuverlässig blockt nur die Page-ID (die Ads Library liefert sie zu jeder
// Anzeige); der Seitenname ist nur Fallback, weil er sich ändern kann.

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

function saveBlocklist(list: BlockEntry[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

/** Fanpage-Adresse zu einem Eintrag (ID-Form funktioniert immer, auch bei Umbenennung) */
export function fanpageUrl(e: Pick<BlockEntry, 'pageName' | 'pageId'>): string | null {
  if (e.pageId) return `https://www.facebook.com/${e.pageId}`;
  return null;
}

/** Meta Ads Library, gefiltert auf alle Anzeigen dieser Seite */
export function adsLibraryUrl(pageId: string): string {
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${encodeURIComponent(pageId)}&search_type=page`;
}

/**
 * Freie Eingabe in Name + Page-ID zerlegen. Erkannt werden:
 *  - Ads-Library-Link  (…/ads/library/?…view_all_page_id=123…)
 *  - Fanpage-Link      (facebook.com/123, facebook.com/profile.php?id=123, facebook.com/slug)
 *  - reine Page-ID     (nur Ziffern)
 *  - sonst: Seitenname (exakter, nicht case-sensitiver Abgleich)
 */
export function parseBlockInput(text: string): { pageName: string; pageId?: string } | null {
  const raw = text.trim();
  if (!raw) return null;
  if (/^\d{5,}$/.test(raw)) return { pageName: `Page ${raw}`, pageId: raw };
  let url: URL | null = null;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { url = null; }
  if (url && /(^|\.)(facebook|fb|instagram)\.com$/i.test(url.hostname)) {
    const q = url.searchParams;
    const fromQuery = q.get('view_all_page_id') || q.get('id');
    if (fromQuery && /^\d+$/.test(fromQuery)) return { pageName: `Page ${fromQuery}`, pageId: fromQuery };
    const seg = url.pathname.split('/').filter(Boolean);
    const first = seg[0] ?? '';
    if (/^\d{5,}$/.test(first)) return { pageName: `Page ${first}`, pageId: first };
    if (first && !/^(ads|profile\.php|pages|people|groups|search)$/i.test(first)) {
      // Slug-Adresse: Name = Slug, ID unbekannt (Abgleich nur über den Seitennamen)
      return { pageName: decodeURIComponent(first) };
    }
    // «/pages/Name/123»
    if (/^pages$/i.test(first) && /^\d{5,}$/.test(seg[seg.length - 1] ?? '')) {
      return { pageName: decodeURIComponent(seg[1] ?? `Page ${seg[seg.length - 1]}`), pageId: seg[seg.length - 1] };
    }
    return null;
  }
  return { pageName: raw };
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

/** Freie Eingabe (Link, ID oder Name) blocken; null = nichts Verwertbares */
export function addBlockInput(text: string): BlockEntry[] | null {
  const parsed = parseBlockInput(text);
  if (!parsed) return null;
  return addToBlocklist(parsed.pageName, parsed.pageId);
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
