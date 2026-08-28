'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ScrapeRun, type Source } from '@/lib/api';
import { useToast } from '@/app/components/Toast';
import { loadSettings, type AppSettings } from '@/lib/settings';

const COUNTRY_OPTIONS = [
  { value: 'DE', label: 'DE — Deutschland' },
  { value: 'AT', label: 'AT — Österreich' },
  { value: 'CH', label: 'CH — Schweiz' },
  { value: 'US', label: 'US — USA' },
  { value: 'GB', label: 'GB — UK' },
];

const PLATFORM_OPTIONS = [
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'INSTAGRAM', label: 'Instagram' },
];

const STATUS_MAP: Record<ScrapeRun['status'], { label: string; cls: string }> = {
  draft:         { label: 'Draft',       cls: 'text-ink-faint border-ink-faint/30 bg-ink-faint/5' },
  scraping:      { label: 'Scraping',    cls: 'text-warn border-warn/40 bg-warn/8' },
  dataset_ready: { label: 'Bereit',      cls: 'text-good border-good/40 bg-good/8' },
  in_progress:   { label: 'Aktiv',       cls: 'text-warn border-warn/40 bg-warn/8' },
  completed:     { label: 'Fertig',      cls: 'text-good border-good/40 bg-good/8' },
  failed:        { label: 'Fehler',      cls: 'text-bad border-bad/40 bg-bad/8' },
};

function Toggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o.value)}
          className={`px-2.5 py-1 text-xs font-mono tracking-wide rounded border transition-all ${
            value.includes(o.value)
              ? 'bg-gold text-noir border-gold font-semibold'
              : 'bg-transparent text-ink-faint border-line hover:border-gold-dim hover:text-ink'
          }`}
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
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [sources, setSources] = useState<{ key: string; label: string }[]>([]);
  const [selectedSource, setSelectedSource] = useState('meta_ads_library');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [countries, setCountries] = useState(['DE', 'AT']);
  const [platforms, setPlatforms] = useState(['FACEBOOK', 'INSTAGRAM']);
  const [adStatus, setAdStatus] = useState('ACTIVE');
  const [presets, setPresets] = useState<Record<string, any>>({});
  const [presetName, setPresetName] = useState('');

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

  return (
    <div className="min-h-screen bg-noir">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Page Header */}
        <div className="mb-12">
          <p className="text-gold font-mono text-xs tracking-widest uppercase mb-3">Lead Acquisition System</p>
          <h1 className="text-4xl font-disp font-light tracking-tight text-ink mb-2">
            Neuen Run <em className="italic text-gold-bright">starten</em>
          </h1>
          <p className="text-ink-faint text-sm font-light">
            Scrape · Filter · Enrich · Export
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8">
          {/* Left: Form */}
          <div className="space-y-1">

            {/* Section: Source */}
            <div className="border border-line rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-line bg-panel flex items-center gap-3">
                <span className="text-gold font-mono text-xs tracking-widest">01</span>
                <span className="text-xs font-mono tracking-wider text-ink uppercase">Datenquelle</span>
              </div>
              <div className="p-5 bg-panel-2 space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {sources.map(s => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSelectedSource(s.key)}
                      className={`px-3 py-2.5 rounded border text-xs font-mono tracking-wide transition-all text-left ${
                        selectedSource === s.key
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-line bg-panel-3 text-ink-faint hover:border-line-soft hover:text-ink'
                      }`}
                    >
                      {s.label || s.key}
                    </button>
                  ))}
                  {sources.length === 0 && (
                    <div className="col-span-3 text-ink-faint text-xs font-mono py-2">Backend nicht verbunden</div>
                  )}
                </div>
              </div>
            </div>

            {/* Section: Keywords */}
            <div className="border border-line rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-line bg-panel flex items-center gap-3">
                <span className="text-gold font-mono text-xs tracking-widest">02</span>
                <span className="text-xs font-mono tracking-wider text-ink uppercase">Suchbegriffe</span>
                <span className="ml-auto text-ink-faint text-xs font-mono">je Zeile ein Begriff</span>
              </div>
              <div className="p-5 bg-panel-2">
                <textarea
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder={"High Ticket Coach\nManifestation\nOnline Business\nPersonal Branding"}
                  rows={5}
                  className="w-full bg-panel-3 border border-line rounded text-ink text-sm font-mono px-3 py-2.5 resize-none focus:outline-none focus:border-gold-dim transition-colors placeholder:text-ink-faint/50"
                />
              </div>
            </div>

            {/* Section: Parameters */}
            <div className="border border-line rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-line bg-panel flex items-center gap-3">
                <span className="text-gold font-mono text-xs tracking-widest">03</span>
                <span className="text-xs font-mono tracking-wider text-ink uppercase">Parameter</span>
              </div>
              <div className="p-5 bg-panel-2 space-y-5">

                <div>
                  <label className="block text-xs font-mono tracking-wider text-ink-faint mb-2 uppercase">Länder</label>
                  <Toggle options={COUNTRY_OPTIONS} value={countries} onChange={setCountries} />
                </div>

                <div>
                  <label className="block text-xs font-mono tracking-wider text-ink-faint mb-2 uppercase">Plattformen</label>
                  <Toggle options={PLATFORM_OPTIONS} value={platforms} onChange={setPlatforms} />
                </div>

                <div>
                  <label className="block text-xs font-mono tracking-wider text-ink-faint mb-2 uppercase">Ad-Status</label>
                  <div className="flex gap-1.5">
                    {['ACTIVE', 'ALL', 'INACTIVE'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setAdStatus(s)}
                        className={`px-2.5 py-1 text-xs font-mono tracking-wide rounded border transition-all ${
                          adStatus === s
                            ? 'bg-gold text-noir border-gold font-semibold'
                            : 'bg-transparent text-ink-faint border-line hover:border-gold-dim hover:text-ink'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Presets Bar */}
            <div className="border border-line rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-line bg-panel flex items-center gap-3">
                <span className="text-gold font-mono text-xs tracking-widest">04</span>
                <span className="text-xs font-mono tracking-wider text-ink uppercase">Presets</span>
              </div>
              <div className="p-4 bg-panel-2 flex flex-wrap gap-2 items-center">
                {Object.keys(presets).map(name => (
                  <div key={name} className="flex items-center gap-1 bg-panel-3 border border-line rounded px-2 py-1">
                    <button
                      type="button"
                      onClick={() => loadPreset(name)}
                      className="text-xs font-mono text-ink-dim hover:text-gold transition-colors"
                    >
                      {name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePreset(name)}
                      className="text-ink-faint hover:text-bad transition-colors text-xs ml-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="text"
                    value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    placeholder="Name..."
                    className="h-7 bg-panel-3 border border-line rounded text-ink text-xs font-mono px-2 focus:outline-none focus:border-gold-dim w-32"
                  />
                  <button
                    type="button"
                    onClick={savePreset}
                    className="h-7 px-3 text-xs font-mono border border-line rounded text-ink-faint hover:text-gold hover:border-gold-dim transition-colors"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={createRun}
              disabled={creating}
              className="w-full py-3.5 rounded-lg bg-gradient-to-r from-gold to-gold-dim hover:from-gold-bright hover:to-gold text-noir font-semibold text-sm tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? 'Wird gestartet…' : '→ Run starten'}
            </button>
          </div>

          {/* Right: Recent Runs */}
          <div>
            <div className="border border-line rounded-lg overflow-hidden sticky top-20">
              <div className="px-5 py-3 border-b border-line bg-panel flex items-center justify-between">
                <span className="text-xs font-mono tracking-wider text-ink uppercase">Letzte Runs</span>
                <button
                  onClick={() => router.push('/runs')}
                  className="text-gold-bright font-mono text-xs hover:text-gold transition-colors tracking-wider"
                >
                  Alle →
                </button>
              </div>

              {loading ? (
                <div className="p-6 text-center text-ink-faint text-xs font-mono">Lädt…</div>
              ) : runs.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-ink-faint text-xs font-mono mb-1">Noch keine Runs</p>
                  <p className="text-ink-faint/50 text-xs">Starte deinen ersten Run links.</p>
                </div>
              ) : (
                <div className="divide-y divide-line-soft">
                  {runs.slice(0, 8).map(run => {
                    const s = STATUS_MAP[run.status];
                    const keep = Object.values(run.classification_results)[0]?.keep || 0;
                    return (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() => router.push(`/runs/${run.id}`)}
                        className="w-full px-5 py-3 hover:bg-panel-3/40 transition-colors text-left flex items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-ink-dim truncate">{run.source}</p>
                          <p className="text-xs text-ink-faint font-mono mt-0.5">{fmt(run.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {keep > 0 && (
                            <span className="text-xs font-mono text-good font-semibold">{keep}</span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded border text-xs font-mono tracking-wide ${s.cls}`}>
                            {s.label}
                          </span>
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
