import React from 'react';
import {
  AlertTriangle,
  OctagonX,
  Play,
  RotateCcw,
  ShieldAlert,
  Square,
  Terminal,
} from 'lucide-react';
import { READONLY_CONTROL_NOTE } from '../../api/readonly';
import { AgentSummary, StatusResponse } from '../../types/triade';
import { ErrorState, ModeBadge, StatusBadge } from '../ui/Primitives';

export const ControlsView: React.FC<{
  status: StatusResponse | null;
  offline: boolean;
}> = ({ status, offline }) => {
  const agents: AgentSummary[] = status
    ? [status.agents.b3, status.agents.nasdaq, status.agents.crypto]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">
            Kill switch e controles operacionais
          </h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Fachada auditada para var/&lt;agente&gt;/KILL, CLI flatten, reset-halt e systemctl --user
            stop/start
          </p>
        </div>

        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-lg bg-[#f85149] px-4 py-2 text-xs font-semibold text-white opacity-45 cursor-not-allowed"
        >
          <OctagonX className="h-4 w-4" />
          PÂNICO GLOBAL — Matar todos (indisponível)
        </button>
      </div>

      <div className="rounded-xl border border-[#d29922]/50 bg-[#d29922]/10 px-4 py-3 text-xs text-[#d29922]">
        {READONLY_CONTROL_NOTE}
        {offline ? ' Sem conexão com o VPS, o painel continua fail-closed.' : ''}
      </div>

      {offline && (
        <ErrorState message="Modo fail-closed: sem conexão com o VPS. Todos os controles estão desabilitados." />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {agents.map((ag) => (
          <section
            key={ag.agent}
            className={`rounded-xl border border-[#30363d] bg-[#1c2330] border-t-[3px] p-4 space-y-4 ${
              ag.live_enabled ? 'border-t-[#f85149]' : 'border-t-[#58a6ff]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-[#e6edf3]">{ag.label}</h2>
                  <ModeBadge live={ag.live_enabled} compact />
                </div>
                <div className="mt-1 text-xs font-mono text-[#8b9bb4]">
                  {ag.units.agent.unit} ({ag.units.agent.active})
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {ag.kill.blocked && <StatusBadge variant="bad" label="kill ativo" />}
                {ag.state?.halted && <StatusBadge variant="warn" label="halted" />}
              </div>
            </div>

            {ag.agent === 'crypto' && ag.state?.sticky_halt && (
              <div className="flex items-start gap-2 rounded-lg border border-[#d29922]/45 bg-[#d29922]/10 p-2.5 text-[11px] text-[#d29922]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Halt sticky de drawdown máximo: não resetar sem pedido explícito de Diego.
                </span>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-[#30363d]">
              <button
                type="button"
                disabled
                title={READONLY_CONTROL_NOTE}
                className="w-full flex items-center justify-between rounded-lg bg-[#f85149] px-3 py-2 text-xs font-semibold text-white hover:bg-[#f85149]/90 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span>Zerar agente (flatten + KILL)</span>
                <OctagonX className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                disabled
                title={READONLY_CONTROL_NOTE}
                className="w-full flex items-center justify-between rounded-lg border border-[#f85149]/60 bg-[#f85149]/15 px-3 py-2 text-xs font-semibold text-[#f85149] hover:bg-[#f85149]/25 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span>Matar agente (var/{ag.agent}/KILL)</span>
                <ShieldAlert className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                disabled
                title={READONLY_CONTROL_NOTE}
                className="w-full flex items-center justify-between rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-xs font-medium text-[#e6edf3] hover:bg-[#30363d] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span>Liberar kill (KillSwitch.clear)</span>
                <span className="font-mono text-[10px] text-[#8b9bb4]">rm KILL</span>
              </button>

              <button
                type="button"
                disabled
                title={READONLY_CONTROL_NOTE}
                className="w-full flex items-center justify-between rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-xs font-medium text-[#e6edf3] hover:bg-[#30363d] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span>
                  {ag.units.agent.active === 'active'
                    ? 'Parar processo (systemctl stop)'
                    : 'Iniciar processo (systemctl start)'}
                </span>
                {ag.units.agent.active === 'active' ? (
                  <Square className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                type="button"
                disabled
                title={READONLY_CONTROL_NOTE}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-45 disabled:cursor-not-allowed ${
                  ag.agent === 'crypto'
                    ? 'border-[#30363d] bg-[#0d1117] text-[#8b9bb4]'
                    : 'border-[#d29922]/50 bg-[#d29922]/15 text-[#d29922]'
                }`}
              >
                <span>Resetar halt (reset-halt)</span>
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        ))}
      </div>

      {/* CLI manual reference (Section 12) */}
      <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#e6edf3]">
          <Terminal className="h-4 w-4 text-[#7aa2f7]" />
          Referência rápida de comandos manuais no VPS (SSH)
        </div>
        <pre className="rounded-lg border border-[#30363d] bg-[#0b0f14] p-3 font-mono text-[11px] text-[#8b9bb4] overflow-x-auto leading-relaxed">
{`export XDG_RUNTIME_DIR=/run/user/0
/opt/triade/.venv/bin/python -m daytrade.b3 status
cd /opt/triade && .venv/bin/python -m daytrade.b3 flatten
touch /opt/triade/var/b3/KILL   # ou /opt/triade/var/KILL_ALL
systemctl --user stop triade-agent-b3
/opt/triade/.venv/bin/python -m daytrade.crypto reset-halt`}
        </pre>
      </section>
    </div>
  );
};
