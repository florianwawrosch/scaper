'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ScrapeRun, type Source } from '@/lib/api';
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
  { value: 'ACTIVE',   label: 'Active'   },
  { value: 'ALL',      label: 'All'      },
  { value: 'INACTIVE', label: 'Inactive' },
];

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
        <button
          key={o.value}
          onClick={() => toggle(o.value)}
          className={`chip ${value.includes(o.value) ? 'active' : ''}`}
        >
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
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`chip ${value === o.value ? 'active' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { showToast } = useToast();

  const [runs,           setRuns]           = useState<ScrapeRun[]>([]);
  const [sources,        setSources]        = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState('meta_ads_library');
  const [loading,        setLoading]        = useState(true);
  const [creating,       setCreating]       = useState(false);
  const [keywords,       setKeywords]       = useState('');
  const [countries,      setCountries]      = useState(['DE', 'AT']);
  const [platforms,      setPlatforms]      = useState(['FACEBOOK', 'INSTAGRAM']);
  const [adStatus,       setAdStatus]       = useState('ACTIVE');
  const [presets,        setPresets]        = useState<Record<string, any>>({});
  const [presetName,     setPresetName]     = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [runsData, sourcesData] = await Promise.all([api.runs.list(), api.sources.list()]);
        setRuns(runsData);
        setSources(sourcesData);
        if (sourcesData.length > 0) setSelectedSource(sourcesData[0].key);
      } catch {}
      const saved = localStorage.getItem('presets');
      if (saved) setPresets(JSON.parse(saved));
      setLoading(false);
    })();
  }, []);

  const savePreset = () => {
    if (!presetName.trim()) return showToast('Name erforderlich', 'warning');
    const cfg = { source: selectedSource, keywords: keywords.split('\n').filter(Boolean), countries, platforms, adStatus };
    const next = { ...presets, [presetName]: cfg };
    setPresets(next);
    localStorage.setItem('presets', JSON.stringify(next));
    showToast(`"${presetName}" gespeichert`, 'success');
    setPresetName('');
  };

  const loadPreset = (name: string) => {
    const p = presets[name];
    if (!p) return;
    setSelectedSource(p.source);
    setKeywords(p.keywords.join('\n'));
    setCountries(p.countries);
    setPlatforms(p.platforms);
    setAdStatus(p.adStatus);
    showToast(`"${name}" geladen`, 'success');
  };

  const deletePreset = (name: string) => {
    const next = { ...presets };
    delete next[name];
    setPresets(next);
    localStorage.setItem('presets', JSON.stringify(next));
  };

  const createRun = async () => {
    if (!keywords.trim()) return showToast('Suchbegriffe erforderlich', 'warning');
    setCreating(true);
    try {
      const run = await api.runs.create(selectedSource, {
        keywords: keywords.split('\n').filter(Boolean),
        countries,
        platforms,
        ad_status: adStatus,
      });
      setRuns([run, ...runs]);
      showToast('Run erstellt', 'success');
      router.push(`/runs/${run.id}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    } finally {
      setCreating(false);
    }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const completed = runs.filter(r => r.status === 'completed').length;
  const totalKeep = runs.reduce((s, r) => {
    const cr = Object.values(r.classification_results)[0];
    return s + (cr?.keep ?? 0);
  }, 0);

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px 80px' }}>

        {/* ===== Boarding-pass ticket ===== */}
        <div className="ticket">
          <div className="tag">Lead Acquisition System · Multi-Source Scraper</div>
          <h1>Lead <em style={{ color: '#f5cc77' }}>Pipeline</em></h1>
          <p className="sub">Scrape · Filter · Enrich · Export — vollautomatisch.</p>
          <div className="meta-row">
            <div className="m">
              <span className="k">Total Runs</span>
              <span className="v">{runs.length}</span>
            </div>
            <div className="m">
              <span className="k">Abgeschlossen</span>
              <span className="v">{completed}</span>
            </div>
            <div className="m">
              <span className="k">Leads gesammelt</span>
              <span className="v">{totalKeep.toLocaleString('de')}</span>
            </div>
            <div className="m">
              <span className="k">Quellen</span>
              <span className="v">{sources.length || '—'}</span>
            </div>
          </div>
          <div className="ticket-side">
            <span className="big">{runs.length}</span>
            <span className="lbl">Runs</span>
          </div>
        </div>

        {/* ===== Main grid ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'start' }}>

          {/* Left: Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

            {/* Section 01 — Quelle */}
            <section>
              <div className="sec-head">
                <span className="idx">01</span>
                <h2>Datenquelle</h2>
                <div className="rule" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {sources.length === 0 ? (
                  <div style={{
                    gridColumn: '1/-1',
                    padding: '20px 24px',
                    background: '#0f1828',
                    border: '1px solid rgba(255,255,255,.07)',
                    borderRadius: 12,
                    fontFamily: "'Spline Sans Mono', monospace",
                    fontSize: 12,
                    color: '#5f6e87',
                    letterSpacing: '.04em',
                  }}>
                    Backend nicht verbunden — starte den Server.
                  </div>
                ) : sources.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSelectedSource(s.key)}
                    style={{
                      padding: '18px 20px',
                      borderRadius: 12,
                      border: selectedSource === s.key
                        ? '1px solid rgba(232,176,75,.5)'
                        : '1px solid rgba(255,255,255,.07)',
                      background: selectedSource === s.key
                        ? 'rgba(232,176,75,.08)'
                        : 'rgba(255,255,255,.02)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all .15s',
                      boxShadow: selectedSource === s.key
                        ? '0 0 28px -6px rgba(232,176,75,.18)'
                        : 'none',
                    }}
                  >
                    <p style={{
                      fontFamily: "'Fraunces', Georgia, serif",
                      fontSize: 16,
                      fontWeight: 500,
                      color: selectedSource === s.key ? '#f5cc77' : '#f4efe4',
                      marginBottom: 4,
                    }}>{s.label || s.key}</p>
                    <p style={{
                      fontFamily: "'Spline Sans Mono', monospace",
                      fontSize: 10,
                      color: '#5f6e87',
                      letterSpacing: '.1em',
                      textTransform: 'uppercase',
                    }}>{s.description?.slice(0, 40) || 'Datenquelle'}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Section 02 — Keywords */}
            <section>
              <div className="sec-head">
                <span className="idx">02</span>
                <h2>Suchbegriffe</h2>
                <div className="rule" />
                <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: '#5f6e87', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
                  je Zeile ein Begriff
                </span>
              </div>
              <textarea
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder={"High Ticket Coach\nManifestation\nOnline Business\nPersonal Branding"}
                rows={6}
                style={{
                  fontFamily: "'Spline Sans Mono', monospace",
                  fontSize: 13,
                  color: '#f4efe4',
                  background: '#0f1828',
                  border: '1px solid rgba(232,176,75,.18)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  width: '100%',
                  outline: 'none',
                  resize: 'vertical',
                  lineHeight: 1.7,
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(232,176,75,.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(232,176,75,.06)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(232,176,75,.18)'; e.target.style.boxShadow = 'none'; }}
              />
            </section>

            {/* Section 03 — Parameter */}
            <section>
              <div className="sec-head">
                <span className="idx">03</span>
                <h2>Parameter</h2>
                <div className="rule" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#5f6e87', marginBottom: 12 }}>Länder</p>
                  <ChipGroup options={COUNTRY_OPTIONS} value={countries} onChange={setCountries} />
                </div>
                <div>
                  <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#5f6e87', marginBottom: 12 }}>Plattformen</p>
                  <ChipGroup options={PLATFORM_OPTIONS} value={platforms} onChange={setPlatforms} />
                </div>
                <div>
                  <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#5f6e87', marginBottom: 12 }}>Ad-Status</p>
                  <SingleChip options={AD_STATUS_OPTIONS} value={adStatus} onChange={setAdStatus} />
                </div>
              </div>
            </section>

            {/* Section 04 — Presets */}
            <section>
              <div className="sec-head">
                <span className="idx">04</span>
                <h2>Presets</h2>
                <div className="rule" />
              </div>
              <div style={{
                background: '#0f1828',
                border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 12,
                padding: '18px 20px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
              }}>
                {Object.keys(presets).map(name => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(232,176,75,.08)', border: '1px solid rgba(232,176,75,.2)', borderRadius: 999, padding: '4px 12px 4px 14px' }}>
                    <button
                      onClick={() => loadPreset(name)}
                      style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#e8b04b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {name}
                    </button>
                    <button
                      onClick={() => deletePreset(name)}
                      style={{ fontSize: 14, color: '#5f6e87', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {Object.keys(presets).length === 0 && (
                  <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: '#5f6e87', letterSpacing: '.04em' }}>Noch keine Presets gespeichert</span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && savePreset()}
                    placeholder="Name…"
                    style={{ width: 130, padding: '6px 12px', fontSize: 12, fontFamily: "'Spline Sans Mono', monospace", background: '#131f33', border: '1px solid rgba(232,176,75,.18)', borderRadius: 8, color: '#f4efe4', outline: 'none' }}
                  />
                  <button className="btn-ghost" style={{ whiteSpace: 'nowrap', padding: '6px 14px' }} onClick={savePreset}>
                    Speichern
                  </button>
                </div>
              </div>
            </section>

            {/* CTA */}
            <button className="btn-primary" onClick={createRun} disabled={creating}>
              {creating ? 'Wird gestartet…' : '→ Run starten'}
            </button>
          </div>

          {/* Right: Recent Runs */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div style={{ background: '#0f1828', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0,0,0,.15)',
              }}>
                <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#5f6e87' }}>
                  Letzte Runs
                </span>
                <button
                  onClick={() => router.push('/runs')}
                  style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: '#e8b04b', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.06em' }}
                >
                  Alle →
                </button>
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
                      <button
                        key={run.id}
                        onClick={() => router.push(`/runs/${run.id}`)}
                        style={{
                          width: '100%',
                          padding: '14px 20px',
                          borderBottom: '1px solid rgba(255,255,255,.05)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: 'none',
                          border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,.05)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background .15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: '#9aa7bd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.source}</p>
                          <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, color: '#5f6e87', marginTop: 2, letterSpacing: '.04em' }}>{fmt(run.created_at)}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {(cr?.keep ?? 0) > 0 && (
                            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, color: '#4fd1c5', fontWeight: 600 }}>{cr!.keep}</span>
                          )}
                          <span className={`pill ${s.cls}`}>{s.label}</span>
                        </div>
                      </button>
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
