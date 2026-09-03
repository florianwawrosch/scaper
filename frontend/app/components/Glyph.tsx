/**
 * Unicode-Icon (↓ ⊞ ↻ → …) in einem Text-Button: ein paar Pixel größer als
 * die 10–11px-Beschriftung und sauber auf die Grundlinie gesetzt — sonst
 * wirken die Pfeile bei der kleinen Mono-Schrift wie Fliegenschiss.
 */
export function Glyph({ children, after = false, size = 14 }: { children: React.ReactNode; after?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        fontSize: size, lineHeight: 1, display: 'inline-block', verticalAlign: -2,
        ...(after ? { marginLeft: 6 } : { marginRight: 6 }),
      }}
    >
      {children}
    </span>
  );
}
