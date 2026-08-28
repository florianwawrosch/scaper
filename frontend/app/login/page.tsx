'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const mono = "'Spline Sans Mono', monospace";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Falsches Passwort');
        setPassword('');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: mono,
    }}>
      <form
        onSubmit={submit}
        style={{
          width: '100%', maxWidth: 340, padding: '32px 28px',
          background: 'var(--th-panel)', border: '1px solid var(--th-line)',
          borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <p style={{ fontFamily: 'var(--ff-disp)', fontSize: 22, fontWeight: 700, color: 'var(--th-ink)', marginBottom: 4 }}>
            Scaper
          </p>
          <p style={{ fontSize: 11, color: 'var(--th-ink-f)', letterSpacing: '.06em' }}>
            Passwort eingeben
          </p>
        </div>

        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          placeholder="••••••••"
          autoFocus
          autoComplete="current-password"
          style={{
            fontFamily: mono, fontSize: 14, padding: '10px 12px',
            background: 'var(--th-panel2)', border: `1px solid ${error ? 'rgba(232,115,107,.5)' : 'var(--th-line)'}`,
            borderRadius: 7, color: 'var(--th-ink)', outline: 'none',
            letterSpacing: '.1em',
          }}
        />

        {error && (
          <p style={{ fontSize: 11, color: '#e8736b', textAlign: 'center', marginTop: -8 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            fontFamily: mono, fontSize: 12, padding: '9px', borderRadius: 7,
            background: 'var(--th-gold)', border: 'none', color: '#07070a',
            fontWeight: 700, cursor: loading || !password ? 'default' : 'pointer',
            opacity: loading || !password ? 0.5 : 1, transition: 'opacity .15s',
          }}
        >
          {loading ? 'Prüfen…' : '→ Einloggen'}
        </button>
      </form>
    </div>
  );
}
