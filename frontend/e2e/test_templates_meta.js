// Instant Load bei Meta-Scrape: Vorlage (KEEP/DROP) mit autoAdd.meta + autoRun,
// /api/scrape gemockt → Viewer zeigt ki_bewertung automatisch und füllt aus.
const { playwright, login, shot, ok, BASE_URL, DIR } = require('./helpers');
const { chromium } = playwright();
const BASE = BASE_URL;
const S = DIR;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await login(page);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  let scrapeCalls = 0, aiCalls = 0;
  await page.route('**/api/scrape', async route => {
    scrapeCalls++;
    const rows = [
      { page_name: 'Coach Anna', page_id: '1', ad_text: 'Abnehmen mit mir', ad_url: 'https://fb.com/1' },
      { page_name: 'Maler Bob', page_id: '2', ad_text: 'Wände streichen', ad_url: 'https://fb.com/2' },
    ];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows }) });
  });
  await page.route('**/api/ai/analyze', async route => {
    aiCalls++;
    const body = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: body.prompts.map(p => (/Coach Anna/.test(p) ? 'KEEP' : 'DROP')) }) });
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('appSettings', JSON.stringify({ apiKeys: { meta_ads: 'tok', openai: '', gemini: 'g-key', anthropic: '', hunter_io: '', findymail: '' }, theme: 'noir' }));
    // Instant Load für Meta an der eingebauten KEEP/DROP-Vorlage (wie in Einstellungen gesetzt)
    localStorage.setItem('preset_flags', JSON.stringify({ keep_drop: { autoAdd: { meta: true }, autoRun: true } }));
  });
  await page.reload({ waitUntil: 'networkidle' });

  // Suchbegriff eingeben und scrapen
  const tagInput = page.locator('input[placeholder*="Suchbegriff"], input[placeholder*="Keyword"], input[placeholder*="Begriff"]').first();
  await tagInput.fill('coach');
  await tagInput.press('Enter');
  await page.click('button:has-text("Scrap")');
  await page.waitForURL(/\/csv\/csv_/, { timeout: 15000 });
  ok(scrapeCalls === 1, 'Meta-Scrape aufgerufen (gemockt)');
  await page.waitForSelector('th:has-text("ki_bewertung")', { timeout: 8000 });
  ok(true, 'Instant Load (Meta): ki_bewertung automatisch angehängt');
  await page.waitForFunction(() => document.body.innerText.includes('«ki_bewertung»: 2 klassifiziert'), null, { timeout: 15000 });
  ok(aiCalls >= 1, `direkt ausfüllen: KI aufgerufen (${aiCalls})`);
  const cfgs = await page.evaluate((id) => JSON.parse(localStorage.getItem(`analysis_configs_${id}`)), page.url().split('/csv/')[1]);
  ok(cfgs.length === 1 && cfgs[0].name === 'ki_bewertung' && cfgs[0].provider === 'gemini', `Config mit erstem verfügbaren Provider (gemini): ${cfgs[0]?.provider}`);
  await page.screenshot({ path: shot('tpl_meta.png') });
  ok(errors.length === 0, `keine Page-Errors${errors.length ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
