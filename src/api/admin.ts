import { readApiBase } from './env';
import { AdminApiError, readAdminFailure } from './adminProtocol';
import {
  AdminAuditPayload,
  AdminSession,
  BinancePutResult,
  BinanceStatus,
  BinanceTestResponse,
  FlattenResult,
  KillResult,
  LiveResult,
  RiskLimitsInput,
  RiskPayload,
  RiskPutResult,
} from './adminTypes';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface AdminClientOptions {
  apiBase?: string;
  fetchImpl?: FetchLike;
}

interface MemorySession {
  user: string;
  expiresAt: number;
  createdAt: string | null;
}

/**
 * Client for `/api/v2/admin` only.
 * The session cookie is HttpOnly (the browser stores it; this class never reads it).
 * `csrf_token` stays in this object. Nothing here touches localStorage or sessionStorage.
 * Secrets passed into write methods are sent once and not retained.
 */
export class AdminApiClient {
  private readonly apiBase: string;
  private readonly fetchImpl: FetchLike;
  private csrfToken: string | null = null;
  private session: MemorySession | null = null;

  constructor(options: AdminClientOptions = {}) {
    this.apiBase = (options.apiBase ?? readApiBase()).replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  get csrfReady(): boolean {
    return Boolean(this.csrfToken);
  }

  get sessionSnapshot(): MemorySession | null {
    return this.session ? { ...this.session } : null;
  }

  clearMemory(): void {
    this.csrfToken = null;
    this.session = null;
  }

  isExpired(now = Date.now()): boolean {
    if (!this.session?.expiresAt) return !this.session;
    return now >= this.session.expiresAt * 1000;
  }

  private remember(body: {
    user?: string;
    csrf_token?: string;
    expires_at?: number;
    created_at?: string;
  }): void {
    if (typeof body.csrf_token === 'string' && body.csrf_token) {
      this.csrfToken = body.csrf_token;
    }
    if (typeof body.user === 'string' && body.user) {
      this.session = {
        user: body.user,
        expiresAt: typeof body.expires_at === 'number' ? body.expires_at : 0,
        createdAt: typeof body.created_at === 'string' ? body.created_at : this.session?.createdAt ?? null,
      };
    }
  }

  private async send<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT',
    options: { body?: unknown; totp?: string; withSessionHeaders?: boolean }
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.withSessionHeaders) {
      if (!this.csrfToken) {
        throw new AdminApiError(
          'Token CSRF ausente na memória. Entre de novo.',
          403,
          'csrf',
          [],
          null,
          null
        );
      }
      const totp = (options.totp ?? '').trim();
      if (!/^\d{6}$/.test(totp)) {
        throw new AdminApiError('Informe um código 2FA de 6 dígitos.', 403, 'totp', [], null, null);
      }
      headers['X-CSRF-Token'] = this.csrfToken;
      headers['X-TOTP'] = totp;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await this.fetchImpl(`${this.apiBase}${path}`, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
      const json = (await response.json().catch(() => ({
        ok: false,
        error: `HTTP ${response.status}`,
      }))) as unknown;
      if (!response.ok) {
        const failure = readAdminFailure(response.status, json);
        if (failure.unauthenticated) this.clearMemory();
        throw failure;
      }
      return json as T;
    } catch (err) {
      if (err instanceof AdminApiError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AdminApiError('Tempo esgotado ao falar com /api/v2/admin.', 0, null, [], null, null);
      }
      const message = err instanceof Error ? err.message : 'sem conexão';
      throw new AdminApiError(
        message === 'Failed to fetch'
          ? 'sem conexão com /api/v2/admin (rede, CORS ou túnel).'
          : message,
        0,
        null,
        [],
        null,
        null
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async login(username: string, password: string, totp: string): Promise<AdminSession> {
    const session = await this.send<AdminSession>('/api/v2/admin/login', 'POST', {
      body: { username, password, totp },
      withSessionHeaders: false,
    });
    this.remember(session);
    return session;
  }

  async logout(totp: string): Promise<{ ok: true; message: string }> {
    const result = await this.send<{ ok: true; message: string }>('/api/v2/admin/logout', 'POST', {
      body: {},
      totp,
      withSessionHeaders: true,
    });
    this.clearMemory();
    return result;
  }

  async getSession(): Promise<AdminSession> {
    const session = await this.send<AdminSession>('/api/v2/admin/session', 'GET', {});
    this.remember(session);
    return session;
  }

  getBinance(): Promise<BinanceStatus> {
    return this.send<BinanceStatus>('/api/v2/admin/binance', 'GET', {});
  }

  putBinance(apiKey: string, apiSecret: string, totp: string): Promise<BinancePutResult> {
    return this.send<BinancePutResult>('/api/v2/admin/binance', 'PUT', {
      body: { api_key: apiKey, api_secret: apiSecret },
      totp,
      withSessionHeaders: true,
    });
  }

  testBinance(totp: string): Promise<BinanceTestResponse> {
    return this.send<BinanceTestResponse>('/api/v2/admin/binance/test', 'POST', {
      body: {},
      totp,
      withSessionHeaders: true,
    });
  }

  getRisk(): Promise<RiskPayload> {
    return this.send<RiskPayload>('/api/v2/admin/crypto/risk', 'GET', {});
  }

  putRisk(limits: RiskLimitsInput, totp: string): Promise<RiskPutResult> {
    return this.send<RiskPutResult>('/api/v2/admin/crypto/risk', 'PUT', {
      body: limits,
      totp,
      withSessionHeaders: true,
    });
  }

  setCryptoLive(enabled: boolean, confirmation: string, totp: string): Promise<LiveResult> {
    return this.send<LiveResult>('/api/v2/admin/crypto/live', 'POST', {
      body: { enabled, confirmation },
      totp,
      withSessionHeaders: true,
    });
  }

  killCrypto(totp: string): Promise<KillResult> {
    return this.send<KillResult>('/api/v2/admin/crypto/kill', 'POST', {
      body: {},
      totp,
      withSessionHeaders: true,
    });
  }

  flattenCrypto(totp: string): Promise<FlattenResult> {
    return this.send<FlattenResult>('/api/v2/admin/crypto/flatten', 'POST', {
      body: {},
      totp,
      withSessionHeaders: true,
    });
  }

  killB3(totp: string): Promise<KillResult> {
    return this.send<KillResult>('/api/v2/admin/b3/kill', 'POST', {
      body: {},
      totp,
      withSessionHeaders: true,
    });
  }

  getAudit(): Promise<AdminAuditPayload> {
    return this.send<AdminAuditPayload>('/api/v2/admin/audit', 'GET', {});
  }
}

export const adminApi = new AdminApiClient();
