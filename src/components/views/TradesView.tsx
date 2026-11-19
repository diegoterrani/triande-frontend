import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { LiveRevisionContext } from '../../api/liveContext';
import { triadeApi } from '../../api/triade';
import { AgentId, RouteKey, TimelineEvent } from '../../types/triade';
import {
  AGENT_CURRENCIES,
  AGENT_NAMES,
  downloadCsv,
  formatBrasiliaTime,
  formatMoney,
  formatPrice,
} from '../../utils/format';
import { EmptyState, ErrorState, ModeBadge } from '../ui/Primitives';

export const TradesView: React.FC<{
  onNavigate: (route: RouteKey, query?: { agent?: AgentId; clientOrderId?: string }) => void;
}> = ({ onNavigate }) => {
  const [agent, setAgent] = useState<AgentId | 'all'>('all');
  const [mode, setMode] = useState<'all' | 'live' | 'paper'>('all');
  const [source, setSource] = useState<'all' | 'python' | 'llm'>('all');
  const [symbol, setSymbol] = useState('');
  const [onlyLosses, setOnlyLosses] = useState(false);
  const [loaded, setLoaded] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const revision = useContext(LiveRevisionContext);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    triadeApi
      .getTrades({ agent, mode, limit: 1000 })
      .then((rows) => {
        if (!cancel) {
          setLoaded(rows);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancel) setError(err instanceof Error ? err.message : 'Falha ao carregar trades');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [agent, mode, revision]);

  const trades = useMemo(() => {
    return loaded.filter((ev) => {
      if (source !== 'all' && ev.source !== source) return false;
      if (onlyLosses && (ev.pnl ?? 0) >= 0) return false;
      if (symbol.trim() && !(ev.symbol ?? '').toLowerCase().includes(symbol.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [loaded, source, onlyLosses, symbol]);

  const handleExport = () => {
    downloadCsv(
      'triade-historico-trades.csv',
      [
        'horario_brasilia',
        'agente',
        'modo',
        'simbolo',
        'contrato',
        'lado',
        'qtd',
        'entrada',
        'saida',
        'pnl',
        'taxas',
        'motivo_entrada',
        'motivo_saida',
        'fonte',
        'estrategia',
        'client_order_id',
      ],
      trades.map((t) => [
        formatBrasiliaTime(t.ts, true),
        t.agent,
        t.mode,
        t.symbol ?? '',
        t.contract ?? '',
        t.side ?? '',
        t.qty ?? '',
        t.entry ?? '',
        t.exit ?? '',
        t.pnl ?? '',
        t.fees ?? '',
        t.entry_reason ?? '',
        t.exit_reason ?? '',
        t.source ?? '',
        t.strategy ?? '',
        t.client_order_id ?? '',
      ])
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">Histórico de trades</h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            GET /api/v2/trades (event=trade). Lista vazia é o estado real — a B3 live pode ainda não ter trade.
          </p>
        </div>

        <button
          type="button"
          disabled={trades.length === 0}
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs font-medium text-[#e6edf3] hover:bg-[#1c2330] disabled:opacity-45"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      {error && <ErrorState message={error} />}
      {loading && <p className="text-xs text-[#8b9bb4]">Carregando trades…</p>}

      {/* Filters */}
      <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">Agente</label>
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value as AgentId | 'all')}
            className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3]"
          >
            <option value="all">Todos</option>
            <option value="b3">B3</option>
            <option value="nasdaq">NASDAQ</option>
            <option value="crypto">Cripto</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">Modo</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'all' | 'live' | 'paper')}
            className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3]"
          >
            <option value="all">Todos</option>
            <option value="live">REAL (live)</option>
            <option value="paper">PAPEL (paper)</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">Fonte</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as 'all' | 'python' | 'llm')}
            className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3]"
          >
            <option value="all">Todas</option>
            <option value="python">python</option>
            <option value="llm">llm</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">Símbolo</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="WIN, BTCUSDT..."
            className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs font-mono text-[#e6edf3]"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-[#e6edf3] cursor-pointer py-1.5">
          <input
            type="checkbox"
            checked={onlyLosses}
            onChange={(e) => setOnlyLosses(e.target.checked)}
            className="accent-[#f85149]"
          />
          Somente PnL &lt; 0
        </label>
      </div>

      {trades.length === 0 ? (
        <EmptyState
          title="Nenhum trade encerrado neste filtro"
          detail="Ajuste os filtros ou aguarde o encerramento de posições no diário."
        />
      ) : (
        <div className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#30363d] text-[11px] uppercase text-[#8b9bb4]">
                <tr>
                  <th className="px-4 py-2.5">Horário (BRT)</th>
                  <th className="px-4 py-2.5">Agente / Modo</th>
                  <th className="px-4 py-2.5">Símbolo / Contrato</th>
                  <th className="px-4 py-2.5">Lado / Qtd</th>
                  <th className="px-4 py-2.5 text-right">Entrada → Saída</th>
                  <th className="px-4 py-2.5 text-right">PnL / Taxas</th>
                  <th className="px-4 py-2.5">Motivos</th>
                  <th className="px-4 py-2.5">Fonte / Estratégia</th>
                  <th className="px-4 py-2.5">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d] font-mono tabular-nums">
                {trades.map((t, idx) => (
                  <tr
                    key={`${t.ts}-${idx}`}
                    onClick={() =>
                      onNavigate('timeline', {
                        agent: t.agent,
                        clientOrderId: t.client_order_id,
                      })
                    }
                    className="hover:bg-[#161b22] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-[#8b9bb4] whitespace-nowrap">
                      {formatBrasiliaTime(t.ts, true)}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#e6edf3]">
                          {AGENT_NAMES[t.agent]}
                        </span>
                        <ModeBadge live={t.mode === 'live'} compact />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#e6edf3]">
                      {t.symbol} {t.contract && t.contract !== t.symbol ? `(${t.contract})` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <span className={t.side === 'buy' ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                        {t.side === 'buy' ? 'COMPRA' : 'VENDA'} {t.qty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#e6edf3] whitespace-nowrap">
                      {formatPrice(t.entry)} → {formatPrice(t.exit)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div
                        className={`font-semibold ${
                          (t.pnl ?? 0) >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'
                        }`}
                      >
                        {formatMoney(t.pnl, AGENT_CURRENCIES[t.agent], true)}
                      </div>
                      <div className="text-[10px] text-[#8b9bb4]">
                        taxa {formatMoney(t.fees, AGENT_CURRENCIES[t.agent])}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-sans text-[#8b9bb4] max-w-[220px] truncate">
                      {t.entry_reason} → <strong className="text-[#e6edf3]">{t.exit_reason}</strong>
                    </td>
                    <td className="px-4 py-3 font-sans text-[#8b9bb4]">
                      <strong className="text-[#e6edf3]">{t.source}</strong> · {t.strategy ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[#7aa2f7]">{t.client_order_id ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
