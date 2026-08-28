'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';

const TABS = ['Scraping', 'Review & Filter', 'Enrichment', 'Export'] as const;
type Tab = typeof TABS[number];

export default function RunDetail() {
  const router = useRouter();
  const params = useParams();
  const runId = params.id as string;

  const [run, setRun] = useState<ScrapeRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('Scraping');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRun = async () => {
      try {
        const data = await api.runs.get(runId);
        setRun(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load run');
      } finally {
        setLoading(false);
      }
    };
    loadRun();
  }, [runId]);

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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-noir">
        <p className="text-ink-dim">Loading...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-noir">
        <p className="text-bad">{error || 'Run nicht gefunden'}</p>
      </div>
    );
  }

  const statusInfo = getStatusBadge(run.status);
  const classificationResult = Object.values(run.classification_results)[0];

  return (
    <div className="min-h-screen bg-noir">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="text-ink-dim hover:text-gold-bright transition-colors mb-6 text-xs font-mono tracking-wider"
        >
          ← Zurück
        </button>

        {/* Header */}
        <div className="border-t border-gold-dim border-b border-line mb-8 py-4">
          <div className="absolute w-[100px] h-px bg-gold -translate-y-[12px]" />
          <p className="text-gold font-mono text-xs tracking-widest mb-1">
            {run.source}
          </p>
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-3xl font-disp font-light mb-1">
                Run <em className="italic text-gold-bright">#{run.id.slice(0, 8)}</em>
              </h1>
              <p className="text-ink-dim text-xs font-light">{formatDate(run.created_at)}</p>
            </div>
            <span className={`inline-block px-2 py-1 rounded text-xs font-mono tracking-wider border ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-panel-2 border border-line-soft rounded p-3">
            <p className="text-ink-faint text-xs font-mono tracking-wider mb-1">Scraped</p>
            <p className="text-2xl font-disp font-light text-gold">
              {classificationResult?.keep || 0}
            </p>
          </div>
          <div className="bg-panel-2 border border-line-soft rounded p-3">
            <p className="text-ink-faint text-xs font-mono tracking-wider mb-1">Rejected</p>
            <p className="text-2xl font-disp font-light text-bad">
              {classificationResult?.reject || 0}
            </p>
          </div>
          <div className="bg-panel-2 border border-line-soft rounded p-3">
            <p className="text-ink-faint text-xs font-mono tracking-wider mb-1">Unclear</p>
            <p className="text-2xl font-disp font-light text-warn">
              {classificationResult?.unklar || 0}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-line mb-4">
          <div className="flex gap-4">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-0.5 font-mono text-xs tracking-wider transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-gold text-ink'
                    : 'border-transparent text-ink-faint hover:text-ink'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-8">
          {activeTab === 'Scraping' && (
            <div className="space-y-4">
              <div className="bg-panel-2 border border-line-soft rounded-lg p-6">
                <h3 className="font-mono text-xs tracking-wider uppercase text-ink-faint mb-4 font-medium">
                  Scraping Progress
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-ink-dim">Keywords scraped</span>
                    <span className="font-mono text-gold font-semibold">{classificationResult?.keep || 0} / 100</span>
                  </div>
                  <div className="w-full h-2 bg-panel-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-gold-bright rounded-full"
                      style={{ width: `${((classificationResult?.keep || 0) / 100) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-ink-dim text-sm">Status: <span className="text-ink font-mono">{run.status}</span></p>
            </div>
          )}

          {activeTab === 'Review & Filter' && (
            <div className="bg-panel-2 border border-line-soft rounded-lg p-6">
              <p className="text-ink-dim text-sm mb-4">
                Review and filter the scraped data. Keep entries you want to enrich further.
              </p>
              <div className="text-center py-8">
                <p className="text-ink-faint text-sm">Filtered: <span className="text-gold font-mono font-semibold">{classificationResult?.keep || 0}</span></p>
              </div>
            </div>
          )}

          {activeTab === 'Enrichment' && (
            <div className="bg-panel-2 border border-line-soft rounded-lg p-6">
              <p className="text-ink-dim text-sm mb-4">
                Enrich data with contact information, company details, and more.
              </p>
              <div className="text-center py-8">
                <p className="text-ink-faint text-sm">Ready for enrichment: <span className="text-warn font-mono font-semibold">{classificationResult?.keep || 0}</span></p>
              </div>
            </div>
          )}

          {activeTab === 'Export' && (
            <div className="space-y-4">
              <div className="bg-panel-2 border border-line-soft rounded-lg p-6">
                <h3 className="font-mono text-xs tracking-wider uppercase text-ink-faint mb-4 font-medium">
                  Export Options
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <button className="h-10 bg-panel-3 border border-line rounded-lg text-ink hover:border-gold-dim transition-colors text-sm font-medium">
                    XLSX herunterladen
                  </button>
                  <button className="h-10 bg-panel-3 border border-line rounded-lg text-ink hover:border-gold-dim transition-colors text-sm font-medium">
                    CSV herunterladen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
