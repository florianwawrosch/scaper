'use client';

import type { ImportPreset } from '@/lib/aiTemplates';
import { ConfirmDelete } from '@/app/components/ConfirmDelete';
import { T } from '@/app/theme';

interface Props {
  preset: ImportPreset;
  draft: ImportPreset;
  dirty: boolean;
  error?: string;
  saved: boolean;
  onEdit: (fn: (d: ImportPreset) => ImportPreset) => void;
  onSave: () => void;
  onDeleteColumn: (ci: number) => void;
}

/** Spalten einer eigenen Vorlage: Name, Version, Prompt — beliebig viele, jede löschbar */
export function UserPresetEditor({ preset, draft, dirty, error, saved, onEdit, onSave, onDeleteColumn }: Props) {
  const setCol = (ci: number, patch: Partial<ImportPreset['columns'][number]>) =>
    onEdit(d => ({ ...d, columns: d.columns.map((c, i) => (i === ci ? { ...c, ...patch } : c)) }));

  return (
    <>
      {draft.columns.map((col, ci) => (
        <div key={ci} style={{ marginTop: 4, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input
              value={col.name}
              onChange={e => setCol(ci, { name: e.target.value })}
              placeholder="spaltenname"
              style={{ width: 200, fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.teal, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 4, padding: '3px 7px', outline: 'none' }}
            />
            {col.outputFields && (
              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF }}>→ {col.outputFields.join(', ')}</span>
            )}
            <div style={{ flex: 1 }} />
            <label style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, letterSpacing: '.08em', textTransform: 'uppercase' }}>Version</label>
            <input
              value={col.promptVersion ?? ''}
              onChange={e => setCol(ci, { promptVersion: e.target.value })}
              placeholder="z.B. v1"
              style={{ width: 52, fontFamily: T.mono, fontSize: 10, padding: '3px 7px', borderRadius: 4, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none' }}
            />
            <ConfirmDelete
              label="Spalte löschen"
              title={draft.columns.length > 1 ? 'Diese Spalte aus der Vorlage löschen' : 'Letzte Spalte — löscht die ganze Vorlage'}
              question={draft.columns.length > 1 ? 'Spalte löschen?' : 'Letzte Spalte — Vorlage löschen?'}
              testId={`tpl-col-delete-${preset.id}-${ci}`}
              onConfirm={() => onDeleteColumn(ci)}
              style={{ display: 'flex', alignItems: 'center' }}
            />
          </div>
          {col.inputColumns && (
            <p style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, opacity: .7, marginBottom: 6 }}>
              Eingabespalten: {col.inputColumns.join(', ')}
            </p>
          )}
          <textarea
            value={col.prompt}
            onChange={e => setCol(ci, { prompt: e.target.value })}
            rows={5}
            spellCheck={false}
            placeholder="Prompt… z.B. «Welche Nische hat dieser Coach? Antworte mit einem Wort.»"
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              fontFamily: T.mono, fontSize: 10.5, lineHeight: 1.55,
              padding: '10px 12px', borderRadius: 6,
              border: `1px solid ${dirty ? 'rgba(232,176,75,.4)' : T.line}`,
              background: T.panel, color: T.ink, outline: 'none',
            }}
          />
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <button type="button"
          onClick={() => onEdit(d => ({ ...d, columns: [...d.columns, { name: `ki_spalte_${d.columns.length + 1}`, prompt: '' }] }))}
          data-testid={`tpl-col-add-${preset.id}`}
          style={{ fontFamily: T.mono, fontSize: 11, padding: '5px 12px', borderRadius: 4, background: 'rgba(79,209,197,.06)', border: '1px dashed rgba(79,209,197,.4)', color: T.teal, cursor: 'pointer' }}>
          + Spalte hinzufügen
        </button>
        <div style={{ flex: 1 }}>
          {error && <span style={{ fontFamily: T.mono, fontSize: 10, color: '#e8736b' }}>⚠ {error}</span>}
          {!error && saved && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.teal }}>✓ Gespeichert</span>}
        </div>
        <button type="button"
          disabled={!dirty}
          onClick={onSave}
          data-testid={`tpl-save-${preset.id}`}
          style={{
            fontFamily: T.mono, fontSize: 11, padding: '5px 14px', borderRadius: 5,
            border: `1px solid ${dirty ? T.gold : 'rgba(255,255,255,.1)'}`,
            background: dirty ? 'rgba(232,176,75,.12)' : 'transparent',
            color: dirty ? T.gold : T.inkF,
            cursor: dirty ? 'pointer' : 'default',
          }}>
          Speichern
        </button>
      </div>
    </>
  );
}
