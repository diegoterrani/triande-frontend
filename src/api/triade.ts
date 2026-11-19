import {
  BACKTEST_REPORTS,
  STRATEGY_CONFIGS,
  previewStore,
} from '../data/specPreviewData';
import {
  ActionResponse,
  AgentId,
  AlertItem,
  AnalystEvent,
  ApiTokenRecord,
  AuditEntry,
  BacktestReport,
  ConnectionState,
  DangerActionPayload,
  HealthResponse,
  InfraResponse,
  LogEntry,
  PreviewScenario,
  RecentBarsResponse,
  RiskResponse,
  StatusResponse,
  StrategyConfig,
  TimelineEvent,
  TimelineResponse,
  UserOperator,
  UserRole,
} from '../types/triade';

export interface TriadeClientConfig {
  apiBase: string;
  token: string;
}

const ENV_API_BASE = (import.meta.env.VITE_TRIADE_API_BASE as string | undefined)?.trim() || '';
const ENV_TOKEN = (import.meta.env.VITE_TRIADE_TOKEN as string | undefined)?.trim() || '';

class TriadeApiClient {
  private apiBase: string = ENV_API_BASE;
  private token: string = ENV_TOKEN;

  isUsingRemoteVps(): boolean {
    return Boolean(this.apiBase);
  }

  getConfig(): TriadeClientConfig {
    return {
      apiBase: this.apiBase,
      token: this.token ? '••••••••' : '',
    };
  }

  setConnection(apiBase: string, token: string): void {
    this.apiBase = apiBase.trim().replace(/\/+$/, '');
    if (token.trim()) {
      this.token = token.trim();
    }
  }

  clearToken(): void {
    this.token = '';
  }

  hasToken(): boolean {
    return Boolean(this.token);
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${this.apiBase}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
      if (!res.ok) {
        throw new Error(json?.error || `Erro HTTP ${res.status}`);
      }
      return json as T;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async getHealth(): Promise<HealthResponse> {
    if (!this.isUsingRemoteVps()) {
      if (previewStore.isOffline()) {
        throw new Error('sem conexão com o VPS (127.0.0.1:8765 indisponível)');
      }
      return {
        ok: true,
        bind: '127.0.0.1:8765',
        readonly: false,
        uptime_seconds: 18420,
        version: '1.0.0',
        auth_required: true,
      };
    }
    return this.requestJson<HealthResponse>('/api/health');
  }

  async getStatus(): Promise<StatusResponse> {
    if (!this.isUsingRemoteVps()) {
      if (previewStore.isOffline()) {
        throw new Error('sem conexão com o VPS (timeout em /api/status)');
      }
      return previewStore.getStatus();
    }
    try {
      return await this.requestJson<StatusResponse>('/api/v2/status');
    } catch {
      return this.requestJson<StatusResponse>('/api/status');
    }
  }

  async getTimeline(params?: {
    agent?: AgentId | 'all';
    since?: string;
    until?: string;
    after?: string | null;
    limit?: number;
    mode?: 'all' | 'live' | 'paper';
  }): Promise<TimelineResponse> {
    if (!this.isUsingRemoteVps()) {
      if (previewStore.isOffline()) {
        throw new Error('sem conexão com o VPS (/api/timeline indisponível)');
      }
      return previewStore.getTimeline(params);
    }
    const qs = new URLSearchParams();
    if (params?.agent && params.agent !== 'all') qs.set('agent', params.agent);
    if (params?.since) qs.set('since', params.since);
    if (params?.until) qs.set('until', params.until);
    if (params?.after) qs.set('after', params.after);
    if (params?.limit) qs.set('limit', String(params.limit));
    return this.requestJson<TimelineResponse>(`/api/timeline?${qs.toString()}`);
  }

  async getAnalystEvents(agent?: AgentId | 'all'): Promise<AnalystEvent[]> {
    if (!this.isUsingRemoteVps()) {
      if (previewStore.isOffline()) return [];
      return previewStore.getAnalystEvents(agent);
    }
    const qs = agent && agent !== 'all' ? `?agent=${agent}` : '';
    const res = await this.requestJson<{ events: AnalystEvent[] }>(`/api/v2/events${qs}`);
    return res.events ?? [];
  }

  async getRisk(agent: AgentId, profile?: 'micro_live' | 'research'): Promise<RiskResponse> {
    if (!this.isUsingRemoteVps()) {
      if (previewStore.isOffline()) {
        throw new Error('sem conexão com o VPS (/api/v2/agents/risk indisponível)');
      }
      return previewStore.getRisk(agent, profile);
    }
    const qs = profile ? `?profile=${profile}` : '';
    return this.requestJson<RiskResponse>(`/api/v2/agents/${agent}/risk${qs}`);
  }

  async getBacktests(): Promise<BacktestReport[]> {
    if (!this.isUsingRemoteVps()) {
      if (previewStore.isOffline()) {
        throw new Error('sem conexão com o VPS');
      }
      return BACKTEST_REPORTS;
    }
    const res = await this.requestJson<{ reports: BacktestReport[] }>('/api/v2/backtests');
    return res.reports ?? [];
  }

  async getStrategies(): Promise<Record<AgentId, StrategyConfig>> {
    if (!this.isUsingRemoteVps()) {
      return STRATEGY_CONFIGS;
    }
    const [b3, nasdaq, crypto] = await Promise.all([
      this.requestJson<StrategyConfig>('/api/v2/config/b3'),
      this.requestJson<StrategyConfig>('/api/v2/config/nasdaq'),
      this.requestJson<StrategyConfig>('/api/v2/config/crypto'),
    ]);
    return { b3, nasdaq, crypto };
  }

  async getInfra(): Promise<InfraResponse> {
    if (!this.isUsingRemoteVps()) {
      if (previewStore.isOffline()) {
        throw new Error('sem conexão com o VPS (/api/v2/infra)');
      }
      return previewStore.getInfra();
    }
    return this.requestJson<InfraResponse>('/api/v2/infra');
  }

  async getAlerts(): Promise<AlertItem[]> {
    if (!this.isUsingRemoteVps()) {
      return previewStore.getAlerts();
    }
    return previewStore.getAlerts();
  }

  ackAlert(id: string): AlertItem[] {
    return previewStore.acknowledgeAlert(id);
  }

  async getLogs(agent: AgentId, mode: 'effective' | 'live' | 'paper' = 'effective'): Promise<LogEntry[]> {
    if (!this.isUsingRemoteVps()) {
      return previewStore.getLogs(agent, mode);
    }
    const res = await this.requestJson<{ logs: LogEntry[] }>(
      `/api/v2/logs?agent=${agent}&mode=${mode}&n=100`
    );
    return res.logs ?? [];
  }

  getSystemJournal(agent: AgentId): string[] {
    return previewStore.getSystemJournalLogs(agent);
  }

  async getRecentBars(
    agent: AgentId,
    symbol?: string,
    timeframe: '1m' | '5m' | '15m' = '5m'
  ): Promise<RecentBarsResponse> {
    if (!this.isUsingRemoteVps()) {
      if (previewStore.isOffline()) {
        throw new Error('sem conexão com o VPS (recent-bars.json indisponível)');
      }
      return previewStore.getRecentBars(agent, symbol, timeframe);
    }
    const qs = new URLSearchParams();
    if (symbol) qs.set('symbol', symbol);
    qs.set('tf', timeframe);
    return this.requestJson<RecentBarsResponse>(`/api/v2/agents/${agent}/bars?${qs.toString()}`);
  }

  async getAudit(): Promise<AuditEntry[]> {
    if (!this.isUsingRemoteVps()) {
      return previewStore.getAudit();
    }
    const res = await this.requestJson<{ entries: AuditEntry[] }>('/api/v2/audit');
    return res.entries ?? [];
  }

  getUsers(): UserOperator[] {
    return previewStore.getUsers();
  }

  getTokens(): ApiTokenRecord[] {
    return previewStore.getTokens();
  }

  issueToken(label: string, role: UserRole): { record: ApiTokenRecord; plaintextOnce: string } {
    return previewStore.issueToken(label, role);
  }

  revokeToken(id: string): ApiTokenRecord[] {
    return previewStore.revokeToken(id);
  }

  getTelegramEnabled(): boolean {
    return previewStore.getTelegramEnabled();
  }

  setTelegramEnabled(val: boolean): boolean {
    return previewStore.setTelegramEnabled(val);
  }

  setPreviewScenario(scenario: PreviewScenario): void {
    previewStore.setScenario(scenario);
  }

  getPreviewScenario(): PreviewScenario {
    return previewStore.getScenario();
  }

  async executeDangerAction(
    payload: DangerActionPayload,
    actor: { name: string; role: UserRole }
  ): Promise<ActionResponse> {
    if (!this.isUsingRemoteVps()) {
      return previewStore.executeDangerAction(payload, actor);
    }

    let endpoint = '';
    if (payload.action === 'kill_all') endpoint = '/api/v2/kill-all';
    else if (payload.action === 'kill') endpoint = `/api/v2/agents/${payload.agent}/kill`;
    else if (payload.action === 'flatten') endpoint = `/api/v2/agents/${payload.agent}/flatten`;
    else if (payload.action === 'kill_clear') endpoint = `/api/v2/agents/${payload.agent}/kill/clear`;
    else if (payload.action === 'reset_halt') endpoint = `/api/v2/agents/${payload.agent}/reset-halt`;
    else if (payload.action === 'unit_stop') endpoint = `/api/v2/agents/${payload.agent}/unit/stop`;
    else if (payload.action === 'unit_start') endpoint = `/api/v2/agents/${payload.agent}/unit/start`;

    return this.requestJson<ActionResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        confirm_agent: payload.confirm_agent,
        confirm_word: payload.confirm_word,
        reason: payload.reason,
        otp: payload.otp,
      }),
    });
  }

  subscribeStream(handlers: {
    onConnectionChange: (state: ConnectionState) => void;
    onJournalEvent: (ev: TimelineEvent) => void;
    onStatusTick: () => void;
  }): () => void {
    if (!this.isUsingRemoteVps()) {
      if (previewStore.isOffline()) {
        handlers.onConnectionChange('offline');
        return () => {};
      }
      handlers.onConnectionChange('sse');
      const timer = window.setInterval(() => {
        if (previewStore.isOffline()) {
          handlers.onConnectionChange('offline');
        } else {
          handlers.onConnectionChange('sse');
          handlers.onStatusTick();
        }
      }, 5000);
      return () => window.clearInterval(timer);
    }

    let es: EventSource | null = null;
    let pollTimer: number | null = null;

    const startPollingFallback = () => {
      if (pollTimer !== null) return;
      handlers.onConnectionChange('polling');
      pollTimer = window.setInterval(() => {
        handlers.onStatusTick();
      }, 5000);
    };

    try {
      es = new EventSource(`${this.apiBase}/api/v2/stream?agent=all`);
      es.addEventListener('hello', () => {
        handlers.onConnectionChange('sse');
      });
      es.addEventListener('journal', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data) as TimelineEvent;
          handlers.onJournalEvent(data);
        } catch {
          // ignore malformed SSE frame
        }
      });
      es.addEventListener('status', () => {
        handlers.onStatusTick();
      });
      es.onerror = () => {
        handlers.onConnectionChange('reconnecting');
        es?.close();
        startPollingFallback();
      };
    } catch {
      startPollingFallback();
    }

    return () => {
      es?.close();
      if (pollTimer !== null) window.clearInterval(pollTimer);
    };
  }
}

export const triadeApi = new TriadeApiClient();
