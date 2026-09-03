const { playwright, login, fixture, shot, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const TEST_CSV = fixture('test_linkfix.csv');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 } });
  await login(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(TEST_CSV);
  await page.waitForTimeout(1500);

  // Non-LinkedIn CSV shouldn't trigger preset modal; if it does, dismiss with "Ohne Vorlage"
  const noPreset = page.locator('button:has-text("Ohne Vorlage")');
  if (await noPreset.isVisible({ timeout: 2000 }).catch(() => false)) await noPreset.click();
  await page.waitForTimeout(1500);

  // Check: "3.14" (score) should NOT be a link, "16.3.3" (version) should NOT be a link,
  // "example.com" (website) SHOULD be a link
  const scoreCell = page.locator('td', { hasText: '3.14' });
  const scoreIsLink = await scoreCell.locator('a').count();
  ok(scoreIsLink === 0, 'Score "3.14" nicht als Link gerendert');

  const versionCell = page.locator('td', { hasText: '16.3.3' });
  const versionIsLink = await versionCell.locator('a').count();
  ok(versionIsLink === 0, 'Version "16.3.3" nicht als Link gerendert');

  const websiteCell = page.locator('td', { hasText: 'example.com' });
  const websiteIsLink = await websiteCell.locator('a').count();
  ok(websiteIsLink > 0, 'Website "example.com" als Link gerendert');

  await page.screenshot({ path: shot('linkfix.png') });

  await browser.close();
})();
