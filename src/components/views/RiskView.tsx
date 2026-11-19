import React, { useContext, useEffect, useState } from 'react';
import { LiveRevisionContext } from '../../api/liveContext';
import { triadeApi } from '../../api/triade';
import { AgentId, RiskResponse, TimelineEvent } from '../../types/triade';
import {
  AGENT_NAMES,
  formatBrasiliaTime,
  formatMoney,
  formatPct,
} from '../../utils/format';
import {
  ErrorState,
  ModeBadge,
  SkeletonCard,
  StatusBadge,
  UsageGauge,
} from '../ui/Primitives';

export const RiskView: React.FC<{ initialAgent?: AgentId }> = ({ initialAgent = 'b3' }) => {
  const [agent, setAgent] = useState<AgentId>(initialAgent);
  const [profile, setProfile] = useState<'micro_live' | 'research'>('micro_live');
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [rejects, setRejects] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const revision = useContext(LiveRevisionContext);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    Promise.all([
      triadeApi.getRisk(agent, profile),
      triadeApi.getTimeline({ agent, event: 'reject', mode: 'all', limit: 50 }).catch(() => null),
    ])
      .then(([res, timeline]) => {
        if (cancel) return;
        setRisk(res);
        setRejects((timeline?.events ?? []).filter((event) => event.event === 'reject'));
      })
      .catch((err) => {
        if (!cancel) setError(err instanceof Error ? err.message : 'Falha ao carregar risco');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [agent, profile, revision, retry]);

  const qtyValues = risk ? Object.values(risk.limits.max_qty) : [];
  const maxQtyLimit = qtyValues.length ? Math.max(...qtyValues) : null;

  const sessionMap: Record<string, { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
    accepting_entries: { label: 'Aceita entradas', tone: 'ok' },
    manage_only: { label: 'Só gestão de posição', tone: 'warn' },
    flatten_window: { label: 'Janela de zeragem', tone: 'warn' },
    outside_session: { label: 'Fora da sessão', tone: 'neutral' },
  };
  const pythonUsed = risk?.usage.trades_by_source.python;
  const llmUsed = risk?.usage.trades_by_source.llm;
  const pythonCap = risk?.limits.max_trades_per_source.python;
  const llmCap = risk?.limits.max_trades_per_source.llm;
  const phaseInfo = risk?.session.phase
    ? sessionMap[risk.session.phase]
    : { label: 'Sem janela de sessão no YAML', tone: 'neutral' as const };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">
            Gestão de risco — limites e consumo em tempo real
          </h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Regra de exibição: consumo atual sempre pareado ao teto efetivo do YAML (somente leitura)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#30363d] bg-[#161b22] p-0.5 text-xs">
            {(['b3', 'nasdaq', 'crypto'] as AgentId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setAgent(id)}
                className={`rounded-md px-3 py-1 font-medium ${
                  agent === id ? 'bg-[#1c2330] text-[#e6edf3]' : 'text-[#8b9bb4]'
                }`}
              >
                {AGENT_NAMES[id]}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-lg border border-[#30363d] bg-[#161b22] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setProfile('micro_live')}
              className={`rounded-md px-3 py-1 font-medium ${
                profile === 'micro_live' ? 'bg-[#1c2330] text-[#f85149]' : 'text-[#8b9bb4]'
              }`}
            >
              Perfil efetivo (micro_live)
            </button>
            <button
              type="button"
              onClick={() => setProfile('research')}
              className={`rounded-md px-3 py-1 font-medium ${
                profile === 'research' ? 'bg-[#1c2330] text-[#58a6ff]' : 'text-[#8b9bb4]'
              }`}
            >
              Perfil de pesquisa
            </button>
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => setRetry((n) => n + 1)} />}

      {loading && !risk ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : risk ? (
        <>
          {/* Summary Banner */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-semibold text-[#e6edf3]">{AGENT_NAMES[risk.agent]}</span>
              <ModeBadge live={risk.mode === 'live'} compact />
              <StatusBadge variant={phaseInfo.tone} label={phaseInfo.label} />
              {risk.usage.halted && (
                <StatusBadge
                  variant="warn"
                  label={`Travado: ${risk.usage.halt_reason ?? 'halt'}`}
                />
              )}
              <span className="font-mono text-[#8b9bb4]">
                Símbolos permitidos: <strong className="text-[#e6edf3]">{risk.limits.symbols.join(', ')}</strong>
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#8b9bb4]">
              {risk.source_files.config} × {risk.source_files.state}
            </span>
          </div>

          {/* 8 Gauges (Section 5.5 table) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <UsageGauge
              label="Perda do dia"
              currentText={formatMoney(risk.usage.day_loss, risk.currency)}
              limitText={
                risk.limits.daily_loss_limit !== null
                  ? formatMoney(risk.limits.daily_loss_limit, risk.currency)
                  : formatPct(risk.limits.daily_loss_limit_pct)
              }
              ratio={risk.usage.day_loss_pct_of_limit}
              formula="consumo daily_loss.used / daily_loss_limit (null se o estado não existe)"
              source={risk.source_files.config}
            />

            <UsageGauge
              label="Perdas consecutivas"
              currentText={risk.usage.consecutive_losses == null ? '—' : String(risk.usage.consecutive_losses)}
              limitText={risk.limits.max_consecutive_losses == null ? '—' : String(risk.limits.max_consecutive_losses)}
              ratio={
                risk.usage.consecutive_losses != null && risk.limits.max_consecutive_losses
                  ? risk.usage.consecutive_losses / risk.limits.max_consecutive_losses
                  : null
              }
              formula="consecutive_losses / max_consecutive_losses"
              source={risk.source_files.state}
            />

            <UsageGauge
              label="Trades do dia"
              currentText={risk.usage.trades_today == null ? '—' : String(risk.usage.trades_today)}
              limitText={risk.limits.max_trades_per_day == null ? '—' : String(risk.limits.max_trades_per_day)}
              ratio={
                risk.usage.trades_today != null && risk.limits.max_trades_per_day
                  ? risk.usage.trades_today / risk.limits.max_trades_per_day
                  : null
              }
              formula="trades_today / max_trades_per_day"
              source={risk.source_files.state}
            />

            <UsageGauge
              label="Trades por fonte (python / llm)"
              currentText={`${pythonUsed ?? '—'} py · ${llmUsed ?? '—'} llm`}
              limitText={pythonCap == null && llmCap == null ? 'não informado' : `${pythonCap ?? '—'} / ${llmCap ?? '—'}`}
              ratio={null}
              formula="o endpoint de risco não devolve trades_by_source neste backend"
              source={risk.source_files.config}
            />

            <UsageGauge
              label="Posições abertas"
              currentText={risk.usage.open_positions == null ? '—' : String(risk.usage.open_positions)}
              limitText={risk.limits.max_open_positions == null ? '—' : String(risk.limits.max_open_positions)}
              ratio={
                risk.usage.open_positions != null && risk.limits.max_open_positions
                  ? risk.usage.open_positions / risk.limits.max_open_positions
                  : null
              }
              formula="len(positions) / max_open_positions"
              source={risk.source_files.state}
            />

            <UsageGauge
              label="Quantidade da mão"
              currentText={risk.usage.open_qty == null ? '—' : String(risk.usage.open_qty)}
              limitText={maxQtyLimit == null ? '—' : String(maxQtyLimit)}
              ratio={
                risk.usage.open_qty != null && maxQtyLimit
                  ? risk.usage.open_qty / maxQtyLimit
                  : null
              }
              formula="abs(qty) / max_qty"
              source={risk.source_files.config}
            />

            <UsageGauge
              label="Drawdown do pico"
              currentText={formatPct(risk.usage.drawdown_pct)}
              limitText={formatPct(risk.limits.max_drawdown_pct)}
              ratio={
                risk.usage.drawdown_pct != null && risk.limits.max_drawdown_pct
                  ? risk.usage.drawdown_pct / risk.limits.max_drawdown_pct
                  : null
              }
              stickyBadge={risk.limits.sticky_drawdown_halt}
              formula="(equity_peak − equity) / equity_peak"
              source={risk.source_files.state}
            />

            <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8b9bb4]">
                  Relógio de sessão
                </div>
                <div className="mt-1.5 text-base font-semibold text-[#e6edf3]">
                  {phaseInfo.label}
                </div>
                <div className="mt-2 space-y-1 text-xs font-mono text-[#8b9bb4]">
                  <div>
                    Sem entradas após:{' '}
                    <strong className="text-[#e6edf3]">
                      {risk.session.no_new_trades_after ?? 'não definido no YAML'}
                    </strong>
                  </div>
                  <div>
                    Zeragem obrigatória:{' '}
                    <strong className="text-[#e6edf3]">
                      {risk.session.flatten_time ?? 'não definido no YAML'}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-[#30363d] flex items-center justify-between text-[11px] text-[#8b9bb4] font-mono">
                <span>stop_required (YAML)</span>
                <span className={risk.limits.stop_required ? 'text-[#3fb950]' : 'text-[#8b9bb4]'}>
                  {risk.limits.stop_required === null
                    ? 'null no YAML'
                    : risk.limits.stop_required
                      ? 'sim'
                      : 'não'}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Rejects */}
          <section className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#30363d]">
              <h2 className="text-base font-semibold text-[#e6edf3]">
                Recusas recentes do gerenciador de risco (event=reject)
              </h2>
            </div>
            {rejects.length === 0 ? (
              <div className="p-5 text-xs text-[#8b9bb4]">
                Nenhuma entrada event=reject neste agente.
              </div>
            ) : (
              <div className="divide-y divide-[#30363d]">
                {rejects.map((rj, idx) => (
                  <div key={idx} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[#8b9bb4]">
                        {formatBrasiliaTime(rj.ts, true)}
                      </span>
                      <span className="font-mono font-semibold text-[#e6edf3]">{rj.symbol}</span>
                      <StatusBadge variant="bad" label={rj.reason ?? 'recusado'} />
                    </div>
                    <span className="font-mono text-[#8b9bb4]">
                      fonte: {rj.source} · sinal: {rj.sinal ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-xs text-[#8b9bb4] rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-2.5">
            {risk.state_exists === false
              ? 'Estado do agente ausente: consumo de perda, equity e drawdown ficam vazios. '
              : ''}
            {risk.limits.stop_required === null && risk.agent === 'b3' && risk.mode === 'live'
              ? 'O YAML não traz stop_required nem flatten_on_halt; a execução live do código ainda exige stop e flatten no halt. '
              : ''}
            {risk.limits.emergency_stop_pct != null
              ? `Emergency stop no YAML: ${formatPct(risk.limits.emergency_stop_pct)}. `
              : 'emergency_stop_pct não veio neste payload. '}
            Equity corrente:{' '}
            {risk.equity_current == null ? 'não informada' : formatMoney(risk.equity_current, risk.currency)}.
            Edição de limites não existe neste backend.
            {risk.day ? ` Dia do estado: ${risk.day}.` : ''}
          </p>
        </>
      ) : null}
    </div>
  );
};
