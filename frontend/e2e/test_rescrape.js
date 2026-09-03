// «Erneut scrapen»: rescrape_config aus localStorage befüllt die Suchmaske einmalig
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await login(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('rescrape_config', JSON.stringify({ keywords: ['yoga', 'pilates'], country: 'AT', platforms: ['INSTAGRAM'], adStatus: 'ALL', limit: 250, bylines: 'Studio X' })));
  await page.reload({ waitUntil: 'networkidle' });
  const body = await page.textContent('body');
  ok(body.includes('yoga') && body.includes('pilates'), 'Suchbegriffe vorbelegt');
  ok((await page.locator('button.chip.active', { hasText: /^250$/ }).count()) === 1, 'Limit-Chip 250 aktiv');
  ok((await page.locator('input[value="Studio X"]').count()) === 1, 'Bylines übernommen');
  ok((await page.evaluate(() => localStorage.getItem('rescrape_config'))) === null, 'rescrape_config nach dem Übernehmen entfernt');
  await page.reload({ waitUntil: 'networkidle' });
  ok(!(await page.textContent('body')).includes('pilates'), 'nach erneutem Laden: Maske wieder leer (einmalig)');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
