import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import { restoreSession } from '../../api/auth';
import { AdminApiError, formatAdminError } from '../../api/adminProtocol';
import { AdminAuditPayload, BinanceStatus, RiskPayload } from '../../api/adminTypes';
import { actionNeedsStepUp, AuthSession, isSessionExpired } from '../../api/sessionStore';
import { AuditPanel } from './AuditPanel';
import { BinancePanel } from './BinancePanel';
import { EmergencyPanel } from './EmergencyPanel';
import { LivePanel } from './LivePanel';
import { RiskPanel } from './RiskPanel';
import { AdminWrite, Field, Note, ServerError, StepUpAction, TotpDialog, formatAdminWhen } from './adminUi';

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
  session,
  onClose,
}: {
  stub: boolean;
  session: AuthSession;
  onClose: () => void;
}) {
  const [section, setSection] = useState<SectionId>('session');
  const [binance, setBinance] = useState<BinanceStatus | null>(null);
  const [risk, setRisk] = useState<RiskPayload | null>(null);
  const [audit, setAudit] = useState<AdminAuditPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [writeBusy, setWriteBusy] = useState(false);
  const [totpGate, setTotpGate] = useState<null | {
    purpose: string;
    error: string | null;
    work: (code: string) => Promise<void>;
  }>(null);

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
      if (err instanceof AdminApiError && err.unauthenticated) return;
      setLoadError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void restoreSession()
      .then((next) => {
        if (cancelled || !next) return;
        return refresh();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof AdminApiError && err.unauthenticated) return;
        setLoadError(formatAdminError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

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

  const runWrite = useCallback(async (work: (code: string) => Promise<void>, code: string) => {
    setWriteBusy(true);
    try {
      await work(code);
    } finally {
      setWriteBusy(false);
    }
  }, []);

  const requestWrite = useCallback<AdminWrite>(
    (purpose, work, action: StepUpAction) => {
      const active = session;
      if (isSessionExpired(active)) {
        void restoreSession();
        return;
      }
      const needsCode = actionNeedsStepUp(action.method, action.path, active.stepupRequiredFor);
      if (!needsCode) {
        void runWrite(work, '').catch((err: unknown) => {
          if (err instanceof AdminApiError && err.code === 'totp') {
            setTotpGate({ purpose, error: formatAdminError(err), work });
            return;
          }
          if (err instanceof AdminApiError && err.unauthenticated) return;
          setLoadError(formatAdminError(err));
        });
        return;
      }
      setTotpGate({ purpose, error: null, work });
    },
    [runWrite, session]
  );

  const submitTotp = async (code: string) => {
    if (!totpGate) return;
    try {
      await runWrite(totpGate.work, code);
      setTotpGate(null);
    } catch (err) {
      if (err instanceof AdminApiError && err.unauthenticated) return;
      if (err instanceof AdminApiError && err.code === 'totp') {
        setTotpGate((prev) => (prev ? { ...prev, error: formatAdminError(err) } : prev));
        return;
      }
      if (err instanceof AdminApiError && err.code === 'csrf') {
        setTotpGate((prev) => (prev ? { ...prev, error: formatAdminError(err) } : prev));
        return;
      }
      setTotpGate(null);
    }
  };

  const expiresLabel = `${formatAdminWhen(session.expiresAtIso ?? session.expiresAt)} · ${remaining(session.expiresAt, Date.now())}`;

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
              Usa a sessão já aberta. Cada ação crítica pede um código 2FA que ainda não foi usado.
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
                <dl className="grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-[#8b9bb4]">Usuário</dt>
                    <dd className="mt-1 font-mono text-[#e6edf3]">{session.user || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[#8b9bb4]">Início</dt>
                    <dd className="mt-1 font-mono text-[#e6edf3]">{formatAdminWhen(session.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[#8b9bb4]">Expira</dt>
                    <dd className="mt-1 font-mono text-[#e6edf3]">{expiresLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[#8b9bb4]">CSRF</dt>
                    <dd className="mt-1 text-[#e6edf3]">
                      {adminApi.csrfReady ? 'na memória deste separador, oculto' : 'ausente'}
                    </dd>
                  </div>
                </dl>
                <Note tone="info">
                  O cookie triade_session é HttpOnly. Esta página não lê o cookie e não grava senha,
                  chave ou código no armazenamento do navegador. Sair fica no cabeçalho e não pede
                  código 2FA.
                </Note>
                {session.stepupRequiredFor && session.stepupRequiredFor.length > 0 ? (
                  <Field label="Ações que pedem Código 2FA">
                    <ul className="space-y-1 font-mono text-[11px] text-[#8b9bb4]">
                      {session.stepupRequiredFor.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </Field>
                ) : null}
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
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  if (days > 0) return `faltam ${days}d ${hours}h`;
  return `faltam ${hours}h ${minutes % 60}min`;
}
