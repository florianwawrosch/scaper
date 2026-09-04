'use client';

import { useState } from 'react';
import { PRESET_SOURCES, type PresetFlags } from '@/lib/aiTemplates';
import { mono } from '@/app/theme';

interface Props {
  /** Titel der KI-Spalte (= Spaltenname in der Tabelle) */
  title: string;
  onSave: (flags: PresetFlags) => void;
  onCancel: () => void;
}

/**
 * Kompaktes Formular «In Einstellungen speichern» (⚙-Panel): die KI-Spalte
 * wird unter ihrem Spaltennamen gespeichert; hier nur die Lade-Schalter —
 * bei CSV-Upload / Meta-Scrape automatisch anhängen, «direkt ausfüllen».
 */
export function TemplateSaveForm({ title, onSave, onCancel }: Props) {
  const [autoAdd, setAutoAdd] = useState<Partial<Record<'csv' | 'meta', boolean>>>({});
  const [autoRun, setAutoRun] = useState(true);

  return (
    <div
      data-testid="template-save-form"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 7, border: '1px solid rgba(232,176,75,.3)', background: 'rgba(232,176,75,.05)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ ...mono, fontSize: 10, color: '#e8b04b', letterSpacing: '.08em' }}>☆ IN EINSTELLUNGEN SPEICHERN</span>
        <span style={{ ...mono, fontSize: 10, color: '#f5cc77', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ ...mono, fontSize: 9, color: '#5f6e87', letterSpacing: '.06em' }}>AUTOMATISCH LADEN BEI:</span>
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
          title="Sobald die Spalte angehängt wird (Import oder «+ KI-Spalte»), sofort per KI ausfüllen (kostet API-Credits)"
          style={{ ...mono, fontSize: 10, color: autoRun ? '#4fd1c5' : '#9aa7bd', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={autoRun}
            onChange={e => setAutoRun(e.target.checked)}
            style={{ accentColor: '#4fd1c5', width: 12, height: 12 }}
          />
          ▶ direkt ausfüllen
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
          onClick={() => onSave({ autoAdd, autoRun })}
          data-testid="template-save-confirm"
          style={{ ...mono, fontSize: 10, padding: '4px 12px', borderRadius: 5, cursor: 'pointer', border: '1px solid rgba(232,176,75,.4)', background: 'rgba(232,176,75,.12)', color: '#e8b04b', fontWeight: 600 }}
        >Speichern</button>
      </div>
    </div>
  );
}
