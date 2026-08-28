'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from './Toast';

const AI_PROVIDERS = [
  { id: 'gemini',    label: 'Gemini',  models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'anthropic', label: 'Claude',  models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'] },
  { id: 'openai',    label: 'GPT',     models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
] as const;

interface Props {
  runId: string;
  leadsCount: number;
  initialProvider?: string;
  initialModel?: string;
  onClassificationComplete?: () => void;
}

export function ClassificationPanel({ runId, leadsCount, initialProvider = 'gemini', initialModel = 'gemini-2.0-flash', onClassificationComplete }: Props) {
  const { showToast } = useToast();
  const [classifying, setClassifying] = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [stats,       setStats]       = useState<{ keep: number; reject: number; unklar: number } | null>(null);
  const [provider,    setProvider]    = useState(initialProvider);
  const [model,       setModel]       = useState(initialModel);

  const currentProv = AI_PROVIDERS.find(p => p.id === provider) ?? AI_PROVIDERS[0];

  const start = async () => {
    if (leadsCount === 0) return showToast('Keine Leads vorhanden', 'warning');
    setClassifying(true);
    setProgress(10);

    const tick = setInterval(() => setProgress(p => Math.min(p + 6, 88)), 500);

    try {
      const data = await api.runs.classify(runId, provider, model);
      clearInterval(tick);
      setProgress(100);
      setStats(data.stats);
      showToast(`${data.stats.keep} behalten · ${data.stats.reject} abgelehnt`, 'success');
      onClassificationComplete?.();
      setTimeout(() => setProgress(0), 800);
    } catch (e) {
      clearInterval(tick);
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
      setProgress(0);
    } finally {
      setClassifying(false);
    }
  };

  const card: React.CSSProperties = {
    background: 'var(--th-panel)',
    border: '1px solid var(--th-line)',
    borderRadius: 10,
    padding: '16px 18px',
  };

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h5 style={{ marginBottom: 4, fontFamily: 'var(--ff-disp)', fontSize: 16, color: 'var(--th-ink)', fontWeight: 700 }}>KI-Klassifizierung</h5>
        <p style={{ fontFamily: "'Spline Sans', sans-serif", fontSize: 13, color: '#5f6e87' }}>
          Wähle Provider und Modell für diesen Run.
        </p>
      </div>

      {/* Provider */}
      <div>
        <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#5f6e87', marginBottom: 10 }}>Provider</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {AI_PROVIDERS.map(p => {
            const active = provider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { setProvider(p.id); setModel(p.models[0]); }}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  border: active ? '1px solid rgba(232,176,75,.4)' : '1px solid rgba(255,255,255,.07)',
                  background: active ? 'rgba(232,176,75,.07)' : 'rgba(255,255,255,.02)',
                  fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 600,
                  color: active ? '#f5cc77' : '#9aa7bd', cursor: 'pointer', transition: 'all .15s',
                }}
              >{p.label}</button>
            );
          })}
        </div>
      </div>

      {/* Model */}
      <div>
        <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#5f6e87', marginBottom: 10 }}>Modell</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {currentProv.models.map((m, mi) => {
            const active = model === m;
            return (
              <button
                key={m}
                onClick={() => setModel(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  borderRadius: 8, textAlign: 'left', cursor: 'pointer', transition: 'all .12s',
                  border: active ? '1px solid rgba(232,176,75,.3)' : '1px solid rgba(255,255,255,.05)',
                  background: active ? 'rgba(232,176,75,.05)' : 'transparent',
                }}
              >
                <div style={{ width: 9, height: 9, borderRadius: '50%', border: active ? '2px solid #e8b04b' : '2px solid rgba(95,110,135,.4)', background: active ? '#e8b04b' : 'transparent', flexShrink: 0 }} />
                <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: active ? '#f4efe4' : '#5f6e87', flex: 1 }}>{m}</span>
                {mi === 0 && <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 9, letterSpacing: '.1em', color: '#e8b04b', opacity: .65 }}>EMPFOHLEN</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      {progress > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, color: '#5f6e87', marginBottom: 6 }}>
            <span>Klassifiziert…</span>
            <span style={{ color: '#e8b04b' }}>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #e8b04b, #f5cc77)', borderRadius: 99, width: `${progress}%`, transition: 'width .3s ease' }} />
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Keep',   value: stats.keep,   color: '#4fd1c5' },
            { label: 'Reject', value: stats.reject, color: '#e8736b' },
            { label: 'Unklar', value: stats.unklar, color: '#e8b04b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 600, color, lineHeight: 1, marginBottom: 4 }}>{value}</p>
              <p style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: '.12em', color: '#5f6e87', textTransform: 'uppercase' }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={start}
        disabled={classifying || leadsCount === 0}
        style={{
          fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, fontWeight: 600,
          letterSpacing: '.06em', padding: '10px 0', borderRadius: 7, cursor: 'pointer',
          border: '1px solid rgba(232,176,75,.35)', background: 'rgba(232,176,75,.1)',
          color: '#e8b04b', width: '100%',
          opacity: classifying || leadsCount === 0 ? 0.4 : 1,
        }}
      >
        {classifying ? `Läuft… ${progress}%` : `▶ Klassifizierung starten (${leadsCount} Leads)`}
      </button>
    </div>
  );
}
