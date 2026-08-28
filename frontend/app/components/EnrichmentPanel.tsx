'use client';

import { useState } from 'react';
import { getApiKey } from '@/lib/settings';
import { useToast } from './Toast';

interface EnrichmentPanelProps {
  runId: string;
  leadsCount: number;
  onEnrichmentStart?: () => void;
  onEnrichmentComplete?: () => void;
}

interface EnrichmentStatus {
  hunter_io: 'pending' | 'running' | 'completed' | 'failed';
  findymail: 'pending' | 'running' | 'completed' | 'failed';
  linkedin: 'pending' | 'running' | 'completed' | 'failed';
}

export function EnrichmentPanel({
  runId,
  leadsCount,
  onEnrichmentStart,
  onEnrichmentComplete,
}: EnrichmentPanelProps) {
  const { showToast } = useToast();
  const [enriching, setEnriching] = useState(false);
  const [status, setStatus] = useState<EnrichmentStatus>({
    hunter_io: 'pending',
    findymail: 'pending',
    linkedin: 'pending',
  });

  const handleStartEnrichment = async () => {
    const hunterKey = getApiKey('hunter_io');
    const findymailKey = getApiKey('findymail');

    if (!hunterKey && !findymailKey) {
      showToast('Keine Enrichment-APIs konfiguriert (Hunter.io oder FindyMail)', 'warning');
      return;
    }

    setEnriching(true);
    onEnrichmentStart?.();

    try {
      setStatus((prev) => ({
        ...prev,
        hunter_io: hunterKey ? 'running' : 'pending',
        findymail: findymailKey ? 'running' : 'pending',
      }));

      // Call enrichment backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runId,
          providers: {
            hunterIo: !!hunterKey,
            findymail: !!findymailKey,
          },
          hunterIoKey: hunterKey,
          findymailKey: findymailKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`Enrichment failed: ${response.statusText}`);
      }

      const data = await response.json();

      setStatus({
        hunter_io: data.hunterIo?.success ? 'completed' : 'failed',
        findymail: data.findymail?.success ? 'completed' : 'failed',
        linkedin: 'pending',
      });

      showToast(`Enrichment abgeschlossen: ${data.enrichedCount} Kontakte`, 'success');
      onEnrichmentComplete?.();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Enrichment fehlgeschlagen',
        'error'
      );
      setStatus({
        hunter_io: 'failed',
        findymail: 'failed',
        linkedin: 'pending',
      });
    } finally {
      setEnriching(false);
    }
  };

  const getStatusBadge = (stat: EnrichmentStatus[keyof EnrichmentStatus]) => {
    const badges = {
      pending: 'text-ink-faint',
      running: 'text-warn',
      completed: 'text-good',
      failed: 'text-bad',
    };
    const labels = {
      pending: '⋯',
      running: '⟳',
      completed: '✓',
      failed: '✕',
    };
    return { badge: badges[stat], label: labels[stat] };
  };

  return (
    <div className="space-y-4">
      <div className="bg-panel-2 border border-line-soft rounded p-4">
        <h3 className="font-mono text-xs tracking-wider text-ink-faint mb-4 font-medium">
          Enrichment
        </h3>

        <div className="space-y-3 mb-4">
          {[
            { id: 'hunter_io', name: 'Hunter.io', icon: '📧' },
            { id: 'findymail', name: 'FindyMail', icon: '💼' },
            { id: 'linkedin', name: 'LinkedIn', icon: '🔗' },
          ].map((provider) => {
            const stat = status[provider.id as keyof EnrichmentStatus];
            const { badge, label } = getStatusBadge(stat);
            return (
              <div key={provider.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{provider.icon}</span>
                  <span className="text-xs text-ink-dim">{provider.name}</span>
                </div>
                <span className={`font-mono text-xs ${badge}`}>{label}</span>
              </div>
            );
          })}
        </div>

        <div className="bg-panel-3 rounded p-3 mb-3 text-xs">
          <p className="text-ink-faint mb-1">Leads zum Enrichment:</p>
          <p className="font-mono text-gold font-semibold">{leadsCount} Einträge</p>
        </div>

        <button
          onClick={handleStartEnrichment}
          disabled={enriching || leadsCount === 0}
          className="w-full h-8 bg-gradient-to-r from-gold to-gold-dim text-noir rounded hover:from-gold-bright hover:to-gold transition-colors text-xs font-medium font-semibold disabled:opacity-50"
        >
          {enriching ? '⟳ Enrichment läuft...' : '▶ Enrichment starten'}
        </button>
      </div>

      <div className="bg-panel-3 rounded p-3 text-xs text-ink-dim space-y-1">
        <p className="font-semibold text-ink">Unterstützte Daten:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>E-Mail Verifikation</li>
          <li>Telefonnummern</li>
          <li>Unternehmensinformationen</li>
          <li>Social Media Profile</li>
          <li>Berufsbezeichnungen</li>
        </ul>
      </div>
    </div>
  );
}
