'use client';

import { useEffect } from 'react';
import { syncServerKeys } from '@/lib/settings';

/** Pulls server-side env keys into localStorage once per page load. */
export function KeySync() {
  useEffect(() => {
    syncServerKeys().then(changed => {
      // Reload key-dependent UI once when keys arrived for the first time
      if (changed) window.dispatchEvent(new Event('keys-synced'));
    });
  }, []);
  return null;
}
