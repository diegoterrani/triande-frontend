import React, { useState } from 'react';
import { Lock, ShieldCheck, ShieldOff } from 'lucide-react';
import { UserRole } from '../../types/triade';
import { ErrorState } from '../ui/Primitives';

export const AuthLockView: React.FC<{
  isRemoteVps: boolean;
  initialApiBase: string;
  onUnlock: (params: {
    name: string;
    role: UserRole;
    token?: string;
    apiBase?: string;
  }) => void;
}> = ({ isRemoteVps, initialApiBase, onUnlock }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('owner');
  const [apiBase, setApiBase] = useState(initialApiBase || 'http://127.0.0.1:8765');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === 'anonymous') {
      setError(
        'Acesso negado (HTTP 401): Visitante anônimo não tem permissão para visualizar métricas financeiras ou controles do TRIADE.'
      );
      return;
    }
    if (isRemoteVps && !token.trim()) {
      setError('Token Bearer obrigatório para conectar ao VPS.');
      return;
    }
    setError(null);
    onUnlock({
      name:
        selectedRole === 'owner'
          ? 'Diego Terrani'
          : selectedRole === 'auditor'
            ? 'Auditoria Interna'
            : 'Serviço Leitura',
      role: selectedRole,
      token: token.trim() || undefined,
      apiBase: isRemoteVps ? apiBase.trim() : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden shadow-2xl">
        <div className="h-1 bg-[#f85149]" />
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-[#30363d] bg-[#1c2330] p-2.5 text-[#7aa2f7]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#e6edf3]">
                TRIADE — Autenticação Obrigatória
              </h1>
              <p className="mt-1 text-xs text-[#8b9bb4]">
                O agente B3 opera em conta REAL. Nenhuma métrica financeira ou controle é exposto
                sem sessão autenticada.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8b9bb4] mb-1.5">
                Perfil de acesso
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'owner' as UserRole, label: 'Diego (owner)', desc: 'Leitura + controles 2FA' },
                  { id: 'auditor' as UserRole, label: 'Auditor', desc: 'Somente leitura' },
                  { id: 'service' as UserRole, label: 'Service', desc: 'Token API leitura' },
                  { id: 'anonymous' as UserRole, label: 'Anônimo', desc: 'Testar bloqueio' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedRole(opt.id);
                      setError(null);
                    }}
                    className={`rounded-lg border p-2.5 text-left transition-colors ${
                      selectedRole === opt.id
                        ? 'border-[#7aa2f7] bg-[#1c2330]'
                        : 'border-[#30363d] bg-[#0d1117] hover:bg-[#1c2330]/60'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#e6edf3]">{opt.label}</div>
                    <div className="text-[11px] text-[#8b9bb4] mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {isRemoteVps && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8b9bb4] mb-1">
                    URL da API (Túnel SSH / Tailscale)
                  </label>
                  <input
                    type="url"
                    value={apiBase}
                    onChange={(e) => setApiBase(e.target.value)}
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs font-mono text-[#e6edf3]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8b9bb4] mb-1">
                    Bearer Token
                  </label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Cole o token emitido no VPS (nunca armazenado em código)"
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs font-mono text-[#e6edf3]"
                  />
                </div>
              </>
            )}

            {error && <ErrorState message={error} />}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#7aa2f7] px-4 py-2.5 text-xs font-semibold text-[#0d1117] hover:opacity-90 transition-opacity"
            >
              {selectedRole === 'anonymous' ? (
                <>
                  <ShieldOff className="h-4 w-4" />
                  Testar acesso anônimo
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Entrar como {selectedRole}
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-[#8b9bb4] border-t border-[#30363d] pt-3">
            Nunca utilize a senha da corretora (XP / IC Markets / Binance) como senha do painel.
          </p>
        </div>
      </div>
    </div>
  );
};
