// Multi-Output-KI-Spalte: EINE Tabellenspalte — Einzelwerte und Regel-Spalte sind standardmäßig
// NICHT in der Tabelle, per ⚙ einblendbar; im CSV-Export sind sie immer enthalten
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const id = 'csv_split_' + Date.now();
  await page.evaluate((id) => {
    localStorage.clear();
    localStorage.setItem('appSettings', JSON.stringify({ apiKeys: { meta_ads: '', openai: '', gemini: '', anthropic: 'k', hunter_io: '', findymail: '' }, theme: 'noir' }));
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({
      fields: ['voller_name', 'ki_klassifizierung', 'ki_a', 'ki_b', 'ki_zielgruppe'], filename: 'split.csv', createdAt: new Date().toISOString(), rowCount: 2,
      data: [
        { voller_name: 'Anna', ki_klassifizierung: 'ja | nein', ki_a: 'ja', ki_b: 'nein', ki_zielgruppe: 'ja' },
        { voller_name: 'Bob',  ki_klassifizierung: 'nein | ja', ki_a: 'nein', ki_b: 'ja', ki_zielgruppe: 'nein' },
      ],
    }));
    localStorage.setItem(`analysis_configs_${id}`, JSON.stringify([{
      id: 'cfg_s', provider: 'anthropic', model: 'm', name: 'ki_klassifizierung', prompt: 'p',
      outputFields: ['ki_a', 'ki_b'], derived: [{ name: 'ki_zielgruppe', allOf: [{ field: 'ki_a', anyOf: ['ja'] }], then: 'ja', else: 'nein' }],
    }]));
  }, id);
  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('th:has-text("ki_klassifizierung")');
  const headers = async () => (await page.locator('thead th').allInnerTexts()).map(t => t.toLowerCase());
  let h = await headers();
  ok(h.filter(x => x.includes('ki_')).length === 1 && h.some(x => x.includes('ki_klassifizierung')), `Standard: nur die eine KI-Spalte sichtbar (${h.filter(x => x.includes('ki_')).length} KI-Spalten)`);
  // Export enthält die Einzelspalten trotzdem
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("CSV")')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  ok(csv.split('\n')[0].includes('ki_a') && csv.split('\n')[0].includes('ki_b') && csv.split('\n')[0].includes('ki_zielgruppe'), 'CSV-Export enthält Einzelwerte + Regel-Spalte');
  // ⚙ → Einzelspalten einblenden
  const th = page.locator('th:has-text("ki_klassifizierung")').first();
  await th.hover();
  await th.locator('button[title*="onfig"], button:has-text("⚙")').first().click();
  await page.waitForSelector('[data-testid="editor-show-splits"]');
  await page.click('[data-testid="editor-show-splits"]');
  await page.waitForSelector('th:has-text("ki_a")');
  h = await headers();
  ok(h.some(x => x.includes('ki_a')) && h.some(x => x.includes('ki_b')) && h.some(x => x.includes('ki_zielgruppe')), 'nach Einblenden: Einzelwerte + Regel-Spalte in der Tabelle');
  const cfg = await page.evaluate((id) => JSON.parse(localStorage.getItem(`analysis_configs_${id}`))[0], id);
  ok(cfg.showSplits === true, 'showSplits in der Config gespeichert');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
