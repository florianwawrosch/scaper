'use client';

import { useState, useEffect } from 'react';
import { loadUsageLog, clearUsageLog, summarizeUsage, usageProviderLabel, type UsageEntry } from '@/lib/usageLog';
import { STORE_EVENT } from '@/lib/store';
import { estimateCost } from '@/lib/aiPricing';
import { ConfirmDelete } from '@/app/components/ConfirmDelete';
import { SectionLabel } from '@/app/components/SectionLabel';
import { T } from '@/app/theme';

const th: React.CSSProperties = { fontFamily: T.mono, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: T.inkF, textAlign: 'left', padding: '8px 12px', fontWeight: 500, borderBottom: `1px solid ${T.line}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { fontFamily: T.mono, fontSize: 11, color: T.inkD, padding: '8px 12px', borderBottom: `1px solid ${T.lineS}`, verticalAlign: 'middle', whiteSpace: 'nowrap' };
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

const n = (v: number) => v.toLocaleString('de');
const usd = (v: number | null) => v === null ? '–' : `${v.toLocaleString('de', { minimumFractionDigits: 2, maximumFractionDigits: v > 0 && v < 0.01 ? 4 : 2 })} $`;
const when = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const dur = (ms: number) => ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`;

/** Einstellungen → Verbrauch: Summen der letzten 30 Tage, je Modell, Protokoll aller Läufe */
export function UsageTab() {
  const [entries, setEntries] = useState<UsageEntry[]>([]);

  useEffect(() => {
    // localStorage gibt es erst im Browser — Effect statt lazy useState; der
    // gemeinsame Speicher löst ein erneutes Lesen aus (Läufe der Kollegen).
    const read = () => setEntries(loadUsageLog());
    read();
    window.addEventListener(STORE_EVENT, read);
    return () => window.removeEventListener(STORE_EVENT, read);
  }, []);

  const s = summarizeUsage(entries, 30);
  const clear = () => { clearUsageLog(); setEntries([]); };

  const card = (label: string, value: string, hint?: string) => (
    <div style={{ flex: 1, minWidth: 120, background: T.panel, border: `1px solid ${T.lineS}`, borderRadius: 8, padding: '10px 14px' }}>
      <SectionLabel style={{ marginBottom: 3 }}>{label}</SectionLabel>
      <p style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 600, color: T.ink }}>{value}</p>
      {hint && <p style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, marginTop: 2 }}>{hint}</p>}
    </div>
  );

  return (
    <>
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
            <em style={{ color: T.gold }}>Verbrauch</em>
          </h1>
          <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, marginTop: 4, lineHeight: 1.6 }}>
            Was jeder KI- und Enrichment-Lauf verarbeitet hat. Kosten sind Richtwerte aus einer Preistabelle, nicht die Abrechnung des Anbieters.
          </p>
        </div>
        {entries.length > 0 && (
          <ConfirmDelete title="Protokoll leeren" question="Protokoll für alle leeren?" onConfirm={clear}
            style={{ display: 'inline-flex', alignItems: 'center' }} />
        )}
      </div>

      <SectionLabel>Letzte 30 Tage</SectionLabel>
      <div data-testid="usage-summary" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        {card('KI-Läufe', n(s.runs), `${n(s.rows)} Zeilen`)}
        {card('Token', n(s.input + s.output), `${n(s.input)} rein · ${n(s.output)} raus`)}
        {card('≈ Kosten', usd(s.cost), s.costIncomplete ? 'ohne Modelle ohne Preis' : 'Richtwert')}
        {card('Enrichment', n(s.enrich.runs), `${n(s.enrich.rows)} Leads · ${n(s.enrich.found)} Treffer`)}
      </div>

      {s.byModel.length > 0 && (
        <>
          <SectionLabel>Je Modell (30 Tage)</SectionLabel>
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, overflow: 'hidden', background: T.panel, marginBottom: 22 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Anbieter</th><th style={th}>Modell</th>
                <th style={{ ...th, textAlign: 'right' }}>Läufe</th><th style={{ ...th, textAlign: 'right' }}>Zeilen</th>
                <th style={{ ...th, textAlign: 'right' }}>Token rein</th><th style={{ ...th, textAlign: 'right' }}>Token raus</th>
                <th style={{ ...th, textAlign: 'right' }}>≈ Kosten</th>
              </tr></thead>
              <tbody>
                {s.byModel.map(m => (
                  <tr key={`${m.provider}/${m.model}`} data-testid="usage-model">
                    <td style={td}>{usageProviderLabel(m.provider)}</td>
                    <td style={{ ...td, color: T.ink }}>{m.model || '–'}</td>
                    <td style={num}>{n(m.runs)}</td><td style={num}>{n(m.rows)}</td>
                    <td style={num}>{n(m.input)}</td><td style={num}>{n(m.output)}</td>
                    <td style={{ ...num, color: T.gold }}>{usd(m.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionLabel>Protokoll</SectionLabel>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, overflow: 'hidden', background: T.panel }}>
        {entries.length === 0 ? (
          <p data-testid="usage-empty" style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF, padding: '18px 14px', textAlign: 'center' }}>
            Noch keine Läufe protokolliert — der erste KI- oder Enrichment-Lauf erscheint hier.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Wann</th><th style={th}>Datensatz</th><th style={th}>Spalte / Felder</th><th style={th}>Modell</th>
                <th style={{ ...th, textAlign: 'right' }}>Zeilen</th><th style={{ ...th, textAlign: 'right' }}>Token rein</th>
                <th style={{ ...th, textAlign: 'right' }}>Token raus</th><th style={{ ...th, textAlign: 'right' }}>≈ Kosten</th>
                <th style={{ ...th, textAlign: 'right' }}>Dauer</th>
              </tr></thead>
              <tbody>
                {entries.slice(0, 200).map(e => (
                  <tr key={e.id} data-testid="usage-row">
                    <td style={td}>{when(e.at)}</td>
                    <td style={{ ...td, color: T.ink, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.dataset}>{e.dataset || '–'}</td>
                    <td style={td}>{e.what}{e.failed ? <span style={{ color: '#e8b04b' }}> · {n(e.failed)} Fehler</span> : null}</td>
                    <td style={td}>{usageProviderLabel(e.provider)}{e.model ? ` · ${e.model}` : ''}</td>
                    <td style={num}>{n(e.rows)}{e.kind === 'enrich' && e.found !== undefined ? <span style={{ color: T.inkF }}> · {n(e.found)} Treffer</span> : null}</td>
                    <td style={num}>{e.input !== undefined ? n(e.input) : '–'}</td>
                    <td style={num}>{e.output !== undefined ? n(e.output) : '–'}</td>
                    <td style={{ ...num, color: T.gold }}>{e.kind === 'ai' ? usd(estimateCost(e.model, e.input ?? 0, e.output ?? 0)) : '–'}</td>
                    <td style={num}>{dur(e.ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
