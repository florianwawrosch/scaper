'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';
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
  { value: 'ACTIVE',   label: 'Aktiv'    },
  { value: 'ALL',      label: 'Alle'     },
  { value: 'INACTIVE', label: 'Inaktiv'  },
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

function ChipGroup({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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

  const [runs,        setRuns]        = useState<ScrapeRun[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [creating,    setCreating]    = useState(false);
  const [source,      setSource]      = useState<SourceType>('meta_ads');
  const [keywords,    setKeywords]    = useState('');
  const [countries,   setCountries]   = useState(['DE', 'AT']);
  const [platforms,   setPlatforms]   = useState(['FACEBOOK', 'INSTAGRAM']);
  const [adStatus,    setAdStatus]    = useState('ACTIVE');
  const [csvFile,     setCsvFile]     = useState<File | null>(null);
  const [dragOver,    setDragOver]    = useState(false);
  const [presets,     setPresets]     = useState<Record<string, any>>({});
  const [presetName,  setPresetName]  = useState('');;

  useEffect(() => {
    api.runs.list().then(runs => {
      setRuns(runs);
      // Auto-load last run's settings
      const last = runs[0];
      if (last?.scraper_config) {
        applyRunConfig(last.scraper_config as Record<string, any>);
      }
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
    if (!presetName.trim()) return showToast('Name erforderlich', 'warning');
    const cfg = { keywords: keywords.split('\n').filter(Boolean), countries, platforms, adStatus };
    const next = { ...presets, [presetName]: cfg };
    setPresets(next);
    localStorage.setItem('presets', JSON.stringify(next));
    showToast(`"${presetName}" gespeichert`, 'success');
    setPresetName('');
  };

  const loadPreset = (name: string) => {
    const p = presets[name];
    if (!p) return;
    setKeywords(p.keywords?.join('\n') ?? '');
    setCountries(p.countries ?? ['DE', 'AT']);
    setPlatforms(p.platforms ?? ['FACEBOOK', 'INSTAGRAM']);
    setAdStatus(p.adStatus ?? 'ACTIVE');
    showToast(`"${name}" geladen`, 'success');
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
    } else {
      showToast('Nur CSV/Excel-Dateien erlaubt', 'warning');
    }
  };

  const createRun = async () => {
    setCreating(true);
    try {
      if (source === 'meta_ads') {
        if (!keywords.trim()) { showToast('Suchbegriffe erforderlich', 'warning'); return; }
        const run = await api.runs.create('meta_ads_library', {
          keywords: keywords.split('\n').filter(Boolean),
          countries, platforms, ad_status: adStatus,
        });
        setRuns([run, ...runs]);
        showToast('Run erstellt', 'success');
        router.push(`/runs/${run.id}`);
      } else {
        if (!csvFile) { showToast('Bitte eine CSV-Datei hochladen', 'warning'); return; }
        const run = await api.runs.create('phantombuster', {});
        const fd = new FormData();
        fd.append('file', csvFile);
        await api.runs.upload(run.id, fd);
        setRuns([run, ...runs]);
        showToast('Datei hochgeladen', 'success');
        router.push(`/runs/${run.id}`);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    } finally {
      setCreating(false);
    }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const completed  = runs.filter(r => r.status === 'completed').length;
  const totalKeep  = runs.reduce((s, r) => s + (Object.values(r.classification_results)[0]?.keep ?? 0), 0);

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 28px 60px' }}>

        {/* ===== Ticket ===== */}
        <div className="ticket">
          <div className="tag">Lead Acquisition System · Multi-Source Scraper</div>
          <h1>Lead <em style={{ color: '#f5cc77' }}>Pipeline</em></h1>
          <p className="sub">Scrape · Filter · Enrich · Export — vollautomatisch.</p>
          <div className="meta-row">
            <div className="m"><span className="k">Total Runs</span><span className="v">{runs.length}</span></div>
            <div className="m"><span className="k">Abgeschlossen</span><span className="v">{completed}</span></div>
            <div className="m"><span className="k">Leads</span><span className="v">{totalKeep.toLocaleString('de')}</span></div>
          </div>
          <div className="ticket-side">
            <span className="big">{runs.length}</span>
            <span className="lbl">Runs</span>
          </div>
        </div>

        {/* ===== Main grid ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'start' }}>

          {/* Left: Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 01 — Datenquelle */}
            <section>
              <div className="sec-head">
                <span className="idx">01</span>
                <h2>Datenquelle</h2>
                <div className="rule" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {([
                  { id: 'meta_ads',      label: 'Meta Ads Library', sub: 'Facebook & Instagram Werbeanzeigen', tag: 'SCRAPER' },
                  { id: 'phantombuster', label: 'PhantomBuster CSV', sub: 'LinkedIn / externe Daten importieren', tag: 'IMPORT' },
                ] as const).map(s => {
                  const active = source === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSource(s.id)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: active ? '1px solid rgba(232,176,75,.5)' : '1px solid rgba(255,255,255,.07)',
                        background: active ? 'rgba(232,176,75,.07)' : 'rgba(255,255,255,.02)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all .15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 9, letterSpacing: '.2em', color: active ? '#e8b04b' : '#5f6e87', textTransform: 'uppercase' }}>{s.tag}</span>
                        {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e8b04b' }} />}
                      </div>
                      <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 600, color: active ? '#f5cc77' : '#f4efe4', marginBottom: 3 }}>{s.label}</p>
                      <p style={{ fontFamily: "'Spline Sans', sans-serif", fontSize: 12, color: '#5f6e87' }}>{s.sub}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 02 — Konfiguration (conditional) */}
            {source === 'meta_ads' && (
              <>
                <section>
                  <div className="sec-head">
                    <span className="idx">02</span>
                    <h2>Suchbegriffe</h2>
                    <div className="rule" />
                    <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: '#5f6e87', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>je Zeile ein Begriff</span>
                  </div>
                  <textarea
                    value={keywords}
                    onChange={e => setKeywords(e.target.value)}
                    placeholder={"High Ticket Coach\nManifestation\nOnline Business\nPersonal Branding"}
                    rows={5}
                    style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#f4efe4', background: '#0f1828', border: '1px solid rgba(232,176,75,.18)', borderRadius: 8, padding: '10px 14px', width: '100%', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(232,176,75,.5)'; e.target.style.boxShadow = '0 0 0 2px rgba(232,176,75,.06)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(232,176,75,.18)'; e.target.style.boxShadow = 'none'; }}
                  />
                </section>

                <section>
                  <div className="sec-head">
                    <span className="idx">03</span>
                    <h2>Parameter</h2>
                    <div className="rule" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5f6e87', marginBottom: 7 }}>Länder</p>
                      <ChipGroup options={COUNTRY_OPTIONS} value={countries} onChange={setCountries} />
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5f6e87', marginBottom: 7 }}>Plattformen</p>
                      <ChipGroup options={PLATFORM_OPTIONS} value={platforms} onChange={setPlatforms} />
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5f6e87', marginBottom: 7 }}>Ad-Status</p>
                      <SingleChip options={AD_STATUS_OPTIONS} value={adStatus} onChange={setAdStatus} />
                    </div>
                  </div>
                </section>

                {/* Presets (only for Meta Ads) */}
                <section>
                  <div className="sec-head">
                    <span className="idx">P</span>
                    <h2>Presets</h2>
                    <div className="rule" />
                  </div>
                  <div style={{ background: '#0f1828', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    {Object.keys(presets).map(name => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(232,176,75,.08)', border: '1px solid rgba(232,176,75,.2)', borderRadius: 999, padding: '4px 12px 4px 14px' }}>
                        <button onClick={() => loadPreset(name)} style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#e8b04b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{name}</button>
                        <button onClick={() => deletePreset(name)} style={{ fontSize: 14, color: '#5f6e87', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
                      </div>
                    ))}
                    {Object.keys(presets).length === 0 && (
                      <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: '#5f6e87', letterSpacing: '.04em' }}>Noch keine Presets</span>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePreset()} placeholder="Name…"
                        style={{ width: 130, padding: '6px 12px', fontSize: 12, fontFamily: "'Spline Sans Mono', monospace", background: '#131f33', border: '1px solid rgba(232,176,75,.18)', borderRadius: 8, color: '#f4efe4', outline: 'none' }} />
                      <button className="btn-ghost" style={{ whiteSpace: 'nowrap', padding: '6px 14px' }} onClick={savePreset}>Speichern</button>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* PhantomBuster: File Upload */}
            {source === 'phantombuster' && (
              <section>
                <div className="sec-head">
                  <span className="idx">02</span>
                  <h2>CSV / Excel hochladen</h2>
                  <div className="rule" />
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    padding: '28px 24px',
                    borderRadius: 10,
                    border: dragOver ? '1.5px dashed rgba(232,176,75,.7)' : csvFile ? '1.5px solid rgba(79,209,197,.4)' : '1.5px dashed rgba(255,255,255,.12)',
                    background: dragOver ? 'rgba(232,176,75,.04)' : csvFile ? 'rgba(79,209,197,.04)' : 'rgba(255,255,255,.01)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all .2s',
                  }}
                >
                  {csvFile ? (
                    <div>
                      <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, color: '#4fd1c5', marginBottom: 5 }}>{csvFile.name}</p>
                      <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, color: '#5f6e87', letterSpacing: '.06em' }}>
                        {(csvFile.size / 1024).toFixed(1)} KB · Klicken zum Ersetzen
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, color: '#f4efe4', marginBottom: 6 }}>CSV oder Excel hierher ziehen</p>
                      <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: '#5f6e87', letterSpacing: '.06em' }}>oder klicken · .csv, .xlsx, .xls</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setCsvFile(f); }} />
              </section>
            )}

            {/* CTA */}
            <button className="btn-primary" onClick={createRun} disabled={creating}>
              {creating ? 'Wird gestartet…' : source === 'meta_ads' ? '→ Scraping starten' : '→ Datei importieren'}
            </button>
          </div>

          {/* Right: Recent Runs */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div style={{ background: '#0f1828', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.15)' }}>
                <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#5f6e87' }}>Letzte Runs</span>
                <button onClick={() => router.push('/runs')} style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: '#e8b04b', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.06em' }}>Alle →</button>
              </div>
              {loading ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#5f6e87' }}>Lädt…</div>
              ) : runs.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                  <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, color: '#5f6e87', marginBottom: 6 }}>Noch leer</p>
                  <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: '#5f6e87', letterSpacing: '.04em' }}>Starte deinen ersten Run.</p>
                </div>
              ) : (
                <div>
                  {runs.slice(0, 8).map(run => {
                    const s = STATUS_PILL[run.status];
                    const cr = Object.values(run.classification_results)[0];
                    return (
                      <div
                        key={run.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'stretch' }}
                      >
                        <button
                          onClick={() => router.push(`/runs/${run.id}`)}
                          style={{ flex: 1, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background .15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#9aa7bd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.source}</p>
                            <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, color: '#5f6e87', marginTop: 2, letterSpacing: '.04em' }}>{fmt(run.created_at)}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {(cr?.keep ?? 0) > 0 && <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, color: '#4fd1c5', fontWeight: 600 }}>{cr!.keep}</span>}
                            <span className={`pill ${s.cls}`}>{s.label}</span>
                          </div>
                        </button>
                        {run.scraper_config && (
                          <button
                            onClick={() => { applyRunConfig(run.scraper_config as Record<string, any>); showToast('Einstellungen geladen', 'success'); }}
                            title="Einstellungen dieses Runs laden"
                            style={{ padding: '0 14px', background: 'none', border: 'none', borderLeft: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', fontFamily: "'Spline Sans Mono', monospace", fontSize: 14, color: '#5f6e87', transition: 'all .15s', flexShrink: 0 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e8b04b'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#5f6e87'; }}
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
