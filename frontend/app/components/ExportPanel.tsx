'use client';

import { useState } from 'react';
import { exportToCSV, exportToXLSX, getFilenameWithTimestamp, type ExportRow } from '@/lib/export';
import { useToast } from './Toast';

interface ExportPanelProps {
  runId: string;
  leads: ExportRow[];
}

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
    <div className="border border-line rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-panel flex items-center gap-3">
        <span className="text-xs font-mono tracking-wider text-ink uppercase">Export</span>
        <span className="ml-auto text-xs font-mono text-ink-faint">
          <span className="text-good font-semibold">{leads.length}</span> Leads bereit
        </span>
      </div>

      <div className="p-5 bg-panel-2 space-y-4">
        {leads.length === 0 ? (
          <div className="border border-warn/30 bg-warn/5 rounded p-4 text-center">
            <p className="text-xs font-mono text-warn">Keine Leads verfügbar.</p>
            <p className="text-xs font-mono text-ink-faint mt-1">Führe zuerst Klassifizierung und Enrichment durch.</p>
          </div>
        ) : (
          <>
            <div className="bg-panel-3 border border-line rounded p-4">
              <p className="text-xs font-mono text-ink-faint uppercase tracking-wider mb-3">Exportinhalt</p>
              <ul className="text-xs font-mono text-ink-dim space-y-1">
                {['Name', 'E-Mail', 'Telefon', 'Unternehmen', 'Status', 'Begründung', 'Erstellt'].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-gold/60">→</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => doExport('csv')}
                disabled={exporting}
                className="py-3 rounded border border-line bg-panel-3 hover:border-gold-dim hover:bg-panel-2 text-ink text-xs font-mono tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↓ CSV
              </button>
              <button
                onClick={() => doExport('xlsx')}
                disabled={exporting}
                className="py-3 rounded border border-gold-dim bg-gold/5 hover:bg-gold/10 text-gold text-xs font-mono tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↓ XLSX
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
