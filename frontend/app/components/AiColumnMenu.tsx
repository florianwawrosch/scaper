'use client';

import { useState, useRef, useEffect } from 'react';
import { presetMissingInputs, isPresetLoaded, type ImportPreset } from '@/lib/aiTemplates';
import { providerLabel, type AnalysisConfig } from '@/lib/ai';
import { Glyph } from './Glyph';
import { mono } from '@/app/theme';

interface Props {
  /** Alle gespeicherten KI-Spalten (eingebaut + eigene) — beim Öffnen frisch gelesen */
  loadPresets: () => ImportPreset[];
  /** KI-Configs dieses Datensatzes — schon geladene KI-Spalten werden gesperrt */
  configs: AnalysisConfig[];
  /** Spalten des Datensatzes — KI-Spalten mit fehlenden Eingabespalten sind ausgegraut */
  fields?: string[];
  /** Gespeicherte KI-Spalte anhängen (füllt sofort aus, wenn ihr Schalter «direkt ausfüllen» gesetzt ist) */
  onLoad: (preset: ImportPreset) => void;
  /** Leere KI-Spalte anlegen und ⚙ öffnen */
  onCreate: () => void;
  disabled?: boolean;
}

/**
 * Der eine «+ KI-Spalte»-Button der Tabelle: entweder eine gespeicherte
 * KI-Spalte (Einstellungen) laden oder eine neue mit eigenem Prompt anlegen.
 * Jede gespeicherte KI-Spalte ist pro Datensatz nur einmal ladbar.
 */
export function AiColumnMenu({ loadPresets, configs, fields = [], onLoad, onCreate, disabled }: Props) {
  const [open, setOpen]       = useState(false);
  const [presets, setPresets] = useState<ImportPreset[]>([]);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = () => {
    if (!open) setPresets(loadPresets()); // frisch lesen: Einstellungen könnten sich geändert haben
    setOpen(o => !o);
  };

  const subline = (p: ImportPreset) => {
    const col = p.columns[0];
    const parts: string[] = [`${providerLabel(col.provider)} · ${col.model}`];
    const srcs = Object.entries(p.autoAdd ?? {}).filter(([, v]) => v).map(([k]) => (k === 'csv' ? 'CSV' : 'Meta'));
    if (srcs.length) parts.push(`⚡ ${srcs.join('+')}`);
    if (p.autoRun) parts.push('▶ füllt sofort aus');
    return parts.join(' · ');
  };

  const rowStyle = (state: 'ok' | 'loaded' | 'blocked'): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6,
    border: '1px solid rgba(255,255,255,.06)', background: state === 'loaded' ? 'rgba(79,209,197,.04)' : 'rgba(255,255,255,.02)',
    opacity: state === 'blocked' ? .5 : 1,
  });

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        disabled={disabled}
        title="KI-Spalte hinzufügen: gespeicherte laden oder neue anlegen"
        data-testid="ai-column-menu-btn"
        style={{ ...mono, fontSize: 10, padding: '2px 10px', borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(232,176,75,.35)', background: open ? 'rgba(232,176,75,.16)' : 'rgba(232,176,75,.08)', color: '#e8b04b', whiteSpace: 'nowrap', opacity: disabled ? .4 : 1 }}
      ><Glyph>+</Glyph>KI-Spalte {open ? '▴' : '▾'}</button>

      {open && (
        <div
          data-testid="ai-column-menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 9997, width: 360,
            background: '#10111a', border: '1px solid rgba(232,176,75,.3)', borderRadius: 9,
            boxShadow: '0 12px 40px rgba(0,0,0,.6)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6,
          }}
        >
          <button
            onClick={() => { setOpen(false); onCreate(); }}
            data-testid="ai-column-new"
            style={{ ...mono, fontSize: 11, textAlign: 'left', padding: '8px 10px', borderRadius: 6, cursor: 'pointer', border: '1px dashed rgba(232,176,75,.45)', background: 'rgba(232,176,75,.06)', color: '#f5cc77' }}
          >
            ＋ Neue KI-Spalte
            <span style={{ display: 'block', fontSize: 9, color: '#9aa7bd', marginTop: 2 }}>Leere Spalte anlegen und eigenen Prompt schreiben</span>
          </button>

          <span style={{ ...mono, fontSize: 9, color: '#5f6e87', letterSpacing: '.1em', padding: '6px 4px 0' }}>GESPEICHERTE KI-SPALTEN</span>
          {presets.length === 0 && (
            <p style={{ ...mono, fontSize: 10, color: '#5f6e87', padding: '2px 4px 6px' }}>Noch keine gespeichert — Einstellungen → KI-Spalten.</p>
          )}
          {presets.map(p => {
            const loaded = isPresetLoaded(p, configs);
            const missing = loaded ? [] : presetMissingInputs(p, fields);
            const state = loaded ? 'loaded' : missing.length ? 'blocked' : 'ok';
            return (
              <div key={p.id} data-testid={`preset-row-${p.id}`} style={rowStyle(state)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...mono, fontSize: 11, color: state === 'loaded' ? '#9aa7bd' : '#f5cc77', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.columns[0]?.name ?? p.name}{p.userDefined ? '' : <span style={{ color: '#5f6e87' }}> · eingebaut</span>}
                  </div>
                  <div style={{ ...mono, fontSize: 9, color: '#5f6e87', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subline(p)}</div>
                  {state === 'blocked' && (
                    <div style={{ ...mono, fontSize: 9, color: '#e8736b', whiteSpace: 'normal' }}>
                      braucht Spalten: {missing.join(', ')} — nicht in diesem Datensatz
                    </div>
                  )}
                </div>
                {state === 'loaded' ? (
                  <span data-testid={`preset-loaded-${p.id}`} title="Diese KI-Spalte ist in diesem Datensatz schon geladen" style={{ ...mono, fontSize: 10, color: '#4fd1c5', whiteSpace: 'nowrap' }}>✓ in Tabelle</span>
                ) : (
                  <button
                    onClick={() => { setOpen(false); onLoad(p); }}
                    disabled={state === 'blocked'}
                    data-testid={`preset-load-${p.id}`}
                    title={state === 'blocked' ? 'Eingabespalten fehlen in diesem Datensatz' : p.autoRun ? 'Spalte anhängen und sofort per KI ausfüllen (kostet API-Credits)' : 'Spalte anhängen — danach mit ▶ ausfüllen'}
                    style={{ ...mono, fontSize: 10, padding: '3px 10px', borderRadius: 5, cursor: state === 'blocked' ? 'default' : 'pointer', border: '1px solid rgba(232,176,75,.35)', background: 'transparent', color: '#e8b04b', whiteSpace: 'nowrap' }}
                  >{p.autoRun ? '▶ Laden' : 'Laden'}</button>
                )}
              </div>
            );
          })}
          <p style={{ ...mono, fontSize: 9, color: '#5f6e87', padding: '4px 4px 0', lineHeight: 1.5 }}>
            Bearbeiten, KI-Modell, Schalter, Löschen: Einstellungen → KI-Spalten
          </p>
        </div>
      )}
    </div>
  );
}
