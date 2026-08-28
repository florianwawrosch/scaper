'use client';

import { useRouter, usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/runs', label: 'Runs' },
  { href: '/settings', label: 'Einstellungen' },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="bg-panel border-b border-line sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <button
            onClick={() => router.push('/')}
            className="flex items-baseline gap-2 select-none"
          >
            <span className="text-gold font-mono text-xs tracking-widest uppercase font-semibold">LP</span>
            <span className="text-ink font-disp text-base font-light tracking-tight">
              Lead <em className="text-gold-bright italic">Pipeline</em>
            </span>
          </button>

          <nav className="hidden sm:flex items-center gap-6">
            {NAV.map(({ href, label }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className={`relative text-xs font-mono tracking-wider transition-colors pb-0.5 ${
                    active ? 'text-ink' : 'text-ink-faint hover:text-ink-dim'
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute -bottom-[13px] left-0 right-0 h-px bg-gold" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-ink-faint">
          <span className="w-1.5 h-1.5 rounded-full bg-good inline-block" />
          <span className="tracking-wider">System OK</span>
        </div>
      </div>
    </header>
  );
}
