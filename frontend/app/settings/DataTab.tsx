'use client';

import { useState, useEffect } from 'react';
import { storageStats, buildBackup, backupFilename, parseBackup, summarizeBackup, restoreBackup, wipeLocalData, type BackupFile, type Summary } from '@/lib/backup';
import { downloadBlob } from '@/lib/download';
import { useToast } from '@/app/components/Toast';
import { ConfirmDelete } from '@/app/components/ConfirmDelete';
import { T } from '@/app/theme';

const fmtBytes = (n?: number) => n == null ? '—' : n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`;

/** Einstellungen → Daten: Bestand, Backup herunterladen, wiederherstellen, alles löschen */
export function DataTab() {
  const { showToast } = useToast();
  const [stats,       setStats]       = useState<(Summary & { usedBytes?: number; quotaBytes?: number }) | null>(null);
  const [pending,     setPending]     = useState<{ file: BackupFile; summary: Summary; name: string } | null>(null);
  const [overwrite,   setOverwrite]   = useState(false);
  const [busy,        setBusy]        = useState(false);

  const refresh = () => { storageStats().then(setStats); };
  useEffect(() => { refresh(); }, []);

  const download = async () => {
    setBusy(true);
    try {
      const b = await buildBackup();
      downloadBlob(new Blob([JSON.stringify(b)], { type: 'application/json' }), backupFilename());
      showToast(`Backup mit ${Object.keys(b.csv).length} Datensätzen heruntergeladen`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Backup fehlgeschlagen', 'error');
    } finally { setBusy(false); }
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    f.text().then(text => {
      try {
        const file = parseBackup(text);
        setPending({ file, summary: summarizeBackup(file), name: f.name });
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Datei konnte nicht gelesen werden', 'error');
      }
    });
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await restoreBackup(pending.file, { overwrite });
      showToast(`Wiederhergestellt: ${r.datasets} Datensätze${r.skipped ? `, ${r.skipped} übersprungen (schon vorhanden)` : ''}`, 'success', 6000);
      setPending(null);
      refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Wiederherstellung fehlgeschlagen', 'error');
    } finally { setBusy(false); }
  };

  const wipe = async () => {
    await wipeLocalData();
    showToast('Alle lokalen Daten gelöscht', 'info');
    refresh();
  };

  const stat = (label: string, value: string | number) => (
    <div key={label} style={{ background: T.panel2, border: `1px solid ${T.lineS}`, borderRadius: 7, padding: '10px 12px' }}>
      <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: T.inkF }}>{label}</div>
      <div style={{ fontFamily: T.disp, fontSize: 20, fontWeight: 700, color: T.ink, marginTop: 2 }}>{typeof value === 'number' ? value.toLocaleString('de') : value}</div>
    </div>
  );

  const btn = (primary: boolean): React.CSSProperties => ({
    fontFamily: T.mono, fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 6, cursor: 'pointer',
    border: primary ? 'none' : `1px solid ${T.lineS}`, background: primary ? T.gold : 'transparent', color: primary ? '#07070a' : T.inkD,
  });

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
          Deine <em style={{ color: T.gold }}>Daten</em>
        </h1>
        <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, marginTop: 4, lineHeight: 1.6 }}>
          Datensätze, KI-Spalten, gespeicherte Suchen und Blockliste liegen nur im Browser dieses Geräts.
          Ein Browser-Reset oder Gerätewechsel löscht sie — ein Backup nimmt alles mit.
        </p>
      </div>

      {/* Bestand */}
      <div data-testid="data-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
        {stats ? [
          stat('Datensätze', stats.datasets), stat('Zeilen', stats.rows), stat('Eigene KI-Spalten', stats.templates),
          stat('Gespeicherte Suchen', stats.searches), stat('Blockliste', stats.blocklist), stat('Speicher belegt', fmtBytes(stats.usedBytes)),
        ] : <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkF }}>Lädt…</p>}
      </div>

      {/* Backup */}
      <div style={{ background: T.panel2, border: `1px solid ${T.lineS}`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
        <p style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Backup herunterladen</p>
        <p style={{ fontFamily: T.body, fontSize: 12, color: T.inkF, lineHeight: 1.5, marginBottom: 10 }}>
          Eine JSON-Datei mit allem — auf einem anderen Gerät unter «Backup wiederherstellen» einspielen.
          API-Keys sind nie enthalten; sie bleiben im Browser.
        </p>
        <button type="button" onClick={download} disabled={busy} data-testid="backup-download" style={btn(true)}>↓ Backup herunterladen</button>
      </div>

      {/* Restore */}
      <div style={{ background: T.panel2, border: `1px solid ${T.lineS}`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
        <p style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Backup wiederherstellen</p>
        {!pending ? (
          <label style={{ ...btn(false), display: 'inline-block' }}>
            ↑ Backup-Datei wählen
            <input type="file" accept=".json,application/json" onChange={pick} data-testid="backup-file" style={{ display: 'none' }} />
          </label>
        ) : (
          <div data-testid="restore-preview" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkD }}>
              <strong style={{ color: T.ink }}>{pending.name}</strong> vom {new Date(pending.file.createdAt).toLocaleString('de-DE')}:
              {' '}{pending.summary.datasets} Datensätze ({pending.summary.rows.toLocaleString('de')} Zeilen), {pending.summary.templates} eigene KI-Spalten,
              {' '}{pending.summary.searches} gespeicherte Suchen, {pending.summary.blocklist} Blocklisten-Einträge
            </p>
            <label style={{ fontFamily: T.mono, fontSize: 11, color: T.inkD, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} data-testid="restore-overwrite" style={{ accentColor: '#e8736b', width: 13, height: 13 }} />
              Vorhandene Datensätze mit gleicher ID überschreiben <span style={{ color: T.inkF }}>(sonst bleiben sie, nur Neues kommt dazu)</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setPending(null)} style={btn(false)}>Abbrechen</button>
              <button type="button" onClick={restore} disabled={busy} data-testid="restore-confirm" style={btn(true)}>Wiederherstellen</button>
            </div>
          </div>
        )}
      </div>

      {/* Danger */}
      <div style={{ border: '1px solid rgba(232,115,107,.25)', borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: '#e8736b' }}>Alle lokalen Daten löschen</p>
          <p style={{ fontFamily: T.body, fontSize: 12, color: T.inkF, lineHeight: 1.5 }}>Datensätze, KI-Spalten, Suchen, Blockliste und im Browser gespeicherte API-Keys — z.B. vor der Abgabe eines Geräts. Vorher Backup ziehen.</p>
        </div>
        <ConfirmDelete label="Alles löschen" title="Alle lokalen Daten dieses Browsers löschen" question="Wirklich alles löschen?" testId="wipe-all" onConfirm={wipe} style={{ display: 'flex', alignItems: 'center' }} />
      </div>
    </>
  );
}
