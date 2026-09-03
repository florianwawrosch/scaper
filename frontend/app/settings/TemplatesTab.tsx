'use client';

import { useState, useEffect, useRef } from 'react';
import {
  getEffectivePresets, resetPresetOverrides, hasOverride,
  saveUserPreset, deleteUserPreset, newPresetId, setPresetFlags, loadUserPresets,
  PRESET_SOURCES, type ImportPreset, type PresetFlags,
} from '@/lib/aiTemplates';
import { ConfirmDelete } from '@/app/components/ConfirmDelete';
import { T } from '@/app/theme';
import { InstantLoadRow } from './templates/InstantLoadRow';
import { BuiltinColumnEditor } from './templates/BuiltinColumnEditor';
import { UserPresetEditor } from './templates/UserPresetEditor';

interface Props {
  /** Anzahl der Vorlagen (für das Badge in der Navigation) */
  onCountChange?: (n: number) => void;
}

/** Nur die speicherbaren Felder einer eigenen Vorlage (Flags liegen separat) */
const stored = (d: ImportPreset): ImportPreset => ({
  id: d.id, name: d.name, description: d.description, promptVersion: d.promptVersion, columns: d.columns, userDefined: true,
});

const draftDirty = (a: ImportPreset, b: ImportPreset) =>
  JSON.stringify([a.name, a.description ?? '', a.columns]) !== JSON.stringify([b.name, b.description ?? '', b.columns]);

/**
 * Einstellungen → KI-Vorlagen: beliebig viele KI-Spalten. Eingebaute Vorlagen
 * (Prompt-Override, ↺ Standard, Kopieren), eigene Vorlagen (Spalten anlegen/
 * löschen, speichern, Vorlage löschen) und die Instant-Load-Schalter.
 */
export function TemplatesTab({ onCountChange }: Props) {
  const [presets,    setPresets]    = useState<ImportPreset[]>([]);
  const [overridden, setOverridden] = useState<Set<string>>(new Set());
  // Eigene Vorlagen werden als Ganzes bearbeitet (Name, Beschreibung, Spalten)
  const [drafts,     setDrafts]     = useState<Record<string, ImportPreset>>({});
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [savedId,    setSavedId]    = useState<string | null>(null);
  // Frisch angelegte/kopierte Vorlage: nach dem Render hinscrollen und Spaltenname fokussieren
  const focusRef = useRef<string | null>(null);

  const reload = () => {
    const eff = getEffectivePresets();
    setPresets(eff);
    onCountChange?.(eff.length);
    // Einmal beim (Neu-)Laden ermitteln statt hasOverride() pro Preset pro Render
    setOverridden(new Set(eff.filter(p => hasOverride(p.id)).map(p => p.id)));
    setDrafts(Object.fromEntries(eff.filter(p => p.userDefined).map(p => [p.id, p])));
    setErrors({});
  };

  useEffect(() => {
    // localStorage gibt es erst im Browser (SSR-Prerender wäre leer) — daher Effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = focusRef.current;
    if (!id) return;
    focusRef.current = null;
    const card = document.querySelector<HTMLElement>(`[data-testid="tpl-${id}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card?.querySelector<HTMLInputElement>('input[placeholder="spaltenname"]')?.focus();
  }, [presets]);

  /** Instant-Load-Schalter einer Vorlage umstellen (sofort gespeichert) */
  const toggleFlags = (preset: ImportPreset, patch: PresetFlags) => {
    setPresetFlags(preset.id, { autoAdd: { ...preset.autoAdd, ...patch.autoAdd }, autoRun: patch.autoRun ?? preset.autoRun });
    reload();
  };

  /** Neue KI-Spalte = neue eigene Vorlage mit einer leeren Spalte (beliebig viele möglich) */
  const createUserPreset = () => {
    const n = loadUserPresets().length + 1;
    const id = newPresetId();
    saveUserPreset({ id, name: `Neue KI-Spalte ${n}`, columns: [{ name: `ki_spalte_${n}`, prompt: '' }], userDefined: true });
    reload();
    focusRef.current = id;
  };

  /** Eingebaute Vorlage als eigene, frei editierbare Kopie übernehmen */
  const duplicatePreset = (preset: ImportPreset) => {
    const id = newPresetId();
    saveUserPreset({
      id, name: `${preset.name} (Kopie)`, description: preset.description, promptVersion: preset.promptVersion,
      columns: JSON.parse(JSON.stringify(preset.columns)), userDefined: true,
      autoAdd: preset.autoAdd, autoRun: preset.autoRun,
    });
    reload();
    focusRef.current = id;
  };

  /** Spalte einer eigenen Vorlage löschen — sofort gespeichert; die letzte Spalte löscht die Vorlage */
  const deleteColumn = (preset: ImportPreset, ci: number) => {
    const d = drafts[preset.id] ?? preset;
    if (d.columns.length <= 1) { deleteUserPreset(preset.id); reload(); return; }
    saveUserPreset(stored({ ...d, columns: d.columns.filter((_, i) => i !== ci) }));
    reload();
  };

  const saveDraft = (d: ImportPreset) => {
    const fail = (msg: string) => setErrors(p => ({ ...p, [d.id]: msg }));
    const names = d.columns.map(c => c.name.trim());
    if (!d.name.trim()) return fail('Vorlagenname fehlt');
    if (d.columns.length === 0) return fail('Mindestens eine Spalte anlegen');
    if (names.some(n => !n)) return fail('Jede Spalte braucht einen Namen');
    if (new Set(names).size !== names.length) return fail('Spaltennamen müssen eindeutig sein');
    if (d.columns.some(c => !c.prompt.trim())) return fail('Jede Spalte braucht einen Prompt');
    saveUserPreset(stored({
      ...d, name: d.name.trim(), description: d.description?.trim() || undefined,
      columns: d.columns.map(c => ({ ...c, name: c.name.trim(), promptVersion: c.promptVersion?.trim() || undefined })),
    }));
    reload();
    setSavedId(d.id);
    setTimeout(() => setSavedId(s => (s === d.id ? null : s)), 3000);
  };

  const editDraft = (id: string, fn: (d: ImportPreset) => ImportPreset) =>
    setDrafts(p => ({ ...p, [id]: fn(p[id]) }));

  const badge = (text: string, color: string, bg: string, border: string) => (
    <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.08em', color, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: '2px 7px' }}>{text}</span>
  );

  return (
    <>
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
            KI-<em style={{ color: T.gold }}>Vorlagen</em>
          </h1>
          <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, marginTop: 4, lineHeight: 1.6 }}>
            Beliebig viele KI-Spalten anlegen: jede Vorlage enthält eine oder mehrere Spalten mit eigenem Prompt.
            <strong style={{ color: T.inkD }}> ⚡ Instant Load</strong> hängt die Spalten beim Import automatisch an — bei
            CSV/Excel-Upload und/oder Meta-Scrape — ohne Dialog; <strong style={{ color: T.inkD }}>▶ direkt ausfüllen</strong> startet
            die KI dazu sofort (kostet Credits). Eingebaute Vorlagen lassen sich als Kopie übernehmen und dann frei erweitern.
            Prompt-Änderungen gelten für zukünftige Importe; bestehende Datensätze behalten ihre Konfiguration.
          </p>
        </div>
        <button type="button" onClick={createUserPreset} data-testid="tpl-new"
          style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 6, border: 'none', background: T.gold, color: '#07070a', cursor: 'pointer', flexShrink: 0, marginTop: 4 }}>
          + Neue KI-Spalte
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {presets.map(preset => {
          const isOverridden = overridden.has(preset.id);
          const anyAuto = PRESET_SOURCES.some(src => preset.autoAdd?.[src.key]);
          const draft = preset.userDefined ? (drafts[preset.id] ?? preset) : null;
          const dirty = !!draft && draftDirty(preset, draft);
          return (
            <div key={preset.id} data-testid={`tpl-${preset.id}`} style={{ background: T.panel2, border: `1px solid ${anyAuto ? 'rgba(232,176,75,.35)' : isOverridden ? 'rgba(232,176,75,.2)' : 'rgba(255,255,255,.06)'}`, borderRadius: 8, padding: '16px 18px' }}>
              {/* Kopfzeile: Name (bei eigenen editierbar), Badges, Aktionen */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {draft ? (
                  <input
                    value={draft.name}
                    onChange={e => editDraft(preset.id, d => ({ ...d, name: e.target.value }))}
                    placeholder="Vorlagenname"
                    style={{ flex: 1, fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.ink, background: 'transparent', border: 'none', borderBottom: `1px solid ${T.line}`, outline: 'none', padding: '2px 0' }}
                  />
                ) : (
                  <p style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.ink, flex: 1 }}>{preset.name}</p>
                )}
                {preset.userDefined
                  ? badge('eigene', T.teal, T.tealD, T.tealB)
                  : badge('eingebaut', T.inkF, T.panel, T.lineS)}
                {isOverridden && (
                  <>
                    {badge('angepasst', T.gold, T.goldD, 'rgba(232,176,75,.3)')}
                    <button type="button"
                      onClick={() => { resetPresetOverrides(preset.id); reload(); }}
                      title="Prompt auf den eingebauten Standard zurücksetzen"
                      style={{ fontFamily: T.mono, fontSize: 10, padding: '3px 9px', borderRadius: 4, background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: T.inkD, cursor: 'pointer' }}>
                      ↺ Standard
                    </button>
                  </>
                )}
                {!preset.userDefined && (
                  <button type="button"
                    onClick={() => duplicatePreset(preset)}
                    data-testid={`tpl-copy-${preset.id}`}
                    title="Als eigene Vorlage kopieren — dann Spalten hinzufügen, umbenennen, löschen"
                    style={{ fontFamily: T.mono, fontSize: 10, padding: '3px 9px', borderRadius: 4, background: 'rgba(232,176,75,.08)', border: '1px solid rgba(232,176,75,.35)', color: T.gold, cursor: 'pointer' }}>
                    ⧉ Kopieren & bearbeiten
                  </button>
                )}
                {preset.userDefined && (
                  <ConfirmDelete
                    label="Vorlage löschen"
                    title="Diese Vorlage mit allen Spalten löschen"
                    question="Ganze Vorlage löschen?"
                    testId={`tpl-delete-${preset.id}`}
                    onConfirm={() => { deleteUserPreset(preset.id); reload(); }}
                    style={{ display: 'flex', alignItems: 'center' }}
                  />
                )}
              </div>
              {draft ? (
                <input
                  value={draft.description ?? ''}
                  onChange={e => editDraft(preset.id, d => ({ ...d, description: e.target.value }))}
                  placeholder="Beschreibung (optional)"
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: T.body, fontSize: 11, color: T.inkD, background: 'transparent', border: 'none', outline: 'none', padding: 0, marginBottom: 12 }}
                />
              ) : preset.description && (
                <p style={{ fontFamily: T.body, fontSize: 11, color: T.inkF, marginBottom: 12 }}>{preset.description}</p>
              )}

              <InstantLoadRow preset={preset} onToggle={patch => toggleFlags(preset, patch)} />

              {draft ? (
                <UserPresetEditor
                  preset={preset}
                  draft={draft}
                  dirty={dirty}
                  error={errors[preset.id]}
                  saved={savedId === preset.id}
                  onEdit={fn => editDraft(preset.id, fn)}
                  onSave={() => saveDraft(draft)}
                  onDeleteColumn={ci => deleteColumn(preset, ci)}
                />
              ) : preset.columns.map(col => (
                // key mit Prompt: nach einem Save (oder ↺ Standard) startet der Entwurf frisch
                <BuiltinColumnEditor key={`${col.name}:${col.prompt}:${col.promptVersion ?? ''}`} presetId={preset.id} col={col} onSaved={reload} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Immer erreichbar — auch nach vielen Vorlagen */}
      <button type="button" onClick={createUserPreset} data-testid="tpl-new-bottom"
        style={{ width: '100%', marginTop: 20, padding: '14px 0', borderRadius: 8, cursor: 'pointer', fontFamily: T.mono, fontSize: 12, fontWeight: 600, letterSpacing: '.04em', background: 'transparent', border: `1px dashed rgba(232,176,75,.45)`, color: T.gold }}>
        + Neue KI-Spalte anlegen
      </button>
    </>
  );
}
