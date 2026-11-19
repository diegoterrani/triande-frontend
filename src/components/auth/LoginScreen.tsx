import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { login } from '../../api/auth';
import { ApiError } from '../../api/http';
import {
  isCredentialFailure,
  LOCKOUT_WARNING,
  LOGIN_FAILED_MESSAGE,
  showLockoutWarning,
} from '../../api/sessionStore';
import { Note, ServerError, adminInputClass } from '../admin/adminUi';

export function SessionGate({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d1117] p-4 text-[#e6edf3]">
      <p className="text-sm text-[#8b9bb4]">{label}</p>
    </div>
  );
}

export function LoginScreen({ bootError }: { bootError: string | null }) {
  const [username, setUsername] = useState('diego');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [busy, setBusy] = useState(false);
  const codeReady = /^\d{6}$/.test(totp);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !codeReady || username.trim() === '' || password === '') return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password, totp);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const code = err instanceof ApiError ? err.code : null;
      if (isCredentialFailure(status, code)) {
        setTotp('');
        setFailures((count) => count + 1);
        setError(LOGIN_FAILED_MESSAGE);
      } else {
        setError(err instanceof Error && err.message ? err.message : 'Não foi possível entrar.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d1117] p-4 text-[#e6edf3]">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22] shadow-2xl">
        <div className="h-1 bg-[#f85149]" />
        <form onSubmit={(event) => void submit(event)} className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-[#30363d] bg-[#1c2330] p-2.5 text-[#7aa2f7]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#e6edf3]">TRIADE</h1>
              <p className="mt-1 text-xs leading-relaxed text-[#8b9bb4]">
                Entre com o usuário, a senha e o código 2FA. A B3 opera em conta real.
              </p>
            </div>
          </div>

          {bootError ? <Note tone="warn">{bootError}</Note> : null}

          <label className="block text-xs text-[#8b9bb4]" htmlFor="login-user">
            <span className="font-medium text-[#e6edf3]">Usuário</span>
            <input
              id="login-user"
              name="username"
              autoFocus
              autoComplete="username"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={`${adminInputClass} mt-1.5`}
            />
          </label>

          <label className="block text-xs text-[#8b9bb4]" htmlFor="login-password">
            <span className="font-medium text-[#e6edf3]">Senha</span>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${adminInputClass} mt-1.5`}
            />
          </label>

          <label className="block text-xs text-[#8b9bb4]" htmlFor="login-totp">
            <span className="font-medium text-[#e6edf3]">Código 2FA</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-[#8b9bb4]">
              6 dígitos. Uma senha errada não gasta o código. Se o código falhar, espere o próximo.
            </span>
            <input
              id="login-totp"
              name="totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              spellCheck={false}
              pattern="[0-9]*"
              maxLength={6}
              value={totp}
              onChange={(event) => setTotp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${adminInputClass} mt-1.5`}
            />
          </label>

          {showLockoutWarning(failures) ? <Note tone="warn">{LOCKOUT_WARNING}</Note> : null}
          <ServerError error={error} />

          <button
            type="submit"
            disabled={busy || username.trim() === '' || password === '' || !codeReady}
            className="w-full rounded-lg bg-[#7aa2f7] px-4 py-2.5 text-xs font-semibold text-[#0d1117] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="border-t border-[#30363d] pt-3 text-[11px] leading-relaxed text-[#8b9bb4]">
            A senha e o código não são gravados neste navegador. O cookie da sessão é HttpOnly.
          </p>
        </form>
      </div>
    </div>
  );
}
