'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';
import { loadSettings } from '@/lib/settings';
import { useToast } from '@/app/components/Toast';

const COUNTRY_OPTIONS = [
  { value: 'DE', label: 'DE' },
  { value: 'AT', label: 'AT' },
  { value: 'CH', label: 'CH' },
  { value: 'US', label: 'US' },
  { value: 'GB', label: 'GB' },
];
const PLATFORM_OPTIONS = [
  { value: 'FACEBOOK',  label: 'Facebook'  },
  { value: 'INSTAGRAM', label: 'Instagram' },
];
const AD_STATUS_OPTIONS = [
  { value: 'ACTIVE',   label: 'Aktiv'   },
  { value: 'ALL',      label: 'Alle'    },
  { value: 'INACTIVE', label: 'Inaktiv' },
];

type SourceType = 'meta_ads' | 'phantombuster';

const STATUS_PILL: Record<ScrapeRun['status'], { label: string; cls: string }> = {
  draft:         { label: 'Draft',    cls: 'muted' },
  scraping:      { label: 'Scraping', cls: 'warn'  },
  dataset_ready: { label: 'Bereit',   cls: 'good'  },
  in_progress:   { label: 'Aktiv',    cls: 'warn'  },
  completed:     { label: 'Fertig',   cls: 'good'  },
  failed:        { label: 'Fehler',   cls: 'bad'   },
};

const T = {
  bg:      'var(--th-bg)',
  panel:   'var(--th-panel)',
  panel2:  'var(--th-panel2)',
  line:    'var(--th-line)',
  lineS:   'var(--th-line-soft)',
  gold:    'var(--th-gold)',
  goldB:   'var(--th-gold-b)',
  goldD:   'var(--th-gold-d)',
  teal:    'var(--th-teal)',
  ink:     'var(--th-ink)',
  inkD:    'var(--th-ink-d)',
  inkF:    'var(--th-ink-f)',
  ffDisp:  'var(--ff-disp)',
  ffBody:  'var(--ff-body)',
  ffMono:  'var(--ff-mono)',
};

function ChipGroup({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => toggle(o.value)} className={`chip ${value.includes(o.value) ? 'active' : ''}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SingleChip({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`chip ${value === o.value ? 'active' : ''}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [runs,       setRuns]       = useState<ScrapeRun[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [creating,   setCreating]   = useState(false);
  const [source,     setSource]     = useState<SourceType>('meta_ads');
  const [keywords,   setKeywords]   = useState('');
  const [countries,  setCountries]  = useState(['DE', 'AT']);
  const [platforms,  setPlatforms]  = useState(['FACEBOOK', 'INSTAGRAM']);
  const [adStatus,   setAdStatus]   = useState('ACTIVE');
  const [csvFile,    setCsvFile]    = useState<File | null>(null);
  const [dragOver,   setDragOver]   = useState(false);
  const [presets,    setPresets]    = useState<Record<string, any>>({});
  const [presetName, setPresetName] = useState('');
  const [formError,  setFormError]  = useState('');

  useEffect(() => {
    api.runs.list().then(runs => {
      setRuns(runs);
      const last = runs[0];
      if (last?.scraper_config) applyRunConfig(last.scraper_config as Record<string, any>);
    }).catch(() => {}).finally(() => setLoading(false));
    const saved = localStorage.getItem('presets');
    if (saved) setPresets(JSON.parse(saved));
  }, []);

  const applyRunConfig = (cfg: Record<string, any>) => {
    if (cfg.source === 'phantombuster') setSource('phantombuster');
    else setSource('meta_ads');
    if (cfg.keywords) setKeywords(Array.isArray(cfg.keywords) ? cfg.keywords.join('\n') : cfg.keywords);
    if (cfg.countries) setCountries(cfg.countries);
    if (cfg.platforms) setPlatforms(cfg.platforms);
    if (cfg.ad_status) setAdStatus(cfg.ad_status);
  };

  const savePreset = () => {
    if (!presetName.trim()) return;
    const cfg = { keywords: keywords.split('\n').filter(Boolean), countries, platforms, adStatus };
    const next = { ...presets, [presetName]: cfg };
    setPresets(next);
    localStorage.setItem('presets', JSON.stringify(next));
    setPresetName('');
  };

  const loadPreset = (name: string) => {
    const p = presets[name];
    if (!p) return;
    setKeywords(p.keywords?.join('\n') ?? '');
    setCountries(p.countries ?? ['DE', 'AT']);
    setPlatforms(p.platforms ?? ['FACEBOOK', 'INSTAGRAM']);
    setAdStatus(p.adStatus ?? 'ACTIVE');
  };

  const deletePreset = (name: string) => {
    const next = { ...presets };
    delete next[name];
    setPresets(next);
    localStorage.setItem('presets', JSON.stringify(next));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setCsvFile(file);
      setFormError('');
    } else {
      setFormError('Nur CSV/Excel-Dateien erlaubt');
    }
  };

  const createRun = async () => {
    setFormError('');
    setCreating(true);
    try {
      if (source === 'meta_ads') {
        if (!keywords.trim()) {
          setFormError('Suchbegriffe erforderlich');
          return;
        }
        const settings = loadSettings();
        const token = settings.apiKeys.meta_ads;
        if (!token) {
          setFormError('Meta Ads API-Token fehlt — bitte in den Einstellungen eintragen');
          return;
        }
        const run = await api.runs.create('meta_ads_library', {
          keywords: keywords.split('\n').filter(Boolean),
          countries, platforms, ad_status: adStatus,
          meta_ads_token: token,
        });
        setRuns([run, ...runs]);
        router.push(`/runs/${run.id}`);
      } else {
        if (!csvFile) {
          setFormError('Bitte eine CSV-Datei hochladen');
          return;
        }
        const run = await api.runs.create('phantombuster', {});
        const fd = new FormData();
        fd.append('file', csvFile);
        await api.runs.upload(run.id, fd);
        setRuns([run, ...runs]);
        showToast('Datei hochgeladen', 'success');
        router.push(`/runs/${run.id}`);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Fehler beim Erstellen');
    } finally {
      setCreating(false);
    }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* ===== Main grid ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* Left: Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Source tabs */}
            <div style={{ display: 'flex', gap: 0, background: T.panel2, borderRadius: 8, border: `1px solid ${T.lineS}`, overflow: 'hidden' }}>
              {([
                { id: 'meta_ads',      label: 'Meta Ads Library', tag: 'SCRAPER' },
                { id: 'phantombuster', label: 'CSV / Excel',       tag: 'IMPORT'  },
              ] as const).map(s => {
                const active = source === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSource(s.id)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: active ? T.panel : 'transparent',
                      borderRight: `1px solid ${T.lineS}`,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all .15s',
                      borderBottom: active ? `2px solid ${T.gold}` : '2px solid transparent',
                    }}
                  >
                    <div style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.18em', color: active ? T.gold : T.inkF, textTransform: 'uppercase', marginBottom: 3 }}>{s.tag}</div>
                    <div style={{ fontFamily: T.ffBody, fontSize: 13, fontWeight: 500, color: active ? T.ink : T.inkD }}>{s.label}</div>
                  </button>
                );
              })}
              {/* spacer to fill right side */}
              <div style={{ flex: 2 }} />
            </div>

            {/* Meta Ads config */}
            {source === 'meta_ads' && (
              <>
                <div>
                  <label style={{ display: 'block', fontFamily: T.ffMono, fontSize: 10, letterSpacing: '.12em', color: T.inkF, textTransform: 'uppercase', marginBottom: 6 }}>
                    Suchbegriffe <span style={{ color: T.inkF, opacity: .6 }}>· je Zeile ein Begriff</span>
                  </label>
                  <textarea
                    value={keywords}
                    onChange={e => { setKeywords(e.target.value); setFormError(''); }}
                    placeholder={"High Ticket Coach\nManifestation\nOnline Business"}
                    rows={4}
                    style={{ fontFamily: T.ffMono, fontSize: 12, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 6, padding: '8px 12px', width: '100%', color: T.ink, outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 6 }}>Länder</p>
                    <ChipGroup options={COUNTRY_OPTIONS} value={countries} onChange={setCountries} />
                  </div>
                  <div>
                    <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 6 }}>Plattformen</p>
                    <ChipGroup options={PLATFORM_OPTIONS} value={platforms} onChange={setPlatforms} />
                  </div>
                  <div>
                    <p style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, marginBottom: 6 }}>Ad-Status</p>
                    <SingleChip options={AD_STATUS_OPTIONS} value={adStatus} onChange={setAdStatus} />
                  </div>
                </div>

                {/* Presets */}
                {Object.keys(presets).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: T.ffMono, fontSize: 9, color: T.inkF, letterSpacing: '.1em', textTransform: 'uppercase', marginRight: 4 }}>Presets:</span>
                    {Object.keys(presets).map(name => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 0, background: T.goldD, border: `1px solid ${T.line}`, borderRadius: 999, overflow: 'hidden' }}>
                        <button onClick={() => loadPreset(name)} style={{ fontFamily: T.ffMono, fontSize: 11, color: T.gold, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 10px' }}>{name}</button>
                        <button onClick={() => deletePreset(name)} style={{ fontSize: 14, color: T.inkF, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px 2px 2px', lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePreset()} placeholder="Preset speichern…"
                    style={{ flex: 1, maxWidth: 200, padding: '5px 10px', fontSize: 12, fontFamily: T.ffMono, background: T.panel2, border: `1px solid ${T.lineS}`, borderRadius: 6, color: T.ink, outline: 'none' }} />
                  <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 11, whiteSpace: 'nowrap' }} onClick={savePreset}>Speichern</button>
                </div>
              </>
            )}

            {/* CSV upload */}
            {source === 'phantombuster' && (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: '20px',
                  borderRadius: 8,
                  border: dragOver ? `1.5px dashed ${T.gold}` : csvFile ? `1.5px solid ${T.teal}` : `1.5px dashed ${T.lineS}`,
                  background: dragOver ? T.goldD : csvFile ? 'rgba(79,209,197,.04)' : 'transparent',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all .2s',
                }}
              >
                {csvFile ? (
                  <>
                    <p style={{ fontFamily: T.ffBody, fontSize: 14, color: T.teal, marginBottom: 3 }}>{csvFile.name}</p>
                    <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF }}>
                      {(csvFile.size / 1024).toFixed(1)} KB · Klicken zum Ersetzen
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ fontFamily: T.ffBody, fontSize: 14, color: T.inkD, marginBottom: 3 }}>CSV oder Excel hierher ziehen</p>
                    <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF }}>oder klicken · .csv, .xlsx, .xls</p>
                  </>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { setCsvFile(f); setFormError(''); } }} />

            {/* Inline error */}
            {formError && (
              <div style={{ fontFamily: T.ffMono, fontSize: 11, color: '#e8736b', background: 'rgba(232,115,107,.08)', border: '1px solid rgba(232,115,107,.2)', borderRadius: 6, padding: '8px 12px' }}>
                ⚠ {formError}
              </div>
            )}

            {/* CTA */}
            <button className="btn-primary" onClick={createRun} disabled={creating} style={{ padding: '9px 20px', fontSize: 13 }}>
              {creating ? 'Wird gestartet…' : source === 'meta_ads' ? '→ Scraping starten' : '→ Datei importieren'}
            </button>
          </div>

          {/* Right: Recent Runs */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ background: T.panel, border: `1px solid ${T.lineS}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.lineS}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: T.inkF }}>Letzte Runs</span>
                <button onClick={() => router.push('/runs')} style={{ fontFamily: T.ffMono, fontSize: 10, color: T.gold, background: 'none', border: 'none', cursor: 'pointer' }}>Alle →</button>
              </div>
              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', fontFamily: T.ffMono, fontSize: 11, color: T.inkF }}>Lädt…</div>
              ) : runs.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                  <p style={{ fontFamily: T.ffBody, fontSize: 13, color: T.inkF }}>Noch keine Runs</p>
                </div>
              ) : (
                <div>
                  {runs.slice(0, 10).map(run => {
                    const s = STATUS_PILL[run.status];
                    const cr = Object.values(run.classification_results)[0];
                    return (
                      <div key={run.id} style={{ borderBottom: `1px solid ${T.lineS}`, display: 'flex', alignItems: 'stretch' }}>
                        <button
                          onClick={() => router.push(`/runs/${run.id}`)}
                          style={{ flex: 1, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.source}</p>
                            <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF, marginTop: 1 }}>{fmt(run.created_at)}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {(cr?.keep ?? 0) > 0 && <span style={{ fontFamily: T.ffDisp, fontSize: 16, color: T.teal, fontWeight: 600 }}>{cr!.keep}</span>}
                            <span className={`pill ${s.cls}`}>{s.label}</span>
                          </div>
                        </button>
                        {run.scraper_config && (
                          <button
                            onClick={() => { applyRunConfig(run.scraper_config as Record<string, any>); showToast('Einstellungen geladen', 'success'); }}
                            title="Einstellungen laden"
                            style={{ padding: '0 12px', background: 'none', border: 'none', borderLeft: `1px solid ${T.lineS}`, cursor: 'pointer', fontFamily: T.ffMono, fontSize: 13, color: T.inkF, transition: 'color .15s', flexShrink: 0 }}
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
    </div>
  );
}
