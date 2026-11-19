import React, { useEffect, useState } from 'react';
import { triadeApi } from '../../api/triade';
import { AgentId, RiskResponse } from '../../types/triade';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRisk = () => {
    setLoading(true);
    setError(null);
    triadeApi
      .getRisk(agent, profile)
      .then((res) => setRisk(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar risco'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRisk();
  }, [agent, profile]);

  const maxQtyLimit = risk
    ? Math.max(...Object.values(risk.limits.max_qty), 1)
    : 1;

  const pythonUsed = risk?.usage.trades_by_source.python ?? 0;
  const llmUsed = risk?.usage.trades_by_source.llm ?? 0;
  const pythonCap = risk?.limits.max_trades_per_source.python ?? 5;
  const llmCap = risk?.limits.max_trades_per_source.llm ?? 5;

  const sessionMap: Record<string, { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
    accepting_entries: { label: 'Aceita entradas', tone: 'ok' },
    manage_only: { label: 'Só gestão de posição', tone: 'warn' },
    flatten_window: { label: 'Janela de zeragem', tone: 'warn' },
    outside_session: { label: 'Fora da sessão', tone: 'neutral' },
  };

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

      {error && <ErrorState message={error} onRetry={loadRisk} />}

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
              <StatusBadge
                variant={sessionMap[risk.session.phase].tone}
                label={sessionMap[risk.session.phase].label}
              />
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
              currentText={formatMoney(risk.usage.day_loss ?? 0, risk.currency)}
              limitText={
                risk.limits.daily_loss_limit !== null
                  ? formatMoney(risk.limits.daily_loss_limit, risk.currency)
                  : formatPct(risk.limits.daily_loss_limit_pct)
              }
              ratio={risk.usage.day_loss_pct_of_limit ?? 0}
              formula="day_start_equity − equity_atual (realizado + aberto)"
              source={risk.source_files.config}
            />

            <UsageGauge
              label="Perdas consecutivas"
              currentText={String(risk.usage.consecutive_losses)}
              limitText={String(risk.limits.max_consecutive_losses)}
              ratio={risk.usage.consecutive_losses / Math.max(1, risk.limits.max_consecutive_losses)}
              formula="consecutive_losses / max_consecutive_losses"
              source={risk.source_files.state}
              note={
                risk.usage.consecutive_losses_assumed
                  ? 'Campo ausente no arquivo antigo, assumido 0.'
                  : undefined
              }
            />

            <UsageGauge
              label="Trades do dia"
              currentText={String(risk.usage.trades_today)}
              limitText={String(risk.limits.max_trades_per_day)}
              ratio={risk.usage.trades_today / Math.max(1, risk.limits.max_trades_per_day)}
              formula="trades_today / max_trades_per_day"
              source={risk.source_files.state}
            />

            <UsageGauge
              label="Trades por fonte (python / llm)"
              currentText={`${pythonUsed} py · ${llmUsed} llm`}
              limitText={`${pythonCap} / ${llmCap}`}
              ratio={Math.max(pythonUsed / Math.max(1, pythonCap), llmUsed / Math.max(1, llmCap))}
              formula="trades_by_source.{python,llm} / max_trades_per_source"
              source={risk.source_files.config}
            />

            <UsageGauge
              label="Posições abertas"
              currentText={String(risk.usage.open_positions)}
              limitText={String(risk.limits.max_open_positions)}
              ratio={risk.usage.open_positions / Math.max(1, risk.limits.max_open_positions)}
              formula="len(positions) / max_open_positions"
              source={risk.source_files.state}
            />

            <UsageGauge
              label="Quantidade da mão"
              currentText={String(risk.usage.open_qty)}
              limitText={String(maxQtyLimit)}
              ratio={risk.usage.open_qty / Math.max(1, maxQtyLimit)}
              formula="abs(qty) / max_qty"
              source={risk.source_files.config}
            />

            <UsageGauge
              label="Drawdown do pico"
              currentText={formatPct(risk.usage.drawdown_pct ?? 0)}
              limitText={formatPct(risk.limits.max_drawdown_pct)}
              ratio={
                (risk.usage.drawdown_pct ?? 0) / Math.max(0.0001, risk.limits.max_drawdown_pct)
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
                  {sessionMap[risk.session.phase].label}
                </div>
                <div className="mt-2 space-y-1 text-xs font-mono text-[#8b9bb4]">
                  <div>
                    Sem entradas após:{' '}
                    <strong className="text-[#e6edf3]">
                      {risk.session.no_new_trades_after ?? '24/7'}
                    </strong>
                  </div>
                  <div>
                    Zeragem obrigatória:{' '}
                    <strong className="text-[#e6edf3]">
                      {risk.session.flatten_time ?? '24/7'}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-[#30363d] flex items-center justify-between text-[11px] text-[#8b9bb4] font-mono">
                <span>Stop obrigatório</span>
                <span className="text-[#3fb950]">
                  {risk.limits.stop_required ? 'SIM (enforced)' : 'NÃO'}
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
            {risk.recent_rejects.length === 0 ? (
              <div className="p-5 text-xs text-[#8b9bb4]">
                Nenhuma entrada recusada registrada no diário deste agente hoje.
              </div>
            ) : (
              <div className="divide-y divide-[#30363d]">
                {risk.recent_rejects.map((rj, idx) => (
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
            <strong>Emergency stop ({formatPct(risk.limits.emergency_stop_pct)}):</strong> trilho
            de emergência do motor nos três YAMLs — é distinto do stop diário operacional (ex.: R$
            300,00 no live B3). A edição de limites não ocorre nesta tela (somente leitura).
          </p>
        </>
      ) : null}
    </div>
  );
};
