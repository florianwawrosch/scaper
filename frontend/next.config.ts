import type { NextConfig } from "next";

// Härtung: kein Framing (Clickjacking), kein MIME-Sniffing, knappe Referrer,
// keine Browser-APIs, die die App nicht braucht. Die Login-Sperre selbst
// sitzt in proxy.ts.
const securityHeaders = [
  { key: 'X-Frame-Options',        value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
