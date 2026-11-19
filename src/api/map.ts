import {
  AgentId,
  AgentKillState,
  AgentSummary,
  AlertItem,
  AlertsPayload,
  AnalystEvent,
  AuditEntry,
  AuditPayload,
  BacktestMetricsBlock,
  BacktestReport,
  BridgeStatus,
  CurrencyCode,
  ExportState,
  HealthResponse,
  InfraResponse,
  LogEntry,
  LogsPayload,
  OhlcvBar,
  PnlResponse,
  PositionDict,
  RecentBarsResponse,
  RiskResponse,
  StatusResponse,
  StrategyConfig,
  SystemdUnitState,
  TimelineEvent,
  TimelineResponse,
  TimelineSourceInfo,
} from '../types/triade';

export const AGENT_IDS: AgentId[] = ['b3', 'nasdaq', 'crypto'];

const MARKET: Record<AgentId, string> = {
  b3: 'B3 Futuros (WIN)',
  nasdaq: 'NASDAQ',
  crypto: 'Cripto',
};

const DEFAULT_CCY: Record<AgentId, CurrencyCode> = {
  b3: 'BRL',
  nasdaq: 'USD',
  crypto: 'USDT',
};

const DEFAULT_TZ: Record<AgentId, string> = {
  b3: 'America/Sao_Paulo',
  nasdaq: 'America/New_York',
  crypto: 'America/Sao_Paulo',
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Finite numbers only. Strings such as "<redacted>" stay null — never coerced into a figure. */
export function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !value.includes('redacted')) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  return null;
}

export function bool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

export function isAgentId(value: unknown): value is AgentId {
  return value === 'b3' || value === 'nasdaq' || value === 'crypto';
}

function currencyOf(value: unknown, agent: AgentId): CurrencyCode {
  if (value === 'BRL' || value === 'USD' || value === 'USDT') return value;
  return DEFAULT_CCY[agent];
}

function normalizeActive(value: unknown): SystemdUnitState['active'] {
  const text = typeof value === 'string' ? value : '';
  if (text === 'active' || text === 'inactive' || text === 'failed' || text === 'activating') {
    return text;
  }
  return 'unknown';
}

function normalizeEnabled(value: unknown): SystemdUnitState['enabled'] {
  const text = typeof value === 'string' ? value : '';
  if (text === 'enabled' || text === 'disabled' || text === 'static') return text;
  return 'unknown';
}

function mapUnit(
  value: unknown,
  fallbackName: string,
  runningHint?: boolean
): SystemdUnitState {
  if (typeof value === 'string') {
    return { unit: fallbackName, active: normalizeActive(value), enabled: 'unknown' };
  }
  const record = asRecord(value);
  if (!record) {
    return {
      unit: fallbackName,
      active: runningHint === undefined ? 'unknown' : runningHint ? 'active' : 'inactive',
      enabled: 'unknown',
    };
  }
  return {
    unit: str(record.unit) ?? fallbackName,
    active: normalizeActive(record.active ?? record.status),
    enabled: normalizeEnabled(record.enabled),
  };
}

function mapPosition(value: unknown, agent: AgentId, mode: 'live' | 'paper'): PositionDict | null {
  const record = asRecord(value);
  if (!record) return null;
  const qty = num(record.qty);
  if (qty === null) return null;
  const sideRaw = str(record.side);
  return {
    symbol: str(record.symbol) ?? '',
    contract: str(record.contract) ?? '',
    qty,
    avg_price: num(record.avg_price) ?? num(record.price) ?? Number.NaN,
    stop_price: num(record.stop_price ?? record.stop),
    target_price: num(record.target_price ?? record.target),
    opened_at: str(record.opened_at) ?? '',
    strategy: str(record.strategy) ?? '',
    entry_reason: str(record.entry_reason) ?? '',
    entry_fee: num(record.entry_fee) ?? num(record.fee) ?? Number.NaN,
    client_order_id: str(record.client_order_id) ?? '',
    source: record.source === 'llm' ? 'llm' : 'python',
    max_hold_until: str(record.max_hold_until),
    side: sideRaw === 'buy' || sideRaw === 'sell' ? sideRaw : qty > 0 ? 'buy' : 'sell',
    current_price: num(record.current_price),
    unrealized_pnl: num(record.unrealized_pnl),
  };
}

function mapState(value: unknown, agent: AgentId, mode: 'live' | 'paper'): ExportState | null {
  const record = asRecord(value);
  if (!record) return null;
  const drawdownRecord = asRecord(record.drawdown);
  const positions = asArray(record.positions)
    .map((item) => mapPosition(item, agent, mode))
    .filter((item): item is PositionDict => item !== null);
  return {
    path: str(record.path) ?? undefined,
    day: str(record.day),
    equity_peak: num(record.equity_peak),
    day_start_equity: num(record.day_start_equity),
    day_peak_equity: num(record.day_peak_equity),
    cash: num(record.cash),
    equity_current: num(record.equity_current),
    realized_pnl_today: num(record.realized_pnl_today),
    trades_today: num(record.trades_today),
    halted: bool(record.halted) ?? false,
    sticky_halt: bool(record.sticky_halt) ?? false,
    halt_reason: str(record.halt_reason),
    block_entries: bool(record.block_entries) ?? false,
    consecutive_losses: num(record.consecutive_losses),
    positions,
    drawdown: drawdownRecord ? num(drawdownRecord.used_abs) : num(record.drawdown),
    drawdown_pct: drawdownRecord ? num(drawdownRecord.used_pct) : num(record.drawdown_pct),
    broker: record.broker === null ? null : asRecord(record.broker) ? {} : undefined,
  };
}

function mapKill(agent: Record<string, unknown>, killAll: boolean): AgentKillState {
  const kill = asRecord(agent.kill);
  const agentFlag = bool(kill?.agent) ?? bool(asRecord(kill?.kill_agent)?.present) ?? false;
  const allFlag =
    bool(kill?.kill_all) ?? bool(asRecord(kill?.kill_all)?.present) ?? killAll;
  return {
    kill_agent: { present: agentFlag, reason: str(asRecord(kill?.kill_agent)?.reason) },
    kill_all: { present: allFlag, reason: str(asRecord(kill?.kill_all)?.reason) },
    blocked: agentFlag || allFlag || bool(kill?.blocked) === true,
  };
}

function emptyBridge(agent: AgentId): BridgeStatus {
  if (agent === 'crypto') {
    return { applicable: false, note: 'Sem ponte MT5' };
  }
  return { applicable: true, note: 'Saúde da ponte vem de /api/v2/infra' };
}

function mapAgent(id: AgentId, value: unknown, killAll: boolean): AgentSummary {
  const record = asRecord(value) ?? {};
  const modeRaw = str(record.mode);
  const liveEnabled = bool(record.live_enabled) ?? (modeRaw === 'live' || modeRaw === 'real');
  const mode: 'live' | 'paper' = liveEnabled || modeRaw === 'live' || modeRaw === 'real' ? 'live' : 'paper';
  const stateFiles = asRecord(record.state_files);
  const state = mapState(record.state, id, mode);
  const units = asRecord(record.units) ?? {};
  const running = bool(record.running);
  const agentDrawdown = asRecord(record.drawdown);
  if (state && state.drawdown === null && agentDrawdown) {
    state.drawdown = num(agentDrawdown.used_abs);
    state.drawdown_pct = num(agentDrawdown.used_pct);
  }
  if (state && state.trades_today === null) {
    state.trades_today = num(record.trades_today);
  }
  if (state && state.consecutive_losses == null) {
    const fromAgent = num(record.consecutive_losses);
    if (fromAgent !== null) state.consecutive_losses = fromAgent;
  }
  const phase = str(record.session_phase);
  const sessionPhase =
    phase === 'accepting_entries' ||
    phase === 'manage_only' ||
    phase === 'flatten_window' ||
    phase === 'outside_session'
      ? phase
      : null;
  const logs = asArray(record.logs)
    .map((item) => mapLogEntry(item, id, mode))
    .filter((item): item is LogEntry => item !== null);

  let missing: string | null = null;
  if (!state) {
    const paper = stateFiles ? bool(stateFiles.paper) : null;
    const live = stateFiles ? bool(stateFiles.live) : null;
    missing = `Ainda não há var/${id}/${mode}-state.json neste servidor${
      paper !== null || live !== null ? ` (paper=${String(paper)} live=${String(live)})` : ''
    }.`;
  }

  return {
    agent: id,
    label: str(record.label) ?? (id === 'b3' ? 'B3' : id === 'nasdaq' ? 'NASDAQ' : 'Cripto'),
    market: str(record.market) ?? MARKET[id],
    currency: currencyOf(record.currency, id),
    timezone: str(record.timezone) ?? DEFAULT_TZ[id],
    contract_current: str(record.contract_current) ?? undefined,
    mode: liveEnabled ? 'real' : 'papel',
    live_enabled: liveEnabled,
    paper_venue: str(record.paper_venue) ?? 'unknown',
    units: {
      agent: mapUnit(units.agent, `triade-agent-${id}`, running ?? undefined),
      xvfb: units.xvfb ? mapUnit(units.xvfb, `triade-xvfb-${id}`) : undefined,
      bridge: units.bridge ? mapUnit(units.bridge, `triade-bridge-${id}`) : undefined,
    },
    kill: mapKill(record, killAll),
    state,
    missing_state_reason: missing,
    bridge: emptyBridge(id),
    log_file: str(record.log_file) ?? undefined,
    logs,
    session_phase: sessionPhase,
    no_new_trades_after: str(record.no_new_trades_after),
    flatten_time: str(record.flatten_time ?? record.flatten_at),
  };
}

export function mapStatus(raw: unknown): StatusResponse {
  const record = asRecord(raw) ?? {};
  const killAll =
    bool(record.kill_all) ?? bool(asRecord(record.kill_all)?.present) ?? false;
  const agentsRaw = asRecord(record.agents) ?? {};
  const agents = {} as Record<AgentId, AgentSummary>;
  for (const id of AGENT_IDS) {
    agents[id] = mapAgent(id, agentsRaw[id], killAll);
  }
  return {
    ok: bool(record.ok) ?? false,
    bind: str(record.bind) ?? '',
    readonly: bool(record.readonly) ?? true,
    kill_all: { present: killAll },
    generated_at: str(record.generated_at) ?? str(record.server_time_local) ?? '',
    agents,
  };
}

export function mapHealth(raw: unknown): HealthResponse {
  const record = asRecord(raw) ?? {};
  const git = asRecord(record.git);
  return {
    ok: bool(record.ok) ?? false,
    bind: str(record.bind) ?? '',
    readonly: bool(record.readonly) ?? true,
    uptime_seconds: num(record.uptime_seconds) ?? undefined,
    version: str(record.version) ?? str(git?.commit_short) ?? undefined,
    auth_required: bool(record.auth_required) ?? undefined,
    authenticated: bool(record.authenticated) ?? undefined,
    server_time: str(record.server_time) ?? undefined,
    timezone: str(record.timezone) ?? undefined,
    stub: bool(record.stub) ?? undefined,
    note: str(record.note) ?? undefined,
  };
}

/** live/paper only when the payload or a journal path says so. Never assume paper. */
export function journalModeFromHint(
  ...hints: Array<string | null | undefined>
): 'live' | 'paper' | undefined {
  for (const hint of hints) {
    if (!hint) continue;
    if (hint === 'live' || hint === 'paper') return hint;
    if (/(^|\/)live(\.jsonl)?$/.test(hint) || hint.includes('/logs/live') || hint.includes('/journal/live')) {
      return 'live';
    }
    if (/(^|\/)paper(\.jsonl)?$/.test(hint) || hint.includes('/logs/paper') || hint.includes('/journal/paper')) {
      return 'paper';
    }
  }
  return undefined;
}

function mapTimelineEvent(value: unknown, fallback?: { agent?: AgentId; mode?: 'live' | 'paper'; path?: string }): TimelineEvent | null {
  const record = asRecord(value);
  if (!record) return null;
  const agent = isAgentId(record.agent) ? record.agent : fallback?.agent;
  if (!agent) return null;
  const mode: 'live' | 'paper' | 'unknown' =
    journalModeFromHint(str(record.mode), str(record.source_file), str(record.path), str(record.arquivo), fallback?.path) ??
    fallback?.mode ??
    'unknown';
  return {
    ts: str(record.ts) ?? '',
    event: str(record.event) ?? 'unknown',
    agent,
    mode,
    source_file: str(record.source_file) ?? fallback?.path ?? '',
    symbol: str(record.symbol) ?? undefined,
    contract: str(record.contract) ?? undefined,
    side: str(record.side) ?? undefined,
    reason: str(record.reason) ?? undefined,
    rationale: str(record.rationale) ?? undefined,
    sinal: str(record.sinal) ?? undefined,
    strategy: str(record.strategy) ?? undefined,
    source: str(record.source) ?? undefined,
    stop: num(record.stop),
    target: num(record.target),
    qty: num(record.qty) ?? undefined,
    price: num(record.price) ?? undefined,
    fee: num(record.fee) ?? undefined,
    fees: num(record.fees) ?? undefined,
    pnl: num(record.pnl) ?? undefined,
    entry: num(record.entry) ?? undefined,
    exit: num(record.exit) ?? undefined,
    entry_reason: str(record.entry_reason) ?? undefined,
    exit_reason: str(record.exit_reason) ?? undefined,
    client_order_id: str(record.client_order_id) ?? undefined,
    motivo: str(record.motivo) ?? undefined,
    detalhe: str(record.detalhe) ?? undefined,
    ok: bool(record.ok) ?? undefined,
    canceladas: num(record.canceladas) ?? undefined,
    erro: str(record.erro) ?? undefined,
    arquivo: str(record.arquivo) ?? undefined,
    preco: num(record.preco) ?? undefined,
    adotados: num(record.adotados) ?? undefined,
    divergencias: Array.isArray(record.divergencias)
      ? record.divergencias.filter((item): item is string => typeof item === 'string')
      : undefined,
  };
}

export function mapTimeline(raw: unknown): TimelineResponse {
  const record = asRecord(raw) ?? {};
  const files = asArray(record.files ?? record.sources);
  const sources = files
    .map((item) => {
      const file = asRecord(item);
      if (!file || !isAgentId(file.agent)) return null;
      const path = str(file.path) ?? '';
      const source: TimelineSourceInfo = {
        agent: file.agent,
        path,
        exists: bool(file.exists) ?? false,
        kind: 'journal',
        mode: journalModeFromHint(str(file.mode), path) ?? 'unknown',
      };
      return source;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const defaultAgent = isAgentId(record.agent) ? record.agent : undefined;
  const defaultMode = journalModeFromHint(str(record.mode));
  const events = asArray(record.events)
    .map((item) => {
      const recordEvent = asRecord(item);
      const agent = recordEvent && isAgentId(recordEvent.agent) ? recordEvent.agent : defaultAgent;
      const forAgent = agent
        ? sources.filter((source) => source.agent === agent && source.mode !== 'unknown')
        : [];
      const unique = new Set(forAgent.map((source) => source.mode));
      const inherited = unique.size === 1 ? (forAgent[0].mode as 'live' | 'paper') : undefined;
      const matchedPath = recordEvent
        ? forAgent.find((source) => source.path && source.path === str(recordEvent.source_file))?.path
        : undefined;
      return mapTimelineEvent(item, {
        agent: defaultAgent,
        mode: inherited ?? defaultMode,
        path: matchedPath ?? (forAgent.length === 1 ? forAgent[0].path : undefined),
      });
    })
    .filter((item): item is TimelineEvent => item !== null);
  const missing = sources
    .filter((source) => !source.exists)
    .map((source) => ({
      agent: source.agent,
      path: source.path,
      reason: 'arquivo ausente',
    }));
  const count = num(record.count) ?? events.length;
  return {
    ok: bool(record.ok) ?? false,
    readonly: bool(record.readonly) ?? true,
    exemplo: bool(record.exemplo) ?? bool(record.stub) ?? false,
    agents: defaultAgent ? [defaultAgent] : AGENT_IDS.filter((id) => events.some((ev) => ev.agent === id) || sources.some((s) => s.agent === id)),
    since: str(record.since) ?? '',
    until: str(record.until) ?? '',
    after: str(record.after),
    window: str(record.window) === 'start' || str(record.window) === 'all' ? (str(record.window) as 'start' | 'all') : 'latest',
    count,
    total_matched: num(record.total_matched),
    truncated: bool(record.truncated) ?? false,
    sources,
    missing,
    generated_at: str(record.generated_at) ?? '',
    events,
  };
}

export function mapTrades(raw: unknown): TimelineEvent[] {
  const record = asRecord(raw) ?? {};
  const agent = isAgentId(record.agent) ? record.agent : undefined;
  const mode = str(record.mode) === 'live' ? 'live' : str(record.mode) === 'paper' ? 'paper' : undefined;
  return asArray(record.trades ?? record.events)
    .map((item) => {
      const ev = asRecord(item);
      if (ev && !ev.event) ev.event = 'trade';
      return mapTimelineEvent(ev ?? item, { agent, mode });
    })
    .filter((item): item is TimelineEvent => item !== null);
}

export function mapPnl(raw: unknown, agent: AgentId): PnlResponse {
  const record = asRecord(raw) ?? {};
  const summary = asRecord(record.summary) ?? {};
  const mode = str(record.mode) === 'live' ? 'live' : 'paper';
  return {
    ok: bool(record.ok) ?? false,
    agent: isAgentId(record.agent) ? record.agent : agent,
    mode,
    currency: currencyOf(record.currency, agent),
    count: num(record.count) ?? 0,
    incomplete: bool(record.incomplete) ?? false,
    summary: {
      net_pnl: num(summary.net_pnl),
      fees: num(summary.fees),
      wins: num(summary.wins),
      losses: num(summary.losses),
      win_rate: num(summary.win_rate),
      expectancy: num(summary.expectancy),
    },
    series: asArray(record.series).map((item) => {
      const point = asRecord(item) ?? {};
      return {
        ts: str(point.ts) ?? '',
        symbol: str(point.symbol) ?? undefined,
        source: str(point.source) ?? undefined,
        trade_pnl: num(point.trade_pnl ?? point.pnl),
        fees: num(point.fees),
        cumulative_pnl: num(point.cumulative_pnl),
      };
    }),
    note:
      str(record.note) ??
      'Série construída a partir de eventos event=trade do journal. A curva intra-diária de equity não é persistida.',
  };
}

function consumptionRatio(block: unknown): { used: number | null; ratio: number | null } {
  const record = asRecord(block);
  if (!record) return { used: null, ratio: null };
  return { used: num(record.used), ratio: num(record.ratio) };
}

export function mapRisk(raw: unknown, agent: AgentId): RiskResponse {
  const record = asRecord(raw) ?? {};
  const limits = asRecord(record.limits) ?? {};
  const consumption = asRecord(record.consumption) ?? asRecord(record.usage) ?? {};
  const daily = consumptionRatio(consumption.daily_loss);
  const trades = consumptionRatio(consumption.trades_today);
  const losses = consumptionRatio(consumption.consecutive_losses);
  const positions = consumptionRatio(consumption.open_positions);
  const drawdown = asRecord(consumption.drawdown);
  const mode = str(record.mode) === 'live' ? 'live' : 'paper';
  const phase = str(record.session_phase ?? asRecord(record.session)?.phase);
  const sessionPhase =
    phase === 'accepting_entries' ||
    phase === 'manage_only' ||
    phase === 'flatten_window' ||
    phase === 'outside_session'
      ? phase
      : null;
  const qtyBySymbol = asRecord(limits.max_qty_by_symbol);
  const maxQty: Record<string, number> = {};
  if (qtyBySymbol) {
    for (const [key, value] of Object.entries(qtyBySymbol)) {
      const parsed = num(value);
      if (parsed !== null) maxQty[key] = parsed;
    }
  } else if (num(limits.max_qty) !== null) {
    maxQty['*'] = num(limits.max_qty)!;
  }
  const symbols = asArray(limits.allowed_symbols ?? limits.symbols)
    .map((item) => (typeof item === 'string' ? item : ''))
    .filter(Boolean);
  const usageRecord = asRecord(record.usage);
  const stateExists = bool(record.state_exists);
  return {
    ok: bool(record.ok) ?? false,
    agent: isAgentId(record.agent) ? record.agent : agent,
    mode,
    profile: str(record.profile) === 'research' ? 'research' : 'micro_live',
    currency: currencyOf(record.currency, agent),
    timezone: str(record.timezone) ?? DEFAULT_TZ[agent],
    session: {
      no_new_trades_after: str(limits.no_new_entries_after ?? asRecord(record.session)?.no_new_trades_after),
      flatten_time: str(limits.flatten_at ?? asRecord(record.session)?.flatten_time),
      phase: sessionPhase,
    },
    limits: {
      symbols,
      max_qty: maxQty,
      max_open_positions: num(limits.max_open_positions),
      max_trades_per_day: num(limits.max_trades_per_day),
      daily_loss_limit: num(limits.daily_loss_limit),
      daily_loss_limit_pct: num(limits.daily_loss_limit_pct),
      max_consecutive_losses: num(limits.max_consecutive_losses),
      max_drawdown_pct: num(limits.max_daily_drawdown ?? limits.max_drawdown_pct),
      sticky_drawdown_halt: bool(limits.sticky_drawdown_halt) ?? false,
      max_trades_per_source: {},
      stop_required: bool(limits.stop_required),
      flatten_on_halt: bool(limits.flatten_on_halt),
      emergency_stop_pct: num(limits.emergency_stop_pct),
      one_trade_per_day: bool(limits.one_trade_per_day),
    },
    usage: {
      trades_today: trades.used ?? num(usageRecord?.trades_today),
      consecutive_losses: losses.used ?? num(usageRecord?.consecutive_losses),
      open_positions: positions.used ?? num(usageRecord?.open_positions),
      open_qty: num(usageRecord?.open_qty),
      day_loss: daily.used ?? num(usageRecord?.day_loss),
      day_loss_pct_of_limit: daily.ratio ?? num(usageRecord?.day_loss_pct_of_limit),
      drawdown_pct: num(drawdown?.used_pct) ?? num(usageRecord?.drawdown_pct),
      trades_by_source: {},
      halted: bool(record.halted) ?? bool(usageRecord?.halted) ?? false,
      sticky_halt: bool(record.sticky_halt) ?? bool(usageRecord?.sticky_halt) ?? false,
      halt_reason: str(record.halt_reason) ?? str(usageRecord?.halt_reason),
      block_entries: bool(record.block_entries) ?? false,
      kill_blocked: bool(usageRecord?.kill_blocked) ?? false,
    },
    recent_rejects: [],
    source_files: {
      config: `configs/${agent}.yaml`,
      state:
        stateExists === false
          ? `var/${agent}/${mode}-state.json (ausente)`
          : `var/${agent}/${mode}-state.json`,
    },
    generated_at: str(record.generated_at) ?? '',
    state_exists: stateExists ?? undefined,
    equity_current: num(record.equity_current),
    day: str(record.day),
  };
}

export function mapAnalystEvents(raw: unknown): { events: AnalystEvent[]; files: Array<{ agent: AgentId; path: string; exists: boolean }> } {
  const record = asRecord(raw) ?? {};
  const events: AnalystEvent[] = [];
  for (const item of asArray(record.events)) {
    const ev = asRecord(item);
    if (!ev || !isAgentId(ev.agent)) continue;
    const volume = num(ev.volume);
    const media = num(ev.media);
    const side = str(ev.side);
    const rationale = str(ev.rationale);
    const motivo = str(ev.motivo);
    events.push({
      ts: str(ev.ts) ?? '',
      kind: str(ev.kind) ?? 'unknown',
      agent: ev.agent,
      symbol: str(ev.symbol) ?? '',
      ...(volume != null ? { volume } : {}),
      ...(media != null ? { media } : {}),
      ...(side != null ? { side } : {}),
      ...(rationale != null ? { rationale } : {}),
      ...(motivo != null ? { motivo } : {}),
    });
  }
  const files = asArray(record.files)
    .map((item) => {
      const file = asRecord(item);
      if (!file || !isAgentId(file.agent)) return null;
      return {
        agent: file.agent,
        path: str(file.path) ?? '',
        exists: bool(file.exists) ?? false,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  return { events, files };
}

function mapBar(value: unknown): OhlcvBar | null {
  const record = asRecord(value);
  if (!record) return null;
  const open = num(record.o ?? record.open);
  const high = num(record.h ?? record.high);
  const low = num(record.l ?? record.low);
  const close = num(record.c ?? record.close);
  if (open === null || high === null || low === null || close === null) return null;
  return {
    ts: str(record.ts) ?? '',
    open,
    high,
    low,
    close,
    volume: num(record.v ?? record.volume) ?? 0,
  };
}

export function mapBars(raw: unknown, agent: AgentId, requestedTf: '1m' | '5m' | '15m'): RecentBarsResponse {
  const record = asRecord(raw) ?? {};
  const fileTf = str(record.tf ?? record.timeframe);
  const exists = bool(record.exists) ?? false;
  const bars = asArray(record.bars).map(mapBar).filter((item): item is OhlcvBar => item !== null);
  let note = str(record.note);
  if (exists && bars.length === 0 && fileTf && fileTf !== requestedTf) {
    note = `Sem resample: o snapshot está em ${fileTf} e o pedido foi ${requestedTf}.`;
  } else if (!exists) {
    note = note ?? `Ainda não há var/${agent}/recent-bars.json neste servidor.`;
  } else if (bars.some(() => false)) {
    note = note;
  }
  return {
    ok: bool(record.ok) ?? false,
    agent: isAgentId(record.agent) ? record.agent : agent,
    symbol: str(record.symbol) ?? '',
    timeframe: requestedTf,
    source_file: `var/${agent}/recent-bars.json`,
    exists,
    bars,
    note,
    updated_at: str(record.updated_at),
  };
}

function mapMetrics(value: unknown, currency: CurrencyCode): BacktestMetricsBlock | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    trades: num(record.trades),
    wins: num(record.wins),
    losses: num(record.losses),
    win_rate: num(record.win_rate),
    profit_factor: num(record.profit_factor),
    max_drawdown: num(record.max_drawdown),
    max_drawdown_pct: num(record.max_drawdown_pct),
    sharpe: num(record.sharpe),
    expectancy: num(record.expectancy),
    net_pnl: num(record.net_pnl),
    fees: num(record.fees),
    avg_win: num(record.avg_win),
    avg_loss: num(record.avg_loss),
    initial_equity: num(record.initial_equity),
    ending_equity: num(record.ending_equity),
    currency: currencyOf(record.currency, 'b3') === 'BRL' && record.currency ? currencyOf(record.currency, 'b3') : currency,
    days: num(record.days),
    halted: bool(record.halted) ?? false,
    halt_reason: str(record.halt_reason),
  };
}

export function mapBacktests(raw: unknown): BacktestReport[] {
  const record = asRecord(raw) ?? {};
  const reports: BacktestReport[] = [];
  for (const item of asArray(record.reports ?? raw)) {
    const report = asRecord(item);
    if (!report || !isAgentId(report.agent)) continue;
    const data = asRecord(report.data) ?? {};
    const strategy = asRecord(report.strategy) ?? {};
    const currency = currencyOf(report.currency, report.agent);
    const byAssetRaw = asRecord(report.amostra_cheia_por_ativo);
    const byAsset: Record<string, BacktestMetricsBlock> = {};
    if (byAssetRaw) {
      for (const [symbol, block] of Object.entries(byAssetRaw)) {
        const mapped = mapMetrics(block, currency);
        if (mapped) byAsset[symbol] = mapped;
      }
    }
    const liveWarning = str(report.live_warning);
    reports.push({
      id: str(report.id) ?? report.agent,
      agent: report.agent,
      title: str(report.title) ?? str(strategy.name) ?? report.agent,
      strategy: {
        name: str(strategy.name) ?? '',
        params: {},
      },
      data: {
        path: str(data.path) ?? '',
        source: str(data.source) ?? '',
        start: str(data.start) ?? '',
        end: str(data.end) ?? '',
        bars: num(data.bars),
        disclaimer:
          str(data.disclaimer) ??
          'Métricas de backtest são de pesquisa e não são a conta live.',
      },
      amostra_cheia: mapMetrics(report.amostra_cheia, currency),
      dentro_da_amostra: mapMetrics(report.dentro_da_amostra, currency),
      fora_da_amostra: mapMetrics(report.fora_da_amostra, currency),
      ...(Object.keys(byAsset).length ? { amostra_cheia_por_ativo: byAsset } : {}),
      ...(liveWarning ? { live_warning: liveWarning } : {}),
    });
  }
  return reports;
}

function flattenPrimitives(value: unknown, prefix = ''): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const record = asRecord(value);
  if (!record) return out;
  for (const [key, child] of Object.entries(record)) {
    if (/password|secret|token|login/i.test(key) && !key.endsWith('_env')) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string' || typeof child === 'boolean') out[path] = child;
    else if (typeof child === 'number' && Number.isFinite(child)) out[path] = child;
    else if (Array.isArray(child)) {
      const simple = child.every((item) => ['string', 'number', 'boolean'].includes(typeof item));
      if (simple) out[path] = child.map(String).join(', ');
    } else if (child && typeof child === 'object') {
      Object.assign(out, flattenPrimitives(child, path));
    }
  }
  return out;
}

function symbolList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      const record = asRecord(item);
      return str(record?.symbol) ?? str(record?.name) ?? '';
    })
    .filter(Boolean);
}

export function mapStrategy(raw: unknown, agent: AgentId): StrategyConfig {
  const record = asRecord(raw) ?? {};
  const config = asRecord(record.config) ?? record;
  const strategy = asRecord(config.strategy) ?? {};
  const micro = asRecord(config.micro_live) ?? {};
  const risk = asRecord(config.risk) ?? {};
  const llm = asRecord(config.llm) ?? {};
  const costs = asRecord(config.costs) ?? {};
  const envNames = asArray(record.env_key_names_only)
    .filter((item): item is string => typeof item === 'string');
  for (const [key, value] of Object.entries(flattenPrimitives(config))) {
    if (key.endsWith('_env') && typeof value === 'string' && !envNames.includes(value)) {
      envNames.push(value);
    }
  }
  const boundsRaw = asArray(llm.parameters ?? config.llm_editable_bounds);
  const bounds: StrategyConfig['llm_editable_bounds'] = [];
  for (const item of boundsRaw) {
    const bound = asRecord(item);
    const key = bound ? str(bound.key) : null;
    if (!bound || !key) continue;
    const rawType = str(bound.type);
    const type: 'float' | 'int' | 'bool' = rawType === 'bool' || rawType === 'int' ? rawType : 'float';
    const current = bound.current;
    const min = num(bound.min);
    const max = num(bound.max);
    bounds.push({
      key,
      type,
      ...(min != null ? { min } : {}),
      ...(max != null ? { max } : {}),
      current: typeof current === 'boolean' || typeof current === 'number' ? current : false,
    });
  }
  const researchSymbols = symbolList(config.symbols);
  const liveSymbols = symbolList(micro.symbols ?? micro.allowed_symbols);
  return {
    agent,
    config_path: `configs/${agent}.yaml`,
    live_enabled: bool(record.live_enabled) ?? bool(config.live_enabled) ?? false,
    paper_venue: str(config.paper_venue) ?? str(record.paper_venue) ?? 'unknown',
    strategy_name: str(strategy.name) ?? str(record.strategy_name) ?? '',
    timezone: str(config.timezone) ?? DEFAULT_TZ[agent],
    symbols_research: researchSymbols,
    symbols_live: liveSymbols.length ? liveSymbols : researchSymbols,
    symbol_mode: str(config.symbol_mode) ?? str(asRecord(config.symbols_config)?.symbol_mode) ?? '',
    roll_sessions_before: num(config.roll_sessions_before) ?? undefined,
    contract_current: str(record.contract_current) ?? undefined,
    research_params: { ...flattenPrimitives(strategy), ...flattenPrimitives(risk) },
    micro_live_params: flattenPrimitives(micro),
    costs: {
      fee_per_unit_side: num(costs.fee_per_unit_side ?? config.fee_per_unit_side),
      slippage_ticks: num(costs.slippage_ticks ?? config.slippage_ticks),
    },
    llm_editable_bounds: bounds,
    env_key_names_only: envNames,
  };
}

export function telegramFlagFromConfig(raw: unknown): boolean | null {
  const record = asRecord(raw) ?? {};
  const config = asRecord(record.config) ?? record;
  const notifications = asRecord(config.notifications);
  return bool(notifications?.telegram_enabled);
}

function mapPort(value: unknown): InfraResponse['ports'][number] | null {
  const record = asRecord(value);
  if (!record) return null;
  const listen = asRecord(record.listen);
  const check = asRecord(record.check);
  const port = num(record.port ?? listen?.port);
  if (port === null) return null;
  const pongRaw = record.pong ?? check?.pong ?? check?.ok;
  let pong: boolean | null = null;
  if (typeof pongRaw === 'boolean') pong = pongRaw;
  else if (typeof pongRaw === 'string') {
    if (/time.?out|fail|error/i.test(pongRaw)) pong = false;
    else if (/ok|true/i.test(pongRaw)) pong = true;
  }
  const binds = asArray(record.binds ?? listen?.binds).filter((item): item is string => typeof item === 'string');
  const unsafe = asArray(record.unsafe_binds ?? listen?.unsafe_binds).filter(
    (item): item is string => typeof item === 'string'
  );
  const localhost =
    bool(record.localhost_only ?? listen?.localhost_only) ??
    (bool(record.safe) === true ? true : unsafe.length === 0 && binds.every((b) => b.startsWith('127.0.0.1') || b.startsWith('[::1]')));
  const listening = bool(record.listening ?? listen?.listening) ?? false;
  let note = str(record.note);
  if (port === 18863 && listening && pong === false) {
    note =
      note ??
      'Pong pode expirar enquanto o agente live ocupa a ponte (single-thread). Escuta ativa não significa ponte caída.';
  }
  return {
    port,
    service: str(record.service ?? record.role ?? record.label) ?? `porta ${port}`,
    binds,
    listening,
    localhost_only: localhost,
    unsafe_binds: unsafe,
    pong,
    note: note ?? undefined,
  };
}

function mapUnits(value: unknown): InfraResponse['units'] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const record = asRecord(item);
        if (!record || !str(record.unit)) return null;
        const agentRaw = record.agent;
        const agent: InfraResponse['units'][number]['agent'] =
          agentRaw === 'dashboard' || isAgentId(agentRaw) ? agentRaw : 'dashboard';
        const roleRaw = str(record.role);
        const role =
          roleRaw === 'agent' || roleRaw === 'bridge' || roleRaw === 'xvfb' || roleRaw === 'dashboard'
            ? roleRaw
            : 'agent';
        return {
          agent,
          role,
          unit: str(record.unit)!,
          active: str(record.active) ?? 'unknown',
          enabled: str(record.enabled) ?? 'unknown',
        };
      })
      .filter((item): item is InfraResponse['units'][number] => item !== null);
  }
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record)
    .map(([key, item]) => {
      const unit = mapUnit(item, key);
      return {
        agent: 'dashboard' as const,
        role: 'agent' as const,
        unit: unit.unit,
        active: unit.active,
        enabled: unit.enabled,
      };
    });
}

export function mapInfra(raw: unknown): InfraResponse {
  const record = asRecord(raw) ?? {};
  const dashboard = asRecord(record.dashboard) ?? {};
  const git = asRecord(record.git) ?? asRecord(dashboard.git) ?? {};
  const lingerRaw = record.linger ?? dashboard.linger;
  const linger: InfraResponse['dashboard']['linger'] =
    lingerRaw === true || lingerRaw === 'yes' ? 'yes' : lingerRaw === false || lingerRaw === 'no' ? 'no' : 'unknown';
  const disk = asRecord(record.disk) ?? asRecord(record.disk_var) ?? {};
  const ports = asArray(record.ports).map(mapPort).filter((item): item is NonNullable<typeof item> => item !== null);
  const terminalsRaw = record.terminals;
  let terminals: InfraResponse['terminals'] = [];
  if (Array.isArray(terminalsRaw)) {
    terminals = terminalsRaw
      .map((item) => {
        const term = asRecord(item);
        if (!term || (term.agent !== 'b3' && term.agent !== 'nasdaq')) return null;
        return {
          agent: term.agent,
          display: str(term.display) ?? '',
          vnc_port: num(term.vnc_port) ?? (term.agent === 'b3' ? 5971 : 5972),
          process_present: bool(term.process_present ?? term.process_exists) ?? false,
        };
      })
      .filter((item): item is InfraResponse['terminals'][number] => item !== null);
  } else {
    const termRecord = asRecord(terminalsRaw);
    if (termRecord) {
      for (const agent of ['b3', 'nasdaq'] as const) {
        const term = asRecord(termRecord[agent]);
        if (!term) continue;
        terminals.push({
          agent,
          display: str(term.display) ?? (agent === 'b3' ? ':71' : ':72'),
          vnc_port: num(term.vnc_port) ?? (agent === 'b3' ? 5971 : 5972),
          process_present: bool(term.process_exists ?? term.process_present) ?? false,
        });
      }
    }
  }
  const unsafe = ports.flatMap((port) => port.unsafe_binds);
  const clock = str(record.server_time) ?? str(record.server_clock_brt) ?? str(record.generated_at) ?? '';
  return {
    ok: bool(record.ok) ?? false,
    generated_at: str(record.generated_at) ?? clock,
    dashboard: {
      bind: str(dashboard.bind ?? record.bind) ?? '',
      readonly: bool(dashboard.readonly ?? record.readonly) ?? true,
      version: str(dashboard.version ?? record.version ?? git.commit_short) ?? '',
      commit_hash: str(dashboard.commit_hash ?? git.commit_short ?? git.commit) ?? '',
      branch: str(dashboard.branch ?? git.branch) ?? '',
      linger,
    },
    server_clock_utc: str(record.server_clock_utc) ?? '',
    server_clock_brt: str(record.server_clock_brt) ?? clock,
    disk_var: {
      path: str(disk.path) ?? 'var/',
      used_mb: num(disk.used_mb),
      total_mb: num(disk.total_mb),
      used_pct: num(disk.used_pct),
      inode_pct: num(disk.inode_pct),
      journal_largest_file: str(disk.journal_largest_file),
      journal_largest_mb: num(disk.journal_largest_mb),
    },
    units: mapUnits(record.units),
    ports,
    terminals,
    unsafe_binds_total: unsafe,
  };
}

export function attachInfra(status: StatusResponse, infra: InfraResponse | null): StatusResponse {
  if (!infra) return status;
  const byPort = new Map(infra.ports.map((port) => [port.port, port]));
  const nextAgents = { ...status.agents };
  for (const id of AGENT_IDS) {
    const agent = status.agents[id];
    if (id === 'crypto') {
      nextAgents[id] = { ...agent, bridge: { applicable: false, note: 'Sem ponte MT5' } };
      continue;
    }
    const primary = id === 'nasdaq' ? 18862 : agent.live_enabled ? 18863 : 18861;
    const secondaryPort = id === 'b3' ? (agent.live_enabled ? 18861 : 18863) : null;
    const port = byPort.get(primary);
    const secondary = secondaryPort ? byPort.get(secondaryPort) : undefined;
    if (!port) {
      nextAgents[id] = {
        ...agent,
        bridge: { applicable: true, note: `Porta ${primary} não veio em /api/v2/infra` },
      };
      continue;
    }
    const pongBusy = primary === 18863 && port.listening && port.pong === false;
    nextAgents[id] = {
      ...agent,
      bridge: {
        applicable: true,
        safe: port.localhost_only && port.unsafe_binds.length === 0,
        note: pongBusy
          ? 'Pong da 18863 pode expirar com o agente live na ponte. A escuta é o sinal de saúde.'
          : port.note,
        listen: {
          port: port.port,
          listening: port.listening,
          binds: port.binds,
          localhost_only: port.localhost_only,
          unsafe_binds: port.unsafe_binds,
        },
        check: {
          ok: port.listening && port.localhost_only,
          pong: port.pong === true,
          host: '127.0.0.1',
          port: port.port,
          error: pongBusy ? 'pong timed out' : undefined,
        },
        secondary_ports: secondary
          ? [
              {
                port: secondary.port,
                label: agent.live_enabled ? 'unit oficial' : 'ponte live',
                listening: secondary.listening,
                pong: secondary.pong === true,
                active_for_live: !agent.live_enabled,
              },
            ]
          : undefined,
      },
    };
    const expectedUnit = `triade-agent-${id}`;
    const unitRow =
      infra.units.find((unit) => unit.agent === id && unit.role === 'agent') ??
      infra.units.find((unit) => unit.unit.replace(/\.service$/i, '') === expectedUnit);
    if (unitRow) {
      nextAgents[id] = {
        ...nextAgents[id],
        units: {
          ...nextAgents[id].units,
          agent: {
            unit: unitRow.unit,
            active: normalizeActive(unitRow.active),
            enabled: normalizeEnabled(unitRow.enabled),
          },
        },
      };
    }
  }
  return { ...status, agents: nextAgents };
}

export function mapAlerts(raw: unknown, modes?: Partial<Record<AgentId, 'live' | 'paper'>>): AlertsPayload {
  const record = asRecord(raw) ?? {};
  const alerts = asArray(record.alerts)
    .map((item) => {
      const alert = asRecord(item);
      if (!alert) return null;
      const agentRaw = alert.agent;
      const agent: AlertItem['agent'] = isAgentId(agentRaw) ? agentRaw : agentRaw === 'infra' ? 'infra' : 'infra';
      const knownMode = isAgentId(agentRaw) ? modes?.[agentRaw] : undefined;
      const modeField = str(alert.mode);
      const mode: AlertItem['mode'] =
        modeField === 'live' || modeField === 'paper' || modeField === 'infra'
          ? modeField
          : knownMode ?? (agent === 'infra' ? 'infra' : 'unknown');
      const severityRaw = str(alert.severity);
      const severity: AlertItem['severity'] =
        severityRaw === 'critical' || severityRaw === 'warning' || severityRaw === 'info' ? severityRaw : 'info';
      return {
        id: str(alert.id) ?? `${agent}-${str(alert.ts) ?? ''}-${str(alert.title) ?? ''}`,
        ts: str(alert.ts) ?? '',
        agent,
        mode,
        severity,
        origin: str(alert.kind ?? alert.origin ?? alert.source) ?? 'derived',
        title: str(alert.title) ?? '',
        detail: str(alert.detail) ?? '',
        acknowledged: bool(alert.acknowledged) ?? false,
      } satisfies AlertItem;
    })
    .filter((item): item is AlertItem => item !== null);
  return { alerts, note: str(record.note) };
}

export function annotateAlertModes(
  payload: AlertsPayload,
  status: StatusResponse | null
): AlertsPayload {
  if (!status) return payload;
  return {
    ...payload,
    alerts: payload.alerts.map((alert) => {
      if (!isAgentId(alert.agent) || alert.mode === 'live' || alert.mode === 'paper') return alert;
      return {
        ...alert,
        mode: status.agents[alert.agent].live_enabled ? 'live' : 'paper',
      };
    }),
  };
}

function mapLogEntry(value: unknown, agent: AgentId, mode: 'live' | 'paper'): LogEntry | null {
  const record = asRecord(value);
  if (!record) return null;
  const levelRaw = str(record.level)?.toUpperCase();
  const level: LogEntry['level'] =
    levelRaw === 'ERROR' || levelRaw === 'WARN' || levelRaw === 'DEBUG' ? levelRaw : 'INFO';
  return {
    ts: str(record.ts) ?? '',
    level,
    agent: isAgentId(record.agent) ? record.agent : agent,
    msg: str(record.msg ?? record.message) ?? '',
    mode,
    symbol: str(record.symbol) ?? undefined,
    side: str(record.side) ?? undefined,
    reason: str(record.reason) ?? undefined,
  };
}

export function mapLogs(raw: unknown, agent: AgentId): LogsPayload {
  const record = asRecord(raw) ?? {};
  const mode = str(record.mode) === 'live' ? 'live' : 'paper';
  const entries = asArray(record.entries ?? record.logs)
    .map((item) => mapLogEntry(item, agent, mode))
    .filter((item): item is LogEntry => item !== null);
  const journal = asArray(record.systemd_journal)
    .map((item) => (typeof item === 'string' ? item : ''))
    .filter(Boolean);
  return {
    ok: bool(record.ok) ?? false,
    agent: isAgentId(record.agent) ? record.agent : agent,
    mode,
    mode_requested: str(record.mode_requested) ?? mode,
    path: str(record.path),
    exists: bool(record.exists) ?? entries.length > 0,
    entries,
    systemd_journal: journal,
  };
}

export function mapAudit(raw: unknown): AuditPayload {
  const record = asRecord(raw) ?? {};
  const entries: AuditEntry[] = [];
  for (const item of asArray(record.entries)) {
    const entry = asRecord(item);
    if (!entry) continue;
    const agentRaw = entry.agent;
    const agent: AuditEntry['agent'] = isAgentId(agentRaw) || agentRaw === 'all' ? agentRaw : 'all';
    const role: AuditEntry['role'] =
      entry.role === 'owner' || entry.role === 'auditor' || entry.role === 'service' || entry.role === 'anonymous'
        ? entry.role
        : 'auditor';
    entries.push({
      ts: str(entry.ts) ?? '',
      actor: str(entry.actor) ?? '',
      role,
      action: (str(entry.action) ?? 'kill') as AuditEntry['action'],
      agent,
      mode: entry.mode === 'live' || entry.mode === 'paper' || entry.mode === 'mixed' ? entry.mode : 'mixed',
      reason: str(entry.reason) ?? '',
      confirmations: asArray(entry.confirmations).filter((c): c is string => typeof c === 'string'),
      result: entry.result === 'ok' || entry.result === 'denied' || entry.result === 'error' ? entry.result : 'error',
      request_id: str(entry.request_id) ?? '',
    });
  }
  return {
    entries,
    exists: bool(record.exists) ?? entries.length > 0,
    note: str(record.note),
  };
}

export function buildQuery(
  params: Record<string, string | number | null | undefined>,
  options?: { keepAll?: boolean }
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (!options?.keepAll && value === 'all') continue;
    qs.set(key, String(value));
  }
  const text = qs.toString();
  return text ? `?${text}` : '';
}
