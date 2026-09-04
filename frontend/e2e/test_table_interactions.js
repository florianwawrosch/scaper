const { playwright, login, fixture, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const TEST_CSV = fixture('test_linkedin.csv');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  await login(page);

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(TEST_CSV);
  await page.waitForTimeout(1000);
  await page.locator('button:has-text("Ohne KI-Spalte")').click();
  await page.waitForTimeout(1500);

  // 1. Global search filter
  await page.locator('input[placeholder*="durchsuchen"]').fill('Sarah');
  await page.waitForTimeout(300);
  let bodyText = await page.locator('body').textContent();
  console.log('Global search "Sarah" -> shows "1/3 sichtbar":', bodyText.includes('1/3 sichtbar'));
  await page.locator('input[placeholder*="durchsuchen"]').fill('');
  await page.waitForTimeout(300);

  // 2. Sort by column
  await page.locator('th:has-text("voller_name")').click();
  await page.waitForTimeout(300);
  const firstRowName = await page.locator('tbody tr').first().locator('td').nth(2).textContent();
  console.log('After sort by voller_name, first row:', firstRowName?.trim());

  // 3. Row exclusion (checkbox) + count update
  const firstCheckbox = page.locator('tbody tr').first().locator('input[type="checkbox"]');
  await firstCheckbox.uncheck();
  await page.waitForTimeout(300);
  bodyText = await page.locator('body').textContent();
  console.log('After deselecting 1 row, shows "2 ausgewählt":', bodyText.includes('2 ausgewählt'));

  // 4. CSV export triggers a download
  const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await page.locator('button:has-text("CSV")').click();
  const download = await downloadPromise;
  console.log('CSV export triggered download:', !!download);
  if (download) {
    const path = await download.path();
    const fs = require('fs');
    const content = fs.readFileSync(path, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    console.log('Exported CSV row count (header + rows):', lines.length, '(expected 3: header + 2 included rows)');
  }

  await browser.close();
})();
