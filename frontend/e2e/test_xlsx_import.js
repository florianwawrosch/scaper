// Excel-Import: echte .xlsx-Datei hochladen → Datensatz mit allen Spalten/Zeilen im Viewer
const { playwright, login, ok, BASE_URL, fixture } = require('./helpers');
const { chromium } = playwright();
const XLSX = require('xlsx');
(async () => {
  const file = fixture('import_test.xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { page_name: 'Coach Anna', ad_text: 'Abnehmen mit Plan', email: 'anna@x.de' },
    { page_name: 'Maler Bob', ad_text: 'Wände streichen', email: '' },
    { page_name: 'Yoga Cleo', ad_text: 'Yoga für Anfänger', email: 'cleo@x.de' },
  ]), 'Leads');
  XLSX.writeFile(wb, file);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await login(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.waitForURL(/\/csv\/csv_/, { timeout: 10000 });
  await page.waitForSelector('text=Coach Anna');
  const headers = (await page.locator('thead th').allInnerTexts()).map(t => t.trim().toLowerCase());
  ok(['page_name', 'ad_text', 'email'].every(c => headers.some(h => h.includes(c))), `Spalten aus Excel übernommen: ${headers.filter(Boolean).join(', ')}`);
  ok((await page.locator('tbody tr').count()) === 3, '3 Zeilen importiert');
  ok((await page.textContent('body')).includes('import_test.xlsx'), 'Dateiname als Titel');
  const id = page.url().split('/csv/')[1];
  const meta = await page.evaluate((id) => JSON.parse(localStorage.getItem(`csv_run_${id}`)), id);
  ok(meta.rowCount === 3 && meta.fields.length === 3, 'Meta: 3 Zeilen, 3 Spalten');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
