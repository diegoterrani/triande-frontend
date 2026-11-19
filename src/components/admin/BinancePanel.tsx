import React, { useState } from 'react';
import { adminApi } from '../../api/admin';
import { AdminApiError, formatAdminError, withdrawalsBlocked } from '../../api/adminProtocol';
import { BinanceStatus, BinanceTestResult, VPS_BINANCE_IP } from '../../api/adminTypes';
import { StatusBadge } from '../ui/Primitives';
import { AdminWrite, Field, Note, ServerError, adminInputClass, formatAdminWhen, simNao } from './adminUi';

function PermissionLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#30363d] py-1.5 text-xs last:border-b-0">
      <span className="text-[#8b9bb4]">{label}</span>
      <span className="font-mono text-[#e6edf3]">{value}</span>
    </div>
  );
}

export function BinancePanel({
  status,
  busy,
  onWrite,
  onChanged,
}: {
  status: BinanceStatus | null;
  busy: boolean;
  onWrite: AdminWrite;
  onChanged: () => Promise<void>;
}) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const test = status?.last_test ?? null;
  const blocked = withdrawalsBlocked(test);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const key = apiKey.trim();
    const secret = apiSecret.trim();
    if (!key || !secret) {
      setError('Informe a chave e o segredo. Nada foi enviado.');
      return;
    }
    setApiKey('');
    setApiSecret('');
    setError(null);
    setNotice('Os campos foram limpos. Se cancelar a confirmação, cole a chave e o segredo de novo.');
    onWrite('Gravar a chave e o segredo da Binance no cofre.', async (totp) => {
      try {
        const result = await adminApi.putBinance(key, secret, totp);
        setNotice(
          `Chave gravada (${result.api_key_masked ?? 'mascarada'}). O teste anterior deixou de valer. Rode o teste de novo antes de ligar o live.`
        );
        await onChanged();
      } catch (err) {
        if (err instanceof AdminApiError && (err.code === 'totp' || err.unauthenticated)) throw err;
        setNotice('A chave e o segredo foram apagados deste formulário. Cole de novo com um código 2FA novo.');
        setError(formatAdminError(err));
      }
    });
  };

  const runTest = () => {
    setError(null);
    onWrite('Testar as permissões da chave que está no cofre.', async (totp) => {
      try {
        await adminApi.testBinance(totp);
        setNotice('Teste concluído. O resultado abaixo veio do servidor.');
        await onChanged();
      } catch (err) {
        if (err instanceof AdminApiError && (err.code === 'totp' || err.unauthenticated)) throw err;
        setError(formatAdminError(err));
        await onChanged();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[#e6edf3]">Chave Binance</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#8b9bb4]">
          A API devolve só se a chave existe e os 4 últimos caracteres. A chave completa não aparece
          aqui e não fica no navegador.
        </p>
      </div>

      <Note tone="info">
        Na Binance, crie a chave só com permissão de trade (spot e futuros, se for operar futuros).
        Não habilite saque. Restrinja o IP a {VPS_BINANCE_IP}.
      </Note>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2">
          <div className="text-[11px] text-[#8b9bb4]">Configurada</div>
          <div className="mt-1 text-sm font-semibold text-[#e6edf3]">
            {status ? (status.configured ? 'sim' : 'não') : '—'}
          </div>
        </div>
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2">
          <div className="text-[11px] text-[#8b9bb4]">Últimos 4</div>
          <div className="mt-1 font-mono text-sm text-[#e6edf3]">{status?.api_key_masked ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2">
          <div className="text-[11px] text-[#8b9bb4]">Último teste</div>
          <div className="mt-1">
            {test ? (
              <StatusBadge variant={test.ok && !blocked ? 'ok' : 'bad'} label={test.ok ? 'ok' : 'falhou'} />
            ) : (
              <span className="text-sm text-[#8b9bb4]">ainda não</span>
            )}
          </div>
        </div>
      </div>

      {blocked && (
        <Note tone="bad">
          Saques estão habilitados nesta chave. O servidor recusa o teste (fail-closed) e o live
          permanece bloqueado. Crie outra chave sem permissão de saque.
          {test?.error ? ` ${test.error}` : ''}
        </Note>
      )}

      {(status?.ip_restriction_note || test?.ip_restriction_note) && (
        <Note tone={test?.ip_restrict === false ? 'warn' : 'info'}>
          {test?.ip_restriction_note || status?.ip_restriction_note}
        </Note>
      )}

      {test && <TestDetails result={test} />}

      <form onSubmit={save} autoComplete="off" className="space-y-3 rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
        <Field label="API key" hint="Campo mascarado. É apagado da memória do formulário ao enviar.">
          <input
            type="password"
            name="binance-api-key"
            autoComplete="new-password"
            spellCheck={false}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className={adminInputClass}
          />
        </Field>
        <Field label="API secret" hint="Não é gravado em localStorage nem reexibido depois.">
          <input
            type="password"
            name="binance-api-secret"
            autoComplete="new-password"
            spellCheck={false}
            value={apiSecret}
            onChange={(event) => setApiSecret(event.target.value)}
            className={adminInputClass}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[#7aa2f7] px-3 py-2 text-xs font-semibold text-[#0d1117] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Gravar chave
          </button>
          <button
            type="button"
            onClick={runTest}
            disabled={busy || !status?.configured}
            className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-xs font-semibold text-[#e6edf3] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Testar conexão
          </button>
        </div>
        {notice ? <p className="text-xs leading-relaxed text-[#e6edf3]">{notice}</p> : null}
        <ServerError error={error} />
      </form>
    </div>
  );
}

function TestDetails({ result }: { result: BinanceTestResult }) {
  return (
    <div className="rounded-xl border border-[#30363d] bg-[#161b22] px-3 py-1">
      <PermissionLine label="Saques habilitados" value={simNao(result.withdrawals_enabled)} />
      <PermissionLine label="Restrição de IP" value={simNao(result.ip_restrict)} />
      <PermissionLine label="Futuros" value={simNao(result.enable_futures)} />
      <PermissionLine label="Spot e margem" value={simNao(result.enable_spot_and_margin_trading)} />
      <PermissionLine label="Transferência interna" value={simNao(result.enable_internal_transfer)} />
      <PermissionLine label="Testado em" value={formatAdminWhen(result.tested_at)} />
      <PermissionLine label="Erro do teste" value={result.error ?? '—'} />
    </div>
  );
}
