'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Papa from 'papaparse';
import { saveCsvText } from '@/lib/csvStorage';
import { loadCsvRun } from '@/lib/csvRuns';
import { addToBlocklist, removeFromBlocklist } from '@/lib/blocklist';
import { loadSettings } from '@/lib/settings';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { useToast } from '@/app/components/Toast';
import { DataTable } from '@/app/components/DataTable';
import { AiColumnEditor } from '@/app/components/AiColumnEditor';
import type { AnalysisConfig } from '@/app/components/AnalysisPanel';

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.0-flash', anthropic: 'claude-sonnet-5', openai: 'gpt-4o',
};

interface CsvRun {
  data: Record<string, string>[];
  fields: string[];
  filename: string;
  createdAt: string;
  backendRunId?: string;
  scrapeConfig?: Record<string, unknown>;
}

const T = {
  bg:     'var(--th-bg)',
  panel:  'var(--th-panel)',
  panel2: 'var(--th-panel2)',
  line:   'var(--th-line)',
  lineS:  'var(--th-line-soft)',
  gold:   'var(--th-gold)',
  goldD:  'var(--th-gold-d)',
  ink:    'var(--th-ink)',
  inkD:   'var(--th-ink-d)',
  inkF:   'var(--th-ink-f)',
  teal:   'var(--th-teal)',
  ffMono: 'var(--ff-mono)',
  ffBody: 'var(--ff-body)',
  ffDisp: 'var(--ff-disp)',
};

export default function CsvViewer() {
  const router = useRouter();
  const { showToast } = useToast();
  const { id } = useParams<{ id: string }>();

  const [run,        setRun]        = useState<CsvRun | null>(null);
  const [error,      setError]      = useState('');
  const [aiColumns,  setAiColumns]  = useState<{ name: string; values: string[] }[]>([]);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());

  // AI column configs (owned here; edited via the ⚙ side panel)
  const configsKey = `analysis_configs_${id}`;
  const [aiConfigs,   setAiConfigs]   = useState<AnalysisConfig[]>([]);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [colRunning,  setColRunning]  = useState<Record<string, boolean>>({});
  const [colProgress, setColProgress] = useState<Record<string, number>>({});
  const [providers,   setProviders]   = useState<string[]>([]);
  const [blockedIdx,  setBlockedIdx]  = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(configsKey);
      if (saved) setAiConfigs(JSON.parse(saved));
    } catch {}
    fetchKeyAvailability().then(server => {
      const local = loadSettings().apiKeys as Record<string, string>;
      setProviders(['gemini', 'anthropic', 'openai'].filter(p => local[p] || server[p]));
    });
  }, [configsKey]);

  const persistConfigs = (next: AnalysisConfig[]) => {
    setAiConfigs(next);
    try { localStorage.setItem(configsKey, JSON.stringify(next)); } catch {}
  };

  const upsertAiColumn = (name: string, values: string[]) =>
    setAiColumns(prev => {
      const idx = prev.findIndex(c => c.name === name);
      if (idx >= 0) { const next = [...prev]; next[idx] = { name, values }; return next; }
      return [...prev, { name, values }];
    });

  const renameAiColumn = (oldName: string, newName: string) =>
    setAiColumns(prev => prev.map(c => c.name === oldName ? { ...c, name: newName } : c));

  /** Merge finished values into the stored CSV so the column survives reloads */
  const persistColumnToCsv = async (name: string, values: string[]) => {
    if (!run) return;
    try {
      const merged = run.data.map((r, i) => ({ ...r, [name]: values[i] ?? '' }));
      const fields = run.fields.includes(name) ? run.fields : [...run.fields, name];
      await saveCsvText(id, Papa.unparse(merged));
      const raw = localStorage.getItem(`csv_run_${id}`);
      if (raw) {
        const m = JSON.parse(raw);
        localStorage.setItem(`csv_run_${id}`, JSON.stringify({ ...m, fields }));
      }
    } catch {}
  };

  /** "+ KI-Spalte": column appears in the table immediately, no popup */
  const addAiColumn = () => {
    if (!run) return;
    if (providers.length === 0) return showToast('Kein KI-API Key konfiguriert — Einstellungen prüfen', 'warning');
    let n = aiConfigs.length + 1;
    let name = `Analyse ${n}`;
    while (aiColumns.some(c => c.name === name) || aiConfigs.some(c => c.name === name)) name = `Analyse ${++n}`;
    const provider = providers[0];
    const cfg: AnalysisConfig = {
      id: `cfg_${Date.now()}`, name, provider,
      model: DEFAULT_MODELS[provider] ?? '', prompt: '',
    };
    persistConfigs([...aiConfigs, cfg]);
    upsertAiColumn(name, Array(run.data.length).fill('·'));
    showToast(`Spalte «${name}» angelegt — über ⚙ konfigurieren`, 'info');
  };

  const runColumn = async (cfg: AnalysisConfig) => {
    if (!run || colRunning[cfg.id]) return;
    if (!cfg.prompt.trim()) { setEditingId(cfg.id); return showToast('Erst einen Prompt eingeben (⚙)', 'warning'); }
    setColRunning(p => ({ ...p, [cfg.id]: true }));
    try {
      const apiKey = (loadSettings().apiKeys as Record<string, string>)[cfg.provider] || undefined;
      const buildPrompt = (row: Record<string, string>) => {
        const rowText = Object.entries(row)
          .filter(([k, v]) => k !== '_idx' && v && String(v).trim())
          .map(([k, v]) => `${k}: ${v}`).join('\n');
        return `${cfg.prompt}\n\nDaten:\n${rowText}\n\nAntworte nur kurz und direkt.`;
      };
      const CHUNK = 20;
      const values: string[] = [];
      for (let i = 0; i < run.data.length; i += CHUNK) {
        const prompts = run.data.slice(i, i + CHUNK).map(buildPrompt);
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
        setColProgress(p => ({ ...p, [cfg.id]: Math.min(values.length, run.data.length) }));
        upsertAiColumn(cfg.name, [...values, ...Array(run.data.length - values.length).fill('·')]);
      }
      upsertAiColumn(cfg.name, values);
      await persistColumnToCsv(cfg.name, values);
      showToast(`Spalte «${cfg.name}» fertig`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error', 8000);
    } finally {
      setColRunning(p => ({ ...p, [cfg.id]: false }));
      setColProgress(p => ({ ...p, [cfg.id]: 0 }));
    }
  };

  const editingCfg = aiConfigs.find(c => c.id === editingId) ?? null;

  useEffect(() => {
    loadCsvRun(id)
      .then(({ meta, rows }) => setRun({
        data: rows,
        fields: meta.fields,
        filename: meta.filename,
        createdAt: meta.createdAt,
        backendRunId: meta.backendRunId,
        scrapeConfig: meta.scrapeConfig,
      }))
      .catch(e => setError(e instanceof Error ? e.message : 'Fehler beim Laden der Datei.'));
  }, [id]);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontFamily: T.ffMono, fontSize: 13, color: '#e8736b' }}>⚠ {error}</p>
      <button onClick={() => router.push('/')} style={{ fontFamily: T.ffMono, fontSize: 12, padding: '6px 16px', borderRadius: 6, background: T.panel, border: `1px solid ${T.line}`, color: T.inkD, cursor: 'pointer' }}>← Zurück</button>
    </div>
  );

  if (!run) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: T.ffMono, fontSize: 12, color: T.inkF }}>Lädt…</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px 64px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => router.push('/')}
            style={{ fontFamily: T.ffMono, fontSize: 11, padding: '5px 11px', borderRadius: 5, background: 'transparent', border: `1px solid ${T.lineS}`, color: T.inkD, cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
          >← Import</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: T.ffDisp, fontSize: 20, fontWeight: 700, color: T.ink, marginBottom: 3 }}>
              {run.filename}
            </h1>
            <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF, letterSpacing: '.04em' }}>
              importiert {fmt(run.createdAt)}
            </p>
          </div>
          {run.scrapeConfig && (
            <button
              onClick={() => {
                try { localStorage.setItem('rescrape_config', JSON.stringify(run.scrapeConfig)); } catch {}
                router.push('/');
              }}
              title="Suchmaske mit diesen Einstellungen vorbefüllen"
              style={{
                fontFamily: T.ffMono, fontSize: 11, padding: '7px 14px', borderRadius: 6,
                border: `1px solid ${T.lineS}`, background: 'transparent',
                color: T.inkD, cursor: 'pointer', flexShrink: 0, marginTop: 2, letterSpacing: '.04em',
              }}
            >↻ Erneut scrapen</button>
          )}
          <button
            onClick={() => router.push(`/csv/${id}/enrich`)}
            style={{
              fontFamily: T.ffMono, fontSize: 11, padding: '7px 16px', borderRadius: 6,
              border: '1px solid rgba(79,209,197,.35)', background: 'rgba(79,209,197,.07)',
              color: '#4fd1c5', cursor: 'pointer', flexShrink: 0, marginTop: 2, letterSpacing: '.04em',
            }}
          >Enrichment starten →</button>
        </div>

        {/* Full-width table; AI columns are created in place, ⚙ opens the editor */}
        <DataTable
          data={run.data}
          rawColumns={run.fields}
          aiColumns={aiColumns}
          excludedRows={excludedRows}
          onExcludeChange={setExcludedRows}
          blockedRows={blockedIdx}
          onBlockRow={run.fields.includes('page_name') ? (row) => {
            const name = String(row.page_name ?? '').trim();
            if (!name) return;
            const idx = Number(row._idx);
            const next = new Set(blockedIdx);
            if (next.has(idx)) {
              removeFromBlocklist(name);
              next.delete(idx);
              showToast(`«${name}» von der Blockliste entfernt`, 'info');
            } else {
              addToBlocklist(name, String(row.page_id ?? '') || undefined);
              next.add(idx);
              showToast(`«${name}» geblockt — wird bei künftigen Scrapes ausgeschlossen`, 'success');
            }
            setBlockedIdx(next);
          } : undefined}
          onAddAiColumn={addAiColumn}
          onConfigureAiColumn={(name) => {
            const cfg = aiConfigs.find(c => c.name === name);
            if (cfg) setEditingId(cfg.id);
            else showToast('Für diese Spalte gibt es keine Konfiguration', 'warning');
          }}
          onRunAiColumn={(name) => {
            const cfg = aiConfigs.find(c => c.name === name);
            if (cfg) runColumn(cfg);
            else showToast('Für diese Spalte gibt es keine Konfiguration', 'warning');
          }}
        />

        {/* ⚙ side panel for the selected AI column */}
        {editingCfg && (
          <AiColumnEditor
            config={editingCfg}
            rowCount={run.data.length}
            providers={providers}
            running={!!colRunning[editingCfg.id]}
            progress={colProgress[editingCfg.id] ?? 0}
            onChange={(patch) => {
              if (patch.name && patch.name !== editingCfg.name) {
                renameAiColumn(editingCfg.name, patch.name);
              }
              persistConfigs(aiConfigs.map(c => c.id === editingCfg.id ? { ...c, ...patch } : c));
            }}
            onSave={() => {
              setEditingId(null);
              showToast(`Spalte «${editingCfg.name}» gespeichert`, 'success');
            }}
            onRun={() => runColumn(aiConfigs.find(c => c.id === editingCfg.id) ?? editingCfg)}
            onDelete={() => {
              setAiColumns(prev => prev.filter(c => c.name !== editingCfg.name));
              persistConfigs(aiConfigs.filter(c => c.id !== editingCfg.id));
              setEditingId(null);
            }}
            onClose={() => setEditingId(null)}
          />
        )}

      </div>
    </div>
  );
}
