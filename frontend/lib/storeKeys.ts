// Gemeinsame Key-Regeln für Browser- und Server-Seite des Speichers (keine Node-Abhängigkeiten!)

/** Große Keys werden nicht mit Wert im Manifest mitgeschickt, sondern bei Bedarf einzeln geladen */
export const LARGE_PREFIXES = ['csv_text_', 'analysis_hashes_'];
export const isLargeKey = (key: string) => LARGE_PREFIXES.some(p => key.startsWith(p));
