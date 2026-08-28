'use client';

import { useRouter, usePathname } from 'next/navigation';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <header className="bg-panel border-b border-line">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <button
            onClick={() => router.push('/')}
            className="flex items-baseline gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-gold font-disp text-xl font-light">
              Lead <em className="italic text-gold-bright">Pipeline</em>
            </span>
          </button>

          {/* Nav */}
          <nav className="hidden sm:flex items-center gap-6">
            <button
              onClick={() => router.push('/')}
              className={`text-xs font-mono tracking-wider transition-colors ${
                isActive('/') ? 'text-gold' : 'text-ink-faint hover:text-ink'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => router.push('/runs')}
              className={`text-xs font-mono tracking-wider transition-colors ${
                pathname.startsWith('/runs') ? 'text-gold' : 'text-ink-faint hover:text-ink'
              }`}
            >
              Runs
            </button>
            <button
              onClick={() => router.push('/settings')}
              className={`text-xs font-mono tracking-wider transition-colors ${
                isActive('/settings') ? 'text-gold' : 'text-ink-faint hover:text-ink'
              }`}
            >
              Einstellungen
            </button>
          </nav>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-ink-faint font-mono">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-good" />
              <span>Connected</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
