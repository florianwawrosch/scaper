'use client';

import { useState, useEffect } from 'react';
import { loadBlocklist, addBlockInput, removeFromBlocklist, fanpageUrl, adsLibraryUrl, parseBlockInput, type BlockEntry } from '@/lib/blocklist';
import { ConfirmDelete } from '@/app/components/ConfirmDelete';
import { T } from '@/app/theme';

interface Props {
  /** Anzahl geblockter Seiten (Badge in der Navigation) */
  onCountChange?: (n: number) => void;
}

const th: React.CSSProperties = { fontFamily: T.mono, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: T.inkF, textAlign: 'left', padding: '8px 12px', fontWeight: 500, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { fontFamily: T.mono, fontSize: 11, color: T.inkD, padding: '9px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' };
const link: React.CSSProperties = { fontFamily: T.mono, fontSize: 10, color: T.teal, textDecoration: 'none', border: `1px solid ${T.tealB}`, background: T.tealD, borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' };

/** Einstellungen → Blockliste: Seiten, die aus allen Scrape-Ergebnissen fliegen */
export function BlocklistTab({ onCountChange }: Props) {
  const [blocklist, setBlocklist] = useState<BlockEntry[]>([]);
  const [input,     setInput]     = useState('');

  useEffect(() => {
    // localStorage gibt es erst im Browser — daher Effect statt lazy useState
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlocklist(loadBlocklist());
  }, []);
  useEffect(() => { onCountChange?.(blocklist.length); }, [blocklist.length, onCountChange]);

  const parsed = parseBlockInput(input);
  const add = () => {
    const next = addBlockInput(input);
    if (next) { setBlocklist(next); setInput(''); }
  };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
          Block<em style={{ color: T.gold }}>liste</em>
        </h1>
        <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkD, marginTop: 4, lineHeight: 1.6 }}>
          Seiten, die aus allen Scrape-Ergebnissen fliegen. Zuverlässig blockt die <strong style={{ color: T.ink }}>Page-ID</strong> —
          Fanpage-Link, Ads-Library-Link oder ID eintragen. Ein Seitenname allein greift nur bei exakt gleicher Schreibweise.
          Am einfachsten direkt aus der Ergebnistabelle: Zeilen abwählen und «Seiten blocken» klicken (nimmt die ID mit).
        </p>
      </div>

      {/* Add entry */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="Fanpage-Link, Ads-Library-Link, Page-ID oder Seitenname"
          data-testid="block-input"
          style={{ flex: 1, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 6, padding: '9px 12px', fontFamily: T.mono, fontSize: 12, color: T.ink, outline: 'none' }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!parsed}
          data-testid="block-add"
          style={{
            fontFamily: T.mono, fontSize: 12, fontWeight: 600, padding: '9px 18px', borderRadius: 6, cursor: parsed ? 'pointer' : 'default',
            border: 'none', background: parsed ? T.gold : T.panel2, color: parsed ? '#07070a' : T.inkF,
          }}
        >+ Blocken</button>
      </div>
      <p data-testid="block-preview" style={{ fontFamily: T.mono, fontSize: 10, color: parsed?.pageId ? T.teal : T.inkF, minHeight: 14, marginBottom: 18 }}>
        {input.trim() === '' ? 'Beispiele: facebook.com/123456789 · facebook.com/ads/library/?…view_all_page_id=123456789 · 123456789'
          : !parsed ? 'Aus diesem Link lässt sich keine Seite erkennen.'
          : parsed.pageId ? `Blockt Page-ID ${parsed.pageId} — trifft sicher, auch wenn die Seite umbenannt wird.`
          : `Blockt nur den Seitennamen «${parsed.pageName}» (exakte Schreibweise). Besser: Link oder ID.`}
      </p>

      {/* Tabelle */}
      {blocklist.length === 0 ? (
        <div style={{ padding: '36px 24px', textAlign: 'center', border: `1px dashed ${T.line}`, borderRadius: 10, background: T.panel }}>
          <p style={{ fontFamily: T.mono, fontSize: 12, color: T.inkD }}>Noch keine Seiten geblockt.</p>
          <p style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF, marginTop: 6 }}>Oben einen Link eintragen oder aus der Ergebnistabelle blocken.</p>
        </div>
      ) : (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'auto' }}>
          <table data-testid="block-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.panel, borderBottom: `1px solid ${T.line}` }}>
                <th style={th}>Seite</th>
                <th style={th}>Fanpage</th>
                <th style={th}>Ads Library</th>
                <th style={th}>Geblockt seit</th>
                <th style={{ ...th, textAlign: 'right' }}>{blocklist.length}</th>
              </tr>
            </thead>
            <tbody>
              {blocklist.map((e, i) => {
                const fp = fanpageUrl(e);
                return (
                  <tr key={`${e.pageName}:${e.pageId ?? ''}`} data-testid="block-row" style={{ background: i % 2 ? 'transparent' : 'rgba(255,255,255,.015)', borderBottom: i < blocklist.length - 1 ? `1px solid ${T.lineS}` : 'none' }}>
                    <td style={{ ...td, color: T.ink, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.pageId ? `Page-ID ${e.pageId}` : 'Nur Namensabgleich — ohne ID greift die Sperre nur bei exakt gleichem Namen'}>
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#e8736b', marginRight: 8, verticalAlign: 'middle' }} />
                      {e.pageName}{!e.pageId && <span style={{ fontSize: 9, color: T.inkF, marginLeft: 8 }}>nur Name</span>}
                    </td>
                    <td style={td}>{fp ? <a href={fp} target="_blank" rel="noopener noreferrer" style={link}>↗ Fanpage</a> : <span style={{ color: T.inkF }}>—</span>}</td>
                    <td style={td}>{e.pageId ? <a href={adsLibraryUrl(e.pageId)} target="_blank" rel="noopener noreferrer" style={link}>↗ Anzeigen</a> : <span style={{ color: T.inkF }}>—</span>}</td>
                    <td style={{ ...td, fontSize: 10, color: T.inkF }}>{e.addedAt ? new Date(e.addedAt).toLocaleDateString('de-DE') : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <ConfirmDelete title="Von Blockliste entfernen" question="Entfernen?" onConfirm={() => setBlocklist(removeFromBlocklist(e.pageName))} style={{ display: 'inline-flex', alignItems: 'center' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
