'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { loadCsvRun, saveCsvRunColumns } from '@/lib/csvRuns';
import { addToBlocklist } from '@/lib/blocklist';
import { loadSettings } from '@/lib/settings';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { loadAiConfigs, saveAiConfigs, findDerivedRule } from '@/lib/analysisConfigs';
import { buildOutreachExport } from '@/lib/outreachExport';
import { runAiColumn, defaultModel, providerLabel, splitMultiOutput, applyDerivedRules, shortHash, rowFingerprint, isUsableAiValue, isAiError, normalizeMultiOutput, PENDING } from '@/lib/ai';
import { useToast } from '@/app/components/Toast';
import { DataTable, type StatChip, type ExportPreset } from '@/app/components/DataTable';
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
  const [showSrcStats, setShowSrcStats] = useState(false);
  const [aiColumns,  setAiColumns]  = useState<{ name: string; values: string[] }[]>([]);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());

  // AI column configs (owned here; edited via the ⚙ side panel)
  const [aiConfigs,   setAiConfigs]   = useState<AnalysisConfig[]>([]);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [colRunning,  setColRunning]  = useState<Record<string, boolean>>({});
  const [colProgress, setColProgress] = useState<Record<string, number>>({});
  const [providers,   setProviders]   = useState<string[]>([]);
  const [scrollSignal, setScrollSignal] = useState(0);

  useEffect(() => {
    setAiConfigs(loadAiConfigs(id));
    fetchKeyAvailability().then(server => {
      const local = loadSettings().apiKeys as Record<string, string>;
      setProviders(['gemini', 'anthropic', 'openai'].filter(p => local[p] || server[p]));
    });
  }, [id]);

  const persistConfigs = (next: AnalysisConfig[]) => {
    setAiConfigs(next);
    saveAiConfigs(id, next);
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
    try { await saveCsvRunColumns(id, run.data, cols); }
    catch { showToast('Ergebnisse konnten nicht gespeichert werden — Browser-Speicher voll? Bitte Seite nicht neu laden.', 'error', 10000); }
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
      model: defaultModel(provider), prompt: '',
    };
    persistConfigs([...aiConfigs, cfg]);
    upsertAiColumn(name, Array(run.data.length).fill(PENDING));
    setScrollSignal(s => s + 1); // Tabelle scrollt zur neuen Spalte am rechten Ende
    // Open the editor right away so it's obvious the column was created
    setEditingId(cfg.id);
    showToast(`Spalte «${name}» angelegt — Prompt eingeben und Analysieren`, 'info');
  };

  const runColumn = async (cfg: AnalysisConfig) => {
    if (!run || colRunning[cfg.id]) return;
    if (!cfg.prompt.trim()) { setEditingId(cfg.id); return showToast('Erst einen Prompt eingeben (⚙)', 'warning'); }
    setColRunning(p => ({ ...p, [cfg.id]: true }));

    // Declared outside the try so a mid-run failure (e.g. chunk 3 of 5 hits a
    // network error) can still persist whatever chunks already completed —
    // otherwise already-paid-for API results only ever lived in React state
    // and a reload (or even a bare retry, since the cache hash never saved)
    // would silently discard and re-bill them.
    let merged: string[] | null = null;
    let lastSplit: Record<string, string[]> | null = null;
    const promptHash = shortHash([cfg.provider, cfg.model, cfg.prompt, ...(cfg.inputColumns ?? [])].join('\x1f'));
    const rowHashes = run.data.map(r => rowFingerprint(r, cfg.inputColumns));
    const hashKey = `analysis_hashes_${id}`;
    let allHashes: Record<string, { promptHash: string; rowHashes: string[] }> = {};
    try { allHashes = JSON.parse(localStorage.getItem(hashKey) ?? '{}'); } catch {}

    const persistProgress = async () => {
      if (!merged || !merged.some(v => v !== PENDING)) return;
      const derived = lastSplit && cfg.derived?.length ? applyDerivedRules(cfg.derived, lastSplit, run.data.length) : {};
      for (const [n, v] of Object.entries(derived)) upsertAiColumn(n, v);
      await persistColumnsToCsv({ [cfg.name]: merged, ...(lastSplit ?? {}), ...derived });
      allHashes[cfg.id] = { promptHash, rowHashes };
      try { localStorage.setItem(hashKey, JSON.stringify(allHashes)); } catch {}
      return derived;
    };

    try {
      const apiKey = (loadSettings().apiKeys as Record<string, string>)[cfg.provider] || undefined;
      const multi = !!cfg.outputFields?.length;

      // feld_hash-Caching (wie im Sheet): Zeilen mit unverändertem Prompt und
      // unveränderten Eingabewerten, die schon ein brauchbares Ergebnis haben,
      // werden nicht erneut klassifiziert. Fehler-Zeilen laufen automatisch neu.
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
      // Persistenter Mal-Puffer: fertige Werte werden genau EINMAL normalisiert
      // (statt bei jedem Progress-Tick die ganze Liste erneut) und dann nur noch
      // kopiert — bei 1000 Zeilen × 50 Chunks spart das ~98% der Normalisierung.
      merged = run.data.map((_, i) => (todoSet.has(i) ? PENDING : existing[i]));
      let normalizedUpTo = 0;
      const paint = (vals: string[]) => {
        for (let j = normalizedUpTo; j < vals.length; j++) {
          if (vals[j] === PENDING) continue;
          merged![todo[j]] = multi ? normalizeMultiOutput(vals[j], cfg.outputFields!, cfg.outputEnums) : vals[j];
          if (j === normalizedUpTo) normalizedUpTo++;
        }
        upsertAiColumn(cfg.name, [...merged!]);
        // Multi-Output: Antwort live in die Einzelspalten splitten
        if (multi) {
          const split = splitMultiOutput(merged!, cfg.outputFields!);
          for (const [n, v] of Object.entries(split)) upsertAiColumn(n, v);
          lastSplit = split;
          return split;
        }
        return null;
      };

      const subValues = await runAiColumn({
        rows: todo.map(i => run.data[i]),
        provider: cfg.provider,
        model: cfg.model,
        prompt: cfg.prompt,
        apiKey,
        inputColumns: cfg.inputColumns,
        multiOutput: multi,
        onProgress: (partial) => {
          paint(partial);
          setColProgress(p => ({ ...p, [cfg.id]: merged!.filter(v => v !== PENDING).length }));
        },
      });
      paint(subValues);
      const failed = todo.filter(i => isAiError(merged![i])).length;

      await persistProgress();
      const parts: string[] = [`${todo.length - failed} klassifiziert`];
      if (skipped > 0) parts.push(`${skipped} übersprungen (unverändert)`);
      if (failed > 0) parts.push(`${failed} ungültig — erneut ▶ drücken`);
      showToast(`«${cfg.name}»: ${parts.join(', ')}`, failed > 0 ? 'warning' : 'success', failed > 0 ? 7000 : undefined);
    } catch (e) {
      // Whatever chunks completed before the failure are still worth keeping —
      // save them so a retry only redoes what's actually still pending.
      const savedPartial = await persistProgress().catch(() => undefined) !== undefined;
      const msg = e instanceof Error ? e.message : 'Fehler';
      showToast(savedPartial ? `${msg} — bereits klassifizierte Zeilen wurden gespeichert.` : msg, 'error', 8000);
    } finally {
      setColRunning(p => ({ ...p, [cfg.id]: false }));
      setColProgress(p => ({ ...p, [cfg.id]: 0 }));
    }
  };

  // "▶ Laden + Analysieren" im Import-Dialog: der Viewer startet die
  // Klassifizierung selbst, sobald Daten und Configs da sind. Das Flag wird
  // sofort entfernt, damit auch StrictMode-Doppel-Effekte nur einmal starten.
  useEffect(() => {
    if (!run || aiConfigs.length === 0) return;
    try {
      const k = `autorun_analysis_${id}`;
      if (!localStorage.getItem(k)) return;
      localStorage.removeItem(k);
      const cfg = aiConfigs.find(c => c.prompt.trim());
      if (cfg) {
        showToast(`Klassifizierung «${cfg.name}» startet…`, 'info');
        runColumn(cfg);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, aiConfigs, id]);

  const editingCfg = aiConfigs.find(c => c.id === editingId) ?? null;

  /** Config zu einer Spalte finden — auch für gesplittete Output-/Regel-Spalten */
  const findCfgForColumn = (name: string) =>
    aiConfigs.find(c =>
      c.name === name || c.outputFields?.includes(name) || c.derived?.some(d => d.name === name));

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
            : Array(run.data.length).fill(PENDING),
        });
      }
      return next.length === prev.length ? prev : next;
    });
  }, [run, aiOwnedNames]);

  // ── Memoisierte DataTable-Props: neue Array-Identitäten pro Render würden
  //    die komplette Memo-Kette der Tabelle (extended → filtered → sorted)
  //    bei jedem Tastendruck im Editor invalidieren ──

  const tableRawColumns = useMemo(
    () => (run ? run.fields.filter(f => !aiOwnedNames.has(f)) : []),
    [run, aiOwnedNames],
  );

  const labeledAiColumns = useMemo(() => aiColumns.map(c => {
    const parent = findCfgForColumn(c.name);
    if (!parent) return c;
    if (parent.name === c.name) {
      return { ...c, label: `${providerLabel(parent.provider)} · ${parent.model}${parent.promptVersion ? ` · ${parent.promptVersion}` : ''}` };
    }
    if (parent.derived?.some(d => d.name === c.name)) return { ...c, label: `Regel aus «${parent.name}»` };
    return { ...c, label: `aus «${parent.name}»` };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [aiColumns, aiConfigs]);

  // KI-Statistik wie im statistik-Blatt: Fortschritt + Regel-Verteilung,
  // Regel-Chips filtern die Tabelle per Klick
  const statChips = useMemo(() => {
    if (!run) return [];
    const chips: StatChip[] = [];
    for (const cfg of aiConfigs) {
      const col = aiColumns.find(c => c.name === cfg.name);
      if (!col) continue;
      const done = col.values.reduce((n, v) => n + (isUsableAiValue(v) ? 1 : 0), 0);
      if (done === 0) continue;
      chips.push({
        text: `${cfg.name}: ${done}/${run.data.length} klassifiziert`,
        tone: done === run.data.length ? 'teal' : 'gold',
      });
      for (const d of cfg.derived ?? []) {
        const dcol = aiColumns.find(c => c.name === d.name);
        if (!dcol) continue;
        let yes = 0, no = 0;
        for (const v of dcol.values) { if (v === d.then) yes++; else if (v === d.else) no++; }
        if (yes + no === 0) continue;
        const pct = Math.round((yes / (yes + no)) * 100);
        chips.push({ text: `${d.name}: ${yes} ${d.then} (${pct}%)`, tone: 'gold', filter: { column: d.name, value: d.then } });
        chips.push({ text: `${no} ${d.else}`, tone: 'gold', filter: { column: d.name, value: d.else } });
      }
    }
    return chips;
  }, [run, aiConfigs, aiColumns]);

  // Quellen-Statistik: Zielgruppen-Quote pro Big Player (wie das statistik-Blatt)
  const sourceStats = useMemo(() => {
    if (!run) return null;
    const srcCol = ['quelle_person', 'erster_autor'].find(c => run.fields.includes(c));
    if (!srcCol) return null;
    const cfg = aiConfigs.find(c => c.derived?.length);
    const rule = cfg?.derived?.[0];
    const dcol = rule ? aiColumns.find(c => c.name === rule.name) : undefined;
    const rawCol = cfg ? aiColumns.find(c => c.name === cfg.name) : undefined;
    if (!rule || !dcol || !rawCol) return null;
    if (!rawCol.values.some(isUsableAiValue)) return null;

    const bySrc = new Map<string, { total: number; done: number; yes: number }>();
    run.data.forEach((r, i) => {
      const src = String(r[srcCol] ?? '').trim() || '—';
      const s = bySrc.get(src) ?? { total: 0, done: 0, yes: 0 };
      s.total++;
      if (isUsableAiValue(rawCol.values[i])) s.done++;
      if (dcol.values[i] === rule.then) s.yes++;
      bySrc.set(src, s);
    });
    const rows = [...bySrc.entries()]
      .map(([src, s]) => ({ src, ...s, quote: s.done > 0 ? s.yes / s.done : 0 }))
      .sort((a, b) => b.quote - a.quote || b.total - a.total);
    if (rows.length < 2) return null;
    return { srcCol, rule, rows };
  }, [run, aiConfigs, aiColumns]);

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

  // „↓ Outreach": nur Zielgruppe + gefundene E-Mail, auf Cold-Email-Spalten
  // gemappt. Erscheint erst, wenn der Datensatz eine E-Mail-Spalte hat —
  // vorher gäbe es nichts zu exportieren.
  const exportPresets = useMemo<ExportPreset[]>(() => {
    if (!run) return [];
    const hasEmail = run.fields.some(f => ['email_enriched', 'email', 'e_mail', 'email_address', 'mail'].includes(f.toLowerCase()));
    if (!hasEmail) return [];
    const rule = findDerivedRule(aiConfigs, run.fields);
    const audience = rule ? { column: rule.name, value: rule.then } : null;
    return [{
      label: '↓ Outreach',
      title: `Cold-Email-CSV: nur Zeilen mit E-Mail${audience ? ` und ${audience.column} = ${audience.value}` : ''}, Spalten email / first_name / last_name / company / … — direkt in Smartlead & Co. importierbar`,
      transform: (rows) => {
        const out = buildOutreachExport(rows, run.fields, { audience });
        const { noEmail, notAudience } = out.dropped;
        if (out.rows.length === 0) {
          showToast(`Nichts zu exportieren — ${notAudience} nicht Zielgruppe, ${noEmail} ohne E-Mail. Erst Enrichment laufen lassen?`, 'warning', 6000);
          return null;
        }
        const skipped = [notAudience > 0 && `${notAudience} nicht Zielgruppe`, noEmail > 0 && `${noEmail} ohne E-Mail`].filter(Boolean).join(', ');
        showToast(`${out.rows.length} Leads exportiert${skipped ? ` — übersprungen: ${skipped}` : ''}`, 'success', 5000);
        return { filename: `outreach_${new Date().toISOString().slice(0, 10)}.csv`, columns: out.columns, rows: out.rows };
      },
    }];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, aiConfigs]);

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

        {/* Quellen-Statistik: Zielgruppen-Quote pro Big Player (wie das statistik-Blatt) */}
        {sourceStats && (
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => setShowSrcStats(v => !v)}
              style={{
                fontFamily: T.ffMono, fontSize: 10, padding: '4px 12px', borderRadius: 12,
                border: `1px solid ${T.lineS}`, background: showSrcStats ? 'rgba(255,255,255,.06)' : 'transparent',
                color: T.inkD, cursor: 'pointer', letterSpacing: '.03em',
              }}
            >⌗ Statistik nach {sourceStats.srcCol} ({sourceStats.rows.length}) {showSrcStats ? '▴' : '▾'}</button>
            {showSrcStats && (
              <div style={{ marginTop: 8, border: `1px solid ${T.lineS}`, borderRadius: 8, overflow: 'hidden', maxWidth: 640 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 80px 90px', padding: '6px 12px', background: 'rgba(255,255,255,.03)', borderBottom: `1px solid ${T.lineS}` }}>
                  {[sourceStats.srcCol, 'Zeilen', 'Klassifiziert', sourceStats.rule.then, 'Quote'].map((h, i) => (
                    <span key={h} style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: T.inkF, textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
                  ))}
                </div>
                {sourceStats.rows.map(r => (
                  <div key={r.src} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 80px 90px', padding: '5px 12px', borderBottom: `1px solid ${T.lineS}` }}>
                    <span style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.src}</span>
                    <span style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkF, textAlign: 'right' }}>{r.total}</span>
                    <span style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkF, textAlign: 'right' }}>{r.done}</span>
                    <span style={{ fontFamily: T.ffMono, fontSize: 11, color: '#4fd1c5', textAlign: 'right' }}>{r.yes}</span>
                    <span style={{ fontFamily: T.ffMono, fontSize: 11, color: r.quote >= 0.25 ? '#e8b04b' : T.inkF, textAlign: 'right', fontWeight: r.quote >= 0.25 ? 600 : 400 }}>
                      {r.done > 0 ? `${Math.round(r.quote * 100)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Full-width table; AI columns are created in place, ⚙ opens the editor */}
        <DataTable
          data={run.data}
          rawColumns={tableRawColumns}
          stats={statChips}
          aiColumns={labeledAiColumns}
          scrollSignal={scrollSignal}
          excludedRows={excludedRows}
          onExcludeChange={setExcludedRows}
          exportPresets={exportPresets}
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
