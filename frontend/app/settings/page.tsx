'use client';

import { useState, useEffect } from 'react';
import { loadSettings } from '@/lib/settings';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { loadBlocklist } from '@/lib/blocklist';
import { getEffectivePresets } from '@/lib/aiTemplates';
import { IntegrationsTab, SERVICE_KEYS } from './IntegrationsTab';
import { AiColumnsTab } from './AiColumnsTab';
import { BlocklistTab } from './BlocklistTab';
import { DesignTab } from './DesignTab';
import { DataTab } from './DataTab';
import { T } from '@/app/theme';

const NAV_KEYS = ['integrations', 'templates', 'blocklist', 'data', 'design'] as const;
type NavKey = typeof NAV_KEYS[number];

/**
 * Einstellungen: Sidebar mit Badges + je ein Tab pro Bereich. Die Badges
 * werden einmal beim Laden aus dem Speicher gezählt und danach von den Tabs
 * aktualisiert, sobald dort etwas hinzukommt oder wegfällt.
 */
export default function Settings() {
  const [nav,        setNav]        = useState<NavKey>('integrations');
  const [keyCount,   setKeyCount]   = useState(0);
  const [tplCount,   setTplCount]   = useState(0);
  const [blockCount, setBlockCount] = useState(0);

  useEffect(() => {
    // localStorage gibt es erst im Browser — daher Effect statt lazy useState
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTplCount(getEffectivePresets().length);
    setBlockCount(loadBlocklist().length);
    const local = loadSettings().apiKeys as Record<string, string>;
    fetchKeyAvailability().then(server => setKeyCount(SERVICE_KEYS.filter(k => local[k] || server[k]).length));
    // Deep link: /settings?tab=blocklist
    try {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab && (NAV_KEYS as readonly string[]).includes(tab)) setNav(tab as NavKey);
    } catch {}
  }, []);

  const NAV: { key: NavKey; label: string; badge?: number }[] = [
    { key: 'integrations', label: 'Integrationen', badge: keyCount || undefined },
    { key: 'templates',    label: 'KI-Spalten',    badge: tplCount || undefined },
    { key: 'blocklist',    label: 'Blockliste',    badge: blockCount || undefined },
    { key: 'data',         label: 'Daten' },
    { key: 'design',       label: 'Design' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${T.lineS}`, padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: T.inkF, padding: '0 20px', marginBottom: 10 }}>
          Einstellungen
        </p>
        {NAV.map(n => {
          const active = nav === n.key;
          return (
            <button key={n.key} type="button" onClick={() => setNav(n.key)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 20px', background: active ? T.goldD : 'transparent',
              border: 'none', borderLeft: `2px solid ${active ? T.gold : 'transparent'}`,
              cursor: 'pointer', textAlign: 'left', transition: 'all .12s',
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: active ? T.gold : T.inkD, flex: 1 }}>{n.label}</span>
              {n.badge && (
                <span style={{ fontFamily: T.mono, fontSize: 9, background: T.tealD, color: T.teal, border: `1px solid ${T.tealB}`, borderRadius: 10, padding: '1px 6px' }}>
                  {n.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      {/* Tabellen-Tabs (KI-Spalten, Blockliste) brauchen die volle Breite */}
      <div style={{ flex: 1, padding: '32px 40px', maxWidth: nav === 'templates' || nav === 'blocklist' ? 1240 : 680 }}>
        {nav === 'integrations' && <IntegrationsTab onCountChange={setKeyCount} />}
        {nav === 'templates'    && <AiColumnsTab onCountChange={setTplCount} />}
        {nav === 'blocklist'    && <BlocklistTab onCountChange={setBlockCount} />}
        {nav === 'data'         && <DataTab />}
        {nav === 'design'       && <DesignTab />}
      </div>
    </div>
  );
}
