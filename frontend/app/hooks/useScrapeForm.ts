'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { createCsvRun } from '@/lib/csvRuns';
import { applyBlocklist } from '@/lib/blocklist';
import { loadSettings } from '@/lib/settings';
import type { SavedSearch } from '@/lib/savedSearches';
import type { PresetSource } from '@/lib/aiTemplates';
import { useToast } from '@/app/components/Toast';

/** Alle Felder der Meta-Ads-Suchmaske */
export interface ScrapeFormValues {
  tags: string[]; country: string; platforms: string[]; adStatus: string; mediaType: string;
  searchType: string; languages: string[]; dateMin: string; dateMax: string; limit: number; bylines: string;
}

export const DEFAULT_FORM: ScrapeFormValues = {
  tags: [], country: 'DE', platforms: ['FACEBOOK', 'INSTAGRAM'], adStatus: 'ACTIVE', mediaType: 'ALL',
  searchType: 'KEYWORD_UNORDERED', languages: [], dateMin: '', dateMax: '', limit: 100, bylines: '',
};

interface Options {
  /** Instant-Load-Vorlagen an den neuen Datensatz hängen (Startseite kennt die Server-Keys) */
  autoApplyPresets: (runId: string, source: PresetSource) => Set<string>;
}

/**
 * Suchmaske der Startseite: Feld-State, Vorbelegung («Erneut scrapen»,
 * gespeicherte Suche), Blocklisten-/Gruppierungs-Schalter und der Scrape-
 * Aufruf selbst (Meta Ads Library → CSV-Datensatz → Viewer).
 */
export function useScrapeForm({ autoApplyPresets }: Options) {
  const router = useRouter();
  const { showToast } = useToast();
  const [values,       setValues]       = useState<ScrapeFormValues>(DEFAULT_FORM);
  const [creating,     setCreating]     = useState(false);
  const [formError,    setFormError]    = useState('');
  const [useBlocklist, setUseBlocklist] = useState(true);
  const [groupByPage,  setGroupByPage]  = useState(true);

  const update = (patch: Partial<ScrapeFormValues>) => setValues(v => ({ ...v, ...patch }));

  /** Gespeicherte Suche / Scrape-Konfiguration übernehmen — nur vorhandene Felder */
  const applyConfig = (c: Partial<SavedSearch> & { keywords?: unknown }) => {
    const patch: Partial<ScrapeFormValues> = {};
    if (Array.isArray(c.keywords))  patch.tags = c.keywords.map(String);
    const country = c.country ?? c.countries?.[0];
    if (country)                    patch.country = String(country);
    if (Array.isArray(c.platforms)) patch.platforms = c.platforms;
    if (c.adStatus)                 patch.adStatus = c.adStatus;
    if (c.mediaType)                patch.mediaType = c.mediaType;
    if (c.searchType)               patch.searchType = c.searchType;
    if (Array.isArray(c.languages)) patch.languages = c.languages;
    if (c.dateMin !== undefined)    patch.dateMin = c.dateMin;
    if (c.dateMax !== undefined)    patch.dateMax = c.dateMax;
    if (c.limit)                    patch.limit = Number(c.limit);
    if (c.bylines !== undefined)    patch.bylines = c.bylines;
    update(patch);
  };

  /** Aktuelle Maske als speicherbare Konfiguration (gespeicherte Suche, scrapeConfig) */
  const toConfig = (): Omit<SavedSearch, 'savedAt'> => {
    const { tags, ...rest } = values;
    return { keywords: tags, ...rest };
  };

  // «Erneut scrapen» aus dem Viewer: Konfiguration liegt einmalig in localStorage
  useEffect(() => {
    try {
      const rc = localStorage.getItem('rescrape_config');
      if (!rc) return;
      localStorage.removeItem('rescrape_config');
      // localStorage gibt es erst im Browser — daher Effect statt lazy useState
      // eslint-disable-next-line react-hooks/set-state-in-effect
      applyConfig(JSON.parse(rc));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScrape = async () => {
    setFormError('');
    const { tags, country, platforms, adStatus, mediaType, searchType, languages, dateMin, dateMax, limit, bylines } = values;
    if (tags.length === 0) { setFormError('Mindestens einen Suchbegriff eingeben'); return; }
    // Token from browser settings if present — otherwise the Vercel server
    // reads it from its env vars (META_API_KEY etc., see lib/serverKeys.ts).
    const token = loadSettings().apiKeys.meta_ads;
    setCreating(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: tags,
          countries: country === 'ALL' ? ['ALL'] : [country],
          platforms,
          ad_status: adStatus,
          media_type: mediaType,
          search_type: searchType,
          ...(languages.length > 0 && { languages }),
          ...(dateMin && { ad_delivery_date_min: dateMin }),
          ...(dateMax && { ad_delivery_date_max: dateMax }),
          limit,
          ...(bylines && { bylines: bylines.split(',').map(s => s.trim()).filter(Boolean) }),
          ...(token && { meta_ads_token: token }),
        }),
      });
      if (!res.ok) {
        let msg = `Scraping fehlgeschlagen (HTTP ${res.status})`;
        try { msg = (await res.json()).detail ?? msg; } catch {}
        throw new Error(msg);
      }
      const { rows } = await res.json() as { rows: Record<string, string>[] };
      if (!rows?.length) {
        setFormError('Keine Ads gefunden — andere Suchbegriffe oder Filter probieren.');
        return;
      }

      // Apply the blocklist (pages the user always wants excluded)
      let finalRows = rows;
      if (useBlocklist) {
        const { kept, blocked } = applyBlocklist(rows);
        if (blocked > 0) showToast(`${blocked} Zeilen durch Blockliste entfernt`, 'info');
        if (kept.length === 0) {
          setFormError(`Alle ${rows.length} gefundenen Ads stehen auf der Blockliste.`);
          return;
        }
        finalRows = kept;
      }

      // One row per page: the lead is the fanpage, not each individual ad
      if (groupByPage) {
        const byPage = new Map<string, Record<string, string> & { ads_count: string }>();
        for (const row of finalRows) {
          const key = String(row.page_id || row.page_name || '').trim();
          if (!key) continue;
          const existing = byPage.get(key);
          if (existing) {
            existing.ads_count = String(Number(existing.ads_count) + 1);
            // Keep the longest ad text as the representative one
            if ((row.ad_text?.length ?? 0) > (existing.ad_text?.length ?? 0)) existing.ad_text = row.ad_text;
          } else {
            byPage.set(key, { ...row, ads_count: '1' });
          }
        }
        const grouped = [...byPage.values()];
        if (grouped.length > 0 && grouped.length < finalRows.length) {
          showToast(`${finalRows.length} Ads → ${grouped.length} Seiten zusammengefasst`, 'info');
        }
        if (grouped.length > 0) finalRows = grouped;
      }

      // Store the result through the proven CSV pipeline (IndexedDB + viewer)
      const id = await createCsvRun({
        filename: `Meta: ${tags.join(', ')}`,
        fields: Object.keys(finalRows[0]),
        csvText: Papa.unparse(finalRows),
        rowCount: finalRows.length,
        scrapeConfig: toConfig(), // Saved so the run can be repeated with the same settings
      });
      autoApplyPresets(id, 'meta');
      router.push(`/csv/${id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Fehler beim Scrapen');
    } finally {
      setCreating(false);
    }
  };

  // Einzel-Setter, damit die Seite ihre JSX-Bindings behält (setTags, setCountry, …)
  const setters = useMemo(() => ({
    setTags:       (v: string[]) => setValues(s => ({ ...s, tags: v })),
    setCountry:    (v: string)   => setValues(s => ({ ...s, country: v })),
    setPlatforms:  (v: string[]) => setValues(s => ({ ...s, platforms: v })),
    setAdStatus:   (v: string)   => setValues(s => ({ ...s, adStatus: v })),
    setMediaType:  (v: string)   => setValues(s => ({ ...s, mediaType: v })),
    setSearchType: (v: string)   => setValues(s => ({ ...s, searchType: v })),
    setLanguages:  (v: string[]) => setValues(s => ({ ...s, languages: v })),
    setDateMin:    (v: string)   => setValues(s => ({ ...s, dateMin: v })),
    setDateMax:    (v: string)   => setValues(s => ({ ...s, dateMax: v })),
    setLimit:      (v: number)   => setValues(s => ({ ...s, limit: v })),
    setBylines:    (v: string)   => setValues(s => ({ ...s, bylines: v })),
  }), []);

  return {
    ...values, ...setters,
    applyConfig, toConfig, startScrape,
    creating, formError, setFormError,
    useBlocklist, setUseBlocklist, groupByPage, setGroupByPage,
  };
}
