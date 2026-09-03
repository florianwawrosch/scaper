'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { T } from '@/app/theme';

const mono = T.ffMono;

const inputStyle = (bad: boolean): React.CSSProperties => ({
  fontFamily: mono, fontSize: 14, padding: '10px 12px', width: '100%', boxSizing: 'border-box',
  background: 'var(--th-panel2)', border: `1px solid ${bad ? 'rgba(232,115,107,.5)' : 'var(--th-line)'}`,
  borderRadius: 7, color: 'var(--th-ink)', outline: 'none',
});

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  // null = noch nicht geprüft; [] = alles da; sonst die fehlenden Variablen → App gesperrt
  const [missing,  setMissing]  = useState<string[] | null>(null);

  useEffect(() => {
    fetch('/api/auth', { signal: AbortSignal.timeout(5000) })
      .then(r => r.json())
      .then(d => setMissing(Array.isArray(d?.missing) ? d.missing : (d?.configured ? [] : ['APP_USER', 'APP_PASSWORD'])))
      .catch(() => setMissing([])); // im Zweifel das Formular zeigen
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        let msg = 'Benutzername oder Passwort falsch';
        let miss: string[] | null = null;
        try { const d = await res.json(); msg = d.error ?? msg; if (Array.isArray(d.missing)) miss = d.missing; } catch {}
        if (res.status === 503) setMissing(miss ?? ['APP_USER', 'APP_PASSWORD']);
        setError(msg);
        setPassword('');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  const locked = !!missing && missing.length > 0;
  const canSubmit = !loading && !!username.trim() && !!password;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono }}>
      <form
        onSubmit={submit}
        style={{
          width: '100%', maxWidth: 360, padding: '32px 28px',
          background: 'var(--th-panel)', border: `1px solid ${locked ? 'rgba(232,115,107,.45)' : 'var(--th-line)'}`,
          borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <p style={{ fontFamily: 'var(--ff-disp)', fontSize: 22, fontWeight: 700, color: 'var(--th-ink)', marginBottom: 4 }}>
            Scaper
          </p>
          <p style={{ fontSize: 11, color: 'var(--th-ink-f)', letterSpacing: '.06em' }}>
            {locked ? 'App gesperrt' : 'Anmelden'}
          </p>
        </div>

        {locked ? (
          <div style={{ fontSize: 11, color: 'var(--th-ink-d)', lineHeight: 1.7, padding: '12px 14px', borderRadius: 8, background: 'rgba(232,115,107,.08)', border: '1px solid rgba(232,115,107,.3)' }}>
            <p style={{ color: '#e8736b', fontWeight: 600, marginBottom: 6 }}>
              ⚠ Auf dem Server fehlt: {missing!.join(' und ')}
            </p>
            <p>
              Die App bleibt gesperrt, bis in Vercel → Settings → Environment Variables
              {' '}<code>APP_USER</code> und <code>APP_PASSWORD</code> gesetzt sind und neu deployt
              wurde. Ohne beides ist kein Zugriff möglich — auch nicht auf Scraper,
              KI-Analyse oder Enrichment.
            </p>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="Benutzername"
              autoFocus
              autoComplete="username"
              disabled={missing === null}
              style={inputStyle(!!error)}
            />
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Passwort"
              autoComplete="current-password"
              disabled={missing === null}
              style={{ ...inputStyle(!!error), letterSpacing: '.1em' }}
            />

            {error && (
              <p style={{ fontSize: 11, color: '#e8736b', textAlign: 'center', marginTop: -6 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                fontFamily: mono, fontSize: 12, padding: '9px', borderRadius: 7,
                background: 'var(--th-gold)', border: 'none', color: '#07070a',
                fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default',
                opacity: canSubmit ? 1 : 0.5, transition: 'opacity .15s',
              }}
            >
              {loading ? 'Prüfen…' : '→ Einloggen'}
            </button>
            <p style={{ fontSize: 10, color: 'var(--th-ink-f)', textAlign: 'center', lineHeight: 1.5 }}>
              Einmal pro Browser — danach bleibst du ein Jahr eingeloggt.
              Jede neue Anmeldung löst eine Sicherheits-Mail aus.
            </p>
          </>
        )}
      </form>
    </div>
  );
}
