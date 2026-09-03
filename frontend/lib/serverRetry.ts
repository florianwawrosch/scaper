// Server-side fetch with a short retry for transient provider failures.
// Claude/Gemini/OpenAI answer 429 (rate limit) or 529/503 (overloaded) for
// a moment when we hit them 4-8 wide; without a retry every such hiccup
// becomes a "Fehler:" row the user has to re-run by hand. Total added delay
// is capped so a route stays well inside its 60s maxDuration.

const RETRY_STATUS = new Set([429, 500, 502, 503, 504, 529]);
const MAX_DELAY_MS = 5000;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function retryDelay(res: Response | null, attempt: number, baseMs: number): number {
  const ra = Number(res?.headers.get('retry-after'));
  const fromHeader = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 0;
  return Math.min(MAX_DELAY_MS, fromHeader || baseMs * 2 ** attempt);
}

export async function fetchRetry(
  url: string,
  init?: RequestInit,
  opts: { retries?: number; baseMs?: number } = {},
): Promise<Response> {
  const { retries = 2, baseMs = 1000 } = opts;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      // A timeout (AbortSignal.timeout) must not be retried — that would
      // multiply the wait and blow the route's time budget. Plain network
      // errors (reset, DNS blip) are worth one more try.
      const name = e instanceof Error ? e.name : '';
      if (name === 'TimeoutError' || name === 'AbortError' || attempt >= retries) throw e;
      await sleep(retryDelay(null, attempt, baseMs));
      continue;
    }
    if (!RETRY_STATUS.has(res.status) || attempt >= retries) return res;
    await sleep(retryDelay(res, attempt, baseMs));
  }
}
