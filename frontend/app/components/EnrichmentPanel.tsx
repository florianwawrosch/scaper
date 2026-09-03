'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiKey, loadSettings } from '@/lib/settings';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { pickColumn, sampleValue, NAME_CANDIDATES, COMPANY_CANDIDATES, LINKEDIN_CANDIDATES } from '@/lib/enrichMapping';
import { useToast } from './Toast';
import { Glyph } from './Glyph';
import { ColumnMapping, type MappingRow } from './enrichment/ColumnMapping';
import { EnrichConfirm } from './enrichment/EnrichConfirm';
import { useEnrichmentRun, ENRICH_BATCH, type EnrichField, type EnrichResult, type ProviderStatus } from '@/app/hooks/useEnrichmentRun';
import type { EnrichAccount } from '@/app/api/enrich/account/route';
import { T, mono } from '@/app/theme';

export type { EnrichResult } from '@/app/hooks/useEnrichmentRun';
export interface EnrichFields { email: boolean; phone: boolean }

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

const ALL_PROVIDERS = [
  { id: 'hunter_io', label: 'Hunter.io', desc: 'E-Mail Finder',             phone: false },
  { id: 'findymail', label: 'FindyMail', desc: 'E-Mail + Telefon (LinkedIn)', phone: true },
] as const;

const providerLabelOf = (id: string) => ALL_PROVIDERS.find(p => p.id === id)?.label ?? id;

const STATUS_ICON:  Record<ProviderStatus, string | null> = { idle: null, running: '↻', done: '✓', error: '✕' };
const STATUS_COLOR: Record<ProviderStatus, string>        = { idle: T.inkF, running: '#e8b04b', done: '#4fd1c5', error: '#e8736b' };

/**
 * Enrichment-Panel: Provider wählen, Felder (E-Mail/Telefon) wählen, Spalten
 * zuordnen, zweistufig bestätigen (mit Guthaben), Lauf über alle Chargen.
 * Der Lauf selbst lebt in useEnrichmentRun, Zuordnung und Bestätigung in
 * eigenen Komponenten — hier wird nur zusammengesetzt.
 */
export function EnrichmentPanel({ leadsCount, onEnrichmentComplete, availableColumns, onEmailColumn, rows, fields, onFieldsChange }: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const run = useEnrichmentRun();

  const [selected,    setSelected]    = useState<string>('');
  const [nameCol,     setNameCol]     = useState('');
  const [companyCol,  setCompanyCol]  = useState('');
  const [linkedinCol, setLinkedinCol] = useState('');
  const [available,   setAvailable]   = useState<Record<string, boolean>>({});
  const [keysReady,   setKeysReady]   = useState(false);
  // Zweistufige Bestätigung: Start → Zusammenfassung mit Credit-Schätzung → Ja
  const [confirming,  setConfirming]  = useState(false);
  const [ackCredits,  setAckCredits]  = useState(false);
  const [account,     setAccount]     = useState<EnrichAccount | 'loading' | null>(null);

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

  // Spalten-Vorschläge sind abgeleitet, nicht in den State synchronisiert:
  // nameCol & Co. halten nur eine explizite Nutzerwahl ('' = Vorschlag gilt).
  const cols = availableColumns ?? [];
  const suggestedName     = pickColumn(cols, NAME_CANDIDATES);
  const suggestedCompany  = pickColumn(cols, COMPANY_CANDIDATES);
  const suggestedLinkedin = pickColumn(cols, LINKEDIN_CANDIDATES);
  const effNameCol     = nameCol     || suggestedName;
  const effCompanyCol  = companyCol  || suggestedCompany;
  const effLinkedinCol = linkedinCol || suggestedLinkedin;

  const providerCanPhone = !!ALL_PROVIDERS.find(p => p.id === selected)?.phone;
  const wantPhone = fields.phone && providerCanPhone;
  const wantEmail = fields.email || !wantPhone; // nie «nichts» — ohne Telefon immer E-Mail
  const needsMapping = cols.length > 0;

  // Only show providers that are actually configured (browser key or server env)
  const PROVIDERS = ALL_PROVIDERS.filter(p => available[p.id]);

  const mappingRows: MappingRow[] = [
    ...(wantEmail ? [
      { key: 'name',    label: 'Name',           value: effNameCol,    suggested: suggestedName,    chosen: nameCol,    set: setNameCol,    hint: 'Vor- und Nachname der Person' },
      { key: 'company', label: 'Firma / Domain', value: effCompanyCol, suggested: suggestedCompany, chosen: companyCol, set: setCompanyCol, hint: 'Firmenname oder Website-Domain' },
    ] : []),
    ...(wantPhone ? [
      { key: 'linkedin', label: 'LinkedIn-URL', value: effLinkedinCol, suggested: suggestedLinkedin, chosen: linkedinCol, set: setLinkedinCol, hint: 'Profil-Link für die Telefonsuche' },
    ] : []),
  ];

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

  /** Stufe 2: bestätigt — alle Chargen laufen durch */
  const start = () => {
    setConfirming(false);
    if (!selected) return;
    const wanted: EnrichField[] = [...(wantEmail ? ['email' as const] : []), ...(wantPhone ? ['phone' as const] : [])];
    run.start({
      provider: selected,
      // Key from browser settings if present — otherwise the server reads it from its env vars
      apiKey: getApiKey(selected) || undefined,
      rows,
      fields: wanted,
      mapping: { nameColumn: effNameCol, companyColumn: effCompanyCol, linkedinColumn: effLinkedinCol },
      onResults: onEmailColumn,
      onComplete: onEnrichmentComplete,
    });
  };

  const fieldOptions = [
    { key: 'email' as const, label: 'E-Mail-Adresse', desc: 'aus Name + Firma/Domain', possible: true, checked: wantEmail },
    { key: 'phone' as const, label: 'Telefonnummer',  desc: providerCanPhone ? 'aus der LinkedIn-URL · separate Telefon-Credits' : `${providerLabelOf(selected)} bietet keine Telefonsuche`, possible: providerCanPhone, checked: wantPhone },
  ];

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden' }}>

      {/* Header — eine klare Aussage */}
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
                const s = run.status[p.id] ?? 'idle';
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
                      {STATUS_ICON[s] && <span style={{ ...mono, fontSize: 11, color: STATUS_COLOR[s] }}>{STATUS_ICON[s]}</span>}
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
              {fieldOptions.map(f => (
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

        {PROVIDERS.length > 0 && needsMapping && (
          <ColumnMapping rows={mappingRows} availableColumns={cols} sample={col => sampleValue(rows, col)} />
        )}

        {confirming && (
          <EnrichConfirm
            leadsCount={leadsCount}
            providerLabel={providerLabelOf(selected)}
            account={account}
            wantEmail={wantEmail}
            wantPhone={wantPhone}
            mapping={needsMapping ? { name: effNameCol, company: effCompanyCol } : undefined}
            ack={ackCredits}
            onAck={setAckCredits}
            onCancel={() => setConfirming(false)}
            onConfirm={start}
          />
        )}

        {/* Result */}
        {run.result && (
          <div style={{ padding: '10px 12px', border: '1px solid rgba(79,209,197,.2)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...mono, fontSize: 11, color: T.inkF }}>Ergebnis</span>
            <span style={{ ...mono, fontSize: 12, color: '#4fd1c5', fontWeight: 600 }}>{run.result.enriched} / {run.result.total} enriched</span>
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

        {leadsCount > ENRICH_BATCH && !run.running && (
          <p style={{ ...mono, fontSize: 10, color: T.inkF, lineHeight: 1.5 }}>
            ⓘ {Math.ceil(leadsCount / ENRICH_BATCH)} Chargen à {ENRICH_BATCH} Zeilen — nach jeder Charge wird gespeichert, Abbruch jederzeit möglich.
          </p>
        )}

        {/* Fortschritt über alle Chargen */}
        {run.progress && (() => {
          const { done, total, enriched } = run.progress;
          const batches = Math.ceil(total / ENRICH_BATCH);
          return (
            <div data-testid="enrich-progress" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ ...mono, fontSize: 10, color: T.inkD }}>
                  Charge {Math.min(Math.floor(done / ENRICH_BATCH) + 1, batches)} / {batches} · {done} von {total} Zeilen
                </span>
                <span style={{ ...mono, fontSize: 10, color: '#4fd1c5' }}>{enriched} Treffer</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${total ? (done / total) * 100 : 0}%`, background: '#e8b04b', transition: 'width .3s' }} />
              </div>
            </div>
          );
        })()}

        {/* Run button */}
        {PROVIDERS.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={requestStart}
              disabled={run.running || confirming || leadsCount === 0}
              style={{
                ...mono, flex: 1, padding: '9px 0', borderRadius: 7, cursor: 'pointer',
                border: '1px solid rgba(232,176,75,.35)', background: 'rgba(232,176,75,.1)',
                color: '#e8b04b', fontSize: 12, fontWeight: 600, letterSpacing: '.06em',
                opacity: run.running || confirming || leadsCount === 0 ? 0.4 : 1,
              }}
            >
              {run.running ? <><Glyph>↻</Glyph>Läuft…</> : <><Glyph>▶</Glyph>Enrichment starten</>}
            </button>
            {run.running && (
              <button
                onClick={run.stop}
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
