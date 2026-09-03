'use client';

import { T, mono } from '@/app/theme';

export interface MappingRow {
  key: string;
  label: string;
  hint: string;
  /** Effektiver Wert (Auswahl oder Vorschlag) */
  value: string;
  suggested: string;
  /** Explizite Nutzerwahl ('' = Vorschlag gilt) */
  chosen: string;
  set: (v: string) => void;
}

interface Props {
  rows: MappingRow[];
  availableColumns: string[];
  sample: (col: string) => string;
}

/** Tabelle «Feld | Spalte im Datensatz» — immer vorbelegt, mit Beispielwert */
export function ColumnMapping({ rows, availableColumns, sample }: Props) {
  return (
    <div>
      <p style={{ ...mono, fontSize: 9, letterSpacing: '.1em', color: T.inkF, textTransform: 'uppercase', marginBottom: 8 }}>Spalten-Zuordnung</p>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 7, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', background: 'rgba(255,255,255,.03)', borderBottom: `1px solid ${T.line}` }}>
          <span style={{ ...mono, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: T.inkF, padding: '6px 10px' }}>Feld</span>
          <span style={{ ...mono, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: T.inkF, padding: '6px 10px' }}>Spalte im Datensatz</span>
        </div>
        {rows.map(({ key, label, value, suggested, chosen, set, hint }) => {
          const isSuggestion = !chosen && !!suggested;
          const ex = sample(value);
          return (
            <div key={key} data-testid={`map-${key}`} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', borderBottom: `1px solid ${T.lineS}` }}>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ ...mono, fontSize: 11, color: T.inkD }}>{label}</div>
                <div style={{ ...mono, fontSize: 9, color: T.inkF, opacity: .7 }}>{hint}</div>
              </div>
              <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <select
                    value={value}
                    onChange={e => set(e.target.value)}
                    style={{ ...mono, flex: 1, fontSize: 11, background: 'rgba(255,255,255,.04)', border: `1px solid ${value ? T.line : 'rgba(232,115,107,.4)'}`, borderRadius: 5, color: value ? T.ink : T.inkF, padding: '5px 8px', outline: 'none', minWidth: 0 }}
                  >
                    <option value="">— wählen —</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {isSuggestion && (
                    <span title="Automatisch anhand des Spaltennamens vorgeschlagen" style={{ ...mono, fontSize: 8, letterSpacing: '.08em', padding: '2px 6px', borderRadius: 3, background: 'rgba(79,209,197,.08)', border: '1px solid rgba(79,209,197,.25)', color: '#4fd1c5', flexShrink: 0 }}>vorgeschlagen</span>
                  )}
                  {chosen && suggested && chosen !== suggested && (
                    <button type="button" onClick={() => set('')} title={`Vorschlag «${suggested}» übernehmen`}
                      style={{ ...mono, fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'transparent', border: `1px solid ${T.lineS}`, color: T.inkF, cursor: 'pointer', flexShrink: 0 }}>↺</button>
                  )}
                </div>
                <span style={{ ...mono, fontSize: 9, color: value ? T.inkF : '#e8736b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {value ? (ex ? `Beispiel: ${ex}` : 'Spalte ist in den offenen Zeilen leer') : 'Keine passende Spalte erkannt — bitte wählen'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
