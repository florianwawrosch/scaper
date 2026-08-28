import { useState, useCallback } from 'react';
import { getAiConfig, getApiKey } from '@/lib/settings';
import { useToast } from '@/app/components/Toast';

export interface ClassificationRequest {
  runId: string;
  leads: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
  }>;
}

export interface ClassificationResult {
  id: string;
  status: 'KEEP' | 'REJECT' | 'UNCLEAR';
  reason: string;
}

export function useClassification() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const classify = useCallback(async (req: ClassificationRequest) => {
    setLoading(true);
    setError(null);

    try {
      const aiConfig = getAiConfig();
      const apiKey = getApiKey(aiConfig.provider);

      if (!apiKey) {
        throw new Error(`${aiConfig.provider} API Key not configured in Settings`);
      }

      // Call classification backend endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runId: req.runId,
          leads: req.leads,
          aiProvider: aiConfig.provider,
          aiModel: aiConfig.model,
          apiKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`Classification failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data.results);
      showToast(`${data.results.length} Leads klassifiziert`, 'success');

      return data.results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Classification failed';
      setError(message);
      showToast(message, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  return {
    classify,
    loading,
    results,
    error,
  };
}
