import {
  BinanceStatus,
  BinanceTestResult,
  DISABLE_CRYPTO_LIVE,
  ENABLE_CRYPTO_LIVE,
  RiskBounds,
  RiskLimitsInput,
  RiskPayload,
} from './adminTypes';

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly missing: string[];
  readonly result: BinanceTestResult | null;
  readonly body: unknown;

  constructor(
    message: string,
    status: number,
    code: string | null,
    missing: string[],
    result: BinanceTestResult | null,
    body: unknown
  ) {
    super(message);
    this.name = 'AdminApiError';
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readTestResult(value: unknown): BinanceTestResult | null {
  const record = asRecord(value);
  if (!record || !('ok' in record)) return null;
  return record as unknown as BinanceTestResult;
}

/** Keep the server's Portuguese `error` string intact. */
export function readAdminFailure(status: number, json: unknown): AdminApiError {
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
  const result = record ? readTestResult(record.result) : null;
  return new AdminApiError(message, status, code, missing, result, json);
}

export function formatAdminError(err: unknown): string {
  if (err instanceof AdminApiError) {
    const lines = [`HTTP ${err.status}${err.code ? ` ${err.code}` : ''}`, err.message];
    if (err.missing.length) {
      lines.push(err.missing.map((item) => `• ${item}`).join('\n'));
    }
    if (err.result?.error && err.result.error !== err.message) {
      lines.push(err.result.error);
    }
    return lines.join('\n');
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Falha desconhecida';
}

export function confirmationPhrase(enabled: boolean): string {
  return enabled ? ENABLE_CRYPTO_LIVE : DISABLE_CRYPTO_LIVE;
}

export function confirmationMatches(enabled: boolean, phrase: string): boolean {
  return phrase === confirmationPhrase(enabled);
}

const INTEGER_FIELDS = new Set<keyof RiskBounds>(['max_trades_per_day', 'max_open_positions']);

export const RISK_FIELD_ORDER: (keyof RiskBounds)[] = [
  'max_capital',
  'max_order_size',
  'daily_loss_limit',
  'max_trades_per_day',
  'max_open_positions',
  'max_drawdown',
];

export interface RiskDraft {
  max_capital: string;
  max_order_size: string;
  daily_loss_limit: string;
  max_trades_per_day: string;
  max_open_positions: string;
  max_drawdown: string;
  allowed_pairs: string[];
}

export function emptyRiskDraft(universe: string[]): RiskDraft {
  return {
    max_capital: '',
    max_order_size: '',
    daily_loss_limit: '',
    max_trades_per_day: '',
    max_open_positions: '',
    max_drawdown: '',
    allowed_pairs: [...universe],
  };
}

export function draftFromLimits(limits: RiskLimitsInput, universe: string[]): RiskDraft {
  return {
    max_capital: String(limits.max_capital),
    max_order_size: String(limits.max_order_size),
    daily_loss_limit: String(limits.daily_loss_limit),
    max_trades_per_day: String(limits.max_trades_per_day),
    max_open_positions: String(limits.max_open_positions),
    max_drawdown: String(limits.max_drawdown),
    allowed_pairs: universe.filter((pair) => limits.allowed_pairs.includes(pair)),
  };
}

function parseStrictNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export interface RiskValidationFailure {
  ok: false;
  errors: string[];
  fieldErrors: Partial<Record<keyof RiskDraft, string>>;
}

export interface RiskValidationSuccess {
  ok: true;
  errors: [];
  fieldErrors: Record<string, never>;
  limits: RiskLimitsInput;
}

export function validateRiskDraft(
  draft: RiskDraft,
  bounds: RiskBounds,
  universe: string[]
): RiskValidationSuccess | RiskValidationFailure {
  const fieldErrors: Partial<Record<keyof RiskDraft, string>> = {};
  const errors: string[] = [];
  const numeric = {} as Record<keyof RiskBounds, number>;

  if (!bounds) {
    return { ok: false, errors: ['O servidor não enviou bounds.'], fieldErrors: {} };
  }

  for (const key of RISK_FIELD_ORDER) {
    const bound = bounds[key];
    if (!bound || typeof bound.min !== 'number' || typeof bound.max !== 'number') {
      const message = `${key}: o servidor não enviou min/max.`;
      fieldErrors[key] = message;
      errors.push(message);
      continue;
    }
    const parsed = parseStrictNumber(draft[key]);
    if (parsed === null) {
      const message = `${key}: informe um número dentro de ${bound.min} e ${bound.max}.`;
      fieldErrors[key] = message;
      errors.push(message);
      continue;
    }
    if (INTEGER_FIELDS.has(key) && !Number.isInteger(parsed)) {
      const message = `${key}: use um inteiro entre ${bound.min} e ${bound.max}.`;
      fieldErrors[key] = message;
      errors.push(message);
      continue;
    }
    if (parsed < bound.min || parsed > bound.max) {
      const message = `${key} fora dos limites (${bound.min}–${bound.max}).`;
      fieldErrors[key] = message;
      errors.push(message);
      continue;
    }
    numeric[key] = parsed;
  }

  const uniqueUniverse = [...new Set(universe)];
  const selected = uniqueUniverse.filter((pair) => draft.allowed_pairs.includes(pair));
  const unknown = draft.allowed_pairs.filter((pair) => !uniqueUniverse.includes(pair));
  if (unknown.length) {
    const message = `allowed_pairs só aceita ${uniqueUniverse.join(', ') || 'os pares devolvidos pelo servidor'}.`;
    fieldErrors.allowed_pairs = message;
    errors.push(message);
  } else if (selected.length === 0) {
    const message = 'allowed_pairs não pode ser vazio.';
    fieldErrors.allowed_pairs = message;
    errors.push(message);
  }

  if (errors.length || Object.keys(numeric).length !== RISK_FIELD_ORDER.length) {
    return { ok: false, errors, fieldErrors };
  }

  return {
    ok: true,
    errors: [],
    fieldErrors: {},
    limits: {
      max_capital: numeric.max_capital,
      max_order_size: numeric.max_order_size,
      daily_loss_limit: numeric.daily_loss_limit,
      max_trades_per_day: numeric.max_trades_per_day,
      max_open_positions: numeric.max_open_positions,
      allowed_pairs: selected,
      max_drawdown: numeric.max_drawdown,
    },
  };
}

export interface LiveCheck {
  id: 'credentials' | 'test' | 'limits';
  ok: boolean;
  label: string;
}

export function livePrerequisites(binance: BinanceStatus | null, risk: RiskPayload | null): LiveCheck[] {
  return [
    {
      id: 'credentials',
      ok: binance?.configured === true,
      label: 'Credenciais Binance configuradas no cofre',
    },
    {
      id: 'test',
      ok: binance?.last_test?.ok === true && binance.last_test.withdrawals_enabled === false,
      label: 'Último teste de permissões ok, com saques desligados',
    },
    {
      id: 'limits',
      ok: risk?.limits != null && risk.limits.source === 'admin',
      label: 'Limites de risco gravados por este fluxo',
    },
  ];
}

export type LiveStamp = 'PAPER' | 'LIVE' | 'DIVERGENTE';

export function cryptoLiveStamp(binance: BinanceStatus | null): LiveStamp {
  if (!binance) return 'PAPER';
  if (binance.admin_live_enabled && binance.live_enabled_yaml) return 'LIVE';
  if (!binance.admin_live_enabled && !binance.live_enabled_yaml) return 'PAPER';
  return 'DIVERGENTE';
}

const SENSITIVE_KEY = /secret|password|totp|csrf|api_key|api_secret|credential/i;

function alreadyMasked(value: string): boolean {
  return value.includes('•') || value.includes('*') || value === '[REDIGIDO]';
}

/** Defense in depth: the server already redacts. Do not try to reveal anything. */
export function redactAuditValue(value: unknown, key = ''): unknown {
  if (typeof value === 'string') {
    if (alreadyMasked(value)) return value;
    if (SENSITIVE_KEY.test(key)) return '***';
    if (/^[A-Za-z0-9+/=_-]{24,}$/.test(value)) return '***';
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => redactAuditValue(item));
  const record = asRecord(value);
  if (!record) return value;
  const out: Record<string, unknown> = {};
  for (const [childKey, child] of Object.entries(record)) {
    out[childKey] = redactAuditValue(child, childKey);
  }
  return out;
}

export function withdrawalsBlocked(result: BinanceTestResult | null | undefined): boolean {
  return result?.withdrawals_enabled === true;
}
