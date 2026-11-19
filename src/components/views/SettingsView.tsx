import React, { useState } from 'react';
import { READONLY_CONTROL_NOTE } from '../../api/readonly';
import { triadeApi } from '../../api/triade';
import { AgentId, HealthResponse } from '../../types/triade';
import { AGENT_NAMES } from '../../utils/format';
import { StatusBadge } from '../ui/Primitives';

export const SettingsView: React.FC<{
  tunnelEnv: string;
  apiBaseLabel: string;
  followDefault: boolean;
  telegramFlags: Record<AgentId, boolean | null>;
  health: HealthResponse | null;
  onChangeTunnelEnv: (env: string) => void;
  onToggleFollowDefault: () => void;
  onApplyBase: (apiBase: string) => void;
}> = ({
  tunnelEnv,
  apiBaseLabel,
  followDefault,
  telegramFlags,
  health,
  onChangeTunnelEnv,
  onToggleFollowDefault,
  onApplyBase,
}) => {
  const current = triadeApi.getConfig();
  const [apiBaseInput, setApiBaseInput] = useState(current.apiBase);
  const [tokenInput, setTokenInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const next = apiBaseInput.trim();
    triadeApi.setConnection(next, tokenInput);
    setTokenInput('');
    onChangeTunnelEnv(next ? `túnel · ${next}` : 'mesma origem · /api/v2');
    onApplyBase(next);
    setFeedback(
      next
        ? `Base da API: ${next}. O token, se informado, fica só na memória deste separador.`
        : 'Base vazia: os pedidos vão para a mesma origem (/api/v2).'
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-[#e6edf3]">Conexão e preferências</h1>
        <p className="text-xs text-[#8b9bb4] mt-0.5">
          Este servidor não tem usuários, tokens persistidos nem auditoria de login. {READONLY_CONTROL_NOTE}
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
            <dd className="font-mono text-[#e6edf3] mt-0.5">{apiBaseLabel || 'mesma origem'}</dd>
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
              {String(health?.auth_required ?? false)}
            </dd>
          </div>
        </dl>
        <form onSubmit={apply} className="space-y-2">
          <label className="block text-xs text-[#8b9bb4]">
            VITE_API_BASE (vazio = mesma origem; túnel = http://127.0.0.1:8765)
            <input
              value={apiBaseInput}
              onChange={(e) => setApiBaseInput(e.target.value)}
              placeholder="http://127.0.0.1:8765"
              className="mt-1 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 font-mono text-xs text-[#e6edf3]"
            />
          </label>
          <label className="block text-xs text-[#8b9bb4]">
            Bearer opcional (não é exigido; não é gravado)
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              autoComplete="off"
              placeholder="deixe vazio"
              className="mt-1 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 font-mono text-xs text-[#e6edf3]"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs font-medium text-[#e6edf3]"
          >
            Aplicar base
          </button>
          {feedback && <p className="text-xs text-[#8b9bb4]">{feedback}</p>}
        </form>
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
          <li>usuários, papéis e 2FA</li>
          <li>emissão e revogação de tokens</li>
          <li>trilha de auditoria (var/dashboard/audit.jsonl ainda não existe)</li>
          <li>acknowledgement de alertas no servidor</li>
        </ul>
      </section>
    </div>
  );
};
