// Konfliktschutz: Kollege B schreibt denselben Datensatz (eigene KI-Spalte, Meta, Configs) und
// die Blockliste, während A auf altem Stand arbeitet. A's Upload wird nicht still übernommen:
// der Server meldet 409, beide Stände werden zusammengeführt — nichts geht verloren.
const { playwright, login, mockKeys, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const settled = (p) => p.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('lp_sync_pending') || '{}')).length === 0, null, { timeout: 30000 });
(async () => {
  const browser = await chromium.launch();
  const ctxA = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const a = await ctxA.newPage();
  const ns = await login(a);
  await mockKeys(a, ['anthropic']);
  const errors = [];
  a.on('pageerror', e => errors.push(e.message));
  await a.route('**/api/ai/analyze', async route => {
    const body = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: body.prompts.map(() => 'ja'), usage: { input: 10, output: 1 } }) });
  });
  await a.goto(BASE_URL, { waitUntil: 'networkidle' });
  await settled(a);
  const id = 'csv_conflict_' + Date.now();
  await a.evaluate(async (id) => {
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['name', 'ad'], filename: 'Meta: konflikt', createdAt: new Date().toISOString(), rowCount: 2 }));
    localStorage.setItem(`analysis_configs_${id}`, JSON.stringify([{ id: 'cfg_a', provider: 'anthropic', model: 'claude-sonnet-5', name: 'ki_a', prompt: 'A?' }]));
    localStorage.setItem('blocklist', JSON.stringify([{ pageName: 'Alt', addedAt: new Date().toISOString() }]));
    const req = indexedDB.open('scaper_csv', 1);
    await new Promise((res, rej) => { req.onupgradeneeded = () => req.result.createObjectStore('files'); req.onsuccess = res; req.onerror = () => rej(req.error); });
    await new Promise((res, rej) => { const tx = req.result.transaction('files', 'readwrite'); tx.objectStore('files').put('name,ad\nAnna,x\nBob,y\n', id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }, id);
  await a.reload({ waitUntil: 'networkidle' });
  await settled(a);
  await a.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await a.waitForSelector('th:has-text("ki_a")');

  // Kollege B schreibt inzwischen direkt über die API (wie ein anderes Gerät): eigene KI-Spalte + Blockliste
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await login(b, ns);
  await b.goto(`${BASE_URL}/login`, { waitUntil: 'load' });
  await b.evaluate(async (id) => {
    const put = (key, value) => fetch('/api/store', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, value }) });
    await put(`csv_text_${id}`, 'name,ad,ki_b\nAnna,x,KEEP\nBob,y,DROP\n');
    await put(`csv_run_${id}`, JSON.stringify({ fields: ['name', 'ad', 'ki_b'], filename: 'Meta: konflikt', createdAt: new Date().toISOString(), rowCount: 2 }));
    // KI-Configs wie ein echtes Gerät: aktuellen Stand holen, ergänzen, mit ifMatch schreiben
    const cur = await (await fetch(`/api/store?key=${encodeURIComponent(`analysis_configs_${id}`)}`)).json();
    const r = await fetch('/api/store', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: `analysis_configs_${id}`, value: JSON.stringify([...JSON.parse(cur.value), { id: 'cfg_b', provider: 'anthropic', model: 'claude-sonnet-5', name: 'ki_b', prompt: 'B?' }]), ifMatch: cur.updatedAt }) });
    if (!r.ok) throw new Error('B: Configs schreiben fehlgeschlagen ' + r.status);
    await put('blocklist', JSON.stringify([{ pageName: 'Alt', addedAt: '2026-01-01T00:00:00Z' }, { pageName: 'Von B', addedAt: '2026-01-01T00:00:00Z' }]));
  }, id);

  // A läuft auf altem Stand: ▶ ki_a → Upload trifft auf B's Stand → zusammengeführt
  const th = a.locator('th:has-text("ki_a")').first();
  await th.hover();
  await th.locator('button[title*="nalys"], button:has-text("▶")').first().click();
  await a.waitForFunction(() => document.body.innerText.includes('«ki_a»: 2 klassifiziert'), null, { timeout: 30000 });
  await settled(a);
  await a.waitForSelector('text=zusammengeführt');
  ok(true, 'A bekommt den Hinweis «zusammengeführt»');
  await a.waitForSelector('[data-testid="dataset-changed"]');
  ok(true, 'A sieht den Hinweis, dass der Datensatz neu geladen werden sollte');

  // Server hat beide KI-Spalten, beide Configs, beide Blocklisten-Einträge
  const server = await b.evaluate(async (id) => {
    const get = async (key) => { const r = await fetch(`/api/store?key=${encodeURIComponent(key)}`); return r.ok ? (await r.json()).value : null; };
    return { meta: JSON.parse(await get(`csv_run_${id}`)), configs: JSON.parse(await get(`analysis_configs_${id}`)), blocklist: JSON.parse(await get('blocklist')) };
  }, id);
  ok(server.meta.fields.includes('ki_a') && server.meta.fields.includes('ki_b'), `Meta: Felder beider Seiten (${server.meta.fields.join(',')})`);
  ok(server.configs.map(c => c.id).sort().join() === 'cfg_a,cfg_b', `KI-Configs beider Seiten (${server.configs.map(c => c.id).join(',')})`);
  // Ein Schreiben mit veraltetem ifMatch wird abgelehnt (409) und liefert den aktuellen Wert
  const stale = await b.evaluate(async (id) => {
    const r = await fetch('/api/store', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: `analysis_configs_${id}`, value: '[]', ifMatch: '2020-01-01T00:00:00.000Z' }) });
    return { status: r.status, current: (await r.json()).current };
  }, id);
  ok(stale.status === 409 && stale.current && JSON.parse(stale.current.value).length === 2, `veraltetes ifMatch → 409 mit aktuellem Wert (HTTP ${stale.status})`);

  // A: Neu laden → beide Spalten mit Werten
  await a.click('[data-testid="dataset-reload"]');
  await a.waitForSelector('th:has-text("ki_b")');
  const rowA = await a.locator('tbody tr').first().innerText();
  ok(rowA.includes('ja') && rowA.includes('KEEP'), `A nach Neu laden: Werte beider Spalten (${rowA.replace(/\s+/g, ' ')})`);

  // B (frischer Browser) sieht denselben zusammengeführten Stand
  await b.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await b.waitForSelector('th:has-text("ki_a")');
  const rowB = await b.locator('tbody tr').first().innerText();
  ok(rowB.includes('ja') && rowB.includes('KEEP'), `B sieht beide Spalten (${rowB.replace(/\s+/g, ' ')})`);

  // Blockliste: A fügt hinzu, obwohl B inzwischen geschrieben hat → vereinigt statt überschrieben
  await a.goto(`${BASE_URL}/settings?tab=blocklist`, { waitUntil: 'networkidle' });
  await a.fill('[data-testid="block-input"]', 'Von A');
  await a.click('[data-testid="block-add"]');
  await settled(a);
  await a.waitForFunction(() => document.body.innerText.includes('Von B'), null, { timeout: 15000 });
  const bl = await b.evaluate(async () => JSON.parse((await (await fetch('/api/store?key=blocklist')).json()).value).map(e => e.pageName).sort().join());
  ok(bl === 'Alt,Von A,Von B', `Blockliste auf dem Server vereinigt (${bl})`);
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
