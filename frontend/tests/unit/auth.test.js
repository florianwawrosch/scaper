// Unit-Tests: Login-Token (HMAC), constant-time compare, Login-Alert-Formatierung/-Versand
const http = require('http');
const { ok, lib } = require('./setup');
const { safeEqual, authToken, authEnv } = lib('auth');
const { describeUserAgent, formatLoginAlert, notifyLogin } = lib('loginNotify');
(async () => {
  ok(safeEqual('abc', 'abc') && !safeEqual('abc', 'abd') && !safeEqual('abc', 'ab'), 'safeEqual basics');
  const t1 = await authToken('florian', 'pw1'), t2 = await authToken('florian', 'pw1'), t3 = await authToken('florian', 'pw2'), t4 = await authToken('other', 'pw1');
  ok(t1 === t2 && /^[0-9a-f]{64}$/.test(t1), 'authToken deterministic, 64 hex chars');
  ok(t1 !== t3 && t1 !== t4, 'token changes when password OR user changes');
  ok(!t1.includes('pw1') && !t1.includes('florian'), 'token contains neither user nor password');
  process.env.APP_USER = ''; process.env.APP_PASSWORD = 'x';
  ok(JSON.stringify(authEnv().missing) === '["APP_USER"]', 'authEnv reports missing APP_USER');
  process.env.APP_USER = 'u'; process.env.APP_PASSWORD = '';
  ok(JSON.stringify(authEnv().missing) === '["APP_PASSWORD"]', 'authEnv reports missing APP_PASSWORD');
  ok(describeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36') === 'Chrome · macOS', 'UA: Chrome · macOS');
  ok(describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1') === 'Safari · iOS', 'UA: Safari · iOS');
  ok(describeUserAgent('curl/8.4.0') === 'Script/Tool', 'UA: curl → Script/Tool');
  const ctx = { user: 'florian', when: new Date('2026-09-03T10:30:00Z'), ip: '203.0.113.7', city: 'Berlin', country: 'DE', userAgent: 'x', browser: 'Chrome · macOS' };
  const m = formatLoginAlert(ctx);
  ok(m.subject.includes('Neue Anmeldung') && m.subject.includes('Berlin'), `subject: ${m.subject}`);
  ok(m.text.includes('203.0.113.7') && m.text.includes('APP_PASSWORD') && m.html.includes('<b>Berlin, DE</b>'), 'text+html carry IP, place, remediation');
  // transports: webhook + resend (URL override) via local server
  const got = [];
  const srv = http.createServer((req, res) => { let b=''; req.on('data', c => b += c); req.on('end', () => { got.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(b) }); res.writeHead(200); res.end('{}'); }); });
  await new Promise(r => srv.listen(18998, r));
  process.env.LOGIN_ALERT_WEBHOOK = 'http://localhost:18998/hook';
  process.env.RESEND_API_KEY = 're_test'; process.env.LOGIN_ALERT_TO = 'a@b.de, c@d.de';
  // RESEND_URL is read at module load — reload module with override
  delete require.cache[require.resolve(require('path').join(require('./setup').OUT, 'lib', 'loginNotify.js'))];
  process.env.RESEND_API_URL = 'http://localhost:18998/resend';
  const { notifyLogin: notify2 } = require(require('path').join(require('./setup').OUT, 'lib', 'loginNotify.js'));
  const r = await notify2(ctx);
  ok(r.email && r.webhook, `both transports reported success: ${JSON.stringify(r)}`);
  const hook = got.find(g => g.url === '/hook'), mail = got.find(g => g.url === '/resend');
  ok(hook && hook.body.event === 'login' && hook.body.ip === '203.0.113.7' && hook.body.subject === m.subject, 'webhook payload has event/ip/subject');
  ok(mail && mail.auth === 'Bearer re_test' && JSON.stringify(mail.body.to) === '["a@b.de","c@d.de"]' && mail.body.html.includes('Neue Anmeldung'), 'resend payload: bearer, split recipients, html');
  // not configured → no calls, no throw
  delete process.env.LOGIN_ALERT_WEBHOOK; delete process.env.RESEND_API_KEY; got.length = 0;
  const r0 = await notify2(ctx);
  ok(!r0.email && !r0.webhook && got.length === 0, 'unconfigured → silent no-op');
  srv.close();
})();
