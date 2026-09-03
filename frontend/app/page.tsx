'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { deleteCsvText } from '@/lib/csvStorage';
import { loadSavedSearches, saveSavedSearch, deleteSavedSearch, type SavedSearch } from '@/lib/savedSearches';
import { createCsvRun } from '@/lib/csvRuns';
import { api, type ScrapeRun } from '@/lib/api';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { loadBlocklist, applyBlocklist } from '@/lib/blocklist';
import { loadSettings } from '@/lib/settings';
import { presetsForSource, applyPresets, pickPresetProvider, type PresetSource } from '@/lib/aiTemplates';
import { useCsvImport } from '@/app/hooks/useCsvImport';
import { useToast } from '@/app/components/Toast';
import { ConfirmDelete } from '@/app/components/ConfirmDelete';
import { PresetSelector } from '@/app/components/PresetSelector';
import { SavedSearchesModal } from '@/app/components/SavedSearchesModal';
import { TagInput } from '@/app/components/TagInput';
import { CountrySelect } from '@/app/components/CountrySelect';
import { T } from '@/app/theme';

const PLATFORM_OPTIONS = [
  { value: 'FACEBOOK',  label: 'Facebook'  },
  { value: 'INSTAGRAM', label: 'Instagram' },
];
const AD_STATUS_OPTIONS = [
  { value: 'ACTIVE',   label: 'Aktiv'   },
  { value: 'ALL',      label: 'Alle'    },
  { value: 'INACTIVE', label: 'Inaktiv' },
];
const MEDIA_TYPE_OPTIONS = [
  { value: 'ALL',   label: 'Alle'   },
  { value: 'IMAGE', label: 'Bild'   },
  { value: 'VIDEO', label: 'Video'  },
  { value: 'MEME',  label: 'Meme'   },
];
const SEARCH_TYPE_OPTIONS = [
  { value: 'KEYWORD_UNORDERED',    label: 'Ungeordnet'    },
  { value: 'KEYWORD_EXACT_PHRASE', label: 'Exakter Begriff' },
];
const LANGUAGE_OPTIONS = [
  { value: 'de', label: 'DE' },
  { value: 'en', label: 'EN' },
  { value: 'fr', label: 'FR' },
  { value: 'es', label: 'ES' },
  { value: 'it', label: 'IT' },
  { value: 'nl', label: 'NL' },
  { value: 'pl', label: 'PL' },
];
const LIMIT_OPTIONS = [50, 100, 250, 500, 1000];

const STATUS_PILL: Record<ScrapeRun['status'], { label: string; cls: string }> = {
  draft:         { label: 'Draft',    cls: 'muted' },
  scraping:      { label: 'Scraping', cls: 'warn'  },
  dataset_ready: { label: 'Bereit',   cls: 'good'  },
  in_progress:   { label: 'Aktiv',    cls: 'warn'  },
  completed:     { label: 'Fertig',   cls: 'good'  },
  failed:        { label: 'Fehler',   cls: 'bad'   },
};

function ChipGroup({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map(o => <button key={o.value} onClick={() => toggle(o.value)} className={`chip ${value.includes(o.value) ? 'active' : ''}`}>{o.label}</button>)}
    </div>
  );
}

function SingleChip({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map(o => <button key={o.value} onClick={() => onChange(o.value)} className={`chip ${value === o.value ? 'active' : ''}`}>{o.label}</button>)}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [runs,           setRuns]           = useState<ScrapeRun[]>([]);
  const [csvRuns,        setCsvRuns]        = useState<{id:string;filename:string;createdAt:string;rowCount:number}[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [creating,       setCreating]       = useState(false);
  const [tags,           setTags]           = useState<string[]>([]);
  const [country,        setCountry]        = useState('DE');
  const [platforms,      setPlatforms]      = useState(['FACEBOOK', 'INSTAGRAM']);
  const [adStatus,       setAdStatus]       = useState('ACTIVE');
  const [mediaType,      setMediaType]      = useState('ALL');
  const [searchType,     setSearchType]     = useState('KEYWORD_UNORDERED');
  const [languages,      setLanguages]      = useState<string[]>([]);
  const [dateMin,        setDateMin]        = useState('');
  const [dateMax,        setDateMax]        = useState('');
  const [limit,          setLimit]          = useState(100);
  const [bylines,        setBylines]        = useState('');
  const [presets,        setPresets]        = useState<Record<string, SavedSearch>>({});
  const [presetName,     setPresetName]     = useState('');
  const [showPresets,    setShowPresets]    = useState(false);
  const [formError,      setFormError]      = useState('');
  const [backendKeys,    setBackendKeys]    = useState<Record<string, boolean>>({});
  const [useBlocklist,   setUseBlocklist]   = useState(true);
  const [blockCount,     setBlockCount]     = useState(0);
  const [groupByPage,    setGroupByPage]    = useState(true);

  /** Suchmaske aus einer gespeicherten Scrape-Konfiguration (Backend-Run) befüllen */
  const applyRunConfig = (cfg: Record<string, unknown>) => {
    const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : null);
    const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
    if (cfg.keywords) setTags(list(cfg.keywords) ?? String(cfg.keywords).split('\n').filter(Boolean));
    if (cfg.countries) setCountry(list(cfg.countries)?.[0] ?? text(cfg.countries) ?? 'DE');
    const platforms  = list(cfg.platforms);            if (platforms)  setPlatforms(platforms);
    const adStatus   = text(cfg.ad_status);            if (adStatus)   setAdStatus(adStatus);
    const mediaType  = text(cfg.media_type);           if (mediaType)  setMediaType(mediaType);
    const searchType = text(cfg.search_type);          if (searchType) setSearchType(searchType);
    const languages  = list(cfg.languages);            if (languages)  setLanguages(languages);
    const dateMin    = text(cfg.ad_delivery_date_min); if (dateMin)    setDateMin(dateMin);
    const dateMax    = text(cfg.ad_delivery_date_max); if (dateMax)    setDateMax(dateMax);
    const limit      = Number(cfg.limit);              if (limit)      setLimit(limit);
    const bylines    = text(cfg.bylines);              if (bylines)    setBylines(bylines);
  };

  useEffect(() => {
    // Local history renders instantly — no waiting for any network call.
    // localStorage gibt es erst im Browser: ein lazy useState würde beim
    // SSR-Prerender leer rendern und beim Hydrate springen — daher Effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPresets(loadSavedSearches());
    const csvItems: {id:string;filename:string;createdAt:string;rowCount:number}[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('csv_run_csv_')) {
        try {
          const val = JSON.parse(localStorage.getItem(key)!);
          const csvId = key.replace('csv_run_', '');
          csvItems.push({ id: csvId, filename: val.filename, createdAt: val.createdAt, rowCount: val.rowCount ?? val.data?.length ?? 0 });
        } catch {}
      }
    }
    csvItems.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setCsvRuns(csvItems);
    setBlockCount(loadBlocklist().length);
    setLoading(false);

    // "Erneut scrapen": prefill the form from a stored run config
    let hadRescrape = false;
    try {
      const rc = localStorage.getItem('rescrape_config');
      if (rc) {
        const c = JSON.parse(rc);
        hadRescrape = true;
        if (Array.isArray(c.keywords)) setTags(c.keywords);
        if (c.country)                 setCountry(c.country);
        if (Array.isArray(c.platforms)) setPlatforms(c.platforms);
        if (c.adStatus)                setAdStatus(c.adStatus);
        if (c.mediaType)               setMediaType(c.mediaType);
        if (c.searchType)              setSearchType(c.searchType);
        if (Array.isArray(c.languages)) setLanguages(c.languages);
        if (c.dateMin)                 setDateMin(c.dateMin);
        if (c.dateMax)                 setDateMax(c.dateMax);
        if (c.limit)                   setLimit(c.limit);
        if (c.bylines)                 setBylines(c.bylines);
        localStorage.removeItem('rescrape_config');
      }
    } catch {}

    // Backend history (if a backend exists) merges in afterwards
    api.runs.list().then(runs => {
      setRuns(runs);
      const last = runs[0];
      if (!hadRescrape && last?.scraper_config) applyRunConfig(last.scraper_config as Record<string, unknown>);
    }).catch(() => {});
    fetchKeyAvailability().then(setBackendKeys);
  }, []);

  const deleteCsvImport = async (csvId: string) => {
    try {
      localStorage.removeItem(`csv_run_${csvId}`);
      await deleteCsvText(csvId);
      setCsvRuns(prev => prev.filter(c => c.id !== csvId));
      showToast('Import gelöscht', 'success');
    } catch {
      showToast('Löschen fehlgeschlagen', 'error');
    }
  };

  /**
   * Instant-Load-Vorlagen (Einstellungen → KI-Vorlagen) für eine Import-Quelle
   * direkt anhängen — ohne Dialog; «direkt ausfüllen» startet der Viewer beim
   * Laden. Liefert die IDs der geladenen Vorlagen.
   */
  const autoApplyPresets = useCallback((runId: string, source: PresetSource): Set<string> => {
    const presets = presetsForSource(source);
    if (presets.length === 0) return new Set();
    const { added, autoRun } = applyPresets(runId, presets, pickPresetProvider(backendKeys));
    if (added.length > 0) {
      const names = presets.map(p => `«${p.name}»`).join(', ');
      showToast(
        autoRun.length > 0
          ? `${presets.length === 1 ? 'Vorlage' : 'Vorlagen'} ${names} geladen — KI füllt die Spalten direkt aus`
          : `${presets.length === 1 ? 'Vorlage' : 'Vorlagen'} ${names} automatisch geladen — Spalten mit ▶ ausfüllen`,
        'success', 5000,
      );
    }
    return new Set(presets.map(p => p.id));
  }, [backendKeys, showToast]);

  const { csvFile, uploading, dragOver, importFile, aiPresetPrompt, setAiPresetPrompt } =
    useCsvImport({ autoApplyPresets, onError: setFormError });

  const savePreset = () => {
    const auto = tags[0] ?? new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const name = presetName.trim() || auto;
    setPresets(saveSavedSearch(name, { keywords: tags, country, platforms, adStatus, mediaType, searchType, languages, dateMin, dateMax, limit, bylines }));
    setPresetName('');
  };

  const loadPreset = (name: string) => {
    const p = presets[name];
    if (!p) return;
    setTags(p.keywords ?? []);
    setCountry(p.country ?? p.countries?.[0] ?? 'DE');
    setPlatforms(p.platforms ?? ['FACEBOOK', 'INSTAGRAM']);
    setAdStatus(p.adStatus ?? 'ACTIVE');
    if (p.mediaType) setMediaType(p.mediaType);
    if (p.searchType) setSearchType(p.searchType);
    if (p.languages) setLanguages(p.languages);
    if (p.dateMin !== undefined) setDateMin(p.dateMin);
    if (p.dateMax !== undefined) setDateMax(p.dateMax);
    if (p.limit) setLimit(p.limit);
    if (p.bylines !== undefined) setBylines(p.bylines);
    setShowPresets(false);
  };

  const startScrape = async () => {
    setFormError('');
    if (tags.length === 0) { setFormError('Mindestens einen Suchbegriff eingeben'); return; }
    const settings = loadSettings();
    // Token from browser settings if present — otherwise the Vercel server
    // reads it from its env vars (META_API_KEY etc., see lib/serverKeys.ts).
    const token = settings.apiKeys.meta_ads;
    setCreating(true);
    try {
      // Scrape runs directly on the Vercel server — no separate backend needed.
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
            if ((row.ad_text?.length ?? 0) > (existing.ad_text?.length ?? 0)) {
              existing.ad_text = row.ad_text;
            }
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
        // Saved so the run can be repeated with the same settings
        scrapeConfig: {
          keywords: tags, country, platforms, adStatus, mediaType, searchType,
          languages, dateMin, dateMax, limit, bylines,
        },
      });
      autoApplyPresets(id, 'meta');
      router.push(`/csv/${id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Fehler beim Scrapen');
    } finally {
      setCreating(false);
    }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '20px 20px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>

          {/* ── Left: Scraper config ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ① Unified panel: source + filter headers align on the same left column */}
            <div style={{ background: T.panel2, border: `1px solid ${T.lineS}`, borderRadius: 8, display: 'flex', flexDirection: 'column' }}>

              {/* Source header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: `1px solid ${T.lineS}` }}>
                <span style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, flexShrink: 0, width: 42 }}>Quelle</span>
                <div style={{ display: 'flex', background: T.panel, borderRadius: 6, border: `1px solid ${T.line}`, padding: 2, gap: 2 }}>
                  <button style={{ padding: '4px 12px', borderRadius: 4, background: T.panel2, border: `1px solid ${T.line}`, fontFamily: T.ffMono, fontSize: 11, color: T.ink, cursor: 'default' }}>
                    Meta Ads Library
                  </button>
                  <span style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkF, padding: '4px 4px', alignSelf: 'center' }}>oder</span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: '4px 12px', borderRadius: 4, background: 'transparent', border: '1px solid transparent', fontFamily: T.ffMono, fontSize: 11, color: csvFile ? T.gold : T.inkD, cursor: 'pointer', transition: 'all .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = T.gold; e.currentTarget.style.background = T.goldD; }}
                    onMouseLeave={e => { e.currentTarget.style.color = csvFile ? T.gold : T.inkD; e.currentTarget.style.background = 'transparent'; }}
                  >
                    {csvFile ? `✓ ${csvFile.name.slice(0, 20)}` : uploading ? 'Lädt…' : '↑ CSV / Excel hier ablegen'}
                  </button>
                </div>
              </div>

              {/* Filter header row: label + saved searches + save input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: `1px solid ${T.lineS}` }}>
                <span style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, flexShrink: 0, width: 42 }}>Filter</span>
                <button
                  onClick={() => setShowPresets(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    fontFamily: T.ffMono, fontSize: 11, padding: '5px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,.04)',
                    border: `1px solid ${T.lineS}`,
                    color: Object.keys(presets).length > 0 ? T.gold : T.inkD,
                    cursor: 'pointer', transition: 'all .12s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.07)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)'; }}
                >
                  <svg width="10" height="12" viewBox="0 0 11 13" fill="currentColor">
                    <path d="M1 1h9v11L5.5 8.8 1 12V1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  <span>Gespeicherte Suchen{Object.keys(presets).length > 0 ? ` (${Object.keys(presets).length})` : ''}</span>
                </button>
                <div style={{ flex: 1 }} />
                {/* Save input right-aligned */}
                <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePreset()}
                  placeholder="Suche benennen…"
                  style={{ width: 130, padding: '2px 7px', fontSize: 11, fontFamily: T.ffMono, borderRadius: 4, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none' }} />
                <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11, flexShrink: 0 }} onClick={savePreset}>+ Speichern</button>
              </div>

              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5 }}>
                  Suchbegriffe
                </label>
                <TagInput tags={tags} onChange={t => { setTags(t); setFormError(''); }} placeholder="Begriff eingeben, Enter drücken…" />
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5 }}>Länder</p>
                  <CountrySelect value={country} onChange={setCountry} />
                </div>
                <div>
                  <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5 }}>Plattformen</p>
                  <ChipGroup options={PLATFORM_OPTIONS} value={platforms} onChange={setPlatforms} />
                </div>
                <div>
                  <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5 }}>Status</p>
                  <SingleChip options={AD_STATUS_OPTIONS} value={adStatus} onChange={setAdStatus} />
                </div>
              </div>

              {/* Row 2: Medientyp + Suchtyp + Sprachen */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5 }}>Medientyp</p>
                  <SingleChip options={MEDIA_TYPE_OPTIONS} value={mediaType} onChange={setMediaType} />
                </div>
                <div>
                  <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5 }}>Suchtyp</p>
                  <SingleChip options={SEARCH_TYPE_OPTIONS} value={searchType} onChange={setSearchType} />
                </div>
                <div>
                  <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5 }}>Sprachen</p>
                  <ChipGroup options={LANGUAGE_OPTIONS} value={languages} onChange={setLanguages} />
                </div>
              </div>

              {/* Row 3: Limit + Datum + Bylines */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5 }}>Limit</p>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {LIMIT_OPTIONS.map(l => (
                      <button key={l} onClick={() => setLimit(l)} className={`chip ${limit === l ? 'active' : ''}`} style={{ minWidth: 40 }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5 }}>Datum von</p>
                  <input
                    type="date" value={dateMin} onChange={e => setDateMin(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 11, fontFamily: T.ffMono, borderRadius: 5, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5 }}>Datum bis</p>
                  <input
                    type="date" value={dateMax} onChange={e => setDateMax(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 11, fontFamily: T.ffMono, borderRadius: 5, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none', colorScheme: 'dark' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 5 }}>Bylines (kommagetrennt)</p>
                  <input
                    type="text" value={bylines} onChange={e => setBylines(e.target.value)}
                    placeholder="z.B. Axel Springer, DPK"
                    style={{ width: '100%', padding: '4px 8px', fontSize: 11, fontFamily: T.ffMono, borderRadius: 5, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              </div>
            </div>

            {/* Ergebnis-Optionen */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={groupByPage} onChange={e => setGroupByPage(e.target.checked)}
                  style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#e8b04b' }}
                />
                <span style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkD }} title="Mehrere Anzeigen derselben Fanpage werden zu einer Zeile zusammengefasst (Spalte ads_count zeigt die Anzahl)">
                  1 Zeile pro Seite <span style={{ color: T.inkF }}>(Ads zusammenfassen)</span>
                </span>
              </label>
              {blockCount > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={useBlocklist} onChange={e => setUseBlocklist(e.target.checked)}
                    style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#e8b04b' }}
                  />
                  <span style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkD }}>
                    Blockliste anwenden{' '}
                    <span
                      onClick={e => { e.preventDefault(); router.push('/settings?tab=blocklist'); }}
                      style={{ color: '#6381ff', textDecoration: 'underline', cursor: 'pointer' }}
                      title="Blockliste ansehen und verwalten"
                    >({blockCount} Seiten)</span>
                  </span>
                </label>
              )}
            </div>

            {/* Inline error */}
            {formError && (
              <p style={{ fontFamily: T.ffMono, fontSize: 11, color: '#e8736b', background: 'rgba(232,115,107,.08)', border: '1px solid rgba(232,115,107,.2)', borderRadius: 5, padding: '6px 10px' }}>
                ⚠ {formError}
              </p>
            )}

            {/* CTA */}
            <button className="btn-primary" onClick={startScrape} disabled={creating || uploading}>
              {creating ? 'Startet…' : '→ Scraping starten'}
            </button>

            {/* Animated scrape overlay */}
            {creating && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,11,18,.82)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 22 }}>
                <style>{`
                  @keyframes lp-pulse { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(1.8); opacity: 0; } }
                  @keyframes lp-spin  { to { transform: rotate(360deg); } }
                `}</style>
                <div style={{ position: 'relative', width: 84, height: 84 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      border: '2px solid var(--th-gold)',
                      animation: `lp-pulse 1.8s ease-out ${i * 0.6}s infinite`,
                    }} />
                  ))}
                  <div style={{
                    position: 'absolute', inset: 22, borderRadius: '50%',
                    border: '2px solid rgba(232,176,75,.25)', borderTopColor: 'var(--th-gold)',
                    animation: 'lp-spin 1s linear infinite',
                  }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: T.ffDisp, fontSize: 17, fontWeight: 600, color: T.ink, marginBottom: 5 }}>
                    Meta Ads werden gescraped…
                  </p>
                  <p style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkF }}>
                    {tags.join(', ')} · bis zu {limit} Ads
                  </p>
                </div>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); }} />

          </div>

          {/* ── Right: combined history ── */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ background: T.panel, border: `1px solid ${T.lineS}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: `1px solid ${T.lineS}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: T.inkF }}>Verlauf</span>
                <button onClick={() => router.push('/runs')} style={{ fontFamily: T.ffMono, fontSize: 10, color: T.gold, background: 'none', border: 'none', cursor: 'pointer' }}>Alle Runs →</button>
              </div>

              {loading ? (
                <div style={{ padding: '16px', textAlign: 'center', fontFamily: T.ffMono, fontSize: 11, color: T.inkF }}>Lädt…</div>
              ) : (runs.length === 0 && csvRuns.length === 0) ? (
                <div style={{ padding: '20px 14px', textAlign: 'center' }}>
                  <p style={{ fontFamily: T.ffBody, fontSize: 13, color: T.inkF }}>Noch keine Importe</p>
                </div>
              ) : (
                <div>
                  {/* Merge and sort by date */}
                  {[
                    ...csvRuns.map(c => ({ kind: 'csv' as const, date: c.createdAt, csv: c })),
                    ...runs.map(r => ({ kind: 'run' as const, date: r.created_at, run: r })),
                  ]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 12)
                    .map(item => {
                      if (item.kind === 'csv') {
                        const { csv } = item;
                        return (
                          <div key={`csv-${csv.id}`} style={{ borderBottom: `1px solid ${T.lineS}`, display: 'flex', alignItems: 'stretch' }}>
                            <button
                              onClick={() => router.push(`/csv/${csv.id}`)}
                              style={{ flex: 1, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{csv.filename}</p>
                                <p style={{ fontFamily: T.ffMono, fontSize: 9, color: T.inkF, marginTop: 1 }}>{fmt(csv.createdAt)}</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                <span style={{ fontFamily: T.ffMono, fontSize: 9, color: T.inkF }}>{csv.rowCount.toLocaleString('de')} Z</span>
                                {csv.filename.startsWith('Meta:') ? (
                                  <span style={{ fontFamily: T.ffMono, fontSize: 8, letterSpacing: '.08em', padding: '1px 5px', borderRadius: 3, background: 'rgba(232,176,75,.1)', border: '1px solid rgba(232,176,75,.25)', color: '#e8b04b' }}>Scrape</span>
                                ) : (
                                  <span style={{ fontFamily: T.ffMono, fontSize: 8, letterSpacing: '.08em', padding: '1px 5px', borderRadius: 3, background: 'rgba(99,129,255,.1)', border: '1px solid rgba(99,129,255,.2)', color: '#6381ff' }}>CSV</span>
                                )}
                              </div>
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', borderLeft: `1px solid ${T.lineS}` }}>
                              <ConfirmDelete onConfirm={() => deleteCsvImport(csv.id)} title="Eintrag löschen" />
                            </div>
                          </div>
                        );
                      }
                      const { run } = item;
                      const s = STATUS_PILL[run.status];
                      const cr = Object.values(run.classification_results)[0];
                      return (
                        <div key={`run-${run.id}`} style={{ borderBottom: `1px solid ${T.lineS}`, display: 'flex', alignItems: 'stretch' }}>
                          <button
                            onClick={() => router.push(`/runs/${run.id}`)}
                            style={{ flex: 1, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.source}</p>
                              <p style={{ fontFamily: T.ffMono, fontSize: 9, color: T.inkF, marginTop: 1 }}>{fmt(run.created_at)}</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                              {(cr?.keep ?? 0) > 0 && <span style={{ fontFamily: T.ffDisp, fontSize: 15, color: T.teal, fontWeight: 600 }}>{cr!.keep}</span>}
                              <span className={`pill ${s.cls}`}>{s.label}</span>
                            </div>
                          </button>
                          {run.scraper_config && (
                            <button
                              onClick={() => { applyRunConfig(run.scraper_config as Record<string, unknown>); showToast('Einstellungen geladen', 'success'); }}
                              title="Einstellungen laden"
                              style={{ padding: '0 10px', background: 'none', border: 'none', borderLeft: `1px solid ${T.lineS}`, cursor: 'pointer', fontFamily: T.ffMono, fontSize: 12, color: T.inkF, transition: 'color .15s', flexShrink: 0 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.gold; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.inkF; }}
                            >↩</button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Saved Searches Modal ── */}
      {showPresets && (
        <SavedSearchesModal
          searches={presets}
          onLoad={loadPreset}
          onDelete={(name) => setPresets(deleteSavedSearch(name))}
          onClose={() => setShowPresets(false)}
        />
      )}

      {/* ── KI-Spalten-Preset nach LinkedIn-Upload ── */}
      {aiPresetPrompt && (
        <PresetSelector
          filename={aiPresetPrompt.filename}
          presets={aiPresetPrompt.presets}
          onSelect={(presetId, autoRun) => {
            const { id } = aiPresetPrompt;
            if (presetId) {
              const preset = aiPresetPrompt.presets.find(p => p.id === presetId);
              if (preset) {
                // Spalten anhängen (Instant-Load-Vorlagen sind evtl. schon drin);
                // bei autoRun merkt applyPresets die Configs für den Viewer vor
                const { added, autoRun: toRun } = applyPresets(id, [preset], pickPresetProvider(backendKeys), { forceAutoRun: !!autoRun });
                if (added.length > 0 && toRun.length === 0) {
                  showToast(`Vorlage «${preset.name}» geladen — Spalten mit ▶ analysieren`, 'success');
                }
              }
            }
            setAiPresetPrompt(null);
            router.push(`/csv/${id}`);
          }}
          onClose={() => {
            const { id } = aiPresetPrompt;
            setAiPresetPrompt(null);
            router.push(`/csv/${id}`);
          }}
        />
      )}

      {/* ── Full-page drag overlay ── */}
      {dragOver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(7,7,10,.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16,
          border: `2px dashed ${T.gold}`,
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 48 }}>↓</div>
          <p style={{ fontFamily: T.ffDisp, fontSize: 28, fontWeight: 600, color: T.ink }}>CSV oder Excel loslassen</p>
          <p style={{ fontFamily: T.ffMono, fontSize: 12, color: T.inkD }}>Datei ablegen zum Importieren</p>
        </div>
      )}
    </div>
  );
}
