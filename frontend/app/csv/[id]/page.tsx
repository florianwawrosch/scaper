'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { addToBlocklist } from '@/lib/blocklist';
import { findAudience } from '@/lib/analysisConfigs';
import { getEffectivePresets } from '@/lib/aiTemplates';
import { buildOutreachExport } from '@/lib/outreachExport';
import { providerLabel, isUsableAiValue } from '@/lib/ai';
import { useToast } from '@/app/components/Toast';
import { DataTable, type StatChip, type ExportPreset } from '@/app/components/DataTable';
import { AiColumnEditor } from '@/app/components/AiColumnEditor';
import { AiColumnMenu } from '@/app/components/AiColumnMenu';
import { Glyph } from '@/app/components/Glyph';
import { SourceStatsPanel } from '@/app/components/SourceStatsPanel';
import { RunConfirmModal } from '@/app/components/RunConfirmModal';
import { useAiColumns, type AiColumn } from './useAiColumns';
import { KNOWN_COL, EXPORTED_COL } from '@/lib/leadKeys';
import { T } from '@/app/theme';

/** Verteilung einer Antwort-Spalte als Filter-Chips — nur bei wenigen verschiedenen Werten (ja/nein, KEEP/DROP) */
function valueChips(column: string, values: string[]): StatChip[] {
  const counts = new Map<string, number>();
  for (const v of values) if (isUsableAiValue(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
  if (counts.size === 0 || counts.size > 3) return [];
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  // «ja» (Zielgruppe/Treffer) zuerst, sonst nach Häufigkeit
  const rank = (v: string) => (v.toLowerCase() === 'ja' ? -1 : 0);
  return [...counts.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1]).map(([v, n], i) => ({
    text: i === 0 ? `${column}: ${n} ${v} (${Math.round((n / total) * 100)}%)` : `${n} ${v}`,
    tone: 'gold' as const,
    filter: { column, value: v },
  }));
}

export default function CsvViewer() {
  const router = useRouter();
  const { showToast } = useToast();
  const { id } = useParams<{ id: string }>();

  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());

  const {
    run, error, providers, remoteChanged, reloadFromServer,
    aiConfigs, aiOwnedNames, displayAiColumns,
    colRunning, colProgress, scrollSignal, pendingRun, confirmRun, cancelRun,
    setEditingId, editingCfg,
    findCfgForColumn, addAiColumn, updateConfig, deleteConfig,
    runColumn, runColumnByName, loadPreset, saveTemplate,
    matching, runMatch, markExported,
  } = useAiColumns(id);

  // ── Memoisierte DataTable-Props: neue Array-Identitäten pro Render würden
  //    die komplette Memo-Kette der Tabelle (extended → filtered → sorted)
  //    bei jedem Tastendruck im Editor invalidieren ──

  const tableRawColumns = useMemo(
    () => (run ? run.fields.filter(f => !aiOwnedNames.has(f)) : []),
    [run, aiOwnedNames],
  );

  const labeledAiColumns = useMemo(() => displayAiColumns.map(c => {
    const parent = findCfgForColumn(c.name);
    if (!parent) return c;
    if (parent.name === c.name) {
      return { ...c, label: `${providerLabel(parent.provider)} · ${parent.model}${parent.promptVersion ? ` · ${parent.promptVersion}` : ''}` };
    }
    // Ältere Multi-Output-Configs: die Regel-Spalte (ja/nein) bleibt sichtbar,
    // die Einzelwerte der Antwort nicht (sie stehen im Export weiterhin drin)
    if (parent.derived?.some(d => d.name === c.name)) return { ...c, label: `Regel aus «${parent.name}»` };
    return { ...c, label: `aus «${parent.name}»`, hidden: true };
  }), [displayAiColumns, findCfgForColumn]);

  // KI-Statistik wie im statistik-Blatt: Fortschritt + Verteilung der Antworten,
  // Chips filtern die Tabelle per Klick
  const statChips = useMemo(() => {
    if (!run) return [];
    const chips: StatChip[] = [];
    for (const cfg of aiConfigs) {
      const col = displayAiColumns.find(c => c.name === cfg.name);
      if (!col) continue;
      const done = col.values.reduce((n, v) => n + (isUsableAiValue(v) ? 1 : 0), 0);
      if (done === 0) continue;
      chips.push({
        text: `${cfg.name}: ${done}/${run.data.length} klassifiziert`,
        tone: done === run.data.length ? 'teal' : 'gold',
      });
      // Verteilung als Filter-Chips — für Antwort-Spalten mit wenigen Werten
      // (ja/nein, KEEP/DROP) und für Regel-Spalten älterer Configs
      const ruleCols = (cfg.derived ?? []).map(d => displayAiColumns.find(c => c.name === d.name)).filter((c): c is AiColumn => !!c);
      for (const c of ruleCols.length ? ruleCols : [col]) chips.push(...valueChips(c.name, c.values));
    }
    // Lead-Gedächtnis: neu vs. bekannt aus anderen Datensätzen, bereits exportiert
    if (run.fields.includes(KNOWN_COL)) {
      const bySource = new Map<string, number>();
      let fresh = 0;
      for (const r of run.data) {
        const src = String(r[KNOWN_COL] ?? '');
        if (src) bySource.set(src, (bySource.get(src) ?? 0) + 1); else fresh++;
      }
      chips.push({ text: `neu: ${fresh}`, tone: 'teal', filter: { column: KNOWN_COL, value: '' } });
      for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
        chips.push({ text: `bekannt aus «${src}»: ${n}`, tone: 'gold', filter: { column: KNOWN_COL, value: src } });
      }
      const exported = run.data.filter(r => String(r[EXPORTED_COL] ?? '')).length;
      if (exported > 0) chips.push({ text: `bereits exportiert: ${exported}`, tone: 'gold' });
    }
    return chips;
  }, [run, aiConfigs, displayAiColumns]);

  // Quellen-Statistik: Zielgruppen-Quote pro Big Player (wie das statistik-Blatt)
  const sourceStats = useMemo(() => {
    if (!run) return null;
    const srcCol = ['quelle_person', 'erster_autor'].find(c => run.fields.includes(c));
    if (!srcCol) return null;
    const audience = findAudience(aiConfigs, run.fields);
    const dcol = audience ? displayAiColumns.find(c => c.name === audience.column) : undefined;
    if (!audience || !dcol || !dcol.values.some(isUsableAiValue)) return null;

    const bySrc = new Map<string, { total: number; done: number; yes: number }>();
    run.data.forEach((r, i) => {
      const src = String(r[srcCol] ?? '').trim() || '—';
      const s = bySrc.get(src) ?? { total: 0, done: 0, yes: 0 };
      s.total++;
      if (isUsableAiValue(dcol.values[i])) s.done++;
      if (dcol.values[i] === audience.value) s.yes++;
      bySrc.set(src, s);
    });
    const rows = [...bySrc.entries()]
      .map(([src, s]) => ({ src, ...s, quote: s.done > 0 ? s.yes / s.done : 0 }))
      .sort((a, b) => b.quote - a.quote || b.total - a.total);
    if (rows.length < 2) return null;
    return { srcCol, audience, rows };
  }, [run, aiConfigs, displayAiColumns]);

  // „↓ Outreach": nur Zielgruppe + gefundene E-Mail, auf Cold-Email-Spalten
  // gemappt. Erscheint erst, wenn der Datensatz eine E-Mail-Spalte hat —
  // vorher gäbe es nichts zu exportieren.
  const exportPresets = useMemo<ExportPreset[]>(() => {
    if (!run) return [];
    const hasEmail = run.fields.some(f => ['email_enriched', 'email', 'e_mail', 'email_address', 'mail'].includes(f.toLowerCase()));
    if (!hasEmail) return [];
    const audience = findAudience(aiConfigs, run.fields);
    return [{
      label: 'Outreach', icon: '↓',
      title: `Cold-Email-CSV: nur Zeilen mit E-Mail${audience ? ` und ${audience.column} = ${audience.value}` : ''}, Spalten email / first_name / last_name / company / … — direkt in Smartlead & Co. importierbar`,
      transform: (rows) => {
        const out = buildOutreachExport(rows, run.fields, { audience, skipExported: true });
        const { noEmail, notAudience, exported } = out.dropped;
        if (out.rows.length === 0) {
          showToast(`Nichts zu exportieren — ${notAudience} nicht Zielgruppe, ${noEmail} ohne E-Mail, ${exported} bereits exportiert. Erst Enrichment laufen lassen?`, 'warning', 6000);
          return null;
        }
        const skipped = [notAudience > 0 && `${notAudience} nicht Zielgruppe`, noEmail > 0 && `${noEmail} ohne E-Mail`, exported > 0 && `${exported} bereits exportiert`].filter(Boolean).join(', ');
        showToast(`${out.rows.length} Leads exportiert${skipped ? ` — übersprungen: ${skipped}` : ''} · als «exportiert_am» markiert`, 'success', 6000);
        return { filename: `outreach_${new Date().toISOString().slice(0, 10)}.csv`, columns: out.columns, rows: out.rows, exportedIdx: out.exportedIdx };
      },
      afterExport: markExported,
    }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, aiConfigs, showToast]);

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

        {remoteChanged && (
          <div data-testid="dataset-changed" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', marginBottom: 14, borderRadius: 7, border: '1px solid rgba(232,176,75,.4)', background: 'rgba(232,176,75,.08)' }}>
            <span style={{ fontFamily: T.ffMono, fontSize: 11, color: T.gold, flex: 1 }}>Dieser Datensatz wurde inzwischen von einem anderen Gerät oder Kollegen geändert.</span>
            <button onClick={reloadFromServer} data-testid="dataset-reload"
              style={{ fontFamily: T.ffMono, fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 5, border: 'none', background: T.gold, color: '#07070a', cursor: 'pointer' }}>↻ Neu laden</button>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => router.push('/')}
            style={{ fontFamily: T.ffMono, fontSize: 11, padding: '5px 11px', borderRadius: 5, background: 'transparent', border: `1px solid ${T.lineS}`, color: T.inkD, cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
          ><Glyph>←</Glyph>Import</button>
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
            ><Glyph>↻</Glyph>Erneut scrapen</button>
          )}
          <button
            onClick={() => router.push(`/csv/${id}/enrich`)}
            style={{
              fontFamily: T.ffMono, fontSize: 11, padding: '7px 16px', borderRadius: 6,
              border: '1px solid rgba(79,209,197,.35)', background: 'rgba(79,209,197,.07)',
              color: '#4fd1c5', cursor: 'pointer', flexShrink: 0, marginTop: 2, letterSpacing: '.04em',
            }}
          >Enrichment starten<Glyph after>→</Glyph></button>
        </div>

        {sourceStats && <SourceStatsPanel stats={sourceStats} />}

        {/* Full-width table; AI columns are created in place, ⚙ opens the editor */}
        <DataTable
          data={run.data}
          rawColumns={tableRawColumns}
          exportName={run.filename}
          stats={statChips}
          aiColumns={labeledAiColumns}
          scrollSignal={scrollSignal}
          excludedRows={excludedRows}
          onExcludeChange={setExcludedRows}
          exportPresets={exportPresets}
          toolbarExtra={<>
            <button
              onClick={() => runMatch()}
              disabled={matching}
              data-testid="match-btn"
              title="Mit allen anderen Datensätzen abgleichen: bekannte Seiten/Personen und bereits exportierte Leads markieren"
              style={{ fontFamily: T.ffMono, fontSize: 10, padding: '2px 10px', borderRadius: 4, cursor: matching ? 'default' : 'pointer', border: `1px solid ${T.lineS}`, background: 'transparent', color: T.inkD, whiteSpace: 'nowrap', opacity: matching ? .5 : 1 }}
            ><Glyph>{matching ? '↻' : '⟲'}</Glyph>Abgleich</button>
            <AiColumnMenu
              loadPresets={getEffectivePresets}
              configs={aiConfigs}
              fields={run.fields}
              onLoad={loadPreset}
              onCreate={addAiColumn}
            />
          </>}
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
          onConfigureAiColumn={(name) => {
            const cfg = findCfgForColumn(name);
            if (cfg) setEditingId(cfg.id);
            else showToast('Für diese Spalte gibt es keine Konfiguration', 'warning');
          }}
          onRunAiColumn={runColumnByName}
        />

        {pendingRun && <RunConfirmModal cfg={pendingRun.cfg} todo={pendingRun.todo} skipped={pendingRun.skipped} onConfirm={confirmRun} onCancel={cancelRun} />}

        {/* ⚙ side panel for the selected AI column */}
        {editingCfg && (
          <AiColumnEditor
            key={editingCfg.id}
            config={editingCfg}
            rowCount={run.data.length}
            providers={providers}
            running={!!colRunning[editingCfg.id]}
            progress={colProgress[editingCfg.id] ?? 0}
            onChange={(patch) => updateConfig(editingCfg.id, patch)}
            onSave={() => {
              setEditingId(null);
              showToast(`Spalte «${editingCfg.name}» gespeichert`, 'success');
            }}
            onRun={() => runColumn(aiConfigs.find(c => c.id === editingCfg.id) ?? editingCfg)}
            onTest={() => runColumn(aiConfigs.find(c => c.id === editingCfg.id) ?? editingCfg, { limit: 3, confirmed: true })}
            onDelete={() => deleteConfig(editingCfg.id)}
            onClose={() => setEditingId(null)}
            onSaveAsTemplate={flags => saveTemplate(aiConfigs.find(c => c.id === editingCfg.id) ?? editingCfg, flags)}
          />
        )}

      </div>
    </div>
  );
}
