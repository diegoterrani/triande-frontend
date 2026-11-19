import React from 'react';
import { readApiBase } from '../../api/env';
import { READONLY_CONTROL_NOTE } from '../../api/readonly';
import { AgentId, HealthResponse } from '../../types/triade';
import { AGENT_NAMES } from '../../utils/format';
import { StatusBadge } from '../ui/Primitives';

export const SettingsView: React.FC<{
  tunnelEnv: string;
  followDefault: boolean;
  telegramFlags: Record<AgentId, boolean | null>;
  health: HealthResponse | null;
  onToggleFollowDefault: () => void;
}> = ({
  tunnelEnv,
  followDefault,
  telegramFlags,
  health,
  onToggleFollowDefault,
}) => {
  const ignoredBase = readApiBase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-[#e6edf3]">Conexão e preferências</h1>
        <p className="text-xs text-[#8b9bb4] mt-0.5">
          Preferências deste navegador. A sessão do painel fica só na memória e no cookie HttpOnly. {READONLY_CONTROL_NOTE}
        </p>
      </div>

      <section className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[#e6edf3]">API /api/v2</h2>
          <StatusBadge
            variant={health?.ok ? 'ok' : 'warn'}
            label={health?.stub ? 'STUB LOCAL' : health?.ok ? 'health ok' : 'sem health'}
          />
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-[#8b9bb4]">Origem em uso</dt>
            <dd className="font-mono text-[#e6edf3] mt-0.5">mesma origem · /api/v2</dd>
          </div>
          <div>
            <dt className="text-[#8b9bb4]">Rótulo da sessão</dt>
            <dd className="font-mono text-[#e6edf3] mt-0.5">{tunnelEnv}</dd>
          </div>
          <div>
            <dt className="text-[#8b9bb4]">Versão / bind</dt>
            <dd className="font-mono text-[#e6edf3] mt-0.5">
              {health?.version ?? '—'} · {health?.bind || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[#8b9bb4]">Somente leitura / auth</dt>
            <dd className="font-mono text-[#e6edf3] mt-0.5">
              readonly={String(health?.readonly ?? true)} · auth_required=
              {String(health?.auth_required ?? true)} · authenticated=
              {String(health?.authenticated ?? true)}
            </dd>
          </div>
        </dl>
        <p className="text-xs leading-relaxed text-[#8b9bb4]">
          Os pedidos usam URL relativa e <span className="font-mono">credentials: same-origin</span>.
          O cookie <span className="font-mono">triade_session</span> não sai desta origem. Para o túnel
          local, publique a API no mesmo host com o proxy do Vite (<span className="font-mono">VITE_DEV_PROXY</span>).
        </p>
        {ignoredBase ? (
          <p className="text-xs leading-relaxed text-[#d29922]">
            VITE_API_BASE={ignoredBase} está definido e é ignorado. Uma origem diferente não envia o cookie.
          </p>
        ) : null}
        <pre className="overflow-x-auto rounded-lg border border-[#30363d] bg-[#0b0f14] p-3 text-[11px] text-[#8b9bb4]">{`ssh -L 8765:127.0.0.1:8765 -L 5971:127.0.0.1:5971 -L 5972:127.0.0.1:5972 user@<vps>`}</pre>
      </section>

      <section className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-3">
        <h2 className="text-base font-semibold text-[#e6edf3]">Telegram (flag do YAML, sem toggle)</h2>
        <ul className="space-y-1.5 text-xs">
          {(['b3', 'nasdaq', 'crypto'] as AgentId[]).map((id) => (
            <li key={id} className="flex items-center justify-between gap-3">
              <span className="text-[#e6edf3]">{AGENT_NAMES[id]}</span>
              <StatusBadge
                variant={telegramFlags[id] === true ? 'ok' : 'neutral'}
                label={
                  telegramFlags[id] === null
                    ? 'não informado'
                    : telegramFlags[id]
                      ? 'telegram_enabled true'
                      : 'telegram_enabled false'
                }
              />
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-[#8b9bb4]">
          notifications.telegram_enabled é só leitura. Não há endpoint para ligar ou desligar o bot.
        </p>
      </section>

      <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#e6edf3]">Seguir a timeline ao vivo</h2>
          <p className="text-xs text-[#8b9bb4] mt-0.5">Preferência local deste navegador. Não altera o servidor.</p>
        </div>
        <button
          type="button"
          onClick={onToggleFollowDefault}
          className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-xs text-[#e6edf3]"
        >
          {followDefault ? 'seguindo' : 'pausado'}
        </button>
      </section>

      <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 text-xs text-[#8b9bb4] space-y-1">
        <p>Indisponível neste backend (estado vazio, sem dados de exemplo):</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>cadastro de outros usuários neste painel</li>
          <li>emissão de token Bearer</li>
          <li>trilha de auditoria (var/dashboard/audit.jsonl ainda não existe)</li>
          <li>acknowledgement de alertas no servidor</li>
        </ul>
      </section>
    </div>
  );
};
