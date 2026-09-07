// Serverseitige Aufrufe der KI-Anbieter (Gemini, Claude, GPT) — genutzt von
// /api/ai/analyze (Klassifizierung) und /api/keys/test (Verbindungstest).
// Keys kommen ausschließlich aus den Umgebungsvariablen (lib/serverKeys.ts).
import { fetchRetry } from './serverRetry';

/** Loose shape of the three providers' JSON — only the fields we read. */
interface ProviderJson {
  error?: { message?: string };
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  content?: { text?: string }[];
  choices?: { message?: { content?: string } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  usage?: { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
}

export interface AiAnswer { text: string; input: number; output: number }
const tok = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

async function readJson(res: Response): Promise<ProviderJson> {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error(text.slice(0, 200) || `HTTP ${res.status}`); }
}

/** Ein Prompt an einen Anbieter; Fehler kommen als «Fehler: …» im Text zurück (nie als Exception) */
export async function callAi(provider: string, model: string, prompt: string, key: string, timeoutMs = 30_000): Promise<AiAnswer> {
  try {
    if (provider === 'gemini') {
      const res = await fetchRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      return { text: (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '—').trim(), input: tok(data.usageMetadata?.promptTokenCount), output: tok(data.usageMetadata?.candidatesTokenCount) };
    }
    if (provider === 'anthropic') {
      const res = await fetchRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model, max_tokens: 256, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      return { text: (data.content?.[0]?.text ?? '—').trim(), input: tok(data.usage?.input_tokens), output: tok(data.usage?.output_tokens) };
    }
    if (provider === 'openai') {
      const res = await fetchRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, max_tokens: 256, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      return { text: (data.choices?.[0]?.message?.content ?? '—').trim(), input: tok(data.usage?.prompt_tokens), output: tok(data.usage?.completion_tokens) };
    }
    return { text: `Fehler: Unbekannter Provider ${provider}`, input: 0, output: 0 };
  } catch (e) {
    return { text: `Fehler: ${friendlyAiError(e instanceof Error ? e.message : String(e))}`, input: 0, output: 0 };
  }
}

/** Häufige Anbieter-Fehler in handlungsfähige deutsche Meldungen übersetzen */
export function friendlyAiError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('exceeded your current quota') || m.includes('insufficient_quota') || m.includes('no credits remaining')) {
    return 'OpenAI-Guthaben aufgebraucht — unter platform.openai.com → Billing aufladen.';
  }
  if (m.includes('credit balance is too low') || m.includes('purchase credits')) {
    return 'Anthropic-Guthaben fehlt — unter console.anthropic.com → Plans & Billing aufladen.';
  }
  if (m.includes('billing') && (m.includes('not enabled') || m.includes('not activated') || m.includes('enable billing'))) {
    return 'Gemini: Abrechnung nicht aktiviert — unter aistudio.google.com bzw. console.cloud.google.com → Billing einrichten.';
  }
  if (m.includes('incorrect api key') || m.includes('invalid api key') || m.includes('invalid x-api-key') || m.includes('api key not valid') || m.includes('authentication_error') || m.includes('permission_denied')) {
    return 'API-Key ungültig — Variable in Vercel prüfen (Einstellungen → Integrationen).';
  }
  if (m.includes('rate limit') || m.includes('429') || m.includes('overloaded') || m.includes('resource_exhausted') || m.includes('quota exceeded')) {
    return 'Rate-Limit oder Kontingent erreicht — kurz warten und erneut versuchen.';
  }
  if (m.includes('model') && (m.includes('not found') || m.includes('does not exist') || m.includes('not_found'))) {
    return 'Modell nicht verfügbar — anderes Modell im ⚙-Panel wählen.';
  }
  return msg;
}
