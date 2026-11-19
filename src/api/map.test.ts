import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attachInfra,
  buildQuery,
  mapAlerts,
  mapBars,
  mapLogs,
  mapRisk,
  mapStatus,
  mapStrategy,
  mapTimeline,
  num,
} from './map.ts';

const statusFixture = {
  ok: true,
  bind: '127.0.0.1:8765',
  readonly: true,
  auth_required: false,
  generated_at: '2026-11-19T11:14:31-03:00',
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
      trades_today: 0,
      open_positions: 0,
      log_file: 'var/b3/logs/live.jsonl',
    },
    nasdaq: {
      mode: 'paper',
      live_enabled: false,
      running: false,
      state_files: { paper: false, live: false },
      state: null,
      session_phase: 'outside_session',
      contract_current: null,
      day_loss: null,
      drawdown: null,
    },
    crypto: {
      mode: 'paper',
      live_enabled: false,
      running: false,
      halted: true,
      sticky_halt: true,
      halt_reason: 'drawdown máximo',
      state: {
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

describe('num', () => {
  it('keeps real zeros and drops redacted placeholders', () => {
    assert.equal(num(0), 0);
    assert.equal(num('<redacted>'), null);
    assert.equal(num(null), null);
    assert.equal(num('300'), 300);
  });
});

describe('mapStatus', () => {
  it('marks B3 live, leaves NASDAQ equity empty, and keeps crypto halt', () => {
    const status = mapStatus(statusFixture);
    assert.equal(status.agents.b3.live_enabled, true);
    assert.equal(status.agents.b3.mode, 'real');
    assert.equal(status.agents.b3.contract_current, 'WINZ26');
    assert.equal(status.agents.b3.state?.trades_today, 0);
    assert.equal(status.agents.b3.state?.realized_pnl_today, null);
    assert.equal(status.agents.b3.state?.day_start_equity, null);
    assert.equal(status.agents.b3.state?.positions.length, 0);
    assert.equal(status.kill_all.present, false);

    assert.equal(status.agents.nasdaq.state, null);
    assert.equal(status.agents.nasdaq.live_enabled, false);
    assert.equal(status.agents.nasdaq.mode, 'papel');
    assert.match(status.agents.nasdaq.missing_state_reason ?? '', /paper-state/);

    assert.equal(status.agents.crypto.state?.halted, true);
    assert.equal(status.agents.crypto.state?.sticky_halt, true);
    assert.equal(status.agents.crypto.state?.halt_reason, 'drawdown máximo');
    assert.equal(status.agents.crypto.state?.day, '2026-10-16');
    assert.equal(status.agents.crypto.session_phase, null);
  });
});

describe('mapTimeline', () => {
  it('reads /api/v2/timeline files and does not invent events', () => {
    const timeline = mapTimeline({
      ok: true,
      limit: 5,
      count: 1,
      truncated: false,
      agent: 'b3',
      mode: 'live',
      files: [{ agent: 'b3', mode: 'live', path: 'var/b3/journal/live.jsonl', exists: true }],
      events: [{ ts: '2026-11-19T12:27:50.202118+00:00', event: 'reconcile', ok: true, agent: 'b3', mode: 'live' }],
      generated_at: '2026-11-19T11:14:31-03:00',
    });
    assert.equal(timeline.events.length, 1);
    assert.equal(timeline.events[0].event, 'reconcile');
    assert.equal(timeline.events[0].mode, 'live');
    assert.equal(timeline.events[0].pnl, undefined);
    assert.equal(timeline.sources[0].path, 'var/b3/journal/live.jsonl');
    assert.equal(timeline.total_matched, null);
    assert.equal(timeline.missing.length, 0);
  });
});

describe('mapRisk', () => {
  it('maps consumption and leaves YAML nulls null', () => {
    const risk = mapRisk(
      {
        ok: true,
        agent: 'b3',
        mode: 'live',
        profile: 'micro_live',
        currency: 'BRL',
        state_exists: true,
        halted: false,
        equity_current: '<redacted>',
        limits: {
          daily_loss_limit: 300,
          max_trades_per_day: 5,
          max_consecutive_losses: 3,
          max_open_positions: 1,
          max_qty: 1,
          max_qty_by_symbol: { WIN: 1 },
          max_daily_drawdown: 0.04,
          allowed_symbols: ['WIN'],
          no_new_entries_after: '17:00',
          flatten_at: '17:30',
          stop_required: null,
          flatten_on_halt: null,
        },
        consumption: {
          daily_loss: { used: null, limit: 300, ratio: null },
          trades_today: { used: 0, limit: 5, ratio: 0 },
          consecutive_losses: { used: 0, limit: 3, ratio: 0 },
          open_positions: { used: 0, limit: 1, ratio: 0 },
          drawdown: { used_pct: null, limit_pct: 0.04, ratio: 0 },
        },
        session_phase: 'accepting_entries',
        contract_current: 'WINZ26',
      },
      'b3'
    );
    assert.equal(risk.limits.daily_loss_limit, 300);
    assert.equal(risk.limits.stop_required, null);
    assert.equal(risk.limits.flatten_on_halt, null);
    assert.equal(risk.usage.day_loss, null);
    assert.equal(risk.usage.trades_today, 0);
    assert.equal(risk.usage.drawdown_pct, null);
    assert.equal(risk.equity_current, null);
    assert.equal(risk.session.flatten_time, '17:30');
    assert.deepEqual(risk.limits.symbols, ['WIN']);
    assert.equal(risk.limits.max_qty.WIN, 1);
  });

  it('does not fill NASDAQ research limits from B3 micro_live', () => {
    const risk = mapRisk(
      {
        ok: true,
        agent: 'nasdaq',
        mode: 'paper',
        profile: 'research',
        state_exists: false,
        equity_current: null,
        limits: {
          max_trades_per_day: 4,
          max_daily_drawdown: 0.06,
          daily_loss_limit: null,
          max_consecutive_losses: null,
        },
        consumption: { daily_loss: { used: null, ratio: null } },
        session_phase: 'outside_session',
      },
      'nasdaq'
    );
    assert.equal(risk.state_exists, false);
    assert.equal(risk.limits.daily_loss_limit, null);
    assert.equal(risk.limits.max_consecutive_losses, null);
    assert.equal(risk.limits.max_trades_per_day, 4);
    assert.equal(risk.usage.day_loss, null);
    assert.equal(risk.equity_current, null);
  });
});

describe('mapBars', () => {
  it('normalizes ohlcv keys and reports a missing NASDAQ snapshot', () => {
    const bars = mapBars(
      {
        ok: true,
        agent: 'b3',
        symbol: 'WIN',
        tf: '5m',
        exists: true,
        bars: [{ ts: '2026-11-19T09:10:00+00:00', symbol: 'WIN', o: 169095, h: 169225, l: 169015, c: 169115, v: 19940, n: null, timeframe: '5m' }],
      },
      'b3',
      '5m'
    );
    assert.equal(bars.bars[0].open, 169095);
    assert.equal(bars.bars[0].close, 169115);
    assert.equal(bars.bars[0].volume, 19940);
    assert.equal(bars.exists, true);

    const empty = mapBars({ ok: true, agent: 'nasdaq', exists: false, bars: [] }, 'nasdaq', '5m');
    assert.equal(empty.bars.length, 0);
    assert.match(empty.note ?? '', /recent-bars/);
  });

  it('explains an unmatched timeframe instead of resampling', () => {
    const mismatch = mapBars(
      { ok: true, exists: true, tf: '5m', bars: [] },
      'b3',
      '1m'
    );
    assert.match(mismatch.note ?? '', /Sem resample/);
    assert.equal(mismatch.bars.length, 0);
  });
});

describe('mapAlerts and mapLogs', () => {
  it('uses derived alerts and systemd_journal lines', () => {
    const alerts = mapAlerts({
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
      note: 'Alertas derivados em tempo de leitura.',
    });
    assert.equal(alerts.alerts[0].origin, 'halt');
    assert.equal(alerts.alerts[0].acknowledged, false);
    assert.equal(alerts.alerts[0].mode, 'unknown');

    const logs = mapLogs(
      {
        ok: true,
        agent: 'b3',
        mode_requested: 'effective',
        mode: 'live',
        path: 'var/b3/logs/live.jsonl',
        exists: true,
        entries: [{ ts: '2026-11-19T12:27:50.202475+00:00', level: 'INFO', agent: 'b3', msg: 'reconciliação ok' }],
        systemd_journal: ['2026-11-19T12:27:49+00:00 triade-agent-b3.service started'],
      },
      'b3'
    );
    assert.equal(logs.mode, 'live');
    assert.equal(logs.entries[0].msg, 'reconciliação ok');
    assert.equal(logs.systemd_journal.length, 1);
  });
});

describe('attachInfra', () => {
  it('treats a listening 18863 with a timed-out pong as up', () => {
    const status = mapStatus(statusFixture);
    const infra = {
      ok: true,
      generated_at: '2026-11-19T11:14:31-03:00',
      dashboard: { bind: '127.0.0.1:8765', readonly: true, version: '4e219de', commit_hash: '4e219de', branch: 'frontend-draft', linger: 'no' as const },
      server_clock_utc: '',
      server_clock_brt: '2026-11-19T11:14:31-03:00',
      disk_var: { path: 'var/', used_mb: null, total_mb: null, used_pct: null, inode_pct: null, journal_largest_file: null, journal_largest_mb: null },
      units: [{ agent: 'b3' as const, role: 'agent' as const, unit: 'triade-agent-b3', active: 'active', enabled: 'disabled' }],
      ports: [
        { port: 18863, service: 'ponte live', binds: ['127.0.0.1:18863'], listening: true, localhost_only: true, unsafe_binds: [], pong: false, note: 'timed out' },
        { port: 18861, service: 'ponte oficial', binds: ['127.0.0.1:18861'], listening: true, localhost_only: true, unsafe_binds: [], pong: true },
      ],
      terminals: [],
      unsafe_binds_total: [],
    };
    const merged = attachInfra(status, infra);
    assert.equal(merged.agents.b3.bridge.listen?.port, 18863);
    assert.equal(merged.agents.b3.bridge.listen?.listening, true);
    assert.equal(merged.agents.b3.bridge.check?.ok, true);
    assert.equal(merged.agents.b3.bridge.check?.pong, false);
    assert.match(merged.agents.b3.bridge.note ?? '', /18863/);
    assert.equal(merged.agents.b3.units.agent.active, 'active');
    assert.equal(merged.agents.crypto.bridge.applicable, false);
  });
});

describe('mapStrategy', () => {
  it('keeps env variable names and drops nothing into a fake equity label', () => {
    const config = mapStrategy(
      {
        ok: true,
        agent: 'b3',
        live_enabled: true,
        env_key_names_only: ['B3_MT5_LOGIN', 'B3_MT5_PASSWORD', 'B3_MT5_SERVER'],
        config: {
          paper_venue: 'simulate',
          strategy: { name: 'orb_vwap_trend', orb_minutes: 30 },
          micro_live: { max_qty: 1, equity: 1000 },
          mt5: { login_env: 'B3_MT5_LOGIN', demo: false },
          notifications: { telegram_enabled: false },
        },
      },
      'b3'
    );
    assert.equal(config.live_enabled, true);
    assert.equal(config.strategy_name, 'orb_vwap_trend');
    assert.equal(config.micro_live_params.max_qty, 1);
    assert.ok(config.env_key_names_only.includes('B3_MT5_LOGIN'));
    assert.equal(config.micro_live_params['notifications.telegram_enabled'], undefined);
  });
});

describe('buildQuery', () => {
  it('targets timeline v2 filters including mode=all', () => {
    const qs = buildQuery({ agent: 'b3', mode: 'all', limit: 200, event: 'trade' }, { keepAll: true });
    assert.equal(qs, '?agent=b3&mode=all&limit=200&event=trade');
  });
});
