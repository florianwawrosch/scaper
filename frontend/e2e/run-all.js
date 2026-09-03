#!/usr/bin/env node
// Führt alle e2e/test_*.js nacheinander aus (Dev-Server muss laufen).
// Ein Test gilt als fehlgeschlagen bei Exit-Code ≠ 0, "❌" oder ": false" in der Ausgabe.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const only = process.argv.slice(2);
const tests = fs.readdirSync(dir).filter(f => /^test_.*\.js$/.test(f) && (only.length === 0 || only.some(o => f.includes(o)))).sort();
let failed = 0;
for (const t of tests) {
  const r = spawnSync(process.execPath, [path.join(dir, t)], { encoding: 'utf8', timeout: 240_000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const bad = r.status !== 0 || /❌|: false/.test(out);
  console.log(`${bad ? '❌' : '✅'} ${t}`);
  if (bad) { failed++; console.log(out.split('\n').filter(l => /❌|: false|FAIL|Error/.test(l)).slice(0, 8).map(l => '   ' + l).join('\n')); }
}
console.log(`\n${tests.length - failed}/${tests.length} bestanden`);
process.exit(failed ? 1 : 0);
