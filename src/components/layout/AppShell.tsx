import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CandlestickChart,
  Clock,
  Cpu,
  FileSearch,
  FlaskConical,
  Gauge,
  History,
  Layers,
  LayoutDashboard,
  Menu,
  OctagonX,
  Search,
  Server,
  Settings,
  ShieldAlert,
  Sliders,
  Terminal,
  X,
} from 'lucide-react';
import {
  AgentId,
  AgentSummary,
  ConnectionState,
  RouteKey,
  StatusResponse,
  TimelineEvent,
  UserRole,
} from '../../types/triade';
import {
  AGENT_NAMES,
  EVENT_LABELS,
  formatBrasiliaTime,
  formatNewYorkTime,
  summarizeTimelineEvent,
} from '../../utils/format';

export interface ToastMessage {
  id: string;
  tone: 'good' | 'warn' | 'bad' | 'info';
  title: string;
  detail?: string;
}

interface NavItem {
  key: RouteKey;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'Operação' | 'Análise' | 'Sistema';
  shortcut?: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: 'Visão geral', icon: LayoutDashboard, group: 'Operação', shortcut: 'G' },
  { key: 'agent-b3', label: 'Agente B3', icon: Activity, group: 'Operação' },
  { key: 'agent-nasdaq', label: 'Agente NASDAQ', icon: Activity, group: 'Operação' },
  { key: 'agent-crypto', label: 'Agente Cripto', icon: Activity, group: 'Operação' },
  { key: 'timeline', label: 'Linha do tempo', icon: Clock, group: 'Operação', shortcut: 'T' },
  { key: 'positions', label: 'Posições e ordens', icon: Layers, group: 'Operação' },
  { key: 'risk', label: 'Gestão de risco', icon: Gauge, group: 'Operação', shortcut: 'R' },
  { key: 'pnl', label: 'PnL e performance', icon: BarChart3, group: 'Análise' },
  { key: 'charts', label: 'Gráficos', icon: CandlestickChart, group: 'Análise', shortcut: 'C' },
  { key: 'trades', label: 'Histórico de trades', icon: History, group: 'Análise' },
  { key: 'backtests', label: 'Backtests', icon: FlaskConical, group: 'Análise' },
  { key: 'strategies', label: 'Estratégias e parâmetros', icon: Sliders, group: 'Análise' },
  { key: 'infra', label: 'Saúde da infra', icon: Server, group: 'Sistema' },
  { key: 'alerts', label: 'Alertas', icon: AlertTriangle, group: 'Sistema' },
  { key: 'controls', label: 'Kill switch e controles', icon: ShieldAlert, group: 'Sistema', shortcut: 'K' },
  { key: 'logs', label: 'Logs', icon: Terminal, group: 'Sistema' },
  { key: 'audit', label: 'Auditoria', icon: FileSearch, group: 'Sistema' },
  { key: 'settings', label: 'Configurações e usuários', icon: Settings, group: 'Sistema' },
];

const ROUTE_BREADCRUMBS: Record<RouteKey, string> = {
  overview: 'Visão geral',
  'agent-b3': 'Agentes / B3',
  'agent-nasdaq': 'Agentes / NASDAQ',
  'agent-crypto': 'Agentes / Cripto',
  timeline: 'Linha do tempo',
  positions: 'Posições e ordens',
  risk: 'Gestão de risco',
  pnl: 'PnL e performance',
  charts: 'Gráficos',
  trades: 'Histórico de trades',
  backtests: 'Backtests',
  strategies: 'Estratégias e parâmetros',
  infra: 'Saúde da infra',
  alerts: 'Alertas',
  controls: 'Kill switch e controles',
  logs: 'Logs',
  audit: 'Auditoria',
  settings: 'Configurações e usuários',
};

function formatSessionExpiry(expiresAt: number): string {
  const date = new Date(expiresAt * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AppShell: React.FC<{
  route: RouteKey;
  onNavigate: (route: RouteKey, query?: { agent?: AgentId; clientOrderId?: string }) => void;
  status: StatusResponse | null;
  connection: ConnectionState;
  role: UserRole;
  sessionUser: string;
  sessionExpiresAt: number;
  onLogout: () => void;
  logoutBusy: boolean;
  adminOpen: boolean;
  onOpenAdmin: () => void;
  tunnelEnv: string;
  stub: boolean;
  onOpenKillAll: () => void;
  recentEvents: TimelineEvent[];
  unackedAlertsCount: number;
  toasts: ToastMessage[];
  onDismissToast: (id: string) => void;
  children: React.ReactNode;
}> = ({
  route,
  onNavigate,
  status,
  connection,
  role,
  sessionUser,
  sessionExpiresAt,
  onLogout,
  logoutBusy,
  adminOpen,
  onOpenAdmin,
  tunnelEnv,
  stub,
  onOpenKillAll,
  recentEvents,
  unackedAlertsCount,
  toasts,
  onDismissToast,
  children,
}) => {
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => setNowIso(new Date().toISOString()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (inInput || adminOpen) return;

      if (e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setMobileDrawerOpen(false);
      } else if (e.key.toLowerCase() === 'g') {
        onNavigate('overview');
      } else if (e.key.toLowerCase() === 't') {
        onNavigate('timeline');
      } else if (e.key.toLowerCase() === 'r') {
        onNavigate('risk');
      } else if (e.key.toLowerCase() === 'c') {
        onNavigate('charts');
      } else if (e.key.toLowerCase() === 'k') {
        onNavigate('controls');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onNavigate, adminOpen]);

  const agentsList: AgentSummary[] = useMemo(() => {
    if (!status) return [];
    return [status.agents.b3, status.agents.nasdaq, status.agents.crypto];
  }, [status]);

  const anyLive = agentsList.some((a) => a.live_enabled);
  const offline = connection === 'offline';
  const showNyClock = route === 'agent-nasdaq';

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recentEvents.slice(0, 8);
    return recentEvents
      .filter((ev) => {
        const hay = [
          ev.symbol,
          ev.contract,
          ev.client_order_id,
          ev.event,
          ev.agent,
          ev.reason,
          ev.motivo,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [recentEvents, searchQuery]);

  const getAgentDotColor = (ag: AgentSummary) => {
    if (ag.kill.blocked) return 'bg-[#f85149]';
    if (ag.state?.halted) return 'bg-[#d29922]';
    if (ag.units.agent.active !== 'active') return 'bg-[#8b9bb4]';
    return ag.live_enabled ? 'bg-[#f85149]' : 'bg-[#58a6ff]';
  };

  const getAgentCompactStatus = (ag: AgentSummary) => {
    if (ag.kill.blocked) return 'kill';
    if (ag.state?.halted) return 'travado';
    if (ag.units.agent.active !== 'active') return 'parado';
    return 'ativo';
  };

  const connLabel: Record<ConnectionState, { text: string; color: string }> = {
    sse: { text: 'ao vivo (SSE)', color: 'text-[#3fb950]' },
    polling: { text: 'polling 5s', color: 'text-[#7aa2f7]' },
    reconnecting: { text: 'reconectando', color: 'text-[#d29922]' },
    offline: { text: 'offline', color: 'text-[#f85149]' },
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117] text-[#e6edf3]">
      {/* Global Mode Banner */}
      {stub && (
        <div className="bg-[#d29922]/20 border-b border-[#d29922]/50 px-4 py-1.5 text-xs font-semibold text-[#d29922]">
          STUB LOCAL — estes números vêm do contrato de exemplo, não da VPS.
        </div>
      )}
      {offline ? (
        <div
          role="alert"
          className="bg-[#f85149]/15 border-b border-[#f85149]/50 px-4 py-1.5 text-xs font-medium text-[#f85149]"
        >
          FAIL-CLOSED: sem conexão com o painel ({status?.bind || '127.0.0.1:8765'}). O túnel SSH
          pode estar caído. Controles de escrita permanecem desabilitados.
        </div>
      ) : !status ? (
        <div className="border-b border-[#30363d] bg-[#161b22] px-4 py-1.5 text-xs text-[#8b9bb4]">
          Carregando status dos agentes…
        </div>
      ) : (
        <div
          className={`border-b px-4 py-1.5 text-xs font-medium flex flex-wrap items-center justify-between gap-2 ${
            anyLive
              ? 'bg-[rgba(248,81,73,0.08)] border-[#f85149]/35 text-[#e6edf3]'
              : 'bg-[rgba(88,166,255,0.08)] border-[#58a6ff]/35 text-[#e6edf3]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                anyLive ? 'bg-[#f85149] text-white' : 'bg-[#58a6ff] text-[#0d1117]'
              }`}
            >
              {anyLive ? 'MODO REAL ATIVO' : 'MODO PAPEL'}
            </span>
            <span className="truncate">
              {anyLive
                ? `Há agente em modo REAL (${agentsList
                    .filter((ag) => ag.live_enabled)
                    .map((ag) =>
                      ag.contract_current ? `${ag.label} · ${ag.contract_current}` : ag.label
                    )
                    .join(', ')}). Conta real. Escrita só em Administração, com sessão e TOTP.`
                : 'Todos os agentes em modo PAPEL. O live da cripto só liga em Administração, depois dos pré-requisitos.'}
            </span>
          </div>
          <span className="hidden md:inline font-mono text-[11px] text-[#8b9bb4]">{tunnelEnv}</span>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop & Tablet Sidebar */}
        <aside
          aria-label="Navegação principal"
          className="hidden md:flex md:w-16 xl:w-60 shrink-0 flex-col border-r border-[#30363d] bg-[#161b22]"
        >
          <div className="flex h-14 items-center justify-between px-4 border-b border-[#30363d]">
            <button
              type="button"
              onClick={() => onNavigate('overview')}
              className="flex items-center gap-2.5 text-left focus-visible:outline-none"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1c2330] border border-[#30363d] text-xs font-bold tracking-tight text-[#7aa2f7] shrink-0">
                T3
              </div>
              <span className="hidden xl:inline text-sm font-bold tracking-tight text-[#e6edf3] whitespace-nowrap">
                TRIADE
              </span>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
            {(['Operação', 'Análise', 'Sistema'] as const).map((group) => {
              const items = NAV_ITEMS.filter((i) => i.group === group);
              return (
                <div key={group}>
                  <div className="hidden xl:block px-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8b9bb4]">
                    {group}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = route === item.key;
                      if (item.key === 'audit' && role === 'service') return null;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => onNavigate(item.key)}
                          title={item.label}
                          aria-label={item.label}
                          aria-current={active ? 'page' : undefined}
                          className={`w-full flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                            active
                              ? 'bg-[#1c2330] text-[#e6edf3] border border-[#30363d]'
                              : 'text-[#8b9bb4] hover:bg-[#21262d]/60 hover:text-[#e6edf3] border border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                active ? 'text-[#7aa2f7]' : 'text-[#8b9bb4]'
                              }`}
                            />
                            <span className="hidden xl:inline truncate">{item.label}</span>
                          </span>
                          {item.key === 'alerts' && unackedAlertsCount > 0 && (
                            <span className="hidden xl:inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#f85149]/20 text-[#f85149]">
                              {unackedAlertsCount}
                            </span>
                          )}
                          {item.shortcut && (
                            <kbd className="hidden xl:inline rounded border border-[#30363d] bg-[#0d1117] px-1.5 py-0.5 text-[10px] font-mono text-[#8b9bb4]">
                              {item.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="border-t border-[#30363d] p-3 hidden xl:block">
            <div className="text-xs min-w-0">
              <div className="font-medium text-[#e6edf3] truncate">{sessionUser}</div>
              <div className="text-[11px] text-[#8b9bb4]">
                sessão até {formatSessionExpiry(sessionExpiresAt)}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Chrome */}
          <header className="sticky top-0 z-30 h-14 border-b border-[#30363d] bg-[#0d1117]/95 backdrop-blur px-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="md:hidden text-sm font-bold text-[#e6edf3]">TRIADE</span>
              <span className="hidden md:inline text-xs text-[#8b9bb4] font-mono truncate">
                TRIADE / <span className="text-[#e6edf3]">{ROUTE_BREADCRUMBS[route]}</span>
              </span>
            </div>

            {/* Compact 3-agent indicators */}
            <div className="hidden 2xl:flex items-center gap-2">
              {agentsList.map((ag) => (
                <button
                  key={ag.agent}
                  type="button"
                  onClick={() => onNavigate(`agent-${ag.agent}` as RouteKey)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#161b22] px-2.5 py-1 text-xs hover:bg-[#1c2330] transition-colors whitespace-nowrap shrink-0"
                  title={`Abrir painel ${ag.label}`}
                >
                  <span className={`h-2 w-2 rounded-full ${getAgentDotColor(ag)}`} />
                  <span className="font-semibold text-[#e6edf3]">{ag.label}</span>
                  <span
                    className={`font-mono text-[10px] font-semibold uppercase ${
                      ag.live_enabled ? 'text-[#f85149]' : 'text-[#58a6ff]'
                    }`}
                  >
                    {ag.live_enabled ? 'REAL' : 'PAPEL'}
                  </span>
                  <span className="text-[#8b9bb4] text-[11px]">· {getAgentCompactStatus(ag)}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Clocks */}
              <div className="hidden 2xl:flex flex-col items-end font-mono tabular-nums leading-tight">
                <span className="text-xs text-[#e6edf3]">
                  {formatBrasiliaTime(nowIso)}{' '}
                  <span className="text-[10px] text-[#8b9bb4]">BRT</span>
                </span>
                {showNyClock && (
                  <span className="text-[10px] text-[#8b9bb4]">
                    {formatNewYorkTime(nowIso)} NY
                  </span>
                )}
              </div>

              {/* Connection state */}
              <div
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#161b22] px-2.5 py-1 text-[11px] font-mono whitespace-nowrap"
                title="Estado da conexão com a API do painel no VPS"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    connection === 'sse'
                      ? 'bg-[#3fb950]'
                      : connection === 'polling'
                        ? 'bg-[#7aa2f7]'
                        : connection === 'reconnecting'
                          ? 'bg-[#d29922]'
                          : 'bg-[#f85149]'
                  }`}
                />
                <span className={connLabel[connection].color}>{connLabel[connection].text}</span>
              </div>

              {/* Search trigger */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar símbolo, client_order_id ou evento (atalho /)"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#161b22] px-2.5 py-1.5 text-xs text-[#8b9bb4] hover:text-[#e6edf3] hover:bg-[#1c2330] transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Buscar</span>
                <kbd className="hidden xl:inline rounded border border-[#30363d] px-1 text-[10px] font-mono">
                  /
                </kbd>
              </button>

              <div className="flex items-center gap-2 rounded-lg border border-[#30363d] bg-[#161b22] px-2 py-1">
                <div className="leading-tight text-right">
                  <div className="max-w-[7rem] truncate text-xs font-medium text-[#e6edf3]">{sessionUser}</div>
                  <div
                    className="whitespace-nowrap font-mono text-[10px] text-[#8b9bb4]"
                    title={`Sessão expira em ${formatSessionExpiry(sessionExpiresAt)} BRT`}
                  >
                    até {formatSessionExpiry(sessionExpiresAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={logoutBusy}
                  className="rounded-md border border-[#30363d] px-2 py-1 text-xs font-semibold text-[#e6edf3] hover:bg-[#1c2330] disabled:opacity-45"
                >
                  {logoutBusy ? 'Saindo…' : 'Sair'}
                </button>
              </div>

              <button
                type="button"
                onClick={onOpenAdmin}
                aria-haspopup="dialog"
                aria-expanded={adminOpen}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#7aa2f7]/50 bg-[#7aa2f7]/10 px-2.5 py-1.5 text-xs font-semibold text-[#7aa2f7] hover:bg-[#7aa2f7]/20 whitespace-nowrap"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#3fb950]" />
                Administração
              </button>

              <button
                type="button"
                disabled
                onClick={onOpenKillAll}
                aria-label="Kill all indisponível: backend somente leitura"
                title="Somente leitura: POST /api/v2/kill-all responde 405. Nada é enviado."
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#f85149]/40 px-3 py-1.5 text-xs font-semibold text-white opacity-45 cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <OctagonX className="h-3.5 w-3.5" />
                <span>Kill all</span>
              </button>
            </div>
          </header>

          {/* Main Workspace Content */}
          <main className="flex-1 p-4 md:p-6 pb-24 md:pb-8 max-w-[1440px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Nav (<768px) */}
      <nav
        aria-label="Navegação móvel"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[#30363d] bg-[#161b22] grid grid-cols-5 h-14"
      >
        {[
          { key: 'overview' as RouteKey, label: 'Visão', icon: LayoutDashboard },
          { key: 'timeline' as RouteKey, label: 'Tempo', icon: Clock },
          { key: 'risk' as RouteKey, label: 'Risco', icon: Gauge },
          { key: 'controls' as RouteKey, label: 'Controles', icon: ShieldAlert },
        ].map((item) => {
          const Icon = item.icon;
          const active = route === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? 'text-[#7aa2f7]' : 'text-[#8b9bb4]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[#8b9bb4]"
        >
          <Menu className="h-4 w-4" />
          <span>Mais</span>
        </button>
      </nav>

      {/* Mobile "Mais" Drawer */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/70 flex justify-end">
          <div className="w-72 bg-[#161b22] border-l border-[#30363d] h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
              <span className="text-sm font-semibold text-[#e6edf3]">Todas as telas</span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Fechar menu"
                className="p-1 text-[#8b9bb4]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  onOpenAdmin();
                  setMobileDrawerOpen(false);
                }}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-[#7aa2f7]"
              >
                Administração
              </button>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onNavigate(item.key);
                      setMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium ${
                      route === item.key
                        ? 'bg-[#1c2330] text-[#e6edf3]'
                        : 'text-[#8b9bb4] hover:text-[#e6edf3]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-[#30363d] p-3 text-xs text-[#8b9bb4]">
              {sessionUser} · até {formatSessionExpiry(sessionExpiresAt)}
            </div>
          </div>
        </div>
      )}

      {/* Quick Search Modal (/) */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-20 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Busca rápida por símbolo, client_order_id ou evento"
        >
          <div className="w-full max-w-xl rounded-xl border border-[#30363d] bg-[#161b22] shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#30363d] px-4 py-3">
              <Search className="h-4 w-4 text-[#8b9bb4]" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar símbolo (WIN, BTCUSDT), client_order_id ou evento..."
                className="flex-1 bg-transparent text-sm text-[#e6edf3] placeholder:text-[#8b9bb4] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded border border-[#30363d] px-1.5 py-0.5 text-[10px] font-mono text-[#8b9bb4]"
              >
                ESC
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-[#30363d]">
              {searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8b9bb4]">
                  Nenhum evento encontrado para “{searchQuery}”.
                </div>
              ) : (
                searchResults.map((ev, idx) => (
                  <button
                    key={`${ev.ts}-${idx}`}
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      onNavigate('timeline', {
                        agent: ev.agent,
                        clientOrderId: ev.client_order_id,
                      });
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#1c2330] transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-[#e6edf3]">
                          {AGENT_NAMES[ev.agent]}
                        </span>
                        <span className="text-[#7aa2f7]">
                          {EVENT_LABELS[ev.event] ?? ev.event}
                        </span>
                        {ev.client_order_id && (
                          <span className="font-mono text-[11px] text-[#8b9bb4]">
                            {ev.client_order_id}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8b9bb4] truncate mt-0.5">
                        {summarizeTimelineEvent(ev)}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[#8b9bb4] shrink-0">
                      {formatBrasiliaTime(ev.ts)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Stack */}
      <div
        aria-live="polite"
        className="fixed bottom-16 md:bottom-4 right-4 z-40 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => {
          const border =
            t.tone === 'bad'
              ? 'border-[#f85149]/60'
              : t.tone === 'warn'
                ? 'border-[#d29922]/60'
                : t.tone === 'good'
                  ? 'border-[#3fb950]/60'
                  : 'border-[#7aa2f7]/60';
          return (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-xl border ${border} bg-[#161b22] px-4 py-3 shadow-xl flex items-start justify-between gap-3`}
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#e6edf3]">{t.title}</div>
                {t.detail && <div className="mt-0.5 text-[11px] text-[#8b9bb4]">{t.detail}</div>}
              </div>
              <button
                type="button"
                onClick={() => onDismissToast(t.id)}
                aria-label="Fechar notificação"
                className="text-[#8b9bb4] hover:text-[#e6edf3]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
