import React from 'react';
import { Bell, Check } from 'lucide-react';
import { AlertItem } from '../../types/triade';
import { AGENT_NAMES, formatBrasiliaTime } from '../../utils/format';
import { EmptyState, ModeBadge, StatusBadge } from '../ui/Primitives';

export const AlertsView: React.FC<{
  alerts: AlertItem[];
  telegramEnabled: boolean;
  onAcknowledge: (id: string) => void;
}> = ({ alerts, telegramEnabled, onAcknowledge }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">Alertas e notificações</h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Derivados de halt, sticky_halt, kill, disconnect, reconcile e saúde das pontes · live em
            vermelho, paper em azul-acinzentado
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs">
          <Bell className="h-3.5 w-3.5 text-[#8b9bb4]" />
          <span className="text-[#8b9bb4]">TelegramNotifier:</span>
          <StatusBadge
            variant={telegramEnabled ? 'ok' : 'neutral'}
            label={telegramEnabled ? 'ligado' : 'desligado'}
          />
        </div>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          title="Nenhum alerta registrado hoje"
          detail="Todos os agentes e pontes operam dentro dos parâmetros normais."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((al) => {
            const isLive = al.mode === 'live';
            return (
              <div
                key={al.id}
                className={`rounded-xl border p-4 flex flex-wrap items-start justify-between gap-4 ${
                  al.acknowledged
                    ? 'border-[#30363d] bg-[#161b22] opacity-70'
                    : isLive
                      ? 'border-[#f85149]/50 bg-[#f85149]/10'
                      : 'border-[#58a6ff]/40 bg-[#1c2330]'
                }`}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-[#8b9bb4]">
                      {formatBrasiliaTime(al.ts, true)}
                    </span>
                    <span className="text-xs font-semibold text-[#e6edf3]">
                      {al.agent === 'infra' ? 'Infra' : AGENT_NAMES[al.agent]}
                    </span>
                    {al.mode !== 'infra' && <ModeBadge live={isLive} compact />}
                    <StatusBadge
                      variant={
                        al.severity === 'critical'
                          ? 'bad'
                          : al.severity === 'warning'
                            ? 'warn'
                            : 'info'
                      }
                      label={al.origin}
                    />
                  </div>
                  <h2
                    className={`text-sm font-semibold ${
                      isLive ? 'text-[#f85149]' : 'text-[#e6edf3]'
                    }`}
                  >
                    {al.title}
                  </h2>
                  <p className="text-xs text-[#8b9bb4]">{al.detail}</p>
                </div>

                <div className="shrink-0">
                  {al.acknowledged ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[#3fb950] font-medium">
                      <Check className="h-3.5 w-3.5" /> Visto
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAcknowledge(al.id)}
                      className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-xs font-medium text-[#e6edf3] hover:bg-[#30363d]"
                    >
                      Marcar como visto
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
