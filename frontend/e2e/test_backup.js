// Einstellungen → Daten: Bestand, Backup herunterladen (Download-Datei prüfen),
// alles löschen, Backup wiederherstellen → Datensatz + Vorlage + Suche sind zurück
const { playwright, login, ok, BASE_URL, shot } = require('./helpers');
const { chromium } = playwright();
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 1000 } });
  const page = await ctx.newPage();
  await login(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const id = 'csv_bak_' + Date.now();
  await page.evaluate(async (id) => {
    localStorage.clear();
    // Alte Version mit Browser-Keys: darf weder im Backup landen noch überleben
    localStorage.setItem('appSettings', JSON.stringify({ apiKeys: { anthropic: 'sk-secret' }, theme: 'noir' }));
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['name', 'ki_x'], filename: 'backup_test.csv', createdAt: new Date().toISOString(), rowCount: 2 }));
    localStorage.setItem(`analysis_configs_${id}`, JSON.stringify([{ id: 'c1', name: 'ki_x', provider: 'anthropic', model: 'm', prompt: 'p' }]));
    localStorage.setItem('user_presets', JSON.stringify([{ id: 'u1', name: 'Meine', columns: [{ name: 'ki_a', prompt: 'a' }], userDefined: true }]));
    localStorage.setItem('presets', JSON.stringify({ Yoga: { keywords: ['yoga'], country: 'DE' } }));
    localStorage.setItem('blocklist', JSON.stringify([{ pageName: 'Spam' }]));
    // CSV in IndexedDB
    const req = indexedDB.open('scaper_csv', 1);
    await new Promise((res, rej) => { req.onupgradeneeded = () => req.result.createObjectStore('files'); req.onsuccess = res; req.onerror = () => rej(req.error); });
    const db = req.result;
    await new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put('name,ki_x\nAnna,ja\nBob,nein\n', id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }, id);

  await page.goto(`${BASE_URL}/settings?tab=data`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="data-stats"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="data-stats"]')?.textContent?.includes('Datensätze'));
  const statsText = await page.locator('[data-testid="data-stats"]').innerText();
  ok(/Datensätze\s*1/i.test(statsText) && /Zeilen\s*2/i.test(statsText) && /Eigene KI-Spalten\s*1/i.test(statsText), `Bestand: 1 Datensatz, 2 Zeilen, 1 KI-Spalte`);
  await page.screenshot({ path: shot('data_tab.png'), fullPage: true });

  // Backup ohne Keys
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="backup-download"]')]);
  const path = await dl.path();
  const backup = JSON.parse(fs.readFileSync(path, 'utf8'));
  ok(backup.app === 'lead-pipeline' && backup.csv[id] && backup.csv[id].includes('Anna'), 'Backup enthält CSV-Text des Datensatzes');
  ok(backup.localStorage[`analysis_configs_${id}`] && backup.localStorage.user_presets && backup.localStorage.presets && backup.localStorage.blocklist, 'Backup enthält Configs, Vorlagen, Suchen, Blockliste');
  ok(!JSON.stringify(backup.localStorage.appSettings).includes('sk-secret'), 'API-Keys NIE im Backup');
  ok((await page.locator('[data-testid="backup-keys"]').count()) === 0, 'kein Schalter für Keys im Backup');
  // Alte Datei mit Keys: beim Einspielen werden sie verworfen
  const backup2 = JSON.parse(JSON.stringify(backup));
  backup2.localStorage.appSettings = JSON.stringify({ ...JSON.parse(backup.localStorage.appSettings), apiKeys: { anthropic: 'from-file' } });

  // Alles löschen
  await page.click('[data-testid="wipe-all"]');
  await page.click('button:has-text("Ja")');
  await page.waitForFunction(() => /Datensätze\s*0/i.test(document.querySelector('[data-testid="data-stats"]')?.innerText ?? ''));
  const after = await page.evaluate(() => ({ ls: Object.keys(localStorage).filter(k => k.startsWith('csv_run_') || k === 'user_presets' || k === 'appSettings').length }));
  ok(after.ls === 0, 'localStorage geleert');

  // Wiederherstellen (Datei enthält Keys — werden ignoriert)
  const restoreFile = `${require('path').dirname(path)}/restore.json`;
  fs.writeFileSync(restoreFile, JSON.stringify(backup2));
  await page.setInputFiles('[data-testid="backup-file"]', restoreFile);
  await page.waitForSelector('[data-testid="restore-preview"]');
  ok((await page.locator('[data-testid="restore-preview"]').innerText()).includes('1 Datensätze (2 Zeilen)'), 'Vorschau zeigt Inhalt des Backups');
  await page.click('[data-testid="restore-confirm"]');
  await page.waitForFunction(() => /Datensätze\s*1/i.test(document.querySelector('[data-testid="data-stats"]')?.innerText ?? ''));
  const restored = await page.evaluate((id) => ({
    meta: localStorage.getItem(`csv_run_${id}`), presets: localStorage.getItem('user_presets'),
    keys: JSON.parse(localStorage.getItem('appSettings')).apiKeys,
  }), id);
  ok(!!restored.meta && !!restored.presets && restored.keys === undefined, 'Meta + Vorlagen wiederhergestellt, Keys aus der Datei verworfen');
  await page.goto(`${BASE_URL}/csv/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Anna');
  ok((await page.textContent('body')).includes('Bob'), 'Datensatz nach Restore im Viewer ladbar (CSV aus IndexedDB)');
  ok(errors.length === 0, `keine Page-Errors${errors[0] ? ': ' + errors[0] : ''}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
