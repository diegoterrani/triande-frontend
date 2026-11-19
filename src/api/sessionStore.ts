/**
 * In-memory session for the TRIADE dashboard.
 * The browser keeps the HttpOnly cookie `triade_session`. This module keeps
 * only what the JSON body returned: user, csrf token, expiry and the step-up list.
 * Nothing here reads or writes localStorage or sessionStorage.
 */

export interface AuthSession {
  user: string;
  csrfToken: string;
  expiresAt: number;
  createdAt: string | null;
  expiresAtIso: string | null;
  ttlSeconds: number | null;
  /**
   * null when the server omitted `stepup_required_for`.
   * An empty array means no action asks for a fresh 2FA code.
   */
  stepupRequiredFor: string[] | null;
}

export interface SessionBody {
  user?: unknown;
  csrf_token?: unknown;
  expires_at?: unknown;
  created_at?: unknown;
  expires_at_iso?: unknown;
  ttl_seconds?: unknown;
  stepup_required_for?: unknown;
}

/** Used only when a session body does not say which writes need a fresh code. */
export const DEFAULT_STEPUP_ACTIONS = [
  'PUT /api/v2/admin/binance',
  'POST /api/v2/admin/binance/test',
  'PUT /api/v2/admin/crypto/risk',
  'POST /api/v2/admin/crypto/live',
  'POST /api/v2/admin/crypto/kill',
  'POST /api/v2/admin/crypto/flatten',
  'POST /api/v2/admin/b3/kill',
] as const;

export const LOGIN_FAILED_MESSAGE = 'usuário, senha ou código 2FA inválidos';
export const LOCKOUT_WARNING = '5 falhas em 10 minutos bloqueiam este IP por 1 hora.';

export function isCredentialFailure(status: number, code: string | null): boolean {
  return status === 401 && code === 'login_failed';
}

export function showLockoutWarning(consecutiveFailures: number): boolean {
  return consecutiveFailures >= 3;
}

export function actionNeedsStepUp(
  method: string,
  path: string,
  list: readonly string[] | null
): boolean {
  if (path === '/api/v2/auth/logout' || path === '/api/v2/admin/logout') return false;
  const needle = `${method.toUpperCase()} ${path}`;
  const source = list ?? DEFAULT_STEPUP_ACTIONS;
  return source.some((item) => item.trim() === needle);
}

type Listener = (session: AuthSession | null) => void;

let current: AuthSession | null = null;
let signedOut = false;
let epoch = 0;
const listeners = new Set<Listener>();

export function authEpoch(): number {
  return epoch;
}

export function readCsrfToken(): string | null {
  const token = current?.csrfToken;
  return token ? token : null;
}

export function getAuthSession(): AuthSession | null {
  if (!current) return null;
  return {
    ...current,
    stepupRequiredFor: current.stepupRequiredFor ? [...current.stepupRequiredFor] : null,
  };
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  const snapshot = getAuthSession();
  for (const listener of listeners) listener(snapshot);
}

export function adoptSession(body: SessionBody): AuthSession {
  const wasOut = signedOut || current === null;
  const stepup = Array.isArray(body.stepup_required_for)
    ? body.stepup_required_for.filter((item): item is string => typeof item === 'string')
    : null;
  current = {
    user: typeof body.user === 'string' ? body.user : '',
    csrfToken: typeof body.csrf_token === 'string' ? body.csrf_token : '',
    expiresAt: typeof body.expires_at === 'number' ? body.expires_at : 0,
    createdAt: typeof body.created_at === 'string' ? body.created_at : null,
    expiresAtIso: typeof body.expires_at_iso === 'string' ? body.expires_at_iso : null,
    ttlSeconds: typeof body.ttl_seconds === 'number' ? body.ttl_seconds : null,
    stepupRequiredFor: stepup,
  };
  signedOut = false;
  if (wasOut) epoch += 1;
  emit();
  return getAuthSession()!;
}

/**
 * Enter the logged-out state a single time.
 * Later 401s with the same code do not notify again until the next login.
 */
export function markUnauthenticated(): void {
  current = null;
  if (signedOut) return;
  signedOut = true;
  epoch += 1;
  emit();
}

export function isSessionExpired(session: AuthSession | null, now = Date.now()): boolean {
  if (!session?.expiresAt) return session == null;
  return now >= session.expiresAt * 1000;
}

export function resetAuthStateForTests(): void {
  current = null;
  signedOut = false;
  epoch = 0;
  listeners.clear();
}
