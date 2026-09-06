'use client';

import type { useScrapeForm } from '@/app/hooks/useScrapeForm';
import { TagInput } from './TagInput';
import { CountrySelect } from './CountrySelect';
import { SectionLabel } from './SectionLabel';
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

interface Props {
  /** Zustand + Setter der Suchmaske (useScrapeForm) */
  form: ReturnType<typeof useScrapeForm>;
  /** Gespeicherte Suchen: Anzahl, Öffnen, Name + Speichern */
  savedCount: number;
  onOpenSaved: () => void;
  presetName: string;
  setPresetName: (v: string) => void;
  onSavePreset: () => void;
  /** CSV/Excel-Import */
  csvFile: File | null;
  uploading: boolean;
  onPickFile: () => void;
  /** Blockliste */
  blockCount: number;
  onBlocklist: () => void;
}

/** Linke Spalte der Startseite: Quelle, Filter, Ergebnis-Optionen, Start-Button und Lade-Overlay */
export function ScrapeForm({ form, savedCount, onOpenSaved, presetName, setPresetName, onSavePreset, csvFile, uploading, onPickFile, blockCount, onBlocklist }: Props) {
  const {
    tags, setTags, country, setCountry, platforms, setPlatforms, adStatus, setAdStatus,
    mediaType, setMediaType, searchType, setSearchType, languages, setLanguages,
    dateMin, setDateMin, dateMax, setDateMax, limit, setLimit, bylines, setBylines,
    startScrape, creating, formError, setFormError,
    useBlocklist, setUseBlocklist, groupByPage, setGroupByPage,
  } = form;

  return (
    <>
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
                    onClick={onPickFile}
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
                  onClick={onOpenSaved}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    fontFamily: T.ffMono, fontSize: 11, padding: '5px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,.04)',
                    border: `1px solid ${T.lineS}`,
                    color: savedCount > 0 ? T.gold : T.inkD,
                    cursor: 'pointer', transition: 'all .12s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.07)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)'; }}
                >
                  <svg width="10" height="12" viewBox="0 0 11 13" fill="currentColor">
                    <path d="M1 1h9v11L5.5 8.8 1 12V1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  <span>Gespeicherte Suchen{savedCount > 0 ? ` (${savedCount})` : ''}</span>
                </button>
                <div style={{ flex: 1 }} />
                {/* Save input right-aligned */}
                <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onSavePreset()}
                  placeholder="Suche benennen…"
                  style={{ width: 130, padding: '2px 7px', fontSize: 11, fontFamily: T.ffMono, borderRadius: 4, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none' }} />
                <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11, flexShrink: 0 }} onClick={onSavePreset}>+ Speichern</button>
              </div>

              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <SectionLabel>Suchbegriffe</SectionLabel>
                <TagInput tags={tags} onChange={t => { setTags(t); setFormError(''); }} placeholder="Begriff eingeben, Enter drücken…" />
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <SectionLabel>Länder</SectionLabel>
                  <CountrySelect value={country} onChange={setCountry} />
                </div>
                <div>
                  <SectionLabel>Plattformen</SectionLabel>
                  <ChipGroup options={PLATFORM_OPTIONS} value={platforms} onChange={setPlatforms} />
                </div>
                <div>
                  <SectionLabel>Status</SectionLabel>
                  <SingleChip options={AD_STATUS_OPTIONS} value={adStatus} onChange={setAdStatus} />
                </div>
              </div>

              {/* Row 2: Medientyp + Suchtyp + Sprachen */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <SectionLabel>Medientyp</SectionLabel>
                  <SingleChip options={MEDIA_TYPE_OPTIONS} value={mediaType} onChange={setMediaType} />
                </div>
                <div>
                  <SectionLabel>Suchtyp</SectionLabel>
                  <SingleChip options={SEARCH_TYPE_OPTIONS} value={searchType} onChange={setSearchType} />
                </div>
                <div>
                  <SectionLabel>Sprachen</SectionLabel>
                  <ChipGroup options={LANGUAGE_OPTIONS} value={languages} onChange={setLanguages} />
                </div>
              </div>

              {/* Row 3: Limit + Datum + Bylines */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <SectionLabel>Limit</SectionLabel>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {LIMIT_OPTIONS.map(l => (
                      <button key={l} onClick={() => setLimit(l)} className={`chip ${limit === l ? 'active' : ''}`} style={{ minWidth: 40 }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <SectionLabel>Datum von</SectionLabel>
                  <input
                    type="date" value={dateMin} onChange={e => setDateMin(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 11, fontFamily: T.ffMono, borderRadius: 5, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <SectionLabel>Datum bis</SectionLabel>
                  <input
                    type="date" value={dateMax} onChange={e => setDateMax(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 11, fontFamily: T.ffMono, borderRadius: 5, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none', colorScheme: 'dark' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <SectionLabel>Bylines (kommagetrennt)</SectionLabel>
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
                      onClick={e => { e.preventDefault(); onBlocklist(); }}
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

    </>
  );
}
