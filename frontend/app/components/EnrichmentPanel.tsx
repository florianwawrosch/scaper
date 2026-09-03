'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getApiKey, loadSettings } from '@/lib/settings';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { useToast } from './Toast';
import { Glyph } from './Glyph';
import type { EnrichAccount } from '@/app/api/enrich/account/route';

export interface EnrichFields { email: boolean; phone: boolean }
export interface EnrichResult { email: string; phone: string; enriched: boolean }
import { T, mono } from '@/app/theme';

interface Props {
  leadsCount: number;
  onEnrichmentComplete?: () => void;
  /** For CSV imports: pick which columns hold name + company */
  availableColumns?: string[];
  /**
   * Nach JEDER Charge mit allen bisherigen Ergebnissen (Index = Zeile in `rows`)
   * aufgerufen, damit der Aufrufer zwischenspeichern kann — Abbruch oder Reload
   * verliert so keine bereits bezahlten Lookups.
   */
  onEmailColumn?: (values: EnrichResult[]) => void | Promise<void>;
  /** Was geholt wird (E-Mail und/oder Telefon) — der Aufrufer filtert damit die offenen Zeilen */
  fields: EnrichFields;
  onFieldsChange: (f: EnrichFields) => void;
  /** Zeilen, die enricht werden (Enrichment läuft über die Vercel-Route /api/enrich) */
  rows: Record<string, string>[];
}

type ProviderStatus = 'idle' | 'running' | 'done' | 'error';

const ALL_PROVIDERS = [
  { id: 'hunter_io', label: 'Hunter.io', desc: 'E-Mail Finder',             phone: false },
  { id: 'findymail', label: 'FindyMail', desc: 'E-Mail + Telefon (LinkedIn)', phone: true },
] as const;

export function EnrichmentPanel({ leadsCount, onEnrichmentComplete, availableColumns, onEmailColumn, rows, fields, onFieldsChange }: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [status, setStatus] = useState<Record<string, ProviderStatus>>({});
  const [result, setResult] = useState<{ enriched: number; total: number } | null>(null);
  const [nameCol,     setNameCol]     = useState('');
  const [companyCol,  setCompanyCol]  = useState('');
  const [linkedinCol, setLinkedinCol] = useState('');
  const [available,  setAvailable]  = useState<Record<string, boolean>>({});
  const [keysReady,  setKeysReady]  = useState(false);
  const [progress,   setProgress]   = useState<{ done: number; total: number; enriched: number } | null>(null);
  // Zweistufige Bestätigung: Start → Zusammenfassung mit Credit-Schätzung → Ja
  const [confirming, setConfirming] = useState(false);
  const [ackCredits, setAckCredits] = useState(false);
  const [account,    setAccount]    = useState<EnrichAccount | 'loading' | null>(null);
  const stopRef  = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchKeyAvailability().then(server => {
      const local = loadSettings().apiKeys as Record<string, string>;
      const merged: Record<string, boolean> = {};
      for (const p of ALL_PROVIDERS) merged[p.id] = !!local[p.id] || !!server[p.id];
      setAvailable(merged);
      setKeysReady(true);
      // Preselect the first configured provider
      const first = ALL_PROVIDERS.find(p => merged[p.id]);
      if (first) setSelected(prev => prev && merged[prev] ? prev : first.id);
    });
  }, []);

  // Auto-select common column names (e.g. LinkedIn imports use voller_name/firma)
  // so the mapping doesn't have to be picked by hand on every visit. Derived,
  // not synced into state: nameCol/companyCol hold only an explicit user choice
  // ('' = none), the effective value falls back to the auto-pick.
  const pickCol = (candidates: string[]) => {
    const cols = availableColumns ?? [];
    const lower = cols.map(c => c.toLowerCase());
    // exakter Treffer vor Teil-Treffer, Reihenfolge der Kandidaten = Priorität
    for (const cand of candidates) { const i = lower.indexOf(cand); if (i >= 0) return cols[i]; }
    for (const cand of candidates) { const i = lower.findIndex(c => c.includes(cand)); if (i >= 0) return cols[i]; }
    return '';
  };
  const NAME_CANDIDATES    = ['voller_name', 'name', 'full_name', 'vollername', 'vorname_nachname', 'kontakt', 'ansprechpartner', 'person', 'page_name', 'first_name', 'vorname'];
  const COMPANY_CANDIDATES = ['firma', 'company', 'unternehmen', 'company_domain', 'domain', 'website', 'webseite', 'url', 'page_name', 'organisation', 'organization'];
  const LINKEDIN_CANDIDATES = ['linkedin_url', 'linkedin', 'profil_url', 'profile_url', 'linkedin_profile', 'url'];
  const suggestedName     = pickCol(NAME_CANDIDATES);
  const suggestedCompany  = pickCol(COMPANY_CANDIDATES);
  const suggestedLinkedin = pickCol(LINKEDIN_CANDIDATES);
  const effNameCol     = nameCol     || suggestedName;
  const effCompanyCol  = companyCol  || suggestedCompany;
  const effLinkedinCol = linkedinCol || suggestedLinkedin;
  const providerCanPhone = !!ALL_PROVIDERS.find(p => p.id === selected)?.phone;
  const wantPhone = fields.phone && providerCanPhone;
  const wantEmail = fields.email || !wantPhone; // nie «nichts» — ohne Telefon immer E-Mail
  /** Erster nicht-leerer Wert einer Spalte als Beispiel neben dem Dropdown */
  const sample = (col: string) => {
    if (!col) return '';
    const hit = rows.find(r => String(r[col] ?? '').trim());
    return hit ? String(hit[col]).trim() : '';
  };

  // Only show providers that are actually configured (browser key or server env)
  const PROVIDERS = ALL_PROVIDERS.filter(p => available[p.id]);

  const needsMapping = !!availableColumns?.length;

  /** Stufe 1: prüfen und die Zusammenfassung mit Credit-Schätzung zeigen */
  const requestStart = () => {
    if (!selected) return showToast('Kein Enrichment-Provider konfiguriert', 'warning');
    if (leadsCount === 0) return showToast('Keine Leads zum Enrichment', 'warning');
    if (needsMapping && wantEmail && (!effNameCol || !effCompanyCol)) {
      return showToast('Bitte Name- und Firmen-Spalte auswählen', 'warning');
    }
    if (needsMapping && wantPhone && !effLinkedinCol) {
      return showToast('Für Telefonnummern die LinkedIn-URL-Spalte auswählen', 'warning');
    }
    setAckCredits(false);
    setConfirming(true);
    // Guthaben + Abrechnungsregel des Anbieters für die Zusammenfassung holen
    setAccount('loading');
    const apiKey = getApiKey(selected);
    fetch('/api/enrich/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: selected, ...(apiKey && { apiKey }) }),
    })
      .then(r => r.json())
      .then((a: EnrichAccount) => setAccount(a))
      .catch(() => setAccount({ provider: selected, label: providerLabelOf(selected), available: null, unit: 'Credits', rule: '', chargedOnlyOnHit: false, error: 'Abfrage fehlgeschlagen' }));
  };

  // Ab dieser Menge muss die Credit-Warnung zusätzlich angehakt werden
  const BIG_RUN = 100;
  const providerLabelOf = (id: string) => ALL_PROVIDERS.find(p => p.id === id)?.label ?? id;

  /** Stufe 2: bestätigt — alle Chargen laufen durch */
  const start = async () => {
    setConfirming(false);
    if (!selected) return;
    // Key from browser settings if present — otherwise the server reads
    // it from its env vars, so don't block when it's missing locally.
    const apiKey = getApiKey(selected);

    setRunning(true);
    stopRef.current = false;
    setStatus(p => ({ ...p, [selected]: 'running' }));
    setResult(null);

    // Der Server verarbeitet max. 50 Zeilen pro Aufruf (Kosten-Schutz);
    // hier laufen alle Chargen nacheinander durch, mit Zwischenspeicherung.
    const BATCH = 50;
    const all: EnrichResult[] = [];
    let enrichedTotal = 0;
    let emailsTotal = 0, phonesTotal = 0;
    let processed = 0;
    let firstError: string | null = null;
    setProgress({ done: 0, total: rows.length, enriched: 0 });

    try {
      for (let off = 0; off < rows.length && !stopRef.current; off += BATCH) {
        const batch = rows.slice(off, off + BATCH);
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const res = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: selected,
            rows: batch,
            nameColumn: effNameCol,
            companyColumn: effCompanyCol,
            linkedinColumn: effLinkedinCol,
            fields: [...(wantEmail ? ['email'] : []), ...(wantPhone ? ['phone'] : [])],
            ...(apiKey && { apiKey }),
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          let msg = await res.text();
          try { msg = JSON.parse(msg).detail ?? msg; } catch {}
          throw new Error(msg);
        }
        const data = await res.json();
        const results: EnrichResult[] = (data.results ?? []).map((r: Partial<EnrichResult>) => ({ email: r.email ?? '', phone: r.phone ?? '', enriched: !!r.enriched }));
        all.push(...results);
        enrichedTotal += Number(data.enriched) || 0;
        emailsTotal += Number(data.emails) || 0;
        phonesTotal += Number(data.phones) || 0;
        processed += batch.length;
        if (data.error && !firstError) firstError = data.error;
        setProgress({ done: processed, total: rows.length, enriched: enrichedTotal });
        await onEmailColumn?.([...all]);
      }
      const stopped = processed < rows.length;
      setResult({ enriched: enrichedTotal, total: processed });
      setStatus(p => ({ ...p, [selected]: enrichedTotal === 0 && firstError ? 'error' : 'done' }));
      const found = [wantEmail && `${emailsTotal} E-Mails`, wantPhone && `${phonesTotal} Telefonnummern`].filter(Boolean).join(', ');
      showToast(`${found} gefunden bei ${processed} Leads${stopped ? ' — abgebrochen, Rest beim nächsten Start' : ''}`, 'success');
      if (firstError) showToast(`Teilweise Fehler: ${firstError}`, 'warning', 6000);
      onEnrichmentComplete?.();
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      if (processed > 0) setResult({ enriched: enrichedTotal, total: processed });
      setStatus(p => ({ ...p, [selected]: aborted ? 'done' : 'error' }));
      showToast(
        aborted
          ? `Abgebrochen — ${enrichedTotal} von ${processed} Leads gespeichert, Rest beim nächsten Start`
          : `${e instanceof Error ? e.message : 'Fehler'}${processed > 0 ? ` — ${processed} Zeilen bereits gespeichert` : ''}`,
        aborted ? 'info' : 'error', 8000,
      );
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  };

  /** Läuft zu Ende, was gerade unterwegs ist? Nein: der aktuelle Request wird abgebrochen. */
  const stop = () => {
    stopRef.current = true;
    abortRef.current?.abort();
  };

  const statusIcon = (s?: ProviderStatus) =>
    ({ idle: null, running: '↻', done: '✓', error: '✕' }[s ?? 'idle']);

  const statusColor = (s?: ProviderStatus) =>
    ({ idle: T.inkF, running: '#e8b04b', done: '#4fd1c5', error: '#e8736b' }[s ?? 'idle']);

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.line}`, background: T.panel, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ ...mono, fontSize: 10, letterSpacing: '.1em', color: T.inkF, textTransform: 'uppercase' }}>Enrichment</span>
        <span data-testid="lead-count" style={{ ...mono, fontSize: 13, color: T.ink, marginLeft: 'auto' }}>
          <strong style={{ color: T.gold, fontSize: 16 }}>{leadsCount.toLocaleString('de')}</strong> Leads {leadsCount === 1 ? 'wird' : 'werden'} angereichert
        </span>
      </div>

      <div style={{ padding: '16px', background: T.panel2, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* No provider configured */}
        {keysReady && PROVIDERS.length === 0 && (
          <div style={{ padding: '14px 16px', border: '1px dashed rgba(255,255,255,.09)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ ...mono, fontSize: 11, color: T.inkF }}>Kein Enrichment-Provider konfiguriert. Hunter.io- oder FindyMail-Key in den Einstellungen bzw. in Vercel hinterlegen.</p>
            <button
              onClick={() => router.push('/settings')}
              style={{ ...mono, fontSize: 10, alignSelf: 'flex-start', padding: '3px 10px', borderRadius: 4, border: '1px solid rgba(99,129,255,.3)', background: 'rgba(99,129,255,.08)', color: '#6381ff', cursor: 'pointer' }}
            >→ Einstellungen</button>
          </div>
        )}

        {/* Provider selector — only configured providers are shown */}
        {PROVIDERS.length > 0 && (
        <div>
          <p style={{ ...mono, fontSize: 9, letterSpacing: '.1em', color: T.inkF, textTransform: 'uppercase', marginBottom: 8 }}>Provider</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PROVIDERS.map(p => {
              const s = status[p.id];
              const icon = statusIcon(s);
              const isActive = selected === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 7, textAlign: 'left', cursor: 'pointer',
                    border: isActive ? '1px solid rgba(232,176,75,.4)' : `1px solid ${T.line}`,
                    background: isActive ? 'rgba(232,176,75,.06)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ ...mono, fontSize: 11, color: isActive ? T.gold : T.inkD }}>{p.label}</span>
                    {icon && (
                      <span style={{ ...mono, fontSize: 11, color: statusColor(s) }}>{icon}</span>
                    )}
                  </div>
                  <p style={{ ...mono, fontSize: 10, color: T.inkF }}>{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Was holen? — nur, was der Anbieter kann */}
        {PROVIDERS.length > 0 && (
          <div>
            <p style={{ ...mono, fontSize: 9, letterSpacing: '.1em', color: T.inkF, textTransform: 'uppercase', marginBottom: 8 }}>Was holen?</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'email' as const, label: 'E-Mail-Adresse', desc: 'aus Name + Firma/Domain', possible: true, checked: wantEmail },
                { key: 'phone' as const, label: 'Telefonnummer',  desc: providerCanPhone ? 'aus der LinkedIn-URL · separate Telefon-Credits' : `${providerLabelOf(selected)} bietet keine Telefonsuche`, possible: providerCanPhone, checked: wantPhone },
              ].map(f => (
                <label key={f.key} data-testid={`field-${f.key}`} style={{
                  flex: 1, minWidth: 200, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 7, cursor: f.possible ? 'pointer' : 'default',
                  border: f.checked ? '1px solid rgba(79,209,197,.4)' : `1px solid ${T.line}`, background: f.checked ? 'rgba(79,209,197,.05)' : 'transparent', opacity: f.possible ? 1 : .45,
                }}>
                  <input type="checkbox" disabled={!f.possible} checked={f.checked}
                    onChange={e => {
                      const next = { ...fields, [f.key]: e.target.checked };
                      if (!next.email && !next.phone) next.email = true; // mindestens eins
                      onFieldsChange(next);
                    }}
                    style={{ accentColor: '#4fd1c5', width: 13, height: 13, marginTop: 2 }} />
                  <span>
                    <span style={{ ...mono, fontSize: 11, color: f.checked ? T.ink : T.inkD, display: 'block' }}>{f.label}</span>
                    <span style={{ ...mono, fontSize: 9, color: T.inkF }}>{f.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Spalten-Zuordnung: links das Feld, rechts die Spalte — immer vorbelegt */}
        {PROVIDERS.length > 0 && needsMapping && (
          <div>
            <p style={{ ...mono, fontSize: 9, letterSpacing: '.1em', color: T.inkF, textTransform: 'uppercase', marginBottom: 8 }}>Spalten-Zuordnung</p>
            <div style={{ border: `1px solid ${T.line}`, borderRadius: 7, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', background: 'rgba(255,255,255,.03)', borderBottom: `1px solid ${T.line}` }}>
                <span style={{ ...mono, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: T.inkF, padding: '6px 10px' }}>Feld</span>
                <span style={{ ...mono, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: T.inkF, padding: '6px 10px' }}>Spalte im Datensatz</span>
              </div>
              {[
                ...(wantEmail ? [
                  { key: 'name',    label: 'Name',           value: effNameCol,    suggested: suggestedName,    chosen: nameCol,    set: setNameCol,    hint: 'Vor- und Nachname der Person' },
                  { key: 'company', label: 'Firma / Domain', value: effCompanyCol, suggested: suggestedCompany, chosen: companyCol, set: setCompanyCol, hint: 'Firmenname oder Website-Domain' },
                ] : []),
                ...(wantPhone ? [
                  { key: 'linkedin', label: 'LinkedIn-URL', value: effLinkedinCol, suggested: suggestedLinkedin, chosen: linkedinCol, set: setLinkedinCol, hint: 'Profil-Link für die Telefonsuche' },
                ] : []),
              ].map(({ key, label, value, suggested, chosen, set, hint }) => {
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
                          {availableColumns!.map(c => <option key={c} value={c}>{c}</option>)}
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
        )}

        {/* Stufe 2: Bestätigung mit Credit-Schätzung */}
        {confirming && (
          <div data-testid="enrich-confirm" style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(232,176,75,.4)', background: 'rgba(232,176,75,.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ ...mono, fontSize: 11, color: T.gold, fontWeight: 600 }}>Enrichment wirklich starten?</p>
            {/* Guthaben live vom Anbieter */}
            <div data-testid="enrich-account" style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(0,0,0,.25)', border: `1px solid ${T.lineS}` }}>
              {account === 'loading' && <p style={{ ...mono, fontSize: 10, color: T.inkF }}>↻ Guthaben bei {providerLabelOf(selected)} wird abgefragt…</p>}
              {account && account !== 'loading' && account.available !== null && (() => {
                const short = account.available < leadsCount;
                return (
                  <p style={{ ...mono, fontSize: 10, color: short ? '#e8736b' : T.inkD, lineHeight: 1.6 }}>
                    Guthaben bei {account.label}: <strong style={{ color: short ? '#e8736b' : '#4fd1c5', fontSize: 12 }}>{account.available.toLocaleString('de')} {account.unit}</strong>
                    {account.used != null && <span style={{ color: T.inkF }}> ({account.used.toLocaleString('de')} verbraucht{account.planName ? `, ${account.planName}` : ''})</span>}
                    {account.resetDate && <span style={{ color: T.inkF }}> · Reset {new Date(account.resetDate).toLocaleDateString('de-DE')}</span>}
                    {short && <><br />⚠ Reicht nicht für alle {leadsCount.toLocaleString('de')} Leads — der Lauf stoppt, sobald der Anbieter ablehnt; bis dahin gefundene E-Mails bleiben gespeichert.</>}
                  </p>
                );
              })()}
              {account && account !== 'loading' && account.available === null && (
                <p style={{ ...mono, fontSize: 10, color: T.inkF }}>Guthaben bei {account.label} konnte nicht abgefragt werden{account.error ? ` (${account.error})` : ''} — bitte im Anbieter-Konto prüfen.</p>
              )}
            </div>
            <ul style={{ ...mono, fontSize: 10, color: T.inkD, lineHeight: 1.7, margin: 0, paddingLeft: 16 }}>
              <li><strong style={{ color: T.ink }}>{leadsCount.toLocaleString('de')} Leads</strong> über {providerLabelOf(selected)}</li>
              {wantEmail && (
                <li>E-Mail: <strong style={{ color: '#e8736b' }}>bis zu {leadsCount.toLocaleString('de')} Credits</strong>
                  {account && account !== 'loading' && account.rule && <span style={{ color: T.inkF }}> · {account.rule}</span>}
                </li>
              )}
              {wantPhone && (
                <li>Telefon: <strong style={{ color: '#e8736b' }}>bis zu {leadsCount.toLocaleString('de')} Telefon-Credits</strong>
                  {account && account !== 'loading' && account.phoneAvailable != null && <span style={{ color: account.phoneAvailable < leadsCount ? '#e8736b' : '#4fd1c5' }}> · {account.phoneAvailable.toLocaleString('de')} verfügbar</span>}
                  {account && account !== 'loading' && account.phoneRule && <span style={{ color: T.inkF }}> · {account.phoneRule}</span>}
                </li>
              )}
              {needsMapping && <li>Name ← <strong style={{ color: T.ink }}>{effNameCol}</strong> · Firma/Domain ← <strong style={{ color: T.ink }}>{effCompanyCol}</strong></li>}
              <li>{Math.ceil(leadsCount / 50)} {Math.ceil(leadsCount / 50) === 1 ? 'Charge' : 'Chargen'} à 50 Zeilen, Zwischenstand wird nach jeder Charge gespeichert; Abbruch jederzeit möglich</li>
            </ul>
            {leadsCount > BIG_RUN && (
              <label style={{ ...mono, fontSize: 10, color: ackCredits ? T.ink : T.inkD, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                <input type="checkbox" data-testid="enrich-ack" checked={ackCredits} onChange={e => setAckCredits(e.target.checked)} style={{ accentColor: '#e8b04b', width: 13, height: 13 }} />
                Ja, ich will bis zu {leadsCount.toLocaleString('de')} Credits verbrauchen
              </label>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setConfirming(false)}
                style={{ ...mono, flex: 1, padding: '8px 0', borderRadius: 6, cursor: 'pointer', border: `1px solid ${T.lineS}`, background: 'transparent', color: T.inkD, fontSize: 11 }}>Abbrechen</button>
              <button type="button" onClick={start} disabled={leadsCount > BIG_RUN && !ackCredits} data-testid="enrich-confirm-btn"
                style={{ ...mono, flex: 2, padding: '8px 0', borderRadius: 6, cursor: 'pointer', border: 'none', background: T.gold, color: '#07070a', fontSize: 11, fontWeight: 700, opacity: leadsCount > BIG_RUN && !ackCredits ? .4 : 1 }}>
                Ja, {leadsCount.toLocaleString('de')} Leads enrichen
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ padding: '10px 12px', border: '1px solid rgba(79,209,197,.2)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...mono, fontSize: 11, color: T.inkF }}>Ergebnis</span>
            <span style={{ ...mono, fontSize: 12, color: '#4fd1c5', fontWeight: 600 }}>{result.enriched} / {result.total} enriched</span>
          </div>
        )}

        {/* Was passiert — und wo das Ergebnis landet */}
        <div style={{ padding: '10px 12px', borderRadius: 7, border: `1px solid ${T.lineS}`, background: 'rgba(255,255,255,.02)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ ...mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: T.inkF }}>Was passiert</p>
          <p style={{ ...mono, fontSize: 11, color: T.inkD, lineHeight: 1.6 }}>
            {wantEmail && <>Zu <strong style={{ color: T.ink }}>Name + Firma/Domain</strong> wird die geschäftliche E-Mail gesucht → Spalte <code style={{ color: '#4fd1c5' }}>email_enriched</code>. </>}
            {wantPhone && <>Zur <strong style={{ color: T.ink }}>LinkedIn-URL</strong> wird die Mobilnummer gesucht → Spalte <code style={{ color: '#4fd1c5' }}>phone_enriched</code>. </>}
            Beides sichtbar in der Tabelle und in jedem Export (CSV, XLSX, Outreach).
          </p>
          <p style={{ ...mono, fontSize: 10, color: T.inkF, lineHeight: 1.5 }}>
            Bereits gefüllte Zeilen werden übersprungen, ein Abbruch verliert nichts.
          </p>
        </div>

        {leadsCount > 50 && !running && (
          <p style={{ ...mono, fontSize: 10, color: T.inkF, lineHeight: 1.5 }}>
            ⓘ {Math.ceil(leadsCount / 50)} Chargen à 50 Zeilen — nach jeder Charge wird gespeichert, Abbruch jederzeit möglich.
          </p>
        )}

        {/* Fortschritt über alle Chargen */}
        {progress && (
          <div data-testid="enrich-progress" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ ...mono, fontSize: 10, color: T.inkD }}>
                Charge {Math.min(Math.floor(progress.done / 50) + 1, Math.ceil(progress.total / 50))} / {Math.ceil(progress.total / 50)} · {progress.done} von {progress.total} Zeilen
              </span>
              <span style={{ ...mono, fontSize: 10, color: '#4fd1c5' }}>{progress.enriched} Treffer</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: '#e8b04b', transition: 'width .3s' }} />
            </div>
          </div>
        )}

        {/* Run button */}
        {PROVIDERS.length > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={requestStart}
            disabled={running || confirming || leadsCount === 0}
            style={{
              ...mono, flex: 1, padding: '9px 0', borderRadius: 7, cursor: 'pointer',
              border: '1px solid rgba(232,176,75,.35)', background: 'rgba(232,176,75,.1)',
              color: '#e8b04b', fontSize: 12, fontWeight: 600, letterSpacing: '.06em',
              opacity: running || confirming || leadsCount === 0 ? 0.4 : 1,
            }}
          >
            {running ? <><Glyph>↻</Glyph>Läuft…</> : <><Glyph>▶</Glyph>Enrichment starten</>}
          </button>
          {running && (
            <button
              onClick={stop}
              data-testid="enrich-stop"
              title="Nach der laufenden Anfrage stoppen — Ergebnisse bleiben gespeichert"
              style={{ ...mono, padding: '9px 14px', borderRadius: 7, cursor: 'pointer', border: '1px solid rgba(232,115,107,.35)', background: 'transparent', color: '#e8736b', fontSize: 12 }}
            >Abbrechen</button>
          )}
        </div>
        )}

      </div>
    </div>
  );
}
