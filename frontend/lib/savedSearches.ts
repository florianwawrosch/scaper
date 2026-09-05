/** Gespeicherte Suchen der Scrape-Maske (localStorage "presets") */
export interface SavedSearch {
  keywords?: string[]; country?: string; countries?: string[]; platforms?: string[];
  adStatus?: string; mediaType?: string; searchType?: string; languages?: string[];
  dateMin?: string; dateMax?: string; limit?: number; bylines?: string; savedAt?: string;
}

import { lsSet } from './store';

const KEY = 'presets';

export function loadSavedSearches(): Record<string, SavedSearch> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}

function write(all: Record<string, SavedSearch>): Record<string, SavedSearch> {
  lsSet(KEY, JSON.stringify(all));
  return all;
}

/** Suche unter `name` anlegen/überschreiben; liefert den neuen Gesamtstand */
export function saveSavedSearch(name: string, cfg: Omit<SavedSearch, 'savedAt'>): Record<string, SavedSearch> {
  return write({ ...loadSavedSearches(), [name]: { ...cfg, savedAt: new Date().toISOString() } });
}

export function deleteSavedSearch(name: string): Record<string, SavedSearch> {
  const all = loadSavedSearches();
  delete all[name];
  return write(all);
}
