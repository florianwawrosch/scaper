// Tabelle: Zeilen pro Seite wählbar (25/50/100/250/alle), Kompakt/Erweitert, beides bleibt nach Reload
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await login(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const id = 'csv_view_' + Date.now();
  await page.evaluate((id) => {
    localStorage.clear();
    localStorage.setItem('appSettings', JSON.stringify({ apiKeys: { meta_ads: '', openai: '', gemini: '', anthropic: '', hunter_io: '', findymail: '' }, theme: 'noir' }));
    const long = 'Dies ist ein sehr langer Werbetext, der in der kompakten Ansicht abgeschnitten wird und in der erweiterten Ansicht komplett lesbar sein muss. '.repeat(4);
    const data = Array.from({ length: 60 }, (_, i) => ({ page_name: `Seite ${i + 1}`, ad_text: i === 0 ? long : `Text ${i + 1}` }));
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['page_name', 'ad_text'], filename: 'view.csv', createdAt: new Date().toISOString(), rowCount: 60, data }));
  }, id);
  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Seite 1 / 3');
  const rows = () => page.locator('tbody tr').count();
  ok(await rows() === 25, `Standard 25 Zeilen (${await rows()})`);
  ok(await page.locator('[data-testid="page-size"]').inputValue() === '25', 'Auswahl steht auf 25');
  await page.selectOption('[data-testid="page-size"]', '100');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 60);
  ok((await page.locator('text=Seite 1 / 3').count()) === 0, '100/Seite: alle 60 Zeilen, keine Seitennavigation');
  await page.selectOption('[data-testid="page-size"]', '0');
  ok(await rows() === 60, '«Alle Zeilen» zeigt 60');
  // Kompakt → Erweitert
  const cell = page.locator('tbody tr').first().locator('td').nth(3); // checkbox, #, page_name, ad_text
  const before = await cell.evaluate(td => getComputedStyle(td).whiteSpace);
  await page.click('[data-testid="view-toggle"]');
  const after = await cell.evaluate(td => getComputedStyle(td).whiteSpace);
  const h = await cell.evaluate(td => td.getBoundingClientRect().height);
  ok(before === 'nowrap' && after === 'pre-wrap' && h > 40, `Erweitert: Zelle umgebrochen (${before} → ${after}, Höhe ${Math.round(h)}px)`);
  ok((await page.locator('[data-testid="view-toggle"]').innerText()).includes('Erweitert'), 'Umschalter zeigt «Erweitert»');
  // Reload: beides bleibt
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('tbody tr');
  ok(await page.locator('[data-testid="page-size"]').inputValue() === '0' && await rows() === 60, 'Seitengröße nach Reload erhalten');
  ok((await page.locator('[data-testid="view-toggle"]').innerText()).includes('Erweitert'), 'Ansicht nach Reload erhalten');
  await page.selectOption('[data-testid="page-size"]', '25');
  await page.click('[data-testid="view-toggle"]');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
