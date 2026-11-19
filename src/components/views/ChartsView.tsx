import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { triadeApi } from '../../api/triade';
import {
  AgentId,
  RecentBarsResponse,
  RouteKey,
  StatusResponse,
  TimelineEvent,
} from '../../types/triade';
import {
  AGENT_CURRENCIES,
  AGENT_NAMES,
  formatBrasiliaTime,
  formatMoney,
  formatPrice,
} from '../../utils/format';
import { MarketChartPanel } from '../charts/MarketChartPanel';
import { ErrorState, ModeBadge, SkeletonCard, StatusBadge } from '../ui/Primitives';

const SYMBOLS_BY_AGENT: Record<AgentId, string[]> = {
  b3: ['WIN'],
  nasdaq: ['USTEC'],
  crypto: ['BTCUSDT', 'ETHUSDT'],
};

export const ChartsView: React.FC<{
  status: StatusResponse | null;
  timelineEvents: TimelineEvent[];
  initialAgent?: AgentId;
  onNavigate: (route: RouteKey, query?: { agent?: AgentId; clientOrderId?: string }) => void;
}> = ({ status, timelineEvents, initialAgent = 'b3', onNavigate }) => {
  const [agent, setAgent] = useState<AgentId>(initialAgent);
  const [symbol, setSymbol] = useState<string>(SYMBOLS_BY_AGENT[initialAgent][0]);
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m'>('5m');
  const [barsData, setBarsData] = useState<RecentBarsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const allowed = SYMBOLS_BY_AGENT[agent];
    if (!allowed.includes(symbol)) {
      setSymbol(allowed[0]);
    }
  }, [agent, symbol]);

  const loadBars = () => {
    setLoading(true);
    setError(null);
    triadeApi
      .getRecentBars(agent, symbol, timeframe)
      .then((res) => setBarsData(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar barras'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBars();
  }, [agent, symbol, timeframe]);

  const activeAgentSummary = status?.agents[agent];
  const openPositions = activeAgentSummary?.state?.positions ?? [];

  const symbolTrades = useMemo(() => {
    return timelineEvents.filter(
      (ev) =>
        ev.agent === agent &&
        (ev.event === 'trade' || ev.event === 'fill') &&
        (!ev.symbol || ev.symbol === symbol)
    );
  }, [timelineEvents, agent, symbol]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">
            Gráficos de mercado e marcação de trades
          </h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Barras de <code className="text-[#e6edf3]">recent-bars.json</code> com formatos Candle e
            Montanha, indicadores técnicos, desenhos persistidos e execuções do journal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Agent Selector */}
          <div className="inline-flex rounded-lg border border-[#30363d] bg-[#161b22] p-0.5 text-xs">
            {(['b3', 'nasdaq', 'crypto'] as AgentId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setAgent(id)}
                className={`rounded-md px-3 py-1 font-medium ${
                  agent === id ? 'bg-[#1c2330] text-[#e6edf3]' : 'text-[#8b9bb4] hover:text-[#e6edf3]'
                }`}
              >
                {AGENT_NAMES[id]}
              </button>
            ))}
          </div>

          {/* Symbol Selector */}
          <select
            aria-label="Selecionar símbolo"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs font-mono text-[#e6edf3]"
          >
            {SYMBOLS_BY_AGENT[agent].map((s) => (
              <option key={s} value={s}>
                {s === 'WIN' && activeAgentSummary?.contract_current
                  ? `${s} (${activeAgentSummary.contract_current})`
                  : s}
              </option>
            ))}
          </select>

          {/* Timeframe Selector */}
          <div className="inline-flex rounded-lg border border-[#30363d] bg-[#161b22] p-0.5 text-xs font-mono">
            {(['1m', '5m', '15m'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  timeframe === tf ? 'bg-[#1c2330] text-[#7aa2f7]' : 'text-[#8b9bb4]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadBars}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs font-medium text-[#e6edf3] hover:bg-[#1c2330]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Agent Context Strip */}
      {activeAgentSummary && (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-[#e6edf3]">{activeAgentSummary.label}</span>
            <ModeBadge live={activeAgentSummary.live_enabled} compact />
            <span className="font-mono text-[#8b9bb4]">
              fonte: {barsData?.source_file ?? `var/${agent}/recent-bars.json`}
            </span>
            {openPositions.length > 0 && (
              <StatusBadge variant="info" label={`${openPositions.length} posição aberta`} />
            )}
          </div>
          <span className="text-[11px] text-[#8b9bb4]">
            Desenhos salvos localmente por símbolo · clique em um marcador de trade para inspecionar
          </span>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={loadBars} />}

      {loading && !barsData ? (
        <SkeletonCard lines={8} />
      ) : barsData ? (
        <MarketChartPanel
          agent={agent}
          symbol={symbol}
          contract={barsData.contract}
          timeframe={timeframe}
          bars={barsData.bars}
          sourceFile={barsData.source_file}
          exists={barsData.exists}
          emptyDetail={barsData.note}
          timelineEvents={timelineEvents}
          openPositions={openPositions}
          onInspectOrderId={(clientOrderId) =>
            onNavigate('timeline', { agent, clientOrderId })
          }
        />
      ) : null}

      {/* Synchronized Executed Trades Table for the Charted Symbol */}
      <section className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#e6edf3]">
              Trades e execuções marcados em {symbol} ({symbolTrades.length})
            </h2>
            <p className="text-[11px] text-[#8b9bb4]">
              Eventos fill e trade do journal sobrepostos ao gráfico
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('timeline', { agent })}
            className="text-xs font-medium text-[#7aa2f7] hover:underline"
          >
            Ver timeline completa
          </button>
        </div>

        {symbolTrades.length === 0 ? (
          <div className="p-5 text-xs text-[#8b9bb4]">
            Nenhum fill ou trade encerrado para {symbol} no journal atual.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#30363d] text-[11px] uppercase text-[#8b9bb4]">
                <tr>
                  <th className="px-4 py-2">Horário (BRT)</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Lado / Qtd</th>
                  <th className="px-4 py-2 text-right">Preço / Entrada → Saída</th>
                  <th className="px-4 py-2 text-right">PnL</th>
                  <th className="px-4 py-2">Motivo</th>
                  <th className="px-4 py-2">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d] font-mono tabular-nums">
                {symbolTrades.map((ev, i) => (
                  <tr
                    key={`${ev.ts}-${i}`}
                    onClick={() =>
                      onNavigate('timeline', {
                        agent,
                        clientOrderId: ev.client_order_id,
                      })
                    }
                    className="hover:bg-[#161b22] cursor-pointer"
                  >
                    <td className="px-4 py-2.5 text-[#8b9bb4]">{formatBrasiliaTime(ev.ts, true)}</td>
                    <td className="px-4 py-2.5 font-sans">
                      <StatusBadge
                        variant={ev.event === 'trade' ? ((ev.pnl ?? 0) >= 0 ? 'ok' : 'bad') : 'info'}
                        label={ev.event === 'trade' ? 'Saída (trade)' : 'Entrada (fill)'}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={ev.side === 'buy' ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                        {ev.side === 'buy' ? 'COMPRA' : 'VENDA'} {ev.qty}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#e6edf3]">
                      {ev.event === 'trade'
                        ? `${formatPrice(ev.entry, agent === 'b3' ? 0 : 2)} → ${formatPrice(ev.exit, agent === 'b3' ? 0 : 2)}`
                        : formatPrice(ev.price, agent === 'b3' ? 0 : 2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {ev.pnl !== undefined ? (
                        <span className={ev.pnl >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                          {formatMoney(ev.pnl, AGENT_CURRENCIES[agent], true)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-sans text-[#8b9bb4]">
                      {ev.exit_reason || ev.reason || ev.entry_reason || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-[#7aa2f7]">{ev.client_order_id ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
