/**
 * Local /api/v2 stub built from the contract examples.
 * Responses set stub:true on /health so the UI shows STUB LOCAL.
 * This is not the VPS and must not be treated as live account data.
 */
import http from 'node:http';

const PORT = Number(process.env.STUB_PORT || 8766);

const health = {
  ok: true,
  bind: `127.0.0.1:${PORT}`,
  readonly: true,
  auth_required: false,
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

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || 'http://127.0.0.1:3000';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'somente leitura' }));
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
      events: ['hello', 'journal', 'status', 'ping'],
    });
    send('status', status);
    const timer = setInterval(() => {
      send('ping', { ts: new Date().toISOString() });
    }, 5000);
    req.on('close', () => clearInterval(timer));
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
