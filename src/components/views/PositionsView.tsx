import React, { useMemo, useState } from 'react';
import { OctagonX } from 'lucide-react';
import { READONLY_CONTROL_NOTE } from '../../api/readonly';
import {
  AgentId,
  AgentSummary,
  RouteKey,
  StatusResponse,
  TimelineEvent,
} from '../../types/triade';
import {
  AGENT_CURRENCIES,
  AGENT_NAMES,
  EVENT_LABELS,
  formatBrasiliaTime,
  formatMoney,
  formatPrice,
} from '../../utils/format';
import { EmptyState, ModeBadge, StatusBadge } from '../ui/Primitives';

export const PositionsView: React.FC<{
  status: StatusResponse | null;
  timelineEvents: TimelineEvent[];
  offline: boolean;
  onNavigate: (route: RouteKey, query?: { agent?: AgentId; clientOrderId?: string }) => void;
}> = ({ status, timelineEvents, offline, onNavigate }) => {
  const [agentFilter, setAgentFilter] = useState<AgentId | 'all'>('all');
  const [symbolFilter, setSymbolFilter] = useState('');

  const openPositions = useMemo(() => {
    if (!status) return [];
    const list: Array<{ agent: AgentSummary; pos: NonNullable<AgentSummary['state']>['positions'][number] }> = [];
    for (const id of ['b3', 'nasdaq', 'crypto'] as AgentId[]) {
      if (agentFilter !== 'all' && id !== agentFilter) continue;
      const ag = status.agents[id];
      for (const p of ag.state?.positions ?? []) {
        if (
          symbolFilter.trim() &&
          !p.symbol.toLowerCase().includes(symbolFilter.trim().toLowerCase()) &&
          !(p.contract ?? '').toLowerCase().includes(symbolFilter.trim().toLowerCase())
        ) {
          continue;
        }
        list.push({ agent: ag, pos: p });
      }
    }
    return list;
  }, [status, agentFilter, symbolFilter]);

  const orderHistory = useMemo(() => {
    return timelineEvents.filter((ev) => {
      if (agentFilter !== 'all' && ev.agent !== agentFilter) return false;
      if (
        symbolFilter.trim() &&
        !(ev.symbol ?? '').toLowerCase().includes(symbolFilter.trim().toLowerCase())
      ) {
        return false;
      }
      return ['fill', 'idempotent', 'cancel_failed', 'flatten_all'].includes(ev.event);
    });
  }, [timelineEvents, agentFilter, symbolFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">Posições e ordens</h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Mesa consolidada das posições abertas (_position_dict) e histórico de execuções do journal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filtrar por agente"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value as AgentId | 'all')}
            className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs text-[#e6edf3]"
          >
            <option value="all">Todos os agentes</option>
            <option value="b3">B3</option>
            <option value="nasdaq">NASDAQ</option>
            <option value="crypto">Cripto</option>
          </select>
          <input
            type="text"
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            placeholder="Filtrar símbolo (WIN, BTC...)"
            className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs font-mono text-[#e6edf3]"
          />
        </div>
      </div>

      {/* Open positions */}
      <section className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#30363d]">
          <div>
            <h2 className="text-base font-semibold text-[#e6edf3]">
              Posições abertas ({openPositions.length})
            </h2>
            <p className="text-[11px] text-[#8b9bb4]">
              Clique em uma linha para abrir a timeline filtrada pelo client_order_id. Flatten
              não é enviado: o backend responde 405.
            </p>
          </div>
          <button
            type="button"
            disabled
            title={offline ? `${READONLY_CONTROL_NOTE} Túnel indisponível.` : READONLY_CONTROL_NOTE}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-xs font-medium text-[#8b9bb4] opacity-70 cursor-not-allowed"
          >
            <OctagonX className="h-3.5 w-3.5" /> Zerar indisponível
          </button>
        </div>

        {openPositions.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Nenhuma posição aberta"
              detail="Nenhuma posição no estado efetivo (paper/live) para os filtros selecionados."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#30363d] text-[11px] uppercase text-[#8b9bb4]">
                <tr>
                  <th className="px-4 py-2.5">Agente / Modo</th>
                  <th className="px-4 py-2.5">Símbolo / Contrato</th>
                  <th className="px-4 py-2.5">Lado / Qtd</th>
                  <th className="px-4 py-2.5 text-right">Médio</th>
                  <th className="px-4 py-2.5 text-right">Preço atual</th>
                  <th className="px-4 py-2.5 text-right">Stop</th>
                  <th className="px-4 py-2.5 text-right">Alvo</th>
                  <th className="px-4 py-2.5 text-right">PnL aberto</th>
                  <th className="px-4 py-2.5">Fonte / Estratégia</th>
                  <th className="px-4 py-2.5">Aberto em (BRT)</th>
                  <th className="px-4 py-2.5">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d] font-mono tabular-nums">
                {openPositions.map(({ agent, pos }) => (
                  <tr
                    key={pos.client_order_id}
                    onClick={() =>
                      onNavigate('timeline', {
                        agent: agent.agent,
                        clientOrderId: pos.client_order_id,
                      })
                    }
                    className="hover:bg-[#161b22] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#e6edf3]">{agent.label}</span>
                        <ModeBadge live={agent.live_enabled} compact />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#e6edf3] font-semibold">
                      {pos.symbol} <span className="text-[#8b9bb4]">({pos.contract})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={pos.qty > 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                        {pos.qty > 0 ? `COMPRA +${pos.qty}` : `VENDA ${pos.qty}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatPrice(pos.avg_price)}</td>
                    <td className="px-4 py-3 text-right text-[#e6edf3]">
                      {pos.current_price !== undefined && pos.current_price !== null
                        ? formatPrice(pos.current_price)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pos.stop_price !== null ? (
                        formatPrice(pos.stop_price)
                      ) : (
                        <StatusBadge variant="bad" label="SEM STOP" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#8b9bb4]">
                      {formatPrice(pos.target_price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pos.unrealized_pnl !== undefined && pos.unrealized_pnl !== null ? (
                        <span
                          className={
                            pos.unrealized_pnl >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'
                          }
                        >
                          {formatMoney(pos.unrealized_pnl, agent.currency, true)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans text-[#8b9bb4]">
                      <strong className="text-[#e6edf3]">{pos.source}</strong> · {pos.strategy}
                    </td>
                    <td className="px-4 py-3 text-[#8b9bb4]">
                      {formatBrasiliaTime(pos.opened_at)}
                    </td>
                    <td className="px-4 py-3 text-[#7aa2f7]">{pos.client_order_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Order History from Journal */}
      <section className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#30363d]">
          <h2 className="text-base font-semibold text-[#e6edf3]">
            Histórico de ordens do dia (derivado do journal)
          </h2>
          <p className="text-[11px] text-[#8b9bb4]">
            Eventos fill, idempotent, cancel_failed e flatten_all · sem book sintético de ordens pendentes
          </p>
        </div>

        {orderHistory.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#8b9bb4]">
            Nenhuma execução ou evento de ordem registrado neste filtro hoje.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#30363d] text-[11px] uppercase text-[#8b9bb4]">
                <tr>
                  <th className="px-4 py-2.5">Horário (BRT)</th>
                  <th className="px-4 py-2.5">Agente / Modo</th>
                  <th className="px-4 py-2.5">Evento</th>
                  <th className="px-4 py-2.5">Símbolo</th>
                  <th className="px-4 py-2.5">Lado / Qtd</th>
                  <th className="px-4 py-2.5 text-right">Preço / Taxa</th>
                  <th className="px-4 py-2.5">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d] font-mono tabular-nums">
                {orderHistory.map((ev, idx) => (
                  <tr key={`${ev.ts}-${idx}`} className="hover:bg-[#161b22]">
                    <td className="px-4 py-2.5 text-[#8b9bb4]">{formatBrasiliaTime(ev.ts)}</td>
                    <td className="px-4 py-2.5 font-sans">
                      {AGENT_NAMES[ev.agent]} ·{' '}
                      <span
                        className={
                          ev.mode === 'live'
                            ? 'text-[#f85149]'
                            : ev.mode === 'paper'
                              ? 'text-[#58a6ff]'
                              : 'text-[#8b9bb4]'
                        }
                      >
                        {ev.mode === 'live' ? 'REAL' : ev.mode === 'paper' ? 'PAPEL' : 'sem modo'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-sans text-[#e6edf3]">
                      {EVENT_LABELS[ev.event] ?? ev.event}
                    </td>
                    <td className="px-4 py-2.5 text-[#e6edf3]">
                      {ev.contract || ev.symbol || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {ev.side ? `${ev.side} ${ev.qty ?? ''}` : ev.canceladas !== undefined ? `${ev.canceladas} canceladas` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#8b9bb4]">
                      {ev.price !== undefined
                        ? `${formatPrice(ev.price)} (taxa ${formatMoney(ev.fee, AGENT_CURRENCIES[ev.agent])})`
                        : '—'}
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
