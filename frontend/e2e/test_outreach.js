const { playwright, login, fixture, shot, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const fs = require('fs');
const BASE = BASE_URL;
const CSV = fixture('test_linkedin.csv');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: true });
  await login(page);
  await page.goto(BASE, { waitUntil: 'networkidle' });

  // 1) plain LinkedIn CSV, no email column → no Outreach button
  await page.locator('input[type="file"]').setInputFiles(CSV); await page.waitForTimeout(1200);
  await page.locator('button:has-text("Ohne Vorlage")').click(); await page.waitForTimeout(1500);
  ok((await page.locator('button:has-text("Outreach")').count()) === 0, 'no email column → no "↓ Outreach" button');

  // 2) seeded dataset with classification + email_enriched → button + correct download
  const id = 'csv_outreach_' + Date.now();
  await page.evaluate((id) => {
    localStorage.setItem(`csv_run_${id}`, JSON.stringify({ fields: ['voller_name','firma','headline','linkedin_url','ki_klassifizierung','ki_bietet_coaching','ki_marketing_agentur','ki_anbieterstatus','ki_themenfeld','ki_zielgruppe','email_enriched'], filename: 'outreach_test.csv', createdAt: new Date().toISOString(), rowCount: 3 }));
    localStorage.setItem(`analysis_configs_${id}`, JSON.stringify([{ id:'c1', provider:'anthropic', model:'claude-sonnet-5', name:'ki_klassifizierung', prompt:'x', inputColumns:['voller_name'], outputFields:['ki_bietet_coaching','ki_marketing_agentur','ki_anbieterstatus','ki_themenfeld'], derived:[{ name:'ki_zielgruppe', allOf:[{field:'ki_bietet_coaching',anyOf:['ja']},{field:'ki_marketing_agentur',anyOf:['nein']},{field:'ki_anbieterstatus',anyOf:['selbststaendig']}], then:'ja', else:'nein' }] }]));
  }, id);
  await page.evaluate(async (id) => {
    const rows = [
      { voller_name:'John Coach', firma:'John Coaching GmbH', headline:'Leadership Coach', linkedin_url:'https://linkedin.com/in/john', ki_klassifizierung:'ja | nein | selbststaendig | Business', ki_bietet_coaching:'ja', ki_marketing_agentur:'nein', ki_anbieterstatus:'selbststaendig', ki_themenfeld:'Business', ki_zielgruppe:'ja', email_enriched:'john@johncoaching.de' },
      { voller_name:'Sarah Agentur', firma:'Marketing Pro', headline:'Ads', linkedin_url:'', ki_klassifizierung:'nein | ja | unternehmen | Marketing', ki_bietet_coaching:'nein', ki_marketing_agentur:'ja', ki_anbieterstatus:'unternehmen', ki_themenfeld:'Marketing', ki_zielgruppe:'nein', email_enriched:'sarah@mp.de' },
      { voller_name:'Max Ohne Mail', firma:'MO GmbH', headline:'Coach', linkedin_url:'', ki_klassifizierung:'ja | nein | selbststaendig | Fitness', ki_bietet_coaching:'ja', ki_marketing_agentur:'nein', ki_anbieterstatus:'selbststaendig', ki_themenfeld:'Fitness', ki_zielgruppe:'ja', email_enriched:'' },
    ];
    const f = Object.keys(rows[0]); const csv = [f.join(','), ...rows.map(r => f.map(k => `"${String(r[k]).replace(/"/g,'""')}"`).join(','))].join('\n');
    const req = indexedDB.open('scaper_csv', 1);
    await new Promise((res, rej) => { req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('files')) req.result.createObjectStore('files'); }; req.onsuccess = res; req.onerror = () => rej(req.error); });
    await new Promise((res, rej) => { const tx = req.result.transaction('files', 'readwrite'); tx.objectStore('files').put(csv, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }, id);
  await page.goto(`${BASE}/csv/${id}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  const btn = page.locator('button:has-text("Outreach")');
  ok(await btn.isVisible(), 'email column present → "↓ Outreach" button visible');
  ok((await btn.getAttribute('title') || '').includes('ki_zielgruppe = ja'), 'tooltip mentions audience rule');
  const dl = page.waitForEvent('download', { timeout: 5000 });
  await btn.click();
  const download = await dl;
  const text = fs.readFileSync(await download.path(), 'utf-8').replace(/^﻿/, '');
  const lines = text.trim().split('\n');
  console.log('   header:', lines[0]); console.log('   row:   ', lines[1]);
  ok(download.suggestedFilename().startsWith('outreach_'), `filename ${download.suggestedFilename()}`);
  ok(lines.length === 2, `exactly 1 data row (John: ja + email); Sarah (nein) and Max (no email) dropped — got ${lines.length - 1}`);
  ok(lines[0] === '"email","first_name","last_name","company","website","linkedin_profile","headline","themenfeld"', 'header = cold-email columns');
  ok(lines[1].startsWith('"john@johncoaching.de","John","Coach","John Coaching GmbH","","https://linkedin.com/in/john","Leadership Coach","Business"'), 'row mapped correctly');
  const body = await page.locator('body').textContent();
  ok(body.includes('1 Leads exportiert') && body.includes('1 nicht Zielgruppe') && body.includes('1 ohne E-Mail'), 'toast reports exported + dropped counts');
  await page.screenshot({ path: shot('outreach.png') });
  await browser.close();
})();
