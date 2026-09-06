// originFromHeaders: Vercel-Geo-Header → Label; ohne Geo die IP; localhost bleibt leer
const { ok, lib } = require('./setup');
const { originFromHeaders } = lib('origin');
const H = (o) => ({ get: (n) => (n in o ? o[n] : null) });

let r = originFromHeaders(H({ 'x-forwarded-for': '84.113.1.2, 10.0.0.1', 'x-vercel-ip-city': 'Wien', 'x-vercel-ip-country': 'at' }));
ok(r.label === 'Wien, AT' && r.ip === '84.113.1.2' && r.country === 'AT', `Stadt + Land, erste IP aus x-forwarded-for (${r.label})`);

r = originFromHeaders(H({ 'x-forwarded-for': '84.113.1.2', 'x-vercel-ip-city': 'M%C3%BCnchen', 'x-vercel-ip-country': 'DE' }));
ok(r.label === 'München, DE', `Stadt wird URL-dekodiert (${r.label})`);

r = originFromHeaders(H({ 'x-real-ip': '84.113.1.2', 'x-vercel-ip-country': 'DE' }));
ok(r.label === 'DE' && r.ip === '84.113.1.2', 'nur Land, IP aus x-real-ip');

r = originFromHeaders(H({ 'x-forwarded-for': '84.113.1.2' }));
ok(r.label === '84.113.1.2', 'ohne Geo: die IP als Label');

r = originFromHeaders(H({ 'x-forwarded-for': '127.0.0.1' }));
ok(r.label === '' && r.ip === '127.0.0.1', 'localhost: leeres Label');

r = originFromHeaders(H({}));
ok(r.label === '' && r.ip === '', 'keine Header: leer');
