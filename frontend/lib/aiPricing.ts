/**
 * Richtwerte für die Kostenschätzung im Verbrauchsprotokoll: USD je 1 Mio.
 * Token (Eingabe / Ausgabe). Das ist KEINE Abrechnung — die Anbieter ändern
 * Preise, Caching und Batch-Rabatte greifen hier nicht. Bei neuen Modellen
 * hier ergänzen; unbekannte Modelle zeigen «–».
 */
export const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash':  { input: 0.10,  output: 0.40 },
  'gemini-1.5-pro':    { input: 1.25,  output: 5.00 },
  'gemini-1.5-flash':  { input: 0.075, output: 0.30 },
  'claude-opus-5':     { input: 15.00, output: 75.00 },
  'claude-sonnet-5':   { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':  { input: 1.00,  output: 5.00 },
  'gpt-4o':            { input: 2.50,  output: 10.00 },
  'gpt-4-turbo':       { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo':     { input: 0.50,  output: 1.50 },
};

/** Geschätzte Kosten in USD — null, wenn das Modell nicht in der Tabelle steht */
export function estimateCost(model: string | undefined, input: number, output: number): number | null {
  const p = model ? PRICES_PER_MTOK[model] : undefined;
  if (!p) return null;
  return (input * p.input + output * p.output) / 1_000_000;
}
