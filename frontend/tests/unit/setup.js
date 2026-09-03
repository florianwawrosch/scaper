// Lädt die nach tests/unit/.out kompilierten lib-Module in Node:
// löst den "@/"-Alias auf und stellt ein localStorage-Shim bereit.
const Module = require('module');
const path = require('path');
const OUT = path.join(__dirname, '.out');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith('@/')) return path.join(OUT, req.slice(2) + '.js');
  return orig.call(this, req, ...rest);
};
const store = new Map();
global.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear(),
  get length() { return store.size; },
  key: i => [...store.keys()][i] ?? null,
};
global.window = {};
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const lib = (name) => require(path.join(OUT, 'lib', name + '.js'));
module.exports = { OUT, ok, lib };
