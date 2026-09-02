/**
 * Constant-time string compare — plain !== leaks timing info character-by-
 * character, letting an attacker guess a secret one byte at a time. Written
 * without the Node `crypto` module so it also works in middleware.ts, which
 * runs on the Edge runtime (no Node APIs) unless explicitly configured.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
