import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Server,
  ShieldAlert,
} from 'lucide-react';
import {
  AgentId,
  AgentSummary,
  AlertItem,
  InfraResponse,
  RouteKey,
  StatusResponse,
  TimelineEvent,
} from '../../types/triade';
import {
  AGENT_NAMES,
  EVENT_LABELS,
  formatBrasiliaTime,
  formatMoney,
  formatPct,
  formatPrice,
  getEventColorCategory,
  summarizeTimelineEvent,
} from '../../utils/format';
import {
  EmptyState,
  ErrorState,
  MetricBlock,
  ModeBadge,
  SkeletonCard,
  StatusBadge,
} from '../ui/Primitives';

type QuickFilter = 'all' | 'live' | 'locked';

export const OverviewView: React.FC<{
  status: StatusResponse | null;
  infra: InfraResponse | null;
  timelineEvents: TimelineEvent[];
  alerts: AlertItem[];
  loading: boolean;
  error: string | null;
  offline: boolean;
  followLive: boolean;
  onToggleFollow: () => void;
  onRetry: () => void;
  onNavigate: (route: RouteKey, query?: { agent?: AgentId }) => void;
}> = ({
  status,
  infra,
  timelineEvents,
  alerts,
  loading,
  error,
  followLive,
  onToggleFollow,
  onRetry,
  onNavigate,
}) => {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  const agents = useMemo(() => {
    if (!status) return [];
    const list = [status.agents.b3, status.agents.nasdaq, status.agents.crypto];
    if (quickFilter === 'live') return list.filter((a) => a.live_enabled);
    if (quickFilter === 'locked') {
      return list.filter((a) => a.kill.blocked || Boolean(a.state?.halted));
    }
    return list;
  }, [status, quickFilter]);

  const openAlerts = alerts.filter((a) => !a.acknowledged);
  const compactTimeline = timelineEvents.slice(0, 15);

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#e6edf3]">
            Visão geral multi-mercado
          </h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Três agentes independentes (B3, NASDAQ e Cripto) · horários em America/Sao_Paulo (horário de Brasília)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#30363d] bg-[#161b22] p-0.5">
            {[
              { id: 'all' as QuickFilter, label: 'Todos (3)' },
              { id: 'live' as QuickFilter, label: 'Só em REAL' },
              { id: 'locked' as QuickFilter, label: 'Só travados' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setQuickFilter(tab.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  quickFilter === tab.id
                    ? 'bg-[#1c2330] text-[#e6edf3]'
                    : 'text-[#8b9bb4] hover:text-[#e6edf3]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleFollow}
            aria-pressed={followLive}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              followLive
                ? 'border-[#7aa2f7] bg-[#7aa2f7]/15 text-[#7aa2f7]'
                : 'border-[#30363d] bg-[#161b22] text-[#8b9bb4] hover:text-[#e6edf3]'
            }`}
          >
            {followLive ? 'Seguindo ao vivo' : 'Seguir pausado'}
          </button>

          <button
            type="button"
            onClick={onRetry}
            aria-label="Atualizar visão geral"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs font-medium text-[#e6edf3] hover:bg-[#1c2330] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} />}

      {/* 3 Equal Agent Cards */}
      {loading && !status ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={6} />
          <SkeletonCard lines={6} />
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          title="Nenhum agente corresponde ao filtro"
          detail="Altere o filtro rápido acima para voltar a visualizar todos os agentes."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {agents.map((ag) => {
            const st = ag.state;
            const unitActive = ag.units.agent.active === 'active';
            const listening = ag.bridge.listen?.listening;
            const pnl = st?.realized_pnl_today;
            const openPosCount = st?.positions.length ?? 0;

            return (
              <article
                key={ag.agent}
                className={`rounded-xl border border-[#30363d] bg-[#1c2330] border-t-[3px] flex flex-col justify-between overflow-hidden ${
                  ag.live_enabled ? 'border-t-[#f85149]' : 'border-t-[#58a6ff]'
                }`}
              >
                <div className="p-4 space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onNavigate(`agent-${ag.agent}` as RouteKey)}
                          className="text-base font-semibold text-[#e6edf3] hover:text-[#7aa2f7] transition-colors text-left"
                        >
                          {ag.label}
                        </button>
                        <ModeBadge live={ag.live_enabled} />
                        {ag.kill.blocked && <StatusBadge variant="bad" label="kill ativo" />}
                        {st?.halted && (
                          <StatusBadge
                            variant="warn"
                            label={`travado: ${st.halt_reason ?? 'halt'}`}
                          />
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-[#8b9bb4] flex-wrap">
                        <span>{ag.market}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{ag.timezone}</span>
                        {!ag.live_enabled && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`font-mono ${
                                ag.paper_venue === 'demo' ? 'text-[#d29922]' : ''
                              }`}
                            >
                              venue: {ag.paper_venue}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge
                        variant={unitActive ? 'ok' : ag.units.agent.active === 'failed' ? 'bad' : 'neutral'}
                        label={
                          unitActive
                            ? 'unit ativa'
                            : ag.units.agent.active === 'failed'
                              ? 'unit falhou'
                              : 'unit parada'
                        }
                        title={`systemctl --user is-enabled: ${ag.units.agent.enabled}`}
                      />
                      <span className="text-[10px] font-mono text-[#8b9bb4]">
                        boot: {ag.units.agent.enabled}
                      </span>
                    </div>
                  </div>

                  {/* Kill Reason / Halt Warning */}
                  {ag.kill.blocked && (
                    <div className="rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-xs text-[#f85149]">
                      Kill switch ativo:{' '}
                      {(ag.kill.kill_agent.reason || ag.kill.kill_all.reason || 'arquivo KILL presente').slice(
                        0,
                        200
                      )}
                    </div>
                  )}

                  {/* State Metrics or Honest Empty State */}
                  {st === null ? (
                    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-3.5 text-xs text-[#8b9bb4]">
                      <div className="font-semibold text-[#e6edf3]">Sem estado persistido ainda</div>
                      <p className="mt-1">
                        {ag.missing_state_reason ||
                          `Ainda não há var/${ag.agent}/${ag.live_enabled ? 'live' : 'paper'}-state.json neste servidor.`}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#30363d]">
                        <MetricBlock
                          label="PnL do dia"
                          value={formatMoney(pnl, ag.currency, true)}
                          tone={pnl && pnl > 0 ? 'good' : pnl && pnl < 0 ? 'bad' : 'default'}
                        />
                        <MetricBlock
                          label="Drawdown"
                          value={
                            st.drawdown !== null
                              ? `${formatMoney(st.drawdown, ag.currency)} (${formatPct(st.drawdown_pct)})`
                              : '—'
                          }
                          tone={st.halted ? 'warn' : 'default'}
                        />
                        <MetricBlock
                          label={ag.live_enabled ? 'Equity início do dia' : 'Referência do dia'}
                          value={formatMoney(st.day_start_equity, ag.currency)}
                          subtext={`dia ${st.day}`}
                        />
                        <MetricBlock
                          label="Trades / Posições"
                          value={`${st.trades_today ?? '—'} trades · ${openPosCount} pos.`}
                          subtext={
                            st.consecutive_losses != null
                              ? `${st.consecutive_losses} perda(s) seguida(s)`
                              : 'perdas seguidas não informadas'
                          }
                        />
                      </div>

                      {/* Open Positions Table inside card */}
                      <div className="pt-2 border-t border-[#30363d]">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8b9bb4] mb-1.5">
                          Posições abertas
                        </div>
                        {st.positions.length === 0 ? (
                          <p className="text-xs text-[#8b9bb4]">Nenhuma posição aberta.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {st.positions.map((pos) => (
                              <div
                                key={pos.client_order_id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-[#0d1117] border border-[#30363d] px-2.5 py-1.5 text-xs font-mono tabular-nums"
                              >
                                <span className="text-[#e6edf3]">
                                  {pos.contract || pos.symbol}{' '}
                                  <span
                                    className={pos.qty > 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}
                                  >
                                    {pos.qty > 0 ? `+${pos.qty}` : pos.qty}
                                  </span>
                                </span>
                                <span className="text-[#8b9bb4]">
                                  stop:{' '}
                                  {pos.stop_price !== null ? (
                                    formatPrice(pos.stop_price)
                                  ) : (
                                    <strong className="text-[#f85149]">SEM STOP</strong>
                                  )}
                                </span>
                                <span className="text-[#8b9bb4]">{pos.source}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Bridge Health */}
                  <div className="pt-2 border-t border-[#30363d] flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#8b9bb4]">Ponte MT5</span>
                    {!ag.bridge.applicable ? (
                      <span className="text-[#8b9bb4]">Sem ponte MT5 (Binance Python)</span>
                    ) : (
                      <div className="flex items-center gap-2 font-mono">
                        <StatusBadge
                          variant={
                            listening === true
                              ? ag.bridge.listen?.localhost_only === false
                                ? 'bad'
                                : 'ok'
                              : listening === false
                                ? 'bad'
                                : 'neutral'
                          }
                          label={
                            listening === true
                              ? `escutando :${ag.bridge.listen?.port}${
                                  ag.bridge.check?.pong === false ? ' · pong ocupado' : ''
                                }`
                              : listening === false
                                ? `sem escuta :${ag.bridge.listen?.port ?? '?'}`
                                : 'sem dado de porta'
                          }
                        />
                        {ag.bridge.secondary_ports && ag.agent === 'b3' && (
                          <span className="text-[11px] text-[#8b9bb4]">(18861/18863)</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Log tail */}
                  <div className="pt-2 border-t border-[#30363d]">
                    <div className="flex items-center justify-between text-[11px] text-[#8b9bb4] mb-1">
                      <span className="uppercase tracking-wide font-semibold">Log efetivo</span>
                      <span className="font-mono truncate max-w-[180px]">{ag.log_file}</span>
                    </div>
                    <div className="rounded-lg bg-[#0b0f14] border border-[#30363d] p-2 font-mono text-[11px] leading-relaxed text-[#8b9bb4] space-y-1 max-h-20 overflow-y-auto">
                      {!ag.logs || ag.logs.length === 0 ? (
                        <div>Sem entradas recentes no log deste modo.</div>
                      ) : (
                        ag.logs.slice(0, 3).map((l, i) => (
                          <div key={i} className="truncate">
                            <span className="text-[#8b9bb4]/70">{formatBrasiliaTime(l.ts)}</span>{' '}
                            <span
                              className={
                                l.level === 'ERROR'
                                  ? 'text-[#f85149]'
                                  : l.level === 'WARN'
                                    ? 'text-[#d29922]'
                                    : 'text-[#7aa2f7]'
                              }
                            >
                              {l.level}
                            </span>{' '}
                            <span className="text-[#e6edf3]">{l.msg}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Shortcuts */}
                <div className="border-t border-[#30363d] bg-[#161b22] px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate(`agent-${ag.agent}` as RouteKey)}
                      className="rounded-md border border-[#30363d] bg-[#21262d] px-2.5 py-1 text-xs font-medium text-[#e6edf3] hover:bg-[#30363d] transition-colors"
                    >
                      Ver agente
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('timeline', { agent: ag.agent })}
                      className="rounded-md border border-[#30363d] bg-[#0d1117] px-2.5 py-1 text-xs font-medium text-[#8b9bb4] hover:text-[#e6edf3] transition-colors"
                    >
                      Timeline
                    </button>
                  </div>

                  <span
                    className="text-[11px] text-[#8b9bb4]"
                    title="POST flatten responde 405. Nada é enviado."
                  >
                    Zerar indisponível
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Infra Summary Strip */}
      {infra && (
        <section
          aria-label="Resumo de infraestrutura"
          className="rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#e6edf3]">
              <Server className="h-4 w-4 text-[#7aa2f7]" />
              Infraestrutura VPS
            </span>
            <span className="font-mono text-[#8b9bb4]">
              Bind painel: <strong className="text-[#e6edf3]">{infra.dashboard.bind}</strong>
            </span>
            <span className="font-mono text-[#8b9bb4]">
              Linger: <strong className="text-[#3fb950]">{infra.dashboard.linger}</strong>
            </span>
            <span className="font-mono text-[#8b9bb4]">
              Pontes:{' '}
              <strong className="text-[#e6edf3]">18861 / 18863 (B3) · 18862 (NASDAQ)</strong>
            </span>
            {infra.unsafe_binds_total.length > 0 ? (
              <StatusBadge
                variant="bad"
                label={`ALERTA: bind fora de 127.0.0.1 (${infra.unsafe_binds_total.join(', ')})`}
              />
            ) : (
              <span className="inline-flex items-center gap-1 text-[#3fb950] font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Todos os binds em localhost
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('infra')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#7aa2f7] hover:underline"
          >
            Saúde da infra <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </section>
      )}

      {/* Bottom Split: Compact Timeline + Open Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Compact Timeline */}
        <section className="xl:col-span-8 rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
            <div>
              <h2 className="text-base font-semibold text-[#e6edf3]">
                Linha do tempo recente (últimos 15 eventos)
              </h2>
              <p className="text-xs text-[#8b9bb4]">
                Eventos reais gravados nos arquivos journal/*.jsonl · horário de Brasília
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('timeline')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#7aa2f7] hover:underline whitespace-nowrap"
            >
              Ver completa <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {compactTimeline.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8b9bb4]">
              Nenhum evento registrado ainda na janela atual.
            </div>
          ) : (
            <div className="divide-y divide-[#30363d]">
              {compactTimeline.map((ev, idx) => {
                const cat = getEventColorCategory(ev.event);
                const dotColor =
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
                  <div
                    key={`${ev.ts}-${idx}`}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[#161b22]/70 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                      <span className="font-mono text-[#8b9bb4] shrink-0 tabular-nums">
                        {formatBrasiliaTime(ev.ts)}
                      </span>
                      <span className="font-semibold text-[#e6edf3] shrink-0">
                        {AGENT_NAMES[ev.agent]}
                      </span>
                      <span
                        className={`font-mono text-[10px] font-semibold uppercase shrink-0 ${
                          ev.mode === 'live' ? 'text-[#f85149]' : 'text-[#58a6ff]'
                        }`}
                      >
                        {ev.mode === 'live' ? 'REAL' : 'PAPEL'}
                      </span>
                      <span className="font-medium text-[#e6edf3] shrink-0">
                        {EVENT_LABELS[ev.event] ?? ev.event}
                      </span>
                      <span className="text-[#8b9bb4] truncate">
                        {summarizeTimelineEvent(ev)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Open Alerts */}
        <section className="xl:col-span-4 rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#d29922]" />
              <h2 className="text-base font-semibold text-[#e6edf3]">
                Alertas abertos ({openAlerts.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('alerts')}
              className="text-xs font-medium text-[#7aa2f7] hover:underline"
            >
              Ver todos
            </button>
          </div>

          <div className="divide-y divide-[#30363d]">
            {openAlerts.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8b9bb4]">
                Nenhum alerta ativo no momento.
              </div>
            ) : (
              openAlerts.map((al) => (
                <div key={al.id} className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        al.mode === 'live' ? 'text-[#f85149]' : 'text-[#d29922]'
                      }`}
                    >
                      {al.title}
                    </span>
                    <span className="font-mono text-[11px] text-[#8b9bb4]">
                      {formatBrasiliaTime(al.ts)}
                    </span>
                  </div>
                  <p className="text-xs text-[#8b9bb4]">{al.detail}</p>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-[#30363d] bg-[#161b22] px-4 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-[#8b9bb4]">Controles somente leitura (405)</span>
            <button
              type="button"
              onClick={() => onNavigate('controls')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#e6edf3] hover:text-[#7aa2f7]"
            >
              <ShieldAlert className="h-3.5 w-3.5" /> Ver controles
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
