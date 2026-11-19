import React, { useMemo, useState } from 'react';
import { adminApi } from '../../api/admin';
import {
  AdminApiError,
  RISK_FIELD_ORDER,
  RiskDraft,
  draftFromLimits,
  emptyRiskDraft,
  formatAdminError,
  validateRiskDraft,
} from '../../api/adminProtocol';
import { RiskBounds, RiskPayload } from '../../api/adminTypes';
import { Field, Note, ServerError, adminInputClass, formatAdminWhen, formatDrawdown, AdminWrite } from './adminUi';

const LABELS: Record<keyof RiskBounds, string> = {
  max_capital: 'Capital máximo',
  max_order_size: 'Tamanho máximo da ordem',
  daily_loss_limit: 'Perda diária máxima',
  max_trades_per_day: 'Trades por dia',
  max_open_positions: 'Posições abertas',
  max_drawdown: 'Drawdown máximo',
};

const UNITS: Record<keyof RiskBounds, string> = {
  max_capital: 'USDT',
  max_order_size: 'USDT',
  daily_loss_limit: 'USDT',
  max_trades_per_day: 'inteiro',
  max_open_positions: 'inteiro',
  max_drawdown: 'fração, 0.06 = 6%',
};

function currentValue(risk: RiskPayload, key: keyof RiskBounds): string {
  const limits = risk.limits;
  if (!limits) return 'não gravado';
  if (key === 'max_drawdown') return formatDrawdown(limits.max_drawdown);
  return String(limits[key]);
}

export function RiskPanel({
  risk,
  busy,
  onWrite,
  onChanged,
}: {
  risk: RiskPayload;
  busy: boolean;
  onWrite: AdminWrite;
  onChanged: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<RiskDraft>(() =>
    risk.limits ? draftFromLimits(risk.limits, risk.allowed_pairs) : emptyRiskDraft(risk.allowed_pairs)
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const validation = useMemo(
    () => validateRiskDraft(draft, risk.bounds, risk.allowed_pairs),
    [draft, risk]
  );

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!validation.ok) {
      setError(validation.errors.join('\n'));
      return;
    }
    const limits = validation.limits;
    setError(null);
    onWrite('Gravar os limites de risco da cripto. O live não é ligado por esta ação.', async (totp) => {
      try {
        const result = await adminApi.putRisk(limits, totp);
        setNotice(
          result.backup
            ? `Limites gravados. Cópia: ${result.backup}. O live continua desligado até o passo próprio.`
            : 'Limites gravados. O live continua desligado até o passo próprio.'
        );
        await onChanged();
      } catch (err) {
        if (err instanceof AdminApiError && (err.code === 'totp' || err.unauthenticated)) throw err;
        setError(formatAdminError(err));
      }
    }, { method: 'PUT', path: '/api/v2/admin/crypto/risk' });
  };

  return (
    <form onSubmit={save} className="space-y-4" autoComplete="off">
      <div>
        <h3 className="text-base font-semibold text-[#e6edf3]">Limites de risco da cripto</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#8b9bb4]">
          O cliente bloqueia o que está fora dos bounds deste GET. O servidor continua sendo quem
          decide e pode recusar.
          {risk.limits?.updated_at
            ? ` Gravado em ${formatAdminWhen(risk.limits.updated_at)} (${risk.limits.source ?? 'sem source'}).`
            : ' Ainda não há limites gravados por este fluxo.'}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#30363d]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#161b22] text-[#8b9bb4]">
            <tr>
              <th className="px-3 py-2 font-medium">Campo</th>
              <th className="px-3 py-2 font-medium">Atual</th>
              <th className="px-3 py-2 font-medium">Novo</th>
            </tr>
          </thead>
          <tbody>
            {RISK_FIELD_ORDER.map((key) => {
              const next = validation.ok
                ? key === 'max_drawdown'
                  ? formatDrawdown(validation.limits.max_drawdown)
                  : String(validation.limits[key])
                : draft[key] || '—';
              const current = currentValue(risk, key);
              const changed = risk.limits ? next !== current && validation.ok : Boolean(draft[key]);
              return (
                <tr key={key} className={changed ? 'bg-[#7aa2f7]/10' : undefined}>
                  <td className="px-3 py-2 text-[#e6edf3]">{LABELS[key]}</td>
                  <td className="px-3 py-2 font-mono text-[#8b9bb4]">{current}</td>
                  <td className="px-3 py-2 font-mono text-[#e6edf3]">{next}</td>
                </tr>
              );
            })}
            <tr>
              <td className="px-3 py-2 text-[#e6edf3]">Pares</td>
              <td className="px-3 py-2 font-mono text-[#8b9bb4]">
                {risk.limits?.allowed_pairs.join(', ') || 'não gravado'}
              </td>
              <td className="px-3 py-2 font-mono text-[#e6edf3]">
                {draft.allowed_pairs.length ? draft.allowed_pairs.join(', ') : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {RISK_FIELD_ORDER.map((key) => {
          const bound = risk.bounds[key];
          return (
            <Field
              key={key}
              label={LABELS[key]}
              hint={bound ? `${UNITS[key]} · entre ${bound.min} e ${bound.max}` : 'bounds ausentes'}
              error={attempted ? validation.ok ? null : validation.fieldErrors[key] : null}
            >
              <input
                inputMode={key === 'max_trades_per_day' || key === 'max_open_positions' ? 'numeric' : 'decimal'}
                value={draft[key]}
                spellCheck={false}
                onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                className={adminInputClass}
              />
            </Field>
          );
        })}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-[#e6edf3]">Pares permitidos</legend>
        <p className="text-[11px] text-[#8b9bb4]">Pelo menos um. Só entram pares desta lista do servidor.</p>
        <div className="flex flex-wrap gap-3">
          {risk.allowed_pairs.map((pair) => (
            <label key={pair} className="inline-flex items-center gap-2 text-xs text-[#e6edf3]">
              <input
                type="checkbox"
                checked={draft.allowed_pairs.includes(pair)}
                onChange={(event) => {
                  setDraft((prev) => ({
                    ...prev,
                    allowed_pairs: event.target.checked
                      ? risk.allowed_pairs.filter((item) => item === pair || prev.allowed_pairs.includes(item))
                      : prev.allowed_pairs.filter((item) => item !== pair),
                  }));
                }}
              />
              <span className="font-mono">{pair}</span>
            </label>
          ))}
        </div>
        {attempted && !validation.ok && validation.fieldErrors.allowed_pairs ? (
          <p className="text-[11px] text-[#f85149]">{validation.fieldErrors.allowed_pairs}</p>
        ) : null}
      </fieldset>

      <Note tone="info">Esta gravação não envia live_enabled e não liga o agente.</Note>
      {notice ? <p className="text-xs text-[#e6edf3]">{notice}</p> : null}
      <ServerError error={error} />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-[#7aa2f7] px-3 py-2 text-xs font-semibold text-[#0d1117] disabled:cursor-not-allowed disabled:opacity-45"
      >
        Gravar limites
      </button>
    </form>
  );
}
