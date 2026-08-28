import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ExportRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  budget?: string;
  status: 'KEEP' | 'REJECT' | 'UNCLEAR';
  reason?: string;
  createdAt: string;
}

export function exportToCSV(data: ExportRow[], filename: string = 'leads.csv') {
  const csv = Papa.unparse(data);
  downloadFile(csv, filename, 'text/csv');
}

export function exportToXLSX(data: ExportRow[], filename: string = 'leads.xlsx') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // id
    { wch: 25 }, // name
    { wch: 30 }, // email
    { wch: 15 }, // phone
    { wch: 20 }, // company
    { wch: 12 }, // budget
    { wch: 10 }, // status
    { wch: 30 }, // reason
    { wch: 15 }, // createdAt
  ];

  XLSX.writeFile(wb, filename);
}

function downloadFile(data: string, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function getFilenameWithTimestamp(prefix: string = 'leads'): string {
  const now = new Date();
  const timestamp = now.toISOString().split('T')[0];
  return `${prefix}_${timestamp}`;
}
