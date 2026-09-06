#!/usr/bin/env node
// Führt alle e2e/test_*.js aus (Dev-Server muss laufen) — standardmäßig 3 parallel;
// jeder Test hat seinen eigenen Namensraum im Speicher (helpers.login), daher unabhängig.
// Ein Test gilt als fehlgeschlagen bei Exit-Code ≠ 0, "❌" oder ": false" in der Ausgabe.
//   node e2e/run-all.js              alle, 3 parallel
//   node e2e/run-all.js -j 1 backup  nur Tests mit «backup» im Namen, seriell
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const args = process.argv.slice(2);
const jIdx = args.indexOf('-j');
const parallel = jIdx >= 0 ? Math.max(1, Number(args[jIdx + 1]) || 1) : Number(process.env.E2E_PARALLEL) || 3;
const only = args.filter((a, i) => a !== '-j' && (jIdx < 0 || i !== jIdx + 1));
const tests = fs.readdirSync(dir).filter(f => /^test_.*\.js$/.test(f) && (only.length === 0 || only.some(o => f.includes(o)))).sort();

function runOne(t) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(dir, t)], { encoding: 'utf8' });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 240_000);
    child.on('close', code => { clearTimeout(timer); resolve({ t, code, out }); });
  });
}

(async () => {
  let failed = 0;
  let next = 0;
  const results = new Array(tests.length);
  await Promise.all(Array.from({ length: Math.min(parallel, tests.length) }, async () => {
    while (next < tests.length) {
      const i = next++;
      const r = await runOne(tests[i]);
      const bad = r.code !== 0 || /❌|: false/.test(r.out);
      results[i] = { ...r, bad };
      console.log(`${bad ? '❌' : '✅'} ${r.t}`);
      if (bad) { failed++; console.log(r.out.split('\n').filter(l => /❌|: false|FAIL|Error/.test(l)).slice(0, 8).map(l => '   ' + l).join('\n')); }
    }
  }));
  console.log(`\n${tests.length - failed}/${tests.length} bestanden`);
  process.exit(failed ? 1 : 0);
})();
