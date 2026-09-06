// lib/rateLimit: Login-Bremse — 10 Fehlversuche in 15 min sperren, Erfolg setzt zurück, Fenster läuft ab
const { ok, lib } = require('./setup');
const R = lib('rateLimit');
const t0 = 1_000_000;
ok(R.loginBlockedFor('a', t0) === 0, 'frisch: nicht gesperrt');
for (let i = 0; i < 9; i++) R.recordLoginFailure('a', t0 + i * 1000);
ok(R.loginBlockedFor('a', t0 + 10_000) === 0, '9 Fehlversuche: noch erlaubt');
R.recordLoginFailure('a', t0 + 10_000);
const secs = R.loginBlockedFor('a', t0 + 11_000);
ok(secs > 0 && secs <= 15 * 60, `10. Fehlversuch sperrt (${secs}s)`);
ok(R.loginBlockedFor('b', t0 + 11_000) === 0, 'andere Adresse unbeeinflusst');
ok(R.loginBlockedFor('a', t0 + 10_000 + 15 * 60 * 1000 + 1) === 0, 'nach dem Fenster wieder frei');
for (let i = 0; i < 10; i++) R.recordLoginFailure('c', t0 + i);
R.clearLoginFailures('c');
ok(R.loginBlockedFor('c', t0 + 20) === 0, 'Erfolg setzt zurück');
// Fenster: alte Fehlversuche zählen nicht mehr
for (let i = 0; i < 9; i++) R.recordLoginFailure('d', t0 + i);
R.recordLoginFailure('d', t0 + 16 * 60 * 1000);
ok(R.loginBlockedFor('d', t0 + 16 * 60 * 1000 + 1) === 0, 'Fehlversuch nach Fensterende startet neu');
ok(R.clientIp({ get: n => (n === 'x-forwarded-for' ? '1.2.3.4, 5.6.7.8' : null) }) === '1.2.3.4' && R.clientIp({ get: () => null }) === 'unknown', 'clientIp aus x-forwarded-for');
