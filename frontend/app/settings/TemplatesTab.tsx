'use client';

import { useState, useEffect } from 'react';
import {
  getEffectivePresets, savePromptOverride, resetPresetOverrides, hasOverride,
  saveUserPreset, deleteUserPreset, newPresetId, setPresetFlags, loadUserPresets,
  PRESET_SOURCES, type ImportPreset, type PresetFlags,
} from '@/lib/aiTemplates';
import { ConfirmDelete } from '@/app/components/ConfirmDelete';
import { T } from '@/app/theme';

interface Props {
  /** Anzahl der Vorlagen (für das Badge in der Navigation) */
  onCountChange?: (n: number) => void;
}

/**
 * Einstellungen → KI-Vorlagen: eingebaute Vorlagen (Prompt-Override, ↺ Standard),
 * eigene Vorlagen (anlegen, bearbeiten, löschen) und die Instant-Load-Schalter.
 */
export function TemplatesTab({ onCountChange }: Props) {
  // KI-Vorlagen: effektive Presets + lokale Editier-Zustände (Key: presetId:columnName)
  const [tplPresets,    setTplPresets]    = useState<ImportPreset[]>([]);
  const [tplPrompts,    setTplPrompts]    = useState<Record<string, string>>({});
  const [tplVersions,   setTplVersions]   = useState<Record<string, string>>({});
  const [tplSaved,      setTplSaved]      = useState<string | null>(null);
  const [tplOverridden, setTplOverridden] = useState<Set<string>>(new Set());
  // Eigene Vorlagen werden als Ganzes bearbeitet (Name, Beschreibung, Spalten)
  const [tplDrafts,     setTplDrafts]     = useState<Record<string, ImportPreset>>({});
  const [tplError,      setTplError]      = useState<Record<string, string>>({});

  const reloadTemplates = () => {
    const eff = getEffectivePresets();
    setTplPresets(eff);
    onCountChange?.(eff.length);
    const prompts: Record<string, string> = {};
    const versions: Record<string, string> = {};
    for (const p of eff) for (const c of p.columns) {
      prompts[`${p.id}:${c.name}`] = c.prompt;
      versions[`${p.id}:${c.name}`] = c.promptVersion ?? '';
    }
    setTplPrompts(prompts);
    setTplVersions(versions);
    // Einmal beim (Neu-)Laden ermitteln statt hasOverride() pro Preset pro Render
    setTplOverridden(new Set(eff.filter(p => hasOverride(p.id)).map(p => p.id)));
    setTplDrafts(Object.fromEntries(eff.filter(p => p.userDefined).map(p => [p.id, p])));
    setTplError({});
  };

  /** Instant-Load-Schalter einer Vorlage umstellen (sofort gespeichert) */
  const toggleFlags = (preset: ImportPreset, patch: PresetFlags) => {
    setPresetFlags(preset.id, {
      autoAdd: { ...preset.autoAdd, ...patch.autoAdd },
      autoRun: patch.autoRun ?? preset.autoRun,
    });
    reloadTemplates();
  };

  const createUserPreset = () => {
    const n = loadUserPresets().length + 1;
    saveUserPreset({ id: newPresetId(), name: `Neue Vorlage ${n}`, columns: [{ name: `ki_spalte_${n}`, prompt: '' }], userDefined: true });
    reloadTemplates();
  };

  const editDraft = (id: string, fn: (d: ImportPreset) => ImportPreset) =>
    setTplDrafts(p => ({ ...p, [id]: fn(p[id]) }));

  const draftDirty = (stored: ImportPreset, d: ImportPreset) =>
    JSON.stringify([stored.name, stored.description ?? '', stored.columns]) !== JSON.stringify([d.name, d.description ?? '', d.columns]);

  const saveDraft = (d: ImportPreset) => {
    const names = d.columns.map(c => c.name.trim());
    if (!d.name.trim()) return setTplError(p => ({ ...p, [d.id]: 'Vorlagenname fehlt' }));
    if (d.columns.length === 0) return setTplError(p => ({ ...p, [d.id]: 'Mindestens eine Spalte anlegen' }));
    if (names.some(n => !n)) return setTplError(p => ({ ...p, [d.id]: 'Jede Spalte braucht einen Namen' }));
    if (new Set(names).size !== names.length) return setTplError(p => ({ ...p, [d.id]: 'Spaltennamen müssen eindeutig sein' }));
    if (d.columns.some(c => !c.prompt.trim())) return setTplError(p => ({ ...p, [d.id]: 'Jede Spalte braucht einen Prompt' }));
    saveUserPreset({
      id: d.id, name: d.name.trim(), description: d.description?.trim() || undefined,
      columns: d.columns.map(c => ({ ...c, name: c.name.trim(), promptVersion: c.promptVersion?.trim() || undefined })),
      userDefined: true,
    });
    reloadTemplates();
    setTplSaved(d.id);
    setTimeout(() => setTplSaved(s => (s === d.id ? null : s)), 3000);
  };

  useEffect(() => {
    // localStorage gibt es erst im Browser (SSR-Prerender wäre leer) — daher Effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: T.disp, fontSize: 22, fontWeight: 700, color: T.ink }}>
            KI-<em style={{ color: T.gold }}>Vorlagen</em>
          </h1>
          <p style={{ fontFamily: T.body, fontSize: 13, color: T.inkF, marginTop: 4, lineHeight: 1.6 }}>
            Vorlagen für KI-Spalten. <strong style={{ color: T.inkD }}>⚡ Instant Load</strong> hängt die Spalten beim Import
            automatisch an — bei CSV/Excel-Upload und/oder Meta-Scrape — ohne Dialog; <strong style={{ color: T.inkD }}>▶ direkt
            ausfüllen</strong> startet die KI dazu sofort (kostet Credits). Eigene Vorlagen entstehen hier oder in der
            Tabelle (⚙ Spalte → «Als Vorlage speichern», ☆ Vorlage → «Aktuelle KI-Spalten speichern»). Prompt-Änderungen
            gelten für zukünftige Importe; bestehende Datensätze behalten ihre Konfiguration.
          </p>
        </div>
        <button type="button" onClick={createUserPreset} data-testid="tpl-new"
          style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 6, border: 'none', background: T.gold, color: '#07070a', cursor: 'pointer', flexShrink: 0, marginTop: 4 }}>
          + Neue Vorlage
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {tplPresets.map(preset => {
          const overridden = tplOverridden.has(preset.id);
          const anyAuto = PRESET_SOURCES.some(src => preset.autoAdd?.[src.key]);
          const draft = preset.userDefined ? (tplDrafts[preset.id] ?? preset) : null;
          const dirtyDraft = !!draft && draftDirty(preset, draft);
          return (
            <div key={preset.id} data-testid={`tpl-${preset.id}`} style={{ background: T.panel2, border: `1px solid ${anyAuto ? 'rgba(232,176,75,.35)' : overridden ? 'rgba(232,176,75,.2)' : 'rgba(255,255,255,.06)'}`, borderRadius: 8, padding: '16px 18px' }}>
              {/* Kopfzeile: Name (bei eigenen editierbar), Badges, Aktionen */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {draft ? (
                  <input
                    value={draft.name}
                    onChange={e => editDraft(preset.id, d => ({ ...d, name: e.target.value }))}
                    placeholder="Vorlagenname"
                    style={{ flex: 1, fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.ink, background: 'transparent', border: 'none', borderBottom: `1px solid ${T.line}`, outline: 'none', padding: '2px 0' }}
                  />
                ) : (
                  <p style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.ink, flex: 1 }}>{preset.name}</p>
                )}
                {preset.userDefined ? (
                  <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.08em', color: T.teal, background: T.tealD, border: `1px solid ${T.tealB}`, borderRadius: 4, padding: '2px 7px' }}>
                    eigene
                  </span>
                ) : (
                  <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.08em', color: T.inkF, background: T.panel, border: `1px solid ${T.lineS}`, borderRadius: 4, padding: '2px 7px' }}>
                    eingebaut
                  </span>
                )}
                {overridden && (
                  <>
                    <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.08em', color: T.gold, background: T.goldD, border: '1px solid rgba(232,176,75,.3)', borderRadius: 4, padding: '2px 7px' }}>
                      angepasst
                    </span>
                    <button type="button"
                      onClick={() => { resetPresetOverrides(preset.id); reloadTemplates(); }}
                      title="Prompt auf den eingebauten Standard zurücksetzen"
                      style={{ fontFamily: T.mono, fontSize: 10, padding: '3px 9px', borderRadius: 4, background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: T.inkD, cursor: 'pointer' }}>
                      ↺ Standard
                    </button>
                  </>
                )}
                {preset.userDefined && (
                  <ConfirmDelete
                    title="Vorlage löschen"
                    question="Vorlage löschen?"
                    onConfirm={() => { deleteUserPreset(preset.id); reloadTemplates(); }}
                    style={{ display: 'flex', alignItems: 'center' }}
                  />
                )}
              </div>
              {draft ? (
                <input
                  value={draft.description ?? ''}
                  onChange={e => editDraft(preset.id, d => ({ ...d, description: e.target.value }))}
                  placeholder="Beschreibung (optional)"
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: T.body, fontSize: 11, color: T.inkD, background: 'transparent', border: 'none', outline: 'none', padding: 0, marginBottom: 12 }}
                />
              ) : preset.description && (
                <p style={{ fontFamily: T.body, fontSize: 11, color: T.inkF, marginBottom: 12 }}>{preset.description}</p>
              )}

              {/* ⚡ Instant Load */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: '8px 12px', borderRadius: 6, marginBottom: 14, background: anyAuto ? 'rgba(232,176,75,.06)' : 'rgba(255,255,255,.02)', border: `1px solid ${anyAuto ? 'rgba(232,176,75,.3)' : 'rgba(255,255,255,.06)'}` }}>
                <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.1em', color: anyAuto ? T.gold : T.inkF }}>⚡ INSTANT LOAD</span>
                {PRESET_SOURCES.map(src => (
                  <label key={src.key} style={{ fontFamily: T.mono, fontSize: 11, color: preset.autoAdd?.[src.key] ? T.ink : T.inkD, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" data-testid={`tpl-auto-${src.key}-${preset.id}`}
                      checked={!!preset.autoAdd?.[src.key]}
                      onChange={e => toggleFlags(preset, { autoAdd: { [src.key]: e.target.checked } })}
                      style={{ accentColor: '#e8b04b', width: 13, height: 13 }} />
                    bei {src.label}
                  </label>
                ))}
                <label title={anyAuto ? 'Nach dem automatischen Anhängen sofort per KI ausfüllen (kostet API-Credits)' : 'Erst eine Quelle für Instant Load wählen'}
                  style={{ fontFamily: T.mono, fontSize: 11, color: anyAuto ? (preset.autoRun ? T.teal : T.inkD) : T.inkF, display: 'flex', alignItems: 'center', gap: 6, cursor: anyAuto ? 'pointer' : 'default', opacity: anyAuto ? 1 : .5, marginLeft: 'auto' }}>
                  <input type="checkbox" data-testid={`tpl-autorun-${preset.id}`}
                    disabled={!anyAuto}
                    checked={anyAuto && !!preset.autoRun}
                    onChange={e => toggleFlags(preset, { autoRun: e.target.checked })}
                    style={{ accentColor: '#4fd1c5', width: 13, height: 13 }} />
                  ▶ direkt ausfüllen lassen
                </label>
              </div>

              {/* Spalten: eigene Vorlage = frei editierbar, eingebaute = Prompt/Version-Override */}
              {draft ? (
                <>
                  {draft.columns.map((col, ci) => (
                    <div key={ci} style={{ marginTop: 4, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <input
                          value={col.name}
                          onChange={e => editDraft(preset.id, d => ({ ...d, columns: d.columns.map((c, i) => i === ci ? { ...c, name: e.target.value } : c) }))}
                          placeholder="spaltenname"
                          style={{ width: 200, fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.teal, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 4, padding: '3px 7px', outline: 'none' }}
                        />
                        {col.outputFields && (
                          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF }}>→ {col.outputFields.join(', ')}</span>
                        )}
                        <div style={{ flex: 1 }} />
                        <label style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, letterSpacing: '.08em', textTransform: 'uppercase' }}>Version</label>
                        <input
                          value={col.promptVersion ?? ''}
                          onChange={e => editDraft(preset.id, d => ({ ...d, columns: d.columns.map((c, i) => i === ci ? { ...c, promptVersion: e.target.value } : c) }))}
                          placeholder="z.B. v1"
                          style={{ width: 52, fontFamily: T.mono, fontSize: 10, padding: '3px 7px', borderRadius: 4, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none' }}
                        />
                        {draft.columns.length > 1 && (
                          <button type="button" title="Spalte entfernen"
                            onClick={() => editDraft(preset.id, d => ({ ...d, columns: d.columns.filter((_, i) => i !== ci) }))}
                            style={{ fontSize: 14, color: T.inkF, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, opacity: .6 }}>×</button>
                        )}
                      </div>
                      {col.inputColumns && (
                        <p style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, opacity: .7, marginBottom: 6 }}>
                          Eingabespalten: {col.inputColumns.join(', ')}
                        </p>
                      )}
                      <textarea
                        value={col.prompt}
                        onChange={e => editDraft(preset.id, d => ({ ...d, columns: d.columns.map((c, i) => i === ci ? { ...c, prompt: e.target.value } : c) }))}
                        rows={5}
                        spellCheck={false}
                        placeholder="Prompt… z.B. «Welche Nische hat dieser Coach? Antworte mit einem Wort.»"
                        style={{
                          width: '100%', boxSizing: 'border-box', resize: 'vertical',
                          fontFamily: T.mono, fontSize: 10.5, lineHeight: 1.55,
                          padding: '10px 12px', borderRadius: 6,
                          border: `1px solid ${dirtyDraft ? 'rgba(232,176,75,.4)' : T.line}`,
                          background: T.panel, color: T.ink, outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <button type="button"
                      onClick={() => editDraft(preset.id, d => ({ ...d, columns: [...d.columns, { name: `ki_spalte_${d.columns.length + 1}`, prompt: '' }] }))}
                      style={{ fontFamily: T.mono, fontSize: 10, padding: '4px 10px', borderRadius: 4, background: 'transparent', border: `1px dashed ${T.line}`, color: T.inkD, cursor: 'pointer' }}>
                      + Spalte
                    </button>
                    <div style={{ flex: 1 }}>
                      {tplError[preset.id] && (
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: '#e8736b' }}>⚠ {tplError[preset.id]}</span>
                      )}
                      {!tplError[preset.id] && tplSaved === preset.id && (
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.teal }}>✓ Gespeichert</span>
                      )}
                    </div>
                    <button type="button"
                      disabled={!dirtyDraft}
                      onClick={() => saveDraft(draft)}
                      data-testid={`tpl-save-${preset.id}`}
                      style={{
                        fontFamily: T.mono, fontSize: 11, padding: '5px 14px', borderRadius: 5,
                        border: `1px solid ${dirtyDraft ? T.gold : 'rgba(255,255,255,.1)'}`,
                        background: dirtyDraft ? 'rgba(232,176,75,.12)' : 'transparent',
                        color: dirtyDraft ? T.gold : T.inkF,
                        cursor: dirtyDraft ? 'pointer' : 'default',
                      }}>
                      Speichern
                    </button>
                  </div>
                </>
              ) : preset.columns.map(col => {
                const k = `${preset.id}:${col.name}`;
                const dirty = tplPrompts[k] !== col.prompt || (tplVersions[k] ?? '') !== (col.promptVersion ?? '');
                return (
                  <div key={col.name} style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.teal }}>{col.name}</span>
                      {col.outputFields && (
                        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF }}>→ {col.outputFields.join(', ')}</span>
                      )}
                      <div style={{ flex: 1 }} />
                      <label style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, letterSpacing: '.08em', textTransform: 'uppercase' }}>Version</label>
                      <input
                        value={tplVersions[k] ?? ''}
                        onChange={e => setTplVersions(p => ({ ...p, [k]: e.target.value }))}
                        placeholder="z.B. v2"
                        style={{ width: 52, fontFamily: T.mono, fontSize: 10, padding: '3px 7px', borderRadius: 4, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, outline: 'none' }}
                      />
                    </div>
                    {col.inputColumns && (
                      <p style={{ fontFamily: T.mono, fontSize: 9, color: T.inkF, opacity: .7, marginBottom: 6 }}>
                        Eingabespalten: {col.inputColumns.join(', ')}
                      </p>
                    )}
                    <textarea
                      value={tplPrompts[k] ?? ''}
                      onChange={e => setTplPrompts(p => ({ ...p, [k]: e.target.value }))}
                      rows={10}
                      spellCheck={false}
                      style={{
                        width: '100%', boxSizing: 'border-box', resize: 'vertical',
                        fontFamily: T.mono, fontSize: 10.5, lineHeight: 1.55,
                        padding: '10px 12px', borderRadius: 6,
                        border: `1px solid ${dirty ? 'rgba(232,176,75,.4)' : T.line}`,
                        background: T.panel, color: T.ink, outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <div style={{ flex: 1 }}>
                        {tplSaved === k && (
                          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.teal }}>✓ Gespeichert — gilt für neue Importe</span>
                        )}
                      </div>
                      <button type="button"
                        disabled={!dirty}
                        onClick={() => {
                          savePromptOverride(preset.id, col.name, {
                            prompt: tplPrompts[k] ?? '',
                            promptVersion: (tplVersions[k] ?? '').trim() || undefined,
                          });
                          reloadTemplates();
                          setTplSaved(k);
                          setTimeout(() => setTplSaved(s => (s === k ? null : s)), 3000);
                        }}
                        style={{
                          fontFamily: T.mono, fontSize: 11, padding: '5px 14px', borderRadius: 5,
                          border: `1px solid ${dirty ? T.gold : 'rgba(255,255,255,.1)'}`,
                          background: dirty ? 'rgba(232,176,75,.12)' : 'transparent',
                          color: dirty ? T.gold : T.inkF,
                          cursor: dirty ? 'pointer' : 'default',
                        }}>
                        Speichern
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
