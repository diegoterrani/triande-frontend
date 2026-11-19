/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { triadeApi } from './api/triade';
import { AppShell, ToastMessage } from './components/layout/AppShell';
import { ConfirmDangerModal } from './components/ui/Primitives';
import { AgentDetailView } from './components/views/AgentDetailView';
import { AlertsView } from './components/views/AlertsView';
import { AuditView } from './components/views/AuditView';
import { AuthLockView } from './components/views/AuthLockView';
import { BacktestsView } from './components/views/BacktestsView';
import { ChartsView } from './components/views/ChartsView';
import { ControlsView } from './components/views/ControlsView';
import { InfraView } from './components/views/InfraView';
import { LogsView } from './components/views/LogsView';
import { OverviewView } from './components/views/OverviewView';
import { PnLView } from './components/views/PnLView';
import { PositionsView } from './components/views/PositionsView';
import { RiskView } from './components/views/RiskView';
import { SettingsView } from './components/views/SettingsView';
import { StrategiesView } from './components/views/StrategiesView';
import { TimelineView } from './components/views/TimelineView';
import { TradesView } from './components/views/TradesView';
import { STRATEGY_CONFIGS } from './data/specPreviewData';
import {
  AgentId,
  AgentSummary,
  AlertItem,
  AnalystEvent,
  AuditEntry,
  BacktestReport,
  ConnectionState,
  DangerActionPayload,
  DangerActionType,
  InfraResponse,
  PreviewScenario,
  RouteKey,
  StatusResponse,
  StrategyConfig,
  TimelineResponse,
  UserRole,
} from './types/triade';

function parseRouteFromLocation(): {
  route: RouteKey;
  agent?: AgentId;
  clientOrderId?: string;
} {
  const hash = window.location.hash.replace(/^#/, '');
  const path = window.location.pathname.replace(/^\/+/, '');
  const raw = hash || path;
  const [segment, qs] = raw.split('?');
  const params = new URLSearchParams(qs || window.location.search);
  const agentParam = params.get('agent') as AgentId | null;
  const clientOrderId = params.get('client_order_id') ?? undefined;

  const map: Record<string, RouteKey> = {
    '': 'overview',
    visao: 'overview',
    'agentes/b3': 'agent-b3',
    'agentes/nasdaq': 'agent-nasdaq',
    'agentes/crypto': 'agent-crypto',
    timeline: 'timeline',
    posicoes: 'positions',
    risco: 'risk',
    pnl: 'pnl',
    graficos: 'charts',
    trades: 'trades',
    backtests: 'backtests',
    estrategias: 'strategies',
    infra: 'infra',
    alertas: 'alerts',
    controles: 'controls',
    logs: 'logs',
    auditoria: 'audit',
    configuracoes: 'settings',
  };

  return {
    route: map[segment] ?? 'overview',
    agent: agentParam && ['b3', 'nasdaq', 'crypto'].includes(agentParam) ? agentParam : undefined,
    clientOrderId,
  };
}

export default function App() {
  const initialParsed = parseRouteFromLocation();
  const [route, setRoute] = useState<RouteKey>(initialParsed.route);
  const [routeAgentParam, setRouteAgentParam] = useState<AgentId | undefined>(initialParsed.agent);
  const [routeClientOrderId, setRouteClientOrderId] = useState<string | undefined>(
    initialParsed.clientOrderId
  );

  // Auth state: required immediately if pointing to a remote VPS without token
  const [locked, setLocked] = useState<boolean>(
    () => triadeApi.isUsingRemoteVps() && !triadeApi.hasToken()
  );
  const [role, setRole] = useState<UserRole>('owner');
  const [operatorName, setOperatorName] = useState<string>('Diego Terrani');
  const [tunnelEnv, setTunnelEnv] = useState<string>('local · 127.0.0.1:8765');

  const [previewScenario, setPreviewScenario] = useState<PreviewScenario>(() =>
    triadeApi.getPreviewScenario()
  );
  const [connection, setConnection] = useState<ConnectionState>('sse');
  const [followLive, setFollowLive] = useState<boolean>(true);

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [analystEvents, setAnalystEvents] = useState<AnalystEvent[]>([]);
  const [infra, setInfra] = useState<InfraResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [backtests, setBacktests] = useState<BacktestReport[]>([]);
  const [strategies, setStrategies] = useState<Record<AgentId, StrategyConfig>>(STRATEGY_CONFIGS);
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(() =>
    triadeApi.getTelegramEnabled()
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [dangerModal, setDangerModal] = useState<{
    open: boolean;
    action: DangerActionType;
    target: AgentSummary | 'all';
  } | null>(null);

  const pushToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 5500);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [st, tl, ae, inf, al, au, bt, strats] = await Promise.all([
        triadeApi.getStatus(),
        triadeApi.getTimeline({ limit: 200 }),
        triadeApi.getAnalystEvents(),
        triadeApi.getInfra(),
        triadeApi.getAlerts(),
        triadeApi.getAudit(),
        triadeApi.getBacktests(),
        triadeApi.getStrategies(),
      ]);
      setStatus(st);
      setTimelineData(tl);
      setAnalystEvents(ae);
      setInfra(inf);
      setAlerts(al);
      setAuditEntries(au);
      setBacktests(bt);
      setStrategies(strats);
      setConnection((prev) => (prev === 'offline' ? 'sse' : prev));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sem conexão com o VPS';
      setError(msg);
      setConnection('offline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (locked) return;
    fetchAll();
  }, [fetchAll, locked]);

  useEffect(() => {
    if (locked || !followLive) return;
    const unsub = triadeApi.subscribeStream({
      onConnectionChange: (c) => setConnection(c),
      onJournalEvent: () => {
        fetchAll();
      },
      onStatusTick: () => {
        fetchAll();
      },
    });
    return unsub;
  }, [locked, followLive, fetchAll]);

  const handleNavigate = useCallback(
    (nextRoute: RouteKey, query?: { agent?: AgentId; clientOrderId?: string }) => {
      setRoute(nextRoute);
      setRouteAgentParam(query?.agent);
      setRouteClientOrderId(query?.clientOrderId);

      const routeHashMap: Record<RouteKey, string> = {
        overview: 'visao',
        'agent-b3': 'agentes/b3',
        'agent-nasdaq': 'agentes/nasdaq',
        'agent-crypto': 'agentes/crypto',
        timeline: 'timeline',
        positions: 'posicoes',
        risk: 'risco',
        pnl: 'pnl',
        charts: 'graficos',
        trades: 'trades',
        backtests: 'backtests',
        strategies: 'estrategias',
        infra: 'infra',
        alerts: 'alertas',
        controls: 'controles',
        logs: 'logs',
        audit: 'auditoria',
        settings: 'configuracoes',
      };
      const qs = new URLSearchParams();
      if (query?.agent) qs.set('agent', query.agent);
      if (query?.clientOrderId) qs.set('client_order_id', query.clientOrderId);
      const qStr = qs.toString() ? `?${qs.toString()}` : '';
      window.location.hash = `#${routeHashMap[nextRoute]}${qStr}`;
      window.scrollTo({ top: 0 });
    },
    []
  );

  const handleChangeScenario = (next: PreviewScenario) => {
    triadeApi.setPreviewScenario(next);
    setPreviewScenario(next);
    if (next === 'api_offline') {
      setConnection('offline');
      setError('sem conexão com o VPS (127.0.0.1:8765 indisponível)');
    } else {
      setConnection('sse');
      fetchAll();
    }
  };

  const handleConfirmDanger = async (payload: DangerActionPayload) => {
    const res = await triadeApi.executeDangerAction(payload, {
      name: operatorName,
      role,
    });
    if (!res.ok) {
      throw new Error(res.error || 'Comando rejeitado pelo servidor');
    }
    pushToast({
      tone: 'warn',
      title: `Comando executado: ${res.action} (${res.agent})`,
      detail: `Auditoria ${res.audit_id}${res.kill_flag ? ` · flag ${res.kill_flag}` : ''}`,
    });
    await fetchAll();
  };

  if (locked) {
    return (
      <AuthLockView
        isRemoteVps={triadeApi.isUsingRemoteVps()}
        initialApiBase={triadeApi.getConfig().apiBase}
        onUnlock={({ name, role: nextRole, token, apiBase }) => {
          if (apiBase !== undefined || token !== undefined) {
            triadeApi.setConnection(apiBase ?? triadeApi.getConfig().apiBase, token ?? '');
          }
          setOperatorName(name);
          setRole(nextRole);
          setLocked(false);
        }}
      />
    );
  }

  const allAgentsList: AgentSummary[] = status
    ? [status.agents.b3, status.agents.nasdaq, status.agents.crypto]
    : [];

  const offline = connection === 'offline';
  const unackedAlertsCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <AppShell
      route={route}
      onNavigate={handleNavigate}
      status={status}
      connection={connection}
      role={role}
      operatorName={operatorName}
      tunnelEnv={tunnelEnv}
      isRemoteVps={triadeApi.isUsingRemoteVps()}
      previewScenario={previewScenario}
      onChangeScenario={handleChangeScenario}
      onOpenKillAll={() =>
        setDangerModal({ open: true, action: 'kill_all', target: 'all' })
      }
      onLockSession={() => setLocked(true)}
      recentEvents={timelineData?.events ?? []}
      unackedAlertsCount={unackedAlertsCount}
      toasts={toasts}
      onDismissToast={(id) =>
        setToasts((prev) => prev.filter((item) => item.id !== id))
      }
    >
      {route === 'overview' && (
        <OverviewView
          status={status}
          infra={infra}
          timelineEvents={timelineData?.events ?? []}
          alerts={alerts}
          loading={loading}
          error={error}
          offline={offline}
          role={role}
          followLive={followLive}
          onToggleFollow={() => setFollowLive((f) => !f)}
          onRetry={fetchAll}
          onNavigate={handleNavigate}
          onFlattenAgent={(ag) =>
            setDangerModal({ open: true, action: 'flatten', target: ag })
          }
        />
      )}

      {(route === 'agent-b3' || route === 'agent-nasdaq' || route === 'agent-crypto') && (
        <AgentDetailView
          agentId={route.replace('agent-', '') as AgentId}
          agent={status?.agents[route.replace('agent-', '') as AgentId] ?? null}
          timelineEvents={timelineData?.events ?? []}
          analystEvents={analystEvents}
          strategyConfig={strategies[route.replace('agent-', '') as AgentId]}
          role={role}
          offline={offline}
          onNavigate={handleNavigate}
          onTriggerDanger={(action, ag) =>
            setDangerModal({ open: true, action, target: ag })
          }
        />
      )}

      {route === 'timeline' && (
        <TimelineView
          key={`${routeAgentParam ?? 'all'}-${routeClientOrderId ?? ''}`}
          timelineData={timelineData}
          analystEvents={analystEvents}
          initialAgent={routeAgentParam ?? 'all'}
          initialClientOrderId={routeClientOrderId ?? ''}
          followLive={followLive}
          onToggleFollow={() => setFollowLive((f) => !f)}
          onRefresh={fetchAll}
        />
      )}

      {route === 'positions' && (
        <PositionsView
          status={status}
          timelineEvents={timelineData?.events ?? []}
          role={role}
          offline={offline}
          onNavigate={handleNavigate}
          onFlattenAgent={(ag) =>
            setDangerModal({ open: true, action: 'flatten', target: ag })
          }
        />
      )}

      {route === 'risk' && <RiskView initialAgent={routeAgentParam ?? 'b3'} />}

      {route === 'pnl' && (
        <PnLView status={status} timelineEvents={timelineData?.events ?? []} />
      )}

      {route === 'charts' && (
        <ChartsView
          status={status}
          timelineEvents={timelineData?.events ?? []}
          initialAgent={routeAgentParam ?? 'b3'}
          onNavigate={handleNavigate}
        />
      )}

      {route === 'trades' && (
        <TradesView
          timelineEvents={timelineData?.events ?? []}
          onNavigate={handleNavigate}
        />
      )}

      {route === 'backtests' && <BacktestsView reports={backtests} />}

      {route === 'strategies' && <StrategiesView configs={strategies} />}

      {route === 'infra' && (
        <InfraView infra={infra} error={error} onRefresh={fetchAll} />
      )}

      {route === 'alerts' && (
        <AlertsView
          alerts={alerts}
          telegramEnabled={telegramEnabled}
          onAcknowledge={(id) => {
            setAlerts(triadeApi.ackAlert(id));
            pushToast({ tone: 'info', title: 'Alerta marcado como visto' });
          }}
        />
      )}

      {route === 'controls' && (
        <ControlsView
          status={status}
          role={role}
          offline={offline}
          onTriggerDanger={(action, target) =>
            setDangerModal({ open: true, action, target })
          }
        />
      )}

      {route === 'logs' && <LogsView />}

      {route === 'audit' && <AuditView entries={auditEntries} role={role} />}

      {route === 'settings' && (
        <SettingsView
          role={role}
          operatorName={operatorName}
          tunnelEnv={tunnelEnv}
          followDefault={followLive}
          telegramEnabled={telegramEnabled}
          onChangeRole={(nextRole, nextName) => {
            setRole(nextRole);
            setOperatorName(nextName);
            pushToast({
              tone: 'info',
              title: `Perfil alterado para ${nextName} (${nextRole})`,
            });
          }}
          onChangeTunnelEnv={setTunnelEnv}
          onToggleFollowDefault={() => setFollowLive((f) => !f)}
          onToggleTelegram={() => {
            const next = triadeApi.setTelegramEnabled(!telegramEnabled);
            setTelegramEnabled(next);
            pushToast({
              tone: 'info',
              title: `TelegramNotifier ${next ? 'ligado' : 'desligado'}`,
            });
          }}
          onLockSession={() => setLocked(true)}
          onVpsConnected={fetchAll}
        />
      )}

      {dangerModal && (
        <ConfirmDangerModal
          open={dangerModal.open}
          action={dangerModal.action}
          targetAgent={dangerModal.target}
          allAgents={allAgentsList}
          offline={offline}
          onClose={() => setDangerModal(null)}
          onConfirm={handleConfirmDanger}
        />
      )}
    </AppShell>
  );
}
