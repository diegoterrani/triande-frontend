import React, { useMemo, useState } from 'react';
import {
  AgentId,
  CurrencyCode,
  StatusResponse,
  TimelineEvent,
} from '../../types/triade';
import {
  AGENT_CURRENCIES,
  AGENT_NAMES,
  formatMoney,
  formatPct,
} from '../../utils/format';
import {
  EmptyState,
  MetricBlock,
  ModeBadge,
  PnLBarChart,
  PnLLineChart,
} from '../ui/Primitives';

export const PnLView: React.FC<{
  status: StatusResponse | null;
  timelineEvents: TimelineEvent[];
}> = ({ status, timelineEvents }) => {
  const [selectedScope, setSelectedScope] = useState<'side_by_side' | AgentId>('side_by_side');
  const [seriesMode, setSeriesMode] = useState<'live' | 'paper'>('paper');
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');

  const computeStats = (agent: AgentId, mode: 'live' | 'paper') => {
    const trades = timelineEvents
      .filter((e) => e.event === 'trade' && e.agent === agent && e.mode === mode)
      .sort((a, b) => a.ts.localeCompare(b.ts));

    const currency: CurrencyCode = AGENT_CURRENCIES[agent];
    const totalPnl = trades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
    const totalFees = trades.reduce((acc, t) => acc + (t.fees ?? 0), 0);
    const wins = trades.filter((t) => (t.pnl ?? 0) > 0);
    const losses = trades.filter((t) => (t.pnl ?? 0) < 0);
    const winRate = trades.length > 0 ? wins.length / trades.length : 0;
    const expectancy = trades.length > 0 ? totalPnl / trades.length : 0;
    const maxWin = wins.length > 0 ? Math.max(...wins.map((t) => t.pnl ?? 0)) : 0;
    const maxLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.pnl ?? 0)) : 0;

    let cum = 0;
    let peak = 0;
    let maxRealizedDd = 0;
    const curvePoints = trades.map((t) => {
      cum += t.pnl ?? 0;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxRealizedDd) maxRealizedDd = dd;
      return {
        ts: t.ts,
        cumulative: cum,
        symbol: t.symbol,
        pnl: t.pnl ?? 0,
      };
    });

    const bySource: Record<string, { pnl: number; count: number }> = {};
    const bySymbol: Record<string, { pnl: number; count: number }> = {};
    for (const t of trades) {
      const src = t.source ?? 'desconhecido';
      bySource[src] = bySource[src] ?? { pnl: 0, count: 0 };
      bySource[src].pnl += t.pnl ?? 0;
      bySource[src].count += 1;

      const sym = t.symbol ?? '—';
      bySymbol[sym] = bySymbol[sym] ?? { pnl: 0, count: 0 };
      bySymbol[sym].pnl += t.pnl ?? 0;
      bySymbol[sym].count += 1;
    }

    return {
      currency,
      trades,
      totalPnl,
      totalFees,
      wins: wins.length,
      losses: losses.length,
      winRate,
      expectancy,
      maxWin,
      maxLoss,
      maxRealizedDd,
      curvePoints,
      bySource,
      bySymbol,
    };
  };

  const singleStats = useMemo(() => {
    if (selectedScope === 'side_by_side') return null;
    return computeStats(selectedScope, seriesMode);
  }, [selectedScope, seriesMode, timelineEvents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">PnL e performance</h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Séries live e paper sempre separadas · moedas distintas (BRL, USD, USDT) nunca são
            somadas em um único total
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#30363d] bg-[#161b22] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedScope('side_by_side')}
              className={`rounded-md px-2.5 py-1 font-medium ${
                selectedScope === 'side_by_side' ? 'bg-[#1c2330] text-[#e6edf3]' : 'text-[#8b9bb4]'
              }`}
            >
              Lado a lado (3 mercados)
            </button>
            {(['b3', 'nasdaq', 'crypto'] as AgentId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSelectedScope(id);
                  if (status?.agents[id].live_enabled) setSeriesMode('live');
                  else setSeriesMode('paper');
                }}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  selectedScope === id ? 'bg-[#1c2330] text-[#e6edf3]' : 'text-[#8b9bb4]'
                }`}
              >
                {AGENT_NAMES[id]}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-lg border border-[#30363d] bg-[#161b22] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSeriesMode('live')}
              className={`rounded-md px-2.5 py-1 font-medium ${
                seriesMode === 'live' ? 'bg-[#1c2330] text-[#f85149]' : 'text-[#8b9bb4]'
              }`}
            >
              Série LIVE
            </button>
            <button
              type="button"
              onClick={() => setSeriesMode('paper')}
              className={`rounded-md px-2.5 py-1 font-medium ${
                seriesMode === 'paper' ? 'bg-[#1c2330] text-[#58a6ff]' : 'text-[#8b9bb4]'
              }`}
            >
              Série PAPEL
            </button>
          </div>

          <select
            aria-label="Período"
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'today' | '7d' | '30d')}
            className="rounded-lg border border-[#30363d] bg-[#161b22] px-2.5 py-1.5 text-xs text-[#e6edf3]"
          >
            <option value="today">Hoje</option>
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
          </select>
        </div>
      </div>

      {selectedScope === 'side_by_side' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(['b3', 'nasdaq', 'crypto'] as AgentId[]).map((id) => {
            const st = computeStats(id, seriesMode);
            return (
              <div
                key={id}
                className={`rounded-xl border border-[#30363d] bg-[#1c2330] border-t-[3px] p-4 space-y-4 ${
                  seriesMode === 'live' ? 'border-t-[#f85149]' : 'border-t-[#58a6ff]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[#e6edf3]">
                      {AGENT_NAMES[id]} ({st.currency})
                    </h2>
                    <span className="text-xs text-[#8b9bb4]">
                      {st.trades.length} trade(s) no diário {seriesMode}
                    </span>
                  </div>
                  <ModeBadge live={seriesMode === 'live'} compact />
                </div>

                {st.trades.length === 0 ? (
                  <EmptyState
                    title={`Ainda não há trade no diário ${seriesMode} deste agente.`}
                    detail="Quando um trade for encerrado no journal, os KPIs e curvas aparecerão aqui."
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#30363d]">
                      <MetricBlock
                        label="PnL realizado"
                        value={formatMoney(st.totalPnl, st.currency, true)}
                        tone={st.totalPnl >= 0 ? 'good' : 'bad'}
                      />
                      <MetricBlock
                        label="Taxas"
                        value={formatMoney(st.totalFees, st.currency)}
                      />
                      <MetricBlock
                        label="Win rate"
                        value={formatPct(st.winRate)}
                        subtext={`${st.wins}W / ${st.losses}L`}
                      />
                      <MetricBlock
                        label="Drawdown realizado"
                        value={formatMoney(st.maxRealizedDd, st.currency)}
                      />
                    </div>
                    <PnLLineChart points={st.curvePoints} currency={st.currency} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : singleStats ? (
        singleStats.trades.length === 0 ? (
          <EmptyState
            title={`Ainda não há trade no diário ${seriesMode} de ${AGENT_NAMES[selectedScope]}.`}
            detail="Nenhum evento event=trade encontrado no journal selecionado."
          />
        ) : (
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
                <MetricBlock
                  label="PnL realizado"
                  value={formatMoney(singleStats.totalPnl, singleStats.currency, true)}
                  tone={singleStats.totalPnl >= 0 ? 'good' : 'bad'}
                  large
                />
              </div>
              <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
                <MetricBlock
                  label="Win rate"
                  value={formatPct(singleStats.winRate)}
                  subtext={`${singleStats.wins} ganhos · ${singleStats.losses} perdas`}
                  large
                />
              </div>
              <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
                <MetricBlock
                  label="Expectativa média"
                  value={formatMoney(singleStats.expectancy, singleStats.currency, true)}
                  subtext={`taxas: ${formatMoney(singleStats.totalFees, singleStats.currency)}`}
                  large
                />
              </div>
              <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
                <MetricBlock
                  label="Máx. drawdown realizado"
                  value={formatMoney(singleStats.maxRealizedDd, singleStats.currency)}
                  subtext={`maior ganho ${formatMoney(singleStats.maxWin, singleStats.currency, true)} · perda ${formatMoney(singleStats.maxLoss, singleStats.currency, true)}`}
                  large
                />
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
                <h2 className="text-base font-semibold text-[#e6edf3] mb-3">
                  Curva de PnL acumulado (horário de Brasília)
                </h2>
                <PnLLineChart points={singleStats.curvePoints} currency={singleStats.currency} />
              </div>

              <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
                <h2 className="text-base font-semibold text-[#e6edf3] mb-3">
                  Resultado por trade
                </h2>
                <PnLBarChart
                  items={singleStats.trades.map((t, i) => ({
                    label: `#${i + 1} ${t.symbol ?? ''}`,
                    ts: t.ts,
                    pnl: t.pnl ?? 0,
                  }))}
                  currency={singleStats.currency}
                />
              </div>
            </div>

            {/* Distributions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
                <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">
                  Distribuição por fonte (python vs llm)
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  {Object.entries(singleStats.bySource).map(([src, info]) => (
                    <div key={src} className="flex items-center justify-between py-1 border-b border-[#30363d]/60 last:border-0">
                      <span className="text-[#e6edf3]">
                        {src} ({info.count} trades)
                      </span>
                      <span className={info.pnl >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                        {formatMoney(info.pnl, singleStats.currency, true)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
                <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">
                  Distribuição por símbolo
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  {Object.entries(singleStats.bySymbol).map(([sym, info]) => (
                    <div key={sym} className="flex items-center justify-between py-1 border-b border-[#30363d]/60 last:border-0">
                      <span className="text-[#e6edf3]">
                        {sym} ({info.count} trades)
                      </span>
                      <span className={info.pnl >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                        {formatMoney(info.pnl, singleStats.currency, true)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      ) : null}

      <p className="text-xs text-[#8b9bb4] rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-2.5">
        Nota v2: a curva de equity mark-to-market intra-day não é exibida no MVP porque{' '}
        <code className="text-[#e6edf3]">equity_curve</code> ainda existe apenas em memória no
        motor (não persistida no <code className="text-[#e6edf3]">export_state</code>).
      </p>
    </div>
  );
};
