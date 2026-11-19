import React, { useState } from 'react';
import { adminApi } from '../../api/admin';
import {
  AdminApiError,
  confirmationMatches,
  confirmationPhrase,
  cryptoLiveStamp,
  formatAdminError,
  livePrerequisites,
} from '../../api/adminProtocol';
import { BinanceStatus, RiskPayload } from '../../api/adminTypes';
import { StatusBadge } from '../ui/Primitives';
import { AdminWrite, Field, Note, ServerError, adminInputClass, simNao } from './adminUi';

export function LivePanel({
  binance,
  risk,
  busy,
  onWrite,
  onChanged,
}: {
  binance: BinanceStatus | null;
  risk: RiskPayload | null;
  busy: boolean;
  onWrite: AdminWrite;
  onChanged: () => Promise<void>;
}) {
  const [enablePhrase, setEnablePhrase] = useState('');
  const [disablePhrase, setDisablePhrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const checks = livePrerequisites(binance, risk);
  const ready = checks.every((item) => item.ok);
  const stamp = cryptoLiveStamp(binance);
  const stampColor =
    stamp === 'LIVE' ? 'text-[#f85149]' : stamp === 'PAPER' ? 'text-[#58a6ff]' : 'text-[#d29922]';

  const submit = (enabled: boolean) => {
    const phrase = enabled ? enablePhrase : disablePhrase;
    if (!confirmationMatches(enabled, phrase)) {
      setError(`A frase precisa ser exatamente ${confirmationPhrase(enabled)}.`);
      return;
    }
    if (enabled && !ready) {
      setError('Ainda falta item da lista. O live não foi pedido.');
      return;
    }
    setError(null);
    onWrite(
      enabled
        ? 'Ligar o flag de live da cripto. A unit do agente não é iniciada.'
        : 'Desligar o flag de live da cripto.',
      async (totp) => {
        try {
          const result = await adminApi.setCryptoLive(enabled, phrase, totp);
          if (enabled) setEnablePhrase('');
          else setDisablePhrase('');
          const unit = result.unit_started
            ? 'O servidor informou unit_started=true.'
            : 'unit_started=false. A unit não foi iniciada.';
          setNotice([result.note, unit].filter(Boolean).join(' '));
          await onChanged();
        } catch (err) {
          if (err instanceof AdminApiError && (err.code === 'totp' || err.unauthenticated)) throw err;
          setError(formatAdminError(err));
          await onChanged();
        }
      },
      { method: 'POST', path: '/api/v2/admin/crypto/live' }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-[#30363d] bg-[#161b22] p-4">
        <div>
          <div className="text-xs text-[#8b9bb4]">Estado da cripto</div>
          <div className={`mt-1 font-mono text-5xl font-semibold leading-none ${stampColor}`}>{stamp}</div>
        </div>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between gap-6">
            <dt className="text-[#8b9bb4]">live_enabled no yaml</dt>
            <dd className="font-mono text-[#e6edf3]">{simNao(binance?.live_enabled_yaml)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-[#8b9bb4]">flag admin</dt>
            <dd className="font-mono text-[#e6edf3]">{simNao(binance?.admin_live_enabled)}</dd>
          </div>
        </dl>
      </div>

      <Note tone="warn">
        Ligar o live grava o flag. A unit do agente cripto não é iniciada por este painel. A partida
        da unit continua um passo operacional à parte, depois de revisar o painel.
      </Note>

      {stamp === 'DIVERGENTE' && (
        <Note tone="warn">
          O yaml e o flag admin não concordam. O carimbo fica divergente até os dois voltarem a
          coincidir.
        </Note>
      )}

      <ul className="space-y-2">
        {checks.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-xs text-[#e6edf3]">
            <StatusBadge variant={item.ok ? 'ok' : 'warn'} label={item.ok ? 'ok' : 'falta'} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <form
        className="space-y-3 rounded-xl border border-[#30363d] bg-[#1c2330] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit(true);
        }}
      >
        <Field
          label="Ligar live"
          hint={`Digite exatamente ${confirmationPhrase(true)}, em maiúsculas, sem espaço extra.`}
        >
          <input
            value={enablePhrase}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            disabled={!ready || busy}
            onChange={(event) => setEnablePhrase(event.target.value)}
            className={adminInputClass}
            aria-label="Frase para ligar o live da cripto"
          />
        </Field>
        {!ready && (
          <p className="text-[11px] text-[#d29922]">
            O botão fica desligado até a lista acima estar completa.
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !ready || !confirmationMatches(true, enablePhrase)}
          className="rounded-lg bg-[#f85149] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          Ligar live da cripto
        </button>
      </form>

      <form
        className="space-y-3 rounded-xl border border-[#30363d] bg-[#1c2330] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit(false);
        }}
      >
        <Field
          label="Desligar live"
          hint={`Digite exatamente ${confirmationPhrase(false)}, em maiúsculas, sem espaço extra.`}
        >
          <input
            value={disablePhrase}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            disabled={busy}
            onChange={(event) => setDisablePhrase(event.target.value)}
            className={adminInputClass}
            aria-label="Frase para desligar o live da cripto"
          />
        </Field>
        <button
          type="submit"
          disabled={busy || !confirmationMatches(false, disablePhrase)}
          className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-xs font-semibold text-[#e6edf3] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Desligar live da cripto
        </button>
      </form>

      {notice ? <Note tone="info">{notice}</Note> : null}
      <ServerError error={error} />
    </div>
  );
}
