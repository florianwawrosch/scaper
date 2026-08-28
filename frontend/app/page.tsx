'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';
import { loadSettings } from '@/lib/settings';
import { useToast } from '@/app/components/Toast';
import { TagInput } from '@/app/components/TagInput';

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
  goldD:   'var(--th-gold-d)',
  teal:    'var(--th-teal)',
  rose:    'var(--th-rose)',
  ink:     'var(--th-ink)',
  inkD:    'var(--th-ink-d)',
  inkF:    'var(--th-ink-f)',
  ffDisp:  'var(--ff-disp)',
  ffBody:  'var(--ff-body)',
  ffMono:  'var(--ff-mono)',
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
  const dragCounter = useRef(0);

  const [runs,        setRuns]        = useState<ScrapeRun[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [creating,    setCreating]    = useState(false);
  const [tags,        setTags]        = useState<string[]>([]);
  const [countries,   setCountries]   = useState(['DE', 'AT']);
  const [platforms,   setPlatforms]   = useState(['FACEBOOK', 'INSTAGRAM']);
  const [adStatus,    setAdStatus]    = useState('ACTIVE');
  const [csvFile,     setCsvFile]     = useState<File | null>(null);
  const [dragOver,    setDragOver]    = useState(false);
  const [presets,     setPresets]     = useState<Record<string, any>>({});
  const [presetName,  setPresetName]  = useState('');
  const [formError,   setFormError]   = useState('');
  const [uploading,   setUploading]   = useState(false);

  useEffect(() => {
    api.runs.list().then(runs => {
      setRuns(runs);
      const last = runs[0];
      if (last?.scraper_config) applyRunConfig(last.scraper_config as Record<string, any>);
    }).catch(() => {}).finally(() => setLoading(false));
    const saved = localStorage.getItem('presets');
    if (saved) setPresets(JSON.parse(saved));
  }, []);

  // Global drag-to-drop listeners
  const onWindowDragEnter = useCallback((e: DragEvent) => {
    if (e.dataTransfer?.types.includes('Files')) { dragCounter.current++; setDragOver(true); }
  }, []);
  const onWindowDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setDragOver(false); }
  }, []);
  const onWindowDragOver = useCallback((e: DragEvent) => { e.preventDefault(); }, []);
  const onWindowDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    const file = e.dataTransfer?.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setCsvFile(file);
      setFormError('');
      uploadCsv(file);
    } else if (file) {
      setFormError('Nur CSV/Excel-Dateien (.csv, .xlsx, .xls)');
    }
  }, []);

  useEffect(() => {
    window.addEventListener('dragenter', onWindowDragEnter);
    window.addEventListener('dragleave', onWindowDragLeave);
    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('drop', onWindowDrop);
    return () => {
      window.removeEventListener('dragenter', onWindowDragEnter);
      window.removeEventListener('dragleave', onWindowDragLeave);
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('drop', onWindowDrop);
    };
  }, [onWindowDragEnter, onWindowDragLeave, onWindowDragOver, onWindowDrop]);

  const applyRunConfig = (cfg: Record<string, any>) => {
    if (cfg.keywords) setTags(Array.isArray(cfg.keywords) ? cfg.keywords : cfg.keywords.split('\n').filter(Boolean));
    if (cfg.countries) setCountries(cfg.countries);
    if (cfg.platforms) setPlatforms(cfg.platforms);
    if (cfg.ad_status) setAdStatus(cfg.ad_status);
  };

  const savePreset = () => {
    if (!presetName.trim()) return;
    const cfg = { keywords: tags, countries, platforms, adStatus };
    const next = { ...presets, [presetName]: cfg };
    setPresets(next);
    localStorage.setItem('presets', JSON.stringify(next));
    setPresetName('');
  };

  const loadPreset = (name: string) => {
    const p = presets[name];
    if (!p) return;
    setTags(p.keywords ?? []);
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

  const uploadCsv = async (file: File) => {
    setUploading(true);
    setFormError('');
    try {
      const run = await api.runs.create('csv_import', {});
      const fd = new FormData();
      fd.append('file', file);
      await api.runs.upload(run.id, fd);
      setRuns(prev => [run, ...prev]);
      router.push(`/runs/${run.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Upload fehlgeschlagen — Backend erreichbar?');
      setCsvFile(null);
    } finally {
      setUploading(false);
    }
  };

  const startScrape = async () => {
    setFormError('');
    if (tags.length === 0) { setFormError('Mindestens einen Suchbegriff eingeben'); return; }
    const settings = loadSettings();
    const token = settings.apiKeys.meta_ads;
    if (!token) { setFormError('Meta Ads API-Token fehlt — bitte in Einstellungen eintragen'); return; }
    setCreating(true);
    try {
      const run = await api.runs.create('meta_ads_library', {
        keywords: tags, countries, platforms, ad_status: adStatus,
        meta_ads_token: token,
      });
      setRuns(prev => [run, ...prev]);
      router.push(`/runs/${run.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Fehler beim Erstellen');
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

            {/* ① Source row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: T.ffMono, fontSize: 10, letterSpacing: '.14em', color: T.inkF, textTransform: 'uppercase', flexShrink: 0 }}>Quelle</span>
              <div style={{ display: 'flex', background: T.panel2, borderRadius: 6, border: `1px solid ${T.lineS}`, padding: 2, gap: 2 }}>
                <button style={{ padding: '4px 12px', borderRadius: 4, background: T.panel, border: `1px solid ${T.line}`, fontFamily: T.ffMono, fontSize: 11, color: T.ink, cursor: 'default' }}>
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

            {/* ② Filter-Box — Preset-Header rechts oben, Keywords + Filter + Save darin */}
            <div style={{ background: T.panel2, border: `1px solid ${T.lineS}`, borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

              {/* Box-Header: Presets links laden, Speichern rechts */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: `1px solid ${T.lineS}`, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.inkF, flexShrink: 0 }}>Preset</span>
                <div style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap' }}>
                  {Object.keys(presets).length === 0 ? (
                    <span style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkF, opacity: .4 }}>Keine gespeichert</span>
                  ) : (
                    Object.keys(presets).map(name => (
                      <span key={name} style={{ display: 'inline-flex', alignItems: 'center', background: T.goldD, border: `1px solid ${T.line}`, borderRadius: 4, overflow: 'hidden' }}>
                        <button onClick={() => loadPreset(name)} style={{ fontFamily: T.ffMono, fontSize: 11, color: T.gold, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px' }}>{name}</button>
                        <button onClick={() => deletePreset(name)} style={{ fontSize: 13, color: T.inkF, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>×</button>
                      </span>
                    ))
                  )}
                </div>
                {/* Speichern rechts oben */}
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                  <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && savePreset()}
                    placeholder="Name…"
                    style={{ width: 110, padding: '2px 7px', fontSize: 11, fontFamily: T.ffMono, borderRadius: 4, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none' }} />
                  <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={savePreset}>+ Speichern</button>
                </div>
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
                  <ChipGroup options={COUNTRY_OPTIONS} value={countries} onChange={setCountries} />
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
              </div>
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

            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { setCsvFile(f); uploadCsv(f); } }} />

          </div>

          {/* ── Right: Runs list ── */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ background: T.panel, border: `1px solid ${T.lineS}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: `1px solid ${T.lineS}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: T.inkF }}>Letzte Runs</span>
                <button onClick={() => router.push('/runs')} style={{ fontFamily: T.ffMono, fontSize: 10, color: T.gold, background: 'none', border: 'none', cursor: 'pointer' }}>Alle →</button>
              </div>
              {loading ? (
                <div style={{ padding: '16px', textAlign: 'center', fontFamily: T.ffMono, fontSize: 11, color: T.inkF }}>Lädt…</div>
              ) : runs.length === 0 ? (
                <div style={{ padding: '20px 14px', textAlign: 'center' }}>
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
                            onClick={() => { applyRunConfig(run.scraper_config as Record<string, any>); showToast('Einstellungen geladen', 'success'); }}
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
