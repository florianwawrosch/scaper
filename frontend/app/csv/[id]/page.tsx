'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface CsvRun {
  data: Record<string, string>[];
  fields: string[];
  filename: string;
  createdAt: string;
}

const T = {
  bg:     'var(--th-bg)',
  panel:  'var(--th-panel)',
  panel2: 'var(--th-panel2)',
  line:   'var(--th-line)',
  lineS:  'var(--th-line-soft)',
  gold:   'var(--th-gold)',
  goldD:  'var(--th-gold-d)',
  ink:    'var(--th-ink)',
  inkD:   'var(--th-ink-d)',
  inkF:   'var(--th-ink-f)',
  ffMono: 'var(--ff-mono)',
  ffBody: 'var(--ff-body)',
  ffDisp: 'var(--ff-disp)',
};

export default function CsvViewer() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<CsvRun | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`csv_run_${id}`);
      if (!raw) { setError('Datei nicht gefunden. Bitte erneut hochladen.'); return; }
      setRun(JSON.parse(raw));
    } catch {
      setError('Fehler beim Laden der Datei.');
    }
  }, [id]);

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontFamily: T.ffMono, fontSize: 13, color: '#e8736b' }}>⚠ {error}</p>
      <button onClick={() => router.push('/')} style={{ fontFamily: T.ffMono, fontSize: 12, padding: '6px 16px', borderRadius: 6, background: T.panel, border: `1px solid ${T.line}`, color: T.inkD, cursor: 'pointer' }}>← Zurück</button>
    </div>
  );

  if (!run) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: T.ffMono, fontSize: 12, color: T.inkF }}>Lädt…</p>
    </div>
  );

  const lower = search.toLowerCase();
  const filtered = search
    ? run.data.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(lower)))
    : run.data;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const fmt = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 20px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => router.push('/')}
            style={{ fontFamily: T.ffMono, fontSize: 11, padding: '4px 10px', borderRadius: 5, background: 'transparent', border: `1px solid ${T.lineS}`, color: T.inkD, cursor: 'pointer' }}
          >← Import</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: T.ffDisp, fontSize: 18, fontWeight: 600, color: T.ink }}>{run.filename}</h1>
            <p style={{ fontFamily: T.ffMono, fontSize: 10, color: T.inkF, marginTop: 2 }}>
              {run.data.length.toLocaleString('de-DE')} Zeilen · {run.fields.length} Spalten · importiert {fmt(run.createdAt)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Suchen…"
              style={{
                padding: '5px 10px', borderRadius: 5, border: `1px solid ${T.line}`,
                background: T.panel, fontFamily: T.ffMono, fontSize: 11, color: T.ink,
                outline: 'none', width: 200,
              }}
            />
            {search && (
              <span style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkF }}>{filtered.length} Treffer</span>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: T.panel, border: `1px solid ${T.lineS}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.ffMono, fontSize: 11 }}>
              <thead>
                <tr style={{ background: T.panel2, borderBottom: `1px solid ${T.line}` }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: T.inkF, fontWeight: 600, letterSpacing: '.06em', whiteSpace: 'nowrap', borderRight: `1px solid ${T.lineS}`, width: 40, flexShrink: 0 }}>#</th>
                  {run.fields.map(f => (
                    <th key={f} style={{ padding: '8px 10px', textAlign: 'left', color: T.inkF, fontWeight: 600, letterSpacing: '.06em', whiteSpace: 'nowrap', borderRight: `1px solid ${T.lineS}` }}>{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.lineS}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.025)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '6px 10px', color: T.inkF, borderRight: `1px solid ${T.lineS}`, userSelect: 'none' }}>{page * PAGE_SIZE + i + 1}</td>
                    {run.fields.map(f => (
                      <td key={f} style={{ padding: '6px 10px', color: T.inkD, borderRight: `1px solid ${T.lineS}`, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row[f]}>
                        {row[f] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: `1px solid ${T.lineS}` }}>
              <p style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkF }}>
                Seite {page + 1} von {totalPages} · {filtered.length.toLocaleString('de-DE')} Zeilen
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{ fontFamily: T.ffMono, fontSize: 11, padding: '4px 10px', borderRadius: 5, background: 'transparent', border: `1px solid ${T.lineS}`, color: page === 0 ? T.inkF : T.inkD, cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? .4 : 1 }}
                >← Zurück</button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  style={{ fontFamily: T.ffMono, fontSize: 11, padding: '4px 10px', borderRadius: 5, background: 'transparent', border: `1px solid ${T.lineS}`, color: page === totalPages - 1 ? T.inkF : T.inkD, cursor: page === totalPages - 1 ? 'default' : 'pointer', opacity: page === totalPages - 1 ? .4 : 1 }}
                >Weiter →</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
