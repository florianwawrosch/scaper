// runAiColumn: parallele Chunks liefern Werte in Zeilenreihenfolge, Fortschritt streamt,
// Gemini bleibt sequenziell, ein fehlgeschlagener Chunk wirft mit Server-Detail
const { ok, lib } = require('./setup');
const { runAiColumn, PENDING } = lib('ai');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function fakeFetch({ latency = 30, failAt = -1, calls }) {
  let inflight = 0, maxInflight = 0, n = 0;
  global.fetch = async (_url, init) => {
    const idx = n++;
    const body = JSON.parse(init.body);
    inflight++; maxInflight = Math.max(maxInflight, inflight);
    await delay(latency + (idx % 2) * 20); // ungleiche Laufzeiten → Chunks enden außer der Reihe
    inflight--;
    calls.push(body.prompts.length);
    if (idx === failAt) return { ok: false, status: 500, json: async () => ({ detail: 'Provider kaputt' }) };
    return { ok: true, json: async () => ({ values: body.prompts.map(p => 'v:' + p.match(/id: (\d+)/)[1]) }) };
  };
  return () => maxInflight;
}

(async () => {
  const rows = Array.from({ length: 95 }, (_, i) => ({ id: String(i), text: 'x' }));

  // --- anthropic: 3 Chunks parallel, Reihenfolge korrekt ---
  let calls = []; let progress = [];
  let peak = await fakeFetch({ calls });
  const out = await runAiColumn({ rows, provider: 'anthropic', model: 'm', prompt: 'p', onProgress: v => progress.push([...v]) });
  ok(out.length === 95 && out.every((v, i) => v === 'v:' + i), 'alle 95 Werte in Zeilenreihenfolge');
  ok(calls.length === 5 && [...calls].sort((a, b) => b - a).join() === '20,20,20,20,15', `5 Chunks (4×20 + 15) — ${calls.join()}`);
  ok(peak() === 3, `anthropic: 3 Chunks gleichzeitig (peak ${peak()})`);
  ok(progress.length === 5 && progress[0].filter(v => v !== PENDING).length === 20 && progress[4].every(v => v !== PENDING), 'onProgress nach jedem Chunk; erst 20 gefüllt, am Ende alle');
  ok(progress.some(p => p.slice(20, 40).some(v => v === PENDING) && p.slice(40, 60).every(v => v !== PENDING)), 'Chunks dürfen außer der Reihe fertig werden (Chunk 3 vor Chunk 2)');

  // --- gemini: sequenziell ---
  calls = []; peak = await fakeFetch({ calls });
  await runAiColumn({ rows: rows.slice(0, 60), provider: 'gemini', model: 'm', prompt: 'p' });
  ok(peak() === 1 && calls.length === 3, `gemini: nur 1 Chunk gleichzeitig (peak ${peak()}), 3 Calls`);

  // --- explizit parallel: 2 ---
  calls = []; peak = await fakeFetch({ calls });
  await runAiColumn({ rows: rows.slice(0, 60), provider: 'openai', model: 'm', prompt: 'p', parallel: 2 });
  ok(peak() === 2, `parallel-Option überschreibt Provider-Standard (peak ${peak()})`);

  // --- Fehler im 2. Chunk ---
  calls = []; progress = []; await fakeFetch({ calls, failAt: 1 });
  let err = null;
  try { await runAiColumn({ rows: rows.slice(0, 60), provider: 'anthropic', model: 'm', prompt: 'p', onProgress: v => progress.push([...v]) }); }
  catch (e) { err = e; }
  ok(err && err.message === 'Provider kaputt', `Fehler-Chunk wirft mit Server-Detail («${err && err.message}»)`);
  ok(progress.length >= 1 && progress.some(p => p.slice(0, 20).every(v => v !== PENDING)), 'erfolgreiche Chunks haben ihre Werte vor dem Fehler geliefert');
})();
