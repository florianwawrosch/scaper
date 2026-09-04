const { playwright, login, shot, BASE_URL } = require('./helpers');
const { chromium } = playwright();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  await login(page);
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const bodyText = await page.locator('body').textContent();
  console.log('Has KI-Spalten tab:', bodyText.includes('KI-Spalten'));

  const tplTab = page.locator('button:has-text("KI-Spalten")');
  const tabVisible = await tplTab.isVisible().catch(() => false);
  if (tabVisible) {
    await tplTab.click();
    await page.waitForTimeout(500);
    const tplBody = await page.locator('body').textContent();
    console.log('Shows LinkedIn column + name:', tplBody.includes('ki_zielgruppe') && tplBody.includes('LinkedIn-Klassifizierung'));
    await page.screenshot({ path: shot('settings_templates.png'), fullPage: true });
  } else {
    console.log('KI-Spalten tab button not found/visible');
  }

  console.log('Console errors:', consoleErrors.length);
  consoleErrors.forEach(e => console.log(' -', e.slice(0, 150)));

  await browser.close();
})();
