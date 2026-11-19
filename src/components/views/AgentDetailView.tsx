import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CandlestickChart,
  Download,
  OctagonX,
  Play,
  RotateCcw,
  ShieldAlert,
  Square,
} from 'lucide-react';
import { triadeApi } from '../../api/triade';
import {
  AgentId,
  AgentSummary,
  AnalystEvent,
  DangerActionType,
  RecentBarsResponse,
  RiskResponse,
  RouteKey,
  StrategyConfig,
  TimelineEvent,
  UserRole,
} from '../../types/triade';
import { MarketChartPanel } from '../charts/MarketChartPanel';
import {
  EVENT_LABELS,
  downloadCsv,
  formatBrasiliaTime,
  formatMoney,
  formatNewYorkTime,
  formatPct,
  formatPrice,
  summarizeTimelineEvent,
} from '../../utils/format';
import {
  EmptyState,
  MetricBlock,
  ModeBadge,
  StatusBadge,
  UsageGauge,
} from '../ui/Primitives';

const PHASE_LABELS: Record<string, { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
  accepting_entries: { label: 'Aceita entradas', tone: 'ok' },
  manage_only: { label: 'Só gerencia posição', tone: 'warn' },
  flatten_window: { label: 'Hora de zerar', tone: 'warn' },
  outside_session: { label: 'Fora da sessão', tone: 'neutral' },
};

export const AgentDetailView: React.FC<{
  agentId: AgentId;
  agent: AgentSummary | null;
  timelineEvents: TimelineEvent[];
  analystEvents: AnalystEvent[];
  strategyConfig: StrategyConfig;
  role: UserRole;
  offline: boolean;
  onNavigate: (route: RouteKey, query?: { agent?: AgentId; clientOrderId?: string }) => void;
  onTriggerDanger: (action: DangerActionType, agent: AgentSummary) => void;
}> = ({
  agentId,
  agent,
  timelineEvents,
  analystEvents,
  strategyConfig,
  role,
  offline,
  onNavigate,
  onTriggerDanger,
}) => {
  const [viewMode, setViewMode] = useState<'effective' | 'paper'>('effective');
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [chartSymbol, setChartSymbol] = useState<string>(
    agentId === 'b3' ? 'WIN' : agentId === 'nasdaq' ? 'USTEC' : 'BTCUSDT'
  );
  const [chartTimeframe, setChartTimeframe] = useState<'1m' | '5m' | '15m'>('5m');
  const [barsData, setBarsData] = useState<RecentBarsResponse | null>(null);

  useEffect(() => {
    setChartSymbol(agentId === 'b3' ? 'WIN' : agentId === 'nasdaq' ? 'USTEC' : 'BTCUSDT');
  }, [agentId]);

  useEffect(() => {
    triadeApi
      .getRisk(agentId, viewMode === 'paper' ? 'research' : undefined)
      .then(setRisk)
      .catch(() => setRisk(null));
  }, [agentId, viewMode, agent?.state?.trades_today, agent?.state?.halted]);

  useEffect(() => {
    let active = true;
    triadeApi
      .getRecentBars(agentId, chartSymbol, chartTimeframe)
      .then((res) => {
        if (active) setBarsData(res);
      })
      .catch(() => {
        if (active) setBarsData(null);
      });
    return () => {
      active = false;
    };
  }, [agentId, chartSymbol, chartTimeframe]);

  if (!agent) {
    return (
      <EmptyState
        title={`Agente ${agentId.toUpperCase()} indisponível`}
        detail="Sem dados retornados pela API de status."
      />
    );
  }

  const effectiveIsLive = agent.live_enabled;
  const showingPaperState = viewMode === 'paper' && agent.paper_state;
  const displayState = showingPaperState ? agent.paper_state! : agent.state;
  const agentTimeline = timelineEvents.filter((e) => e.agent === agentId).slice(0, 50);
  const agentAnalyst = analystEvents.filter((e) => e.agent === agentId);
  const phase = PHASE_LABELS[agent.session_phase ?? 'outside_session'];

  const handleExportCsv = () => {
    downloadCsv(
      `triade-${agentId}-timeline.csv`,
      ['ts_brasilia', 'agente', 'modo', 'evento', 'simbolo', 'lado', 'pnl', 'resumo'],
      agentTimeline.map((e) => [
        formatBrasiliaTime(e.ts, true),
        e.agent,
        e.mode,
        e.event,
        e.symbol ?? '',
        e.side ?? '',
        e.pnl ?? '',
        summarizeTimelineEvent(e),
      ])
    );
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(agentTimeline, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `triade-${agentId}-timeline.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={`rounded-xl border border-[#30363d] bg-[#1c2330] border-t-[3px] p-5 ${
          effectiveIsLive ? 'border-t-[#f85149]' : 'border-t-[#58a6ff]'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[22px] font-semibold text-[#e6edf3]">
                Agente {agent.label}
              </h1>
              <ModeBadge live={effectiveIsLive} />
              <StatusBadge
                variant={agent.units.agent.active === 'active' ? 'ok' : 'neutral'}
                label={`unit: ${agent.units.agent.active}`}
              />
              {agent.kill.blocked && <StatusBadge variant="bad" label="kill ativo" />}
              {agent.state?.halted && (
                <StatusBadge
                  variant="warn"
                  label={`travado: ${agent.state.halt_reason ?? 'halt'}`}
                />
              )}
              <StatusBadge variant={phase.tone} label={phase.label} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[#8b9bb4]">
              <span>{agent.market}</span>
              <span aria-hidden="true">·</span>
              <span>Moeda: <strong className="text-[#e6edf3]">{agent.currency}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Fuso: <strong className="font-mono text-[#e6edf3]">{agent.timezone}</strong></span>
              {agent.timezone === 'America/New_York' && (
                <span className="font-mono text-[#7aa2f7]">
                  (NY agora: {formatNewYorkTime(new Date().toISOString())})
                </span>
              )}
              {agent.contract_current && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Contrato vigente:{' '}
                    <strong className="font-mono text-[#e6edf3]">{agent.contract_current}</strong>
                  </span>
                </>
              )}
              {agent.magic_number && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">mt5.magic: {agent.magic_number}</span>
                </>
              )}
            </div>

            {(agent.no_new_trades_after || agent.flatten_time) && (
              <div className="text-xs text-[#8b9bb4] font-mono">
                Sessão efetiva: sem novas entradas após{' '}
                <strong className="text-[#e6edf3]">{agent.no_new_trades_after}</strong> · zeragem{' '}
                <strong className="text-[#e6edf3]">{agent.flatten_time}</strong> (
                {agent.timezone === 'America/New_York' ? 'NY' : 'Brasília'})
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {agent.paper_state && effectiveIsLive && (
              <div className="inline-flex rounded-lg border border-[#30363d] bg-[#0d1117] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('effective')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    viewMode === 'effective' ? 'bg-[#1c2330] text-[#f85149]' : 'text-[#8b9bb4]'
                  }`}
                >
                  Ver LIVE
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('paper')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    viewMode === 'paper' ? 'bg-[#1c2330] text-[#58a6ff]' : 'text-[#8b9bb4]'
                  }`}
                >
                  Ver papel (histórico)
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-xs font-medium text-[#e6edf3] hover:bg-[#30363d]"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-xs font-medium text-[#e6edf3] hover:bg-[#30363d]"
            >
              <Download className="h-3.5 w-3.5" /> JSON
            </button>
          </div>
        </div>

        {/* Agent Specific Notes from Spec */}
        {agentId === 'b3' && (
          <div className="mt-4 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs text-[#8b9bb4]">
            {effectiveIsLive ? (
              <span>
                <strong className="text-[#f85149]">Perfil live ativo:</strong> opera somente{' '}
                <strong className="text-[#e6edf3]">WIN ({agent.contract_current})</strong>, máx. 1
                contrato, stop obrigatório. WDO existe apenas no perfil de pesquisa/paper.
                Ponte ativa no live: <code className="text-[#e6edf3]">127.0.0.1:18863</code> (unit
                oficial em <code className="text-[#e6edf3]">18861</code>).
              </span>
            ) : (
              <span>
                Modo papel com <code className="text-[#e6edf3]">paper_venue: {agent.paper_venue}</code>{' '}
                (replay CSV — não testa a ponte MT5).
              </span>
            )}
          </div>
        )}

        {agentId === 'crypto' && agent.state?.halted && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#d29922]/50 bg-[#d29922]/10 px-3 py-2.5 text-xs text-[#d29922]">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>Halt persistente por drawdown máximo (sticky_halt: true):</strong> este halt
              sobrevive à virada do dia e foi configurado para não resetar automaticamente. Só
              liberar se Diego pediu explicitamente.
            </span>
          </div>
        )}
      </div>

      {/* 1. Resumo Operacional */}
      {displayState === null ? (
        <EmptyState
          title={`Ainda não há estado persistido para ${agent.label}`}
          detail={
            agentId === 'nasdaq'
              ? 'O terminal NASDAQ pode estar deslogado (não sugerimos login pelo painel; o acesso ao terminal é via VNC no túnel SSH). Nenhuma ordem ou trade foi gravado ainda.'
              : 'Nenhum arquivo *-state.json encontrado no servidor.'
          }
          missingPath={`var/${agentId}/${effectiveIsLive ? 'live' : 'paper'}-state.json`}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
            <MetricBlock
              label="PnL realizado hoje"
              value={formatMoney(displayState.realized_pnl_today, agent.currency, true)}
              tone={
                displayState.realized_pnl_today > 0
                  ? 'good'
                  : displayState.realized_pnl_today < 0
                    ? 'bad'
                    : 'default'
              }
              large
            />
          </div>
          <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
            <MetricBlock
              label={effectiveIsLive ? 'Equity início do dia' : 'Referência do dia'}
              value={formatMoney(displayState.day_start_equity, agent.currency)}
              subtext={`pico histórico: ${formatMoney(displayState.equity_peak, agent.currency)}`}
              large
            />
          </div>
          <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
            <MetricBlock
              label="Consumo de trades"
              value={`${displayState.trades_today} / ${risk?.limits.max_trades_per_day ?? (agentId === 'b3' ? 5 : 4)}`}
              subtext={`perdas seguidas: ${displayState.consecutive_losses ?? 0} / 3`}
              large
            />
          </div>
          <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
            <MetricBlock
              label="Drawdown"
              value={formatPct(displayState.drawdown_pct)}
              subtext={formatMoney(displayState.drawdown, agent.currency)}
              tone={displayState.halted ? 'warn' : 'default'}
              large
            />
          </div>
        </div>
      )}

      {/* Gráfico interativo do mercado e trades realizados */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CandlestickChart className="h-4 w-4 text-[#7aa2f7]" />
            <h2 className="text-base font-semibold text-[#e6edf3]">Gráfico operacional e execuções</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {agentId === 'crypto' && (
              <div className="inline-flex rounded-lg border border-[#30363d] bg-[#0d1117] p-0.5 text-xs">
                {(['BTCUSDT', 'ETHUSDT'] as const).map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => setChartSymbol(sym)}
                    className={`rounded-md px-2.5 py-1 font-mono font-medium ${
                      chartSymbol === sym
                        ? 'bg-[#1c2330] text-[#e6edf3]'
                        : 'text-[#8b9bb4] hover:text-[#e6edf3]'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            )}

            <div className="inline-flex rounded-lg border border-[#30363d] bg-[#0d1117] p-0.5 text-xs">
              {(['1m', '5m', '15m'] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setChartTimeframe(tf)}
                  className={`rounded-md px-2 py-1 font-mono ${
                    chartTimeframe === tf
                      ? 'bg-[#1c2330] text-[#e6edf3]'
                      : 'text-[#8b9bb4] hover:text-[#e6edf3]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('charts', { agent: agentId })}
              className="rounded-lg border border-[#30363d] bg-[#21262d] px-2.5 py-1 text-xs font-medium text-[#7aa2f7] hover:bg-[#30363d]"
            >
              Expandir em Gráficos
            </button>
          </div>
        </div>

        <MarketChartPanel
          agent={agentId}
          symbol={chartSymbol}
          contract={barsData?.contract ?? agent.contract_current}
          timeframe={chartTimeframe}
          bars={barsData?.bars ?? []}
          sourceFile={barsData?.source_file ?? `var/${agentId}/recent-bars.json`}
          exists={barsData?.exists ?? false}
          timelineEvents={timelineEvents}
          openPositions={displayState?.positions ?? []}
          compact={true}
          onInspectOrderId={(clientOrderId) =>
            onNavigate('timeline', { agent: agentId, clientOrderId })
          }
        />
      </section>

      {/* 2. Posição Aberta */}
      <section className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
          <h2 className="text-base font-semibold text-[#e6edf3]">Posição aberta</h2>
          <button
            type="button"
            onClick={() => onNavigate('positions')}
            className="text-xs font-medium text-[#7aa2f7] hover:underline"
          >
            Mesa completa de posições
          </button>
        </div>

        {!displayState || displayState.positions.length === 0 ? (
          <div className="p-5 text-xs text-[#8b9bb4]">
            Nenhuma posição aberta no estado {showingPaperState ? 'paper' : effectiveIsLive ? 'live' : 'paper'}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#30363d] text-[11px] uppercase text-[#8b9bb4]">
                <tr>
                  <th className="px-4 py-2.5">Símbolo / Contrato</th>
                  <th className="px-4 py-2.5">Lado / Qtd</th>
                  <th className="px-4 py-2.5 text-right">Médio</th>
                  <th className="px-4 py-2.5 text-right">Stop obrigatório</th>
                  <th className="px-4 py-2.5 text-right">Alvo</th>
                  <th className="px-4 py-2.5">Fonte / Estratégia</th>
                  <th className="px-4 py-2.5">Aberto em (BRT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d] font-mono tabular-nums">
                {displayState.positions.map((pos) => (
                  <tr key={pos.client_order_id} className="hover:bg-[#161b22]">
                    <td className="px-4 py-3 font-semibold text-[#e6edf3]">
                      {pos.symbol} ({pos.contract})
                    </td>
                    <td className="px-4 py-3">
                      <span className={pos.qty > 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                        {pos.qty > 0 ? `COMPRA +${pos.qty}` : `VENDA ${pos.qty}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatPrice(pos.avg_price)}</td>
                    <td className="px-4 py-3 text-right">
                      {pos.stop_price !== null ? (
                        <span className="text-[#e6edf3]">{formatPrice(pos.stop_price)}</span>
                      ) : (
                        <StatusBadge variant="bad" label="ALARME: SEM STOP" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#8b9bb4]">
                      {formatPrice(pos.target_price)}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <span className="text-[#e6edf3]">{pos.source}</span> ·{' '}
                      <span className="text-[#8b9bb4]">{pos.strategy}</span>
                    </td>
                    <td className="px-4 py-3 text-[#8b9bb4]">
                      {formatBrasiliaTime(pos.opened_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Risco + 4. Saúde e Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk gauges */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#e6edf3]">Risco efetivo</h2>
            <button
              type="button"
              onClick={() => onNavigate('risk', { agent: agentId })}
              className="text-xs font-medium text-[#7aa2f7] hover:underline"
            >
              Abrir painel de risco
            </button>
          </div>
          {risk ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <UsageGauge
                label="Perda do dia"
                currentText={formatMoney(risk.usage.day_loss ?? 0, agent.currency)}
                limitText={formatMoney(risk.limits.daily_loss_limit ?? 300, agent.currency)}
                ratio={risk.usage.day_loss_pct_of_limit}
                source={risk.source_files.state}
              />
              <UsageGauge
                label="Trades do dia"
                currentText={String(risk.usage.trades_today)}
                limitText={String(risk.limits.max_trades_per_day)}
                ratio={risk.usage.trades_today / Math.max(1, risk.limits.max_trades_per_day)}
                source={risk.source_files.config}
              />
              <UsageGauge
                label="Perdas consecutivas"
                currentText={String(risk.usage.consecutive_losses)}
                limitText={String(risk.limits.max_consecutive_losses)}
                ratio={
                  risk.usage.consecutive_losses / Math.max(1, risk.limits.max_consecutive_losses)
                }
                source={risk.source_files.state}
              />
              <UsageGauge
                label="Drawdown do pico"
                currentText={formatPct(risk.usage.drawdown_pct)}
                limitText={formatPct(risk.limits.max_drawdown_pct)}
                ratio={
                  risk.usage.drawdown_pct !== null
                    ? risk.usage.drawdown_pct / Math.max(0.0001, risk.limits.max_drawdown_pct)
                    : 0
                }
                stickyBadge={risk.limits.sticky_drawdown_halt}
                source={risk.source_files.state}
              />
            </div>
          ) : null}
        </section>

        {/* Health + Config */}
        <section className="space-y-4">
          <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-3">
            <h2 className="text-base font-semibold text-[#e6edf3]">Saúde e conexões</h2>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#8b9bb4]">Unit do agente ({agent.units.agent.unit})</span>
                <StatusBadge
                  variant={agent.units.agent.active === 'active' ? 'ok' : 'neutral'}
                  label={`${agent.units.agent.active} · ${agent.units.agent.enabled}`}
                />
              </div>
              {agent.units.bridge && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8b9bb4]">Unit ponte ({agent.units.bridge.unit})</span>
                  <StatusBadge
                    variant={agent.units.bridge.active === 'active' ? 'ok' : 'neutral'}
                    label={`${agent.units.bridge.active} · ${agent.units.bridge.enabled}`}
                  />
                </div>
              )}
              {agent.units.xvfb && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8b9bb4]">Unit Xvfb ({agent.units.xvfb.unit})</span>
                  <StatusBadge
                    variant={agent.units.xvfb.active === 'active' ? 'ok' : 'neutral'}
                    label={`${agent.units.xvfb.active} · ${agent.units.xvfb.enabled}`}
                  />
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-[#30363d]">
                <span className="text-[#8b9bb4]">Ponte / localhost_only</span>
                <span className="font-mono text-[#e6edf3]">
                  {agent.bridge.applicable
                    ? `${agent.bridge.listen?.binds.join(', ') || 'sem escuta'} · ${
                        agent.bridge.listen?.localhost_only ? 'localhost only' : 'ALERTA'
                      }`
                    : 'Sem ponte MT5'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#e6edf3]">
                Configuração efetiva (somente leitura)
              </h2>
              <span className="font-mono text-[11px] text-[#8b9bb4]">
                {strategyConfig.config_path}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="text-[#8b9bb4]">Estratégia</div>
              <div className="font-mono text-[#e6edf3]">{strategyConfig.strategy_name}</div>
              <div className="text-[#8b9bb4]">Símbolos ({effectiveIsLive ? 'live' : 'pesquisa'})</div>
              <div className="font-mono text-[#e6edf3]">
                {(effectiveIsLive ? strategyConfig.symbols_live : strategyConfig.symbols_research).join(', ')}
              </div>
              <div className="text-[#8b9bb4]">Modo de símbolo</div>
              <div className="font-mono text-[#e6edf3]">{strategyConfig.symbol_mode}</div>
              <div className="text-[#8b9bb4]">Chaves .env (apenas nomes)</div>
              <div className="font-mono text-[#8b9bb4] truncate">
                {strategyConfig.env_key_names_only.join(', ')}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 5. Embedded Timeline + Analyst Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-8 rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
            <h2 className="text-base font-semibold text-[#e6edf3]">
              Linha do tempo do agente (últimos 50 eventos)
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('timeline', { agent: agentId })}
              className="text-xs font-medium text-[#7aa2f7] hover:underline"
            >
              Abrir na timeline completa
            </button>
          </div>
          {agentTimeline.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8b9bb4]">
              Ainda não há eventos em var/{agentId}/journal/ neste servidor.
            </div>
          ) : (
            <div className="divide-y divide-[#30363d] max-h-80 overflow-y-auto">
              {agentTimeline.map((ev, idx) => (
                <div key={`${ev.ts}-${idx}`} className="px-4 py-2.5 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-[#8b9bb4] shrink-0">
                      {formatBrasiliaTime(ev.ts)}
                    </span>
                    <span className="font-semibold text-[#e6edf3] shrink-0">
                      {EVENT_LABELS[ev.event] ?? ev.event}
                    </span>
                    <span className="text-[#8b9bb4] truncate">{summarizeTimelineEvent(ev)}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#8b9bb4] shrink-0">{ev.mode}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-4 rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#30363d]">
            <h2 className="text-base font-semibold text-[#e6edf3]">Contexto do analista</h2>
            <p className="text-[11px] text-[#8b9bb4]">
              Gatilhos de var/{agentId}/events/queue.jsonl (não misturados com fills)
            </p>
          </div>
          {agentAnalyst.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8b9bb4]">
              Nenhum evento de analista em queue.jsonl para {agent.label}.
            </div>
          ) : (
            <div className="divide-y divide-[#30363d]">
              {agentAnalyst.map((ae, i) => (
                <div key={i} className="p-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <StatusBadge variant="info" label={ae.kind} />
                    <span className="font-mono text-[#8b9bb4]">{formatBrasiliaTime(ae.ts)}</span>
                  </div>
                  <div className="font-mono text-[#e6edf3]">
                    {ae.symbol} {ae.side ? `· ${ae.side}` : ''}
                  </div>
                  <div className="text-[#8b9bb4]">{ae.rationale || ae.motivo}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 6. Agent Controls */}
      <section className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#f85149]" />
            <h2 className="text-base font-semibold text-[#e6edf3]">
              Controles do agente {agent.label}
            </h2>
          </div>
          <span className="text-xs text-[#8b9bb4]">
            {role === 'owner'
              ? effectiveIsLive
                ? 'Modo REAL: exige confirmação digitada + checkbox + OTP 2FA'
                : 'Modo PAPEL: exige confirmação digitada + auditoria'
              : 'Somente papel owner pode acionar controles'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={offline || role !== 'owner'}
            onClick={() => onTriggerDanger('flatten', agent)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f85149] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#f85149]/90 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <OctagonX className="h-3.5 w-3.5" /> Zerar (Flatten)
          </button>

          <button
            type="button"
            disabled={offline || role !== 'owner'}
            onClick={() => onTriggerDanger('kill', agent)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#f85149]/60 bg-[#f85149]/15 px-3.5 py-2 text-xs font-semibold text-[#f85149] hover:bg-[#f85149]/25 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Matar (KILL)
          </button>

          <button
            type="button"
            disabled={offline || role !== 'owner' || !agent.kill.blocked}
            onClick={() => onTriggerDanger('kill_clear', agent)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#21262d] px-3.5 py-2 text-xs font-medium text-[#e6edf3] hover:bg-[#30363d] disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Limpar KILL
          </button>

          <button
            type="button"
            disabled={offline || role !== 'owner'}
            onClick={() =>
              onTriggerDanger(
                agent.units.agent.active === 'active' ? 'unit_stop' : 'unit_start',
                agent
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#21262d] px-3.5 py-2 text-xs font-medium text-[#e6edf3] hover:bg-[#30363d] disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {agent.units.agent.active === 'active' ? (
              <>
                <Square className="h-3.5 w-3.5" /> Parar unit
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Iniciar unit
              </>
            )}
          </button>

          {/* In crypto with sticky halt, reset-halt is explicitly de-emphasized (secondary) */}
          <button
            type="button"
            disabled={offline || role !== 'owner' || !agent.state?.halted}
            onClick={() => onTriggerDanger('reset_halt', agent)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium disabled:opacity-45 disabled:cursor-not-allowed ${
              agentId === 'crypto'
                ? 'border-[#30363d] bg-[#0d1117] text-[#8b9bb4] hover:text-[#e6edf3]'
                : 'border-[#d29922]/50 bg-[#d29922]/15 text-[#d29922] hover:bg-[#d29922]/25'
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Resetar halt
          </button>
        </div>
      </section>
    </div>
  );
};
