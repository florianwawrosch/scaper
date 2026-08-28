'use client';

import { useEffect, useState } from 'react';
import { getApiKey, getAiConfig } from '@/lib/settings';

interface SystemStatus {
  backend: 'online' | 'offline' | 'checking';
  providers: {
    gemini: boolean;
    anthropic: boolean;
    openai: boolean;
  };
  enrichment: {
    hunterIo: boolean;
    findymail: boolean;
  };
}

export function StatusDashboard() {
  const [status, setStatus] = useState<SystemStatus>({
    backend: 'checking',
    providers: {
      gemini: false,
      anthropic: false,
      openai: false,
    },
    enrichment: {
      hunterIo: false,
      findymail: false,
    },
  });

  useEffect(() => {
    const checkStatus = async () => {
      const aiConfig = getAiConfig();
      const newStatus: SystemStatus = {
        backend: 'offline',
        providers: {
          gemini: !!getApiKey('gemini'),
          anthropic: !!getApiKey('anthropic'),
          openai: !!getApiKey('openai'),
        },
        enrichment: {
          hunterIo: !!getApiKey('hunter_io'),
          findymail: !!getApiKey('findymail'),
        },
      };

      // Check backend health
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          newStatus.backend = 'online';
        }
      } catch {
        newStatus.backend = 'offline';
      }

      setStatus(newStatus);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (active: boolean) => {
    return active ? '✓' : '○';
  };

  const getBackendBadge = (stat: SystemStatus['backend']) => {
    const badges = {
      online: 'bg-good/10 border-good/35 text-good',
      offline: 'bg-bad/10 border-bad/35 text-bad',
      checking: 'bg-warn/10 border-warn/35 text-warn',
    };
    const labels = {
      online: 'Online',
      offline: 'Offline',
      checking: 'Checking...',
    };
    return { badge: badges[stat], label: labels[stat] };
  };

  const backendStatus = getBackendBadge(status.backend);
  const aiConfig = getAiConfig();

  return (
    <div className="fixed bottom-4 left-4 bg-panel border border-line-soft rounded p-3 text-xs space-y-2 max-w-xs z-40">
      <div className="flex items-center justify-between">
        <span className="text-ink-faint font-mono">System Status</span>
        <span className={`px-1.5 py-0.5 rounded border text-xs font-mono ${backendStatus.badge}`}>
          {backendStatus.label}
        </span>
      </div>

      <div className="space-y-1 text-ink-dim text-xs">
        <div className="flex justify-between">
          <span>AI Config:</span>
          <span className="font-mono text-gold">
            {aiConfig.provider.toUpperCase()} · {aiConfig.model.split('-')[0]}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Providers:</span>
          <span className="font-mono space-x-1">
            <span className={status.providers.gemini ? 'text-good' : 'text-ink-faint'}>
              G {getStatusIcon(status.providers.gemini)}
            </span>
            <span className={status.providers.anthropic ? 'text-good' : 'text-ink-faint'}>
              A {getStatusIcon(status.providers.anthropic)}
            </span>
            <span className={status.providers.openai ? 'text-good' : 'text-ink-faint'}>
              O {getStatusIcon(status.providers.openai)}
            </span>
          </span>
        </div>

        <div className="flex justify-between">
          <span>Enrichment:</span>
          <span className="font-mono space-x-1">
            <span className={status.enrichment.hunterIo ? 'text-good' : 'text-ink-faint'}>
              H {getStatusIcon(status.enrichment.hunterIo)}
            </span>
            <span className={status.enrichment.findymail ? 'text-good' : 'text-ink-faint'}>
              F {getStatusIcon(status.enrichment.findymail)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
