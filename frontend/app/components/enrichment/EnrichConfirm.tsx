'use client';

import { T, mono } from '@/app/theme';
import type { EnrichAccount } from '@/app/api/enrich/account/route';
import { ENRICH_BATCH } from '@/app/hooks/useEnrichmentRun';

/** Ab dieser Menge muss die Credit-Warnung zusätzlich angehakt werden */
export const BIG_RUN = 100;

interface Props {
  leadsCount: number;
  providerLabel: string;
  account: EnrichAccount | 'loading' | null;
  wantEmail: boolean;
  wantPhone: boolean;
  mapping?: { name: string; company: string };
  ack: boolean;
  onAck: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Stufe 2 der Bestätigung: Guthaben live, Kosten je Feld, Abrechnungsregel, ab 100 Leads Häkchen */
export function EnrichConfirm({ leadsCount, providerLabel, account, wantEmail, wantPhone, mapping, ack, onAck, onCancel, onConfirm }: Props) {
  const n = leadsCount.toLocaleString('de');
  const batches = Math.ceil(leadsCount / ENRICH_BATCH);
  const acc = account && account !== 'loading' ? account : null;
  const locked = leadsCount > BIG_RUN && !ack;
  return (
    <div data-testid="enrich-confirm" style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(232,176,75,.4)', background: 'rgba(232,176,75,.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ ...mono, fontSize: 11, color: T.gold, fontWeight: 600 }}>Enrichment wirklich starten?</p>

      {/* Guthaben live vom Anbieter */}
      <div data-testid="enrich-account" style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(0,0,0,.25)', border: `1px solid ${T.lineS}` }}>
        {account === 'loading' && <p style={{ ...mono, fontSize: 10, color: T.inkF }}>↻ Guthaben bei {providerLabel} wird abgefragt…</p>}
        {acc && acc.available !== null && (() => {
          const short = acc.available < leadsCount;
          return (
            <p style={{ ...mono, fontSize: 10, color: short ? '#e8736b' : T.inkD, lineHeight: 1.6 }}>
              Guthaben bei {acc.label}: <strong style={{ color: short ? '#e8736b' : '#4fd1c5', fontSize: 12 }}>{acc.available.toLocaleString('de')} {acc.unit}</strong>
              {acc.used != null && <span style={{ color: T.inkF }}> ({acc.used.toLocaleString('de')} verbraucht{acc.planName ? `, ${acc.planName}` : ''})</span>}
              {acc.resetDate && <span style={{ color: T.inkF }}> · Reset {new Date(acc.resetDate).toLocaleDateString('de-DE')}</span>}
              {short && <><br />⚠ Reicht nicht für alle {n} Leads — der Lauf stoppt, sobald der Anbieter ablehnt; bis dahin Gefundenes bleibt gespeichert.</>}
            </p>
          );
        })()}
        {acc && acc.available === null && (
          <p style={{ ...mono, fontSize: 10, color: T.inkF }}>Guthaben bei {acc.label} konnte nicht abgefragt werden{acc.error ? ` (${acc.error})` : ''} — bitte im Anbieter-Konto prüfen.</p>
        )}
      </div>

      <ul style={{ ...mono, fontSize: 10, color: T.inkD, lineHeight: 1.7, margin: 0, paddingLeft: 16 }}>
        <li><strong style={{ color: T.ink }}>{n} Leads</strong> über {providerLabel}</li>
        {wantEmail && (
          <li>E-Mail: <strong style={{ color: '#e8736b' }}>bis zu {n} Credits</strong>
            {acc?.rule && <span style={{ color: T.inkF }}> · {acc.rule}</span>}
          </li>
        )}
        {wantPhone && (
          <li>Telefon: <strong style={{ color: '#e8736b' }}>bis zu {n} Telefon-Credits</strong>
            {acc?.phoneAvailable != null && <span style={{ color: acc.phoneAvailable < leadsCount ? '#e8736b' : '#4fd1c5' }}> · {acc.phoneAvailable.toLocaleString('de')} verfügbar</span>}
            {acc?.phoneRule && <span style={{ color: T.inkF }}> · {acc.phoneRule}</span>}
          </li>
        )}
        {mapping && <li>Name ← <strong style={{ color: T.ink }}>{mapping.name}</strong> · Firma/Domain ← <strong style={{ color: T.ink }}>{mapping.company}</strong></li>}
        <li>{batches} {batches === 1 ? 'Charge' : 'Chargen'} à {ENRICH_BATCH} Zeilen, Zwischenstand wird nach jeder Charge gespeichert; Abbruch jederzeit möglich</li>
      </ul>

      {leadsCount > BIG_RUN && (
        <label style={{ ...mono, fontSize: 10, color: ack ? T.ink : T.inkD, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
          <input type="checkbox" data-testid="enrich-ack" checked={ack} onChange={e => onAck(e.target.checked)} style={{ accentColor: '#e8b04b', width: 13, height: 13 }} />
          Ja, ich will bis zu {n} Credits verbrauchen
        </label>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onCancel}
          style={{ ...mono, flex: 1, padding: '8px 0', borderRadius: 6, cursor: 'pointer', border: `1px solid ${T.lineS}`, background: 'transparent', color: T.inkD, fontSize: 11 }}>Abbrechen</button>
        <button type="button" onClick={onConfirm} disabled={locked} data-testid="enrich-confirm-btn"
          style={{ ...mono, flex: 2, padding: '8px 0', borderRadius: 6, cursor: 'pointer', border: 'none', background: T.gold, color: '#07070a', fontSize: 11, fontWeight: 700, opacity: locked ? .4 : 1 }}>
          Ja, {n} Leads enrichen
        </button>
      </div>
    </div>
  );
}
