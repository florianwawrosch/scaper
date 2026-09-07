// Meta-Token: Ablauf steht in den Integrationen ohne Klick; ab 7 Tagen Warnleiste auf jeder
// Seite mit Countdown (Tage, Stunden, Minuten); abgelaufen → rote Leiste; lange gültig → nichts
const { playwright, login, mockKeys, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const status = (over) => ({ configured: true, valid: true, expiresAt: null, neverExpires: false, scopesOk: true, expiryUnknown: false, message: '', checkedAt: new Date().toISOString(), ...over });
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await login(page);
  await mockKeys(page, ['anthropic', 'meta_ads']);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let current = status({ expiresAt: new Date(Date.now() + 5 * 86_400_000 + 3 * 3_600_000 + 12 * 60_000 + 30_000).toISOString() });
  await page.route('**/api/keys/meta*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) }));

  // 5 Tage Rest: Warnleiste auf Startseite, Datensatz-Liste und Einstellungen
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="meta-token-banner"]');
  const txt = await page.locator('[data-testid="meta-token-banner"]').innerText();
  ok(/läuft ab in 5 Tagen, 3 Stunden und 1[12] Minuten/.test(txt), `Countdown in Tagen, Stunden, Minuten: ${txt.slice(0, 90)}`);
  ok((await page.locator('[data-testid="meta-token-banner"]').getAttribute('data-level')) === 'warn', 'Stufe warn');
  await page.goto(`${BASE_URL}/runs`, { waitUntil: 'networkidle' });
  ok((await page.locator('[data-testid="meta-token-banner"]').count()) === 1, 'Leiste auch auf /runs');
  await page.goto(`${BASE_URL}/settings?tab=integrations`, { waitUntil: 'networkidle' });
  ok((await page.locator('[data-testid="meta-token-banner"]').count()) === 1, 'Leiste auch in den Einstellungen');
  await page.click('[data-testid="meta-token-banner"] button');
  await page.waitForURL(/settings/);

  // Integrationen: Ablauf ohne Klick auf «Testen»
  await page.waitForSelector('[data-testid="integration-meta-status"]');
  const cell = await page.locator('[data-testid="integration-meta-status"]').innerText();
  ok(cell.includes('gültig bis') && cell.includes('(5 Tage)'), `Ablauf in der Tabelle ohne Klick: ${cell}`);

  // Abgelaufen: rote Leiste
  current = status({ expiresAt: new Date(Date.now() - 3_600_000).toISOString() });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="meta-token-banner"][data-level="expired"]');
  ok((await page.locator('[data-testid="meta-token-banner"]').innerText()).includes('abgelaufen'), 'abgelaufen: rote Leiste');

  // Lange gültig / nie ablaufend / kein Token: keine Leiste
  for (const [name, s] of [['60 Tage', status({ expiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString() })], ['nie ablaufend', status({ neverExpires: true })], ['kein Token', status({ configured: false, valid: false })]]) {
    current = s;
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    ok((await page.locator('[data-testid="meta-token-banner"]').count()) === 0, `${name}: keine Leiste`);
  }
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
