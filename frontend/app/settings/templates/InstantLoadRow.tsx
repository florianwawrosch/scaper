'use client';

import { PRESET_SOURCES, type ImportPreset, type PresetFlags } from '@/lib/aiTemplates';
import { T } from '@/app/theme';

interface Props {
  preset: ImportPreset;
  onToggle: (patch: PresetFlags) => void;
}

/** ⚡ Instant Load: bei welchen Quellen die Vorlage automatisch angehängt (und ausgefüllt) wird */
export function InstantLoadRow({ preset, onToggle }: Props) {
  const anyAuto = PRESET_SOURCES.some(src => preset.autoAdd?.[src.key]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: '8px 12px', borderRadius: 6, marginBottom: 14, background: anyAuto ? 'rgba(232,176,75,.06)' : 'rgba(255,255,255,.02)', border: `1px solid ${anyAuto ? 'rgba(232,176,75,.3)' : 'rgba(255,255,255,.06)'}` }}>
      <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.1em', color: anyAuto ? T.gold : T.inkF }}>⚡ INSTANT LOAD</span>
      {PRESET_SOURCES.map(src => (
        <label key={src.key} style={{ fontFamily: T.mono, fontSize: 11, color: preset.autoAdd?.[src.key] ? T.ink : T.inkD, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" data-testid={`tpl-auto-${src.key}-${preset.id}`}
            checked={!!preset.autoAdd?.[src.key]}
            onChange={e => onToggle({ autoAdd: { [src.key]: e.target.checked } })}
            style={{ accentColor: '#e8b04b', width: 13, height: 13 }} />
          bei {src.label}
        </label>
      ))}
      <label title={anyAuto ? 'Nach dem automatischen Anhängen sofort per KI ausfüllen (kostet API-Credits)' : 'Erst eine Quelle für Instant Load wählen'}
        style={{ fontFamily: T.mono, fontSize: 11, color: anyAuto ? (preset.autoRun ? T.teal : T.inkD) : T.inkF, display: 'flex', alignItems: 'center', gap: 6, cursor: anyAuto ? 'pointer' : 'default', opacity: anyAuto ? 1 : .5, marginLeft: 'auto' }}>
        <input type="checkbox" data-testid={`tpl-autorun-${preset.id}`}
          disabled={!anyAuto}
          checked={anyAuto && !!preset.autoRun}
          onChange={e => onToggle({ autoRun: e.target.checked })}
          style={{ accentColor: '#4fd1c5', width: 13, height: 13 }} />
        ▶ direkt ausfüllen lassen
      </label>
    </div>
  );
}
