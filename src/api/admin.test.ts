import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { beforeEach, describe, it } from 'node:test';
import { AdminApiClient } from './admin.ts';
import { setApiFetchForTests } from './http.ts';
import {
  actionNeedsStepUp,
  getAuthSession,
  isCredentialFailure,
  LOCKOUT_WARNING,
  LOGIN_FAILED_MESSAGE,
  resetAuthStateForTests,
  showLockoutWarning,
  subscribeAuth,
} from './sessionStore.ts';
import { setStreamSourceFactoryForTests, triadeApi } from './triade.ts';
import {
  AdminApiError,
  confirmationMatches,
  cryptoLiveStamp,
  draftFromLimits,
  formatAdminError,
  livePrerequisites,
  redactAuditValue,
  validateRiskDraft,
  withdrawalsBlocked,
} from './adminProtocol.ts';
import { DISABLE_CRYPTO_LIVE, ENABLE_CRYPTO_LIVE, RiskBounds, RiskPayload } from './adminTypes.ts';

const bounds: RiskBounds = {
  max_capital: { min: 100, max: 50000 },
  max_order_size: { min: 10, max: 20000 },
  daily_loss_limit: { min: 10, max: 5000 },
  max_trades_per_day: { min: 1, max: 20 },
  max_open_positions: { min: 1, max: 3 },
  max_drawdown: { min: 0.01, max: 0.1 },
};

const universe = ['BTCUSDT', 'ETHUSDT'];

function validDraft() {
  return draftFromLimits(
    {
      max_capital: 500,
      max_order_size: 100,
      daily_loss_limit: 30,
      max_trades_per_day: 4,
      max_open_positions: 1,
      allowed_pairs: ['BTCUSDT', 'ETHUSDT'],
      max_drawdown: 0.06,
    },
    universe
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('validateRiskDraft', () => {
  it('accepts values inside the server bounds', () => {
    const result = validateRiskDraft(validDraft(), bounds, universe);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.limits.max_capital, 500);
      assert.deepEqual(result.limits.allowed_pairs, ['BTCUSDT', 'ETHUSDT']);
      assert.equal(result.limits.max_drawdown, 0.06);
    }
  });

  it('rejects a value outside the bounds and an empty pair list', () => {
    const draft = validDraft();
    draft.max_capital = '50';
    draft.max_drawdown = '0,5';
    draft.allowed_pairs = [];
    const result = validateRiskDraft(draft, bounds, universe);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errors.join('\n'), /max_capital fora dos limites/);
      assert.match(result.errors.join('\n'), /max_drawdown fora dos limites/);
      assert.match(result.errors.join('\n'), /allowed_pairs não pode ser vazio/);
    }
  });

  it('rejects a fractional trade count and a pair outside the universe', () => {
    const draft = validDraft();
    draft.max_trades_per_day = '4.5';
    draft.allowed_pairs = ['SOLUSDT'];
    const result = validateRiskDraft(draft, bounds, universe);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.fieldErrors.max_trades_per_day ?? '', /inteiro/);
      assert.match(result.fieldErrors.allowed_pairs ?? '', /BTCUSDT/);
    }
  });
});

describe('live confirmation and checklist', () => {
  it('requires the exact phrase', () => {
    assert.equal(confirmationMatches(true, ENABLE_CRYPTO_LIVE), true);
    assert.equal(confirmationMatches(true, 'enable crypto live'), false);
    assert.equal(confirmationMatches(true, 'ENABLE CRYPTO LIVE '), false);
    assert.equal(confirmationMatches(false, DISABLE_CRYPTO_LIVE), true);
    assert.equal(confirmationMatches(false, ENABLE_CRYPTO_LIVE), false);
  });

  it('keeps live disabled until credentials, test and admin limits exist', () => {
    const binance = {
      ok: true as const,
      configured: true,
      api_key_masked: '••••ABCD',
      last_test: {
        ok: true,
        tested_at: '2026-11-19T12:41:00-03:00',
        withdrawals_enabled: false,
        ip_restrict: true,
        enable_futures: true,
        enable_spot_and_margin_trading: true,
        enable_internal_transfer: null,
        error: null,
        ip_restriction_note: 'restrita',
      },
      ip_restriction_note: 'restrita',
      live_enabled_yaml: false,
      admin_live_enabled: false,
    };
    const risk: RiskPayload = {
      ok: true,
      limits: null,
      bounds,
      allowed_pairs: universe,
    };
    assert.equal(livePrerequisites(binance, risk).every((item) => item.ok), false);
    risk.limits = {
      ...validDraft(),
      max_capital: 500,
      max_order_size: 100,
      daily_loss_limit: 30,
      max_trades_per_day: 4,
      max_open_positions: 1,
      max_drawdown: 0.06,
      allowed_pairs: ['BTCUSDT'],
      source: 'admin',
    };
    assert.equal(livePrerequisites(binance, risk).every((item) => item.ok), true);
    binance.last_test.withdrawals_enabled = true;
    binance.last_test.ok = false;
    assert.equal(withdrawalsBlocked(binance.last_test), true);
    assert.equal(livePrerequisites(binance, risk).find((item) => item.id === 'test')?.ok, false);
    assert.equal(cryptoLiveStamp(binance), 'PAPER');
    binance.admin_live_enabled = true;
    assert.equal(cryptoLiveStamp(binance), 'DIVERGENTE');
  });
});

describe('redactAuditValue', () => {
  it('keeps the server mask and hides a raw secret field', () => {
    const redacted = redactAuditValue({
      api_key: '••••ABCD',
      api_secret: 'supersecretvalue1234567890',
      note: 'gravado',
    }) as Record<string, string>;
    assert.equal(redacted.api_key, '••••ABCD');
    assert.equal(redacted.api_secret, '***');
    assert.equal(redacted.note, 'gravado');
  });
});

describe('session helpers', () => {
  it('asks for a fresh code only on the listed writes', () => {
    assert.equal(actionNeedsStepUp('PUT', '/api/v2/admin/binance', ['PUT /api/v2/admin/binance']), true);
    assert.equal(actionNeedsStepUp('GET', '/api/v2/admin/binance', ['PUT /api/v2/admin/binance']), false);
    assert.equal(actionNeedsStepUp('POST', '/api/v2/auth/logout', ['POST /api/v2/auth/logout']), false);
    assert.equal(actionNeedsStepUp('POST', '/api/v2/admin/crypto/live', null), true);
    assert.equal(isCredentialFailure(401, 'login_failed'), true);
    assert.equal(isCredentialFailure(401, 'unauthenticated'), false);
    assert.equal(LOGIN_FAILED_MESSAGE, 'usuário, senha ou código 2FA inválidos');
    assert.equal(showLockoutWarning(2), false);
    assert.equal(showLockoutWarning(3), true);
    assert.match(LOCKOUT_WARNING, /1 hora/);
  });
});

describe('AdminApiClient', { concurrency: 1 }, () => {
  beforeEach(() => {
    resetAuthStateForTests();
    setApiFetchForTests(null);
    setStreamSourceFactoryForTests(null);
  });

  it('logs in with credentials and keeps CSRF only in memory', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    let storageWrites = 0;
    const previous = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem() {
          return null;
        },
        setItem() {
          storageWrites += 1;
        },
        removeItem() {
          storageWrites += 1;
        },
      },
    });
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return jsonResponse(200, {
        ok: true,
        user: 'diego',
        csrf_token: 'csrf-memory',
        expires_at: 4_000_000_000,
      });
    };
    try {
      const client = new AdminApiClient({ apiBase: 'http://stub', fetchImpl });
      await client.login('diego', 'segredo', '123456');
      assert.equal(client.csrfReady, true);
      assert.equal(client.sessionSnapshot?.user, 'diego');
      assert.equal(storageWrites, 0);
      assert.equal(JSON.stringify(getAuthSession()).includes('segredo'), false);
      assert.equal(JSON.stringify(getAuthSession()).includes('123456'), false);
      const init = calls[0].init;
      assert.equal(init.credentials, 'same-origin');
      assert.equal(init.cache, 'no-store');
      assert.equal(calls[0].url, '/api/v2/auth/login');
      assert.equal(init.method, 'POST');
      const headers = init.headers as Record<string, string>;
      assert.equal(headers['X-CSRF-Token'], undefined);
      assert.equal(headers['X-TOTP'], undefined);
      assert.deepEqual(JSON.parse(String(init.body)), {
        username: 'diego',
        password: 'segredo',
        totp: '123456',
      });
    } finally {
      if (previous) {
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
      }
    }
  });

  it('sends CSRF and a fresh TOTP header on writes, not in the JSON body', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      const url = String(input);
      if (url.endsWith('/login')) {
        return jsonResponse(200, { ok: true, user: 'diego', csrf_token: 'csrf-1', expires_at: 4_000_000_000 });
      }
      return jsonResponse(200, { ok: true, configured: true, api_key_masked: '••••ABCD', tested: false });
    };
    const client = new AdminApiClient({ apiBase: 'http://stub', fetchImpl });
    await client.login('diego', 'segredo', '111111');
    await client.putBinance('api-key-ABCD', 'api-secret-value', '222222');
    const init = calls[1].init;
    const headers = init.headers as Record<string, string>;
    assert.equal(headers['X-CSRF-Token'], 'csrf-1');
    assert.equal(headers['X-TOTP'], '222222');
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.cache, 'no-store');
    assert.deepEqual(JSON.parse(String(init.body)), {
      api_key: 'api-key-ABCD',
      api_secret: 'api-secret-value',
    });
    assert.equal(client.csrfReady, true);
  });

  it('does not attach session headers to authenticated GETs', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      const url = String(input);
      if (url.endsWith('/login')) {
        return jsonResponse(200, {
          ok: true,
          user: 'diego',
          csrf_token: 'csrf-1',
          expires_at: 4_000_000_000,
          created_at: '2026-11-19T12:40:00-03:00',
        });
      }
      return jsonResponse(200, {
        ok: true,
        user: 'diego',
        csrf_token: 'csrf-1',
        expires_at: 4_000_000_000,
        created_at: '2026-11-19T12:40:00-03:00',
      });
    };
    const client = new AdminApiClient({ apiBase: 'http://stub', fetchImpl });
    await client.login('diego', 'segredo', '111111');
    await client.getSession();
    const headers = calls[1].init.headers as Record<string, string>;
    assert.equal(headers['X-CSRF-Token'], undefined);
    assert.equal(headers['X-TOTP'], undefined);
    assert.equal(calls[1].url, '/api/v2/auth/session');
    assert.equal(calls[1].init.credentials, 'same-origin');
    assert.equal(calls[1].init.cache, 'no-store');
    assert.equal(calls[1].init.body, undefined);
  });

  it('clears memory on 401 unauthenticated and keeps the server text', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      if (String(input).endsWith('/login')) {
        return jsonResponse(200, { ok: true, user: 'diego', csrf_token: 'csrf-1', expires_at: 4_000_000_000 });
      }
      return jsonResponse(401, { ok: false, error: 'sessão ausente ou expirada', code: 'unauthenticated' });
    };
    const client = new AdminApiClient({ apiBase: 'http://stub', fetchImpl });
    await client.login('diego', 'segredo', '111111');
    await assert.rejects(() => client.getBinance(), (err: unknown) => {
      assert.ok(err instanceof AdminApiError);
      assert.equal(err.unauthenticated, true);
      assert.equal(err.message, 'sessão ausente ou expirada');
      assert.match(formatAdminError(err), /sessão ausente ou expirada/);
      return true;
    });
    assert.equal(client.csrfReady, false);
    assert.equal(client.sessionSnapshot, null);
  });

  it('surfaces totp reuse and live preconditions without dropping the session', async () => {
    let mode: 'totp' | 'preconditions' = 'totp';
    const fetchImpl: typeof fetch = async (input) => {
      if (String(input).endsWith('/login')) {
        return jsonResponse(200, { ok: true, user: 'diego', csrf_token: 'csrf-1', expires_at: 4_000_000_000 });
      }
      if (mode === 'totp') {
        return jsonResponse(403, {
          ok: false,
          error: 'código 2FA ausente, inválido ou reutilizado',
          code: 'totp',
        });
      }
      return jsonResponse(412, {
        ok: false,
        error: 'pré-requisitos do live não foram atendidos',
        code: 'preconditions',
        missing: ['teste de permissões', 'limites de risco'],
      });
    };
    const client = new AdminApiClient({ apiBase: 'http://stub', fetchImpl });
    await client.login('diego', 'segredo', '111111');
    await assert.rejects(() => client.killCrypto('222222'), (err: unknown) => {
      assert.ok(err instanceof AdminApiError);
      assert.equal(err.code, 'totp');
      assert.equal(err.unauthenticated, false);
      assert.match(formatAdminError(err), /código 2FA ausente, inválido ou reutilizado/);
      return true;
    });
    assert.equal(client.csrfReady, true);
    mode = 'preconditions';
    await assert.rejects(
      () => client.setCryptoLive(true, ENABLE_CRYPTO_LIVE, '333333'),
      (err: unknown) => {
        assert.ok(err instanceof AdminApiError);
        assert.equal(err.code, 'preconditions');
        assert.deepEqual(err.missing, ['teste de permissões', 'limites de risco']);
        assert.match(formatAdminError(err), /teste de permissões/);
        return true;
      }
    );
  });

  it('refuses a write locally when the code is not 6 digits', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      calls += 1;
      if (String(input).endsWith('/login')) {
        return jsonResponse(200, { ok: true, user: 'diego', csrf_token: 'csrf-1', expires_at: 4_000_000_000 });
      }
      return jsonResponse(500, { ok: false, error: 'não deveria chegar' });
    };
    const client = new AdminApiClient({ apiBase: 'http://stub', fetchImpl });
    await client.login('diego', 'segredo', '111111');
    await assert.rejects(() => client.putBinance('key', 'secret', '12345'), (err: unknown) => {
      assert.ok(err instanceof AdminApiError);
      assert.equal(err.code, 'totp');
      return true;
    });
    assert.equal(calls, 1);
  });

  it('logs out with CSRF and an empty body, without TOTP', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      if (String(input).endsWith('/login')) {
        return jsonResponse(200, { ok: true, user: 'diego', csrf_token: 'csrf-1', expires_at: 4_000_000_000 });
      }
      return jsonResponse(200, { ok: true, message: 'sessão encerrada' });
    };
    const client = new AdminApiClient({ fetchImpl });
    await client.login('diego', 'segredo', '111111');
    await client.logout();
    const init = calls[1].init;
    const headers = init.headers as Record<string, string>;
    assert.equal(calls[1].url, '/api/v2/auth/logout');
    assert.equal(headers['X-CSRF-Token'], 'csrf-1');
    assert.equal(headers['X-TOTP'], undefined);
    assert.equal(headers.Authorization, undefined);
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.cache, 'no-store');
    assert.deepEqual(JSON.parse(String(init.body)), {});
    assert.equal(client.sessionSnapshot, null);
  });

  it('refetches the session and retries one write after 403 csrf', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/login')) {
        return jsonResponse(200, {
          ok: true,
          user: 'diego',
          csrf_token: 'csrf-old',
          expires_at: 4_000_000_000,
          stepup_required_for: ['PUT /api/v2/admin/binance'],
        });
      }
      if (url.endsWith('/auth/session')) {
        return jsonResponse(200, {
          ok: true,
          user: 'diego',
          csrf_token: 'csrf-new',
          expires_at: 4_000_000_000,
          stepup_required_for: ['PUT /api/v2/admin/binance'],
        });
      }
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (headers['X-CSRF-Token'] === 'csrf-old') {
        return jsonResponse(403, { ok: false, error: 'CSRF ausente ou inválido', code: 'csrf' });
      }
      assert.equal(headers['X-CSRF-Token'], 'csrf-new');
      assert.equal(headers['X-TOTP'], '222222');
      return jsonResponse(200, { ok: true, configured: true, api_key_masked: '••••ABCD', tested: false });
    };
    const client = new AdminApiClient({ fetchImpl });
    await client.login('diego', 'segredo', '111111');
    await client.putBinance('api-key', 'api-secret', '222222');
    assert.deepEqual(calls, [
      '/api/v2/auth/login',
      '/api/v2/admin/binance',
      '/api/v2/auth/session',
      '/api/v2/admin/binance',
    ]);
    assert.equal(JSON.stringify(getAuthSession()).includes('api-secret'), false);
  });

  it('moves to the logged-out state once when several calls are 401', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      if (String(input).endsWith('/login')) {
        return jsonResponse(200, { ok: true, user: 'diego', csrf_token: 'csrf-1', expires_at: 4_000_000_000 });
      }
      return jsonResponse(401, { ok: false, error: 'sessão ausente ou expirada', code: 'unauthenticated' });
    };
    const client = new AdminApiClient({ fetchImpl });
    await client.login('diego', 'segredo', '111111');
    let signedOut = 0;
    const unsubscribe = subscribeAuth((next) => {
      if (next === null) signedOut += 1;
    });
    await Promise.allSettled([client.getBinance(), client.getRisk(), client.getAudit()]);
    unsubscribe();
    assert.equal(signedOut, 1);
    assert.equal(client.csrfReady, false);
  });

  it('closes the stream on auth and does not reconnect after a 401 probe', async () => {
    const opened: string[] = [];
    class FakeSource {
      closed = false;
      onerror: (() => void) | null = null;
      private listeners = new Map<string, Array<(event: MessageEvent) => void>>();
      constructor(readonly url: string) {
        opened.push(url);
      }
      addEventListener(type: string, listener: (event: MessageEvent) => void) {
        const list = this.listeners.get(type) ?? [];
        list.push(listener);
        this.listeners.set(type, list);
      }
      close() {
        this.closed = true;
      }
      emit(type: string) {
        const event = { data: JSON.stringify({ ok: false, code: 'unauthenticated' }) } as MessageEvent;
        for (const listener of this.listeners.get(type) ?? []) listener(event);
      }
    }
    let source: FakeSource | null = null;
    setStreamSourceFactoryForTests((url) => {
      source = new FakeSource(url);
      return source;
    });
    const fetchImpl: typeof fetch = async (input) => {
      if (String(input).endsWith('/login')) {
        return jsonResponse(200, { ok: true, user: 'diego', csrf_token: 'csrf-1', expires_at: 4_000_000_000 });
      }
      return jsonResponse(401, { ok: false, error: 'sessão ausente ou expirada', code: 'unauthenticated' });
    };
    const client = new AdminApiClient({ fetchImpl });
    await client.login('diego', 'segredo', '111111');
    setApiFetchForTests(fetchImpl);
    const stop = triadeApi.subscribeStream({
      onConnectionChange() {},
      onJournalEvent() {},
      onStatusTick() {},
    });
    assert.deepEqual(opened, ['/api/v2/stream?agent=all']);
    source!.emit('auth');
    assert.equal(source!.closed, true);
    assert.equal(getAuthSession(), null);
    assert.equal(opened.length, 1);
    stop();

    await client.login('diego', 'segredo', '222222');
    opened.length = 0;
    const stopAgain = triadeApi.subscribeStream({
      onConnectionChange() {},
      onJournalEvent() {},
      onStatusTick() {},
    });
    source!.onerror?.();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(opened.length, 1);
    assert.equal(getAuthSession(), null);
    assert.equal(source!.closed, true);
    stopAgain();
  });
});

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('porta inválida'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

describe('admin stub flow', () => {
  it('walks login, masked credentials, withdrawal block, limits, live and kill', async () => {
    const port = await freePort();
    const child = spawn(process.execPath, ['scripts/api-stub.mjs'], {
      env: { ...process.env, STUB_PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let logs = '';
    child.stdout?.on('data', (chunk) => {
      logs += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      logs += chunk.toString();
    });
    const base = `http://127.0.0.1:${port}`;
    let cookie = '';
    let lastCookies: string[] = [];
    const call = async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (cookie) headers.set('cookie', cookie);
      const response = await fetch(`${base}${path}`, { ...init, headers });
      const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
      lastCookies = setCookies;
      for (const entry of setCookies) {
        const pair = entry.split(';')[0] ?? '';
        if (!pair.startsWith('triade_session=')) continue;
        cookie = /Max-Age=0/i.test(entry) || pair.endsWith('=') ? '' : pair;
      }
      const json = (await response.json()) as Record<string, unknown>;
      return { status: response.status, json };
    };
    try {
      await Promise.race([
        once(child.stdout!, 'data'),
        once(child, 'exit').then(() => {
          throw new Error(`stub saiu cedo\n${logs}`);
        }),
      ]);

      const health = await call('/api/v2/health');
      assert.equal(health.json.stub, true);
      assert.equal(health.json.auth_required, true);
      assert.equal(health.json.authenticated, false);
      const hidden = await call('/api/v2/status');
      assert.equal(hidden.status, 401);
      assert.equal(hidden.json.code, 'unauthenticated');
      const stream = await call('/api/v2/stream?agent=all');
      assert.equal(stream.status, 401);
      assert.equal(stream.json.code, 'unauthenticated');

      const wrongPassword = await call('/api/v2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'diego', password: 'errada', totp: '101010' }),
      });
      assert.equal(wrongPassword.status, 401);
      assert.equal(wrongPassword.json.code, 'login_failed');
      const sameCode = await call('/api/v2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'diego', password: 'stub-local-only', totp: '101010' }),
      });
      assert.equal(sameCode.status, 200);
      await call('/api/v2/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': String(sameCode.json.csrf_token) },
        body: '{}',
      });
      assert.equal(cookie, '');

      const bad = await call('/api/v2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'diego', password: 'x', totp: '12' }),
      });
      assert.equal(bad.status, 401);
      assert.equal(bad.json.code, 'login_failed');

      const login = await call('/api/v2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'diego', password: 'stub-local-only', totp: '111111' }),
      });
      assert.equal(login.status, 200);
      assert.equal(typeof login.json.csrf_token, 'string');
      assert.equal(login.json.ttl_seconds, 604800);
      assert.ok((login.json.stepup_required_for as string[]).includes('PUT /api/v2/admin/binance'));
      assert.ok(cookie.includes('triade_session='));
      assert.match(lastCookies.join(';'), /Max-Age=604800/);
      assert.match(lastCookies.join(';'), /HttpOnly/);
      assert.match(lastCookies.join(';'), /SameSite=Strict/);
      const csrf = String(login.json.csrf_token);
      const visible = await call('/api/v2/status');
      assert.equal(visible.status, 200);
      const healthIn = await call('/api/v2/health');
      assert.equal(healthIn.json.authenticated, true);
      const readonlyPost = await call('/api/v2/status', { method: 'POST', body: '{}' });
      assert.equal(readonlyPost.status, 405);

      const reuse = await call('/api/v2/admin/binance/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '111111' },
        body: '{}',
      });
      assert.equal(reuse.status, 403);
      assert.equal(reuse.json.code, 'totp');

      const missing = await call('/api/v2/admin/binance/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '222222' },
        body: '{}',
      });
      assert.equal(missing.status, 412);
      assert.equal(missing.json.code, 'not_configured');

      const putWithdraw = await call('/api/v2/admin/binance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '333333' },
        body: JSON.stringify({ api_key: 'WITHDRAW1234', api_secret: 'segredo-que-nao-volta' }),
      });
      assert.equal(putWithdraw.status, 200);
      assert.equal(putWithdraw.json.api_key_masked, '••••1234');
      assert.equal(JSON.stringify(putWithdraw.json).includes('segredo-que-nao-volta'), false);

      const blocked = await call('/api/v2/admin/binance/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '444444' },
        body: '{}',
      });
      assert.equal(blocked.status, 412);
      assert.equal(blocked.json.code, 'permissions_failed');
      const blockedResult = blocked.json.result as { withdrawals_enabled: boolean; error: string };
      assert.equal(blockedResult.withdrawals_enabled, true);
      assert.match(blockedResult.error, /saques/);

      const putOk = await call('/api/v2/admin/binance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '555555' },
        body: JSON.stringify({ api_key: 'tradeonlyABCD', api_secret: 'outro-segredo' }),
      });
      assert.equal(putOk.json.tested, false);
      assert.equal(putOk.json.api_key_masked, '••••ABCD');

      const tested = await call('/api/v2/admin/binance/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '666666' },
        body: '{}',
      });
      assert.equal(tested.status, 200);
      const testResult = tested.json.result as { withdrawals_enabled: boolean; ip_restrict: boolean };
      assert.equal(testResult.withdrawals_enabled, false);
      assert.equal(testResult.ip_restrict, true);

      const earlyLive = await call('/api/v2/admin/crypto/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '777777' },
        body: JSON.stringify({ enabled: true, confirmation: ENABLE_CRYPTO_LIVE }),
      });
      assert.equal(earlyLive.status, 412);
      assert.equal(earlyLive.json.code, 'preconditions');
      assert.ok(Array.isArray(earlyLive.json.missing));

      const badPhrase = await call('/api/v2/admin/crypto/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '888888' },
        body: JSON.stringify({ enabled: true, confirmation: 'enable crypto live' }),
      });
      assert.equal(badPhrase.status, 400);
      assert.equal(badPhrase.json.code, 'confirmation');

      const badLimits = await call('/api/v2/admin/crypto/risk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '999999' },
        body: JSON.stringify({
          max_capital: 10,
          max_order_size: 100,
          daily_loss_limit: 30,
          max_trades_per_day: 4,
          max_open_positions: 1,
          allowed_pairs: [],
          max_drawdown: 0.06,
        }),
      });
      assert.equal(badLimits.status, 400);
      assert.equal(badLimits.json.code, 'bounds');

      const saved = await call('/api/v2/admin/crypto/risk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '121212' },
        body: JSON.stringify({
          max_capital: 500,
          max_order_size: 100,
          daily_loss_limit: 30,
          max_trades_per_day: 4,
          max_open_positions: 1,
          allowed_pairs: ['ETHUSDT', 'BTCUSDT'],
          max_drawdown: 0.06,
        }),
      });
      assert.equal(saved.status, 200);
      const savedLimits = saved.json.limits as { source: string; allowed_pairs: string[] };
      assert.equal(savedLimits.source, 'admin');
      assert.deepEqual(savedLimits.allowed_pairs, ['BTCUSDT', 'ETHUSDT']);

      const live = await call('/api/v2/admin/crypto/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '131313' },
        body: JSON.stringify({ enabled: true, confirmation: ENABLE_CRYPTO_LIVE }),
      });
      assert.equal(live.status, 200);
      assert.equal(live.json.live_enabled, true);
      assert.equal(live.json.unit_started, false);
      assert.match(String(live.json.note), /NÃO é iniciado automaticamente/);

      const flatten = await call('/api/v2/admin/crypto/flatten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '141414' },
        body: '{}',
      });
      assert.equal(flatten.status, 200);
      assert.equal(flatten.json.broker_called, false);
      assert.equal(flatten.json.kill_flag, 'var/crypto/KILL');

      const killB3 = await call('/api/v2/admin/b3/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-TOTP': '151515' },
        body: '{}',
      });
      assert.equal(killB3.status, 200);
      assert.equal(killB3.json.kill_flag, 'var/b3/KILL');

      const audit = await call('/api/v2/admin/audit');
      assert.equal(audit.status, 200);
      const entries = audit.json.entries as Array<{ action: string; after: unknown }>;
      assert.ok(entries.length >= 4);
      assert.equal(entries[0].action, 'b3_kill');
      const serialized = JSON.stringify(entries);
      assert.equal(serialized.includes('segredo-que-nao-volta'), false);
      assert.equal(serialized.includes('outro-segredo'), false);
      assert.match(serialized, /••••ABCD/);

      const logout = await call('/api/v2/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: '{}',
      });
      assert.equal(logout.status, 200);
      assert.equal(cookie, '');
      const after = await call('/api/v2/auth/session');
      assert.equal(after.status, 401);
      assert.equal(after.json.code, 'unauthenticated');
      const alias = await call('/api/v2/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'diego', password: 'stub-local-only', totp: '171717' }),
      });
      assert.equal(alias.status, 200);
      assert.ok(cookie.includes('triade_session='));
      const aliasSession = await call('/api/v2/admin/session');
      assert.equal(aliasSession.status, 200);
      assert.equal(aliasSession.json.user, 'diego');
    } finally {
      child.kill('SIGTERM');
      await once(child, 'exit').catch(() => undefined);
    }
  });
});
