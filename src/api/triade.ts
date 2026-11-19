import { readApiBase } from './env';
import {
  annotateAlertModes,
  attachInfra,
  buildQuery,
  mapAlerts,
  mapAnalystEvents,
  mapAudit,
  mapBacktests,
  mapBars,
  mapHealth,
  mapInfra,
  mapLogs,
  mapPnl,
  mapRisk,
  mapStatus,
  mapStrategy,
  mapTimeline,
  mapTrades,
  telegramFlagFromConfig,
} from './map';
import { READONLY_CONTROL_NOTE } from './readonly';
import {
  AgentId,
  AlertsPayload,
  AnalystEvent,
  AuditPayload,
  BacktestReport,
  ConnectionState,
  HealthResponse,
  InfraResponse,
  LogsPayload,
  PnlResponse,
  RecentBarsResponse,
  RiskResponse,
  StatusResponse,
  StrategyConfig,
  TimelineEvent,
  TimelineResponse,
} from '../types/triade';

export interface TriadeClientConfig {
  apiBase: string;
  token: string;
}

const ENV_TOKEN = (import.meta.env.VITE_TRIADE_TOKEN as string | undefined)?.trim() || '';

export class TriadeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TriadeApiError';
    this.status = status;
  }
}

/**
 * Typed client for the read-only TRIADE dashboard API (`/api/v2`).
 * Empty base URL means same-origin (the SPA served under `/app`).
 * Dev over the SSH tunnel uses `VITE_API_BASE=http://127.0.0.1:8765`.
 */
export class TriadeApiClient {
  private apiBase: string = readApiBase();
  private token: string = ENV_TOKEN;
  private localAck = new Set<string>();
  private agentModes: Partial<Record<AgentId, 'live' | 'paper'>> = {};

  /** True when requests go to an explicit origin (tunnel), not same-origin `/app`. */
  isCrossOrigin(): boolean {
    return Boolean(this.apiBase);
  }

  getConfig(): TriadeClientConfig {
    return {
      apiBase: this.apiBase,
      token: this.token ? '••••••••' : '',
    };
  }

  setConnection(apiBase: string, token?: string): void {
    this.apiBase = apiBase.trim().replace(/\/+$/, '');
    if (token !== undefined && token.trim()) {
      this.token = token.trim();
    }
  }

  private async requestJson<T>(path: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (init?.body) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.apiBase}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
      if (!res.ok) {
        const message =
          typeof json?.error === 'string' && json.error
            ? json.error
            : `Erro HTTP ${res.status}`;
        throw new TriadeApiError(message, res.status);
      }
      return json as T;
    } catch (err) {
      if (err instanceof TriadeApiError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new TriadeApiError(
          'sem conexão com o VPS (túnel 127.0.0.1:8765 indisponível ou tempo esgotado)',
          0
        );
      }
      const message = err instanceof Error ? err.message : 'sem conexão com o VPS';
      throw new TriadeApiError(
        message === 'Failed to fetch'
          ? 'sem conexão com o VPS (túnel SSH indisponível ou CORS recusado)'
          : message,
        0
      );
    } finally {
      window.clearTimeout(timer);
    }
  }

  async getHealth(): Promise<HealthResponse> {
    return mapHealth(await this.requestJson<unknown>('/api/v2/health'));
  }

  async getStatus(): Promise<StatusResponse> {
    const status = mapStatus(await this.requestJson<unknown>('/api/v2/status'));
    this.agentModes = {
      b3: status.agents.b3.live_enabled ? 'live' : 'paper',
      nasdaq: status.agents.nasdaq.live_enabled ? 'live' : 'paper',
      crypto: status.agents.crypto.live_enabled ? 'live' : 'paper',
    };
    return status;
  }

  async getInfra(): Promise<InfraResponse> {
    return mapInfra(await this.requestJson<unknown>('/api/v2/infra'));
  }

  /** Status enriched with bridge ports from `/api/v2/infra` when that call succeeds. */
  async getStatusWithInfra(): Promise<{ status: StatusResponse; infra: InfraResponse | null; infraError: string | null }> {
    const status = await this.getStatus();
    try {
      const infra = await this.getInfra();
      return { status: attachInfra(status, infra), infra, infraError: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'infra indisponível';
      return { status, infra: null, infraError: message };
    }
  }

  async getTimeline(params?: {
    agent?: AgentId | 'all';
    since?: string;
    until?: string;
    after?: string | null;
    limit?: number;
    mode?: 'all' | 'live' | 'paper';
    event?: string;
    source?: string;
  }): Promise<TimelineResponse> {
    const qs = buildQuery(
      {
        agent: params?.agent,
        since: params?.since,
        until: params?.until,
        after: params?.after,
        limit: params?.limit,
        mode: params?.mode,
        event: params?.event,
        source: params?.source,
      },
      { keepAll: true }
    );
    return mapTimeline(await this.requestJson<unknown>(`/api/v2/timeline${qs}`));
  }

  async getTrades(params?: {
    agent?: AgentId | 'all';
    mode?: 'all' | 'live' | 'paper';
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<TimelineEvent[]> {
    const qs = buildQuery(
      {
        agent: params?.agent,
        mode: params?.mode,
        since: params?.since,
        until: params?.until,
        limit: params?.limit ?? 1000,
      },
      { keepAll: true }
    );
    return mapTrades(await this.requestJson<unknown>(`/api/v2/trades${qs}`));
  }

  async getPnl(
    agent: AgentId,
    params?: { mode?: 'live' | 'paper' | 'all'; since?: string; until?: string; limit?: number }
  ): Promise<PnlResponse> {
    const qs = buildQuery({
      mode: params?.mode,
      since: params?.since,
      until: params?.until,
      limit: params?.limit ?? 1000,
    });
    return mapPnl(await this.requestJson<unknown>(`/api/v2/agents/${agent}/pnl${qs}`), agent);
  }

  async getAnalystEvents(agent?: AgentId | 'all'): Promise<AnalystEvent[]> {
    const qs = buildQuery({ agent });
    const payload = mapAnalystEvents(await this.requestJson<unknown>(`/api/v2/events${qs}`));
    return payload.events;
  }

  async getRisk(agent: AgentId, profile?: 'micro_live' | 'research'): Promise<RiskResponse> {
    const qs = profile ? `?profile=${profile}` : '';
    return mapRisk(await this.requestJson<unknown>(`/api/v2/agents/${agent}/risk${qs}`), agent);
  }

  async getBacktests(): Promise<BacktestReport[]> {
    return mapBacktests(await this.requestJson<unknown>('/api/v2/backtests'));
  }

  async getStrategies(): Promise<Partial<Record<AgentId, StrategyConfig>>> {
    const ids: AgentId[] = ['b3', 'nasdaq', 'crypto'];
    const entries = await Promise.all(
      ids.map(async (id) => {
        try {
          const raw = await this.requestJson<unknown>(`/api/v2/config/${id}`);
          return [id, mapStrategy(raw, id)] as const;
        } catch {
          return [id, null] as const;
        }
      })
    );
    const out: Partial<Record<AgentId, StrategyConfig>> = {};
    for (const [id, config] of entries) {
      if (config) out[id] = config;
    }
    return out;
  }

  async getTelegramFlags(): Promise<Record<AgentId, boolean | null>> {
    const ids: AgentId[] = ['b3', 'nasdaq', 'crypto'];
    const entries = await Promise.all(
      ids.map(async (id) => {
        try {
          const raw = await this.requestJson<unknown>(`/api/v2/config/${id}`);
          return [id, telegramFlagFromConfig(raw)] as const;
        } catch {
          return [id, null] as const;
        }
      })
    );
    return Object.fromEntries(entries) as Record<AgentId, boolean | null>;
  }

  async getAlerts(): Promise<AlertsPayload> {
    const payload = mapAlerts(
      await this.requestJson<unknown>('/api/v2/alerts'),
      this.agentModes
    );
    return {
      ...payload,
      alerts: payload.alerts.map((alert) =>
        this.localAck.has(alert.id) ? { ...alert, acknowledged: true } : alert
      ),
    };
  }

  /** Local hide only. The server does not persist acknowledgements. */
  ackAlertLocal(id: string, current: AlertsPayload): AlertsPayload {
    this.localAck.add(id);
    return {
      ...current,
      alerts: current.alerts.map((alert) =>
        alert.id === id ? { ...alert, acknowledged: true } : alert
      ),
    };
  }

  async getLogs(agent: AgentId, mode: 'effective' | 'live' | 'paper' = 'effective'): Promise<LogsPayload> {
    const qs = buildQuery({ agent, mode, n: 100 }, { keepAll: true });
    return mapLogs(await this.requestJson<unknown>(`/api/v2/logs${qs}`), agent);
  }

  async getRecentBars(
    agent: AgentId,
    symbol?: string,
    timeframe: '1m' | '5m' | '15m' = '5m'
  ): Promise<RecentBarsResponse> {
    const qs = buildQuery({ symbol, tf: timeframe }, { keepAll: true });
    return mapBars(await this.requestJson<unknown>(`/api/v2/agents/${agent}/bars${qs}`), agent, timeframe);
  }

  async getAudit(): Promise<AuditPayload> {
    return mapAudit(await this.requestJson<unknown>('/api/v2/audit'));
  }

  /**
   * Control routes are intentionally not called. The live B3 account must not
   * receive kill/flatten/start from an unauthenticated panel.
   */
  refuseDangerAction(): never {
    throw new TriadeApiError(READONLY_CONTROL_NOTE, 405);
  }

  subscribeStream(handlers: {
    onConnectionChange: (state: ConnectionState) => void;
    onJournalEvent: (ev: TimelineEvent) => void;
    onStatusTick: () => void;
  }): () => void {
    let stopped = false;
    let es: EventSource | null = null;
    let pollTimer: number | null = null;
    let retryTimer: number | null = null;
    let attempt = 0;

    const stopPoll = () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startPoll = () => {
      if (pollTimer !== null || stopped) return;
      handlers.onConnectionChange('polling');
      pollTimer = window.setInterval(() => {
        handlers.onStatusTick();
      }, 5000);
    };

    const scheduleRetry = () => {
      if (stopped || retryTimer !== null) return;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (stopped) return;
      if (typeof EventSource === 'undefined') {
        startPoll();
        return;
      }
      try {
        es = new EventSource(`${this.apiBase}/api/v2/stream?agent=all`);
      } catch {
        handlers.onConnectionChange('reconnecting');
        startPoll();
        attempt += 1;
        scheduleRetry();
        return;
      }
      es.addEventListener('hello', () => {
        attempt = 0;
        stopPoll();
        handlers.onConnectionChange('sse');
      });
      es.addEventListener('journal', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as unknown;
          const mapped = mapTimeline({ events: [data], ok: true }).events[0];
          if (mapped) handlers.onJournalEvent(mapped);
        } catch {
          // ignore malformed SSE frame
        }
      });
      es.addEventListener('status', () => {
        handlers.onStatusTick();
      });
      es.addEventListener('ping', () => {
        if (attempt === 0) handlers.onConnectionChange('sse');
      });
      es.onerror = () => {
        handlers.onConnectionChange('reconnecting');
        es?.close();
        es = null;
        attempt += 1;
        if (attempt >= 2) startPoll();
        scheduleRetry();
      };
    };

    connect();

    return () => {
      stopped = true;
      es?.close();
      stopPoll();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }
}

export const triadeApi = new TriadeApiClient();

export { annotateAlertModes, attachInfra };
