'use client';

import { useState } from 'react';
import { exportToCSV, exportToXLSX, getFilenameWithTimestamp, type ExportRow } from '@/lib/export';
import { useToast } from './Toast';

interface ExportPanelProps {
  runId: string;
  leads: ExportRow[];
  isLoading?: boolean;
}

export function ExportPanel({ runId, leads, isLoading = false }: ExportPanelProps) {
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (leads.length === 0) {
      showToast('Keine Leads zum Exportieren', 'warning');
      return;
    }

    setExporting(true);
    try {
      const filename = getFilenameWithTimestamp(`leads_run_${runId}`);

      if (format === 'csv') {
        exportToCSV(leads, `${filename}.csv`);
      } else {
        exportToXLSX(leads, `${filename}.xlsx`);
      }

      showToast(`${leads.length} Leads als ${format.toUpperCase()} exportiert`, 'success');
    } catch (error) {
      showToast('Export fehlgeschlagen', 'error');
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-panel-2 border border-line-soft rounded p-4">
        <h3 className="font-mono text-xs tracking-wider text-ink-faint mb-4 font-medium">
          Leads Exportieren
        </h3>

        <div className="space-y-3">
          <div className="bg-panel-3 rounded p-3">
            <p className="text-xs text-ink-dim mb-2">
              <span className="font-semibold text-ink">{leads.length}</span> Leads verfügbar
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleExport('csv')}
                disabled={exporting || leads.length === 0}
                className="h-8 bg-panel-3 border border-line rounded text-ink hover:border-gold-dim transition-colors text-xs font-medium disabled:opacity-50 whitespace-nowrap"
              >
                {exporting ? '⟳' : '📥'} CSV
              </button>
              <button
                onClick={() => handleExport('xlsx')}
                disabled={exporting || leads.length === 0}
                className="h-8 bg-panel-3 border border-line rounded text-ink hover:border-gold-dim transition-colors text-xs font-medium disabled:opacity-50 whitespace-nowrap"
              >
                {exporting ? '⟳' : '📥'} XLSX
              </button>
            </div>
          </div>

          <div className="text-xs text-ink-dim space-y-1">
            <p className="font-semibold text-ink">Spalten im Export:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>ID, Name, E-Mail, Telefon</li>
              <li>Unternehmen, Budget</li>
              <li>Status (KEEP/REJECT/UNCLEAR)</li>
              <li>Klassifizierungsbegründung</li>
              <li>Erstellt am</li>
            </ul>
          </div>
        </div>
      </div>

      {leads.length === 0 && !isLoading && (
        <div className="bg-warn/10 border border-warn/35 rounded p-3 text-xs text-warn">
          Keine Leads verfügbar. Führe zuerst eine Klassifizierung durch.
        </div>
      )}
    </div>
  );
}
