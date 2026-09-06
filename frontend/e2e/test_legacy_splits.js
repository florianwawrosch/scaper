// Ältere Multi-Output-Configs (LinkedIn v5 mit 7 Einzelwerten + Regel): die Tabelle zeigt
// nur Antwort- und Regel-Spalte, die Einzelwerte bleiben versteckt — im CSV-Export sind sie drin
const { playwright, login, mockKeys, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  await mockKeys(page, ['anthropic']);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const id = 'csv_legacy_' + Date.now();
  await page.evaluate((id) => {
    localStorage.clear();
    localStorage.setItem('appSettings', JSON.stringify({ theme: 'noir' }));
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({
      fields: ['voller_name', 'ki_klassifizierung', 'ki_a', 'ki_b', 'ki_zielgruppe'], filename: 'legacy.csv', createdAt: new Date().toISOString(), rowCount: 2,
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
  const h = (await page.locator('thead th').allInnerTexts()).map(t => t.toLowerCase());
  ok(h.some(x => x.includes('ki_zielgruppe')) && !h.some(x => x.includes('ki_a')) && !h.some(x => x.includes('ki_b')), 'Antwort + Regel-Spalte sichtbar, Einzelwerte nicht');
  ok(/ki_zielgruppe: 1 ja \(50%\)/.test(await page.textContent('body')), 'Verteilungs-Chip für die Regel-Spalte');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("CSV")')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  ok(csv.split('\n')[0].includes('ki_a') && csv.split('\n')[0].includes('ki_b'), 'CSV-Export enthält die Einzelwerte');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
