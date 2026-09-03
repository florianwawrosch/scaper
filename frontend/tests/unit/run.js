#!/usr/bin/env node
// Kompiliert die getesteten lib-Dateien nach CommonJS und führt alle *.test.{js,mjs} aus.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const tsc = spawnSync(process.execPath, [path.join(dir, '../../node_modules/typescript/bin/tsc'), '-p', path.join(dir, 'tsconfig.json')], { encoding: 'utf8' });
if (tsc.status !== 0) { console.error(tsc.stdout, tsc.stderr); process.exit(1); }
let failed = 0;
for (const t of fs.readdirSync(dir).filter(f => /\.test\.(js|mjs)$/.test(f)).sort()) {
  const r = spawnSync(process.execPath, [path.join(dir, t)], { encoding: 'utf8', timeout: 120_000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const bad = r.status !== 0 || out.includes('❌');
  console.log(`${bad ? '❌' : '✅'} ${t}`);
  if (bad) { failed++; console.log(out.split('\n').filter(l => /❌|Error/.test(l)).slice(0, 8).map(l => '   ' + l).join('\n')); }
}
console.log(`\n${failed ? 'FEHLER' : 'OK'}`);
process.exit(failed ? 1 : 0);
