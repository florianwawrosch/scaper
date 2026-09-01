'use client';

import { useState } from 'react';
import type { ImportPreset } from '@/lib/aiTemplates';

const T = {
  bg:    'var(--th-bg)',
  panel: 'var(--th-panel)',
  line:  'var(--th-line)',
  lineS: 'var(--th-line-soft)',
  gold:  'var(--th-gold)',
  ink:   'var(--th-ink)',
  inkD:  'var(--th-ink-d)',
  inkF:  'var(--th-ink-f)',
  teal:  'var(--th-teal)',
  ffMono: 'var(--ff-mono)',
  ffDisp: 'var(--ff-disp)',
};

interface Props {
  presets: ImportPreset[];
  onSelect: (presetId: string | null) => void;
  onClose: () => void;
  filename: string;
}

export function PresetSelector({ presets, onSelect, onClose, filename }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    onSelect(selectedId);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: T.panel,
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          padding: '24px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontFamily: T.ffDisp, fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 8 }}>
          KI-Spalten laden
        </h2>
        <p style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkF, marginBottom: 20 }}>
          Wähle eine Vorlage für <strong>{filename}</strong> oder importiere ohne Vorlage.
        </p>

        {/* Presets list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {presets.map(preset => {
            const colCount  = preset.columns.reduce((n, c) => n + (c.outputFields?.length ?? 1) + (c.derived?.length ?? 0), 0);
            const callCount = preset.columns.length;
            return (
            <button
              key={preset.id}
              onClick={() => setSelectedId(selectedId === preset.id ? null : preset.id)}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                border: selectedId === preset.id ? `2px solid ${T.gold}` : `1px solid ${T.lineS}`,
                borderRadius: 8,
                background: selectedId === preset.id ? 'rgba(232,176,75,.08)' : 'transparent',
                color: T.inkD,
                cursor: 'pointer',
                transition: 'all .2s',
              }}
              onMouseEnter={e => {
                if (selectedId !== preset.id) {
                  (e.currentTarget as HTMLElement).style.borderColor = T.lineS;
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)';
                }
              }}
              onMouseLeave={e => {
                if (selectedId !== preset.id) {
                  (e.currentTarget as HTMLElement).style.borderColor = T.lineS;
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              <div style={{ fontFamily: T.ffDisp, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {preset.name}
              </div>
              {preset.description && (
                <div style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF, marginBottom: 6 }}>
                  {preset.description}
                </div>
              )}
              <div style={{ fontFamily: T.ffMono, fontSize: 9, color: T.inkF, opacity: 0.7 }}>
                {colCount} {colCount === 1 ? 'Spalte' : 'Spalten'} · {callCount} KI-{callCount === 1 ? 'Aufruf' : 'Aufrufe'} pro Zeile{preset.promptVersion ? ` · Prompt ${preset.promptVersion}` : ''}
              </div>

              {/* Expandable column details */}
              {selectedId === preset.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.lineS}` }}>
                  {preset.columns.map((col, idx) => (
                    <div key={idx} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: idx < preset.columns.length - 1 ? `1px solid ${T.lineS}` : 'none' }}>
                      <div style={{ fontFamily: T.ffMono, fontSize: 10, fontWeight: 600, color: T.teal, marginBottom: 4 }}>
                        {col.name}
                        {col.outputFields && (
                          <span style={{ color: T.inkF, fontWeight: 400 }}> → {col.outputFields.join(', ')}</span>
                        )}
                      </div>
                      <div style={{ fontFamily: T.ffMono, fontSize: 9, color: T.inkF, lineHeight: 1.5, marginBottom: 4, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                        {col.prompt.length > 600 ? col.prompt.slice(0, 600) + '…' : col.prompt}
                      </div>
                      {col.derived?.map(d => (
                        <div key={d.name} style={{ fontFamily: T.ffMono, fontSize: 8, color: T.inkF, opacity: 0.7 }}>
                          + Regel-Spalte «{d.name}» (aus KI-Ausgaben berechnet, kein KI-Aufruf)
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              fontFamily: T.ffMono,
              fontSize: 11,
              padding: '7px 16px',
              borderRadius: 6,
              border: `1px solid ${T.lineS}`,
              background: 'transparent',
              color: T.inkD,
              cursor: 'pointer',
            }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            style={{
              fontFamily: T.ffMono,
              fontSize: 11,
              padding: '7px 16px',
              borderRadius: 6,
              border: `1px solid ${T.gold}`,
              background: 'rgba(232,176,75,.15)',
              color: T.gold,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {selectedId ? 'Vorlage laden' : 'Ohne Vorlage'}
          </button>
        </div>
      </div>
    </div>
  );
}
