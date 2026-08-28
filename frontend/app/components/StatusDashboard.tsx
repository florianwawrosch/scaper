'use client';

import { useEffect, useState } from 'react';
import { getApiKey, getAiConfig } from '@/lib/settings';

export function StatusDashboard() {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health`, {
          signal: AbortSignal.timeout(3000),
        });
        setBackendOnline(res.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  const dot = backendOnline === null
    ? 'bg-warn animate-pulse'
    : backendOnline
    ? 'bg-good'
    : 'bg-bad';

  const label = backendOnline === null ? '…' : backendOnline ? 'Online' : 'Offline';

  const ai = getAiConfig();

  return (
    <div className="fixed bottom-4 left-4 z-40 bg-panel border border-line rounded-lg px-3 py-2 flex items-center gap-3 text-xs font-mono">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span className="text-ink-faint tracking-wider">{label}</span>
      </div>
      <span className="text-line">|</span>
      <span className="text-ink-faint tracking-wider">
        {ai.provider} <span className="text-gold">·</span> {ai.model.split('-').slice(0, 2).join('-')}
      </span>
    </div>
  );
}
