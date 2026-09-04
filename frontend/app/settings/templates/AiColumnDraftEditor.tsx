'use client';

import { useState } from 'react';
import { AI_PROVIDERS, providerLabel } from '@/lib/ai';
import type { ImportPreset } from '@/lib/aiTemplates';
import { T } from '@/app/theme';

/** Editierbare Attribute einer KI-Spalte (Lade-Schalter sitzen direkt in der Tabellenzeile) */
export interface AiColumnDraft {
  title: string;
  provider?: string;
  model?: string;
  promptVersion: string;
  prompt: string;
}

interface Props {
  preset: ImportPreset;
  /** Eingebaute KI-Spalte mit gespeicherter Anpassung → «↺ Standard» anbieten */
  overridden: boolean;
  error?: string;
  onSave: (d: AiColumnDraft) => void;
  onCancel: () => void;
  onReset?: () => void;
}

const input: React.CSSProperties = { fontFamily: T.mono, fontSize: 11, color: T.ink, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 4, padding: '5px 8px', outline: 'none' };
const label: React.CSSProperties = { fontFamily: T.mono, fontSize: 9, color: T.inkF, letterSpacing: '.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 };

/**
 * Inline-Editor unter einer Tabellenzeile: Titel, KI-Modell, Version, Prompt.
 * Der Entwurf lebt hier (Parent keyed by preset.id → frischer Entwurf je Öffnen).
 */
export function AiColumnDraftEditor({ preset, overridden, error, onSave, onCancel, onReset }: Props) {
  const col = preset.columns[0];
  const [d, setD] = useState<AiColumnDraft>({
    title: col.name, provider: col.provider, model: col.model,
    promptVersion: col.promptVersion ?? preset.promptVersion ?? '', prompt: col.prompt,
  });
  const details = [...(col.outputFields ?? []), ...(col.derived?.map(r => r.name) ?? [])];
  const modelValue = d.provider && d.model ? `${d.provider}|${d.model}` : '';
  const valid = d.title.trim() !== '' && d.prompt.trim() !== '';

  return (
    <div data-testid={`tpl-editor-${preset.id}`} style={{ padding: '14px 16px 16px', background: 'rgba(232,176,75,.03)', borderTop: `1px solid ${T.lineS}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, 1fr) 90px', gap: 12 }}>
        <div>
          <span style={label}>Titel (Spaltenname in der Tabelle)</span>
          <input value={d.title} onChange={e => setD(p => ({ ...p, title: e.target.value }))} placeholder="z.B. ki_nische" data-testid={`tpl-title-${preset.id}`}
            style={{ ...input, width: '100%', boxSizing: 'border-box', color: T.teal, fontWeight: 600 }} />
        </div>
        <div>
          <span style={label}>KI-Modell</span>
          <select value={modelValue} data-testid={`tpl-model-${preset.id}`}
            onChange={e => { const [provider, model] = e.target.value.split('|'); setD(p => ({ ...p, provider: provider || undefined, model: model || undefined })); }}
            style={{ ...input, width: '100%', cursor: 'pointer' }}>
            <option value="">Standard — erster Provider mit Key</option>
            {AI_PROVIDERS.map(p => p.models.map(m => (
              <option key={`${p.id}|${m}`} value={`${p.id}|${m}`}>{providerLabel(p.id)} · {m}</option>
            )))}
          </select>
        </div>
        <div>
          <span style={label}>Version</span>
          <input value={d.promptVersion} onChange={e => setD(p => ({ ...p, promptVersion: e.target.value }))} placeholder="z.B. v1" data-testid={`tpl-version-${preset.id}`}
            style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
        </div>
      </div>

      {details.length > 0 && (
        <p style={{ fontFamily: T.body, fontSize: 11, color: T.inkD, lineHeight: 1.55, margin: 0, padding: '8px 10px', borderRadius: 6, background: 'rgba(232,176,75,.05)', border: '1px solid rgba(232,176,75,.2)' }}>
          <strong style={{ color: T.ink }}>Eine Spalte, ein Aufruf pro Zeile.</strong> Der Prompt fragt {col.outputFields?.length ?? 0} Werte in einer Antwort ab
          (spart API-Kosten). In der Tabelle erscheint nur «{d.title || col.name}»; die Einzelwerte{col.derived?.length ? ' und die Regel-Spalte' : ''} bleiben
          als Detail-Spalten im Datensatz (Export, Filter, Statistik) und lassen sich dort per ⚙ einblenden:{' '}
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF }}>{details.join(', ')}</span>
        </p>
      )}
      {col.inputColumns && (
        <p style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, margin: 0 }}>Eingabespalten: {col.inputColumns.join(', ')}</p>
      )}

      <div>
        <span style={label}>Prompt</span>
        <textarea value={d.prompt} onChange={e => setD(p => ({ ...p, prompt: e.target.value }))} rows={details.length ? 10 : 5} spellCheck={false}
          placeholder="Prompt… z.B. «Welche Nische hat dieser Coach? Antworte mit einem Wort.»" data-testid={`tpl-prompt-${preset.id}`}
          style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: 10.5, lineHeight: 1.55, padding: '10px 12px', borderRadius: 6 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {overridden && onReset && (
          <button type="button" onClick={onReset} data-testid={`tpl-reset-${preset.id}`} title="Titel, Modell, Version und Prompt auf den eingebauten Standard zurücksetzen"
            style={{ fontFamily: T.mono, fontSize: 10, padding: '4px 10px', borderRadius: 4, background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: T.inkD, cursor: 'pointer' }}>
            ↺ Standard
          </button>
        )}
        <div style={{ flex: 1 }}>
          {error && <span style={{ fontFamily: T.mono, fontSize: 10, color: '#e8736b' }}>⚠ {error}</span>}
        </div>
        <button type="button" onClick={onCancel} style={{ fontFamily: T.mono, fontSize: 11, padding: '5px 12px', borderRadius: 5, border: `1px solid ${T.lineS}`, background: 'transparent', color: T.inkD, cursor: 'pointer' }}>
          Abbrechen
        </button>
        <button type="button" disabled={!valid} onClick={() => onSave(d)} data-testid={`tpl-save-${preset.id}`}
          style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, padding: '5px 14px', borderRadius: 5, border: 'none', background: valid ? T.gold : T.panel, color: valid ? '#07070a' : T.inkF, cursor: valid ? 'pointer' : 'default' }}>
          Speichern
        </button>
      </div>
    </div>
  );
}
