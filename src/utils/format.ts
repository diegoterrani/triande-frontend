import { AgentId, CurrencyCode, TimelineEvent } from '../types/triade';

export const AGENT_NAMES: Record<AgentId, string> = {
  b3: 'B3',
  nasdaq: 'NASDAQ',
  crypto: 'Cripto',
};

export const AGENT_CURRENCIES: Record<AgentId, CurrencyCode> = {
  b3: 'BRL',
  nasdaq: 'USD',
  crypto: 'USDT',
};

export const EVENT_LABELS: Record<string, string> = {
  signal: 'Sinal emitido',
  reject: 'Entrada recusada',
  fill: 'Ordem executada',
  trade: 'Trade encerrado',
  halt: 'Agente travado',
  flatten_all: 'Zeragem geral',
  flatten_failed: 'Falha ao zerar',
  flatten_sem_preco: 'Zerar sem preço',
  flatten_sem_corretora: 'Zerar sem corretora',
  already_flat: 'Já estava zerado',
  kill: 'Kill switch disparado',
  disconnect: 'Queda de conexão',
  reconcile: 'Conciliação',
  reconcile_failed: 'Falha na conciliação',
  adopted: 'Posição adotada',
  adopt_sem_preco: 'Adoção sem preço',
  restore: 'Estado restaurado',
  interrupt: 'Interrupção (SIGINT/SIGTERM)',
  emergency: 'Stop de emergência',
  emergency_stop_failed: 'Falha no stop de emergência',
  idempotent: 'Ordem idempotente',
  cancel_failed: 'Falha ao cancelar ordens',
  llm_decision: 'Decisão do analista (LLM)',
};

export const DETAIL_LABELS: Record<string, string> = {
  symbol: 'Símbolo',
  contract: 'Contrato',
  side: 'Lado',
  reason: 'Motivo / checagem',
  rationale: 'Justificativa',
  sinal: 'Sinal de origem',
  strategy: 'Estratégia',
  source: 'Fonte',
  stop: 'Stop obrigatório',
  target: 'Alvo',
  qty: 'Quantidade',
  price: 'Preço de execução',
  fee: 'Taxa',
  fees: 'Taxas totais',
  pnl: 'PnL realizado',
  entry: 'Entrada',
  exit: 'Saída',
  entry_reason: 'Motivo da entrada',
  exit_reason: 'Motivo da saída',
  client_order_id: 'ID idempotente',
  motivo: 'Motivo',
  detalhe: 'Detalhe',
  ok: 'Resultado OK',
  canceladas: 'Ordens canceladas',
  erro: 'Erro',
  arquivo: 'Arquivo',
  preco: 'Preço',
  adotados: 'Adotados',
  divergencias: 'Divergências',
  source_file: 'Arquivo de origem',
};

const SECRET_RE =
  /(api_key|api_secret|secret|token|password|passwd|login|credential|DAYTRADE_LIVE_CONFIRM|TELEGRAM_BOT_TOKEN|MT5_PASSWORD)\s*[:=]\s*([^\s,;}"']+)/gi;

export function redactSecrets(input: string): string {
  return input.replace(SECRET_RE, (_m, key) => `${key}=[REDIGIDO]`);
}

export function formatMoney(
  value: number | null | undefined,
  currency: CurrencyCode = 'BRL',
  showSign = false
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  const absFormatted = Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = value < 0 ? '-' : showSign && value > 0 ? '+' : '';
  if (currency === 'BRL') {
    return `${sign}R$ ${absFormatted}`;
  }
  if (currency === 'USD') {
    return `${sign}US$ ${absFormatted}`;
  }
  return `${sign}${absFormatted} USDT`;
}

export function formatPct(value: number | null | undefined, isDecimalRatio = true): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  const pct = isDecimalRatio ? value * 100 : value;
  return `${pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatPrice(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatBrasiliaTime(
  isoString: string | null | undefined,
  includeDate = false
): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...(includeDate
      ? { day: '2-digit', month: '2-digit', year: 'numeric' }
      : {}),
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatNewYorkTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function todayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '11';
  const d = parts.find((p) => p.type === 'day')?.value ?? '19';
  return `${y}-${m}-${d}`;
}

export function getEventColorCategory(
  eventName: string
): 'accent' | 'good' | 'bad' | 'warn' | 'muted' {
  if (eventName === 'signal' || eventName === 'llm_decision') return 'accent';
  if (eventName === 'fill' || eventName === 'trade' || eventName === 'reconcile') {
    return 'good';
  }
  if (
    eventName === 'reject' ||
    eventName === 'halt' ||
    eventName === 'kill' ||
    eventName === 'disconnect' ||
    eventName === 'reconcile_failed' ||
    eventName === 'flatten_failed' ||
    eventName === 'emergency' ||
    eventName === 'emergency_stop_failed' ||
    eventName === 'cancel_failed'
  ) {
    return 'bad';
  }
  if (
    eventName === 'flatten_all' ||
    eventName === 'interrupt' ||
    eventName === 'adopted' ||
    eventName === 'restore'
  ) {
    return 'warn';
  }
  return 'muted';
}

export function summarizeTimelineEvent(ev: TimelineEvent): string {
  const parts: string[] = [];
  if (ev.symbol) parts.push(ev.contract && ev.contract !== ev.symbol ? `${ev.symbol} (${ev.contract})` : ev.symbol);
  if (ev.side) parts.push(ev.side === 'buy' ? 'COMPRA' : ev.side === 'sell' ? 'VENDA' : ev.side);
  if (ev.qty !== undefined) parts.push(`qtd ${ev.qty}`);
  if (ev.pnl !== undefined) {
    parts.push(`PnL ${formatMoney(ev.pnl, AGENT_CURRENCIES[ev.agent] ?? 'BRL', true)}`);
  }
  const msg = ev.reason || ev.motivo || ev.exit_reason || ev.entry_reason || ev.detalhe || ev.erro;
  if (msg) parts.push(msg);
  if (ev.event === 'reconcile' && ev.ok !== undefined) {
    parts.push(ev.ok ? 'motor × corretora sincronizados' : 'divergência detectada');
  }
  return parts.join(' · ') || ev.source_file;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>): void {
  const escape = (val: string | number | null | undefined) => {
    const str = val === null || val === undefined ? '' : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
