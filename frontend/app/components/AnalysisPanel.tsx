'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { loadSettings } from '@/lib/settings';
import { useToast } from './Toast';

const ALL_PROVIDERS = [
  { id: 'gemini',    label: 'Gemini', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'anthropic', label: 'Claude', models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'] },
  { id: 'openai',    label: 'GPT',    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
] as const;

export interface AnalysisConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  prompt: string;
}

interface Props {
  runId: string;
  resolveRunId?: () => Promise<string>;
  rowCount: number;
  onColumnResult: (name: string, values: string[]) => void;
  /** When provided, analysis runs directly via the Vercel route /api/ai/analyze
   *  (chunked) — no separate Python backend needed. */
  rows?: Record<string, string>[];
  /** In-table popover mode: auto-creates the first column, hides the list
   *  header, separates "Speichern" (column appears in table) from
   *  "Analysieren" (prompt runs on all rows). */
  slotMode?: boolean;
  /** Remove a previously emitted column (rename/delete in slotMode) */
  onColumnRemove?: (name: string) => void;
}

const mono: React.CSSProperties = { fontFamily: "'Spline Sans Mono', monospace" };

export function AnalysisPanel({ runId, resolveRunId, rowCount, onColumnResult, rows, slotMode, onColumnRemove }: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const storageKey = `analysis_configs_${runId}`;

  const [configs,   setConfigs]   = useState<AnalysisConfig[]>([]);
  const [running,   setRunning]   = useState<Record<string, boolean>>({});
  const [progress,  setProgress]  = useState<Record<string, number>>({});
  const [apiKeys,   setApiKeys]   = useState<Record<string, string>>({});
  const [keysReady, setKeysReady] = useState(false);

  const [backendKeys, setBackendKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const readKeys = () => setApiKeys(loadSettings().apiKeys as Record<string, string>);
    readKeys();
    // Re-read when server-side env keys were synced into localStorage
    window.addEventListener('keys-synced', readKeys);
    fetchKeyAvailability().then(merged => {
      setBackendKeys(merged);
      setKeysReady(true);
    });
    return () => window.removeEventListener('keys-synced', readKeys);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setConfigs(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  // Only show providers with a key: frontend (localStorage / NEXT_PUBLIC_*) or backend env var
  const PROVIDERS = (ALL_PROVIDERS as readonly { id: string; label: string; models: readonly string[] }[])
    .filter(p => !!apiKeys[p.id] || !!backendKeys[p.id]);
  const missingCount = ALL_PROVIDERS.length - PROVIDERS.length;

  const persist = (next: AnalysisConfig[]) => {
    setConfigs(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };

  const add = () => {
    const defaultProvider = PROVIDERS[0];
    if (!defaultProvider) return showToast('Kein API Key hinterlegt — bitte in Einstellungen eintragen', 'warning');
    const id = `cfg_${Date.now()}`;
    persist([...configs, {
      id, name: `Analyse ${configs.length + 1}`,
      provider: defaultProvider.id, model: defaultProvider.models[0], prompt: '',
    }]);
  };

  const update = (id: string, patch: Partial<AnalysisConfig>) =>
    persist(configs.map(c => c.id === id ? { ...c, ...patch } : c));

  // Which column name each config last emitted into the table
  const emittedRef = useRef<Record<string, string>>({});

  const remove = (id: string) => {
    const emitted = emittedRef.current[id];
    if (emitted && onColumnRemove) onColumnRemove(emitted);
    delete emittedRef.current[id];
    persist(configs.filter(c => c.id !== id));
  };

  /** "Speichern": the column appears in the table immediately (placeholder
   *  values) — running the prompt is a separate action. */
  const saveColumn = (cfg: AnalysisConfig) => {
    const name = cfg.name.trim();
    if (!name) return showToast('Spaltenname fehlt', 'warning');
    const prev = emittedRef.current[cfg.id];
    if (prev && prev !== name && onColumnRemove) onColumnRemove(prev);
    if (prev !== name) onColumnResult(name, Array(rowCount).fill('·'));
    emittedRef.current[cfg.id] = name;
    showToast(`Spalte «${name}» angelegt — jetzt Analysieren klicken`, 'success');
  };

  // slotMode: opening the popover creates the first column right away
  useEffect(() => {
    if (slotMode && keysReady && configs.length === 0 && PROVIDERS.length > 0) add();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotMode, keysReady]);

  // Same prompt format as the Python backend (main.py analyze_run)
  const buildPrompt = (row: Record<string, string>, userPrompt: string) => {
    const rowText = Object.entries(row)
      .filter(([k, v]) => k !== '_idx' && v && String(v).trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    return `${userPrompt}\n\nDaten:\n${rowText}\n\nAntworte nur kurz und direkt.`;
  };

  const runAnalysis = async (cfg: AnalysisConfig) => {
    if (!cfg.prompt.trim()) return showToast('Kein Prompt angegeben', 'warning');
    if (rowCount === 0)      return showToast('Keine Daten vorhanden', 'warning');
    setRunning(p => ({ ...p, [cfg.id]: true }));
    try {
      const apiKey = apiKeys[cfg.provider] || undefined;

      if (rows?.length) {
        // Direct mode: analyze via the Vercel route, chunked (no Python backend)
        const CHUNK = 20;
        const values: string[] = [];
        for (let i = 0; i < rows.length; i += CHUNK) {
          const prompts = rows.slice(i, i + CHUNK).map(r => buildPrompt(r, cfg.prompt));
          const res = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: cfg.provider, model: cfg.model, prompts, ...(apiKey && { apiKey }) }),
          });
          if (!res.ok) {
            let msg = `Analyse fehlgeschlagen (HTTP ${res.status})`;
            try { msg = (await res.json()).detail ?? msg; } catch {}
            throw new Error(msg);
          }
          const data = await res.json();
          values.push(...(data.values ?? []));
          setProgress(p => ({ ...p, [cfg.id]: Math.min(values.length, rows.length) }));
        }
        onColumnResult(cfg.name, values);
        emittedRef.current[cfg.id] = cfg.name;
      } else {
        // Backend mode: existing scrape runs stored on the Python backend
        const rid = runId || (resolveRunId ? await resolveRunId() : '');
        if (!rid) throw new Error('Kein Backend verbunden — URL in den Einstellungen konfigurieren.');
        const res = await api.runs.analyze(rid, cfg.provider, cfg.model, cfg.prompt, cfg.name, apiKey);
        onColumnResult(res.column_name, res.values);
        emittedRef.current[cfg.id] = res.column_name;
      }

      showToast(`Spalte "${cfg.name}" fertig`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    } finally {
      setRunning(p => ({ ...p, [cfg.id]: false }));
      setProgress(p => ({ ...p, [cfg.id]: 0 }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* List header — hidden in slotMode (the popover already has a title) */}
      {!slotMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...mono, fontSize: 11, color: '#9aa7bd', letterSpacing: '.08em' }}>KI-Analyse Spalten</span>
          <button
            onClick={add}
            style={{ ...mono, fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(232,176,75,.3)', background: 'rgba(232,176,75,.06)', color: '#e8b04b', cursor: 'pointer' }}
          >+ Spalte</button>
        </div>
      )}

      {/* No API keys at all — only show after settings have loaded */}
      {keysReady && PROVIDERS.length === 0 && (
        <div style={{ padding: '14px 16px', border: '1px dashed rgba(255,255,255,.09)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ ...mono, fontSize: 11, color: '#5f6e87' }}>Kein KI-API Key hinterlegt. Bitte Gemini, Claude oder OpenAI Key in den Einstellungen eintragen.</p>
          <button
            onClick={() => router.push('/settings')}
            style={{ ...mono, fontSize: 10, alignSelf: 'flex-start', padding: '3px 10px', borderRadius: 4, border: '1px solid rgba(99,129,255,.3)', background: 'rgba(99,129,255,.08)', color: '#6381ff', cursor: 'pointer' }}
          >→ Einstellungen</button>
        </div>
      )}

      {/* Partial keys — show note */}
      {PROVIDERS.length > 0 && missingCount > 0 && (
        <button
          onClick={() => router.push('/settings')}
          style={{ ...mono, fontSize: 10, textAlign: 'left', padding: '5px 10px', borderRadius: 5, border: '1px solid rgba(99,129,255,.2)', background: 'rgba(99,129,255,.05)', color: '#6381ff', cursor: 'pointer' }}
        >
          + {missingCount} weitere KI-Modelle — API Key in Einstellungen hinzufügen
        </button>
      )}

      {!slotMode && configs.length === 0 && PROVIDERS.length > 0 && (
        <div style={{ padding: '18px 16px', textAlign: 'center', border: '1px dashed rgba(255,255,255,.09)', borderRadius: 8 }}>
          <p style={{ ...mono, fontSize: 11, color: '#5f6e87' }}>Noch keine KI-Analyse. Klicke «+ Spalte» um eine hinzuzufügen.</p>
        </div>
      )}

      {configs.map(cfg => {
        const prov = PROVIDERS.find(p => p.id === cfg.provider) ?? PROVIDERS[0];
        if (!prov) return null;
        const isRunning = running[cfg.id];
        return (
          <div key={cfg.id} style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '12px 14px', background: 'rgba(255,255,255,.02)', display: 'flex', flexDirection: 'column', gap: 9 }}>

            {/* Name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={cfg.name}
                onChange={e => update(cfg.id, { name: e.target.value })}
                placeholder="Spaltenname"
                style={{ ...mono, flex: 1, fontSize: 12, color: '#f5cc77', background: 'transparent', border: 'none', outline: 'none', borderBottom: '1px solid rgba(232,176,75,.2)', paddingBottom: 2 }}
              />
              <button onClick={() => remove(cfg.id)} style={{ ...mono, fontSize: 16, color: '#5f6e87', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* Provider + model row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => update(cfg.id, { provider: p.id, model: p.models[0] })}
                  style={{
                    ...mono, fontSize: 10, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                    border: cfg.provider === p.id ? '1px solid rgba(232,176,75,.4)' : '1px solid rgba(255,255,255,.07)',
                    background: cfg.provider === p.id ? 'rgba(232,176,75,.08)' : 'transparent',
                    color: cfg.provider === p.id ? '#f5cc77' : '#5f6e87',
                  }}
                >{p.label}</button>
              ))}
              <select
                value={cfg.model}
                onChange={e => update(cfg.id, { model: e.target.value })}
                style={{ ...mono, marginLeft: 'auto', fontSize: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 5, color: '#9aa7bd', padding: '3px 6px', outline: 'none' }}
              >
                {prov.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Prompt */}
            <textarea
              value={cfg.prompt}
              onChange={e => update(cfg.id, { prompt: e.target.value })}
              placeholder="Prompt… z.B. «Welche Nische hat dieser Coach? Antworte mit einem Wort.»"
              rows={3}
              style={{ ...mono, fontSize: 11, color: '#9aa7bd', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 6, padding: '6px 8px', width: '100%', outline: 'none', resize: 'vertical', lineHeight: 1.55 }}
            />

            {/* Actions: save column (appears in table) vs run analysis */}
            <div style={{ display: 'flex', gap: 8 }}>
              {slotMode && (
                <button
                  onClick={() => saveColumn(cfg)}
                  disabled={isRunning || !cfg.name.trim()}
                  style={{
                    ...mono, fontSize: 11, padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid rgba(79,209,197,.35)', background: 'rgba(79,209,197,.07)', color: '#4fd1c5',
                    opacity: isRunning || !cfg.name.trim() ? 0.4 : 1,
                  }}
                >💾 Spalte speichern</button>
              )}
              <button
                onClick={() => runAnalysis(cfg)}
                disabled={isRunning || rowCount === 0 || !cfg.prompt.trim()}
                style={{
                  ...mono, fontSize: 11, padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
                  border: '1px solid rgba(232,176,75,.35)', background: 'rgba(232,176,75,.08)', color: '#e8b04b',
                  opacity: isRunning || rowCount === 0 || !cfg.prompt.trim() ? 0.4 : 1,
                }}
              >
                {isRunning
                  ? (progress[cfg.id] ? `Läuft… ${progress[cfg.id]}/${rowCount}` : 'Läuft…')
                  : `▶ Analysieren (${rowCount} Zeilen)`}
              </button>
            </div>

          </div>
        );
      })}

      {/* slotMode: next column only after the current one is complete */}
      {slotMode && configs.length > 0 && PROVIDERS.length > 0 && (() => {
        const last = configs[configs.length - 1];
        const lastComplete = !!last.name.trim() && !!last.prompt.trim();
        return (
          <button
            onClick={add}
            disabled={!lastComplete}
            title={lastComplete ? undefined : 'Erst die aktuelle Spalte fertig konfigurieren'}
            style={{
              ...mono, fontSize: 10, alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 5,
              border: '1px dashed rgba(232,176,75,.3)', background: 'transparent', color: '#e8b04b',
              cursor: lastComplete ? 'pointer' : 'default', opacity: lastComplete ? 1 : 0.35,
            }}
          >+ weitere KI-Spalte</button>
        );
      })()}
    </div>
  );
}
