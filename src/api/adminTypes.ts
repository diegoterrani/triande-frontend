export interface AdminSession {
  ok: true;
  user: string;
  csrf_token: string;
  expires_at: number;
  created_at?: string;
}

export interface BinanceTestResult {
  ok: boolean;
  tested_at: string | null;
  withdrawals_enabled: boolean | null;
  ip_restrict: boolean | null;
  enable_futures: boolean | null;
  enable_spot_and_margin_trading: boolean | null;
  enable_internal_transfer: boolean | null;
  error: string | null;
  ip_restriction_note: string | null;
}

export interface BinanceStatus {
  ok: true;
  configured: boolean;
  api_key_masked: string | null;
  last_test: BinanceTestResult | null;
  ip_restriction_note: string | null;
  live_enabled_yaml: boolean;
  admin_live_enabled: boolean;
}

export interface BinancePutResult {
  ok: true;
  configured: boolean;
  api_key_masked: string | null;
  tested: boolean;
}

export interface BinanceTestResponse {
  ok: true;
  result: BinanceTestResult;
}

export interface NumericBound {
  min: number;
  max: number;
}

export interface RiskBounds {
  max_capital: NumericBound;
  max_order_size: NumericBound;
  daily_loss_limit: NumericBound;
  max_trades_per_day: NumericBound;
  max_open_positions: NumericBound;
  max_drawdown: NumericBound;
}

export interface RiskLimits {
  max_capital: number;
  max_order_size: number;
  daily_loss_limit: number;
  max_trades_per_day: number;
  max_open_positions: number;
  allowed_pairs: string[];
  max_drawdown: number;
  updated_at?: string;
  source?: string;
}

export type RiskLimitsInput = Omit<RiskLimits, 'updated_at' | 'source'>;

export interface RiskPayload {
  ok: true;
  limits: RiskLimits | null;
  bounds: RiskBounds;
  allowed_pairs: string[];
}

export interface RiskPutResult {
  ok: true;
  limits: RiskLimits;
  backup?: string;
}

export interface LiveResult {
  ok: true;
  live_enabled: boolean;
  admin_live_enabled: boolean;
  unit_started: boolean;
  note?: string;
}

export interface KillResult {
  ok: true;
  agent: string;
  kill_flag: string;
  note?: string;
}

export interface FlattenResult extends KillResult {
  broker_called: boolean;
}

export interface AdminAuditEntry {
  ts: string;
  who: string;
  ip: string;
  action: string;
  ok: boolean;
  detail: string | null;
  before: unknown;
  after: unknown;
}

export interface AdminAuditPayload {
  ok: true;
  count: number;
  entries: AdminAuditEntry[];
}

export const ENABLE_CRYPTO_LIVE = 'ENABLE CRYPTO LIVE';
export const DISABLE_CRYPTO_LIVE = 'DISABLE CRYPTO LIVE';

/** VPS address operators must whitelist on the Binance API key. */
export const VPS_BINANCE_IP = '169.58.230.95';

export const ADMIN_ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  stepup_totp: 'Confirmação 2FA',
  binance_credentials_put: 'Gravação da chave Binance',
  binance_test: 'Teste de permissões Binance',
  crypto_risk_put: 'Limites de risco da cripto',
  crypto_live_enable: 'Live da cripto ligado',
  crypto_live_disable: 'Live da cripto desligado',
  crypto_kill: 'Kill da cripto',
  crypto_flatten: 'Flatten da cripto',
  b3_kill: 'Kill da B3',
};
