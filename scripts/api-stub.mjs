/**
 * Local /api/v2 stub built from the contract examples.
 * Responses set stub:true on /health so the UI shows STUB LOCAL.
 * This is not the VPS and must not be treated as live account data.
 *
 * `/api/v2/auth/*` is the app session (cookie triade_session, 7 days).
 * `/api/v2/admin/{login,session,logout}` are aliases of those routes.
 * Other `/api/v2/*` routes require that cookie. Admin writes need CSRF and,
 * except logout, a fresh 6-digit TOTP. A key containing WITHDRAW fails the
 * permission test. Secrets are never written to the log or the audit.
 * The stub password is `stub-local-only`. A wrong password does not burn TOTP.
 */
import { randomBytes } from 'node:crypto';
import http from 'node:http';

const PORT = Number(process.env.STUB_PORT || 8766);
const STUB_PASSWORD = 'stub-local-only';
const SESSION_TTL_SECONDS = 7 * 24 * 3600;
const STEPUP_REQUIRED_FOR = [
  'PUT /api/v2/admin/binance',
  'POST /api/v2/admin/binance/test',
  'PUT /api/v2/admin/crypto/risk',
  'POST /api/v2/admin/crypto/live',
  'POST /api/v2/admin/crypto/kill',
  'POST /api/v2/admin/crypto/flatten',
  'POST /api/v2/admin/b3/kill',
];

const health = {
  ok: true,
  bind: `127.0.0.1:${PORT}`,
  readonly: true,
  auth_required: true,
  stub: true,
  version: 'stub',
  note: 'STUB LOCAL — exemplos do contrato, não a VPS.',
  server_time: '2026-11-19T11:14:31-03:00',
  timezone: 'America/Sao_Paulo',
  uptime_seconds: 36,
  git: { branch: 'stub', commit_short: 'stub' },
};

const status = {
  ok: true,
  bind: `127.0.0.1:${PORT}`,
  readonly: true,
  auth_required: false,
  stub: true,
  generated_at: '2026-11-19T11:14:31-03:00',
  timezone: 'America/Sao_Paulo',
  kill_all: false,
  agents: {
    b3: {
      id: 'b3',
      label: 'B3 Futuros (WIN)',
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
      mode: 'live',
      live_enabled: true,
      paper_venue: 'simulate',
      running: true,
      halted: false,
      sticky_halt: false,
      halt_reason: null,
      block_entries: false,
      kill: { agent: false, kill_all: false },
      state_files: { paper: true, live: true },
      state: {
        mode: 'live',
        day: '2026-11-19',
        trades_today: 0,
        consecutive_losses: 0,
        halted: false,
        positions: [],
        broker: null,
      },
      session_phase: 'accepting_entries',
      contract_current: 'WINZ26',
      strategy_name: 'orb_vwap_trend',
      trades_today: 0,
      open_positions: 0,
      log_file: 'var/b3/logs/live.jsonl',
      log_file_exists: true,
    },
    nasdaq: {
      id: 'nasdaq',
      label: 'NASDAQ',
      currency: 'USD',
      timezone: 'America/New_York',
      mode: 'paper',
      live_enabled: false,
      running: false,
      halted: false,
      state_files: { paper: false, live: false },
      state: null,
      session_phase: 'outside_session',
      contract_current: null,
      strategy_name: 'ny_open_range',
      day_loss: null,
      drawdown: null,
      log_file_exists: false,
    },
    crypto: {
      id: 'crypto',
      label: 'Cripto',
      currency: 'USDT',
      timezone: 'UTC',
      mode: 'paper',
      live_enabled: false,
      running: false,
      halted: true,
      sticky_halt: true,
      halt_reason: 'drawdown máximo',
      state_files: { paper: true, live: false },
      state: {
        mode: 'paper',
        day: '2026-10-16',
        halted: true,
        sticky_halt: true,
        halt_reason: 'drawdown máximo',
        positions: [],
        trades_today: 0,
      },
      session_phase: null,
    },
  },
};

const timeline = {
  ok: true,
  readonly: true,
  stub: true,
  limit: 200,
  count: 1,
  truncated: false,
  agent: 'all',
  mode: 'all',
  files: [
    { agent: 'b3', mode: 'live', path: 'var/b3/journal/live.jsonl', exists: true },
    { agent: 'nasdaq', mode: 'paper', path: 'var/nasdaq/journal/paper.jsonl', exists: false },
    { agent: 'crypto', mode: 'paper', path: 'var/crypto/journal/paper.jsonl', exists: true },
  ],
  events: [
    {
      ts: '2026-11-19T12:27:50.202118+00:00',
      event: 'reconcile',
      ok: true,
      agent: 'b3',
      mode: 'live',
    },
  ],
  generated_at: '2026-11-19T11:14:31-03:00',
};

const trades = {
  ok: true,
  agent: 'all',
  mode: 'all',
  count: 1,
  truncated: false,
  realized_pnl: null,
  note: 'STUB. B3 live não tem trade. O item abaixo é paper de crypto, sem PnL (o contrato redige o número).',
  trades: [
    {
      ts: '2026-11-17T18:04:00+00:00',
      event: 'trade',
      agent: 'crypto',
      mode: 'paper',
      symbol: 'BTCUSDT',
      side: 'sell',
      qty: 0.01,
      source: 'python',
      client_order_id: 'stub-crypto-paper',
      pnl: null,
      fees: null,
    },
  ],
  generated_at: '2026-11-19T11:14:31-03:00',
};

function pnl(agent) {
  const paper = agent === 'crypto';
  return {
    ok: true,
    agent,
    mode: paper ? 'paper' : agent === 'b3' ? 'live' : 'paper',
    currency: agent === 'b3' ? 'BRL' : agent === 'nasdaq' ? 'USD' : 'USDT',
    count: 0,
    incomplete: true,
    summary: { net_pnl: null, fees: null, wins: 0, losses: 0, win_rate: null, expectancy: null },
    series: [],
    note: 'STUB. Série vazia: a curva intra-diária de equity não é persistida e o contrato não traz PnL numérico.',
    generated_at: '2026-11-19T11:14:31-03:00',
  };
}

function risk(agent, profile) {
  if (agent === 'b3' && profile !== 'research') {
    return {
      ok: true,
      agent: 'b3',
      mode: 'live',
      profile: 'micro_live',
      currency: 'BRL',
      state_exists: true,
      halted: false,
      day: '2026-11-19',
      equity_current: null,
      limits: {
        daily_loss_limit: 300,
        max_trades_per_day: 5,
        max_consecutive_losses: 3,
        max_open_positions: 1,
        max_qty: 1,
        max_qty_by_symbol: { WIN: 1 },
        max_daily_drawdown: 0.04,
        allowed_symbols: ['WIN'],
        allowed_contracts_kind: null,
        no_new_entries_after: '17:00',
        flatten_at: '17:30',
        stop_required: null,
        flatten_on_halt: null,
      },
      consumption: {
        daily_loss: { used: null, limit: 300, remaining: null, ratio: null },
        trades_today: { used: 0, limit: 5, remaining: 5, ratio: 0 },
        consecutive_losses: { used: 0, limit: 3, remaining: 3, ratio: 0 },
        open_positions: { used: 0, limit: 1, remaining: 1, ratio: 0 },
        drawdown: { used_abs: null, used_pct: null, limit_pct: 0.04, ratio: 0 },
      },
      session_phase: 'accepting_entries',
      contract_current: 'WINZ26',
    };
  }
  if (agent === 'nasdaq') {
    return {
      ok: true,
      agent: 'nasdaq',
      mode: 'paper',
      profile: 'research',
      currency: 'USD',
      state_exists: false,
      equity_current: null,
      halted: false,
      limits: {
        max_trades_per_day: 4,
        max_daily_drawdown: 0.06,
        daily_loss_limit: null,
        max_consecutive_losses: null,
        allowed_symbols: ['USTEC'],
      },
      consumption: { daily_loss: { used: null, ratio: null } },
      session_phase: 'outside_session',
    };
  }
  return {
    ok: true,
    agent: 'crypto',
    mode: 'paper',
    profile: profile === 'micro_live' ? 'micro_live' : 'research',
    currency: 'USDT',
    state_exists: true,
    halted: true,
    sticky_halt: true,
    halt_reason: 'drawdown máximo',
    day: '2026-10-16',
    equity_current: null,
    limits: { max_daily_drawdown: 0.08, allowed_symbols: ['BTCUSDT', 'ETHUSDT'] },
    consumption: { daily_loss: { used: null, ratio: null } },
    session_phase: null,
  };
}

const barsB3 = {
  ok: true,
  agent: 'b3',
  symbol: 'WIN',
  tf: '5m',
  requested_tf: '5m',
  updated_at: null,
  count: 2,
  exists: true,
  bars: [
    { ts: '2026-11-19T09:10:00+00:00', symbol: 'WIN', o: 169095, h: 169225, l: 169015, c: 169115, v: 19940, n: null, timeframe: '5m' },
    { ts: '2026-11-19T09:15:00+00:00', symbol: 'WIN', o: 169115, h: 169150, l: 168940, c: 168975, v: 17872, n: null, timeframe: '5m' },
  ],
};

const events = {
  ok: true,
  count: 1,
  truncated: false,
  events: [
    {
      ts: '2026-11-18T13:18:56.945359+00:00',
      kind: 'volume_spike',
      agent: 'crypto',
      symbol: 'ETHUSDT',
      volume: 148960.995,
      media: 65281.4496,
    },
  ],
  files: [
    { agent: 'b3', path: 'var/b3/events/queue.jsonl', exists: false },
    { agent: 'nasdaq', path: 'var/nasdaq/events/queue.jsonl', exists: false },
    { agent: 'crypto', path: 'var/crypto/events/queue.jsonl', exists: true },
  ],
};

const backtests = {
  ok: true,
  reports: [
    { id: 'b3', agent: 'b3', title: 'B3 Futuros · orb_vwap_trend', strategy: { name: 'orb_vwap_trend' }, data: { path: 'artifacts/backtests/b3.json', bars: null }, live_warning: 'O live opera somente WIN.' },
    { id: 'crypto', agent: 'crypto', title: 'Crypto (Binance) · ema_trend_atr', strategy: { name: 'ema_trend_atr' }, data: { bars: null } },
    { id: 'nasdaq_orb', agent: 'nasdaq', title: 'NASDAQ ORB · ny_open_range', strategy: { name: 'ny_open_range' }, data: { bars: null } },
    { id: 'nasdaq_vwap_mr', agent: 'nasdaq', title: 'NASDAQ VWAP mean-reversion', strategy: { name: 'vwap_mean_reversion' }, data: { bars: null } },
  ],
};

function config(agent) {
  const names = {
    b3: 'orb_vwap_trend',
    nasdaq: 'ny_open_range',
    crypto: 'ema_trend_atr',
  };
  return {
    ok: true,
    agent,
    live_enabled: agent === 'b3',
    contract_current: agent === 'b3' ? 'WINZ26' : null,
    env_key_names_only: agent === 'crypto' ? [] : [`${agent.toUpperCase()}_MT5_LOGIN`, `${agent.toUpperCase()}_MT5_PASSWORD`, `${agent.toUpperCase()}_MT5_SERVER`],
    note: 'STUB. Valores de .env nunca são lidos.',
    config: {
      paper_venue: agent === 'crypto' ? 'binance' : 'simulate',
      timezone: agent === 'nasdaq' ? 'America/New_York' : 'America/Sao_Paulo',
      strategy: { name: names[agent] },
      notifications: { telegram_enabled: false },
      micro_live: agent === 'b3' ? { equity: null, symbols: ['WIN'] } : {},
      symbols: agent === 'b3' ? ['WIN'] : agent === 'nasdaq' ? ['USTEC'] : ['BTCUSDT', 'ETHUSDT'],
      mt5:
        agent === 'crypto'
          ? undefined
          : {
              transport: 'bridge',
              bridge_host: '127.0.0.1',
              bridge_port: agent === 'b3' ? 18863 : 18862,
              demo: false,
              login_env: `${agent.toUpperCase()}_MT5_LOGIN`,
              password_env: `${agent.toUpperCase()}_MT5_PASSWORD`,
              server_env: `${agent.toUpperCase()}_MT5_SERVER`,
            },
    },
  };
}

const infra = {
  ok: true,
  stub: true,
  bind: `127.0.0.1:${PORT}`,
  readonly: true,
  version: 'stub',
  linger: 'no',
  generated_at: '2026-11-19T11:14:31-03:00',
  server_clock_utc: '2026-11-19T14:14:31Z',
  server_clock_brt: '2026-11-19T11:14:31-03:00',
  git: { branch: 'stub', commit_short: 'stub' },
  disk: { path: 'var/', used_mb: null, total_mb: null, used_pct: null, inode_pct: null },
  units: [
    { agent: 'dashboard', role: 'dashboard', unit: 'triade-dashboard.service', active: 'active', enabled: 'disabled' },
    { agent: 'b3', role: 'agent', unit: 'triade-agent-b3.service', active: 'active', enabled: 'disabled' },
    { agent: 'nasdaq', role: 'agent', unit: 'triade-agent-nasdaq.service', active: 'inactive', enabled: 'disabled' },
    { agent: 'crypto', role: 'agent', unit: 'triade-agent-crypto.service', active: 'inactive', enabled: 'disabled' },
    { agent: 'b3', role: 'bridge', unit: 'triade-bridge-b3.service', active: 'active', enabled: 'disabled' },
    { agent: 'nasdaq', role: 'bridge', unit: 'triade-bridge-nasdaq.service', active: 'active', enabled: 'disabled' },
  ],
  ports: [
    { port: 18861, service: 'ponte MT5 B3 (unit oficial)', listening: true, localhost_only: true, binds: ['127.0.0.1:18861'], pong: true },
    { port: 18863, service: 'ponte MT5 B3 live', listening: true, localhost_only: true, binds: ['127.0.0.1:18863'], pong: false },
    { port: 18862, service: 'ponte MT5 NASDAQ', listening: true, localhost_only: true, binds: ['127.0.0.1:18862'], pong: true },
    { port: 5971, service: 'VNC B3', listening: true, localhost_only: true, binds: ['127.0.0.1:5971'], pong: null },
    { port: 5972, service: 'VNC NASDAQ', listening: true, localhost_only: true, binds: ['127.0.0.1:5972'], pong: null },
    { port: 8765, service: 'dashboard', listening: true, localhost_only: true, binds: ['127.0.0.1:8765'], pong: null },
  ],
  terminals: {
    b3: { display: ':71', vnc_port: 5971, process_exists: true },
    nasdaq: { display: ':72', vnc_port: 5972, process_exists: true },
  },
};

const logs = {
  ok: true,
  agent: 'b3',
  mode_requested: 'effective',
  mode: 'live',
  path: 'var/b3/logs/live.jsonl',
  exists: true,
  entries: [
    {
      ts: '2026-11-19T12:27:50.202475+00:00',
      level: 'INFO',
      agent: 'b3',
      msg: 'reconciliação ok; nenhuma reentrada do sinal antigo',
    },
  ],
  systemd_journal: [
    '2026-11-19T12:27:49+00:00 vmi3530946 systemd[407840]: Started triade-agent-b3.service - TRIADE agente b3 em live.',
    '2026-11-19T12:27:49+00:00 vmi3530946 run-agent.sh[3940434]: TRIADE b3 modo live. Log: var/b3/logs/live.jsonl',
  ],
};

const alerts = {
  ok: true,
  alerts: [
    {
      id: 'halt:crypto:drawdown máximo',
      ts: '2026-11-19T11:14:45-03:00',
      severity: 'critical',
      kind: 'halt',
      agent: 'crypto',
      title: 'crypto halted',
      detail: 'drawdown máximo',
      acknowledged: false,
      source: 'derived',
    },
  ],
  count: 1,
  note: 'STUB. Alertas derivados. Não há persistência de acknowledgement.',
};

const audit = {
  ok: true,
  entries: [],
  count: 0,
  exists: false,
  note: 'Arquivo var/dashboard/audit.jsonl ainda não existe. Não há endpoints de escrita neste servidor; a UI deve exibir estado vazio.',
};

const IP_RESTRICTED =
  'A chave está restrita por IP. Confirme que o IP da VPS (169.58.230.95) está na lista branca.';
const IP_OPEN =
  'A chave não está restrita por IP. Restrinja a chave ao IP da VPS 169.58.230.95 e deixe só permissão de trade, sem saque.';

const RISK_BOUNDS = {
  max_capital: { min: 100, max: 50000 },
  max_order_size: { min: 10, max: 20000 },
  daily_loss_limit: { min: 10, max: 5000 },
  max_trades_per_day: { min: 1, max: 20 },
  max_open_positions: { min: 1, max: 3 },
  max_drawdown: { min: 0.01, max: 0.1 },
};
const ALLOWED_PAIRS = ['BTCUSDT', 'ETHUSDT'];

const adminState = {
  session: null,
  usedTotp: new Set(),
  configured: false,
  apiKeyMasked: null,
  withdrawalsKey: false,
  lastTest: null,
  liveYaml: false,
  adminLive: false,
  limits: null,
  audit: [],
};

function saoPauloIso(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;
}

function saoPauloNow() {
  return saoPauloIso(new Date());
}

function maskKey(key) {
  return `••••${String(key).slice(-4)}`;
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '127.0.0.1';
}

function pushAudit(req, action, ok, detail, before, after) {
  adminState.audit.unshift({
    ts: saoPauloNow(),
    who: adminState.session?.user || 'diego',
    ip: clientIp(req),
    action,
    ok,
    detail,
    before,
    after,
  });
  if (adminState.audit.length > 500) adminState.audit.length = 500;
}

function cookieValue(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        const error = new Error('payload');
        error.status = 413;
        finish(reject, error);
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        finish(resolve, {});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        finish(resolve, parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        const error = new Error('json');
        error.status = 400;
        finish(reject, error);
      }
    });
    req.on('error', (error) => finish(reject, error));
  });
}

function currentSession(req) {
  if (!adminState.session) return null;
  const got = cookieValue(req, 'triade_session');
  if (!got || got !== adminState.session.id) return null;
  if (Date.now() / 1000 >= adminState.session.expiresAt) {
    adminState.session = null;
    return null;
  }
  return adminState.session;
}

function consumeTotp(raw, login) {
  const totp = String(raw ?? '').trim();
  const invalid = !/^\d{6}$/.test(totp) || adminState.usedTotp.has(totp);
  if (invalid) {
    return login
      ? { ok: false, status: 401, code: 'login_failed', error: 'usuário, senha ou código 2FA inválidos' }
      : { ok: false, status: 403, code: 'totp', error: 'código 2FA ausente, inválido ou reutilizado' };
  }
  adminState.usedTotp.add(totp);
  return { ok: true };
}

function requireWrite(req, body) {
  const session = currentSession(req);
  if (!session) {
    return { ok: false, status: 401, code: 'unauthenticated', error: 'sessão ausente ou expirada' };
  }
  const header = req.headers['x-csrf-token'];
  const csrf = (Array.isArray(header) ? header[0] : header) || body.csrf_token;
  if (!csrf || csrf !== session.csrf) {
    return { ok: false, status: 403, code: 'csrf', error: 'CSRF ausente ou inválido' };
  }
  const totpHeader = req.headers['x-totp'];
  const totp = (Array.isArray(totpHeader) ? totpHeader[0] : totpHeader) || body.totp;
  const checked = consumeTotp(totp, false);
  if (!checked.ok) return checked;
  return { ok: true, session };
}

function binancePayload() {
  return {
    ok: true,
    configured: adminState.configured,
    api_key_masked: adminState.configured ? adminState.apiKeyMasked : null,
    last_test: adminState.lastTest,
    ip_restriction_note:
      adminState.lastTest?.ip_restriction_note ||
      (adminState.configured
        ? IP_OPEN
        : 'Crie a chave só com trade e restrição de IP para 169.58.230.95. Não habilite saques.'),
    live_enabled_yaml: adminState.liveYaml,
    admin_live_enabled: adminState.adminLive,
  };
}

function applyLiveFlag(enabled) {
  adminState.liveYaml = enabled;
  adminState.adminLive = enabled;
  status.agents.crypto.live_enabled = enabled;
  status.agents.crypto.mode = enabled ? 'live' : 'paper';
}

function validateLimits(source) {
  const integerKeys = new Set(['max_trades_per_day', 'max_open_positions']);
  for (const [key, bound] of Object.entries(RISK_BOUNDS)) {
    const value = source[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `${key} fora dos limites (${bound.min}–${bound.max}).`;
    }
    if (integerKeys.has(key) && !Number.isInteger(value)) {
      return `${key} fora dos limites (${bound.min}–${bound.max}).`;
    }
    if (value < bound.min || value > bound.max) {
      return `${key} fora dos limites (${bound.min}–${bound.max}).`;
    }
  }
  const pairs = source.allowed_pairs;
  if (!Array.isArray(pairs) || pairs.length === 0) return 'allowed_pairs não pode ser vazio.';
  if (pairs.some((pair) => !ALLOWED_PAIRS.includes(pair))) {
    return 'allowed_pairs só aceita BTCUSDT e ETHUSDT.';
  }
  return '';
}

function sessionPayload(session) {
  return {
    ok: true,
    user: session.user,
    csrf_token: session.csrf,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
    expires_at_iso: session.expiresAtIso,
    ttl_seconds: SESSION_TTL_SECONDS,
    stepup_required_for: STEPUP_REQUIRED_FOR,
  };
}

function sessionCookie(id, maxAge) {
  const value = maxAge === 0 ? '' : encodeURIComponent(id);
  return `triade_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}

function authKind(pathname) {
  if (pathname === '/api/v2/auth/login' || pathname === '/api/v2/admin/login') return 'login';
  if (pathname === '/api/v2/auth/logout' || pathname === '/api/v2/admin/logout') return 'logout';
  if (pathname === '/api/v2/auth/session' || pathname === '/api/v2/admin/session') return 'session';
  return null;
}

function readCsrf(req, body) {
  const header = req.headers['x-csrf-token'];
  return (Array.isArray(header) ? header[0] : header) || body?.csrf_token || '';
}

async function handleAuth(req, res, kind) {
  const method = req.method || 'GET';
  if (kind === 'session') {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'método não permitido', code: 'method_not_allowed' });
      return;
    }
    const session = currentSession(req);
    if (!session) {
      sendJson(res, 401, { ok: false, error: 'sessão ausente ou expirada', code: 'unauthenticated' });
      return;
    }
    sendJson(res, 200, sessionPayload(session));
    return;
  }
  if (method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'método não permitido', code: 'method_not_allowed' });
    return;
  }
  const body = await readJsonBody(req);
  if (kind === 'login') {
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || password !== STUB_PASSWORD) {
      pushAudit(req, 'login', false, 'login_failed', null, null);
      sendJson(res, 401, { ok: false, error: 'usuário, senha ou código 2FA inválidos', code: 'login_failed' });
      return;
    }
    const totp = consumeTotp(body.totp, true);
    if (!totp.ok) {
      pushAudit(req, 'login', false, 'login_failed', null, null);
      sendJson(res, totp.status, { ok: false, error: totp.error, code: totp.code });
      return;
    }
    const expiresAt = Date.now() / 1000 + SESSION_TTL_SECONDS;
    adminState.session = {
      id: randomBytes(24).toString('hex'),
      csrf: randomBytes(24).toString('hex'),
      user: username,
      createdAt: saoPauloNow(),
      expiresAt,
      expiresAtIso: saoPauloIso(new Date(expiresAt * 1000)),
    };
    pushAudit(req, 'login', true, null, null, { user: username });
    sendJson(res, 200, sessionPayload(adminState.session), sessionCookie(adminState.session.id, SESSION_TTL_SECONDS));
    return;
  }
  const session = currentSession(req);
  if (!session) {
    sendJson(res, 401, { ok: false, error: 'sessão ausente ou expirada', code: 'unauthenticated' });
    return;
  }
  const csrf = readCsrf(req, body);
  if (!csrf || csrf !== session.csrf) {
    sendJson(res, 403, { ok: false, error: 'CSRF ausente ou inválido', code: 'csrf' });
    return;
  }
  pushAudit(req, 'logout', true, null, null, null);
  adminState.session = null;
  sendJson(res, 200, { ok: true, message: 'sessão encerrada' }, sessionCookie('', 0));
}

async function handleAdmin(req, res, url) {
  const path = url.pathname;
  const method = req.method || 'GET';
  const known = {
    '/api/v2/admin/binance': 'GET',
    '/api/v2/admin/binance/test': 'POST',
    '/api/v2/admin/crypto/risk': 'GET',
    '/api/v2/admin/crypto/live': 'POST',
    '/api/v2/admin/crypto/kill': 'POST',
    '/api/v2/admin/crypto/flatten': 'POST',
    '/api/v2/admin/b3/kill': 'POST',
    '/api/v2/admin/audit': 'GET',
  };
  if (!(path in known) && path !== '/api/v2/admin/binance' && path !== '/api/v2/admin/crypto/risk') {
    sendJson(res, 404, { ok: false, error: 'rota admin desconhecida', code: 'not_found' });
    return;
  }
  const needsBody = method === 'POST' || method === 'PUT';
  if (path === '/api/v2/admin/binance' && method !== 'GET' && method !== 'PUT') {
    sendJson(res, 405, { ok: false, error: 'método não permitido', code: 'method_not_allowed' });
    return;
  }
  if (path === '/api/v2/admin/crypto/risk' && method !== 'GET' && method !== 'PUT') {
    sendJson(res, 405, { ok: false, error: 'método não permitido', code: 'method_not_allowed' });
    return;
  }
  if (path !== '/api/v2/admin/binance' && path !== '/api/v2/admin/crypto/risk' && known[path] !== method) {
    sendJson(res, 405, { ok: false, error: 'método não permitido', code: 'method_not_allowed' });
    return;
  }

  const body = needsBody ? await readJsonBody(req) : {};

  if (method === 'GET' && path === '/api/v2/admin/binance') {
    if (!currentSession(req)) {
      sendJson(res, 401, { ok: false, error: 'sessão ausente ou expirada', code: 'unauthenticated' });
      return;
    }
    sendJson(res, 200, binancePayload());
    return;
  }

  if (method === 'GET' && path === '/api/v2/admin/crypto/risk') {
    if (!currentSession(req)) {
      sendJson(res, 401, { ok: false, error: 'sessão ausente ou expirada', code: 'unauthenticated' });
      return;
    }
    sendJson(res, 200, { ok: true, limits: adminState.limits, bounds: RISK_BOUNDS, allowed_pairs: ALLOWED_PAIRS });
    return;
  }

  if (method === 'GET' && path === '/api/v2/admin/audit') {
    if (!currentSession(req)) {
      sendJson(res, 401, { ok: false, error: 'sessão ausente ou expirada', code: 'unauthenticated' });
      return;
    }
    sendJson(res, 200, { ok: true, count: adminState.audit.length, entries: adminState.audit });
    return;
  }

  const gate = requireWrite(req, body);
  if (!gate.ok) {
    if (gate.code === 'totp') pushAudit(req, 'stepup_totp', false, gate.error, null, null);
    sendJson(res, gate.status, { ok: false, error: gate.error, code: gate.code });
    return;
  }

  if (path === '/api/v2/admin/binance' && method === 'PUT') {
    const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';
    const apiSecret = typeof body.api_secret === 'string' ? body.api_secret.trim() : '';
    if (!apiKey || !apiSecret) {
      sendJson(res, 400, { ok: false, error: 'informe api_key e api_secret', code: 'invalid' });
      return;
    }
    const before = { configured: adminState.configured };
    adminState.configured = true;
    adminState.apiKeyMasked = maskKey(apiKey);
    adminState.withdrawalsKey = /WITHDRAW/i.test(apiKey);
    adminState.lastTest = null;
    const after = { configured: true, api_key: adminState.apiKeyMasked };
    pushAudit(req, 'binance_credentials_put', true, null, before, after);
    sendJson(res, 200, { ok: true, configured: true, api_key_masked: adminState.apiKeyMasked, tested: false });
    return;
  }

  if (path === '/api/v2/admin/binance/test') {
    if (!adminState.configured) {
      pushAudit(req, 'binance_test', false, 'not_configured', null, null);
      sendJson(res, 412, { ok: false, error: 'ainda não há chave no cofre', code: 'not_configured' });
      return;
    }
    if (adminState.withdrawalsKey) {
      const result = {
        ok: false,
        tested_at: saoPauloNow(),
        withdrawals_enabled: true,
        ip_restrict: false,
        enable_futures: true,
        enable_spot_and_margin_trading: true,
        enable_internal_transfer: null,
        error: 'a chave permite saques; recusada (fail-closed)',
        ip_restriction_note: IP_OPEN,
      };
      adminState.lastTest = result;
      pushAudit(req, 'binance_test', false, result.error, null, { withdrawals_enabled: true });
      sendJson(res, 412, {
        ok: false,
        error: result.error,
        code: 'permissions_failed',
        result,
      });
      return;
    }
    const result = {
      ok: true,
      tested_at: saoPauloNow(),
      withdrawals_enabled: false,
      ip_restrict: true,
      enable_futures: true,
      enable_spot_and_margin_trading: true,
      enable_internal_transfer: null,
      error: null,
      ip_restriction_note: IP_RESTRICTED,
    };
    adminState.lastTest = result;
    pushAudit(req, 'binance_test', true, null, null, { withdrawals_enabled: false, ip_restrict: true });
    sendJson(res, 200, { ok: true, result });
    return;
  }

  if (path === '/api/v2/admin/crypto/risk' && method === 'PUT') {
    const source = body.limits && typeof body.limits === 'object' ? body.limits : body;
    const problem = validateLimits(source);
    if (problem) {
      pushAudit(req, 'crypto_risk_put', false, problem, adminState.limits, null);
      sendJson(res, 400, { ok: false, error: problem, code: 'bounds' });
      return;
    }
    const before = adminState.limits;
    const stored = {
      max_capital: source.max_capital,
      max_order_size: source.max_order_size,
      daily_loss_limit: source.daily_loss_limit,
      max_trades_per_day: source.max_trades_per_day,
      max_open_positions: source.max_open_positions,
      allowed_pairs: ALLOWED_PAIRS.filter((pair) => source.allowed_pairs.includes(pair)),
      max_drawdown: source.max_drawdown,
      updated_at: saoPauloNow(),
      source: 'admin',
    };
    adminState.limits = stored;
    const stamp = saoPauloNow().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const backup = `crypto.yaml.bak-admin-${stamp}`;
    pushAudit(req, 'crypto_risk_put', true, null, before, stored);
    sendJson(res, 200, { ok: true, limits: stored, backup });
    return;
  }

  if (path === '/api/v2/admin/crypto/live') {
    let enabled = null;
    if (body.enabled === true || body.enabled === false) enabled = body.enabled;
    else if (body.action === 'enable') enabled = true;
    else if (body.action === 'disable') enabled = false;
    if (enabled === null) {
      sendJson(res, 400, { ok: false, error: 'informe enabled', code: 'invalid' });
      return;
    }
    const expected = enabled ? 'ENABLE CRYPTO LIVE' : 'DISABLE CRYPTO LIVE';
    if (body.confirmation !== expected) {
      sendJson(res, 400, {
        ok: false,
        error: `a frase precisa ser exatamente ${expected}`,
        code: 'confirmation',
      });
      return;
    }
    if (enabled) {
      const missing = [];
      if (!adminState.configured) missing.push('credenciais Binance');
      if (!adminState.lastTest?.ok || adminState.lastTest.withdrawals_enabled !== false) {
        missing.push('teste de permissões');
      }
      if (!adminState.limits || adminState.limits.source !== 'admin') missing.push('limites de risco');
      if (missing.length) {
        pushAudit(req, 'crypto_live_enable', false, missing.join(', '), null, null);
        sendJson(res, 412, {
          ok: false,
          error: 'pré-requisitos do live não foram atendidos',
          code: 'preconditions',
          missing,
        });
        return;
      }
    }
    applyLiveFlag(enabled);
    const note = enabled
      ? 'O flag live foi gravado. O agente crypto NÃO é iniciado automaticamente. Ligue a unit só depois de revisar o painel.'
      : 'O flag live foi desligado. A unit do agente não foi alterada por este painel.';
    pushAudit(req, enabled ? 'crypto_live_enable' : 'crypto_live_disable', true, null, null, {
      live_enabled: enabled,
      unit_started: false,
    });
    sendJson(res, 200, {
      ok: true,
      live_enabled: enabled,
      admin_live_enabled: enabled,
      unit_started: false,
      note,
    });
    return;
  }

  if (path === '/api/v2/admin/crypto/kill') {
    if (status.agents.crypto.kill) status.agents.crypto.kill.agent = true;
    pushAudit(req, 'crypto_kill', true, null, null, { kill_flag: 'var/crypto/KILL' });
    sendJson(res, 200, { ok: true, agent: 'crypto', kill_flag: 'var/crypto/KILL' });
    return;
  }

  if (path === '/api/v2/admin/crypto/flatten') {
    if (status.agents.crypto.kill) status.agents.crypto.kill.agent = true;
    const note =
      'Kill gravado. O flatten na corretora deve ser feito pelo comando oficial do agente, com o live já revisado.';
    pushAudit(req, 'crypto_flatten', true, note, null, { broker_called: false, kill_flag: 'var/crypto/KILL' });
    sendJson(res, 200, {
      ok: true,
      agent: 'crypto',
      kill_flag: 'var/crypto/KILL',
      broker_called: false,
      note,
    });
    return;
  }

  if (path === '/api/v2/admin/b3/kill') {
    if (status.agents.b3.kill) status.agents.b3.kill.agent = true;
    pushAudit(req, 'b3_kill', true, null, null, { kill_flag: 'var/b3/KILL' });
    sendJson(res, 200, { ok: true, agent: 'b3', kill_flag: 'var/b3/KILL' });
    return;
  }

  sendJson(res, 404, { ok: false, error: 'rota admin desconhecida', code: 'not_found' });
}

function route(url) {
  const path = url.pathname;
  if (path === '/api/v2/health' || path === '/api/health') return health;
  if (path === '/api/v2/status') return status;
  if (path === '/api/v2/timeline') return timeline;
  if (path === '/api/v2/trades' || /\/api\/v2\/agents\/[^/]+\/trades$/.test(path)) return trades;
  if (/\/api\/v2\/agents\/(b3|nasdaq|crypto)\/pnl$/.test(path)) return pnl(path.split('/')[4]);
  if (/\/api\/v2\/agents\/(b3|nasdaq|crypto)\/risk$/.test(path)) {
    return risk(path.split('/')[4], url.searchParams.get('profile') || '');
  }
  if (path === '/api/v2/events') return events;
  if (/\/api\/v2\/agents\/(b3|nasdaq|crypto)\/bars$/.test(path)) {
    const agent = path.split('/')[4];
    const tf = url.searchParams.get('tf') || '5m';
    if (agent !== 'b3') return { ok: true, agent, exists: false, bars: [], tf, note: `Ainda não há var/${agent}/recent-bars.json neste servidor.` };
    if (tf !== '5m') return { ok: true, agent, exists: true, bars: [], tf: '5m', note: `Sem resample: o snapshot está em 5m e o pedido foi ${tf}.` };
    return barsB3;
  }
  if (path === '/api/v2/backtests') return backtests;
  if (/\/api\/v2\/config\/(b3|nasdaq|crypto)$/.test(path)) return config(path.split('/').pop());
  if (path === '/api/v2/infra') return infra;
  if (path === '/api/v2/logs') return { ...logs, agent: url.searchParams.get('agent') || 'b3' };
  if (path === '/api/v2/alerts') return alerts;
  if (path === '/api/v2/audit') return audit;
  if (path === '/api/v2/positions') return { ok: true, agent: 'all', count: 0, positions: [], generated_at: health.server_time };
  return null;
}

function sendJson(res, statusCode, body, cookie) {
  if (cookie) res.setHeader('Set-Cookie', cookie);
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || 'http://127.0.0.1:3000';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Authorization, Content-Type, X-CSRF-Token, X-TOTP'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const kind = authKind(url.pathname);
  if (kind) {
    try {
      await handleAuth(req, res, kind);
    } catch (err) {
      if (res.headersSent) return;
      const statusCode = err?.status === 413 ? 413 : err?.status === 400 ? 400 : 500;
      const code = statusCode === 413 ? 'payload_too_large' : statusCode === 400 ? 'invalid_json' : 'invalid';
      const error =
        statusCode === 413 ? 'corpo maior que 64 KiB' : statusCode === 400 ? 'JSON malformado' : 'falha no stub';
      sendJson(res, statusCode, { ok: false, error, code });
    }
    return;
  }
  if (req.method === 'GET' && (url.pathname === '/api/v2/health' || url.pathname === '/api/health')) {
    sendJson(res, 200, {
      ...health,
      auth_required: true,
      authenticated: Boolean(currentSession(req)),
    });
    return;
  }
  if (!currentSession(req)) {
    sendJson(res, 401, { ok: false, error: 'sessão ausente ou expirada', code: 'unauthenticated' });
    return;
  }
  if (url.pathname.startsWith('/api/v2/admin')) {
    try {
      await handleAdmin(req, res, url);
    } catch (err) {
      if (res.headersSent) return;
      const statusCode = err?.status === 413 ? 413 : err?.status === 400 ? 400 : 500;
      const code = statusCode === 413 ? 'payload_too_large' : statusCode === 400 ? 'invalid_json' : 'invalid';
      const error =
        statusCode === 413 ? 'corpo maior que 64 KiB' : statusCode === 400 ? 'JSON malformado' : 'falha no stub';
      sendJson(res, statusCode, { ok: false, error, code });
    }
    return;
  }
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'somente leitura', code: 'method_not_allowed' }));
    return;
  }
  if (url.pathname === '/api/v2/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('hello', {
      ok: true,
      agent: 'all',
      readonly: true,
      stub: true,
      server_time: health.server_time,
      events: ['hello', 'journal', 'status', 'ping', 'auth'],
    });
    send('status', status);
    const timer = setInterval(() => {
      send('ping', { ts: new Date().toISOString() });
    }, 5000);
    const watch = setInterval(() => {
      if (!currentSession(req)) {
        send('auth', { ok: false, code: 'unauthenticated' });
        clearInterval(timer);
        clearInterval(watch);
        res.end();
      }
    }, 30000);
    req.on('close', () => {
      clearInterval(timer);
      clearInterval(watch);
    });
    return;
  }
  const body = route(url);
  if (!body) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TRIADE API stub (contract examples, not the VPS) on http://127.0.0.1:${PORT}`);
});
