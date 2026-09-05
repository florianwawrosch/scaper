'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { loadCsvRun, saveCsvRunColumns } from '@/lib/csvRuns';
import { lsSet, ensureLocalKey, STORE_EVENT, hasPending, remoteStamp, localStamp } from '@/lib/store';
import { loadSettings } from '@/lib/settings';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { loadAiConfigs, saveAiConfigs } from '@/lib/analysisConfigs';
import { applyPresets, presetFromConfigs, saveUserPreset, getEffectivePresets, readAutorunIds, AUTORUN_KEY, type ImportPreset, type PresetFlags } from '@/lib/aiTemplates';
import { runAiColumn, defaultModel, splitMultiOutput, applyDerivedRules, shortHash, rowFingerprint, isUsableAiValue, isAiError, normalizeMultiOutput, PENDING, type AnalysisConfig } from '@/lib/ai';
import { useToast } from '@/app/components/Toast';
import { buildKnownIndex } from '@/lib/leadIndex';
import { matchKnown, KNOWN_COL, EXPORTED_COL, EMAIL_COL, PHONE_COL } from '@/lib/leadKeys';

export interface CsvRun {
  data: Record<string, string>[];
  fields: string[];
  filename: string;
  createdAt: string;
  scrapeConfig?: Record<string, unknown>;
}

export interface AiColumn { name: string; values: string[] }

/**
 * Datensatz + KI-Spalten eines CSV-Runs: laden, Configs verwalten, Spalten
 * ausführen (Chunking, feld_hash-Cache, Multi-Output-Split, Regeln),
 * Ergebnisse in die CSV persistieren, Autorun, gespeicherte KI-Spalten laden/speichern.
 * Die Seite kümmert sich nur noch um Layout und Interaktion.
 */
export function useAiColumns(id: string) {
  const { showToast } = useToast();

  const [run,   setRun]   = useState<CsvRun | null>(null);
  const [error, setError] = useState('');
  // Immer der aktuelle Datensatz — runColumn-Closures (z.B. mehrere Spalten
  // nacheinander per Autorun) würden sonst mit veraltetem run.data speichern
  // und die bereits persistierten Spalten des vorherigen Laufs aus der CSV
  // verdrängen. Schreibvorgänge laufen zusätzlich seriell (persistQueue).
  const runRef       = useRef<CsvRun | null>(null);
  const persistQueue = useRef<Promise<void>>(Promise.resolve());

  const [aiColumns, setAiColumns] = useState<AiColumn[]>([]);
  // Lazy aus localStorage; SSR rendert ohnehin nur "Lädt…" bis run da ist
  const [aiConfigs,    setAiConfigs]    = useState<AnalysisConfig[]>(() => (typeof window === 'undefined' ? [] : loadAiConfigs(id)));
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [colRunning,   setColRunning]   = useState<Record<string, boolean>>({});
  const [colProgress,  setColProgress]  = useState<Record<string, number>>({});
  const [providers,    setProviders]    = useState<string[]>([]);
  const [scrollSignal, setScrollSignal] = useState(0);

  const loadDataset = useCallback(() => {
    loadCsvRun(id)
      .then(({ meta, rows }) => {
        const next: CsvRun = {
          data: rows,
          fields: meta.fields,
          filename: meta.filename,
          createdAt: meta.createdAt,
          scrapeConfig: meta.scrapeConfig,
        };
        runRef.current = next;
        setRun(next);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Fehler beim Laden der Datei.'));
  }, [id]);

  useEffect(() => { loadDataset(); }, [loadDataset]);

  // Ein Kollege (anderes Gerät) hat diesen Datensatz inzwischen geändert:
  // erkennbar am neueren Serverstand des CSV-Texts oder an anderen KI-Configs.
  // Nicht still überschreiben — Hinweis mit «Neu laden» (siehe remoteChanged).
  const [remoteChanged, setRemoteChanged] = useState(false);
  useEffect(() => {
    const check = () => {
      const cur = runRef.current;
      if (!cur || Object.values(colRunning).some(Boolean) || hasPending(`csv_text_${id}`)) return;
      const csvKey = `csv_text_${id}`;
      const textChanged = !!remoteStamp(csvKey) && remoteStamp(csvKey) !== localStamp(csvKey);
      let metaChanged = false;
      try {
        const m = JSON.parse(localStorage.getItem(`csv_run_${id}`) ?? 'null');
        metaChanged = !!m && (m.filename !== cur.filename || JSON.stringify(m.fields) !== JSON.stringify(cur.fields));
      } catch {}
      const configsChanged = JSON.stringify(loadAiConfigs(id)) !== JSON.stringify(aiConfigs);
      if (textChanged || metaChanged || configsChanged) setRemoteChanged(true);
    };
    window.addEventListener(STORE_EVENT, check);
    return () => window.removeEventListener(STORE_EVENT, check);
  }, [id, aiConfigs, colRunning]);

  /** «↻ Neu laden»: Serverstand dieses Datensatzes übernehmen (CSV, Meta, KI-Configs) */
  const reloadFromServer = useCallback(() => {
    setRemoteChanged(false);
    setAiColumns([]);
    setAiConfigs(loadAiConfigs(id));
    loadDataset();
  }, [id, loadDataset]);

  useEffect(() => {
    fetchKeyAvailability().then(server => {
      const local = loadSettings().apiKeys as Record<string, string>;
      setProviders(['gemini', 'anthropic', 'openai'].filter(p => local[p] || server[p]));
    });
  }, []);

  const persistConfigs = (next: AnalysisConfig[]) => {
    setAiConfigs(next);
    saveAiConfigs(id, next);
  };

  const upsertAiColumn = (name: string, values: string[]) =>
    setAiColumns(prev => {
      const idx = prev.findIndex(c => c.name === name);
      if (idx >= 0) { const next = [...prev]; next[idx] = { name, values }; return next; }
      return [...prev, { name, values }];
    });

  const renameAiColumn = (oldName: string, newName: string) =>
    setAiColumns(prev => prev.map(c => c.name === oldName ? { ...c, name: newName } : c));

  const updateRun = (next: CsvRun) => { runRef.current = next; setRun(next); };

  /**
   * Merge finished values into the stored CSV so the columns survive reloads.
   * Reads the LATEST rows (ref) and writes them back into state, so a second
   * column's save keeps the first column's values instead of overwriting them.
   */
  const persistColumnsToCsv = (cols: Record<string, string[]>): Promise<void> => {
    const job = async () => {
      const cur = runRef.current;
      if (!cur) return;
      try {
        const merged = await saveCsvRunColumns(id, cur.data, cols);
        const fields = [...cur.fields];
        for (const n of Object.keys(cols)) if (!fields.includes(n)) fields.push(n);
        updateRun({ ...cur, data: merged, fields });
      } catch {
        showToast('Ergebnisse konnten nicht gespeichert werden — Browser-Speicher voll? Bitte Seite nicht neu laden.', 'error', 10000);
      }
    };
    const next = persistQueue.current.then(job, job);
    persistQueue.current = next;
    return next;
  };

  // Alle Spalten, die zu einer KI-Config gehören (Roh-Antwort, Splits, Regeln)
  const aiOwnedNames = useMemo(() => {
    const s = new Set<string>();
    for (const cfg of aiConfigs) {
      s.add(cfg.name);
      cfg.outputFields?.forEach(f => s.add(f));
      cfg.derived?.forEach(d => s.add(d.name));
    }
    return s;
  }, [aiConfigs]);

  // Config-Spalten immer als KI-Spalten zeigen: noch nicht gelaufene als
  // '·'-Platzhalter, bereits persistierte (nach Reload) mit ihren CSV-Werten —
  // so behalten sie ⚙/▶ und können erneut laufen (Cache überspringt Unverändertes).
  // Abgeleitet statt in den State synchronisiert: aiColumns hält nur, was
  // tatsächlich gelaufen ist; Platzhalter entstehen beim Rendern. Reihenfolge
  // folgt den Configs (Roh-Antwort, Splits, Regeln), Fremdspalten hinten.
  const displayAiColumns = useMemo(() => {
    if (!run) return aiColumns;
    const byName = new Map(aiColumns.map(c => [c.name, c]));
    const ordered: AiColumn[] = [];
    for (const n of aiOwnedNames) {
      ordered.push(byName.get(n) ?? {
        name: n,
        values: run.fields.includes(n) ? run.data.map(r => r[n] ?? '') : Array(run.data.length).fill(PENDING),
      });
    }
    for (const c of aiColumns) if (!aiOwnedNames.has(c.name)) ordered.push(c);
    return ordered;
  }, [run, aiColumns, aiOwnedNames]);

  /** Config zu einer Spalte finden — auch für gesplittete Output-/Regel-Spalten */
  const findCfgForColumn = useCallback((name: string) =>
    aiConfigs.find(c =>
      c.name === name || c.outputFields?.includes(name) || c.derived?.some(d => d.name === name)),
  [aiConfigs]);

  /** "+ KI-Spalte": column appears in the table immediately, no popup */
  const addAiColumn = () => {
    if (!run) return;
    if (providers.length === 0) return showToast('Kein KI-API Key konfiguriert — Einstellungen prüfen', 'warning');
    let n = aiConfigs.length + 1;
    let name = `Analyse ${n}`;
    while (aiColumns.some(c => c.name === name) || aiConfigs.some(c => c.name === name)) name = `Analyse ${++n}`;
    const provider = providers[0];
    const cfg: AnalysisConfig = {
      id: `cfg_${Date.now()}`, name, provider,
      model: defaultModel(provider), prompt: '',
    };
    persistConfigs([...aiConfigs, cfg]);
    upsertAiColumn(name, Array(run.data.length).fill(PENDING));
    setScrollSignal(s => s + 1); // Tabelle scrollt zur neuen Spalte am rechten Ende
    // Open the editor right away so it's obvious the column was created
    setEditingId(cfg.id);
    showToast(`Spalte «${name}» angelegt — Prompt eingeben und Analysieren`, 'info');
  };

  /** ⚙-Panel: Patch auf eine Config anwenden (Umbenennen zieht die Tabellenspalte mit) */
  const updateConfig = (cfgId: string, patch: Partial<AnalysisConfig>) => {
    const cur = aiConfigs.find(c => c.id === cfgId);
    if (!cur) return;
    if (patch.name && patch.name !== cur.name) renameAiColumn(cur.name, patch.name);
    persistConfigs(aiConfigs.map(c => {
      if (c.id !== cfgId) return c;
      const next = { ...c, ...patch };
      // Prompt-Version als angepasst markieren, sobald der Prompt abweicht
      if (patch.prompt !== undefined && patch.prompt !== c.prompt && c.promptVersion && !c.promptVersion.endsWith('*')) {
        next.promptVersion = `${c.promptVersion}*`;
      }
      return next;
    }));
  };

  const deleteConfig = (cfgId: string) => {
    const cur = aiConfigs.find(c => c.id === cfgId);
    if (!cur) return;
    setAiColumns(prev => prev.filter(c => c.name !== cur.name));
    persistConfigs(aiConfigs.filter(c => c.id !== cfgId));
    setEditingId(null);
  };

  const runColumn = async (cfg: AnalysisConfig) => {
    if (!run || colRunning[cfg.id]) return;
    if (!cfg.prompt.trim()) { setEditingId(cfg.id); return showToast('Erst einen Prompt eingeben (⚙)', 'warning'); }
    // Nie auf einem veralteten Stand klassifizieren: der Lauf schreibt die ganze CSV zurück
    // und würde die Ergebnisse eines Kollegen überschreiben
    const csvKey = `csv_text_${id}`;
    if (remoteChanged || (remoteStamp(csvKey) && remoteStamp(csvKey) !== localStamp(csvKey) && !hasPending(csvKey))) {
      setRemoteChanged(true);
      return showToast('Dieser Datensatz wurde inzwischen geändert — erst «↻ Neu laden», dann analysieren', 'warning', 7000);
    }
    setColRunning(p => ({ ...p, [cfg.id]: true }));

    // Declared outside the try so a mid-run failure (e.g. chunk 3 of 5 hits a
    // network error) can still persist whatever chunks already completed —
    // otherwise already-paid-for API results only ever lived in React state
    // and a reload (or even a bare retry, since the cache hash never saved)
    // would silently discard and re-bill them.
    let merged: string[] | null = null;
    let lastSplit: Record<string, string[]> | null = null;
    const promptHash = shortHash([cfg.provider, cfg.model, cfg.prompt, ...(cfg.inputColumns ?? [])].join('\x1f'));
    const rowHashes = run.data.map(r => rowFingerprint(r, cfg.inputColumns));
    const hashKey = `analysis_hashes_${id}`;
    await ensureLocalKey(hashKey); // Cache eines Kollegen/anderen Geräts übernehmen — sonst würde alles neu klassifiziert
    let allHashes: Record<string, { promptHash: string; rowHashes: string[] }> = {};
    try { allHashes = JSON.parse(localStorage.getItem(hashKey) ?? '{}'); } catch {}

    const persistProgress = async () => {
      if (!merged || !merged.some(v => v !== PENDING)) return;
      const derived = lastSplit && cfg.derived?.length ? applyDerivedRules(cfg.derived, lastSplit, run.data.length) : {};
      for (const [n, v] of Object.entries(derived)) upsertAiColumn(n, v);
      await persistColumnsToCsv({ [cfg.name]: merged, ...(lastSplit ?? {}), ...derived });
      allHashes[cfg.id] = { promptHash, rowHashes };
      lsSet(hashKey, JSON.stringify(allHashes));
      return derived;
    };

    try {
      const apiKey = (loadSettings().apiKeys as Record<string, string>)[cfg.provider] || undefined;
      const multi = !!cfg.outputFields?.length;

      // feld_hash-Caching (wie im Sheet): Zeilen mit unverändertem Prompt und
      // unveränderten Eingabewerten, die schon ein brauchbares Ergebnis haben,
      // werden nicht erneut klassifiziert. Fehler-Zeilen laufen automatisch neu.
      const prev = allHashes[cfg.id];
      const existing = displayAiColumns.find(c => c.name === cfg.name)?.values
        ?? run.data.map(r => r[cfg.name] ?? '');
      const todo: number[] = [];
      for (let i = 0; i < run.data.length; i++) {
        const cached = prev?.promptHash === promptHash
          && prev.rowHashes[i] === rowHashes[i]
          && isUsableAiValue(existing[i]);
        if (!cached) todo.push(i);
      }
      if (todo.length === 0) {
        showToast('Alle Zeilen bereits klassifiziert — nichts zu tun', 'info');
        return;
      }
      const skipped = run.data.length - todo.length;
      const todoSet = new Set(todo);
      // Persistenter Mal-Puffer: fertige Werte werden genau EINMAL normalisiert
      // (statt bei jedem Progress-Tick die ganze Liste erneut) und dann nur noch
      // kopiert — bei 1000 Zeilen × 50 Chunks spart das ~98% der Normalisierung.
      merged = run.data.map((_, i) => (todoSet.has(i) ? PENDING : existing[i]));
      let normalizedUpTo = 0;
      const paint = (vals: string[]) => {
        for (let j = normalizedUpTo; j < vals.length; j++) {
          if (vals[j] === PENDING) continue;
          merged![todo[j]] = multi ? normalizeMultiOutput(vals[j], cfg.outputFields!, cfg.outputEnums) : vals[j];
          if (j === normalizedUpTo) normalizedUpTo++;
        }
        upsertAiColumn(cfg.name, [...merged!]);
        // Multi-Output: Antwort live in die Einzelspalten splitten
        if (multi) {
          const split = splitMultiOutput(merged!, cfg.outputFields!);
          for (const [n, v] of Object.entries(split)) upsertAiColumn(n, v);
          lastSplit = split;
          return split;
        }
        return null;
      };

      const subValues = await runAiColumn({
        rows: todo.map(i => run.data[i]),
        provider: cfg.provider,
        model: cfg.model,
        prompt: cfg.prompt,
        apiKey,
        inputColumns: cfg.inputColumns,
        multiOutput: multi,
        onProgress: (partial) => {
          paint(partial);
          setColProgress(p => ({ ...p, [cfg.id]: merged!.filter(v => v !== PENDING).length }));
        },
      });
      paint(subValues);
      const failed = todo.filter(i => isAiError(merged![i])).length;

      await persistProgress();
      const parts: string[] = [`${todo.length - failed} klassifiziert`];
      if (skipped > 0) parts.push(`${skipped} übersprungen (unverändert)`);
      if (failed > 0) parts.push(`${failed} ungültig — erneut ▶ drücken`);
      showToast(`«${cfg.name}»: ${parts.join(', ')}`, failed > 0 ? 'warning' : 'success', failed > 0 ? 7000 : undefined);
    } catch (e) {
      // Whatever chunks completed before the failure are still worth keeping —
      // save them so a retry only redoes what's actually still pending.
      const savedPartial = await persistProgress().catch(() => undefined) !== undefined;
      const msg = e instanceof Error ? e.message : 'Fehler';
      showToast(savedPartial ? `${msg} — bereits klassifizierte Zeilen wurden gespeichert.` : msg, 'error', 8000);
    } finally {
      setColRunning(p => ({ ...p, [cfg.id]: false }));
      setColProgress(p => ({ ...p, [cfg.id]: 0 }));
    }
  };

  /** ▶ an einer Spalte (auch Split-/Regel-Spalte): zugehörige Config ausführen */
  const runColumnByName = (name: string) => {
    const cfg = findCfgForColumn(name);
    if (cfg) runColumn(cfg);
    else showToast('Für diese Spalte gibt es keine Konfiguration', 'warning');
  };

  // Autorun («▶ Laden + Analysieren», KI-Spalten mit «direkt ausfüllen» —
  // beim Import oder aus dem «+ KI-Spalte»-Menü): der Viewer füllt die vorgemerkten
  // Spalten selbst aus, sobald Daten und Configs da sind — nacheinander, damit
  // Provider-Rate-Limits nicht doppelt getroffen werden. Das Flag wird sofort
  // entfernt, damit auch StrictMode-Doppel-Effekte nur einmal starten.
  useEffect(() => {
    if (!run || aiConfigs.length === 0) return;
    const ids = readAutorunIds(id);
    if (!ids) return;
    try { localStorage.removeItem(AUTORUN_KEY(id)); } catch {}
    const list = (ids === 'first'
      ? [aiConfigs.find(c => c.prompt.trim())]
      : ids.map(i => aiConfigs.find(c => c.id === i && c.prompt.trim()))
    ).filter((c): c is AnalysisConfig => !!c);
    if (list.length === 0) return;
    // Nach dem Commit starten — kein synchrones setState im Effect
    queueMicrotask(async () => {
      showToast(list.length === 1 ? `Klassifizierung «${list[0].name}» startet…` : `${list.length} KI-Spalten werden ausgefüllt…`, 'info');
      for (const cfg of list) await runColumn(cfg);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, aiConfigs, id]);

  /**
   * Gespeicherte KI-Spalte in diesen Datensatz laden. Ob sie sofort ausgefüllt
   * wird, entscheidet ihr Schalter «direkt ausfüllen» (autoRun); dieselbe
   * KI-Spalte lässt sich nicht zweimal laden (applyPresets prüft Herkunft + Name).
   */
  const loadPreset = (preset: ImportPreset) => {
    if (!run) return;
    if (providers.length === 0) return showToast('Kein KI-API Key konfiguriert — Einstellungen prüfen', 'warning');
    const provider = providers.includes('anthropic') ? 'anthropic' : providers[0];
    const { added, autoRun: toRun } = applyPresets(id, [preset], provider, { providers });
    if (added.length === 0) return showToast(`«${preset.name}» ist in diesem Datensatz schon geladen`, 'info');
    setAiConfigs(loadAiConfigs(id)); // löst bei autoRun den Autorun-Effect aus
    setScrollSignal(s => s + 1);
    if (toRun.length === 0) {
      showToast(`KI-Spalte «${preset.name}» angehängt — mit ▶ ausfüllen`, 'success');
    }
  };

  /** ⚙-Panel: diese KI-Spalte in den Einstellungen speichern — die Config merkt sich die Herkunft */
  const saveTemplate = (cfg: AnalysisConfig, flags: PresetFlags) => {
    if (!cfg.prompt.trim()) return showToast('Erst einen Prompt eingeben', 'warning');
    // Gleicher Titel = dieselbe gespeicherte KI-Spalte (aktualisieren), außer sie ist eingebaut
    const existing = getEffectivePresets().find(p => p.columns[0]?.name === cfg.name);
    if (existing && !existing.userDefined) return showToast(`«${cfg.name}» ist eine eingebaute KI-Spalte — Spalte erst umbenennen`, 'warning');
    const ownId = cfg.presetId ?? existing?.id;
    const preset = saveUserPreset({ ...presetFromConfigs(cfg.name, [cfg], flags), ...(ownId ? { id: ownId } : {}) });
    persistConfigs(aiConfigs.map(c => (c.id === cfg.id ? { ...c, presetId: preset.id } : c)));
    const auto = Object.values(flags.autoAdd ?? {}).some(Boolean);
    showToast(
      `KI-Spalte «${preset.name}» gespeichert${auto ? ` — wird beim Import automatisch geladen${flags.autoRun ? ' und ausgefüllt' : ''}` : ''} · Einstellungen → KI-Spalten`,
      'success', 6000,
    );
  };

  const editingCfg = aiConfigs.find(c => c.id === editingId) ?? null;

  const [matching, setMatching] = useState(false);
  const matchedRef = useRef(false);

  /**
   * Lead-Gedächtnis: Zeilen gegen alle anderen Datensätze abgleichen und
   * «bekannt_aus» / «exportiert_am» in den Datensatz schreiben.
   */
  const runMatch = async (opts: { silent?: boolean } = {}) => {
    const cur = runRef.current;
    if (!cur || matching) return;
    setMatching(true);
    try {
      const { index, datasets } = await buildKnownIndex(id);
      // Ohne Vergleichsdatensatz keine leeren Spalten anlegen
      if (datasets === 0 && !cur.fields.includes(KNOWN_COL)) {
        if (!opts.silent) showToast('Abgleich: keine anderen Datensätze vorhanden — alles neu', 'info');
        return;
      }
      const m = matchKnown(cur.data, index);
      const cols: Record<string, string[]> = { [KNOWN_COL]: m.knownFrom, [EXPORTED_COL]: m.exportedAt };
      // Anderswo schon enrichte Kontakte übernehmen — nur, wenn es etwas zu übernehmen gibt
      if (m.emailsCopied > 0) cols[EMAIL_COL] = m.email;
      if (m.phonesCopied > 0) cols[PHONE_COL] = m.phone;
      const unchanged = cur.fields.includes(KNOWN_COL) && m.emailsCopied === 0 && m.phonesCopied === 0
        && cur.data.every((r, i) => String(r[KNOWN_COL] ?? '') === m.knownFrom[i] && String(r[EXPORTED_COL] ?? '') === m.exportedAt[i]);
      if (!unchanged) await persistColumnsToCsv(cols);
      if (!opts.silent || m.known > 0) {
        const copied = [m.emailsCopied > 0 && `${m.emailsCopied} E-Mails`, m.phonesCopied > 0 && `${m.phonesCopied} Telefonnummern`].filter(Boolean).join(' und ');
        showToast(
          datasets === 0
            ? 'Abgleich: keine anderen Datensätze vorhanden — alles neu'
            : `Abgleich mit ${datasets} Datensätzen: ${m.known} bereits bekannt, ${m.exported} bereits exportiert, ${cur.data.length - m.known} neu${copied ? ` · ${copied} aus früheren Enrichments übernommen` : ''}`,
          m.known > 0 ? 'warning' : 'info', 7000,
        );
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Abgleich fehlgeschlagen', 'error');
    } finally { setMatching(false); }
  };

  // Einmal automatisch, sobald ein Datensatz ohne Abgleich-Spalte geladen wurde
  useEffect(() => {
    if (!run || matchedRef.current || run.fields.includes(KNOWN_COL)) return;
    matchedRef.current = true;
    queueMicrotask(() => { runMatch({ silent: true }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  /** Zeilen als exportiert markieren (Outreach-Export) */
  const markExported = (idx: number[]) => {
    const cur = runRef.current;
    if (!cur || idx.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const col = cur.data.map(r => String(r[EXPORTED_COL] ?? ''));
    for (const i of idx) col[i] = today;
    persistColumnsToCsv({ [EXPORTED_COL]: col });
  };

  return {
    matching, runMatch, markExported,
    run, error, providers, remoteChanged, reloadFromServer,
    aiConfigs, aiOwnedNames, displayAiColumns,
    colRunning, colProgress, scrollSignal,
    editingId, setEditingId, editingCfg,
    findCfgForColumn, addAiColumn, updateConfig, deleteConfig,
    runColumn, runColumnByName, loadPreset, saveTemplate,
  };
}
