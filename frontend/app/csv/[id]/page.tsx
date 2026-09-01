'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Papa from 'papaparse';
import { saveCsvText } from '@/lib/csvStorage';
import { loadCsvRun } from '@/lib/csvRuns';
import { addToBlocklist } from '@/lib/blocklist';
import { loadSettings } from '@/lib/settings';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { runAiColumn, defaultModel, providerLabel, splitMultiOutput, applyDerivedRules, shortHash, rowFingerprint, isUsableAiValue, normalizeMultiOutput } from '@/lib/ai';
import { useToast } from '@/app/components/Toast';
import { DataTable, type StatChip } from '@/app/components/DataTable';
import { AiColumnEditor } from '@/app/components/AiColumnEditor';
import type { AnalysisConfig } from '@/app/components/AnalysisPanel';

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

  /** Merge finished values into the stored CSV so the columns survive reloads */
  const persistColumnsToCsv = async (cols: Record<string, string[]>) => {
    if (!run) return;
    try {
      const merged = run.data.map((r, i) => {
        const extra: Record<string, string> = {};
        for (const [n, v] of Object.entries(cols)) extra[n] = v[i] ?? '';
        return { ...r, ...extra };
      });
      const fields = [...run.fields];
      for (const n of Object.keys(cols)) if (!fields.includes(n)) fields.push(n);
      await saveCsvText(id, Papa.unparse(merged));
      const raw = localStorage.getItem(`csv_run_${id}`);
      if (raw) {
        const m = JSON.parse(raw);
        // Drop legacy inline rows so the freshly written IndexedDB CSV wins on reload
        delete m.data; delete m.csv;
        localStorage.setItem(`csv_run_${id}`, JSON.stringify({ ...m, fields, rowCount: merged.length }));
      }
    } catch {}
  };
  const persistColumnToCsv = (name: string, values: string[]) => persistColumnsToCsv({ [name]: values });

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
      model: defaultModel(provider), prompt: '',
    };
    persistConfigs([...aiConfigs, cfg]);
    upsertAiColumn(name, Array(run.data.length).fill('·'));
    // Open the editor right away so it's obvious the column was created
    setEditingId(cfg.id);
    showToast(`Spalte «${name}» angelegt — Prompt eingeben und Analysieren`, 'info');
  };

  const runColumn = async (cfg: AnalysisConfig) => {
    if (!run || colRunning[cfg.id]) return;
    if (!cfg.prompt.trim()) { setEditingId(cfg.id); return showToast('Erst einen Prompt eingeben (⚙)', 'warning'); }
    setColRunning(p => ({ ...p, [cfg.id]: true }));
    try {
      const apiKey = (loadSettings().apiKeys as Record<string, string>)[cfg.provider] || undefined;
      const multi = !!cfg.outputFields?.length;

      // feld_hash-Caching (wie im Sheet): Zeilen mit unverändertem Prompt und
      // unveränderten Eingabewerten, die schon ein brauchbares Ergebnis haben,
      // werden nicht erneut klassifiziert. Fehler-Zeilen laufen automatisch neu.
      const promptHash = shortHash([cfg.provider, cfg.model, cfg.prompt, ...(cfg.inputColumns ?? [])].join('\x1f'));
      const rowHashes = run.data.map(r => rowFingerprint(r, cfg.inputColumns));
      const hashKey = `analysis_hashes_${id}`;
      let allHashes: Record<string, { promptHash: string; rowHashes: string[] }> = {};
      try { allHashes = JSON.parse(localStorage.getItem(hashKey) ?? '{}'); } catch {}
      const prev = allHashes[cfg.id];
      const existing = aiColumns.find(c => c.name === cfg.name)?.values
        ?? run.data.map(r => r[cfg.name] ?? '');
      const todo: number[] = [];
      for (let i = 0; i < run.data.length; i++) {
        const cached = prev?.promptHash === promptHash
          && prev.rowHashes[i] === rowHashes[i]
          && isUsableAiValue(existing[i]);
        if (!cached) todo.push(i);
      }
      if (todo.length === 0) {
        showToast('Alle Zeilen bereits klassifiziert — nichts zu tun', 'info');
        return;
      }
      const skipped = run.data.length - todo.length;
      const todoSet = new Set(todo);
      const merged = run.data.map((_, i) => (todoSet.has(i) ? '·' : existing[i]));

      // Multi-Output: Antworten gegen die erlaubten Werte validieren/normalisieren;
      // ungültige werden "Fehler: …" und laufen beim nächsten ▶ automatisch neu
      const sanitize = (vals: string[]) =>
        multi ? vals.map(v => normalizeMultiOutput(v, cfg.outputFields!, cfg.outputEnums)) : vals;

      const subValues = await runAiColumn({
        rows: todo.map(i => run.data[i]),
        provider: cfg.provider,
        model: cfg.model,
        prompt: cfg.prompt,
        apiKey,
        inputColumns: cfg.inputColumns,
        multiOutput: multi,
        onProgress: (partial) => {
          const full = [...merged];
          sanitize(partial).forEach((v, j) => { full[todo[j]] = v; });
          setColProgress(p => ({ ...p, [cfg.id]: full.filter(v => v !== '·').length }));
          upsertAiColumn(cfg.name, full);
          // Multi-Output: Antwort live in die Einzelspalten splitten
          if (multi) {
            const split = splitMultiOutput(full, cfg.outputFields!);
            for (const [n, v] of Object.entries(split)) upsertAiColumn(n, v);
          }
        },
      });
      sanitize(subValues).forEach((v, j) => { merged[todo[j]] = v; });
      const failed = todo.filter(i => merged[i].startsWith('Fehler:')).length;

      upsertAiColumn(cfg.name, merged);
      if (multi) {
        const split = splitMultiOutput(merged, cfg.outputFields!);
        const derived = cfg.derived?.length ? applyDerivedRules(cfg.derived, split, run.data.length) : {};
        const all = { [cfg.name]: merged, ...split, ...derived };
        for (const [n, v] of Object.entries(all)) upsertAiColumn(n, v);
        await persistColumnsToCsv(all);
      } else {
        await persistColumnToCsv(cfg.name, merged);
      }
      allHashes[cfg.id] = { promptHash, rowHashes };
      try { localStorage.setItem(hashKey, JSON.stringify(allHashes)); } catch {}
      const parts: string[] = [`${todo.length - failed} klassifiziert`];
      if (skipped > 0) parts.push(`${skipped} übersprungen (unverändert)`);
      if (failed > 0) parts.push(`${failed} ungültig — erneut ▶ drücken`);
      showToast(`«${cfg.name}»: ${parts.join(', ')}`, failed > 0 ? 'warning' : 'success', failed > 0 ? 7000 : undefined);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error', 8000);
    } finally {
      setColRunning(p => ({ ...p, [cfg.id]: false }));
      setColProgress(p => ({ ...p, [cfg.id]: 0 }));
    }
  };

  const editingCfg = aiConfigs.find(c => c.id === editingId) ?? null;

  /** Config zu einer Spalte finden — auch für gesplittete Output-/Regel-Spalten */
  const findCfgForColumn = (name: string) =>
    aiConfigs.find(c => c.name === name)
    ?? aiConfigs.find(c => c.outputFields?.includes(name) || c.derived?.some(d => d.name === name));

  // Alle Spalten, die zu einer KI-Config gehören (Roh-Antwort, Splits, Regeln)
  const aiOwnedNames = useMemo(() => {
    const s = new Set<string>();
    for (const cfg of aiConfigs) {
      s.add(cfg.name);
      cfg.outputFields?.forEach(f => s.add(f));
      cfg.derived?.forEach(d => s.add(d.name));
    }
    return s;
  }, [aiConfigs]);

  // Config-Spalten immer als KI-Spalten zeigen: noch nicht gelaufene als
  // '·'-Platzhalter, bereits persistierte (nach Reload) mit ihren CSV-Werten —
  // so behalten sie ⚙/▶ und können erneut laufen (Cache überspringt Unverändertes)
  useEffect(() => {
    if (!run) return;
    setAiColumns(prev => {
      const next = [...prev];
      for (const n of aiOwnedNames) {
        if (next.some(c => c.name === n)) continue;
        next.push({
          name: n,
          values: run.fields.includes(n)
            ? run.data.map(r => r[n] ?? '')
            : Array(run.data.length).fill('·'),
        });
      }
      return next.length === prev.length ? prev : next;
    });
  }, [run, aiOwnedNames]);

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
          rawColumns={run.fields.filter(f => !aiOwnedNames.has(f))}
          stats={(() => {
            // KI-Statistik wie im statistik-Blatt: Fortschritt + Regel-Verteilung,
            // Regel-Chips filtern die Tabelle per Klick
            const chips: StatChip[] = [];
            for (const cfg of aiConfigs) {
              const col = aiColumns.find(c => c.name === cfg.name);
              if (!col) continue;
              const done = col.values.filter(isUsableAiValue).length;
              if (done === 0) continue;
              chips.push({
                text: `${cfg.name}: ${done}/${run.data.length} klassifiziert`,
                tone: done === run.data.length ? 'teal' : 'gold',
              });
              for (const d of cfg.derived ?? []) {
                const dcol = aiColumns.find(c => c.name === d.name);
                if (!dcol) continue;
                const yes = dcol.values.filter(v => v === d.then).length;
                const no  = dcol.values.filter(v => v === d.else).length;
                if (yes + no === 0) continue;
                const pct = Math.round((yes / (yes + no)) * 100);
                chips.push({ text: `${d.name}: ${yes} ${d.then} (${pct}%)`, tone: 'gold', filter: { column: d.name, value: d.then } });
                chips.push({ text: `${no} ${d.else}`, tone: 'gold', filter: { column: d.name, value: d.else } });
              }
            }
            return chips;
          })()}
          aiColumns={aiColumns.map(c => {
            const own = aiConfigs.find(x => x.name === c.name);
            if (own) return { ...c, label: `${providerLabel(own.provider)} · ${own.model}${own.promptVersion ? ` · ${own.promptVersion}` : ''}` };
            const parent = findCfgForColumn(c.name);
            if (parent?.derived?.some(d => d.name === c.name)) return { ...c, label: `Regel aus «${parent.name}»` };
            if (parent) return { ...c, label: `aus «${parent.name}»` };
            return c;
          })}
          excludedRows={excludedRows}
          onExcludeChange={setExcludedRows}
          onBlockPages={run.fields.includes('page_name') ? (rows) => {
            const names = new Set<string>();
            for (const row of rows) {
              const name = String(row.page_name ?? '').trim();
              if (!name) continue;
              addToBlocklist(name, String(row.page_id ?? '') || undefined);
              names.add(name);
            }
            if (names.size > 0) {
              showToast(
                `${names.size} ${names.size === 1 ? 'Seite' : 'Seiten'} zur Blockliste hinzugefügt — verwalten unter Einstellungen → Blockliste`,
                'success', 5000,
              );
            }
          } : undefined}
          onAddAiColumn={addAiColumn}
          onConfigureAiColumn={(name) => {
            const cfg = findCfgForColumn(name);
            if (cfg) setEditingId(cfg.id);
            else showToast('Für diese Spalte gibt es keine Konfiguration', 'warning');
          }}
          onRunAiColumn={(name) => {
            const cfg = findCfgForColumn(name);
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
              persistConfigs(aiConfigs.map(c => {
                if (c.id !== editingCfg.id) return c;
                const next = { ...c, ...patch };
                // Vorlagen-Version als angepasst markieren, sobald der Prompt abweicht
                if (patch.prompt !== undefined && patch.prompt !== c.prompt && c.promptVersion && !c.promptVersion.endsWith('*')) {
                  next.promptVersion = `${c.promptVersion}*`;
                }
                return next;
              }));
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
