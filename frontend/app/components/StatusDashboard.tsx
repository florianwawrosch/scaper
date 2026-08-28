'use client';

import { useEffect, useState } from 'react';
import { getApiKey, getAiConfig } from '@/lib/settings';
import { getApiBase } from '@/lib/api';

export function StatusDashboard() {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/health`, {
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

  const dotColor = backendOnline === null ? '#e8b04b' : backendOnline ? '#4fd1c5' : '#e8736b';
  const label    = backendOnline === null ? '…' : backendOnline ? 'Online' : 'Offline';
  const ai = getAiConfig();

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, zIndex: 40,
      background: 'var(--th-panel)', border: '1px solid var(--th-line)',
      borderRadius: 8, padding: '6px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: "'Spline Sans Mono', monospace", fontSize: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
        <span style={{ color: 'var(--th-ink-f)', letterSpacing: '.06em' }}>{label}</span>
      </div>
      <span style={{ color: 'var(--th-line)' }}>|</span>
      <span style={{ color: 'var(--th-ink-f)', letterSpacing: '.06em' }}>
        {ai.provider} <span style={{ color: 'var(--th-gold)' }}>·</span> {ai.model.split('-').slice(0, 2).join('-')}
      </span>
    </div>
  );
}
