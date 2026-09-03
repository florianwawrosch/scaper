// Unit-Tests: fetchRetry (429/5xx-Backoff) und Outreach-Export-Mapping
const http = require('http');
const { ok, lib } = require('./setup');
const { fetchRetry } = lib('serverRetry');
const { buildOutreachExport, splitName } = lib('outreachExport');
(async () => {
  // --- retry: 429, 429, then 200 ---
  let calls = 0;
  const srv = http.createServer((req, res) => {
    calls++;
    if (req.url === '/flaky') { if (calls < 3) { res.writeHead(429, {'retry-after':'0'}); return res.end('slow down'); } res.writeHead(200); return res.end('ok'); }
    if (req.url === '/dead') { res.writeHead(503); return res.end('down'); }
    if (req.url === '/hang') { return; } // never answers → timeout
  });
  await new Promise(r => srv.listen(18555, r));
  const t0 = Date.now();
  const r1 = await fetchRetry('http://localhost:18555/flaky', undefined, { baseMs: 50 });
  ok(r1.status === 200 && calls === 3, `429,429→200 recovered after ${calls} calls, status ${r1.status}, ${Date.now()-t0}ms`);
  calls = 0;
  const r2 = await fetchRetry('http://localhost:18555/dead', undefined, { baseMs: 20 });
  ok(r2.status === 503 && calls === 3, `persistent 503 gives up after ${calls} calls (retries=2) and returns 503`);
  calls = 0; const t1 = Date.now();
  let timedOut = false;
  try { await fetchRetry('http://localhost:18555/hang', { signal: AbortSignal.timeout(300) }, { baseMs: 1000 }); } catch (e) { timedOut = e.name === 'TimeoutError'; }
  ok(timedOut && calls === 1 && Date.now()-t1 < 900, `timeout NOT retried (calls=${calls}, ${Date.now()-t1}ms)`);
  srv.close();

  // --- outreach mapping ---
  ok(JSON.stringify(splitName('Max Mustermann')) === '{"first":"Max","last":"Mustermann"}', 'splitName two words');
  ok(JSON.stringify(splitName('Anna Maria Schmidt')) === '{"first":"Anna Maria","last":"Schmidt"}', 'splitName three words → last token = last');
  ok(JSON.stringify(splitName('Cher')) === '{"first":"Cher","last":""}', 'splitName single');
  const fields = ['voller_name','firma','headline','linkedin_url','ki_themenfeld','ki_zielgruppe','email_enriched','quelle_person','erster_autor'];
  const rows = [
    { voller_name:'John Coach', firma:'JC GmbH', headline:'Coach', linkedin_url:'li/john', ki_themenfeld:'Business', ki_zielgruppe:'ja', email_enriched:'john@jc.de', quelle_person:'Big A', erster_autor:'x' },
    { voller_name:'Sarah Agentur', firma:'SA', headline:'Ads', linkedin_url:'', ki_themenfeld:'Marketing', ki_zielgruppe:'nein', email_enriched:'s@sa.de', quelle_person:'', erster_autor:'' },
    { voller_name:'Max Ohne', firma:'MO', headline:'', linkedin_url:'', ki_themenfeld:'', ki_zielgruppe:'ja', email_enriched:'', quelle_person:'', erster_autor:'' },
  ];
  const out = buildOutreachExport(rows, fields, { audience: { column:'ki_zielgruppe', value:'ja' } });
  ok(out.rows.length === 1 && out.rows[0].email === 'john@jc.de', `audience+email filter → 1 row (${out.rows.length})`);
  ok(out.dropped.notAudience === 1 && out.dropped.noEmail === 1, `dropped counts notAudience=${out.dropped.notAudience} noEmail=${out.dropped.noEmail}`);
  ok(out.rows[0].first_name === 'John' && out.rows[0].last_name === 'Coach' && out.rows[0].company === 'JC GmbH' && out.rows[0].linkedin_profile === 'li/john', 'mapping first/last/company/linkedin');
  ok(out.columns.join(',') === 'email,first_name,last_name,company,website,linkedin_profile,headline,themenfeld,quelle', `columns: ${out.columns.join(',')}`);
  ok(out.rows[0].quelle === 'Big A', 'quelle dedupe: quelle_person wins over erster_autor');
  const none = buildOutreachExport(rows, ['voller_name','firma'], {});
  ok(none.rows.length === 0 && none.emailColumn === null && none.dropped.noEmail === 3, 'no email column → nothing exported, all counted as noEmail');
  const all = buildOutreachExport(rows, fields, { audience: null });
  ok(all.rows.length === 2, `no audience rule → email-only filter → ${all.rows.length} rows`);
})();
