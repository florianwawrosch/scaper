// Meta-Token: Countdown-Format, Stufen (ok / warn / expired), Anzeigetext
const { ok, lib } = require('./setup');
const { formatRemaining, metaTokenLevel, metaTokenText, META_WARN_DAYS } = lib('metaToken');

const H = 3_600_000, D = 24 * H;
ok(formatRemaining(5 * D + 3 * H + 12 * 60_000) === '5 Tagen, 3 Stunden und 12 Minuten', `Countdown (${formatRemaining(5 * D + 3 * H + 12 * 60_000)})`);
ok(formatRemaining(1 * D + 1 * H + 1 * 60_000) === '1 Tag, 1 Stunde und 1 Minute', 'Einzahl');
ok(formatRemaining(45 * 60_000) === '0 Tagen, 0 Stunden und 45 Minuten', 'unter einer Stunde');
ok(formatRemaining(0) === 'abgelaufen' && formatRemaining(-5) === 'abgelaufen', 'abgelaufen');

const now = Date.parse('2026-09-07T12:00:00Z');
const st = (over) => ({ configured: true, valid: true, expiresAt: null, neverExpires: false, scopesOk: true, expiryUnknown: false, message: '', checkedAt: '', ...over });
ok(metaTokenLevel(null, now) === 'none' && metaTokenLevel(st({ configured: false }), now) === 'none', 'ohne Token: none');
ok(metaTokenLevel(st({ expiresAt: new Date(now + 60 * D).toISOString() }), now) === 'ok', '60 Tage: ok');
ok(metaTokenLevel(st({ expiresAt: new Date(now + META_WARN_DAYS * D - 1000).toISOString() }), now) === 'warn', 'knapp unter 7 Tagen: warn');
ok(metaTokenLevel(st({ expiresAt: new Date(now - 1000).toISOString() }), now) === 'expired', 'abgelaufen: expired');
ok(metaTokenLevel(st({ valid: false }), now) === 'expired', 'ungültig: expired');
ok(metaTokenLevel(st({ neverExpires: true }), now) === 'ok', 'läuft nie ab: ok');
ok(metaTokenLevel(st({ expiryUnknown: true }), now) === 'ok', 'Ablauf unbekannt, aber gültig: ok');

ok(metaTokenText(st({ expiresAt: new Date(now + 58 * D + H).toISOString() }), now).startsWith('gültig bis') && metaTokenText(st({ expiresAt: new Date(now + 58 * D + H).toISOString() }), now).includes('(58 Tage)'), `Anzeigetext (${metaTokenText(st({ expiresAt: new Date(now + 58 * D + H).toISOString() }), now)})`);
ok(metaTokenText(st({ neverExpires: true }), now) === 'läuft nie ab', 'nie ablaufend');
ok(metaTokenText(st({ expiresAt: new Date(now + 3 * D).toISOString(), scopesOk: false }), now).includes('ads_read fehlt'), 'fehlende Berechtigung im Text');
ok(metaTokenText(st({ valid: false, message: 'Session expired' }), now).includes('ungültig'), 'ungültig im Text');
ok(metaTokenText(st({ configured: false }), now) === 'kein Token gesetzt', 'nicht gesetzt');
