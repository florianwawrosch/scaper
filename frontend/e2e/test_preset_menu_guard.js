// ☆ Vorlage-Menü: LinkedIn-Vorlage ist auf Meta-Daten ausgegraut (Eingabespalten fehlen),
// eine Mehrspalten-Vorlage fragt vor dem Laden nach, eine 1-Spalten-Vorlage lädt sofort
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await login(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const id = 'csv_guard_' + Date.now();
  await page.evaluate((id) => {
    localStorage.clear();
    localStorage.setItem('appSettings', JSON.stringify({ apiKeys: { meta_ads: '', openai: '', gemini: '', anthropic: 'k', hunter_io: '', findymail: '' }, theme: 'noir' }));
    localStorage.setItem('user_presets', JSON.stringify([{ id: 'user_multi', name: 'Drei auf einmal', columns: [{ name: 'ki_a', prompt: 'A?' }, { name: 'ki_b', prompt: 'B?' }, { name: 'ki_c', prompt: 'C?' }], userDefined: true }]));
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['page_name', 'ad_text'], filename: 'Meta: test', createdAt: new Date().toISOString(), rowCount: 2, data: [{ page_name: 'A', ad_text: 'x' }, { page_name: 'B', ad_text: 'y' }] }));
  }, id);
  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="preset-menu-btn"]');
  await page.click('[data-testid="preset-menu-btn"]');
  const li = page.locator('[data-testid="preset-row-linkedin_klassifizierung_v5"]');
  ok((await li.innerText()).includes('braucht Spalten: voller_name'), 'LinkedIn-Vorlage: fehlende Eingabespalten benannt');
  ok(await li.locator('button:has-text("Laden")').isDisabled(), 'LinkedIn-Vorlage auf Meta-Daten nicht ladbar');
  ok((await li.innerText()).includes('Spalten auf einmal'), 'LinkedIn-Vorlage als Mehrspalten gekennzeichnet');
  // Mehrspalten: erster Klick fragt nach, zweiter lädt
  const multi = page.locator('[data-testid="preset-row-user_multi"]');
  await multi.locator('button:has-text("Laden")').click();
  ok((await multi.innerText()).includes('Legt 3 Spalten an — wirklich?'), 'Mehrspalten-Vorlage fragt nach');
  ok((await page.locator('th:has-text("ki_a")').count()) === 0, 'noch nichts angelegt');
  await multi.locator('button:has-text("Ja, 3 Spalten")').click();
  await page.waitForSelector('th:has-text("ki_c")');
  ok(true, 'nach Bestätigung 3 Spalten angelegt');
  // 1-Spalten-Vorlage lädt sofort
  await page.click('[data-testid="preset-menu-btn"]');
  await page.locator('[data-testid="preset-row-keep_drop"] button:has-text("Laden")').click();
  await page.waitForSelector('th:has-text("ki_bewertung")');
  ok(true, 'KEEP/DROP (1 Spalte) lädt ohne Nachfrage');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
