'use client';

import { useState, useEffect } from 'react';
import { api, type ScrapeRun, type Source } from '@/lib/api';

export default function Home() {
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState('meta-ads');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      draft: { label: 'ENTWURF', color: 'bg-ink-faint/10 border-ink-faint/35 text-ink-faint' },
      scraping: { label: 'SCRAPING', color: 'bg-warn/10 border-warn/35 text-warn' },
      dataset_ready: { label: 'DATASET BEREIT', color: 'bg-good/10 border-good/35 text-good' },
      in_progress: { label: 'IN BEARBEITUNG', color: 'bg-warn/10 border-warn/35 text-warn' },
      completed: { label: 'ABGESCHLOSSEN', color: 'bg-good/10 border-good/35 text-good' },
      failed: { label: 'FEHLGESCHLAGEN', color: 'bg-bad/10 border-bad/35 text-bad' },
    };
    return statusMap[status];
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    const filled = Math.round(rating);
    return (
      <span className="text-gold tracking-widest">
        {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
      </span>
    );
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
      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="border-t border-gold-dim border-b border-line mb-12 py-6">
          <div className="absolute w-[130px] h-[2px] bg-gold -translate-y-[17px]" />
          <p className="text-gold font-mono text-xs tracking-widest uppercase mb-3">
            Lead Pipeline · Multi-Source Scraper
          </p>
          <h1 className="text-5xl font-disp font-light mb-2">
            Lead <em className="italic text-gold-bright">Pipeline</em>
          </h1>
          <p className="text-ink-dim text-sm font-light">
            Scrape · Filter · Enrich · Export
          </p>
        </div>

        {/* Section 01: New Run */}
        <section className="mb-16">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="text-gold font-mono text-xs tracking-wider uppercase">01</span>
            <h2 className="text-2xl font-disp font-normal tracking-wide">Neuer Run</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-line to-transparent" />
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-mono tracking-wider uppercase text-ink-faint mb-2">
                  Datenquelle
                </label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full bg-panel-2 border border-line rounded-lg text-ink px-3 py-2.5 text-sm"
                >
                  {sources.map((src) => (
                    <option key={src.key} value={src.key}>
                      {src.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1" />
            </div>

            {/* Configuration Panel */}
            <div className="bg-panel-2 border border-line-soft rounded-xl p-4 mt-6">
              <h3 className="font-mono text-xs tracking-wider uppercase text-ink mb-4 font-medium">
                Suchparameter
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono tracking-wider uppercase text-ink-faint mb-2">
                    Suchbegriffe
                  </label>
                  <textarea
                    placeholder="z.B. High Ticket Coach&#10;Manifestation&#10;Online Business"
                    className="w-full bg-panel-3 border border-line rounded-lg text-ink px-3 py-2 text-sm resize-none"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono tracking-wider uppercase text-ink-faint mb-2">
                      Länder
                    </label>
                    <select
                      multiple
                      defaultValue={['AT', 'DE']}
                      className="w-full bg-panel-3 border border-line rounded-lg text-ink px-3 py-2 text-sm"
                    >
                      <option>AT</option>
                      <option>DE</option>
                      <option>CH</option>
                      <option>US</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono tracking-wider uppercase text-ink-faint mb-2">
                      Status
                    </label>
                    <select className="w-full bg-panel-3 border border-line rounded-lg text-ink px-3 py-2 text-sm">
                      <option>ACTIVE</option>
                      <option>ALL</option>
                      <option>INACTIVE</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono tracking-wider uppercase text-ink-faint mb-2">
                      Plattformen
                    </label>
                    <select
                      multiple
                      defaultValue={['FACEBOOK', 'INSTAGRAM']}
                      className="w-full bg-panel-3 border border-line rounded-lg text-ink px-3 py-2 text-sm"
                    >
                      <option>FACEBOOK</option>
                      <option>INSTAGRAM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono tracking-wider uppercase text-ink-faint mb-2">
                      Medientyp
                    </label>
                    <select className="w-full bg-panel-3 border border-line rounded-lg text-ink px-3 py-2 text-sm">
                      <option>ALL</option>
                      <option>IMAGE</option>
                      <option>VIDEO</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button className="h-10 bg-panel-3 border border-line rounded-lg text-ink hover:border-gold-dim transition-colors text-sm font-medium">
                    Config speichern
                  </button>
                  <button className="h-10 bg-gradient-to-r from-gold to-gold-dim text-noir rounded-lg hover:from-gold-bright hover:to-gold transition-colors text-sm font-medium font-semibold">
                    Run starten
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 02: Recent Runs */}
        <section>
          <div className="flex items-baseline gap-4 mb-6">
            <span className="text-gold font-mono text-xs tracking-wider uppercase">02</span>
            <h2 className="text-2xl font-disp font-normal tracking-wide">Letzte Runs</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-line to-transparent" />
          </div>

          {error && (
            <div className="bg-bad/10 border border-bad/35 rounded-lg p-4 mb-4 text-bad text-sm">
              {error}
            </div>
          )}

          <div className="border border-line-soft rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-panel border-b border-line">
                  <th className="text-xs font-mono tracking-wider uppercase text-ink-faint text-left px-4 py-3 font-medium">
                    Status
                  </th>
                  <th className="text-xs font-mono tracking-wider uppercase text-ink-faint text-left px-4 py-3 font-medium">
                    Quelle
                  </th>
                  <th className="text-xs font-mono tracking-wider uppercase text-ink-faint text-left px-4 py-3 font-medium">
                    Datum
                  </th>
                  <th className="text-xs font-mono tracking-wider uppercase text-ink-faint text-left px-4 py-3 font-medium">
                    Keep
                  </th>
                  <th className="text-xs font-mono tracking-wider uppercase text-ink-faint text-left px-4 py-3 font-medium">
                    Rating
                  </th>
                  <th className="text-xs font-mono tracking-wider uppercase text-ink-faint text-left px-4 py-3 font-medium">
                    Aktion
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 3).map((run) => {
                  const statusInfo = getStatusBadge(run.status);
                  return (
                    <tr key={run.id} className="border-b border-line-soft hover:bg-panel-3/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-mono tracking-wider uppercase border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-dim">{run.source_key}</td>
                      <td className="px-4 py-3 text-sm text-ink-dim font-mono">{formatDate(run.created_at)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-good font-semibold">{run.keep_count}</td>
                      <td className="px-4 py-3 text-sm">{renderStars(run.rating)}</td>
                      <td className="px-4 py-3">
                        <button className="text-sm px-3 py-1.5 bg-panel-3 border border-line rounded hover:border-gold-dim transition-colors text-ink">
                          Details
                        </button>
                      </td>
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
