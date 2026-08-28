'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';
import { DataTable } from '@/app/components/DataTable';
import { ExportPanel } from '@/app/components/ExportPanel';
import { EnrichmentPanel } from '@/app/components/EnrichmentPanel';
import { ClassificationPanel } from '@/app/components/ClassificationPanel';

const TABS = ['Scraping', 'Review & Filter', 'Enrichment', 'Export'] as const;
type Tab = typeof TABS[number];

const STATUS_MAP: Record<ScrapeRun['status'], { label: string; cls: string }> = {
  draft:         { label: 'Draft',      cls: 'text-ink-faint border-ink-faint/30 bg-ink-faint/5' },
  scraping:      { label: 'Scraping',   cls: 'text-warn border-warn/40 bg-warn/8' },
  dataset_ready: { label: 'Bereit',     cls: 'text-good border-good/40 bg-good/8' },
  in_progress:   { label: 'Aktiv',      cls: 'text-warn border-warn/40 bg-warn/8' },
  completed:     { label: 'Abgeschlossen', cls: 'text-good border-good/40 bg-good/8' },
  failed:        { label: 'Fehler',     cls: 'text-bad border-bad/40 bg-bad/8' },
};

function Stat({ label, value, cls }: { label: string; value: number | string; cls: string }) {
  return (
    <div className="bg-panel-2 border border-line rounded-lg px-4 py-3">
      <p className="text-xs font-mono tracking-wider text-ink-faint uppercase mb-1">{label}</p>
      <p className={`text-2xl font-disp font-light ${cls}`}>{value}</p>
    </div>
  );
}

export default function RunDetail() {
  const router = useRouter();
  const params = useParams();
  const runId = params.id as string;

  const [run, setRun] = useState<ScrapeRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('Scraping');
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);

  const loadRun = useCallback(async () => {
    try {
      const data = await api.runs.get(runId);
      setRun(data);
      setRating(data.rating || 0);
      setFeedback(data.feedback || '');

      // Load dataset for table
      try {
        const ds = await api.runs.getDataset(runId);
        if (ds.df_data?.length) setTableData(ds.df_data);
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { loadRun(); }, [loadRun]);

  const saveRating = async () => {
    if (!run) return;
    setSavingRating(true);
    try {
      const updated = await api.runs.update(runId, { rating, feedback });
      setRun(updated);
    } catch {}
    setSavingRating(false);
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-noir flex items-center justify-center">
        <p className="text-ink-faint font-mono text-xs tracking-wider animate-pulse">Lädt…</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-noir flex items-center justify-center">
        <p className="text-bad font-mono text-xs">{error || 'Run nicht gefunden'}</p>
      </div>
    );
  }

  const s = STATUS_MAP[run.status];
  const cr = Object.values(run.classification_results)[0];

  return (
    <div className="min-h-screen bg-noir">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Back */}
        <button
          onClick={() => router.push('/runs')}
          className="text-ink-faint hover:text-gold-bright font-mono text-xs tracking-wider transition-colors mb-8 block"
        >
          ← Alle Runs
        </button>

        {/* Run Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-gold font-mono text-xs tracking-widest uppercase mb-2">{run.source}</p>
            <h1 className="text-4xl font-disp font-light tracking-tight mb-1">
              Run <em className="italic text-gold-bright">#{run.id.slice(0, 8)}</em>
            </h1>
            <p className="text-ink-faint text-xs font-mono">{fmt(run.created_at)}</p>
          </div>
          <span className={`px-2.5 py-1 rounded border text-xs font-mono tracking-wide shrink-0 mt-1 ${s.cls}`}>
            {s.label}
          </span>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Stat label="Keep" value={cr?.keep ?? 0} cls="text-good" />
          <Stat label="Reject" value={cr?.reject ?? 0} cls="text-bad" />
          <Stat label="Unklar" value={cr?.unklar ?? 0} cls="text-warn" />
          <Stat label="Gesamt" value={(cr?.keep ?? 0) + (cr?.reject ?? 0) + (cr?.unklar ?? 0)} cls="text-ink" />
        </div>

        {/* Tabs */}
        <div className="border-b border-line mb-6">
          <div className="flex gap-0">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-5 py-2.5 text-xs font-mono tracking-wider transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-gold text-ink'
                    : 'border-transparent text-ink-faint hover:text-ink-dim'
                }`}
              >
                <span className="text-gold/50 mr-1.5">{String(i + 1).padStart(2, '0')}</span>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-12">
          {activeTab === 'Scraping' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-panel-2 border border-line rounded-lg p-5">
                  <p className="text-xs font-mono tracking-wider text-ink-faint uppercase mb-4">Run Details</p>
                  <dl className="space-y-2">
                    {[
                      { k: 'Status', v: run.status },
                      { k: 'Quelle', v: run.source },
                      { k: 'Erstellt', v: fmt(run.created_at) },
                    ].map(({ k, v }) => (
                      <div key={k} className="flex justify-between text-xs">
                        <dt className="text-ink-faint font-mono">{k}</dt>
                        <dd className="text-ink font-mono">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {run.scraper_config && (
                  <div className="bg-panel-2 border border-line rounded-lg p-5">
                    <p className="text-xs font-mono tracking-wider text-ink-faint uppercase mb-4">Konfiguration</p>
                    <pre className="text-xs font-mono text-ink-dim overflow-auto whitespace-pre-wrap max-h-40">
                      {JSON.stringify(run.scraper_config, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Pipeline Progress */}
              <div className="bg-panel-2 border border-line rounded-lg p-5">
                <p className="text-xs font-mono tracking-wider text-ink-faint uppercase mb-4">Pipeline</p>
                <div className="flex items-center gap-0">
                  {['Scraped', 'Gefiltert', 'Enriched', 'Exportiert'].map((step, i, arr) => {
                    const done = i === 0 && (cr?.keep ?? 0) > 0;
                    return (
                      <div key={step} className="flex items-center">
                        <div className={`flex flex-col items-center gap-1`}>
                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${
                            i === 0 ? 'border-good bg-good/20 text-good' :
                            'border-line bg-panel-3 text-ink-faint'
                          }`}>
                            {i + 1}
                          </div>
                          <span className="text-xs font-mono text-ink-faint whitespace-nowrap">{step}</span>
                        </div>
                        {i < arr.length - 1 && (
                          <div className="w-10 h-px bg-line mx-1 mb-5" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Review & Filter' && (
            <div className="space-y-4">
              <ClassificationPanel
                runId={runId}
                leadsCount={tableData.length}
                onClassificationComplete={loadRun}
              />
              {tableData.length > 0 && (
                <DataTable
                  data={tableData}
                  columns={Object.keys(tableData[0]).slice(0, 6)}
                  onMarkKeep={id => console.log('Keep:', id)}
                  onMarkReject={id => console.log('Reject:', id)}
                />
              )}
              {tableData.length === 0 && (
                <div className="border border-line rounded-lg bg-panel-2 p-8 text-center">
                  <p className="text-ink-faint font-mono text-xs">Noch kein Dataset. Lade Daten hoch oder starte ein Scraping.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Enrichment' && (
            <EnrichmentPanel runId={runId} leadsCount={cr?.keep || 0} />
          )}

          {activeTab === 'Export' && (
            <ExportPanel
              runId={runId}
              leads={tableData.slice(0, 100).map((item, i) => ({
                id: item.id || `lead-${i}`,
                name: item.name || item.company || '—',
                email: item.email || item.contact || undefined,
                phone: item.phone || undefined,
                company: item.company || undefined,
                status: 'KEEP' as const,
                reason: undefined,
                createdAt: run.created_at,
              }))}
            />
          )}
        </div>

        {/* Rating */}
        <div className="border-t border-line pt-8">
          <h2 className="text-lg font-disp font-light mb-4">Bewertung & <em className="italic text-gold-bright">Feedback</em></h2>
          <div className="bg-panel-2 border border-line rounded-lg p-5 space-y-4">
            <div>
              <label className="block text-xs font-mono tracking-wider text-ink-faint uppercase mb-2">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-xl transition-colors ${rating >= star ? 'text-gold' : 'text-ink-faint/30'} hover:text-gold`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono tracking-wider text-ink-faint uppercase mb-2">Kommentar</label>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Dein Feedback zu diesem Run…"
                rows={3}
                className="w-full bg-panel-3 border border-line rounded text-ink text-sm px-3 py-2 resize-none focus:outline-none focus:border-gold-dim transition-colors"
              />
            </div>
            <button
              onClick={saveRating}
              disabled={savingRating}
              className="w-full py-2.5 rounded bg-gradient-to-r from-gold to-gold-dim hover:from-gold-bright hover:to-gold text-noir text-xs font-semibold font-mono tracking-wider transition-all disabled:opacity-40"
            >
              {savingRating ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
