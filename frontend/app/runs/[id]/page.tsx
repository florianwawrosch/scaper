'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';
import { DataTable } from '@/app/components/DataTable';

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
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);

  useEffect(() => {
    const loadRun = async () => {
      try {
        const data = await api.runs.get(runId);
        setRun(data);
        setRating(data.rating || 0);
        setFeedback(data.feedback || '');

        // Generate mock table data
        const mockData = Array.from({ length: 25 }, (_, i) => ({
          id: `lead-${i + 1}`,
          name: `Company ${i + 1}`,
          contact: `contact${i + 1}@example.com`,
          budget: `€${(Math.random() * 100000 + 10000).toFixed(0)}`,
          status: ['Active', 'Leads', 'Qualified'][Math.floor(Math.random() * 3)],
        }));
        setTableData(mockData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load run');
      } finally {
        setLoading(false);
      }
    };
    loadRun();
  }, [runId]);

  const handleSaveRating = async () => {
    if (!run) return;
    setSavingRating(true);
    try {
      const updated = await api.runs.update(runId, {
        rating,
        feedback,
      });
      setRun(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rating');
    } finally {
      setSavingRating(false);
    }
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
            <div className="space-y-3">
              <div className="bg-panel-2 border border-line-soft rounded p-4">
                <h3 className="font-mono text-xs tracking-wider text-ink-faint mb-3 font-medium">
                  Progress
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-ink-dim">Scraped</span>
                      <span className="font-mono text-gold font-semibold">{classificationResult?.keep || 0}</span>
                    </div>
                    <div className="w-full h-1.5 bg-panel-3 rounded overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-gold to-gold-bright" style={{ width: '75%' }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-panel-3 rounded p-3 text-xs text-ink-dim font-mono">
                <div className="space-y-1">
                  <div>Status: <span className="text-ink">{run.status}</span></div>
                  <div>Created: <span className="text-ink-faint">{formatDate(run.created_at)}</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Review & Filter' && (
            <div className="space-y-3">
              <div className="bg-panel-3 rounded p-3">
                <div className="grid grid-cols-3 gap-3 text-center text-xs mb-4">
                  <div>
                    <p className="text-ink-faint mb-1">Behalten</p>
                    <p className="text-good font-mono font-semibold">{classificationResult?.keep || 0}</p>
                  </div>
                  <div>
                    <p className="text-ink-faint mb-1">Ablehnen</p>
                    <p className="text-bad font-mono font-semibold">{classificationResult?.reject || 0}</p>
                  </div>
                  <div>
                    <p className="text-ink-faint mb-1">Unklar</p>
                    <p className="text-warn font-mono font-semibold">{classificationResult?.unklar || 0}</p>
                  </div>
                </div>
              </div>
              <DataTable
                data={tableData}
                columns={['name', 'contact', 'budget', 'status']}
                onMarkKeep={(id) => console.log('Keep:', id)}
                onMarkReject={(id) => console.log('Reject:', id)}
              />
            </div>
          )}

          {activeTab === 'Enrichment' && (
            <div className="space-y-3">
              <div className="bg-panel-2 border border-line-soft rounded p-4">
                <h3 className="font-mono text-xs tracking-wider text-ink-faint mb-3 font-medium">
                  Enrichment
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-ink-dim">Contact Info</span>
                    <span className="text-warn font-mono">pending</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-dim">Company Details</span>
                    <span className="text-warn font-mono">pending</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-dim">Email Validation</span>
                    <span className="text-warn font-mono">pending</span>
                  </div>
                </div>
              </div>
              <button className="w-full h-8 bg-gradient-to-r from-gold to-gold-dim text-noir rounded hover:from-gold-bright hover:to-gold transition-colors text-xs font-medium font-semibold">
                Enrichment starten
              </button>
            </div>
          )}

          {activeTab === 'Export' && (
            <div className="space-y-3">
              <div className="bg-panel-2 border border-line-soft rounded p-4">
                <h3 className="font-mono text-xs tracking-wider text-ink-faint mb-3 font-medium">
                  Format
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button className="h-8 bg-gradient-to-r from-gold/40 to-gold-dim/40 border border-gold/35 text-gold rounded hover:from-gold/60 hover:to-gold-dim/60 transition-colors text-xs font-medium">
                    ↓ XLSX
                  </button>
                  <button className="h-8 bg-gradient-to-r from-gold/40 to-gold-dim/40 border border-gold/35 text-gold rounded hover:from-gold/60 hover:to-gold-dim/60 transition-colors text-xs font-medium">
                    ↓ CSV
                  </button>
                </div>
              </div>
              <div className="bg-panel-3 rounded p-3 text-xs text-ink-dim">
                <p className="mb-1">Zeilen zum Export:</p>
                <p className="font-mono text-gold font-semibold">{classificationResult?.keep || 0} Einträge</p>
              </div>
            </div>
          )}
        </div>

        {/* Rating & Feedback */}
        <div className="border-t border-line pt-6 mt-8">
          <h3 className="text-lg font-disp font-normal mb-4">Bewertung & Feedback</h3>
          <div className="bg-panel-2 border border-line-soft rounded p-4 space-y-3">
            <div>
              <label className="block text-xs font-mono tracking-wider text-ink-faint mb-2">
                Rating
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-2xl transition-colors cursor-pointer ${
                      rating >= star ? 'text-gold' : 'text-ink-faint'
                    } hover:text-gold-bright`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                Feedback
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Dein Feedback zu diesem Run..."
                className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm resize-none"
                rows={2}
              />
            </div>
            <button
              onClick={handleSaveRating}
              disabled={savingRating}
              className="h-8 bg-gradient-to-r from-gold to-gold-dim text-noir rounded hover:from-gold-bright hover:to-gold transition-colors text-xs font-medium font-semibold w-full disabled:opacity-50"
            >
              {savingRating ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
