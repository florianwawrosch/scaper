'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/app/components/Toast';
import { loadSettings, saveSettings, type AppSettings } from '@/lib/settings';

export default function Settings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState({
    meta_ads: '',
    hunter_io: '',
    findymail: '',
    anthropic: '',
    gemini: '',
    openai: '',
  });
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-2.0-flash');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const settings = loadSettings();
    setApiKeys(settings.apiKeys);
    setAiProvider(settings.aiConfig.provider);
    setAiModel(settings.aiConfig.model);
    setLoading(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings: AppSettings = {
        apiKeys,
        aiConfig: {
          provider: aiProvider as 'gemini' | 'anthropic' | 'openai',
          model: aiModel,
        },
        defaults: {
          countries: ['DE', 'AT'],
          platforms: ['FACEBOOK', 'INSTAGRAM'],
        },
      };
      saveSettings(settings);
      showToast('Einstellungen gespeichert', 'success');
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const modelsByProvider = {
    gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4.5-20251001'],
    openai: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-noir">
        <p className="text-ink-dim">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="border-t border-gold-dim border-b border-line mb-8 py-4">
          <div className="absolute w-[100px] h-px bg-gold -translate-y-[12px]" />
          <h1 className="text-3xl font-disp font-light mb-1">
            <em className="italic text-gold-bright">Einstellungen</em>
          </h1>
          <p className="text-ink-dim text-xs font-light">API-Keys und Konfiguration</p>
        </div>

        <div className="space-y-6">
          {/* API Keys Section */}
          <div className="bg-panel-2 border border-line-soft rounded p-4">
            <h3 className="font-mono text-xs tracking-wider text-ink-faint mb-4 font-medium">
              API Keys
            </h3>
            <div className="space-y-3">
              {[
                { key: 'meta_ads', label: 'Meta Ads Library Token' },
                { key: 'hunter_io', label: 'Hunter.io API Key' },
                { key: 'findymail', label: 'FindyMail API Key' },
                { key: 'gemini', label: 'Google Gemini API Key' },
                { key: 'anthropic', label: 'Anthropic API Key' },
                { key: 'openai', label: 'OpenAI API Key' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                    {label}
                  </label>
                  <input
                    type="password"
                    value={apiKeys[key as keyof typeof apiKeys]}
                    onChange={(e) =>
                      setApiKeys({
                        ...apiKeys,
                        [key]: e.target.value,
                      })
                    }
                    placeholder={`Gib deinen ${label} ein...`}
                    className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* AI Configuration */}
          <div className="bg-panel-2 border border-line-soft rounded p-4">
            <h3 className="font-mono text-xs tracking-wider text-ink-faint mb-4 font-medium">
              AI Konfiguration
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                  AI Provider
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => {
                    setAiProvider(e.target.value);
                    const models = modelsByProvider[e.target.value as keyof typeof modelsByProvider];
                    if (models) setAiModel(models[0]);
                  }}
                  className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="openai">OpenAI GPT</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                  AI Modell
                </label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm"
                >
                  {modelsByProvider[aiProvider as keyof typeof modelsByProvider]?.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Default Settings */}
          <div className="bg-panel-2 border border-line-soft rounded p-4">
            <h3 className="font-mono text-xs tracking-wider text-ink-faint mb-4 font-medium">
              Defaults
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                  Standard-Länder
                </label>
                <input
                  type="text"
                  defaultValue="DE, AT, CH"
                  className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-ink-faint mb-1">
                  Standard-Plattformen
                </label>
                <input
                  type="text"
                  defaultValue="FACEBOOK, INSTAGRAM"
                  className="w-full bg-panel-3 border border-line rounded text-ink px-2.5 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-8 bg-gradient-to-r from-gold to-gold-dim text-noir rounded hover:from-gold-bright hover:to-gold transition-colors text-xs font-medium font-semibold disabled:opacity-50"
            >
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          </div>

          {/* Info */}
          <div className="bg-panel-3 rounded p-4 text-xs text-ink-dim">
            <p className="mb-2 font-semibold text-ink">💡 Info</p>
            <p className="mb-1">API-Keys werden verschlüsselt gespeichert.</p>
            <p>Nie teilen oder in Git committen!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
