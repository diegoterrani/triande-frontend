import React, { useEffect, useId, useState } from 'react';

export type AdminWrite = (purpose: string, work: (totp: string) => Promise<void>) => void;

export const adminInputClass =
  'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 font-mono text-xs text-[#e6edf3] placeholder:text-[#8b9bb4]';

export function Note({
  tone,
  children,
}: {
  tone: 'info' | 'warn' | 'bad';
  children: React.ReactNode;
}) {
  const styles = {
    info: 'border-[#58a6ff]/40 bg-[#58a6ff]/10 text-[#e6edf3]',
    warn: 'border-[#d29922]/50 bg-[#d29922]/10 text-[#d29922]',
    bad: 'border-[#f85149]/55 bg-[#f85149]/10 text-[#f85149]',
  };
  return (
    <div role={tone === 'bad' ? 'alert' : undefined} className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${styles[tone]}`}>
      {children}
    </div>
  );
}

export function ServerError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <pre
      role="alert"
      className="whitespace-pre-wrap rounded-lg border border-[#f85149]/55 bg-[#f85149]/10 px-3 py-2 font-mono text-[11px] leading-relaxed text-[#f85149]"
    >
      {error}
    </pre>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs text-[#8b9bb4]">
      <span className="font-medium text-[#e6edf3]">{label}</span>
      {hint ? <span className="mt-0.5 block text-[11px] leading-relaxed text-[#8b9bb4]">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
      {error ? <span className="mt-1 block text-[11px] text-[#f85149]">{error}</span> : null}
    </label>
  );
}

export function simNao(value: boolean | null | undefined): string {
  if (value === true) return 'sim';
  if (value === false) return 'não';
  return '—';
}

export function formatAdminWhen(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })} BRT`;
}

export function formatDrawdown(value: number): string {
  const pct = (value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return `${value} (${pct}%)`;
}

export function TotpDialog({
  purpose,
  error,
  busy,
  onCancel,
  onConfirm,
}: {
  purpose: string;
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  const titleId = useId();
  const hintId = useId();
  const ready = /^\d{6}$/.test(code) && !busy;

  useEffect(() => {
    if (error) setCode('');
  }, [error]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        className="w-full max-w-md space-y-3 rounded-xl border border-[#30363d] bg-[#161b22] p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onConfirm(code);
        }}
      >
        <h3 id={titleId} className="text-base font-semibold text-[#e6edf3]">
          Confirme com o código 2FA
        </h3>
        <p className="text-xs leading-relaxed text-[#e6edf3]">{purpose}</p>
        <p id={hintId} className="text-xs leading-relaxed text-[#8b9bb4]">
          Cada código é de uso único. O servidor recusa o mesmo passo de 30 segundos, inclusive o
          código que entrou no login. Espere o próximo código no aplicativo autenticador e digite
          esse valor novo.
        </p>
        <Field label="Código de 6 dígitos" error={code && !/^\d{6}$/.test(code) ? 'Use 6 dígitos.' : null}>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={6}
            value={code}
            aria-invalid={Boolean(error)}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className={adminInputClass}
          />
        </Field>
        <ServerError error={error} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#30363d] px-3 py-2 text-xs font-medium text-[#e6edf3]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!ready}
            className="rounded-lg bg-[#7aa2f7] px-3 py-2 text-xs font-semibold text-[#0d1117] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? 'Enviando…' : 'Confirmar ação'}
          </button>
        </div>
      </form>
    </div>
  );
}
