import React, { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../../api/admin';
import { AdminApiError, formatAdminError } from '../../api/adminProtocol';
import { AdminAuditPayload, AdminSession, BinanceStatus, RiskPayload } from '../../api/adminTypes';
import { AuditPanel } from './AuditPanel';
import { BinancePanel } from './BinancePanel';
import { EmergencyPanel } from './EmergencyPanel';
import { LivePanel } from './LivePanel';
import { RiskPanel } from './RiskPanel';
import { Field, Note, ServerError, TotpDialog, adminInputClass, formatAdminWhen } from './adminUi';

type SectionId = 'session' | 'binance' | 'risk' | 'live' | 'emergency' | 'audit';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'session', label: 'Sessão' },
  { id: 'binance', label: 'Binance' },
  { id: 'risk', label: 'Limites' },
  { id: 'live', label: 'Live cripto' },
  { id: 'emergency', label: 'Emergência' },
  { id: 'audit', label: 'Auditoria' },
];

export function AdminModal({
  stub,
  onClose,
  onUser,
}: {
  stub: boolean;
  onClose: () => void;
  onUser: (user: string | null) => void;
}) {
  const [phase, setPhase] = useState<'checking' | 'login' | 'console'>('checking');
  const [section, setSection] = useState<SectionId>('session');
  const [session, setSession] = useState<AdminSession | null>(null);
  const [binance, setBinance] = useState<BinanceStatus | null>(null);
  const [risk, setRisk] = useState<RiskPayload | null>(null);
  const [audit, setAudit] = useState<AdminAuditPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [username, setUsername] = useState('diego');
  const [password, setPassword] = useState('');
  const [loginTotp, setLoginTotp] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [writeBusy, setWriteBusy] = useState(false);
  const [totpGate, setTotpGate] = useState<null | {
    purpose: string;
    error: string | null;
    work: (code: string) => Promise<void>;
  }>(null);
  const onUserRef = useRef(onUser);
  onUserRef.current = onUser;

  const dropSession = useCallback((message: string | null) => {
    adminApi.clearMemory();
    setSession(null);
    setPhase('login');
    setLoginError(message);
    setTotpGate(null);
    onUserRef.current(null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextBinance, nextRisk, nextAudit] = await Promise.all([
        adminApi.getBinance(),
        adminApi.getRisk(),
        adminApi.getAudit(),
      ]);
      setBinance(nextBinance);
      setRisk(nextRisk);
      setAudit(nextAudit);
      setLoadError(null);
    } catch (err) {
      if (err instanceof AdminApiError && err.unauthenticated) {
        dropSession('A sessão expirou. Entre de novo com um código 2FA novo.');
        return;
      }
      setLoadError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, [dropSession]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hadSession = adminApi.csrfReady;
    adminApi
      .getSession()
      .then((next) => {
        if (cancelled) return;
        setSession(next);
        setPhase('console');
        onUserRef.current(next.user);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof AdminApiError && err.unauthenticated) {
          dropSession(
            hadSession ? 'A sessão expirou. Entre de novo com um código 2FA novo.' : null
          );
          return;
        }
        setPhase('login');
        setLoginError(formatAdminError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [dropSession]);

  useEffect(() => {
    if (phase !== 'console') return;
    void refresh();
  }, [phase, refresh]);

  useEffect(() => {
    if (phase !== 'console') return;
    const id = window.setInterval(() => {
      if (adminApi.isExpired()) {
        dropSession('A sessão expirou. Entre de novo com um código 2FA novo.');
        return;
      }
      adminApi
        .getSession()
        .then((next) => {
          setSession(next);
          onUserRef.current(next.user);
        })
        .catch((err: unknown) => {
          if (err instanceof AdminApiError && err.unauthenticated) {
            dropSession('A sessão expirou. Entre de novo com um código 2FA novo.');
          }
        });
    }, 30000);
    const clock = window.setInterval(() => {
      if (adminApi.isExpired()) {
        dropSession('A sessão expirou. Entre de novo com um código 2FA novo.');
      }
    }, 1000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(clock);
    };
  }, [phase, dropSession]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (totpGate) {
        setTotpGate(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, totpGate]);

  const requestWrite = useCallback(
    (purpose: string, work: (code: string) => Promise<void>) => {
      if (adminApi.isExpired()) {
        dropSession('A sessão expirou. Entre de novo com um código 2FA novo.');
        return;
      }
      setTotpGate({ purpose, error: null, work });
    },
    [dropSession]
  );

  const submitTotp = async (code: string) => {
    if (!totpGate) return;
    setWriteBusy(true);
    try {
      await totpGate.work(code);
      setTotpGate(null);
    } catch (err) {
      if (err instanceof AdminApiError && err.unauthenticated) {
        dropSession('A sessão expirou. Entre de novo com um código 2FA novo.');
        return;
      }
      if (err instanceof AdminApiError && err.code === 'totp') {
        setTotpGate((prev) => (prev ? { ...prev, error: formatAdminError(err) } : prev));
        return;
      }
      setTotpGate(null);
    } finally {
      setWriteBusy(false);
    }
  };

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loginBusy) return;
    setLoginBusy(true);
    setLoginError(null);
    try {
      const loggedIn = await adminApi.login(username.trim(), password, loginTotp.trim());
      let next = loggedIn;
      try {
        next = await adminApi.getSession();
      } catch {
        next = loggedIn;
      }
      setPassword('');
      setLoginTotp('');
      setSession(next);
      setPhase('console');
      onUserRef.current(next.user);
    } catch (err) {
      setLoginTotp('');
      setLoginError(formatAdminError(err));
    } finally {
      setLoginBusy(false);
    }
  };

  const logout = () => {
    requestWrite('Encerrar a sessão administrativa.', async (totp) => {
      try {
        await adminApi.logout(totp);
        setPassword('');
        setLoginTotp('');
        dropSession(null);
      } catch (err) {
        if (err instanceof AdminApiError && (err.code === 'totp' || err.unauthenticated)) throw err;
        setLoadError(formatAdminError(err));
      }
    });
  };

  const expiresLabel = session
    ? `${formatAdminWhen(session.expires_at)} · ${remaining(session.expires_at, Date.now())}`
    : '—';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
        className="flex h-[min(920px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#30363d] px-4 py-3">
          <div>
            <h2 id="admin-title" className="text-lg font-semibold text-[#e6edf3]">
              Administração
            </h2>
            <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-[#8b9bb4]">
              Sessão da aplicação, separada do login do navegador. Cada escrita pede um código 2FA
              que ainda não foi usado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stub && (
              <span className="rounded bg-[#d29922]/20 px-2 py-1 text-[11px] font-semibold text-[#d29922]">
                STUB LOCAL
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#30363d] px-3 py-1.5 text-xs text-[#e6edf3]"
            >
              Fechar
            </button>
          </div>
        </header>

        {phase === 'checking' && (
          <p className="px-4 py-6 text-xs text-[#8b9bb4]">Consultando a sessão…</p>
        )}

        {phase === 'login' && (
          <form onSubmit={submitLogin} autoComplete="off" className="mx-auto w-full max-w-md space-y-3 overflow-y-auto px-4 py-6">
            <Note tone="info">
              O navegador já passou pelo basic auth do nginx. Aqui é a sessão da aplicação: usuário,
              senha e o código de 6 dígitos. O código do login não serve para a próxima ação.
            </Note>
            <Field label="Usuário">
              <input
                autoFocus
                value={username}
                autoComplete="username"
                spellCheck={false}
                onChange={(event) => setUsername(event.target.value)}
                className={adminInputClass}
              />
            </Field>
            <Field label="Senha">
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={adminInputClass}
              />
            </Field>
            <Field
              label="Código 2FA"
              hint="6 dígitos. Se falhar, espere a próxima janela de 30 segundos. Não tente em sequência: o login é limitado."
            >
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={6}
                value={loginTotp}
                onChange={(event) => setLoginTotp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className={adminInputClass}
              />
            </Field>
            <ServerError error={loginError} />
            <button
              type="submit"
              disabled={loginBusy || username.trim() === '' || password === '' || !/^\d{6}$/.test(loginTotp)}
              className="rounded-lg bg-[#7aa2f7] px-3 py-2 text-xs font-semibold text-[#0d1117] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loginBusy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        )}

        {phase === 'console' && (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <nav aria-label="Seções da administração" className="flex gap-1 overflow-x-auto border-b border-[#30363d] p-2 md:w-44 md:flex-col md:border-b-0 md:border-r">
              {SECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={section === item.id ? 'page' : undefined}
                  onClick={() => setSection(item.id)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs font-medium ${
                    section === item.id
                      ? 'bg-[#1c2330] text-[#e6edf3]'
                      : 'text-[#8b9bb4] hover:text-[#e6edf3]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loadError ? <div className="mb-3"><ServerError error={loadError} /></div> : null}
              {loading && !binance ? (
                <p className="text-xs text-[#8b9bb4]">Carregando dados administrativos…</p>
              ) : null}
              {section === 'session' && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-[#e6edf3]">Sessão</h3>
                  <dl className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <dt className="text-[#8b9bb4]">Usuário</dt>
                      <dd className="mt-1 font-mono text-[#e6edf3]">{session?.user ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[#8b9bb4]">Início</dt>
                      <dd className="mt-1 font-mono text-[#e6edf3]">{formatAdminWhen(session?.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-[#8b9bb4]">Expira</dt>
                      <dd className="mt-1 font-mono text-[#e6edf3]">{expiresLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[#8b9bb4]">CSRF</dt>
                      <dd className="mt-1 text-[#e6edf3]">
                        {adminApi.csrfReady
                          ? 'na memória deste separador, oculto'
                          : 'ausente'}
                      </dd>
                    </div>
                  </dl>
                  <Note tone="info">
                    O cookie triade_admin_session é HttpOnly. Esta página não lê o cookie e não grava
                    senha, chave ou código no armazenamento do navegador.
                  </Note>
                  <button
                    type="button"
                    onClick={logout}
                    disabled={writeBusy}
                    className="rounded-lg border border-[#30363d] px-3 py-2 text-xs font-semibold text-[#e6edf3] disabled:opacity-45"
                  >
                    Sair
                  </button>
                </div>
              )}
              {section === 'binance' && (
                <BinancePanel status={binance} busy={writeBusy} onWrite={requestWrite} onChanged={refresh} />
              )}
              {section === 'risk' && risk && (
                <RiskPanel
                  key={risk.limits?.updated_at ?? 'unset'}
                  risk={risk}
                  busy={writeBusy}
                  onWrite={requestWrite}
                  onChanged={refresh}
                />
              )}
              {section === 'live' && (
                <LivePanel
                  binance={binance}
                  risk={risk}
                  busy={writeBusy}
                  onWrite={requestWrite}
                  onChanged={refresh}
                />
              )}
              {section === 'emergency' && (
                <EmergencyPanel busy={writeBusy} onWrite={requestWrite} onChanged={refresh} />
              )}
              {section === 'audit' && <AuditPanel audit={audit} onRefresh={refresh} />}
            </div>
          </div>
        )}
      </div>
      {totpGate && (
        <TotpDialog
          purpose={totpGate.purpose}
          error={totpGate.error}
          busy={writeBusy}
          onCancel={() => setTotpGate(null)}
          onConfirm={(code) => void submitTotp(code)}
        />
      )}
    </div>
  );
}

function remaining(expiresAt: number, now: number): string {
  const ms = expiresAt * 1000 - now;
  if (ms <= 0) return 'expirada';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return `faltam ${hours}h ${minutes % 60}min`;
}
