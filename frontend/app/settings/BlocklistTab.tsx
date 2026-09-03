'use client';

import { useState, useEffect } from 'react';
import { loadBlocklist, addToBlocklist, removeFromBlocklist, type BlockEntry } from '@/lib/blocklist';
import { T } from '@/app/theme';

interface Props {
  /** Anzahl geblockter Seiten (Badge in der Navigation) */
  onCountChange?: (n: number) => void;
}

/** Einstellungen → Blockliste: Seiten, die aus allen Scrape-Ergebnissen fliegen */
export function BlocklistTab({ onCountChange }: Props) {
  const [blocklist,  setBlocklist]  = useState<BlockEntry[]>([]);
  const [blockInput, setBlockInput] = useState('');

  useEffect(() => {
    // localStorage gibt es erst im Browser — daher Effect statt lazy useState
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlocklist(loadBlocklist());
  }, []);
  useEffect(() => { onCountChange?.(blocklist.length); }, [blocklist.length, onCountChange]);

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
          Block<em style={{ color: T.gold }}>liste</em>
        </h1>
        <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkD, marginTop: 4, lineHeight: 1.6 }}>
          Seiten, die grundsätzlich aus Scrape-Ergebnissen ausgeschlossen werden.
          Hinzufügen auch direkt aus der Ergebnistabelle: Zeilen abwählen und oben
          «Seiten blocken» klicken.
        </p>
      </div>

      {/* Add entry */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input
          type="text" value={blockInput}
          onChange={e => setBlockInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && blockInput.trim()) {
              setBlocklist(addToBlocklist(blockInput));
              setBlockInput('');
            }
          }}
          placeholder="Seitenname, z.B. «Fitness Coach Max»"
          style={{ flex: 1, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 6, padding: '9px 12px', fontFamily: T.mono, fontSize: 12, color: T.ink, outline: 'none' }}
        />
        <button
          type="button"
          onClick={() => { if (blockInput.trim()) { setBlocklist(addToBlocklist(blockInput)); setBlockInput(''); } }}
          disabled={!blockInput.trim()}
          style={{
            fontFamily: T.mono, fontSize: 12, fontWeight: 600, padding: '9px 18px', borderRadius: 6, cursor: blockInput.trim() ? 'pointer' : 'default',
            border: 'none',
            background: blockInput.trim() ? T.gold : T.panel2,
            color: blockInput.trim() ? '#07070a' : T.inkF,
          }}
        >+ Blocken</button>
      </div>

      {/* List */}
      {blocklist.length === 0 ? (
        <div style={{ padding: '36px 24px', textAlign: 'center', border: `1px dashed ${T.line}`, borderRadius: 10, background: T.panel }}>
          <p style={{ fontFamily: T.mono, fontSize: 12, color: T.inkD }}>Noch keine Seiten geblockt.</p>
          <p style={{ fontFamily: T.mono, fontSize: 10, color: T.inkF, marginTop: 6 }}>Oben einen Seitennamen eintragen oder aus der Ergebnistabelle blocken.</p>
        </div>
      ) : (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', background: T.panel, borderBottom: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: T.inkF }}>Geblockte Seiten</span>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.gold }}>{blocklist.length}</span>
          </div>
          {blocklist.map((e, i) => (
            <div key={e.pageName} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: i % 2 ? 'transparent' : 'rgba(255,255,255,.015)', borderBottom: i < blocklist.length - 1 ? `1px solid ${T.lineS}` : 'none' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e8736b', flexShrink: 0 }} />
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.pageName}
              </span>
              {e.pageId && (
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF }}>ID {e.pageId}</span>
              )}
              <button
                type="button"
                onClick={() => setBlocklist(removeFromBlocklist(e.pageName))}
                title="Von Blockliste entfernen"
                style={{ fontFamily: T.mono, fontSize: 15, color: T.inkD, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                onMouseEnter={ev => ((ev.currentTarget as HTMLElement).style.color = '#e8736b')}
                onMouseLeave={ev => ((ev.currentTarget as HTMLElement).style.color = T.inkD)}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
