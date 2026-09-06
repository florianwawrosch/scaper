'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { loadSavedSearches, saveSavedSearch, deleteSavedSearch, type SavedSearch } from '@/lib/savedSearches';
import { fetchKeyAvailability } from '@/lib/keyAvailability';
import { loadBlocklist } from '@/lib/blocklist';
import { deleteCsvRun, listCsvRuns, type CsvRunSummary } from '@/lib/csvRuns';
import { HistoryPanel } from '@/app/components/HistoryPanel';
import { STORE_EVENT } from '@/lib/store';
import { presetsForSource, applyPresets, pickPresetProvider, availableProviders, type PresetSource } from '@/lib/aiTemplates';
import { useCsvImport } from '@/app/hooks/useCsvImport';
import { useScrapeForm, DEFAULT_FORM } from '@/app/hooks/useScrapeForm';
import { useToast } from '@/app/components/Toast';
import { PresetSelector } from '@/app/components/PresetSelector';
import { SavedSearchesModal } from '@/app/components/SavedSearchesModal';
import { ScrapeForm } from '@/app/components/ScrapeForm';
import { T } from '@/app/theme';

// Alte gespeicherte Suchen kennen nicht jedes Feld — fehlende auf Standard setzen
const DEFAULT_FORM_SEARCH = { keywords: DEFAULT_FORM.tags, country: DEFAULT_FORM.country, platforms: DEFAULT_FORM.platforms, adStatus: DEFAULT_FORM.adStatus };

export default function Home() {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [csvRuns,        setCsvRuns]        = useState<CsvRunSummary[]>([]);
  const [presets,        setPresets]        = useState<Record<string, SavedSearch>>({});
  const [presetName,     setPresetName]     = useState('');
  const [showPresets,    setShowPresets]    = useState(false);
  const [backendKeys,    setBackendKeys]    = useState<Record<string, boolean>>({});
  const [blockCount,     setBlockCount]     = useState(0);

  useEffect(() => {
    // Local history renders instantly — no waiting for any network call.
    // localStorage gibt es erst im Browser: ein lazy useState würde beim
    // SSR-Prerender leer rendern und beim Hydrate springen — daher Effect.
    // Der gemeinsame Speicher (andere Geräte/Kollegen) löst ein erneutes Lesen aus.
    const readLocal = () => {
      setPresets(loadSavedSearches());
      setCsvRuns(listCsvRuns());
      setBlockCount(loadBlocklist().length);
    };
    readLocal();
    window.addEventListener(STORE_EVENT, readLocal);

    fetchKeyAvailability().then(setBackendKeys);
    return () => window.removeEventListener(STORE_EVENT, readLocal);
  }, []);

  const deleteCsvImport = async (csvId: string) => {
    try {
      await deleteCsvRun(csvId);
      setCsvRuns(prev => prev.filter(c => c.id !== csvId));
      showToast('Import gelöscht', 'success');
    } catch {
      showToast('Löschen fehlgeschlagen', 'error');
    }
  };

  /**
   * Instant-Load-KI-Spalten (Einstellungen → KI-Spalten) für eine Import-Quelle
   * direkt anhängen — ohne Dialog; «direkt ausfüllen» startet der Viewer beim
   * Laden. Liefert die IDs der geladenen KI-Spalten.
   */
  const autoApplyPresets = useCallback((runId: string, source: PresetSource): Set<string> => {
    const presets = presetsForSource(source);
    if (presets.length === 0) return new Set();
    const { added, autoRun } = applyPresets(runId, presets, pickPresetProvider(backendKeys), { providers: availableProviders(backendKeys) });
    if (added.length > 0) {
      const names = presets.map(p => `«${p.name}»`).join(', ');
      showToast(
        autoRun.length > 0
          ? `${presets.length === 1 ? 'KI-Spalte' : 'KI-Spalten'} ${names} geladen — KI füllt direkt aus`
          : `${presets.length === 1 ? 'KI-Spalte' : 'KI-Spalten'} ${names} automatisch geladen — mit ▶ ausfüllen`,
        'success', 5000,
      );
    }
    return new Set(presets.map(p => p.id));
  }, [backendKeys, showToast]);

  const form = useScrapeForm({ autoApplyPresets });
  const { tags, toConfig, applyConfig, setFormError } = form;

  const { csvFile, uploading, dragOver, importFile, aiPresetPrompt, setAiPresetPrompt } =
    useCsvImport({ autoApplyPresets, onError: setFormError });

  const savePreset = () => {
    const auto = tags[0] ?? new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const name = presetName.trim() || auto;
    setPresets(saveSavedSearch(name, toConfig()));
    setPresetName('');
  };

  const loadPreset = (name: string) => {
    const p = presets[name];
    if (!p) return;
    // Altes Format speichert «countries» statt «country» — das darf der Standard nicht überschreiben
    applyConfig({ ...DEFAULT_FORM_SEARCH, ...p, country: p.country ?? p.countries?.[0] ?? DEFAULT_FORM.country });
    setShowPresets(false);
  };


  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '20px 20px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>

          {/* ── Left: Scraper config ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <ScrapeForm
              form={form}
              savedCount={Object.keys(presets).length}
              onOpenSaved={() => setShowPresets(true)}
              presetName={presetName}
              setPresetName={setPresetName}
              onSavePreset={savePreset}
              csvFile={csvFile}
              uploading={uploading}
              onPickFile={() => fileInputRef.current?.click()}
              blockCount={blockCount}
              onBlocklist={() => router.push('/settings?tab=blocklist')}
            />

            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); }} />

          </div>

          {/* ── Right: history ── */}
          <HistoryPanel runs={csvRuns} onOpen={id => router.push(`/csv/${id}`)} onDelete={deleteCsvImport} onAll={() => router.push('/runs')} />

        </div>
      </div>

      {/* ── Saved Searches Modal ── */}
      {showPresets && (
        <SavedSearchesModal
          searches={presets}
          onLoad={loadPreset}
          onDelete={(name) => setPresets(deleteSavedSearch(name))}
          onClose={() => setShowPresets(false)}
        />
      )}

      {/* ── KI-Spalten-Preset nach LinkedIn-Upload ── */}
      {aiPresetPrompt && (
        <PresetSelector
          filename={aiPresetPrompt.filename}
          presets={aiPresetPrompt.presets}
          onSelect={(presetId, autoRun) => {
            const { id } = aiPresetPrompt;
            if (presetId) {
              const preset = aiPresetPrompt.presets.find(p => p.id === presetId);
              if (preset) {
                // Spalte anhängen (Instant-Load-KI-Spalten sind evtl. schon drin);
                // bei autoRun merkt applyPresets die Configs für den Viewer vor
                const { added, autoRun: toRun } = applyPresets(id, [preset], pickPresetProvider(backendKeys), { forceAutoRun: !!autoRun, providers: availableProviders(backendKeys) });
                if (added.length > 0 && toRun.length === 0) {
                  showToast(`KI-Spalte «${preset.name}» geladen — mit ▶ ausfüllen`, 'success');
                }
              }
            }
            setAiPresetPrompt(null);
            router.push(`/csv/${id}`);
          }}
          onClose={() => {
            const { id } = aiPresetPrompt;
            setAiPresetPrompt(null);
            router.push(`/csv/${id}`);
          }}
        />
      )}

      {/* ── Full-page drag overlay ── */}
      {dragOver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(7,7,10,.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16,
          border: `2px dashed ${T.gold}`,
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 48 }}>↓</div>
          <p style={{ fontFamily: T.ffDisp, fontSize: 28, fontWeight: 600, color: T.ink }}>CSV oder Excel loslassen</p>
          <p style={{ fontFamily: T.ffMono, fontSize: 12, color: T.inkD }}>Datei ablegen zum Importieren</p>
        </div>
      )}
    </div>
  );
}
