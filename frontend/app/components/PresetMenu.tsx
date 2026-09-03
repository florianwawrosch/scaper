'use client';

import { useState, useRef, useEffect } from 'react';
import type { ImportPreset, PresetFlags } from '@/lib/aiTemplates';
import { Glyph } from './Glyph';
import { TemplateSaveForm } from './TemplateSaveForm';
import { mono } from '@/app/theme';

interface Props {
  /** Alle Vorlagen (eingebaut + eigene) — werden beim Öffnen frisch geladen */
  loadPresets: () => ImportPreset[];
  /** Vorlage in den aktuellen Datensatz laden; autoRun = direkt ausfüllen */
  onLoad: (preset: ImportPreset, autoRun: boolean) => void;
  /** Alle aktuellen KI-Spalten als Vorlage speichern (undefined = keine Spalten) */
  onSaveCurrent?: (name: string, flags: PresetFlags) => void;
  /** Anzahl speicherbarer KI-Spalten (für den Hinweis im Formular) */
  currentColumnCount?: number;
  disabled?: boolean;
}

/** Zählt Spalten inkl. Splits und Regel-Spalten */
function columnCount(p: ImportPreset): number {
  return p.columns.reduce((n, c) => n + (c.outputFields?.length ?? 1) + (c.derived?.length ?? 0), 0);
}

/**
 * «⊞ Vorlage» Dropdown in der Tabellen-Toolbar: Vorlagen-Spalten laden
 * (mit oder ohne sofortiges Ausfüllen) und die aktuellen Spalten als
 * Vorlage sichern — ohne den Umweg über die Einstellungen.
 */
export function PresetMenu({ loadPresets, onLoad, onSaveCurrent, currentColumnCount = 0, disabled }: Props) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [presets, setPresets] = useState<ImportPreset[]>([]);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) { setOpen(false); setSaving(false); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = () => {
    if (!open) setPresets(loadPresets()); // frisch lesen: Einstellungen könnten sich geändert haben
    setOpen(o => !o);
    setSaving(false);
  };

  const flagLabel = (p: ImportPreset) => {
    const srcs = Object.entries(p.autoAdd ?? {}).filter(([, v]) => v).map(([k]) => (k === 'csv' ? 'CSV' : 'Meta'));
    if (srcs.length === 0) return null;
    return `⚡ ${srcs.join('+')}${p.autoRun ? ' ▶' : ''}`;
  };

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        disabled={disabled}
        title="KI-Spalten aus einer Vorlage laden oder aktuelle Spalten als Vorlage speichern"
        data-testid="preset-menu-btn"
        style={{ ...mono, fontSize: 10, padding: '2px 10px', borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(232,176,75,.35)', background: open ? 'rgba(232,176,75,.16)' : 'rgba(232,176,75,.08)', color: '#e8b04b', whiteSpace: 'nowrap', opacity: disabled ? .4 : 1 }}
      ><Glyph>☆</Glyph>Vorlage {open ? '▴' : '▾'}</button>

      {open && (
        <div
          data-testid="preset-menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 9997, width: 340,
            background: '#10111a', border: '1px solid rgba(232,176,75,.3)', borderRadius: 9,
            boxShadow: '0 12px 40px rgba(0,0,0,.6)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6,
          }}
        >
          <span style={{ ...mono, fontSize: 9, color: '#5f6e87', letterSpacing: '.1em', padding: '2px 4px' }}>VORLAGE LADEN</span>
          {presets.length === 0 && (
            <p style={{ ...mono, fontSize: 10, color: '#5f6e87', padding: '4px 4px 8px' }}>Keine Vorlagen vorhanden.</p>
          )}
          {presets.map(p => {
            const n = columnCount(p);
            const flag = flagLabel(p);
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...mono, fontSize: 11, color: '#f5cc77', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}{p.userDefined && <span style={{ color: '#5f6e87' }}> · eigene</span>}
                  </div>
                  <div style={{ ...mono, fontSize: 9, color: '#5f6e87' }}>
                    {n} {n === 1 ? 'Spalte' : 'Spalten'}{p.promptVersion ? ` · ${p.promptVersion}` : ''}{flag ? ` · ${flag}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => { onLoad(p, false); setOpen(false); }}
                  title="Spalten anhängen (noch nicht ausfüllen)"
                  style={{ ...mono, fontSize: 10, padding: '3px 9px', borderRadius: 5, cursor: 'pointer', border: '1px solid rgba(232,176,75,.35)', background: 'transparent', color: '#e8b04b', whiteSpace: 'nowrap' }}
                >Laden</button>
                <button
                  onClick={() => { onLoad(p, true); setOpen(false); }}
                  title="Spalten anhängen und sofort per KI ausfüllen (kostet API-Credits)"
                  style={{ ...mono, fontSize: 10, padding: '3px 8px', borderRadius: 5, cursor: 'pointer', border: '1px solid rgba(79,209,197,.35)', background: 'rgba(79,209,197,.07)', color: '#4fd1c5', whiteSpace: 'nowrap' }}
                >▶</button>
              </div>
            );
          })}

          {onSaveCurrent && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', marginTop: 4, paddingTop: 8 }}>
              {saving ? (
                <TemplateSaveForm
                  defaultName=""
                  hint={`${currentColumnCount} ${currentColumnCount === 1 ? 'Spalte' : 'Spalten'}`}
                  onSave={(name, flags) => { onSaveCurrent(name, flags); setSaving(false); setOpen(false); }}
                  onCancel={() => setSaving(false)}
                />
              ) : (
                <button
                  onClick={() => setSaving(true)}
                  disabled={currentColumnCount === 0}
                  title={currentColumnCount === 0 ? 'Erst KI-Spalten mit Prompt anlegen' : 'Alle KI-Spalten dieses Datensatzes als Vorlage sichern'}
                  data-testid="preset-save-current"
                  style={{ ...mono, fontSize: 10, width: '100%', padding: '5px 10px', borderRadius: 5, cursor: currentColumnCount ? 'pointer' : 'default', border: '1px dashed rgba(232,176,75,.35)', background: 'transparent', color: '#e8b04b', opacity: currentColumnCount ? 1 : .4 }}
                >☆ Aktuelle KI-Spalten als Vorlage speichern ({currentColumnCount})</button>
              )}
            </div>
          )}
          <p style={{ ...mono, fontSize: 9, color: '#5f6e87', padding: '4px 4px 0', lineHeight: 1.5 }}>
            Verwalten (Instant Load, Prompts, Löschen): Einstellungen → KI-Vorlagen
          </p>
        </div>
      )}
    </div>
  );
}
