'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { loadCsvRun, saveCsvRunColumns, type CsvRunMeta } from '@/lib/csvRuns';
import { loadAiConfigs, findAudience } from '@/lib/analysisConfigs';
import { EnrichmentPanel, type EnrichFields, type EnrichResult } from '@/app/components/EnrichmentPanel';
import { useToast } from '@/app/components/Toast';
import { Glyph } from '@/app/components/Glyph';
import { T } from '@/app/theme';

export default function EnrichPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { id } = useParams<{ id: string }>();

  const [meta,  setMeta]  = useState<CsvRunMeta | null>(null);
  const [rows,  setRows]  = useState<Record<string, string>[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  // Zielgruppen-Filter: Regel-Spalte (z.B. ki_zielgruppe) aus den KI-Configs
  const [audience,     setAudience]     = useState<{ column: string; value: string } | null>(null);
  const [onlyAudience, setOnlyAudience] = useState(true);
  // Was geholt wird — bestimmt, welche Zeilen noch «offen» sind
  const [fields,       setFields]       = useState<EnrichFields>({ email: true, phone: false });

  useEffect(() => {
    loadCsvRun(id)
      .then(({ meta: m, rows: r }) => {
        setMeta(m); setRows(r);
        // Zielgruppen-Spalte (ki_zielgruppe ja/nein oder Regel-Spalte älterer Configs)
        const audience = findAudience(loadAiConfigs(id), m.fields);
        if (audience) setAudience(audience);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Fehler beim Laden.'));
  }, [id]);

  // Nur Zeilen mit Zielgruppen-Treffer enrichen (spart Credits); bereits
  // enrichte Zeilen werden übersprungen — ein abgebrochener Lauf macht beim
  // nächsten Start genau dort weiter.
  // Mapping zurück auf die Original-Indizes über activeIdx
  const audienceActive = !!audience && onlyAudience;
  // Eine Zeile ist «offen», wenn ihr ein gewünschtes Feld noch fehlt
  const isOpen = (r: Record<string, string>) =>
    (fields.email && !String(r.email_enriched ?? '').trim()) || (fields.phone && !String(r.phone_enriched ?? '').trim());
  const { activeIdx, activeRows } = useMemo(() => {
    const idx = rows
      .map((_, i) => i)
      .filter(i => !audienceActive || String(rows[i][audience!.column] ?? '').trim() === audience!.value)
      .filter(i => isOpen(rows[i]));
    return { activeIdx: idx, activeRows: idx.map(i => rows[i]) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, audienceActive, audience, fields]);

  const emailCount = rows.filter(r => String(r.email_enriched ?? '').trim()).length;
  const phoneCount = rows.filter(r => String(r.phone_enriched ?? '').trim()).length;
  const alreadyEnrichedCount = rows.length - rows.filter(isOpen).length;

  // Merge enriched values back into the stored CSV so the table keeps them
  const persistEmails = async (results: EnrichResult[]) => {
    if (!meta) return;
    try {
      const emailCol = rows.map(r => r.email_enriched ?? '');
      const phoneCol = rows.map(r => r.phone_enriched ?? '');
      results.forEach((res, j) => {
        if (res?.email) emailCol[activeIdx[j]] = res.email;
        if (res?.phone) phoneCol[activeIdx[j]] = res.phone;
      });
      const cols: Record<string, string[]> = {};
      if (fields.email || results.some(r => r?.email)) cols.email_enriched = emailCol;
      if (fields.phone || results.some(r => r?.phone)) cols.phone_enriched = phoneCol;
      const merged = await saveCsvRunColumns(id, rows, cols);
      setRows(merged);
      setSaved(true);
    } catch {
      showToast('Ergebnisse konnten nicht gespeichert werden — Browser-Speicher voll? Bitte Seite nicht neu laden.', 'error', 10000);
    }
  };

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontFamily: T.ffMono, fontSize: 13, color: '#e8736b' }}>⚠ {error}</p>
      <button onClick={() => router.push('/')} style={{ fontFamily: T.ffMono, fontSize: 12, padding: '6px 16px', borderRadius: 6, background: T.panel, border: `1px solid ${T.line}`, color: T.inkD, cursor: 'pointer' }}>← Zurück</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 24px 64px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => router.push(`/csv/${id}`)}
            style={{ fontFamily: T.ffMono, fontSize: 11, padding: '5px 11px', borderRadius: 5, background: 'transparent', border: `1px solid ${T.lineS}`, color: T.inkD, cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
          ><Glyph>←</Glyph>Tabelle</button>
          <div>
            <h1 style={{ fontFamily: T.ffDisp, fontSize: 20, fontWeight: 700, color: T.ink, marginBottom: 3 }}>
              Enrichment
            </h1>
            <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF, letterSpacing: '.04em' }}>
              {meta?.filename ?? '…'}
            </p>
          </div>
        </div>

        {saved && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(79,209,197,.3)', background: 'rgba(79,209,197,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <p style={{ fontFamily: T.ffMono, fontSize: 11, color: '#4fd1c5', flex: 1 }}>
              ✓ Gespeichert: {emailCount.toLocaleString('de')} E-Mails («email_enriched»){phoneCount > 0 ? `, ${phoneCount.toLocaleString('de')} Telefonnummern («phone_enriched»)` : ''}.
            </p>
            <button
              onClick={() => router.push(`/csv/${id}`)}
              style={{ fontFamily: T.ffMono, fontSize: 11, padding: '5px 12px', borderRadius: 5, background: 'rgba(79,209,197,.12)', border: '1px solid rgba(79,209,197,.35)', color: '#4fd1c5', cursor: 'pointer', flexShrink: 0 }}
            >Tabelle öffnen<Glyph after>→</Glyph></button>
          </div>
        )}

        {alreadyEnrichedCount > 0 && (
          <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF, marginBottom: 14 }}>
            ⓘ {alreadyEnrichedCount} Zeile{alreadyEnrichedCount === 1 ? '' : 'n'} bereits enricht — werden übersprungen.
          </p>
        )}

        {/* Zielgruppen-Filter: nur klassifizierte Treffer enrichen */}
        {audience && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
            padding: '11px 14px', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${onlyAudience ? 'rgba(232,176,75,.35)' : T.lineS}`,
            background: onlyAudience ? 'rgba(232,176,75,.06)' : 'transparent',
          }}>
            <input
              type="checkbox" checked={onlyAudience} onChange={e => setOnlyAudience(e.target.checked)}
              style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#e8b04b' }}
            />
            <span style={{ fontFamily: T.ffMono, fontSize: 11, color: onlyAudience ? T.gold : T.inkD }}>
              Nur Zielgruppe enrichen ({audience.column} = {audience.value})
              <span style={{ color: T.inkF }}> — {activeRows.length} von {rows.length} Zeilen, spart API-Credits</span>
            </span>
          </label>
        )}

        <EnrichmentPanel
          rows={activeRows}
          leadsCount={activeRows.length}
          availableColumns={meta?.fields ?? []}
          onEmailColumn={persistEmails}
          fields={fields}
          onFieldsChange={setFields}
        />

      </div>
    </div>
  );
}
