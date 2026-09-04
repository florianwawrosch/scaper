'use client';

import { useState } from 'react';
import { AI_PROVIDERS, modelsFor, defaultModel, providerLabel } from '@/lib/ai';
import type { ImportPreset } from '@/lib/aiTemplates';
import { T } from '@/app/theme';

/** Editierbare Attribute einer KI-Spalte (Lade-Schalter sitzen direkt in der Tabellenzeile) */
export interface AiColumnDraft {
  title: string;
  /** Anbieter: anthropic / openai / gemini */
  provider: string;
  /** Modell des Anbieters, z.B. claude-sonnet-5 */
  model: string;
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
 * Inline-Editor unter einer Tabellenzeile: Titel, KI-Modell (Anbieter),
 * KI-Version (Modell), Prompt. Der Entwurf lebt hier (Parent keyed by
 * preset.id → frischer Entwurf je Öffnen).
 */
export function AiColumnDraftEditor({ preset, overridden, error, onSave, onCancel, onReset }: Props) {
  const col = preset.columns[0];
  const [d, setD] = useState<AiColumnDraft>({ title: col.name, provider: col.provider, model: col.model, prompt: col.prompt });
  const valid = d.title.trim() !== '' && d.prompt.trim() !== '';

  return (
    <div data-testid={`tpl-editor-${preset.id}`} style={{ padding: '14px 16px 16px', background: 'rgba(232,176,75,.03)', borderTop: `1px solid ${T.lineS}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 150px 220px', gap: 12 }}>
        <div>
          <span style={label}>Titel (Spaltenname in der Tabelle)</span>
          <input value={d.title} onChange={e => setD(p => ({ ...p, title: e.target.value }))} placeholder="z.B. ki_nische" data-testid={`tpl-title-${preset.id}`}
            style={{ ...input, width: '100%', boxSizing: 'border-box', color: T.teal, fontWeight: 600 }} />
        </div>
        <div>
          <span style={label}>KI-Modell</span>
          <select value={d.provider} data-testid={`tpl-provider-${preset.id}`}
            onChange={e => setD(p => ({ ...p, provider: e.target.value, model: defaultModel(e.target.value) }))}
            style={{ ...input, width: '100%', cursor: 'pointer' }}>
            {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{providerLabel(p.id)}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>KI-Version</span>
          <select value={d.model} data-testid={`tpl-model-${preset.id}`}
            onChange={e => setD(p => ({ ...p, model: e.target.value }))}
            style={{ ...input, width: '100%', cursor: 'pointer' }}>
            {modelsFor(d.provider).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {col.inputColumns && (
        <p style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, margin: 0 }}>Eingabespalten: {col.inputColumns.join(', ')}</p>
      )}

      <div>
        <span style={label}>Prompt</span>
        <textarea value={d.prompt} onChange={e => setD(p => ({ ...p, prompt: e.target.value }))} rows={col.prompt.length > 400 ? 12 : 5} spellCheck={false}
          placeholder="Prompt… z.B. «Welche Nische hat dieser Coach? Antworte mit einem Wort.»" data-testid={`tpl-prompt-${preset.id}`}
          style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: 10.5, lineHeight: 1.55, padding: '10px 12px', borderRadius: 6 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {overridden && onReset && (
          <button type="button" onClick={onReset} data-testid={`tpl-reset-${preset.id}`} title="Titel, Modell und Prompt auf den eingebauten Standard zurücksetzen"
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
