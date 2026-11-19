import {
  adoptSession,
  markUnauthenticated,
  readCsrfToken,
  SessionBody,
} from './sessionStore';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly missing: string[];
  readonly result: unknown;
  readonly body: unknown;

  constructor(
    message: string,
    status: number,
    code: string | null,
    missing: string[],
    result: unknown,
    body: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.missing = missing;
    this.result = result;
    this.body = body;
  }

  get unauthenticated(): boolean {
    return this.status === 401 && this.code === 'unauthenticated';
  }
}

export interface ApiRequest {
  method?: string;
  body?: unknown;
  totp?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** 401 unauthenticated is thrown but does not flip the app to the login screen. */
  quietUnauth?: boolean;
  csrfRetried?: boolean;
  /** Login has no CSRF token yet. */
  skipCsrf?: boolean;
  fetchImpl?: FetchLike;
}

let fetchOverride: FetchLike | null = null;

export function setApiFetchForTests(impl: FetchLike | null): void {
  fetchOverride = impl;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function toApiError(status: number, json: unknown): ApiError {
  const record = asRecord(json);
  const message =
    record && typeof record.error === 'string' && record.error
      ? record.error
      : `Erro HTTP ${status}`;
  const code = record && typeof record.code === 'string' ? record.code : null;
  const missing =
    record && Array.isArray(record.missing)
      ? record.missing.filter((item): item is string => typeof item === 'string')
      : [];
  const result = record && 'result' in record ? record.result : null;
  return new ApiError(message, status, code, missing, result, json);
}

async function refreshSession(fetchImpl?: FetchLike): Promise<boolean> {
  try {
    const body = await api<SessionBody>('/api/v2/auth/session', {
      method: 'GET',
      quietUnauth: true,
      csrfRetried: true,
      fetchImpl,
    });
    adoptSession(body);
    return Boolean(readCsrfToken());
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      markUnauthenticated();
    }
    return false;
  }
}

/**
 * One fetch wrapper for `/api/v2`.
 * Relative URL, `credentials: 'same-origin'`, `cache: 'no-store'`.
 * POST and PUT send `X-CSRF-Token` from memory. A 403 `csrf` refetches the
 * session and retries once. A 401 `unauthenticated` drops the session once.
 */
export async function api<T>(path: string, options: ApiRequest = {}): Promise<T> {
  if (!path.startsWith('/')) {
    throw new ApiError('A API só aceita URL relativa.', 0, null, [], null, null);
  }
  const method = (options.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const write = method === 'POST' || method === 'PUT';
  if (write && !options.skipCsrf) {
    let csrf = readCsrfToken();
    if (!csrf && !options.csrfRetried) {
      const refreshed = await refreshSession(options.fetchImpl);
      if (refreshed) return api<T>(path, { ...options, csrfRetried: true });
      csrf = readCsrfToken();
    }
    if (!csrf) {
      throw new ApiError(
        'Token CSRF ausente na memória. Entre de novo.',
        403,
        'csrf',
        [],
        null,
        null
      );
    }
    headers['X-CSRF-Token'] = csrf;
  }

  const totp = (options.totp ?? '').trim();
  if (totp) headers['X-TOTP'] = totp;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
  const fetchImpl = options.fetchImpl ?? fetchOverride ?? fetch;
  try {
    const response = await fetchImpl(path, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });
    const json = (await response.json().catch(() => ({
      ok: false,
      error: `HTTP ${response.status}`,
    }))) as unknown;
    if (!response.ok) {
      const failure = toApiError(response.status, json);
      if (
        failure.status === 403 &&
        failure.code === 'csrf' &&
        write &&
        !options.skipCsrf &&
        !options.csrfRetried
      ) {
        const refreshed = await refreshSession(options.fetchImpl);
        if (refreshed) return api<T>(path, { ...options, csrfRetried: true });
      }
      if (failure.unauthenticated && !options.quietUnauth) markUnauthenticated();
      throw failure;
    }
    return json as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('sem conexão com o VPS (tempo esgotado)', 0, null, [], null, null);
    }
    const message = err instanceof Error ? err.message : 'sem conexão com o VPS';
    throw new ApiError(
      message === 'Failed to fetch'
        ? 'sem conexão com o VPS (túnel SSH indisponível ou CORS recusado)'
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
