import React, { useContext, useEffect, useMemo, useState } from 'react';
import { LiveRevisionContext } from '../../api/liveContext';
import { triadeApi } from '../../api/triade';
import { AgentId, PnlResponse, StatusResponse } from '../../types/triade';
import {
  AGENT_CURRENCIES,
  AGENT_NAMES,
  formatMoney,
  formatPct,
  todayInSaoPaulo,
} from '../../utils/format';
import {
  EmptyState,
  ErrorState,
  MetricBlock,
  ModeBadge,
  PnLBarChart,
  PnLLineChart,
} from '../ui/Primitives';

function inPeriod(ts: string, period: 'today' | '7d' | '30d'): boolean {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return false;
  if (period === 'today') {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    return day === todayInSaoPaulo();
  }
  const days = period === '7d' ? 7 : 30;
  return Date.now() - date.getTime() <= days * 86_400_000;
}

export const PnLView: React.FC<{
  status: StatusResponse | null;
}> = ({ status }) => {
  const [selectedScope, setSelectedScope] = useState<'side_by_side' | AgentId>('side_by_side');
  const [seriesMode, setSeriesMode] = useState<'live' | 'paper'>('live');
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');
  const [payloads, setPayloads] = useState<Partial<Record<AgentId, PnlResponse>>>({});
  const [error, setError] = useState<string | null>(null);
  const revision = useContext(LiveRevisionContext);

  useEffect(() => {
    let cancel = false;
    const ids: AgentId[] =
      selectedScope === 'side_by_side' ? ['b3', 'nasdaq', 'crypto'] : [selectedScope];
    Promise.all(ids.map((id) => triadeApi.getPnl(id, { mode: seriesMode, limit: 1000 })))
      .then((rows) => {
        if (cancel) return;
        setPayloads((prev) => {
          const next = { ...prev };
          ids.forEach((id, index) => {
            next[id] = rows[index];
          });
          return next;
        });
        setError(null);
      })
      .catch((err) => {
        if (!cancel) setError(err instanceof Error ? err.message : 'Falha ao carregar PnL');
      });
    return () => {
      cancel = true;
    };
  }, [selectedScope, seriesMode, revision]);

  const computeStats = (agent: AgentId) => {
    const payload = payloads[agent];
    const points = (payload?.series ?? []).filter((point) => inPeriod(point.ts, period));
    const currency = payload?.currency ?? AGENT_CURRENCIES[agent];
    const known = points.filter((point) => point.trade_pnl != null);
    const totalPnl = known.reduce((acc, point) => acc + (point.trade_pnl as number), 0);
    const feePoints = points.filter((point) => point.fees != null);
    const totalFees = feePoints.reduce((acc, point) => acc + (point.fees as number), 0);
    const wins = known.filter((point) => (point.trade_pnl ?? 0) > 0);
    const losses = known.filter((point) => (point.trade_pnl ?? 0) < 0);
    const winRate = known.length > 0 ? wins.length / known.length : null;
    const expectancy = known.length > 0 ? totalPnl / known.length : null;
    const maxWin = wins.length > 0 ? Math.max(...wins.map((point) => point.trade_pnl ?? 0)) : null;
    const maxLoss = losses.length > 0 ? Math.min(...losses.map((point) => point.trade_pnl ?? 0)) : null;
    let peak = 0;
    let maxRealizedDd = 0;
    const curvePoints = points
      .filter((point) => point.cumulative_pnl != null)
      .map((point) => {
        const cumulative = point.cumulative_pnl ?? 0;
        if (cumulative > peak) peak = cumulative;
        const dd = peak - cumulative;
        if (dd > maxRealizedDd) maxRealizedDd = dd;
        return {
          ts: point.ts,
          cumulative,
          symbol: point.symbol,
          pnl: point.trade_pnl,
        };
      });
    const bySource: Record<string, { pnl: number; count: number }> = {};
    const bySymbol: Record<string, { pnl: number; count: number }> = {};
    for (const point of known) {
      const src = point.source ?? 'desconhecido';
      bySource[src] = bySource[src] ?? { pnl: 0, count: 0 };
      bySource[src].pnl += point.trade_pnl ?? 0;
      bySource[src].count += 1;
      const sym = point.symbol ?? '—';
      bySymbol[sym] = bySymbol[sym] ?? { pnl: 0, count: 0 };
      bySymbol[sym].pnl += point.trade_pnl ?? 0;
      bySymbol[sym].count += 1;
    }
    return {
      currency,
      trades: points,
      totalPnl: known.length ? totalPnl : null,
      totalFees: feePoints.length ? totalFees : null,
      wins: wins.length,
      losses: losses.length,
      winRate,
      expectancy,
      maxWin,
      maxLoss,
      maxRealizedDd: points.length ? maxRealizedDd : null,
      curvePoints,
      bySource,
      bySymbol,
      note: payload?.note ?? null,
      incomplete: payload?.incomplete ?? false,
      summary: payload?.summary ?? null,
    };
  };

  const singleStats = useMemo(() => {
    if (selectedScope === 'side_by_side') return null;
    return computeStats(selectedScope);
  }, [selectedScope, payloads, period]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">PnL e performance</h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Séries live e paper sempre separadas, a partir de /api/v2/agents/&#123;id&#125;/pnl.
            Moedas distintas nunca são somadas. Não há curva intra-diária de equity persistida.
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

      {error && <ErrorState message={error} />}

      {selectedScope === 'side_by_side' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(['b3', 'nasdaq', 'crypto'] as AgentId[]).map((id) => {
            const st = computeStats(id);
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
                        tone={st.totalPnl == null ? 'default' : st.totalPnl > 0 ? 'good' : st.totalPnl < 0 ? 'bad' : 'default'}
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
                  tone={
                    singleStats.totalPnl == null
                      ? 'default'
                      : singleStats.totalPnl > 0
                        ? 'good'
                        : singleStats.totalPnl < 0
                          ? 'bad'
                          : 'default'
                  }
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
                  items={singleStats.trades
                    .filter((t) => t.trade_pnl != null)
                    .map((t, i) => ({
                      label: `#${i + 1} ${t.symbol ?? ''}`,
                      ts: t.ts,
                      pnl: t.trade_pnl as number,
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
