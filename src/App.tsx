/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { logout, restoreSession } from './api/auth';
import { annotateAlertModes, TriadeApiError, triadeApi } from './api/triade';
import { LiveRevisionContext } from './api/liveContext';
import { authEpoch, AuthSession, markUnauthenticated, subscribeAuth } from './api/sessionStore';
import { AdminModal } from './components/admin/AdminModal';
import { LoginScreen, SessionGate } from './components/auth/LoginScreen';
import { AppShell, ToastMessage } from './components/layout/AppShell';
import { AgentDetailView } from './components/views/AgentDetailView';
import { AlertsView } from './components/views/AlertsView';
import { AuditView } from './components/views/AuditView';
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
import {
  AgentId,
  AlertItem,
  AlertsPayload,
  AnalystEvent,
  AuditEntry,
  BacktestReport,
  ConnectionState,
  HealthResponse,
  InfraResponse,
  RouteKey,
  StatusResponse,
  StrategyConfig,
  TimelineResponse,
} from './types/triade';

function parseRouteFromLocation(): {
  route: RouteKey;
  agent?: AgentId;
  clientOrderId?: string;
} {
  const hash = window.location.hash.replace(/^#/, '');
  const base = (import.meta.env.BASE_URL || '/').replace(/^\/+|\/+$/g, '');
  let path = window.location.pathname.replace(/^\/+/, '');
  if (base && (path === base || path.startsWith(`${base}/`))) {
    path = path.slice(base.length).replace(/^\/+/, '');
  }
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

const EMPTY_FLAGS: Record<AgentId, boolean | null> = { b3: null, nasdaq: null, crypto: null };

export default function App() {
  const initialParsed = parseRouteFromLocation();
  const [route, setRoute] = useState<RouteKey>(initialParsed.route);
  const [routeAgentParam, setRouteAgentParam] = useState<AgentId | undefined>(initialParsed.agent);
  const [routeClientOrderId, setRouteClientOrderId] = useState<string | undefined>(
    initialParsed.clientOrderId
  );

  const tunnelEnv = 'mesma origem · /api/v2';
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    const sync = () => {
      const parsed = parseRouteFromLocation();
      setRoute(parsed.route);
      setRouteAgentParam(parsed.agent);
      setRouteClientOrderId(parsed.clientOrderId);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const [connection, setConnection] = useState<ConnectionState>('reconnecting');
  const [followLive, setFollowLive] = useState<boolean>(true);
  const [revision, setRevision] = useState(0);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [analystEvents, setAnalystEvents] = useState<AnalystEvent[]>([]);
  const [infra, setInfra] = useState<InfraResponse | null>(null);
  const [infraError, setInfraError] = useState<string | null>(null);
  const [alertsPayload, setAlertsPayload] = useState<AlertsPayload>({ alerts: [], note: null });
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditNote, setAuditNote] = useState<string | null>(null);
  const [backtests, setBacktests] = useState<BacktestReport[]>([]);
  const [strategies, setStrategies] = useState<Partial<Record<AgentId, StrategyConfig>>>({});
  const [telegramFlags, setTelegramFlags] = useState<Record<AgentId, boolean | null>>(EMPTY_FLAGS);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const authed = Boolean(session);

  const pushToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 5500);
  }, []);

  const fetchAll = useCallback(async () => {
    const stamp = authEpoch();
    try {
      setError(null);
      const [healthResult, statusPack, timeline, analyst, alerts, audit, reports, configs, flags] =
        await Promise.all([
          triadeApi.getHealth().catch(() => null),
          triadeApi.getStatusWithInfra(),
          triadeApi.getTimeline({ agent: 'all', mode: 'all', limit: 200 }).catch(() => null),
          triadeApi.getAnalystEvents('all').catch(() => null),
          triadeApi.getAlerts().catch(() => null),
          triadeApi.getAudit().catch(() => null),
          triadeApi.getBacktests().catch(() => null),
          triadeApi.getStrategies().catch(() => null),
          triadeApi.getTelegramFlags().catch(() => null),
        ]);
      if (stamp !== authEpoch()) return;
      setHealth(healthResult);
      setStatus(statusPack.status);
      setInfra(statusPack.infra);
      setInfraError(statusPack.infraError);
      if (timeline) setTimelineData(timeline);
      if (analyst) setAnalystEvents(analyst);
      if (alerts) setAlertsPayload(annotateAlertModes(alerts, statusPack.status));
      if (audit) {
        setAuditEntries(audit.entries);
        setAuditNote(audit.note);
      }
      if (reports) setBacktests(reports);
      if (configs) setStrategies(configs);
      if (flags) setTelegramFlags(flags);
      setConnection((prev) => (prev === 'sse' ? 'sse' : 'polling'));
      setRevision((n) => n + 1);
    } catch (err) {
      if (stamp !== authEpoch()) return;
      if (err instanceof TriadeApiError && err.code === 'unauthenticated') return;
      const msg = err instanceof Error ? err.message : 'Sem conexão com o VPS';
      setError(msg);
      setConnection('offline');
    } finally {
      if (stamp === authEpoch()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeAuth((next) => {
      if (!cancelled) setSession(next);
    });
    restoreSession()
      .catch((err: unknown) => {
        if (cancelled) return;
        setBootError(err instanceof Error ? err.message : 'sem conexão com o VPS');
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.expiresAt) return;
    const delay = Math.max(0, session.expiresAt * 1000 - Date.now());
    const id = window.setTimeout(() => {
      void restoreSession().catch(() => {
        markUnauthenticated();
      });
    }, delay);
    return () => window.clearTimeout(id);
  }, [session?.expiresAt]);

  useEffect(() => {
    if (!authed) return;
    void fetchAll();
  }, [authed, fetchAll]);

  useEffect(() => {
    if (!authed || !followLive) return;
    const unsub = triadeApi.subscribeStream({
      onConnectionChange: (next) => setConnection(next),
      onJournalEvent: () => {
        fetchAll();
      },
      onStatusTick: () => {
        fetchAll();
      },
    });
    return unsub;
  }, [authed, followLive, fetchAll]);

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

  const handleLogout = useCallback(() => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    void logout()
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : 'Não foi possível encerrar a sessão.';
        pushToast({ tone: 'bad', title: 'Não foi possível sair', detail });
      })
      .finally(() => setLogoutBusy(false));
  }, [logoutBusy, pushToast]);

  if (!ready) return <SessionGate label="Consultando a sessão…" />;
  if (!session) return <LoginScreen bootError={bootError} />;

  const offline = connection === 'offline';
  const alerts: AlertItem[] = alertsPayload.alerts;
  const unackedAlertsCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <LiveRevisionContext.Provider value={revision}>
      <AppShell
        route={route}
        onNavigate={handleNavigate}
        status={status}
        connection={connection}
        role="auditor"
        sessionUser={session.user}
        sessionExpiresAt={session.expiresAt}
        onLogout={handleLogout}
        logoutBusy={logoutBusy}
        adminOpen={adminOpen}
        onOpenAdmin={() => setAdminOpen(true)}
        tunnelEnv={tunnelEnv}
        stub={health?.stub === true}
        onOpenKillAll={() => undefined}
        recentEvents={timelineData?.events ?? []}
        unackedAlertsCount={unackedAlertsCount}
        toasts={toasts}
        onDismissToast={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))}
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
            followLive={followLive}
            onToggleFollow={() => setFollowLive((f) => !f)}
            onRetry={fetchAll}
            onNavigate={handleNavigate}
          />
        )}

        {(route === 'agent-b3' || route === 'agent-nasdaq' || route === 'agent-crypto') && (
          <AgentDetailView
            agentId={route.replace('agent-', '') as AgentId}
            agent={status?.agents[route.replace('agent-', '') as AgentId] ?? null}
            timelineEvents={timelineData?.events ?? []}
            analystEvents={analystEvents}
            strategyConfig={strategies[route.replace('agent-', '') as AgentId] ?? null}
            offline={offline}
            onNavigate={handleNavigate}
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
            offline={offline}
            onNavigate={handleNavigate}
          />
        )}

        {route === 'risk' && <RiskView initialAgent={routeAgentParam ?? 'b3'} />}

        {route === 'pnl' && <PnLView status={status} />}

        {route === 'charts' && (
          <ChartsView
            status={status}
            timelineEvents={timelineData?.events ?? []}
            initialAgent={routeAgentParam ?? 'b3'}
            onNavigate={handleNavigate}
          />
        )}

        {route === 'trades' && <TradesView onNavigate={handleNavigate} />}

        {route === 'backtests' && <BacktestsView reports={backtests} />}

        {route === 'strategies' && <StrategiesView configs={strategies} />}

        {route === 'infra' && (
          <InfraView infra={infra} error={error ?? infraError} onRefresh={fetchAll} />
        )}

        {route === 'alerts' && (
          <AlertsView
            alerts={alerts}
            note={alertsPayload.note}
            telegramFlags={telegramFlags}
            onAcknowledge={(id) => {
              setAlertsPayload((current) => triadeApi.ackAlertLocal(id, current));
              pushToast({
                tone: 'info',
                title: 'Alerta escondido só neste navegador',
                detail: 'O servidor não grava acknowledgement.',
              });
            }}
          />
        )}

        {route === 'controls' && <ControlsView status={status} offline={offline} />}

        {route === 'logs' && <LogsView />}

        {route === 'audit' && <AuditView entries={auditEntries} note={auditNote} />}

        {route === 'settings' && (
          <SettingsView
            tunnelEnv={tunnelEnv}
            followDefault={followLive}
            telegramFlags={telegramFlags}
            health={health}
            onToggleFollowDefault={() => setFollowLive((f) => !f)}
          />
        )}
      </AppShell>
      {adminOpen && (
        <AdminModal
          stub={health?.stub === true}
          session={session}
          onClose={() => setAdminOpen(false)}
        />
      )}
    </LiveRevisionContext.Provider>
  );
}
