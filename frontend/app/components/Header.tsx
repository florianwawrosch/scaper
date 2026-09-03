'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { mono } from '@/app/theme';

const NAV = [
  { href: '/',         label: 'Import' },
  { href: '/runs',     label: 'Verlauf' },
  { href: '/settings', label: 'Einstellungen' },
];

export function Header() {
  const router   = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  /** Session-Cookie serverseitig löschen, dann zur Login-Seite */
  const logout = async () => {
    setLoggingOut(true);
    try { await fetch('/api/auth', { method: 'DELETE' }); } catch {}
    router.push('/login');
    router.refresh();
    setLoggingOut(false);
  };

  return (
    <header style={{
      background: 'rgba(7,11,22,.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(232,176,75,.12)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <button
          onClick={() => router.push('/')}
          style={{ display: 'flex', alignItems: 'baseline', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span style={{
            fontFamily: "'Spline Sans Mono', monospace",
            fontSize: 10,
            letterSpacing: '.28em',
            color: '#e8b04b',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>LP</span>
          <span style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: 18,
            fontWeight: 500,
            color: '#f4efe4',
            letterSpacing: '-.01em',
          }}>
            Lead <em style={{ color: '#f5cc77', fontStyle: 'italic' }}>Pipeline</em>
          </span>
        </button>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {NAV.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                style={{
                  fontFamily: "'Spline Sans Mono', monospace",
                  fontSize: 12,
                  letterSpacing: '.08em',
                  color: active ? '#f4efe4' : '#5f6e87',
                  background: active ? 'rgba(232,176,75,.08)' : 'none',
                  border: active ? '1px solid rgba(232,176,75,.2)' : '1px solid transparent',
                  borderRadius: 8,
                  padding: '5px 14px',
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { if (!active) (e.target as HTMLButtonElement).style.color = '#9aa7bd'; }}
                onMouseLeave={e => { if (!active) (e.target as HTMLButtonElement).style.color = '#5f6e87'; }}
              >
                {label}
              </button>
            );
          })}
          {pathname !== '/login' && (
            <button
              onClick={logout}
              disabled={loggingOut}
              title="Abmelden — der Login-Cookie dieses Browsers wird gelöscht"
              data-testid="logout"
              style={{
                ...mono, fontSize: 11, letterSpacing: '.06em', marginLeft: 10,
                color: '#5f6e87', background: 'none', border: '1px solid transparent',
                borderRadius: 8, padding: '5px 10px', cursor: 'pointer', opacity: loggingOut ? .5 : 1,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e8736b'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#5f6e87'; }}
            >Abmelden</button>
          )}
        </nav>
      </div>
    </header>
  );
}
