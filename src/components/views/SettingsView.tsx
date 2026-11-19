import React, { useState } from 'react';
import { Copy, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { triadeApi } from '../../api/triade';
import { ApiTokenRecord, UserOperator, UserRole } from '../../types/triade';
import { formatBrasiliaTime } from '../../utils/format';
import { StatusBadge } from '../ui/Primitives';

export const SettingsView: React.FC<{
  role: UserRole;
  operatorName: string;
  tunnelEnv: string;
  followDefault: boolean;
  telegramEnabled: boolean;
  onChangeRole: (role: UserRole, name: string) => void;
  onChangeTunnelEnv: (env: string) => void;
  onToggleFollowDefault: () => void;
  onToggleTelegram: () => void;
  onLockSession: () => void;
  onVpsConnected: () => void;
}> = ({
  role,
  operatorName,
  tunnelEnv,
  followDefault,
  telegramEnabled,
  onChangeRole,
  onChangeTunnelEnv,
  onToggleFollowDefault,
  onToggleTelegram,
  onLockSession,
  onVpsConnected,
}) => {
  const [users] = useState<UserOperator[]>(() => triadeApi.getUsers());
  const [tokens, setTokens] = useState<ApiTokenRecord[]>(() => triadeApi.getTokens());
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [newTokenRole, setNewTokenRole] = useState<UserRole>('service');
  const [issuedOnce, setIssuedOnce] = useState<string | null>(null);

  const currentCfg = triadeApi.getConfig();
  const [apiBaseInput, setApiBaseInput] = useState(currentCfg.apiBase || '');
  const [apiTokenInput, setApiTokenInput] = useState('');
  const [connFeedback, setConnFeedback] = useState<string | null>(null);

  const handleIssueToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenLabel.trim() || role !== 'owner') return;
    const { record, plaintextOnce } = triadeApi.issueToken(newTokenLabel.trim(), newTokenRole);
    setTokens((prev) => [record, ...prev]);
    setIssuedOnce(plaintextOnce);
    setNewTokenLabel('');
  };

  const handleRevoke = (id: string) => {
    if (role !== 'owner') return;
    setTokens(triadeApi.revokeToken(id));
  };

  const handleConnectVps = (e: React.FormEvent) => {
    e.preventDefault();
    triadeApi.setConnection(apiBaseInput, apiTokenInput);
    setApiTokenInput('');
    setConnFeedback(
      apiBaseInput.trim()
        ? `Apontando para ${apiBaseInput.trim()} via Bearer token.`
        : 'Retornado ao modo preview local da especificação.'
    );
    onVpsConnected();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">
            Configurações e usuários
          </h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Operadores, papéis, tokens de serviço, 2FA (TOTP) e conexão com o túnel do VPS
          </p>
        </div>

        <button
          type="button"
          onClick={onLockSession}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs font-medium text-[#e6edf3] hover:bg-[#1c2330]"
        >
          <Lock className="h-3.5 w-3.5" /> Testar tela de bloqueio / login
        </button>
      </div>

      {/* VPS Tunnel Integration */}
      <section className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#e6edf3]">
              Conexão com a API do VPS (túnel SSH / Tailscale)
            </h2>
            <p className="text-xs text-[#8b9bb4]">
              O painel no VPS escuta apenas em 127.0.0.1:8765. Deixe vazio para usar os dados
              ilustrativos da especificação v1.0.
            </p>
          </div>
          <StatusBadge
            variant={triadeApi.isUsingRemoteVps() ? 'ok' : 'info'}
            label={triadeApi.isUsingRemoteVps() ? 'VPS remoto configurado' : 'Modo preview local'}
          />
        </div>

        <pre className="rounded-lg border border-[#30363d] bg-[#0b0f14] p-3 font-mono text-[11px] text-[#8b9bb4] overflow-x-auto">
          ssh -L 8765:127.0.0.1:8765 -L 5971:127.0.0.1:5971 -L 5972:127.0.0.1:5972 user@&lt;vps&gt;
        </pre>

        <form onSubmit={handleConnectVps} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">
              VITE_TRIADE_API_BASE
            </label>
            <input
              type="text"
              value={apiBaseInput}
              onChange={(e) => setApiBaseInput(e.target.value)}
              placeholder="http://127.0.0.1:8765 (ou vazio para preview)"
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-xs font-mono text-[#e6edf3]"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">
              Bearer Token (somente em memória)
            </label>
            <input
              type="password"
              value={apiTokenInput}
              onChange={(e) => setApiTokenInput(e.target.value)}
              placeholder="Nunca persistido em localStorage nem git"
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-xs font-mono text-[#e6edf3]"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#7aa2f7] px-4 py-1.5 text-xs font-semibold text-[#0d1117] hover:opacity-90 h-[34px]"
          >
            Aplicar conexão
          </button>
        </form>
        {connFeedback && <p className="text-xs text-[#3fb950]">{connFeedback}</p>}
      </section>

      {/* Operators & Roles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#e6edf3]">Operadores e papéis</h2>
            <span className="text-xs font-mono text-[#8b9bb4]">
              atual: {operatorName} ({role})
            </span>
          </div>
          <div className="divide-y divide-[#30363d]">
            {users.map((u) => (
              <div key={u.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-semibold text-[#e6edf3]">{u.name}</div>
                  <div className="text-[#8b9bb4] font-mono text-[11px]">
                    {u.email} · papel: {u.role} · TOTP: {u.totp_enabled ? 'ativo' : 'não'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeRole(u.role, u.name)}
                  disabled={role === u.role}
                  className="rounded border border-[#30363d] bg-[#21262d] px-2.5 py-1 text-[11px] font-medium text-[#e6edf3] disabled:opacity-45"
                >
                  {role === u.role ? 'Ativo' : `Simular ${u.role}`}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* API Tokens */}
        <section className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#7aa2f7]" />
            <h2 className="text-base font-semibold text-[#e6edf3]">Tokens de API</h2>
          </div>

          <form onSubmit={handleIssueToken} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newTokenLabel}
              onChange={(e) => setNewTokenLabel(e.target.value)}
              placeholder="Rótulo do token (ex.: Script leitura)"
              disabled={role !== 'owner'}
              className="flex-1 min-w-[160px] rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-xs text-[#e6edf3]"
            />
            <select
              value={newTokenRole}
              onChange={(e) => setNewTokenRole(e.target.value as UserRole)}
              disabled={role !== 'owner'}
              className="rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3]"
            >
              <option value="service">service</option>
              <option value="auditor">auditor</option>
              <option value="owner">owner</option>
            </select>
            <button
              type="submit"
              disabled={role !== 'owner' || !newTokenLabel.trim()}
              className="rounded-lg bg-[#7aa2f7] px-3 py-1.5 text-xs font-semibold text-[#0d1117] disabled:opacity-45"
            >
              Emitir token
            </button>
          </form>

          {issuedOnce && (
            <div className="rounded-lg border border-[#3fb950]/50 bg-[#3fb950]/10 p-3 text-xs space-y-1">
              <div className="font-semibold text-[#3fb950]">
                Token exibido apenas uma vez — copie agora:
              </div>
              <div className="flex items-center justify-between gap-2 font-mono text-[#e6edf3]">
                <span className="break-all">{issuedOnce}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(issuedOnce)}
                  className="rounded border border-[#30363d] bg-[#0d1117] p-1 text-[#e6edf3]"
                  aria-label="Copiar token"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-[#30363d] text-xs">
            {tokens.map((t) => (
              <div key={t.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-[#e6edf3]">
                    {t.label} <span className="font-mono text-[#8b9bb4]">({t.prefix})</span>
                  </div>
                  <div className="text-[11px] font-mono text-[#8b9bb4]">
                    papel: {t.role} · criado: {formatBrasiliaTime(t.created_at, true)}
                  </div>
                </div>
                {t.revoked ? (
                  <StatusBadge variant="neutral" label="revogado" />
                ) : (
                  <button
                    type="button"
                    disabled={role !== 'owner'}
                    onClick={() => handleRevoke(t.id)}
                    className="rounded border border-[#f85149]/40 px-2.5 py-1 text-[11px] text-[#f85149] hover:bg-[#f85149]/10 disabled:opacity-45"
                  >
                    Revogar
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Preferences & Integrations & About */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-3 text-xs">
          <h2 className="text-base font-semibold text-[#e6edf3]">Preferências e integrações</h2>
          <div className="flex items-center justify-between py-1">
            <span className="text-[#8b9bb4]">Fuso horário de exibição</span>
            <span className="font-mono text-[#e6edf3]">America/Sao_Paulo (horário de Brasília)</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[#8b9bb4]">Ambiente de acesso exibido no chrome</span>
            <select
              value={tunnelEnv}
              onChange={(e) => onChangeTunnelEnv(e.target.value)}
              className="rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1 text-xs font-mono text-[#e6edf3]"
            >
              <option value="local · 127.0.0.1:8765">local · 127.0.0.1:8765</option>
              <option value="túnel SSH · 127.0.0.1:8765">túnel SSH · 127.0.0.1:8765</option>
              <option value="Tailscale (tailnet privada)">Tailscale (tailnet privada)</option>
            </select>
          </div>
          <label className="flex items-center justify-between py-1 cursor-pointer">
            <span className="text-[#8b9bb4]">Seguir timeline automaticamente</span>
            <input
              type="checkbox"
              checked={followDefault}
              onChange={onToggleFollowDefault}
              className="accent-[#7aa2f7]"
            />
          </label>
          <div className="flex items-center justify-between py-1 border-t border-[#30363d] pt-3">
            <div>
              <div className="text-[#e6edf3] font-medium">TelegramNotifier (v2)</div>
              <div className="text-[11px] text-[#8b9bb4]">
                TELEGRAM_BOT_TOKEN e CHAT_ID permanecem apenas no .env do VPS
              </div>
            </div>
            <button
              type="button"
              disabled={role !== 'owner'}
              onClick={onToggleTelegram}
              className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-1 text-xs font-medium text-[#e6edf3] disabled:opacity-45"
            >
              {telegramEnabled ? 'Ligado (desligar)' : 'Desligado (ligar)'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 space-y-2 text-xs text-[#8b9bb4]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#e6edf3]">
            <ShieldCheck className="h-4 w-4 text-[#3fb950]" />
            Sobre o Super Painel TRIADE
          </div>
          <p>
            Especificação v1.0 · evoluído sobre o rascunho somente leitura de{' '}
            <code className="text-[#e6edf3]">127.0.0.1:8765</code> (<code className="text-[#e6edf3]">frontend/server.py</code>).
          </p>
          <p>
            2FA (TOTP) obrigatório em comandos <code className="text-[#e6edf3]">flatten</code>,{' '}
            <code className="text-[#e6edf3]">kill</code>, <code className="text-[#e6edf3]">kill-clear</code>,{' '}
            <code className="text-[#e6edf3]">reset-halt</code> e <code className="text-[#e6edf3]">unit stop</code> quando{' '}
            <code className="text-[#e6edf3]">live_enabled: true</code>. No modo preview local, qualquer código numérico de 6 dígitos (ex.: <code className="text-[#e6edf3]">123456</code>) valida o fluxo 2FA.
          </p>
        </section>
      </div>
    </div>
  );
};
