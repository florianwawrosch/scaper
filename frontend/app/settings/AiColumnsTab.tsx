'use client';

import { useState, useEffect } from 'react';
import {
  getEffectivePresets, resetPresetOverrides, hasOverride, builtinColumnNames, savePromptOverride,
  saveUserPreset, deleteUserPreset, newPresetId, setPresetFlags, loadUserPresets, pickPresetProvider,
  PRESET_SOURCES, type ImportPreset, type PresetFlags,
} from '@/lib/aiTemplates';
import { providerLabel, defaultModel } from '@/lib/ai';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { ConfirmDelete } from '@/app/components/ConfirmDelete';
import { T } from '@/app/theme';
import { AiColumnDraftEditor, type AiColumnDraft } from './templates/AiColumnDraftEditor';

interface Props {
  /** Anzahl gespeicherter KI-Spalten (Badge in der Navigation) */
  onCountChange?: (n: number) => void;
}

const th: React.CSSProperties = { fontFamily: T.mono, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: T.inkF, textAlign: 'left', padding: '9px 12px', fontWeight: 500, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { fontFamily: T.mono, fontSize: 11, color: T.inkD, padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' };
const check: React.CSSProperties = { accentColor: '#e8b04b', width: 14, height: 14, cursor: 'pointer', display: 'block', margin: '0 auto' };
const iconBtn = (color: string): React.CSSProperties => ({ fontFamily: T.mono, fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: 'transparent', border: `1px solid ${T.lineS}`, color, whiteSpace: 'nowrap' });

/**
 * Einstellungen → KI-Spalten: eine Zeile je gespeicherter KI-Spalte mit
 * Titel, KI-Modell (Anbieter), KI-Version (Modell), Prompt und den drei
 * Lade-Schaltern (bei CSV, bei Meta, direkt ausfüllen). Eingebaute Spalten sind editierbar (als
 * Anpassung, ↺ Standard), eigene frei — beliebig viele, jede löschbar.
 */
export function AiColumnsTab({ onCountChange }: Props) {
  const [presets,    setPresets]    = useState<ImportPreset[]>([]);
  const [overridden, setOverridden] = useState<Set<string>>(new Set());
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [savedId,    setSavedId]    = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  // Server-Keys (Vercel) — damit eine neue KI-Spalte den ersten Anbieter mit Key bekommt
  const [serverKeys, setServerKeys] = useState<Record<string, boolean>>({});

  const reload = () => {
    const eff = getEffectivePresets();
    setPresets(eff);
    onCountChange?.(eff.length);
    setOverridden(new Set(eff.filter(p => hasOverride(p.id)).map(p => p.id)));
  };

  useEffect(() => {
    // localStorage gibt es erst im Browser (SSR-Prerender wäre leer) — daher Effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    fetchKeyAvailability().then(setServerKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editingId) return;
    // Nur senkrecht nachscrollen — scrollIntoView würde die Tabelle auch waagrecht verschieben
    const el = document.querySelector<HTMLElement>(`[data-testid="tpl-editor-${editingId}"]`);
    const r = el?.getBoundingClientRect();
    if (r && r.bottom > window.innerHeight) window.scrollBy({ top: Math.min(r.bottom - window.innerHeight + 24, r.top - 80), behavior: 'smooth' });
  }, [editingId]);

  const flash = (id: string) => {
    setSavedId(id);
    setTimeout(() => setSavedId(s => (s === id ? null : s)), 3000);
  };

  /** Lade-Schalter direkt in der Zeile — sofort gespeichert */
  const toggleFlags = (preset: ImportPreset, patch: PresetFlags) => {
    setPresetFlags(preset.id, { autoAdd: { ...preset.autoAdd, ...patch.autoAdd }, autoRun: patch.autoRun ?? preset.autoRun });
    reload();
  };

  /** Neue KI-Spalte: eigene, leere Spalte mit dem ersten Anbieter mit Key — «direkt ausfüllen» standardmäßig an */
  const createColumn = () => {
    const taken = new Set(getEffectivePresets().map(p => p.columns[0]?.name));
    let n = loadUserPresets().length + 1;
    while (taken.has(`ki_spalte_${n}`)) n++;
    const id = newPresetId();
    const provider = pickPresetProvider(serverKeys);
    saveUserPreset({ id, name: `ki_spalte_${n}`, columns: [{ name: `ki_spalte_${n}`, prompt: '', provider, model: defaultModel(provider) }], userDefined: true, autoRun: true });
    reload();
    setError(null);
    setEditingId(id);
  };

  /** Eingebaute KI-Spalte als eigene, frei editierbare Kopie übernehmen */
  const duplicate = (preset: ImportPreset) => {
    const id = newPresetId();
    const col = preset.columns[0];
    saveUserPreset({
      id, name: `${col.name}_kopie`, description: preset.description,
      columns: [{ ...JSON.parse(JSON.stringify(col)), name: `${col.name}_kopie` }], userDefined: true,
      autoAdd: preset.autoAdd, autoRun: preset.autoRun,
    });
    reload();
    setEditingId(id);
  };

  const save = (preset: ImportPreset, d: AiColumnDraft) => {
    const title = d.title.trim();
    if (!title) return setError('Titel fehlt');
    if (!d.prompt.trim()) return setError('Prompt fehlt');
    if (presets.some(p => p.id !== preset.id && p.columns[0]?.name === title)) return setError(`Titel «${title}» ist schon vergeben`);
    if (preset.userDefined) {
      const col = preset.columns[0];
      saveUserPreset({
        id: preset.id, name: title, description: preset.description, userDefined: true,
        columns: [{ ...col, name: title, prompt: d.prompt, provider: d.provider, model: d.model }],
      });
    } else {
      const original = builtinColumnNames(preset.id)[0] ?? preset.columns[0].name;
      savePromptOverride(preset.id, original, { prompt: d.prompt, name: title !== original ? title : undefined, provider: d.provider, model: d.model });
    }
    setError(null);
    setEditingId(null);
    reload();
    flash(preset.id);
  };

  const badge = (text: string, color: string, bg: string, border: string) => (
    <span style={{ fontFamily: T.mono, fontSize: 8, letterSpacing: '.08em', color, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: '1px 6px', marginRight: 5 }}>{text}</span>
  );

  const newBtn = (testId: string, style: React.CSSProperties) => (
    <button type="button" onClick={createColumn} data-testid={testId} style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...style }}>
      + Neue KI-Spalte
    </button>
  );

  return (
    <>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
            KI-<em style={{ color: T.gold }}>Spalten</em>
          </h1>
          <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, marginTop: 4, lineHeight: 1.6 }}>
            Jede gespeicherte KI-Spalte ist <strong style={{ color: T.inkD }}>eine</strong> Spalte in der Tabelle: Titel, KI-Modell, KI-Version, Prompt.
            <strong style={{ color: T.inkD }}> bei CSV / bei Meta</strong> hängt sie beim Import automatisch an,
            <strong style={{ color: T.inkD }}> ▶ direkt</strong> füllt sie sofort aus, sobald sie angehängt wird (kostet Credits).
            In jedem Datensatz per «+ KI-Spalte» ladbar — jede nur einmal.
          </p>
        </div>
        {newBtn('tpl-new', { padding: '9px 16px', borderRadius: 6, border: 'none', background: T.gold, color: '#07070a', flexShrink: 0, marginTop: 4 })}
      </div>

      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'auto' }}>
        <table data-testid="ai-columns-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 900 }}>
          <colgroup>
            {['21%', '9%', '13%', 'auto', '7%', '7%', '7%', '15%'].map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr style={{ background: T.panel, borderBottom: `1px solid ${T.line}` }}>
              <th style={th}>Titel</th>
              <th style={th}>KI-Modell</th>
              <th style={th}>KI-Version</th>
              <th style={{ ...th, width: '34%' }}>Prompt</th>
              {PRESET_SOURCES.map(src => <th key={src.key} style={{ ...th, textAlign: 'center' }} title={`Beim ${src.label} automatisch anhängen`}>bei {src.key === 'csv' ? 'CSV' : 'Meta'}</th>)}
              <th style={{ ...th, textAlign: 'center' }} title="Sofort per KI ausfüllen, sobald die Spalte angehängt wird">▶ direkt</th>
              <th style={{ ...th, textAlign: 'right' }}>{presets.length}</th>
            </tr>
          </thead>
          <tbody>
            {presets.map((preset, i) => {
              const col = preset.columns[0];
              const editing = editingId === preset.id;
              const isOverridden = overridden.has(preset.id);
              return [
                <tr key={preset.id} data-testid={`tpl-${preset.id}`} style={{ background: editing ? 'rgba(232,176,75,.05)' : i % 2 ? 'transparent' : 'rgba(255,255,255,.015)', borderBottom: editing ? 'none' : `1px solid ${T.lineS}` }}>
                  <td style={{ ...td, color: T.teal, fontWeight: 600 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col.name}>{col.name}</div>
                    <div style={{ marginTop: 4, fontWeight: 400 }}>
                      {preset.userDefined ? badge('eigene', T.teal, T.tealD, T.tealB) : badge('eingebaut', T.inkF, T.panel, T.lineS)}
                      {isOverridden && badge('angepasst', T.gold, T.goldD, 'rgba(232,176,75,.3)')}
                      {savedId === preset.id && <span data-testid={`tpl-saved-${preset.id}`} style={{ fontFamily: T.mono, fontSize: 9, color: T.teal }}>✓ Gespeichert</span>}
                    </div>
                    {!preset.userDefined && preset.description && (
                      <div title={preset.description} style={{ marginTop: 4, fontFamily: T.body, fontSize: 10, fontWeight: 400, color: T.inkF, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{preset.name}</div>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: T.ink, textOverflow: 'ellipsis' }}>{providerLabel(col.provider)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 10, textOverflow: 'ellipsis' }} title={col.model}>{col.model}</td>
                  <td style={{ ...td, fontSize: 10, color: col.prompt.trim() ? T.inkD : '#e8736b' }} title={col.prompt}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {col.prompt.trim() ? col.prompt.replace(/\s+/g, ' ') : '⚠ kein Prompt — bearbeiten'}
                    </div>
                  </td>
                  {PRESET_SOURCES.map(src => (
                    <td key={src.key} style={td}>
                      <input type="checkbox" data-testid={`tpl-auto-${src.key}-${preset.id}`} checked={!!preset.autoAdd?.[src.key]}
                        onChange={e => toggleFlags(preset, { autoAdd: { [src.key]: e.target.checked } })} style={check} />
                    </td>
                  ))}
                  <td style={td}>
                    <input type="checkbox" data-testid={`tpl-autorun-${preset.id}`} checked={!!preset.autoRun}
                      onChange={e => toggleFlags(preset, { autoRun: e.target.checked })} style={{ ...check, accentColor: '#4fd1c5' }} />
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <button type="button" onClick={() => { setError(null); setEditingId(editing ? null : preset.id); }} data-testid={`tpl-edit-${preset.id}`}
                        title="Titel, KI-Modell, KI-Version, Prompt bearbeiten" style={iconBtn(editing ? T.gold : T.inkD)}>
                        {editing ? '▴ Schließen' : '✎ Bearbeiten'}
                      </button>
                      {!preset.userDefined && (
                        <button type="button" onClick={() => duplicate(preset)} data-testid={`tpl-copy-${preset.id}`} title="Als eigene KI-Spalte kopieren" style={iconBtn(T.inkD)}>⧉</button>
                      )}
                      {preset.userDefined && (
                        <ConfirmDelete label="Löschen" title="Diese KI-Spalte löschen" question="Löschen?" testId={`tpl-delete-${preset.id}`}
                          onConfirm={() => { deleteUserPreset(preset.id); if (editingId === preset.id) setEditingId(null); reload(); }}
                          style={{ display: 'inline-flex', alignItems: 'center' }} />
                      )}
                    </span>
                  </td>
                </tr>,
                editing && (
                  <tr key={`${preset.id}-editor`} style={{ borderBottom: `1px solid ${T.lineS}` }}>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <AiColumnDraftEditor
                        key={`${preset.id}:${col.name}:${col.prompt}`}
                        preset={preset}
                        overridden={isOverridden}
                        error={error ?? undefined}
                        onSave={d => save(preset, d)}
                        onCancel={() => { setEditingId(null); setError(null); }}
                        onReset={!preset.userDefined ? () => { resetPresetOverrides(preset.id); setEditingId(null); reload(); } : undefined}
                      />
                    </td>
                  </tr>
                ),
              ];
            })}
            {presets.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign: 'center', padding: 28, color: T.inkF }}>Noch keine KI-Spalten.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Immer erreichbar — auch nach vielen KI-Spalten */}
      {newBtn('tpl-new-bottom', { width: '100%', marginTop: 16, padding: '13px 0', borderRadius: 8, letterSpacing: '.04em', background: 'transparent', border: '1px dashed rgba(232,176,75,.45)', color: T.gold })}
    </>
  );
}
