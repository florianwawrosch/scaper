'use client';

import type { CsvRunSummary } from '@/lib/csvRuns';
import { ConfirmDelete } from './ConfirmDelete';
import { T } from '@/app/theme';

interface Props {
  runs: CsvRunSummary[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onAll: () => void;
  /** Wie viele Einträge (neueste zuerst) */
  limit?: number;
}

const fmt = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** Startseite rechts: die letzten Datensätze (Scrapes + Importe), Klick öffnet, × löscht zweistufig */
export function HistoryPanel({ runs, onOpen, onDelete, onAll, limit = 12 }: Props) {
  return (
    <div style={{ position: 'sticky', top: 20 }}>
      <div style={{ background: T.panel, border: `1px solid ${T.lineS}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${T.lineS}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: T.ffMono, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: T.inkF }}>Verlauf</span>
          <button onClick={onAll} style={{ fontFamily: T.ffMono, fontSize: 10, color: T.gold, background: 'none', border: 'none', cursor: 'pointer' }}>Alle Runs →</button>
        </div>
        {runs.length === 0 ? (
          <div style={{ padding: '20px 14px', textAlign: 'center' }}>
            <p style={{ fontFamily: T.ffBody, fontSize: 13, color: T.inkF }}>Noch keine Importe</p>
          </div>
        ) : runs.slice(0, limit).map(run => (
          <div key={run.id} style={{ borderBottom: `1px solid ${T.lineS}`, display: 'flex', alignItems: 'stretch' }}>
            <button
              onClick={() => onOpen(run.id)}
              style={{ flex: 1, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.filename}</p>
                <p style={{ fontFamily: T.ffMono, fontSize: 9, color: T.inkF, marginTop: 1 }}>{fmt(run.createdAt)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <span style={{ fontFamily: T.ffMono, fontSize: 9, color: T.inkF }}>{run.rowCount.toLocaleString('de')} Z</span>
                {run.isScrape ? (
                  <span style={{ fontFamily: T.ffMono, fontSize: 8, letterSpacing: '.08em', padding: '1px 5px', borderRadius: 3, background: 'rgba(232,176,75,.1)', border: '1px solid rgba(232,176,75,.25)', color: '#e8b04b' }}>Scrape</span>
                ) : (
                  <span style={{ fontFamily: T.ffMono, fontSize: 8, letterSpacing: '.08em', padding: '1px 5px', borderRadius: 3, background: 'rgba(99,129,255,.1)', border: '1px solid rgba(99,129,255,.2)', color: '#6381ff' }}>CSV</span>
                )}
              </div>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', borderLeft: `1px solid ${T.lineS}` }}>
              <ConfirmDelete onConfirm={() => onDelete(run.id)} title="Eintrag löschen" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
