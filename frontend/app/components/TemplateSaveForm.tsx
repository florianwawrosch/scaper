'use client';

import { useState } from 'react';
import { PRESET_SOURCES, type PresetFlags } from '@/lib/aiTemplates';

const mono: React.CSSProperties = { fontFamily: "'Spline Sans Mono', monospace" };

interface Props {
  /** Vorbelegter Vorlagenname (z.B. Spaltenname) */
  defaultName: string;
  /** Kurzer Hinweis, was gespeichert wird ("1 Spalte", "3 Spalten") */
  hint?: string;
  onSave: (name: string, flags: PresetFlags) => void;
  onCancel: () => void;
}

/**
 * Kompaktes Formular «Als Vorlage speichern»: Name + Instant-Load-Schalter
 * (bei CSV-Upload / Meta-Scrape automatisch anhängen, optional direkt
 * ausfüllen). Wird im ⚙-Panel und im Vorlagen-Menü der Tabelle benutzt.
 */
export function TemplateSaveForm({ defaultName, hint, onSave, onCancel }: Props) {
  const [name, setName]       = useState(defaultName);
  const [autoAdd, setAutoAdd] = useState<Partial<Record<'csv' | 'meta', boolean>>>({});
  const [autoRun, setAutoRun] = useState(false);
  const anyAuto = Object.values(autoAdd).some(Boolean);

  const submit = () => {
    if (!name.trim()) return;
    onSave(name.trim(), { autoAdd, autoRun: anyAuto && autoRun });
  };

  return (
    <div
      data-testid="template-save-form"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 7, border: '1px solid rgba(232,176,75,.3)', background: 'rgba(232,176,75,.05)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...mono, fontSize: 10, color: '#e8b04b', letterSpacing: '.08em' }}>☆ ALS VORLAGE SPEICHERN</span>
        {hint && <span style={{ ...mono, fontSize: 9, color: '#5f6e87' }}>{hint}</span>}
      </div>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Vorlagenname"
        style={{ ...mono, fontSize: 11, color: '#f5cc77', background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 5, padding: '5px 8px', outline: 'none' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ ...mono, fontSize: 9, color: '#5f6e87', letterSpacing: '.06em' }}>INSTANT LOAD — automatisch anhängen bei:</span>
        {PRESET_SOURCES.map(src => (
          <label key={src.key} style={{ ...mono, fontSize: 10, color: autoAdd[src.key] ? '#f5cc77' : '#9aa7bd', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!autoAdd[src.key]}
              onChange={e => setAutoAdd(p => ({ ...p, [src.key]: e.target.checked }))}
              style={{ accentColor: '#e8b04b', width: 12, height: 12 }}
            />
            {src.label}
          </label>
        ))}
        <label
          title={anyAuto ? 'Spalten nach dem Anhängen sofort per KI ausfüllen (kostet API-Credits)' : 'Erst eine Quelle für Instant Load wählen'}
          style={{ ...mono, fontSize: 10, color: anyAuto ? (autoRun ? '#4fd1c5' : '#9aa7bd') : '#5f6e87', display: 'flex', alignItems: 'center', gap: 6, cursor: anyAuto ? 'pointer' : 'default', opacity: anyAuto ? 1 : .55 }}
        >
          <input
            type="checkbox"
            disabled={!anyAuto}
            checked={anyAuto && autoRun}
            onChange={e => setAutoRun(e.target.checked)}
            style={{ accentColor: '#4fd1c5', width: 12, height: 12 }}
          />
          ▶ direkt ausfüllen lassen
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ ...mono, fontSize: 10, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#9aa7bd' }}
        >Abbrechen</button>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          style={{ ...mono, fontSize: 10, padding: '4px 12px', borderRadius: 5, cursor: 'pointer', border: '1px solid rgba(232,176,75,.4)', background: 'rgba(232,176,75,.12)', color: '#e8b04b', fontWeight: 600, opacity: name.trim() ? 1 : .4 }}
        >Vorlage speichern</button>
      </div>
    </div>
  );
}
