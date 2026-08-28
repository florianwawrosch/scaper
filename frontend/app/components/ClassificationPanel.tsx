'use client';

import { useState } from 'react';
import { getAiConfig } from '@/lib/settings';
import { useToast } from './Toast';

interface Props {
  runId: string;
  leadsCount: number;
  onClassificationStart?: () => void;
  onClassificationComplete?: (results?: any[]) => void;
}

export function ClassificationPanel({ runId, leadsCount, onClassificationStart, onClassificationComplete }: Props) {
  const { showToast } = useToast();
  const [classifying, setClassifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{ keep: number; reject: number; unklar: number } | null>(null);

  const start = async () => {
    if (leadsCount === 0) return showToast('Keine Leads vorhanden', 'warning');
    setClassifying(true);
    setProgress(10);
    onClassificationStart?.();

    const tick = setInterval(() => setProgress(p => Math.min(p + 8, 88)), 400);

    try {
      const aiConfig = getAiConfig();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/runs/${runId}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProvider: aiConfig.provider, aiModel: aiConfig.model }),
      });

      clearInterval(tick);

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setProgress(100);
      setStats(data.stats);
      showToast(`${data.stats.keep} behalten · ${data.stats.reject} abgelehnt`, 'success');
      onClassificationComplete?.(data.results);
      setTimeout(() => setProgress(0), 800);
    } catch (e) {
      clearInterval(tick);
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
      setProgress(0);
    } finally {
      setClassifying(false);
    }
  };

  const cfg = getAiConfig();

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-panel flex items-center justify-between">
        <span className="text-xs font-mono tracking-wider text-ink uppercase">AI-Klassifizierung</span>
        <span className="text-xs font-mono text-ink-faint">
          {cfg.provider} · {cfg.model}
        </span>
      </div>

      <div className="p-5 bg-panel-2 space-y-4">
        {/* Progress */}
        {progress > 0 && (
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-ink-faint">Klassifiziert…</span>
              <span className="text-gold">{progress}%</span>
            </div>
            <div className="w-full h-1 bg-panel-3 rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-gold-bright transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Keep', value: stats.keep, cls: 'text-good' },
              { label: 'Reject', value: stats.reject, cls: 'text-bad' },
              { label: 'Unklar', value: stats.unklar, cls: 'text-warn' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="bg-panel-3 border border-line rounded p-3 text-center">
                <p className={`text-lg font-disp font-light ${cls}`}>{value}</p>
                <p className="text-xs font-mono text-ink-faint mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 items-center">
          <button
            onClick={start}
            disabled={classifying || leadsCount === 0}
            className="flex-1 py-2.5 rounded bg-gradient-to-r from-gold to-gold-dim hover:from-gold-bright hover:to-gold text-noir text-xs font-semibold font-mono tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {classifying ? `Läuft… ${progress}%` : `▶ Klassifizierung starten (${leadsCount} Leads)`}
          </button>
        </div>
      </div>
    </div>
  );
}
