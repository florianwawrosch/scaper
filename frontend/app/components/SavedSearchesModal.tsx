'use client';

import type { SavedSearch } from '@/lib/savedSearches';
import { ConfirmDelete } from './ConfirmDelete';
import { T } from '@/app/theme';

interface Props {
  searches: Record<string, SavedSearch>;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
  onClose: () => void;
}

/** Overlay mit den gespeicherten Suchen der Scrape-Maske: laden oder löschen */
export function SavedSearchesModal({ searches, onLoad, onDelete, onClose }: Props) {
  return (
    <div
      onClick={() => onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 9980, background: 'rgba(7,7,10,.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,.5)', width: '100%', maxWidth: 540, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${T.lineS}` }}>
          <p style={{ fontFamily: T.ffMono, fontSize: 12, fontWeight: 600, color: T.ink }}>Gespeicherte Suchen</p>
          <button onClick={() => onClose()} style={{ fontFamily: T.ffMono, fontSize: 16, color: T.inkF, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 0' }}>
          {Object.keys(searches).length === 0 ? (
            <p style={{ padding: '24px 18px', textAlign: 'center', fontFamily: T.ffMono, fontSize: 12, color: T.inkF }}>
              Noch keine Suchen gespeichert.<br />
              <span style={{ fontSize: 11, opacity: .6 }}>Filter setzen, benennen und „Speichern“ klicken.</span>
            </p>
          ) : (
            Object.entries(searches).map(([name, p]) => {
              const kws: string[] = p.keywords ?? [];
              const plats: string[] = p.platforms ?? [];
              const c: string = p.country ?? p.countries?.[0] ?? '—';
              const savedAt = p.savedAt ? new Date(p.savedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
              return (
                <div key={name} style={{ padding: '12px 18px', borderBottom: `1px solid ${T.lineS}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <div>
                      <p style={{ fontFamily: T.ffMono, fontSize: 13, fontWeight: 600, color: T.ink }}>{name}</p>
                      {savedAt && <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF, marginTop: 1 }}>gespeichert am {savedAt}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => onLoad(name)}
                        style={{ fontFamily: T.ffMono, fontSize: 11, padding: '4px 14px', borderRadius: 5, background: T.gold, border: 'none', color: '#07070a', fontWeight: 600, cursor: 'pointer' }}
                      >Laden</button>
                      <ConfirmDelete onConfirm={() => onDelete(name)} title="Suche löschen" style={{ display: 'flex', alignItems: 'center' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    <span style={{ fontFamily: T.ffMono, fontSize: 10, padding: '2px 7px', borderRadius: 3, background: T.panel2, border: `1px solid ${T.lineS}`, color: T.inkD }}>{c === 'ALL' ? 'Alle Länder' : c}</span>
                    {plats.map(pl => <span key={pl} style={{ fontFamily: T.ffMono, fontSize: 10, padding: '2px 7px', borderRadius: 3, background: T.panel2, border: `1px solid ${T.lineS}`, color: T.inkD }}>{pl}</span>)}
                    {p.adStatus && <span style={{ fontFamily: T.ffMono, fontSize: 10, padding: '2px 7px', borderRadius: 3, background: T.panel2, border: `1px solid ${T.lineS}`, color: T.inkD }}>Status: {p.adStatus}</span>}
                    {kws.slice(0, 4).map((kw: string) => (
                      <span key={kw} style={{ fontFamily: T.ffMono, fontSize: 10, padding: '2px 7px', borderRadius: 3, background: T.goldD, border: `1px solid ${T.line}`, color: T.gold }}>🔍 {kw}</span>
                    ))}
                    {kws.length > 4 && <span style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF }}>+{kws.length - 4} weitere</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
