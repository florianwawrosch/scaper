import { NextRequest, NextResponse } from 'next/server';

// Server-side env lookup so keys work WITHOUT the NEXT_PUBLIC_ prefix.
// First matching name wins; covers common naming variants.
const KEY_SOURCES: Record<string, string[]> = {
  meta_ads:  ['META_ADS_TOKEN', 'META_ADS_API_TOKEN', 'NEXT_PUBLIC_META_ADS_TOKEN'],
  openai:    ['OPENAI_API_KEY', 'NEXT_PUBLIC_OPENAI_API_KEY'],
  gemini:    ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'NEXT_PUBLIC_GEMINI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'NEXT_PUBLIC_ANTHROPIC_API_KEY'],
  hunter_io: ['HUNTER_IO_KEY', 'HUNTER_IO_API_KEY', 'NEXT_PUBLIC_HUNTER_IO_KEY'],
  findymail: ['FINDYMAIL_KEY', 'FINDYMAIL_API_KEY', 'NEXT_PUBLIC_FINDYMAIL_KEY'],
};

export async function GET(req: NextRequest) {
  // Only serve keys on a password-protected deployment: without APP_PASSWORD
  // the app is public and this endpoint would leak secrets to anyone.
  const pwd = process.env.APP_PASSWORD;
  if (!pwd) return NextResponse.json({});

  // Middleware already gates this route, but verify the cookie here too.
  const cookie = req.cookies.get('app_auth')?.value;
  if (cookie !== `auth::${pwd}`) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  }

  const keys: Record<string, string> = {};
  for (const [k, names] of Object.entries(KEY_SOURCES)) {
    for (const n of names) {
      const v = process.env[n];
      if (v) { keys[k] = v; break; }
    }
  }
  return NextResponse.json(keys);
}
