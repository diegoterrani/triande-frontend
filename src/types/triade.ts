export type AgentId = 'b3' | 'nasdaq' | 'crypto';

export type AgentMode = 'real' | 'papel';

export type UserRole = 'owner' | 'auditor' | 'service' | 'anonymous';

export type CurrencyCode = 'BRL' | 'USD' | 'USDT';

export type ConnectionState = 'sse' | 'polling' | 'reconnecting' | 'offline';

export type PreviewScenario =
  | 'default_inspection'
  | 'b3_live_with_position'
  | 'all_paper'
  | 'api_offline';

export type RouteKey =
  | 'overview'
  | 'agent-b3'
  | 'agent-nasdaq'
  | 'agent-crypto'
  | 'timeline'
  | 'positions'
  | 'risk'
  | 'pnl'
  | 'charts'
  | 'trades'
  | 'backtests'
  | 'strategies'
  | 'infra'
  | 'alerts'
  | 'controls'
  | 'logs'
  | 'audit'
  | 'settings';

export interface SystemdUnitState {
  unit: string;
  active: 'active' | 'inactive' | 'failed' | 'activating' | 'unknown';
  enabled: 'disabled' | 'enabled' | 'static' | 'unknown';
}

export interface AgentKillState {
  kill_all: { present: boolean; reason?: string | null };
  kill_agent: { present: boolean; reason?: string | null };
  blocked: boolean;
}

export interface PositionDict {
  symbol: string;
  contract: string;
  qty: number; // >0 buy, <0 sell
  avg_price: number;
  stop_price: number | null;
  target_price: number | null;
  opened_at: string;
  strategy: string;
  entry_reason: string;
  entry_fee: number;
  client_order_id: string;
  source: 'python' | 'llm';
  max_hold_until: string | null;
  side?: 'buy' | 'sell';
  current_price?: number | null;
  unrealized_pnl?: number | null;
}

export interface ExportState {
  path?: string;
  day: string;
  equity_peak: number;
  day_start_equity: number;
  day_peak_equity?: number;
  cash?: number;
  equity_current?: number;
  realized_pnl_today: number;
  trades_today: number;
  halted: boolean;
  sticky_halt: boolean;
  halt_reason: string | null;
  block_entries: boolean;
  consecutive_losses?: number;
  trades_by_source?: Record<string, number>;
  pnl_by_source?: Record<string, number>;
  source_halted?: Record<string, string | null>;
  seen?: string[];
  positions: PositionDict[];
  drawdown: number | null;
  drawdown_pct: number | null;
  broker?: {
    cash?: number;
    net?: number;
    avg?: number;
  } | null;
}

export interface BridgeListenInfo {
  port: number;
  listening: boolean;
  binds: string[];
  localhost_only: boolean;
  unsafe_binds: string[];
}

export interface BridgeCheckInfo {
  ok: boolean;
  pong: boolean;
  host: string;
  port: number;
  raw?: string;
  error?: string;
}

export interface BridgeStatus {
  applicable: boolean;
  safe?: boolean;
  note?: string;
  listen?: BridgeListenInfo;
  check?: BridgeCheckInfo;
  secondary_ports?: Array<{
    port: number;
    label: string;
    listening: boolean;
    pong: boolean;
    active_for_live?: boolean;
  }>;
}

export interface LogEntry {
  ts: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  agent: AgentId;
  msg: string;
  mode?: 'live' | 'paper';
  symbol?: string;
  side?: string;
  reason?: string;
  stop?: number;
  price?: number;
  qty?: number;
  pnl?: number;
  contract?: string;
  motivo?: string;
}

export interface AgentSummary {
  agent: AgentId;
  label: string;
  market: string;
  currency: CurrencyCode;
  timezone: string;
  contract_current?: string;
  magic_number?: number;
  mode: AgentMode;
  live_enabled: boolean;
  live_confirm_ok?: boolean; // boolean only, never the env value
  paper_venue: 'simulate' | 'demo' | 'binance_testnet' | string;
  units: {
    agent: SystemdUnitState;
    xvfb?: SystemdUnitState;
    bridge?: SystemdUnitState;
  };
  kill: AgentKillState;
  state: ExportState | null;
  paper_state?: ExportState | null;
  missing_state_reason?: string | null;
  bridge: BridgeStatus;
  log_file?: string;
  signals?: Array<{ ts: string; symbol: string; side?: string; reason?: string; source?: string }>;
  logs?: LogEntry[];
  session_phase?: 'accepting_entries' | 'manage_only' | 'flatten_window' | 'outside_session';
  no_new_trades_after?: string | null;
  flatten_time?: string | null;
}

export interface HealthResponse {
  ok: boolean;
  bind: string;
  readonly: boolean;
  uptime_seconds?: number;
  version?: string;
  auth_required?: boolean;
}

export interface StatusResponse {
  ok: boolean;
  bind: string;
  readonly: boolean;
  kill_all: { present: boolean; reason?: string | null };
  generated_at: string;
  agents: Record<AgentId, AgentSummary>;
}

export type TimelineEventType =
  | 'signal'
  | 'reject'
  | 'fill'
  | 'trade'
  | 'halt'
  | 'flatten_all'
  | 'flatten_failed'
  | 'already_flat'
  | 'kill'
  | 'disconnect'
  | 'reconcile'
  | 'reconcile_failed'
  | 'adopted'
  | 'restore'
  | 'interrupt'
  | 'emergency'
  | 'idempotent'
  | 'cancel_failed'
  | 'llm_decision';

export interface TimelineEvent {
  ts: string;
  event: TimelineEventType | string;
  agent: AgentId;
  mode: 'live' | 'paper';
  source_file: string;
  symbol?: string;
  contract?: string;
  side?: 'buy' | 'sell' | string;
  reason?: string;
  rationale?: string;
  sinal?: string;
  strategy?: string;
  source?: 'python' | 'llm' | string;
  stop?: number | null;
  target?: number | null;
  qty?: number;
  price?: number;
  fee?: number;
  fees?: number;
  pnl?: number;
  entry?: number;
  exit?: number;
  entry_reason?: string;
  exit_reason?: string;
  client_order_id?: string;
  motivo?: string;
  detalhe?: string;
  ok?: boolean;
  canceladas?: number;
  erro?: string;
  arquivo?: string;
  preco?: number;
  adotados?: number;
  divergencias?: string[];
  action?: string;
  status?: string;
  idempotency_key?: string;
}

export interface TimelineSourceInfo {
  agent: AgentId;
  path: string;
  exists: boolean;
  kind: 'journal' | 'events';
  mode: 'live' | 'paper';
}

export interface TimelineResponse {
  ok: boolean;
  readonly: boolean;
  exemplo: boolean;
  agents: AgentId[];
  since: string;
  until: string;
  after: string | null;
  window: 'start' | 'latest' | 'all';
  count: number;
  total_matched: number;
  truncated: boolean;
  sources: TimelineSourceInfo[];
  missing: Array<{ agent: AgentId; path: string; reason: string }>;
  generated_at: string;
  events: TimelineEvent[];
}

export interface AnalystEvent {
  ts: string;
  kind: 'volume_spike' | 'range_break' | 'halt' | string;
  agent: AgentId;
  symbol: string;
  volume?: number;
  media?: number;
  side?: string;
  rationale?: string;
  motivo?: string;
}

export interface RiskResponse {
  ok: boolean;
  agent: AgentId;
  mode: 'live' | 'paper';
  profile: 'micro_live' | 'research';
  currency: CurrencyCode;
  timezone: string;
  session: {
    no_new_trades_after: string | null;
    flatten_time: string | null;
    phase: 'accepting_entries' | 'manage_only' | 'flatten_window' | 'outside_session';
  };
  limits: {
    symbols: string[];
    max_qty: Record<string, number>;
    max_open_positions: number;
    max_trades_per_day: number;
    daily_loss_limit: number | null;
    daily_loss_limit_pct: number | null;
    max_consecutive_losses: number;
    max_drawdown_pct: number;
    sticky_drawdown_halt: boolean;
    max_trades_per_source: Record<string, number>;
    stop_required: boolean;
    emergency_stop_pct: number;
    one_trade_per_day: boolean;
  };
  usage: {
    trades_today: number;
    consecutive_losses: number;
    consecutive_losses_assumed?: boolean;
    open_positions: number;
    open_qty: number;
    day_loss: number | null;
    day_loss_pct_of_limit: number | null;
    drawdown_pct: number | null;
    trades_by_source: Record<string, number>;
    halted: boolean;
    sticky_halt: boolean;
    halt_reason: string | null;
    block_entries: boolean;
    kill_blocked: boolean;
  };
  recent_rejects: TimelineEvent[];
  source_files: {
    config: string;
    state: string;
  };
  generated_at: string;
}

export interface BacktestMetricsBlock {
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  sharpe: number;
  expectancy: number;
  net_pnl: number;
  fees: number;
  avg_win: number;
  avg_loss: number;
  initial_equity: number;
  ending_equity: number;
  currency: CurrencyCode;
  days: number;
  halted: boolean;
  halt_reason: string | null;
}

export interface BacktestReport {
  id: string;
  agent: AgentId;
  title: string;
  strategy: {
    name: string;
    params: Record<string, string | number | boolean>;
  };
  data: {
    path: string;
    source: string;
    start: string;
    end: string;
    bars: number;
    disclaimer: string;
  };
  amostra_cheia: BacktestMetricsBlock;
  dentro_da_amostra: BacktestMetricsBlock;
  fora_da_amostra: BacktestMetricsBlock;
  amostra_cheia_por_ativo?: Record<string, BacktestMetricsBlock>;
  live_warning?: string;
}

export interface StrategyConfig {
  agent: AgentId;
  config_path: string;
  live_enabled: boolean;
  paper_venue: string;
  strategy_name: string;
  timezone: string;
  symbols_research: string[];
  symbols_live: string[];
  symbol_mode: string;
  roll_sessions_before?: number;
  contract_current?: string;
  research_params: Record<string, string | number | boolean>;
  micro_live_params: Record<string, string | number | boolean>;
  costs: {
    fee_per_unit_side: number;
    slippage_ticks: number;
  };
  llm_editable_bounds: Array<{
    key: string;
    type: 'float' | 'int' | 'bool';
    min?: number;
    max?: number;
    current: number | boolean;
  }>;
  env_key_names_only: string[];
}

export interface InfraResponse {
  ok: boolean;
  generated_at: string;
  dashboard: {
    bind: string;
    readonly: boolean;
    version: string;
    commit_hash: string;
    branch: string;
    linger: 'no' | 'yes';
  };
  server_clock_utc: string;
  server_clock_brt: string;
  disk_var: {
    path: string;
    used_mb: number;
    total_mb: number;
    used_pct: number;
    inode_pct: number;
    journal_largest_file: string;
    journal_largest_mb: number;
  };
  units: Array<{
    agent: AgentId | 'dashboard';
    role: 'agent' | 'bridge' | 'xvfb' | 'dashboard';
    unit: string;
    active: string;
    enabled: string;
  }>;
  ports: Array<{
    port: number;
    service: string;
    binds: string[];
    listening: boolean;
    localhost_only: boolean;
    unsafe_binds: string[];
    pong?: boolean | null;
    note?: string;
  }>;
  terminals: Array<{
    agent: 'b3' | 'nasdaq';
    display: string;
    vnc_port: number;
    process_present: boolean;
  }>;
  unsafe_binds_total: string[];
}

export interface AlertItem {
  id: string;
  ts: string;
  agent: AgentId | 'infra';
  mode: 'live' | 'paper' | 'infra';
  severity: 'critical' | 'warning' | 'info';
  origin: string;
  title: string;
  detail: string;
  acknowledged: boolean;
}

export interface AuditEntry {
  ts: string;
  actor: string;
  role: UserRole;
  action: 'flatten' | 'kill' | 'kill_all' | 'kill_clear' | 'reset_halt' | 'unit_stop' | 'unit_start' | 'ack_alert' | 'token_issue';
  agent: AgentId | 'all';
  mode: 'live' | 'paper' | 'mixed';
  reason: string;
  confirmations: string[];
  result: 'ok' | 'denied' | 'error';
  request_id: string;
}

export interface UserOperator {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  totp_enabled: boolean;
  last_active_at: string;
}

export interface ApiTokenRecord {
  id: string;
  label: string;
  role: UserRole;
  prefix: string;
  created_at: string;
  revoked: boolean;
}

export type DangerActionType =
  | 'kill'
  | 'kill_all'
  | 'flatten'
  | 'kill_clear'
  | 'reset_halt'
  | 'unit_stop'
  | 'unit_start';

export interface DangerActionPayload {
  action: DangerActionType;
  agent: AgentId | 'all';
  confirm_agent: string;
  confirm_word: string;
  reason: string;
  otp?: string;
  ack_live?: boolean;
}

export interface ActionResponse {
  ok: boolean;
  agent: AgentId | 'all';
  action: string;
  kill_flag?: string;
  broker_cancel_attempted?: boolean;
  audit_id: string;
  message?: string;
  error?: string;
}

export type ChartFormat = 'candle' | 'mountain';

export type IndicatorId =
  | 'ema9'
  | 'ema21'
  | 'sma50'
  | 'vwap'
  | 'bollinger'
  | 'orb_range'
  | 'volume'
  | 'rsi14';

export type DrawingTool = 'cursor' | 'trendline' | 'hline' | 'rect' | 'fib';

export interface OhlcvBar {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RecentBarsResponse {
  ok: boolean;
  agent: AgentId;
  symbol: string;
  contract?: string;
  timeframe: '1m' | '5m' | '15m';
  source_file: string;
  exists: boolean;
  bars: OhlcvBar[];
}

export interface DrawingAnchor {
  barIndex: number;
  ts: string;
  price: number;
}

export interface ChartDrawing {
  id: string;
  tool: Exclude<DrawingTool, 'cursor'>;
  color: string;
  p1: DrawingAnchor;
  p2?: DrawingAnchor;
  label?: string;
}

export interface ChartTradeSpan {
  id: string;
  client_order_id?: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  entryTs: string;
  entryPrice: number;
  exitTs?: string;
  exitPrice?: number;
  pnl?: number;
  fees?: number;
  entry_reason?: string;
  exit_reason?: string;
  source?: string;
  mode: 'live' | 'paper';
  status: 'closed' | 'open';
  stopPrice?: number | null;
  targetPrice?: number | null;
}

