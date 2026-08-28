'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings';

const KEY_FIELDS = [
  { key: 'gemini',    label: 'Gemini',   hint: 'AIzaSy…',   group: 'AI'  },
  { key: 'anthropic', label: 'Claude',   hint: 'sk-ant-…',  group: 'AI'  },
  { key: 'openai',    label: 'OpenAI',   hint: 'sk-…',      group: 'AI'  },
  { key: 'hunter_io', label: 'Hunter',   hint: 'xxxxxxxx…', group: 'Enrich' },
  { key: 'findymail', label: 'FindyMail',hint: 'Bearer…',   group: 'Enrich' },
  { key: 'meta_ads',  label: 'Meta Ads', hint: 'EAAxx…',    group: 'Scrape' },
] as const;

type SaveState = 'idle' | 'saving' | 'saved';

export default function Settings() {
  const [keys, setKeys]   = useState<Record<string, string>>({
    gemini: '', anthropic: '', openai: '', hunter_io: '', findymail: '', meta_ads: '',
  });
  const [theme, setTheme] = useState<'noir' | 'classic'>('noir');
  const [show,  setShow]  = useState<Record<string, boolean>>({});
  const [save,  setSave]  = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const s = loadSettings();
    setKeys(s.apiKeys);
    setTheme(s.theme ?? 'noir');
  }, []);

  const persist = useCallback((nextKeys: Record<string, string>, nextTheme: 'noir' | 'classic') => {
    clearTimeout(timer.current);
    setSave('saving');
    timer.current = setTimeout(() => {
      const current = loadSettings();
      saveSettings({ ...current, apiKeys: nextKeys as any, theme: nextTheme });
      setSave('saved');
      setTimeout(() => setSave('idle'), 1800);
    }, 500);
  }, []);

  const updateKey = (key: string, val: string) => {
    const next = { ...keys, [key]: val };
    setKeys(next);
    persist(next, theme);
  };

  const applyTheme = (t: 'noir' | 'classic') => {
    setTheme(t);
    if (t === 'classic') document.documentElement.dataset.theme = 'classic';
    else delete document.documentElement.dataset.theme;
    persist(keys, t);
  };

  const groups = ['AI', 'Enrich', 'Scrape'] as const;

  return (
    <div style={{ minHeight: '100vh', padding: '40px 32px 80px', maxWidth: 640, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--th-ink-f)' }}>
          Settings
        </span>
        <SaveIndicator state={save} />
      </div>

      {/* Design toggle */}
      <Section label="Design">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['noir', 'classic'] as const).map(t => (
            <button
              key={t}
              onClick={() => applyTheme(t)}
              style={{
                fontFamily: 'var(--ff-mono)',
                fontSize: 11,
                padding: '4px 12px',
                borderRadius: 4,
                border: `1px solid ${theme === t ? 'var(--th-gold)' : 'var(--th-line)'}`,
                background: theme === t ? 'var(--th-gold-d)' : 'transparent',
                color: theme === t ? 'var(--th-gold)' : 'var(--th-ink-f)',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all .12s',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </Section>

      {/* API Keys */}
      {groups.map(group => {
        const fields = KEY_FIELDS.filter(f => f.group === group);
        return (
          <Section key={group} label={group}>
            {fields.map(({ key, label, hint }) => {
              const val    = keys[key] || '';
              const filled = val.length > 0;
              return (
                <div
                  key={key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '72px 1fr auto',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 0',
                    borderBottom: '1px solid var(--th-line-soft)',
                  }}
                >
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--th-ink-d)' }}>{label}</span>
                  <input
                    type={show[key] ? 'text' : 'password'}
                    value={val}
                    onChange={e => updateKey(key, e.target.value)}
                    placeholder={hint}
                    style={{
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      fontFamily: 'var(--ff-mono)',
                      fontSize: 12,
                      color: filled ? 'var(--th-ink)' : 'var(--th-ink-f)',
                      width: '100%',
                      padding: 0,
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {filled && (
                      <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--th-teal, #4fd1c5)' }}>✓</span>
                    )}
                    <button
                      onClick={() => setShow(p => ({ ...p, [key]: !p[key] }))}
                      style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--th-ink-f)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0 }}
                    >
                      {show[key] ? '●' : '○'}
                    </button>
                    {filled && (
                      <button
                        onClick={() => updateKey(key, '')}
                        style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, color: 'var(--th-ink-f)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0 }}
                      >×</button>
                    )}
                  </div>
                </div>
              );
            })}
          </Section>
        );
      })}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--th-ink-f)', marginBottom: 10 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--ff-mono)', fontSize: 11, color: state === 'saved' ? 'var(--th-teal, #4fd1c5)' : 'var(--th-ink-f)' }}>
      {state === 'saving' ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: 'spin .8s linear infinite' }}>
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20 8" />
          </svg>
          Speichert…
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.5L5 9l4.5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Gespeichert
        </>
      )}
    </span>
  );
}
