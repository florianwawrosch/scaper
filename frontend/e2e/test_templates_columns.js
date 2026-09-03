// Einstellungen → KI-Vorlagen: unbegrenzt Spalten anlegen, Spalten löschen,
// eingebaute Vorlage kopieren & erweitern, Vorlage löschen
const { playwright, login, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await login(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.removeItem('user_presets'); localStorage.removeItem('preset_flags'); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('text=KI-Vorlagen');
  const presets = () => page.evaluate(() => JSON.parse(localStorage.getItem('user_presets') || '[]'));

  // 3× neue KI-Spalte (oben + unten)
  await page.click('[data-testid="tpl-new"]');
  await page.click('[data-testid="tpl-new-bottom"]');
  await page.click('[data-testid="tpl-new-bottom"]');
  let p = await presets();
  ok(p.length === 3 && p[2].name === 'Neue KI-Spalte 3', `3 neue KI-Spalten angelegt (${p.map(x => x.name).join(', ')})`);
  const id = p[0].id;

  // Spalten in der ersten Vorlage: +2, Prompts setzen, speichern
  const card = page.locator(`[data-testid="tpl-${id}"]`);
  await card.locator(`[data-testid="tpl-col-add-${id}"]`).click();
  await card.locator(`[data-testid="tpl-col-add-${id}"]`).click();
  ok((await card.locator('textarea').count()) === 3, '3 Spalten in der Vorlage');
  for (let i = 0; i < 3; i++) await card.locator('textarea').nth(i).fill(`Prompt ${i + 1}`);
  await card.locator(`[data-testid="tpl-save-${id}"]`).click();
  await page.waitForSelector('text=✓ Gespeichert');
  p = await presets();
  ok(p[0].columns.length === 3 && p[0].columns[2].prompt === 'Prompt 3', 'Vorlage mit 3 Spalten gespeichert');

  // Mittlere Spalte löschen → sofort persistiert
  await card.locator(`[data-testid="tpl-col-delete-${id}-1"]`).click();
  await card.locator('button:has-text("Ja")').first().click();
  await page.waitForTimeout(200);
  p = await presets();
  ok(p[0].columns.length === 2 && p[0].columns.map(c => c.prompt).join() === 'Prompt 1,Prompt 3', 'Spalte 2 gelöscht, Rest bleibt');

  // Eingebaute Vorlage kopieren → editierbar, Spalte hinzufügen
  await page.click('[data-testid="tpl-copy-keep_drop"]');
  await page.waitForTimeout(200);
  p = await presets();
  const copy = p.find(x => x.name.includes('KEEP/DROP') && x.name.includes('Kopie'));
  ok(!!copy && copy.columns[0].name === 'ki_bewertung', 'KEEP/DROP als Kopie übernommen');
  const ccard = page.locator(`[data-testid="tpl-${copy.id}"]`);
  await ccard.locator(`[data-testid="tpl-col-add-${copy.id}"]`).click();
  ok((await ccard.locator('textarea').count()) === 2, 'Kopie um eine Spalte erweitert');

  // Ganze Vorlage löschen (beschrifteter Button)
  await page.locator(`[data-testid="tpl-delete-${id}"]`).click();
  await page.locator(`[data-testid="tpl-${id}"] button:has-text("Ja")`).click();
  await page.waitForTimeout(200);
  p = await presets();
  ok(!p.some(x => x.id === id), 'Vorlage gelöscht');
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
