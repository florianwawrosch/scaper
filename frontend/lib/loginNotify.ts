// Security notification on every successful login — the "new sign-in to
// your account" mail everyone knows from Google/Amazon/GitHub. Sessions last
// a year, so a login is a rare event and worth an alert. Sent after the
// response (never blocks or fails the login). Two transports, both optional:
//
//   RESEND_API_KEY + LOGIN_ALERT_TO           → e-mail via Resend (https://resend.com)
//   LOGIN_ALERT_WEBHOOK                       → POST JSON to any hook (Zapier Catch
//                                               Hook → Gmail, Make, Slack, …)
//   LOGIN_ALERT_FROM (optional)               → sender for Resend, default
//                                               "Scaper <onboarding@resend.dev>"

import type { NextRequest } from 'next/server';

export interface LoginContext {
  user: string;
  when: Date;
  ip: string;
  city: string;
  country: string;
  userAgent: string;
  browser: string;
}

const RESEND_URL = process.env.RESEND_API_URL || 'https://api.resend.com/emails';

/** Best-effort "Chrome · macOS" from a user agent — enough for a human to recognise their device. */
export function describeUserAgent(ua: string): string {
  const os =
    /Windows/i.test(ua) ? 'Windows' :
    /iPhone|iPad/i.test(ua) ? 'iOS' :
    /Android/i.test(ua) ? 'Android' :
    /Mac OS X|Macintosh/i.test(ua) ? 'macOS' :
    /Linux/i.test(ua) ? 'Linux' : '';
  const browser =
    /Edg\//i.test(ua) ? 'Edge' :
    /OPR\//i.test(ua) ? 'Opera' :
    /Chrome\//i.test(ua) ? 'Chrome' :
    /Firefox\//i.test(ua) ? 'Firefox' :
    /Safari\//i.test(ua) ? 'Safari' :
    /curl|python|node|playwright|headless/i.test(ua) ? 'Script/Tool' : '';
  return [browser, os].filter(Boolean).join(' · ') || 'Unbekannt';
}

export function loginContextFromRequest(req: NextRequest, user: string): LoginContext {
  const h = req.headers;
  const ua = h.get('user-agent') ?? '';
  const dec = (v: string | null) => { try { return v ? decodeURIComponent(v) : ''; } catch { return v ?? ''; } };
  return {
    user,
    when: new Date(),
    ip: (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unbekannt',
    // Vercel fills these in on every request at the edge
    city: dec(h.get('x-vercel-ip-city')),
    country: h.get('x-vercel-ip-country') ?? '',
    userAgent: ua,
    browser: describeUserAgent(ua),
  };
}

export function formatLoginAlert(ctx: LoginContext): { subject: string; text: string; html: string } {
  const when = ctx.when.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'full', timeStyle: 'short' }) + ' Uhr';
  const place = [ctx.city, ctx.country].filter(Boolean).join(', ') || 'unbekannt';
  const rows: [string, string][] = [
    ['Benutzer', ctx.user],
    ['Zeit', when],
    ['Standort (ungefähr)', place],
    ['IP-Adresse', ctx.ip],
    ['Gerät', ctx.browser],
  ];
  const subject = `Neue Anmeldung bei Scaper (${ctx.browser}${place !== 'unbekannt' ? `, ${place}` : ''})`;
  const text = [
    'Gerade hat sich jemand bei Scaper angemeldet.',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Warst du das? Dann ist alles gut — die Anmeldung gilt auf diesem Gerät ein Jahr.',
    '',
    'Warst du das NICHT? Dann sofort in Vercel → Settings → Environment Variables',
    'APP_PASSWORD (und ggf. APP_USER) ändern und neu deployen. Das loggt alle',
    'Geräte aus, auch das fremde. Danach die API-Keys prüfen.',
    '',
    `User-Agent: ${ctx.userAgent || '–'}`,
  ].join('\n');
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;color:#1a1a1a">
<h2 style="margin:0 0 12px">Neue Anmeldung bei Scaper</h2>
<p>Gerade hat sich jemand bei Scaper angemeldet.</p>
<table style="border-collapse:collapse;margin:16px 0">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join('')}</table>
<p><b>Warst du das?</b> Dann ist alles gut — die Anmeldung gilt auf diesem Gerät ein Jahr.</p>
<p style="padding:12px 14px;background:#fff3f2;border:1px solid #f3c1bd;border-radius:8px"><b>Warst du das nicht?</b> Sofort in Vercel → Settings → Environment Variables <code>APP_PASSWORD</code> (und ggf. <code>APP_USER</code>) ändern und neu deployen. Das loggt alle Geräte aus, auch das fremde. Danach die API-Keys prüfen.</p>
<p style="color:#888;font-size:12px">User-Agent: ${esc(ctx.userAgent || '–')}</p>
</div>`;
  return { subject, text, html };
}

/** Sends via every configured transport; errors are logged, never thrown. */
export async function notifyLogin(ctx: LoginContext): Promise<{ email: boolean; webhook: boolean }> {
  const out = { email: false, webhook: false };
  const to = process.env.LOGIN_ALERT_TO;
  const resendKey = process.env.RESEND_API_KEY;
  const webhook = process.env.LOGIN_ALERT_WEBHOOK;
  if (!(resendKey && to) && !webhook) return out; // not configured — that's fine

  const msg = formatLoginAlert(ctx);
  const tasks: Promise<void>[] = [];

  if (resendKey && to) {
    tasks.push((async () => {
      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.LOGIN_ALERT_FROM || 'Scaper <onboarding@resend.dev>',
          to: to.split(',').map(s => s.trim()).filter(Boolean),
          subject: msg.subject, text: msg.text, html: msg.html,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      out.email = true;
    })().catch(e => console.error('[login-alert] email failed:', e instanceof Error ? e.message : e)));
  }

  if (webhook) {
    tasks.push((async () => {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'login',
          app: 'Scaper',
          user: ctx.user,
          time: ctx.when.toISOString(),
          ip: ctx.ip, city: ctx.city, country: ctx.country,
          device: ctx.browser, userAgent: ctx.userAgent,
          subject: msg.subject, text: msg.text, html: msg.html,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
      out.webhook = true;
    })().catch(e => console.error('[login-alert] webhook failed:', e instanceof Error ? e.message : e)));
  }

  await Promise.all(tasks);
  return out;
}
