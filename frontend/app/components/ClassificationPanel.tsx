'use client';

import { useState } from 'react';
import { getAiConfig } from '@/lib/settings';
import { useToast } from './Toast';

interface ClassificationPanelProps {
  runId: string;
  leadsCount: number;
  onClassificationStart?: () => void;
  onClassificationComplete?: (results: any[]) => void;
}

interface ClassificationStats {
  keep: number;
  reject: number;
  unclear: number;
}

export function ClassificationPanel({
  runId,
  leadsCount,
  onClassificationStart,
  onClassificationComplete,
}: ClassificationPanelProps) {
  const { showToast } = useToast();
  const [classifying, setClassifying] = useState(false);
  const [stats, setStats] = useState<ClassificationStats>({
    keep: 0,
    reject: 0,
    unclear: 0,
  });
  const [progress, setProgress] = useState(0);

  const handleStartClassification = async () => {
    if (leadsCount === 0) {
      showToast('Keine Leads zum Klassifizieren', 'warning');
      return;
    }

    setClassifying(true);
    setProgress(0);
    onClassificationStart?.();

    try {
      const aiConfig = getAiConfig();

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 15, 90));
      }, 300);

      // Call classification endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/runs/${runId}/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aiProvider: aiConfig.provider,
          aiModel: aiConfig.model,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(`Klassifizierung fehlgeschlagen: ${response.statusText}`);
      }

      const data = await response.json();
      setProgress(100);
      setStats(data.stats || { keep: 0, reject: 0, unclear: 0 });

      showToast(
        `✓ Klassifizierung abgeschlossen: ${data.stats.keep} behalten, ${data.stats.reject} abgelehnt`,
        'success'
      );
      onClassificationComplete?.(data.results);

      // Reset progress after animation
      setTimeout(() => setProgress(0), 1000);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Klassifizierung fehlgeschlagen',
        'error'
      );
    } finally {
      setClassifying(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-panel-2 border border-line-soft rounded p-4">
        <h3 className="font-mono text-xs tracking-wider text-ink-faint mb-3 font-medium">
          AI-Klassifizierung
        </h3>

        <div className="space-y-3 mb-4">
          {/* Progress bar */}
          {progress > 0 && (
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-ink-dim">Fortschritt</span>
                <span className="font-mono text-gold">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-panel-3 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold to-gold-bright transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-panel-3 rounded p-2">
              <p className="text-good font-mono font-semibold">{stats.keep}</p>
              <p className="text-ink-faint text-xs mt-0.5">Behalten</p>
            </div>
            <div className="bg-panel-3 rounded p-2">
              <p className="text-bad font-mono font-semibold">{stats.reject}</p>
              <p className="text-ink-faint text-xs mt-0.5">Abgelehnt</p>
            </div>
            <div className="bg-panel-3 rounded p-2">
              <p className="text-warn font-mono font-semibold">{stats.unclear}</p>
              <p className="text-ink-faint text-xs mt-0.5">Unklar</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleStartClassification}
          disabled={classifying || leadsCount === 0}
          className="w-full h-8 bg-gradient-to-r from-gold to-gold-dim text-noir rounded hover:from-gold-bright hover:to-gold transition-colors text-xs font-medium font-semibold disabled:opacity-50"
        >
          {classifying ? (
            <>
              ⟳ Klassifizierung läuft ({progress}%)
            </>
          ) : (
            `▶ Klassifizierung starten (${leadsCount} Leads)`
          )}
        </button>
      </div>

      <div className="bg-panel-3 rounded p-3 text-xs text-ink-dim space-y-1">
        <p className="font-semibold text-ink">Klassifizierung mit:</p>
        <p className="font-mono">{getAiConfig().provider.toUpperCase()} · {getAiConfig().model}</p>
      </div>
    </div>
  );
}
