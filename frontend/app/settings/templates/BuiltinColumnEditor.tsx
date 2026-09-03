'use client';

import { useState } from 'react';
import { savePromptOverride, type PresetColumn } from '@/lib/aiTemplates';
import { T } from '@/app/theme';

interface Props {
  presetId: string;
  col: PresetColumn;
  /** Nach dem Speichern: Vorlagen neu laden (Override greift) */
  onSaved: () => void;
}

/**
 * Spalte einer eingebauten Vorlage: nur Prompt + Version sind änderbar
 * (als Override), Name/Splits/Regeln stammen aus dem Code. Der Entwurf
 * lebt hier; der Parent remountet per key, sobald der gespeicherte Prompt
 * sich ändert.
 */
export function BuiltinColumnEditor({ presetId, col, onSaved }: Props) {
  const [prompt,  setPrompt]  = useState(col.prompt);
  const [version, setVersion] = useState(col.promptVersion ?? '');
  const [saved,   setSaved]   = useState(false);
  const dirty = prompt !== col.prompt || version !== (col.promptVersion ?? '');

  const save = () => {
    savePromptOverride(presetId, col.name, { prompt, promptVersion: version.trim() || undefined });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved();
  };

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.teal }}>{col.name}</span>
        {col.outputFields && (
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF }}>→ {col.outputFields.join(', ')}</span>
        )}
        <div style={{ flex: 1 }} />
        <label style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, letterSpacing: '.08em', textTransform: 'uppercase' }}>Version</label>
        <input
          value={version}
          onChange={e => setVersion(e.target.value)}
          placeholder="z.B. v2"
          style={{ width: 52, fontFamily: T.mono, fontSize: 10, padding: '3px 7px', borderRadius: 4, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none' }}
        />
      </div>
      {col.inputColumns && (
        <p style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, opacity: .7, marginBottom: 6 }}>
          Eingabespalten: {col.inputColumns.join(', ')}
        </p>
      )}
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={10}
        spellCheck={false}
        style={{
          width: '100%', boxSizing: 'border-box', resize: 'vertical',
          fontFamily: T.mono, fontSize: 10.5, lineHeight: 1.55,
          padding: '10px 12px', borderRadius: 6,
          border: `1px solid ${dirty ? 'rgba(232,176,75,.4)' : T.line}`,
          background: T.panel, color: T.ink, outline: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          {saved && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.teal }}>✓ Gespeichert — gilt für neue Importe</span>}
        </div>
        <button type="button" disabled={!dirty} onClick={save}
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
    </div>
  );
}
