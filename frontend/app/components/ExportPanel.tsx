'use client';

import { useState } from 'react';
import { exportToCSV, exportToXLSX, getFilenameWithTimestamp, type ExportRow } from '@/lib/export';
import { useToast } from './Toast';

interface ExportPanelProps {
  runId: string;
  leads: ExportRow[];
}

const mono: React.CSSProperties = { fontFamily: "'Spline Sans Mono', monospace" };

const T = {
  panel:  'var(--th-panel)',
  panel2: 'var(--th-panel2)',
  line:   'var(--th-line)',
  lineS:  'var(--th-line-soft)',
  gold:   'var(--th-gold)',
  ink:    'var(--th-ink)',
  inkD:   'var(--th-ink-d)',
  inkF:   'var(--th-ink-f)',
};

export function ExportPanel({ runId, leads }: ExportPanelProps) {
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);

  const doExport = async (format: 'csv' | 'xlsx') => {
    if (leads.length === 0) return showToast('Keine Leads zum Exportieren', 'warning');
    setExporting(true);
    try {
      const filename = getFilenameWithTimestamp(`leads_run_${runId}`);
      if (format === 'csv') exportToCSV(leads, `${filename}.csv`);
      else exportToXLSX(leads, `${filename}.xlsx`);
      showToast(`${leads.length} Leads als ${format.toUpperCase()} exportiert`, 'success');
    } catch {
      showToast('Export fehlgeschlagen', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.line}`, background: T.panel, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...mono, fontSize: 10, letterSpacing: '.1em', color: T.inkF, textTransform: 'uppercase' }}>Export</span>
        <span style={{ ...mono, fontSize: 11, color: T.inkF, marginLeft: 'auto' }}>
          <span style={{ color: '#4fd1c5', fontWeight: 600 }}>{leads.length}</span> Leads bereit
        </span>
      </div>

      <div style={{ padding: 16, background: T.panel2, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {leads.length === 0 ? (
          <div style={{ padding: '14px 16px', border: '1px solid rgba(232,176,75,.25)', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ ...mono, fontSize: 11, color: '#e8b04b', marginBottom: 4 }}>Keine Leads verfügbar.</p>
            <p style={{ ...mono, fontSize: 10, color: T.inkF }}>Führe zuerst Klassifizierung und Enrichment durch.</p>
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 14px', border: `1px solid ${T.line}`, borderRadius: 8, background: T.panel }}>
              <p style={{ ...mono, fontSize: 9, letterSpacing: '.1em', color: T.inkF, textTransform: 'uppercase', marginBottom: 10 }}>Exportinhalt</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {['Name', 'E-Mail', 'Telefon', 'Unternehmen', 'Status', 'Begründung', 'Erstellt'].map(f => (
                  <li key={f} style={{ ...mono, fontSize: 11, color: T.inkD, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'rgba(232,176,75,.5)' }}>→</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => doExport('csv')}
                disabled={exporting}
                style={{
                  ...mono, padding: '10px 0', borderRadius: 7, cursor: 'pointer',
                  border: `1px solid ${T.line}`, background: T.panel, color: T.inkD,
                  fontSize: 12, letterSpacing: '.06em',
                  opacity: exporting ? 0.4 : 1,
                }}
              >↓ CSV</button>
              <button
                onClick={() => doExport('xlsx')}
                disabled={exporting}
                style={{
                  ...mono, padding: '10px 0', borderRadius: 7, cursor: 'pointer',
                  border: '1px solid rgba(232,176,75,.35)', background: 'rgba(232,176,75,.06)',
                  color: T.gold, fontSize: 12, letterSpacing: '.06em',
                  opacity: exporting ? 0.4 : 1,
                }}
              >↓ XLSX</button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
