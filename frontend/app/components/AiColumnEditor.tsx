'use client';

import { useState } from 'react';
import { modelsFor, providerLabel } from '@/lib/ai';
import type { PresetFlags } from '@/lib/aiTemplates';
import type { AnalysisConfig } from '@/lib/ai';
import { TemplateSaveForm } from './TemplateSaveForm';
import { mono } from '@/app/theme';

interface Props {
  config: AnalysisConfig;
  rowCount: number;
  /** Providers with a configured key (browser or server) */
  providers: string[];
  running: boolean;
  progress: number;
  onChange: (patch: Partial<AnalysisConfig>) => void;
  onSave: () => void;
  onRun: () => void;
  /** Prompt an den ersten 3 offenen Zeilen ausprobieren (kostet 3 Aufrufe) */
  onTest: () => void;
  onDelete: () => void;
  onClose: () => void;
  /** «☆ In Einstellungen speichern»: diese KI-Spalte als gespeicherte KI-Spalte sichern */
  onSaveAsTemplate?: (flags: PresetFlags) => void;
}

/** Fixed side panel that edits ONE AI column (name, model, prompt). */
export function AiColumnEditor({ config, rowCount, providers, running, progress, onChange, onSave, onRun, onTest, onDelete, onClose, onSaveAsTemplate }: Props) {
  // Parent keys this panel by config.id, so switching columns remounts it
  // with a fresh draft — no effect needed to reset the name.
  const [draftName, setDraftName] = useState(config.name);
  const [savingTpl, setSavingTpl] = useState(false);

  return (
    <div style={{
      position: 'fixed', right: 24, top: 90, zIndex: 9998, width: 340,
      maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
      background: '#10111a', border: '1px solid rgba(232,176,75,.3)',
      borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,.6)', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...mono, fontSize: 11, color: '#e8b04b', letterSpacing: '.08em' }}>⚙ Spalte konfigurieren</span>
        <button onClick={onClose} style={{ ...mono, fontSize: 16, color: '#5f6e87', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      {/* Name */}
      <input
        value={draftName}
        onChange={e => setDraftName(e.target.value)}
        onBlur={() => onChange({ name: draftName })}
        placeholder="Spaltenname"
        style={{ ...mono, fontSize: 12, color: '#f5cc77', background: 'transparent', border: 'none', outline: 'none', borderBottom: '1px solid rgba(232,176,75,.25)', paddingBottom: 3 }}
      />

      {/* Provider + model */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {providers.map(p => (
          <button
            key={p}
            onClick={() => onChange({ provider: p, model: modelsFor(p)[0] ?? '' })}
            style={{
              ...mono, fontSize: 10, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
              border: config.provider === p ? '1px solid rgba(232,176,75,.4)' : '1px solid rgba(255,255,255,.07)',
              background: config.provider === p ? 'rgba(232,176,75,.08)' : 'transparent',
              color: config.provider === p ? '#f5cc77' : '#5f6e87',
            }}
          >{providerLabel(p)}</button>
        ))}
        <select
          value={config.model}
          onChange={e => onChange({ model: e.target.value })}
          style={{ ...mono, marginLeft: 'auto', fontSize: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 5, color: '#9aa7bd', padding: '3px 6px', outline: 'none' }}
        >
          {modelsFor(config.provider).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Prompt */}
      <textarea
        value={config.prompt}
        onChange={e => onChange({ prompt: e.target.value })}
        placeholder="Prompt… z.B. «Welche Nische hat dieser Coach? Antworte mit einem Wort.»"
        rows={4}
        style={{ ...mono, fontSize: 11, color: '#9aa7bd', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 6, padding: '6px 8px', width: '100%', outline: 'none', resize: 'vertical', lineHeight: 1.55, boxSizing: 'border-box' }}
      />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => { onChange({ name: draftName }); onSave(); }}
          disabled={running || !draftName.trim()}
          style={{
            ...mono, fontSize: 11, padding: '5px 13px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid rgba(79,209,197,.35)', background: 'rgba(79,209,197,.07)', color: '#4fd1c5',
            opacity: running || !draftName.trim() ? 0.4 : 1,
          }}
        >💾 Speichern</button>
        <button
          onClick={onRun}
          disabled={running || rowCount === 0 || !config.prompt.trim()}
          style={{
            ...mono, fontSize: 11, padding: '5px 13px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid rgba(232,176,75,.35)', background: 'rgba(232,176,75,.08)', color: '#e8b04b',
            opacity: running || rowCount === 0 || !config.prompt.trim() ? 0.4 : 1,
          }}
        >
          {running ? (progress ? `Läuft… ${progress}/${rowCount}` : 'Läuft…') : `▶ Analysieren`}
        </button>
        <button
          onClick={onTest}
          disabled={running || rowCount === 0 || !config.prompt.trim()}
          title="Prompt an 3 Zeilen testen — Antwort prüfen, bevor alle Zeilen Credits kosten"
          data-testid="editor-test-run"
          style={{
            ...mono, fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#9aa7bd',
            opacity: running || rowCount === 0 || !config.prompt.trim() ? 0.4 : 1,
          }}
        >🧪 3 Zeilen</button>
        <button
          onClick={onDelete}
          disabled={running}
          title="Spalte löschen"
          style={{ ...mono, fontSize: 12, marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#e8736b', opacity: .7, padding: 0 }}
        >🗑</button>
      </div>

      {/* In den Einstellungen sichern — damit die Spalte beim nächsten Import per Klick (oder automatisch) da ist */}
      {onSaveAsTemplate && (
        savingTpl ? (
          <TemplateSaveForm
            title={draftName}
            onSave={flags => { onChange({ name: draftName }); onSaveAsTemplate(flags); setSavingTpl(false); }}
            onCancel={() => setSavingTpl(false)}
          />
        ) : (
          <button
            onClick={() => setSavingTpl(true)}
            disabled={!config.prompt.trim()}
            title={config.prompt.trim() ? 'Diese KI-Spalte in den Einstellungen speichern — dann per «+ KI-Spalte» in jedem Datensatz ladbar' : 'Erst einen Prompt eingeben'}
            data-testid="editor-save-template"
            style={{ ...mono, fontSize: 10, padding: '5px 10px', borderRadius: 6, cursor: config.prompt.trim() ? 'pointer' : 'default', border: '1px dashed rgba(232,176,75,.3)', background: 'transparent', color: '#e8b04b', opacity: config.prompt.trim() ? .9 : .4, textAlign: 'left' }}
          >☆ In Einstellungen speichern</button>
        )
      )}
    </div>
  );
}
