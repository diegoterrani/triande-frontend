import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  AgentSummary,
  CurrencyCode,
  DangerActionPayload,
  DangerActionType,
} from '../../types/triade';
import {
  formatBrasiliaTime,
  formatMoney,
  formatPrice,
} from '../../utils/format';

export const ModeBadge: React.FC<{ live: boolean; compact?: boolean }> = ({
  live,
  compact = false,
}) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-md font-semibold uppercase tracking-wider whitespace-nowrap shrink-0 ${
      compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
    } ${
      live
        ? 'bg-[#f85149]/15 text-[#f85149] border border-[#f85149]/40'
        : 'bg-[#58a6ff]/15 text-[#58a6ff] border border-[#58a6ff]/40'
    }`}
    aria-label={live ? 'Modo real (conta live)' : 'Modo papel (simulação)'}
  >
    {live ? 'REAL / LIVE' : 'PAPEL'}
  </span>
);

export type SemanticVariant = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

export const StatusBadge: React.FC<{
  variant: SemanticVariant;
  label: string;
  title?: string;
}> = ({ variant, label, title }) => {
  const styles: Record<SemanticVariant, string> = {
    ok: 'bg-[#3fb950]/15 text-[#3fb950] border-[#3fb950]/35',
    warn: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/40',
    bad: 'bg-[#f85149]/15 text-[#f85149] border-[#f85149]/40',
    info: 'bg-[#7aa2f7]/15 text-[#7aa2f7] border-[#7aa2f7]/35',
    neutral: 'bg-[#21262d] text-[#8b9bb4] border-[#30363d]',
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap shrink-0 ${styles[variant]}`}
    >
      {label}
    </span>
  );
};

export const MetricBlock: React.FC<{
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  tone?: 'default' | 'good' | 'bad' | 'warn';
  large?: boolean;
}> = ({ label, value, subtext, tone = 'default', large = false }) => {
  const colorMap = {
    default: 'text-[#e6edf3]',
    good: 'text-[#3fb950]',
    bad: 'text-[#f85149]',
    warn: 'text-[#d29922]',
  };
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#8b9bb4] truncate">
        {label}
      </div>
      <div
        className={`mt-1 font-semibold tabular-nums font-mono ${
          large ? 'text-[22px] leading-7' : 'text-[16px] leading-6'
        } ${colorMap[tone]}`}
      >
        {value}
      </div>
      {subtext && <div className="mt-0.5 text-xs text-[#8b9bb4] truncate">{subtext}</div>}
    </div>
  );
};

export const UsageGauge: React.FC<{
  label: string;
  currentText: string;
  limitText: string;
  ratio: number | null;
  formula?: string;
  source?: string;
  note?: string;
  stickyBadge?: boolean;
}> = ({
  label,
  currentText,
  limitText,
  ratio,
  formula,
  source,
  note,
  stickyBadge = false,
}) => {
  const pct = ratio === null ? 0 : Math.min(100, Math.max(0, ratio * 100));
  const isCrit = ratio !== null && ratio >= 1;
  const isWarn = ratio !== null && ratio >= 0.8 && ratio < 1;

  const barColor = isCrit
    ? 'bg-[#f85149]'
    : isWarn
      ? 'bg-[#d29922]'
      : 'bg-[#7aa2f7]';

  return (
    <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8b9bb4]">
              {label}
            </span>
            {stickyBadge && (
              <StatusBadge variant="warn" label="Sticky · não solta no dia seguinte" />
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2 font-mono tabular-nums">
            <span
              className={`text-lg font-semibold ${
                isCrit ? 'text-[#f85149]' : isWarn ? 'text-[#d29922]' : 'text-[#e6edf3]'
              }`}
            >
              {currentText}
            </span>
            <span className="text-xs text-[#8b9bb4]">/ {limitText}</span>
          </div>
        </div>
        {(formula || source) && (
          <button
            type="button"
            title={[formula ? `Fórmula: ${formula}` : '', source ? `Fonte: ${source}` : '']
              .filter(Boolean)
              .join(' | ')}
            aria-label={`Detalhes de cálculo de ${label}`}
            className="rounded-md p-1.5 text-[#8b9bb4] hover:bg-[#21262d] hover:text-[#e6edf3] transition-colors shrink-0"
          >
            <Info className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#0d1117] border border-[#30363d]"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full transition-all duration-200 ${barColor}`}
          style={{ width: `${ratio === null ? 0 : pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#8b9bb4]">
        <span className="truncate font-mono">{source ?? 'estado efetivo'}</span>
        <span className="tabular-nums shrink-0 font-mono">
          {ratio === null ? '—' : `${(ratio * 100).toFixed(1)}%`}
        </span>
      </div>
      {note && <p className="mt-1.5 text-[11px] text-[#d29922]">{note}</p>}
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  detail: string;
  missingPath?: string;
  action?: React.ReactNode;
}> = ({ title, detail, missingPath, action }) => (
  <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-6 text-center">
    <p className="text-sm font-semibold text-[#e6edf3]">{title}</p>
    <p className="mt-1 text-xs text-[#8b9bb4] max-w-lg mx-auto">{detail}</p>
    {missingPath && (
      <p className="mt-2 inline-block rounded-md bg-[#0b0f14] border border-[#30363d] px-2.5 py-1 font-mono text-[11px] text-[#8b9bb4]">
        {missingPath}
      </p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => (
  <div
    role="alert"
    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f85149]/45 bg-[#f85149]/10 px-4 py-3 text-sm text-[#e6edf3]"
  >
    <div className="flex items-center gap-2.5 min-w-0">
      <AlertOctagon className="h-4 w-4 text-[#f85149] shrink-0" />
      <span className="truncate">{message}</span>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs font-medium text-[#e6edf3] hover:bg-[#21262d] transition-colors whitespace-nowrap shrink-0"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Tentar de novo
      </button>
    )}
  </div>
);

export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 4 }) => (
  <div
    aria-label="Carregando dados"
    className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 animate-pulse"
  >
    <div className="h-4 w-32 rounded bg-[#21262d]" />
    <div className="mt-4 space-y-2.5">
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className="h-3 rounded bg-[#21262d]"
          style={{ width: `${85 - idx * 12}%` }}
        />
      ))}
    </div>
  </div>
);

export const PnLLineChart: React.FC<{
  points: Array<{ ts: string; cumulative: number; symbol?: string; pnl: number }>;
  currency: CurrencyCode;
}> = ({ points, currency }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const w = 640;
  const h = 210;
  const padX = 44;
  const padY = 20;

  const { minVal, maxVal, coords, pathD, areaD, zeroY } = useMemo(() => {
    if (points.length === 0) {
      return { minVal: 0, maxVal: 0, coords: [], pathD: '', areaD: '', zeroY: h / 2 };
    }
    const vals = [0, ...points.map((p) => p.cumulative)];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;

    const toX = (i: number) =>
      points.length === 1
        ? padX + (w - padX * 2) / 2
        : padX + (i / (points.length - 1)) * (w - padX * 2);
    const toY = (v: number) => padY + ((max - v) / span) * (h - padY * 2);

    const c = points.map((p, i) => ({
      x: toX(i),
      y: toY(p.cumulative),
      ...p,
    }));
    const d = c.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
    const zY = toY(0);
    const area =
      c.length > 0
        ? `${d} L ${c[c.length - 1].x.toFixed(1)} ${zY.toFixed(1)} L ${c[0].x.toFixed(1)} ${zY.toFixed(1)} Z`
        : '';

    return { minVal: min, maxVal: max, coords: c, pathD: d, areaD: area, zeroY: zY };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-[210px] items-center justify-center text-xs text-[#8b9bb4]">
        Sem trades encerrados para traçar a curva acumulada.
      </div>
    );
  }

  const last = points[points.length - 1]?.cumulative ?? 0;
  const strokeColor = last >= 0 ? '#3fb950' : '#f85149';
  const hovered = hoverIdx !== null ? coords[hoverIdx] : null;

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full min-w-[460px] h-[210px] overflow-visible"
        role="img"
        aria-label="Curva de PnL acumulado do período"
      >
        <line x1={padX} x2={w - padX} y1={padY} y2={padY} stroke="#30363d" strokeDasharray="3 3" />
        <line
          x1={padX}
          x2={w - padX}
          y1={zeroY}
          y2={zeroY}
          stroke="#8b9bb4"
          strokeOpacity={0.45}
          strokeDasharray="4 4"
        />
        <line
          x1={padX}
          x2={w - padX}
          y1={h - padY}
          y2={h - padY}
          stroke="#30363d"
          strokeDasharray="3 3"
        />

        <text x={4} y={padY + 4} fill="#8b9bb4" fontSize="10" className="font-mono">
          {formatPrice(maxVal, 1)}
        </text>
        <text x={4} y={zeroY + 3} fill="#8b9bb4" fontSize="10" className="font-mono">
          0
        </text>
        <text x={4} y={h - padY + 4} fill="#8b9bb4" fontSize="10" className="font-mono">
          {formatPrice(minVal, 1)}
        </text>

        <path d={areaD} fill={strokeColor} fillOpacity={0.1} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={2.2} strokeLinejoin="round" />

        {coords.map((pt, i) => (
          <g key={`${pt.ts}-${i}`}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hoverIdx === i ? 5.5 : 3.5}
              fill={pt.pnl >= 0 ? '#3fb950' : '#f85149'}
              stroke="#0d1117"
              strokeWidth={1.5}
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          </g>
        ))}
      </svg>

      {hovered && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#30363d] bg-[#0b0f14] px-3 py-1.5 text-xs">
          <span className="font-mono text-[#8b9bb4]">
            {formatBrasiliaTime(hovered.ts, true)} (horário de Brasília)
          </span>
          <span className="font-mono text-[#e6edf3]">
            {hovered.symbol ?? 'Trade'} · resultado {formatMoney(hovered.pnl, currency, true)} · acumulado{' '}
            <strong className={hovered.cumulative >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
              {formatMoney(hovered.cumulative, currency, true)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
};

export const PnLBarChart: React.FC<{
  items: Array<{ label: string; ts: string; pnl: number }>;
  currency: CurrencyCode;
}> = ({ items, currency }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (items.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-xs text-[#8b9bb4]">
        Nenhum trade neste recorte.
      </div>
    );
  }
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.pnl)), 1);

  return (
    <div>
      <div className="flex h-[180px] items-end gap-2 overflow-x-auto pb-2 border-b border-[#30363d]">
        {items.map((item, idx) => {
          const pct = Math.max(8, Math.round((Math.abs(item.pnl) / maxAbs) * 100));
          const pos = item.pnl >= 0;
          return (
            <button
              key={`${item.ts}-${idx}`}
              type="button"
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
              onFocus={() => setHoverIdx(idx)}
              aria-label={`${item.label} ${formatMoney(item.pnl, currency, true)}`}
              className="group flex flex-1 min-w-[36px] flex-col items-center justify-end h-full focus-visible:outline-none"
            >
              <div
                className={`w-full max-w-[38px] rounded-t-md transition-opacity ${
                  pos ? 'bg-[#3fb950]' : 'bg-[#f85149]'
                } ${hoverIdx === idx ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}
                style={{ height: `${pct}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[#8b9bb4] font-mono">
        {hoverIdx !== null && items[hoverIdx] ? (
          <span>
            {items[hoverIdx].label} · {formatBrasiliaTime(items[hoverIdx].ts)} ·{' '}
            <strong className={items[hoverIdx].pnl >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
              {formatMoney(items[hoverIdx].pnl, currency, true)}
            </strong>
          </span>
        ) : (
          <span>Passe o cursor nas barras para ver o PnL por trade (horário de Brasília).</span>
        )}
      </div>
    </div>
  );
};

const ACTION_META: Record<
  DangerActionType,
  {
    title: string;
    keyword: string;
    effect: string;
    btnLabel: string;
    destructive: boolean;
  }
> = {
  kill: {
    title: 'Disparar Kill Switch do agente',
    keyword: 'MATAR',
    effect:
      'Grava var/<agente>/KILL. O loop do agente executa flatten_all, registra kill no journal e o wrapper não relança o processo enquanto o arquivo existir.',
    btnLabel: 'Confirmar KILL',
    destructive: true,
  },
  kill_all: {
    title: 'PÂNICO GLOBAL — Matar todos os agentes',
    keyword: 'MATAR',
    effect:
      'Grava var/KILL_ALL. Todos os agentes independentes (B3, NASDAQ e Cripto) encerram posições e interrompem novas entradas.',
    btnLabel: 'Confirmar KILL ALL',
    destructive: true,
  },
  flatten: {
    title: 'Zerar agente e cancelar ordens (Flatten)',
    keyword: 'ZERAR',
    effect:
      'Executa python -m daytrade.<agente> flatten: grava o arquivo KILL (bloqueia reentrada) e envia cancel_all para a corretora em modo live/demo.',
    btnLabel: 'Confirmar ZERAR',
    destructive: true,
  },
  kill_clear: {
    title: 'Limpar arquivo KILL',
    keyword: 'LIBERAR',
    effect:
      'Remove var/<agente>/KILL (KillSwitch.clear). Se a unidade systemd ainda estiver ativa, o wrapper voltará a lançar o processo Python.',
    btnLabel: 'Confirmar Limpeza de KILL',
    destructive: false,
  },
  reset_halt: {
    title: 'Resetar halt do agente',
    keyword: 'RESETAR',
    effect:
      'Executa python -m daytrade.<agente> reset-halt: limpa halted e sticky_halt no estado persistido. Não apaga o arquivo KILL.',
    btnLabel: 'Confirmar Reset de Halt',
    destructive: false,
  },
  unit_stop: {
    title: 'Parar unidade systemd do agente',
    keyword: 'PARAR',
    effect:
      'Executa systemctl --user stop triade-agent-<agente> (sem enable e sem linger). Impede o relançamento automático.',
    btnLabel: 'Confirmar Parada da Unit',
    destructive: true,
  },
  unit_start: {
    title: 'Iniciar unidade systemd do agente',
    keyword: 'INICIAR',
    effect:
      'Executa systemctl --user start triade-agent-<agente> (mantém unidade disabled no boot).',
    btnLabel: 'Confirmar Start da Unit',
    destructive: false,
  },
};

export const ConfirmDangerModal: React.FC<{
  open: boolean;
  action: DangerActionType;
  targetAgent: AgentSummary | 'all';
  allAgents: AgentSummary[];
  offline: boolean;
  onClose: () => void;
  onConfirm: (payload: DangerActionPayload) => Promise<void>;
}> = ({ open, action, targetAgent, allAgents, offline, onClose, onConfirm }) => {
  const meta = ACTION_META[action];
  const expectedAgentToken = targetAgent === 'all' ? 'TODOS' : targetAgent.agent;
  const affectedAgents = targetAgent === 'all' ? allAgents : [targetAgent];
  const anyLive = affectedAgents.some((a) => a.live_enabled);
  const openPositions = affectedAgents.flatMap((a) =>
    (a.state?.positions ?? []).map((p) => ({ agent: a.label, currency: a.currency, ...p }))
  );
  const isCryptoStickyHalt =
    action === 'reset_halt' &&
    targetAgent !== 'all' &&
    targetAgent.agent === 'crypto' &&
    Boolean(targetAgent.state?.sticky_halt);

  const [typedAgent, setTypedAgent] = useState('');
  const [typedWord, setTypedWord] = useState('');
  const [reason, setReason] = useState('');
  const [otp, setOtp] = useState('');
  const [ackLive, setAckLive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const requiresOtp = anyLive && action !== 'unit_start';
  const validAgent = typedAgent.trim().toLowerCase() === expectedAgentToken.toLowerCase();
  const validWord = typedWord.trim().toUpperCase() === meta.keyword;
  const validReason = reason.trim().length >= 4;
  const validLiveAck = !anyLive || ackLive;
  const validOtp = !requiresOtp || /^\d{6}$/.test(otp.trim());

  const canSubmit =
    !offline &&
    !submitting &&
    validAgent &&
    validWord &&
    validReason &&
    validLiveAck &&
    validOtp;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm({
        action,
        agent: targetAgent === 'all' ? 'all' : targetAgent.agent,
        confirm_agent: typedAgent.trim(),
        confirm_word: typedWord.trim().toUpperCase(),
        reason: reason.trim(),
        otp: requiresOtp ? otp.trim() : undefined,
        ack_live: ackLive,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao executar comando.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="danger-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#30363d] bg-[#161b22] shadow-2xl overflow-hidden">
        <div
          className={`h-1 w-full ${anyLive ? 'bg-[#f85149]' : 'bg-[#58a6ff]'}`}
        />
        <div className="flex items-start justify-between gap-3 border-b border-[#30363d] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldAlert
              className={`h-5 w-5 shrink-0 ${anyLive || meta.destructive ? 'text-[#f85149]' : 'text-[#d29922]'}`}
            />
            <div>
              <h2 id="danger-modal-title" className="text-base font-semibold text-[#e6edf3]">
                {meta.title}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <ModeBadge live={anyLive} compact />
                <span className="text-xs text-[#8b9bb4] font-mono">
                  Alvo: {expectedAgentToken}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar diálogo de confirmação"
            className="rounded-lg p-1.5 text-[#8b9bb4] hover:bg-[#21262d] hover:text-[#e6edf3]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-xs text-[#e6edf3]">
            {meta.effect}
          </div>

          {isCryptoStickyHalt && (
            <div className="flex items-start gap-2 rounded-lg border border-[#d29922]/50 bg-[#d29922]/10 p-3 text-xs text-[#d29922]">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Aviso obrigatório (Cripto):</strong> este halt de drawdown é persistente
                (sticky); só liberar se Diego pediu explicitamente.
              </span>
            </div>
          )}

          {openPositions.length > 0 && (
            <div className="rounded-lg border border-[#30363d] bg-[#0b0f14] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8b9bb4] mb-2">
                Posições abertas afetadas ({openPositions.length})
              </div>
              <div className="space-y-1.5">
                {openPositions.map((p) => (
                  <div
                    key={p.client_order_id}
                    className="flex items-center justify-between text-xs font-mono tabular-nums"
                  >
                    <span className="text-[#e6edf3]">
                      {p.agent} · {p.contract || p.symbol} ({p.qty > 0 ? `+${p.qty}` : p.qty})
                    </span>
                    <span className="text-[#8b9bb4]">
                      Stop: {p.stop_price !== null ? formatPrice(p.stop_price) : 'AUSENTE'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-[#8b9bb4] mb-1">
                Digite <code className="text-[#e6edf3]">{expectedAgentToken}</code>
              </label>
              <input
                type="text"
                value={typedAgent}
                onChange={(e) => setTypedAgent(e.target.value)}
                placeholder={expectedAgentToken}
                className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm font-mono text-[#e6edf3] placeholder:text-[#8b9bb4]/50"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-[#8b9bb4] mb-1">
                Digite <code className="text-[#e6edf3]">{meta.keyword}</code>
              </label>
              <input
                type="text"
                value={typedWord}
                onChange={(e) => setTypedWord(e.target.value)}
                placeholder={meta.keyword}
                className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm font-mono text-[#e6edf3] placeholder:text-[#8b9bb4]/50"
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-[#8b9bb4] mb-1">
              Motivo para trilha de auditoria (mín. 4 caracteres)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: encerramento manual do operador"
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#e6edf3] placeholder:text-[#8b9bb4]/50"
            />
          </div>

          {anyLive && (
            <label className="flex items-center gap-2.5 rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2.5 text-xs text-[#e6edf3] cursor-pointer">
              <input
                type="checkbox"
                checked={ackLive}
                onChange={(e) => setAckLive(e.target.checked)}
                className="h-4 w-4 accent-[#f85149]"
              />
              <span>Estou ciente de que este comando atua em conta REAL (live_enabled: true).</span>
            </label>
          )}

          {requiresOtp && (
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-[#f85149] mb-1">
                Segundo fator TOTP (6 dígitos — obrigatório no live)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6 dígitos do autenticador"
                className="w-full rounded-lg border border-[#f85149]/45 bg-[#0d1117] px-3 py-2 text-sm font-mono tracking-widest text-[#e6edf3]"
                autoComplete="one-time-code"
              />
            </div>
          )}

          {offline && <ErrorState message="Modo fail-closed: sem conexão com o VPS. Controles bloqueados." />}
          {errorMsg && <ErrorState message={errorMsg} />}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#30363d]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#30363d] bg-[#21262d] px-4 py-2 text-xs font-medium text-[#e6edf3] hover:bg-[#30363d] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity whitespace-nowrap ${
                meta.destructive ? 'bg-[#f85149]' : 'bg-[#7aa2f7] text-[#0d1117]'
              } disabled:opacity-45 disabled:cursor-not-allowed`}
            >
              {submitting ? 'Enviando...' : meta.btnLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
