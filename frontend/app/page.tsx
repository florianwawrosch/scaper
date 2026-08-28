'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ScrapeRun, type Source } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [sources, setSources] = useState<Record<string, Source>>({});
  const [selectedSource, setSelectedSource] = useState('meta_ads_library');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [keywords, setKeywords] = useState('');
  const [countries, setCountries] = useState(['DE', 'AT']);
  const [platforms, setPlatforms] = useState(['FACEBOOK', 'INSTAGRAM']);
  const [adStatus, setAdStatus] = useState('ACTIVE');
  const [mediaType, setMediaType] = useState('ALL');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [runsData, sourcesData] = await Promise.all([
          api.runs.list(),
          api.sources.list(),
        ]);
        setRuns(runsData);
        setSources(sourcesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: ScrapeRun['status']) => {
    const statusMap = {
      draft: { label: 'KONFIGURIERT', color: 'bg-ink-faint/10 border-ink-faint/35 text-ink-faint' },
      scraping: { label: 'WIRD GESCRAPED', color: 'bg-warn/10 border-warn/35 text-warn' },
      dataset_ready: { label: 'BEREIT', color: 'bg-good/10 border-good/35 text-good' },
      in_progress: { label: 'WIRD BEARBEITET', color: 'bg-warn/10 border-warn/35 text-warn' },
      completed: { label: 'FERTIG', color: 'bg-good/10 border-good/35 text-good' },
      failed: { label: 'FEHLER', color: 'bg-bad/10 border-bad/35 text-bad' },
    };
    return statusMap[status];
  };

  const handleCreateRun = async () => {
    if (!keywords.trim()) {
      setError('Suchbegriffe sind erforderlich');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const config = {
        keywords: keywords.split('\n').filter(k => k.trim()),
        countries,
        platforms,
        ad_status: adStatus,
        media_type: mediaType,
      };

      const newRun = await api.runs.create(selectedSource, config);
      setRuns([newRun, ...runs]);

      // Reset form
      setKeywords('');
      setCountries(['DE', 'AT']);
      setPlatforms(['FACEBOOK', 'INSTAGRAM']);
      setAdStatus('ACTIVE');
      setMediaType('ALL');

      // Navigate to run details
      router.push(`/runs/${newRun.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create run');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-ink-dim">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="border-t border-gold-dim border-b border-line mb-8 py-4">
          <div className="absolute w-[100px] h-px bg-gold -translate-y-[12px]" />
          <p className="text-gold font-mono text-xs tracking-widest uppercase mb-1">
            Lead Pipeline
          </p>
          <h1 className="text-3xl font-disp font-light mb-1">
            Lead <em className="italic text-gold-bright">Pipeline</em>
          </h1>
          <p className="text-ink-dim text-xs font-light">
            Scrape · Filter · Enrich · Export
          </p>
        </div>

        {/* Section 01: New Run */}
        <section className="mb-10">
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-gold font-mono text-xs tracking-wider">01</span>
            <h2 className="text-lg font-disp font-normal">Neuer Run</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-line to-transparent" />
          </div>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                  Datenquelle
                </label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full bg-panel-2 border border-line rounded text-ink px-2.5 py-1.5 text-sm"
                >
                  {Object.entries(sources).map(([key, src]) => (
                    <option key={key} value={key}>
                      {src.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1" />
            </div>

            {/* Configuration Panel */}
            <div className="bg-panel-2 border border-line-soft rounded p-3 mt-3">
              <h3 className="font-mono text-xs tracking-wider text-ink mb-3 font-medium">
                Suchparameter
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                    Suchbegriffe
                  </label>
                  <textarea
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="z.B. High Ticket Coach&#10;Manifestation&#10;Online Business"
                    className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm resize-none"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                      Länder
                    </label>
                    <select
                      multiple
                      value={countries}
                      onChange={(e) => setCountries(Array.from(e.target.selectedOptions, option => option.value))}
                      className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm"
                    >
                      <option>AT</option>
                      <option>DE</option>
                      <option>CH</option>
                      <option>US</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                      Status
                    </label>
                    <select
                      value={adStatus}
                      onChange={(e) => setAdStatus(e.target.value)}
                      className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm"
                    >
                      <option>ACTIVE</option>
                      <option>ALL</option>
                      <option>INACTIVE</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                      Plattformen
                    </label>
                    <select
                      multiple
                      value={platforms}
                      onChange={(e) => setPlatforms(Array.from(e.target.selectedOptions, option => option.value))}
                      className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm"
                    >
                      <option>FACEBOOK</option>
                      <option>INSTAGRAM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                      Medientyp
                    </label>
                    <select
                      value={mediaType}
                      onChange={(e) => setMediaType(e.target.value)}
                      className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm"
                    >
                      <option>ALL</option>
                      <option>IMAGE</option>
                      <option>VIDEO</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    className="h-8 bg-panel-3 border border-line rounded text-ink hover:border-gold-dim transition-colors text-xs font-medium disabled:opacity-50"
                    disabled={creating}
                  >
                    Config speichern
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateRun}
                    className="h-8 bg-gradient-to-r from-gold to-gold-dim text-noir rounded hover:from-gold-bright hover:to-gold transition-colors text-xs font-medium font-semibold disabled:opacity-50"
                    disabled={creating}
                  >
                    {creating ? 'Wird gestartet...' : 'Run starten'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 02: Recent Runs */}
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-gold font-mono text-xs tracking-wider">02</span>
            <h2 className="text-lg font-disp font-normal">Letzte Runs</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-line to-transparent" />
            <button
              onClick={() => router.push('/runs')}
              className="text-xs text-gold-bright hover:text-gold transition-colors font-mono tracking-wider"
            >
              Alle →
            </button>
          </div>

          {error && (
            <div className="bg-bad/10 border border-bad/35 rounded p-2 mb-3 text-bad text-xs">
              {error}
            </div>
          )}

          <div className="border border-line-soft rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-panel border-b border-line">
                  <th className="text-xs font-mono tracking-wider text-ink-faint text-left px-3 py-2 font-medium">
                    Status
                  </th>
                  <th className="text-xs font-mono tracking-wider text-ink-faint text-left px-3 py-2 font-medium">
                    Quelle
                  </th>
                  <th className="text-xs font-mono tracking-wider text-ink-faint text-left px-3 py-2 font-medium">
                    Datum
                  </th>
                  <th className="text-xs font-mono tracking-wider text-ink-faint text-left px-3 py-2 font-medium">
                    Keep
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 3).map((run) => {
                  const statusInfo = getStatusBadge(run.status);
                  const classificationResult = Object.values(run.classification_results)[0];
                  const keepCount = classificationResult?.keep || 0;
                  return (
                    <tr
                      key={run.id}
                      onClick={() => router.push(`/runs/${run.id}`)}
                      className="border-b border-line-soft hover:bg-panel-3/50 transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono tracking-wider border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          {run.status !== 'completed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/runs/${run.id}/edit`);
                              }}
                              className="text-ink-faint hover:text-gold-bright transition-colors text-xs"
                              title="Run bearbeiten"
                            >
                              ✎
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-dim">{run.source}</td>
                      <td className="px-3 py-2 text-xs text-ink-dim font-mono">{formatDate(run.created_at)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-good font-semibold">{keepCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
