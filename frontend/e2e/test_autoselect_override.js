// Enrichment: manuelle Spaltenwahl überschreibt die Auto-Auswahl
const { playwright, login, fixture, ok, BASE_URL } = require('./helpers');
const { chromium } = playwright();
const CSV=fixture('test_linkedin.csv');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
  await login(p);
await p.goto(BASE_URL,{waitUntil:'networkidle'});
await p.evaluate(()=>localStorage.setItem('appSettings',JSON.stringify({apiKeys:{meta_ads:'',openai:'',gemini:'',anthropic:'',hunter_io:'fake',findymail:''},theme:'noir'})));
await p.locator('input[type="file"]').setInputFiles(CSV);await p.waitForTimeout(1200);
await p.locator('button:has-text("Ohne Vorlage")').click();await p.waitForTimeout(1200);
await p.locator('button:has-text("Enrichment starten")').click();await p.waitForTimeout(1200);
const sel=p.locator('select').first();
console.log('default:',await sel.inputValue());
await sel.selectOption('headline');await p.waitForTimeout(200);
ok((await sel.inputValue())==='headline', 'manuelle Auswahl "headline" bleibt erhalten');
await b.close();})();
