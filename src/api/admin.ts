import { login as loginRequest, logout as logoutRequest, restoreSession } from './auth';
import { ApiError, api, FetchLike } from './http';
import { AdminApiError } from './adminProtocol';
import {
  actionNeedsStepUp,
  AuthSession,
  getAuthSession,
  isSessionExpired,
  markUnauthenticated,
} from './sessionStore';
import {
  AdminAuditPayload,
  AdminSession,
  BinancePutResult,
  BinanceStatus,
  BinanceTestResponse,
  BinanceTestResult,
  FlattenResult,
  KillResult,
  LiveResult,
  RiskLimitsInput,
  RiskPayload,
  RiskPutResult,
} from './adminTypes';

export interface AdminClientOptions {
  fetchImpl?: FetchLike;
}

interface MemorySession {
  user: string;
  expiresAt: number;
  createdAt: string | null;
}

function asTestResult(value: unknown): BinanceTestResult | null {
  if (!value || typeof value !== 'object' || !('ok' in value)) return null;
  return value as BinanceTestResult;
}

function toAdminSession(session: AuthSession): AdminSession {
  return {
    ok: true,
    user: session.user,
    csrf_token: session.csrfToken,
    expires_at: session.expiresAt,
    created_at: session.createdAt ?? undefined,
    expires_at_iso: session.expiresAtIso ?? undefined,
    ttl_seconds: session.ttlSeconds ?? undefined,
    stepup_required_for: session.stepupRequiredFor ?? undefined,
  };
}

/**
 * Client for `/api/v2/admin`.
 * The session cookie is HttpOnly. CSRF stays in memory via the shared session.
 * Writes that the session lists in `stepup_required_for` send a fresh `X-TOTP`.
 */
export class AdminApiClient {
  private readonly fetchImpl?: FetchLike;

  constructor(options: AdminClientOptions = {}) {
    this.fetchImpl = options.fetchImpl;
  }

  get csrfReady(): boolean {
    return Boolean(getAuthSession()?.csrfToken);
  }

  get sessionSnapshot(): MemorySession | null {
    const session = getAuthSession();
    if (!session) return null;
    return {
      user: session.user,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }

  clearMemory(): void {
    markUnauthenticated();
  }

  isExpired(now = Date.now()): boolean {
    return isSessionExpired(getAuthSession(), now);
  }

  private async send<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT',
    options: { body?: unknown; totp?: string } = {}
  ): Promise<T> {
    const session = getAuthSession();
    const needsTotp =
      method !== 'GET' && actionNeedsStepUp(method, path, session?.stepupRequiredFor ?? null);
    if (needsTotp && !/^\d{6}$/.test((options.totp ?? '').trim())) {
      throw new AdminApiError('Informe um código 2FA de 6 dígitos.', 403, 'totp', [], null, null);
    }
    try {
      return await api<T>(path, {
        method,
        body: options.body,
        totp: needsTotp ? options.totp : undefined,
        fetchImpl: this.fetchImpl,
      });
    } catch (err) {
      if (err instanceof AdminApiError) throw err;
      if (err instanceof ApiError) {
        throw new AdminApiError(
          err.message,
          err.status,
          err.code,
          err.missing,
          asTestResult(err.result),
          err.body
        );
      }
      throw err;
    }
  }

  async login(username: string, password: string, totp: string): Promise<AdminSession> {
    try {
      const session = await loginRequest(username, password, totp, this.fetchImpl);
      return toAdminSession(session);
    } catch (err) {
      if (err instanceof ApiError) {
        throw new AdminApiError(err.message, err.status, err.code, err.missing, null, err.body);
      }
      throw err;
    }
  }

  async logout(): Promise<{ ok: true; message: string }> {
    try {
      return await logoutRequest(this.fetchImpl);
    } catch (err) {
      if (err instanceof ApiError) {
        throw new AdminApiError(err.message, err.status, err.code, err.missing, null, err.body);
      }
      throw err;
    }
  }

  async getSession(): Promise<AdminSession> {
    try {
      const session = await restoreSession(this.fetchImpl);
      if (!session) {
        throw new AdminApiError('sessão ausente ou expirada', 401, 'unauthenticated', [], null, null);
      }
      return toAdminSession(session);
    } catch (err) {
      if (err instanceof AdminApiError) throw err;
      if (err instanceof ApiError) {
        throw new AdminApiError(err.message, err.status, err.code, err.missing, null, err.body);
      }
      throw err;
    }
  }

  getBinance(): Promise<BinanceStatus> {
    return this.send<BinanceStatus>('/api/v2/admin/binance', 'GET');
  }

  putBinance(apiKey: string, apiSecret: string, totp: string): Promise<BinancePutResult> {
    return this.send<BinancePutResult>('/api/v2/admin/binance', 'PUT', {
      body: { api_key: apiKey, api_secret: apiSecret },
      totp,
    });
  }

  testBinance(totp: string): Promise<BinanceTestResponse> {
    return this.send<BinanceTestResponse>('/api/v2/admin/binance/test', 'POST', {
      body: {},
      totp,
    });
  }

  getRisk(): Promise<RiskPayload> {
    return this.send<RiskPayload>('/api/v2/admin/crypto/risk', 'GET');
  }

  putRisk(limits: RiskLimitsInput, totp: string): Promise<RiskPutResult> {
    return this.send<RiskPutResult>('/api/v2/admin/crypto/risk', 'PUT', {
      body: limits,
      totp,
    });
  }

  setCryptoLive(enabled: boolean, confirmation: string, totp: string): Promise<LiveResult> {
    return this.send<LiveResult>('/api/v2/admin/crypto/live', 'POST', {
      body: { enabled, confirmation },
      totp,
    });
  }

  killCrypto(totp: string): Promise<KillResult> {
    return this.send<KillResult>('/api/v2/admin/crypto/kill', 'POST', {
      body: {},
      totp,
    });
  }

  flattenCrypto(totp: string): Promise<FlattenResult> {
    return this.send<FlattenResult>('/api/v2/admin/crypto/flatten', 'POST', {
      body: {},
      totp,
    });
  }

  killB3(totp: string): Promise<KillResult> {
    return this.send<KillResult>('/api/v2/admin/b3/kill', 'POST', {
      body: {},
      totp,
    });
  }

  getAudit(): Promise<AdminAuditPayload> {
    return this.send<AdminAuditPayload>('/api/v2/admin/audit', 'GET');
  }
}

export const adminApi = new AdminApiClient();
