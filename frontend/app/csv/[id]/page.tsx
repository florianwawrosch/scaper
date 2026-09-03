'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { addToBlocklist } from '@/lib/blocklist';
import { findDerivedRule } from '@/lib/analysisConfigs';
import { getEffectivePresets } from '@/lib/aiTemplates';
import { buildOutreachExport } from '@/lib/outreachExport';
import { providerLabel, isUsableAiValue } from '@/lib/ai';
import { useToast } from '@/app/components/Toast';
import { DataTable, type StatChip, type ExportPreset } from '@/app/components/DataTable';
import { AiColumnEditor } from '@/app/components/AiColumnEditor';
import { PresetMenu } from '@/app/components/PresetMenu';
import { Glyph } from '@/app/components/Glyph';
import { useAiColumns } from './useAiColumns';
import { T } from '@/app/theme';

export default function CsvViewer() {
  const router = useRouter();
  const { showToast } = useToast();
  const { id } = useParams<{ id: string }>();

  const [showSrcStats, setShowSrcStats] = useState(false);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());

  const {
    run, error, providers,
    aiConfigs, aiOwnedNames, displayAiColumns,
    colRunning, colProgress, scrollSignal,
    setEditingId, editingCfg,
    findCfgForColumn, addAiColumn, updateConfig, deleteConfig,
    runColumn, runColumnByName, loadPreset, saveTemplate,
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
    if (parent.derived?.some(d => d.name === c.name)) return { ...c, label: `Regel aus «${parent.name}»` };
    return { ...c, label: `aus «${parent.name}»` };
  }), [displayAiColumns, findCfgForColumn]);

  // KI-Statistik wie im statistik-Blatt: Fortschritt + Regel-Verteilung,
  // Regel-Chips filtern die Tabelle per Klick
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
      for (const d of cfg.derived ?? []) {
        const dcol = displayAiColumns.find(c => c.name === d.name);
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
  }, [run, aiConfigs, displayAiColumns]);

  // Quellen-Statistik: Zielgruppen-Quote pro Big Player (wie das statistik-Blatt)
  const sourceStats = useMemo(() => {
    if (!run) return null;
    const srcCol = ['quelle_person', 'erster_autor'].find(c => run.fields.includes(c));
    if (!srcCol) return null;
    const cfg = aiConfigs.find(c => c.derived?.length);
    const rule = cfg?.derived?.[0];
    const dcol = rule ? displayAiColumns.find(c => c.name === rule.name) : undefined;
    const rawCol = cfg ? displayAiColumns.find(c => c.name === cfg.name) : undefined;
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
  }, [run, aiConfigs, displayAiColumns]);

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
      label: 'Outreach', icon: '↓',
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
          toolbarExtra={
            <PresetMenu
              loadPresets={getEffectivePresets}
              onLoad={loadPreset}
              onSaveCurrent={(name, flags) => saveTemplate(name, flags, aiConfigs)}
              currentColumnCount={aiConfigs.filter(c => c.prompt.trim()).length}
            />
          }
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
          onRunAiColumn={runColumnByName}
        />

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
            onDelete={() => deleteConfig(editingCfg.id)}
            onClose={() => setEditingId(null)}
            onSaveAsTemplate={(name, flags) => saveTemplate(name, flags, [aiConfigs.find(c => c.id === editingCfg.id) ?? editingCfg])}
          />
        )}

      </div>
    </div>
  );
}
