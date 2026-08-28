'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, type ScrapeRun } from '@/lib/api';

export default function EditRun() {
  const router = useRouter();
  const params = useParams();
  const runId = params.id as string;

  const [run, setRun] = useState<ScrapeRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const handleSave = async () => {
    if (!run) return;
    setSaving(true);
    try {
      // TODO: Add save endpoint to API
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push(`/runs/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="min-h-screen bg-noir">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <button
          onClick={() => router.back()}
          className="text-ink-dim hover:text-gold-bright transition-colors mb-6 text-xs font-mono tracking-wider"
        >
          ← Abbrechen
        </button>

        <div className="border-t border-gold-dim border-b border-line mb-8 py-4">
          <div className="absolute w-[100px] h-px bg-gold -translate-y-[12px]" />
          <h1 className="text-3xl font-disp font-light mb-1">
            Run bearbeiten
          </h1>
          <p className="text-ink-dim text-xs font-light">ID: {run.id.slice(0, 12)}</p>
        </div>

        {error && (
          <div className="bg-bad/10 border border-bad/35 rounded p-3 mb-6 text-bad text-xs">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Configuration Editor */}
          <div className="bg-panel-2 border border-line-soft rounded p-4">
            <h3 className="font-mono text-xs tracking-wider text-ink-faint mb-4 font-medium">
              Konfiguration
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                  Quelle
                </label>
                <input
                  type="text"
                  value={run.source}
                  readOnly
                  className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                  Status
                </label>
                <input
                  type="text"
                  value={run.status}
                  readOnly
                  className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Dataset Preview */}
          <div className="bg-panel-2 border border-line-soft rounded p-4">
            <h3 className="font-mono text-xs tracking-wider text-ink-faint mb-3 font-medium">
              Dataset
            </h3>
            <div className="bg-panel-3 rounded p-3 text-xs text-ink-dim font-mono">
              <div className="flex justify-between mb-2">
                <span>Keep: {Object.values(run.classification_results)[0]?.keep || 0}</span>
                <span>Reject: {Object.values(run.classification_results)[0]?.reject || 0}</span>
                <span>Unklar: {Object.values(run.classification_results)[0]?.unklar || 0}</span>
              </div>
              <p className="text-ink-faint">Dataset-Vorschau wird hier angezeigt</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 h-8 bg-panel-3 border border-line rounded text-ink hover:border-gold-dim transition-colors text-xs font-medium"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-8 bg-gradient-to-r from-gold to-gold-dim text-noir rounded hover:from-gold-bright hover:to-gold transition-colors text-xs font-medium font-semibold disabled:opacity-50"
            >
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
