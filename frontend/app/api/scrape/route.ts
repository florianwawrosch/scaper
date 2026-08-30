import { NextRequest, NextResponse } from 'next/server';
import { envKey } from '@/lib/serverKeys';

/**
 * Meta Ads Library scraper — direct TypeScript port of core/meta_ads_scraper.py.
 * Runs server-side on Vercel, so no separate Python backend is needed.
 *
 * HINWEIS ZUR KEY-SPEICHERUNG: Der Meta-Token wird NICHT im Code gespeichert,
 * sondern aus den Vercel-Umgebungsvariablen gelesen (META_API_KEY — siehe
 * lib/serverKeys.ts für alle akzeptierten Namen). Dort ist er dauerhaft
 * hinterlegt und übersteht jeden Deploy.
 */

export const maxDuration = 60;

const API_URL = 'https://graph.facebook.com/v21.0/ads_archive';

// "Alle Länder" → broad market list (Meta requires ad_reached_countries)
const ALL_COUNTRIES = [
  'DE', 'AT', 'CH', 'US', 'GB', 'FR', 'IT', 'ES', 'NL', 'BE', 'PL', 'SE',
  'DK', 'NO', 'FI', 'IE', 'PT', 'CZ', 'GR', 'CA', 'AU', 'NZ', 'BR', 'MX',
];

const FIELDS = [
  'id', 'page_name', 'page_id',
  'ad_creative_bodies', 'ad_creative_link_captions',
  'ad_creative_link_descriptions', 'ad_creative_link_titles',
  'ad_delivery_start_time', 'ad_delivery_stop_time',
  'ad_snapshot_url', 'bylines', 'publisher_platforms',
  'languages', 'eu_total_reach',
];

function flatten(ad: any, searchTerm: string): Record<string, string> {
  const join = (v: unknown) => Array.isArray(v) ? v.join(' | ') : '';
  const list = (v: unknown) => Array.isArray(v) ? v.join(', ') : '';
  return {
    id:             String(ad.id ?? ''),
    page_name:      String(ad.page_name ?? ''),
    page_id:        String(ad.page_id ?? ''),
    ad_text:        join(ad.ad_creative_bodies),
    ad_title:       join(ad.ad_creative_link_titles),
    ad_description: join(ad.ad_creative_link_descriptions),
    ad_caption:     join(ad.ad_creative_link_captions),
    platforms:      list(ad.publisher_platforms),
    languages:      list(ad.languages),
    start_date:     String(ad.ad_delivery_start_time ?? ''),
    stop_date:      String(ad.ad_delivery_stop_time ?? ''),
    snapshot_url:   String(ad.ad_snapshot_url ?? ''),
    bylines:        typeof ad.bylines === 'string' ? ad.bylines : list(ad.bylines),
    reach:          String(ad.eu_total_reach ?? ''),
    search_term:    searchTerm,
  };
}

export async function POST(req: NextRequest) {
  let cfg: any = {};
  try { cfg = await req.json(); } catch {}

  const token = cfg.meta_ads_token || envKey('meta_ads');
  if (!token) {
    return NextResponse.json(
      { detail: 'Meta API Key fehlt — META_API_KEY als Umgebungsvariable in Vercel setzen.' },
      { status: 400 },
    );
  }

  let keywords: string[] = Array.isArray(cfg.keywords)
    ? cfg.keywords
    : String(cfg.keywords ?? '').split('\n');
  keywords = keywords.map((k: string) => k.trim()).filter(Boolean);
  if (keywords.length === 0) {
    return NextResponse.json({ detail: 'Keine Suchbegriffe angegeben.' }, { status: 400 });
  }

  // Meta's ad_reached_countries is required, so "ALL" expands to a broad
  // country list rather than silently collapsing to the DE/AT default.
  const requested: string[] = cfg.countries?.length ? cfg.countries : ['DE', 'AT'];
  const countries: string[] = requested.includes('ALL') ? ALL_COUNTRIES : requested.filter(Boolean);
  const platforms: string[] = cfg.platforms?.length ? cfg.platforms : ['FACEBOOK', 'INSTAGRAM'];
  const limit = Math.max(1, Math.min(Number(cfg.limit) || 50, 1000));

  const allRows: Record<string, string>[] = [];
  const seenAdIds = new Set<string>();

  try {
    for (const term of keywords) {
      const params = new URLSearchParams({
        access_token: token,
        search_terms: term,
        ad_reached_countries: JSON.stringify(countries.length ? countries : ['DE', 'AT']),
        ad_active_status: cfg.ad_status || 'ACTIVE',
        fields: FIELDS.join(','),
        limit: String(Math.min(limit, 100)),
        publisher_platforms: JSON.stringify(platforms),
        search_type: cfg.search_type || 'KEYWORD_UNORDERED',
      });
      if (cfg.languages?.length)        params.set('languages', JSON.stringify(cfg.languages));
      if (cfg.media_type && cfg.media_type !== 'ALL') params.set('media_type', cfg.media_type);
      if (cfg.ad_delivery_date_min)     params.set('ad_delivery_date_min', cfg.ad_delivery_date_min);
      if (cfg.ad_delivery_date_max)     params.set('ad_delivery_date_max', cfg.ad_delivery_date_max);
      if (cfg.bylines) {
        const b = Array.isArray(cfg.bylines) ? cfg.bylines.join(',') : String(cfg.bylines);
        if (b.trim()) params.set('bylines', b);
      }

      let url: string | null = `${API_URL}?${params.toString()}`;
      let collected = 0;

      while (url && collected < limit) {
        const res: Response = await fetch(url, {
          headers: { 'User-Agent': 'LeadPipeline/1.0' },
          signal: AbortSignal.timeout(30_000),
        });
        const raw = await res.text();

        let data: any;
        try { data = JSON.parse(raw); } catch {
          throw new Error(`Ungültige API-Antwort: ${raw.slice(0, 200)}`);
        }
        if (!res.ok || data.error) {
          const err = data.error ?? {};
          throw new Error(`Meta API Fehler (${err.code ?? res.status}): ${err.message ?? raw.slice(0, 200)}`);
        }

        for (const ad of data.data ?? []) {
          if (collected >= limit) break;
          // Same ad can match several keywords — keep it once
          const adId = String(ad.id ?? '');
          if (adId && seenAdIds.has(adId)) continue;
          if (adId) seenAdIds.add(adId);
          allRows.push(flatten(ad, term));
          collected++;
        }
        const next = data.paging?.next;
        url = next && collected < limit ? next : null;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
    return NextResponse.json({ detail: msg }, { status: 502 });
  }

  return NextResponse.json({ rows: allRows, count: allRows.length });
}
