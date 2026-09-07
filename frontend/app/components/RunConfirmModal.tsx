'use client';

import { providerLabel, type AnalysisConfig } from '@/lib/ai';
import { fmtUsd, type BudgetStatus } from '@/lib/budget';
import { T } from '@/app/theme';

interface Props {
  cfg: AnalysisConfig;
  todo: number;
  skipped: number;
  /** Geschätzte Kosten dieses Laufs (Richtwert), null = Modell ohne Preis */
  estimate?: number | null;
  budget?: BudgetStatus;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Credit-Schutz: großer KI-Lauf (oder Lauf nahe am Monatsbudget) erst nach Bestätigung */
export function RunConfirmModal({ cfg, todo, skipped, estimate, budget, onConfirm, onCancel }: Props) {
  const warn = budget?.level === 'warn' || budget?.level === 'over';
  return (
    <div data-testid="ai-run-confirm" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw', background: '#10111a', border: '1px solid rgba(232,176,75,.4)', borderRadius: 10, padding: '18px 20px', boxShadow: '0 12px 40px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontFamily: T.ffMono, fontSize: 12, fontWeight: 600, color: T.gold }}>KI-Lauf wirklich starten?</p>
        <p style={{ fontFamily: T.ffBody, fontSize: 13, color: T.inkD, lineHeight: 1.6 }}>
          <strong style={{ color: T.ink }}>{todo.toLocaleString('de')} Zeilen</strong> werden mit{' '}
          <strong style={{ color: T.ink }}>{providerLabel(cfg.provider)} · {cfg.model}</strong> klassifiziert
          {skipped > 0 ? `, ${skipped.toLocaleString('de')} übersprungen (schon fertig, unverändert)` : ''}.
          Das kostet API-Credits beim Anbieter — ein Aufruf pro Zeile.
        </p>
        <div data-testid="ai-run-budget" style={{ fontFamily: T.ffMono, fontSize: 11, color: T.inkD, lineHeight: 1.7, background: 'rgba(255,255,255,.03)', border: `1px solid ${warn ? 'rgba(232,176,75,.4)' : T.lineS}`, borderRadius: 6, padding: '8px 12px' }}>
          <div>≈ Kosten dieses Laufs: <strong style={{ color: T.ink }}>{fmtUsd(estimate ?? null)}</strong> <span style={{ color: T.inkF }}>(Richtwert)</span></div>
          {budget?.limit ? (
            <div style={{ color: warn ? '#e8b04b' : T.inkD }}>
              Monatsbudget: <strong style={{ color: warn ? '#e8b04b' : T.ink }}>{fmtUsd(budget.spent)}</strong> von {fmtUsd(budget.limit)} verbraucht
              {warn ? ' — nach diesem Lauf ist das Budget fast aufgebraucht' : ''}
            </div>
          ) : (
            <div style={{ color: T.inkF }}>Kein Monatsbudget gesetzt (Einstellungen → Verbrauch)</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} data-testid="ai-run-confirm-cancel" style={{ fontFamily: T.ffMono, fontSize: 11, padding: '6px 14px', borderRadius: 6, border: `1px solid ${T.lineS}`, background: 'transparent', color: T.inkD, cursor: 'pointer' }}>Abbrechen</button>
          <button onClick={onConfirm} data-testid="ai-run-confirm-start" style={{ fontFamily: T.ffMono, fontSize: 11, fontWeight: 700, padding: '6px 16px', borderRadius: 6, border: 'none', background: T.gold, color: '#07070a', cursor: 'pointer' }}>▶ {todo.toLocaleString('de')} Zeilen klassifizieren</button>
        </div>
      </div>
    </div>
  );
}
