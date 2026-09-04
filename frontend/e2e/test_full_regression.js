const { playwright, login, fixture, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const TEST_CSV = fixture('test_linkedin.csv');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await login(page);
  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('appSettings', JSON.stringify({
      apiKeys: { meta_ads: '', openai: '', gemini: '', anthropic: 'fake-key', hunter_io: '', findymail: '' },
      theme: 'noir',
    }));
  });

  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(TEST_CSV);
  await page.waitForTimeout(1500);
  const linkedinButton = page.locator('button:has-text("LinkedIn-Klassifizierung")').first();
  await linkedinButton.click();
  await page.waitForTimeout(300);

  // Mock the analyze endpoint to return valid pipe-separated multi-output answers
  await page.route('**/api/ai/analyze', async route => {
    const req = route.request();
    const body = JSON.parse(req.postData());
    const values = body.prompts.map(() => 'Coach | ja | nein | Beziehung | selbststaendig | eigenes_angebot | hoch');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values }) });
  });

  // Use "Laden + Analysieren" to trigger full autorun classification
  const runAndLoadBtn = page.locator('button:has-text("Laden + Analysieren")');
  await runAndLoadBtn.click();
  await page.waitForTimeout(3000);

  const bodyText = await page.locator('body').textContent();
  console.log('Shows ki_zielgruppe stat:', bodyText.includes('ki_zielgruppe'));
  console.log('Shows 3/3 classified:', bodyText.includes('3/3'));

  const headers = await page.locator('th').allTextContents();
  const hasZielgruppeCol = headers.some(h => h.includes('ki_zielgruppe'));
  console.log('ki_zielgruppe hidden by default (one AI column = one table column):', !hasZielgruppeCol);
  console.log('ki_klassifizierung column exists:', headers.some(h => h.includes('ki_klassifizierung')));

  // Check the derived rule computed correctly: Coach+ja+nein+selbststaendig -> zielgruppe=ja
  // (rule column is hidden by default; the stat chip shows its distribution)
  const hasJa = /ki_zielgruppe: 3 ja/.test(bodyText);
  console.log('Derived rule computed "ja" for zielgruppe:', hasJa);

  console.log('\nConsole/page errors:', consoleErrors.length);
  consoleErrors.forEach(e => console.log(' -', e));

  await browser.close();
})();
