import { saveSavedSearch, type SavedSearch } from './savedSearches';
import { saveUserPreset, type ImportPreset } from './aiTemplates';
import { addToBlocklist } from './blocklist';
import { removeTrashItem, type TrashItem } from './trash';

/**
 * Kleineintrag aus dem Papierkorb zurückholen (Suche, KI-Spalte, Blocklisten-
 * Eintrag) — getrennt von lib/trash.ts, damit die Lösch-Funktionen dort nur
 * den Papierkorb kennen und kein Import-Kreis entsteht. Liefert das Label.
 */
export function restoreTrashItem(item: TrashItem): string {
  if (item.kind === 'search') {
    const p = item.payload as { name: string; cfg: SavedSearch };
    saveSavedSearch(p.name, p.cfg);
  } else if (item.kind === 'ki') {
    saveUserPreset(item.payload as ImportPreset);
  } else {
    const e = item.payload as { pageName: string; pageId?: string };
    addToBlocklist(e.pageName, e.pageId);
  }
  removeTrashItem(item.id);
  return item.label;
}
