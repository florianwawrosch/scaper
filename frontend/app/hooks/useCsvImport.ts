'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createCsvRun } from '@/lib/csvRuns';
import { parseImportFile, isImportFile } from '@/lib/csvImport';
import { getEffectivePresets, detectPreset, type ImportPreset, type PresetSource } from '@/lib/aiTemplates';

export interface PresetPrompt { id: string; filename: string; presets: ImportPreset[] }

interface Options {
  /** Instant-Load-Vorlagen anhängen; liefert die IDs der geladenen Vorlagen */
  autoApplyPresets: (runId: string, source: PresetSource) => Set<string>;
  /** Fehlertext für die Seite ('' = zurücksetzen) */
  onError: (msg: string) => void;
}

/**
 * CSV/Excel-Import der Startseite: Datei-Input und Drag-and-drop aufs ganze
 * Fenster, Parsen, Ablage als CSV-Run, Instant-Load-Vorlagen, optional der
 * LinkedIn-Vorlagen-Dialog — dann Navigation in den Viewer.
 */
export function useCsvImport({ autoApplyPresets, onError }: Options) {
  const router = useRouter();
  const [csvFile,        setCsvFile]        = useState<File | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const [dragOver,       setDragOver]       = useState(false);
  const [aiPresetPrompt, setAiPresetPrompt] = useState<PresetPrompt | null>(null);
  const dragCounter = useRef(0);

  const uploadCsv = useCallback(async (file: File) => {
    setUploading(true);
    onError('');
    try {
      const { fields, csvText, rowCount } = await parseImportFile(file);
      if (rowCount === 0) throw new Error('Datei enthält keine Zeilen.');
      let id: string;
      try { id = await createCsvRun({ filename: file.name, fields, csvText, rowCount }); }
      catch { throw new Error('Datei konnte nicht gespeichert werden. Bitte Browser-Speicher prüfen.'); }
      setUploading(false);
      const auto = autoApplyPresets(id, 'csv');
      // LinkedIn-Daten erkannt? → Preset-Auswahl anbieten statt direkt zu
      // navigieren — außer die Vorlage wurde ohnehin schon automatisch geladen.
      // Die Liste (erkanntes Preset zuerst) wird EINMAL hier berechnet.
      const detected = detectPreset(fields);
      if (detected && !auto.has(detected.id)) {
        const others = getEffectivePresets().filter(p => p.id !== detected.id && !auto.has(p.id));
        setAiPresetPrompt({ id, filename: file.name, presets: [detected, ...others] });
        return;
      }
      router.push(`/csv/${id}`);
    } catch (e) {
      setUploading(false);
      onError(e instanceof Error ? e.message : 'Datei konnte nicht gelesen werden.');
      setCsvFile(null);
    }
  }, [router, autoApplyPresets, onError]);

  /** Datei aus Input oder Drop übernehmen und importieren */
  const importFile = useCallback((file: File) => {
    if (!isImportFile(file.name)) { onError('Nur CSV/Excel-Dateien (.csv, .xlsx, .xls)'); return; }
    setCsvFile(file);
    uploadCsv(file);
  }, [uploadCsv, onError]);

  // Global drag-to-drop listeners (dragCounter: enter/leave feuern pro Kind-Element)
  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) { dragCounter.current++; setDragOver(true); }
    };
    const onLeave = () => {
      dragCounter.current--;
      if (dragCounter.current <= 0) { dragCounter.current = 0; setDragOver(false); }
    };
    const onOver = (e: DragEvent) => { e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragOver(false);
      const file = e.dataTransfer?.files[0];
      if (file) importFile(file);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [importFile]);

  return { csvFile, setCsvFile, uploading, dragOver, importFile, aiPresetPrompt, setAiPresetPrompt };
}
