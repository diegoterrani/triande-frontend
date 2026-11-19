import { ApiError, api, FetchLike } from './http';
import {
  adoptSession,
  AuthSession,
  getAuthSession,
  markUnauthenticated,
  SessionBody,
} from './sessionStore';

export async function restoreSession(fetchImpl?: FetchLike): Promise<AuthSession | null> {
  try {
    const body = await api<SessionBody>('/api/v2/auth/session', {
      method: 'GET',
      quietUnauth: true,
      fetchImpl,
    });
    return adoptSession(body);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      markUnauthenticated();
      return null;
    }
    throw err;
  }
}

export async function login(
  username: string,
  password: string,
  totp: string,
  fetchImpl?: FetchLike
): Promise<AuthSession> {
  const body = await api<SessionBody>('/api/v2/auth/login', {
    method: 'POST',
    body: { username, password, totp },
    skipCsrf: true,
    fetchImpl,
  });
  return adoptSession(body);
}

export async function logout(fetchImpl?: FetchLike): Promise<{ ok: true; message: string }> {
  const result = await api<{ ok: true; message: string }>('/api/v2/auth/logout', {
    method: 'POST',
    body: {},
    fetchImpl,
  });
  markUnauthenticated();
  return result;
}

/** True when the cookie session is still valid. Does not loop back into the stream. */
export async function probeSession(fetchImpl?: FetchLike): Promise<boolean> {
  try {
    const body = await api<SessionBody>('/api/v2/auth/session', {
      method: 'GET',
      quietUnauth: true,
      fetchImpl,
    });
    adoptSession(body);
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return false;
    return getAuthSession() !== null;
  }
}
