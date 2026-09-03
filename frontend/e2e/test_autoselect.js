const { playwright, login, fixture, shot, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const TEST_CSV = fixture('test_linkedin.csv');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await login(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Fake a local Hunter.io key so the provider/mapping UI renders
  await page.evaluate(() => {
    localStorage.setItem('appSettings', JSON.stringify({
      apiKeys: { meta_ads: '', openai: '', gemini: '', anthropic: '', hunter_io: 'fake-test-key', findymail: '' },
      theme: 'noir',
    }));
  });

  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(TEST_CSV);
  await page.waitForTimeout(1500);
  const linkedinButton = page.locator('button:has-text("LinkedIn-Klassifizierung")').first();
  await linkedinButton.click();
  await page.waitForTimeout(300);
  const loadButton = page.locator('button:has-text("Nur laden")');
  await loadButton.click();
  await page.waitForTimeout(2000);

  const enrichBtn = page.locator('button:has-text("Enrichment starten")');
  await enrichBtn.click();
  await page.waitForTimeout(1500);

  const bodyText = await page.locator('body').textContent();
  console.log('Column mapping UI shown:', bodyText.includes('Spalten-Zuordnung'));

  const selects = await page.locator('select').all();
  for (let i = 0; i < selects.length; i++) {
    const value = await selects[i].inputValue();
    console.log(`Select ${i} value:`, JSON.stringify(value));
  }

  await page.screenshot({ path: shot('autoselect.png') });

  await browser.close();
})();
