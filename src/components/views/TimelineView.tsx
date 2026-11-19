import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Radio } from 'lucide-react';
import { LiveRevisionContext } from '../../api/liveContext';
import { triadeApi } from '../../api/triade';
import {
  AgentId,
  AnalystEvent,
  TimelineEvent,
  TimelineResponse,
} from '../../types/triade';
import {
  AGENT_CURRENCIES,
  AGENT_NAMES,
  DETAIL_LABELS,
  EVENT_LABELS,
  formatBrasiliaTime,
  formatMoney,
  getEventColorCategory,
  summarizeTimelineEvent,
  todayInSaoPaulo,
} from '../../utils/format';
import { EmptyState, ErrorState, ModeBadge, StatusBadge } from '../ui/Primitives';

const EVENT_TYPE_OPTIONS = [
  'signal',
  'reject',
  'fill',
  'trade',
  'halt',
  'flatten_all',
  'kill',
  'disconnect',
  'reconcile',
  'restore',
  'interrupt',
  'llm_decision',
];

export const TimelineView: React.FC<{
  timelineData: TimelineResponse | null;
  analystEvents: AnalystEvent[];
  initialAgent?: AgentId | 'all';
  initialClientOrderId?: string;
  followLive: boolean;
  onToggleFollow: () => void;
  onRefresh: () => void;
}> = ({
  timelineData,
  analystEvents,
  initialAgent = 'all',
  initialClientOrderId = '',
  followLive,
  onToggleFollow,
  onRefresh,
}) => {
  const [agent, setAgent] = useState<AgentId | 'all'>(initialAgent);
  const [dateFilter, setDateFilter] = useState<string>(todayInSaoPaulo());
  const [modeFilter, setModeFilter] = useState<'all' | 'live' | 'paper'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'python' | 'llm'>('all');
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const [clientOrderIdFilter, setClientOrderIdFilter] = useState<string>(initialClientOrderId);
  const [onlyFillsTrades, setOnlyFillsTrades] = useState(false);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [limit, setLimit] = useState<number>(200);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'journal' | 'analyst'>('journal');
  const [remote, setRemote] = useState<TimelineResponse | null>(null);
  const [tlError, setTlError] = useState<string | null>(null);
  const [tlLoading, setTlLoading] = useState(false);
  const revision = useContext(LiveRevisionContext);
  const shown = remote ?? timelineData;

  useEffect(() => {
    let cancel = false;
    setTlLoading(true);
    const event = selectedEventTypes.length === 1 ? selectedEventTypes[0] : undefined;
    triadeApi
      .getTimeline({
        agent,
        mode: modeFilter,
        since: dateFilter || undefined,
        until: dateFilter || undefined,
        limit,
        event,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
      })
      .then((payload) => {
        if (cancel) return;
        setRemote(payload);
        setTlError(null);
      })
      .catch((err) => {
        if (cancel) return;
        setTlError(err instanceof Error ? err.message : 'Falha ao carregar /api/v2/timeline');
      })
      .finally(() => {
        if (!cancel) setTlLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [agent, modeFilter, dateFilter, limit, selectedEventTypes, sourceFilter, followLive, revision]);

  const toggleEventType = (ev: string) => {
    setSelectedEventTypes((prev) =>
      prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev]
    );
  };

  const filteredEvents = useMemo(() => {
    const base = shown?.events ?? [];
    return base
      .filter((ev) => {
        if (agent !== 'all' && ev.agent !== agent) return false;
        if (modeFilter !== 'all' && ev.mode !== modeFilter) return false;
        if (sourceFilter !== 'all' && ev.source !== sourceFilter) return false;
        if (onlyFillsTrades && ev.event !== 'fill' && ev.event !== 'trade') return false;
        if (selectedEventTypes.length > 0 && !selectedEventTypes.includes(ev.event)) {
          return false;
        }
        if (
          symbolFilter.trim() &&
          !(ev.symbol ?? '').toLowerCase().includes(symbolFilter.trim().toLowerCase())
        ) {
          return false;
        }
        if (
          clientOrderIdFilter.trim() &&
          !(ev.client_order_id ?? '')
            .toLowerCase()
            .includes(clientOrderIdFilter.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .slice(0, limit);
  }, [
    shown,
    agent,
    modeFilter,
    sourceFilter,
    onlyFillsTrades,
    selectedEventTypes,
    symbolFilter,
    clientOrderIdFilter,
    limit,
  ]);

  const filteredAnalyst = useMemo(() => {
    if (agent === 'all') return analystEvents;
    return analystEvents.filter((e) => e.agent === agent);
  }, [analystEvents, agent]);

  const renderDetailFields = (ev: TimelineEvent) => {
    const entries = Object.entries(ev).filter(
      ([k, v]) =>
        v !== undefined &&
        v !== null &&
        v !== '' &&
        !['ts', 'event', 'agent', 'mode'].includes(k)
    );
    return (
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 rounded-lg border border-[#30363d] bg-[#0b0f14] p-3 text-xs">
        {entries.map(([key, val]) => {
          let formatted = Array.isArray(val) ? val.join(', ') : String(val);
          if (key === 'pnl' || key === 'fee' || key === 'fees') {
            formatted = formatMoney(Number(val), AGENT_CURRENCIES[ev.agent] ?? 'BRL', key === 'pnl');
          }
          return (
            <div key={key} className="min-w-0">
              <dt className="text-[10px] uppercase tracking-wide text-[#8b9bb4]">
                {DETAIL_LABELS[key] ?? key}
              </dt>
              <dd className="font-mono text-[#e6edf3] break-all mt-0.5">{formatted}</dd>
            </div>
          );
        })}
      </dl>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">Linha do tempo de decisões</h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            GET /api/v2/timeline · America/Sao_Paulo{tlLoading ? ' · carregando…' : ''}
          </p>
        </div>

        {tlError && <ErrorState message={tlError} />}

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#30363d] bg-[#161b22] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('journal')}
              className={`rounded-md px-3 py-1 font-medium ${
                activeTab === 'journal' ? 'bg-[#1c2330] text-[#e6edf3]' : 'text-[#8b9bb4]'
              }`}
            >
              Diário operacional ({filteredEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analyst')}
              className={`rounded-md px-3 py-1 font-medium ${
                activeTab === 'analyst' ? 'bg-[#1c2330] text-[#e6edf3]' : 'text-[#8b9bb4]'
              }`}
            >
              Contexto do analista ({filteredAnalyst.length})
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleFollow}
            aria-pressed={followLive}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              followLive
                ? 'border-[#7aa2f7] bg-[#7aa2f7]/15 text-[#7aa2f7]'
                : 'border-[#30363d] bg-[#161b22] text-[#8b9bb4]'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            Seguir
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <section className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
            <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">
              Data (Brasília)
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs font-mono text-[#e6edf3]"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">Modo do diário</label>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as 'all' | 'live' | 'paper')}
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3]"
            >
              <option value="all">Todos</option>
              <option value="live">Live (REAL)</option>
              <option value="paper">Paper (PAPEL)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">Fonte</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'all' | 'python' | 'llm')}
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
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              placeholder="WIN, BTCUSDT..."
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs font-mono text-[#e6edf3]"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">
              client_order_id
            </label>
            <input
              type="text"
              value={clientOrderIdFilter}
              onChange={(e) => setClientOrderIdFilter(e.target.value)}
              placeholder="tAAA... / llm-..."
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs font-mono text-[#e6edf3]"
            />
          </div>
        </div>

        {/* Event type multi-select chips + fills/trades toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#30363d]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#8b9bb4] mr-1">Eventos:</span>
            {EVENT_TYPE_OPTIONS.map((evType) => {
              const active = selectedEventTypes.includes(evType);
              return (
                <button
                  key={evType}
                  type="button"
                  onClick={() => toggleEventType(evType)}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                    active
                      ? 'border-[#7aa2f7] bg-[#7aa2f7]/15 text-[#7aa2f7]'
                      : 'border-[#30363d] bg-[#0d1117] text-[#8b9bb4] hover:text-[#e6edf3]'
                  }`}
                >
                  {evType}
                </button>
              );
            })}
            {selectedEventTypes.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedEventTypes([])}
                className="text-[11px] text-[#7aa2f7] hover:underline ml-1"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-[#e6edf3]">
              <input
                type="checkbox"
                checked={onlyFillsTrades}
                onChange={(e) => setOnlyFillsTrades(e.target.checked)}
                className="accent-[#7aa2f7]"
              />
              Só fills e trades
            </label>
            <select
              aria-label="Limite de eventos"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-1 text-xs font-mono text-[#e6edf3]"
            >
              <option value={200}>limit 200</option>
              <option value={500}>limit 500</option>
              <option value={1000}>limit 1000</option>
            </select>
          </div>
        </div>
      </section>

      {/* Response Metadata */}
      {shown && (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[#8b9bb4]">
            <span>
              exibindo <strong className="text-[#e6edf3]">{filteredEvents.length}</strong> de{' '}
              <strong className="text-[#e6edf3]">{shown.total_matched ?? '—'}</strong>
            </span>
            <span>window: {shown.window}</span>
            <span>truncated: {String(shown.truncated)}</span>
            <span>
              fontes: {shown.sources.map((s) => s.path).join(', ') || 'nenhuma'}
            </span>
          </div>
          {shown.missing.length > 0 && (
            <div className="text-[11px] text-[#d29922] font-mono">
              missing: {shown.missing.map((m) => `${m.agent} (${m.path})`).join('; ')}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analyst' ? (
        <section className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#30363d]">
            <h2 className="text-base font-semibold text-[#e6edf3]">
              Contexto do analista (events/queue.jsonl)
            </h2>
            <p className="text-xs text-[#8b9bb4]">
              Gatilhos de mercado (volume_spike, range_break, halt) separados das ordens executadas.
            </p>
          </div>
          {filteredAnalyst.length === 0 ? (
            <EmptyState
              title="Nenhum evento do analista neste filtro"
              detail="Quando o analista registrar gatilhos em var/<agente>/events/queue.jsonl, eles aparecerão aqui."
            />
          ) : (
            <div className="divide-y divide-[#30363d]">
              {filteredAnalyst.map((ae, i) => (
                <div key={i} className="p-4 flex flex-wrap items-start justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#8b9bb4]">
                        {formatBrasiliaTime(ae.ts, true)}
                      </span>
                      <span className="font-semibold text-[#e6edf3]">
                        {AGENT_NAMES[ae.agent]}
                      </span>
                      <StatusBadge variant="info" label={ae.kind} />
                      <span className="font-mono text-[#e6edf3]">{ae.symbol}</span>
                    </div>
                    <p className="text-[#8b9bb4]">{ae.rationale || ae.motivo}</p>
                  </div>
                  {ae.volume !== undefined && ae.media !== undefined && (
                    <div className="font-mono text-[#8b9bb4]">
                      vol {ae.volume} / média {ae.media}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          title="Nenhum evento neste filtro"
          detail={
            shown?.missing.length
              ? `Sem eventos correspondentes. Ausentes no servidor: ${shown.missing
                  .map((m) => m.path)
                  .join(', ')}`
              : 'Ajuste os filtros de agente, evento ou client_order_id.'
          }
          action={
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-xs font-medium text-[#e6edf3]"
            >
              Recarregar timeline
            </button>
          }
        />
      ) : (
        <ol className="relative border-l border-[#30363d] ml-3 space-y-3 pl-5">
          {filteredEvents.map((ev, idx) => {
            const key = `${ev.ts}-${ev.event}-${idx}`;
            const expanded = Boolean(expandedMap[key]);
            const cat = getEventColorCategory(ev.event);
            const dotClass =
              cat === 'good'
                ? 'bg-[#3fb950]'
                : cat === 'bad'
                  ? 'bg-[#f85149]'
                  : cat === 'warn'
                    ? 'bg-[#d29922]'
                    : cat === 'accent'
                      ? 'bg-[#7aa2f7]'
                      : 'bg-[#8b9bb4]';

            return (
              <li key={key} className="relative">
                <span
                  className={`absolute -left-[25px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-[#0d1117] ${dotClass}`}
                />
                <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-3.5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMap((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                    className="w-full flex flex-wrap items-center justify-between gap-2 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-[#8b9bb4] shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[#8b9bb4] shrink-0" />
                      )}
                      <span className="font-mono text-xs text-[#8b9bb4] tabular-nums">
                        {formatBrasiliaTime(ev.ts, true)}
                      </span>
                      <span className="text-xs font-semibold text-[#e6edf3]">
                        {AGENT_NAMES[ev.agent]}
                      </span>
                      <ModeBadge live={ev.mode === 'live'} compact />
                      <span className="text-xs font-semibold text-[#e6edf3]">
                        {EVENT_LABELS[ev.event] ?? ev.event}
                      </span>
                      <span className="text-xs text-[#8b9bb4] truncate">
                        {summarizeTimelineEvent(ev)}
                      </span>
                    </div>
                    {ev.client_order_id && (
                      <span className="font-mono text-[11px] text-[#7aa2f7] shrink-0">
                        {ev.client_order_id}
                      </span>
                    )}
                  </button>

                  {expanded && renderDetailFields(ev)}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
