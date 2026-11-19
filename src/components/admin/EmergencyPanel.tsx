import React, { useState } from 'react';
import { adminApi } from '../../api/admin';
import { AdminApiError, formatAdminError } from '../../api/adminProtocol';
import { AdminWrite, Note, ServerError, StepUpAction } from './adminUi';

function ActionCard({
  title,
  detail,
  flag,
  confirmLabel,
  buttonLabel,
  busy,
  onRun,
}: {
  title: string;
  detail: string;
  flag: string;
  confirmLabel: string;
  buttonLabel: string;
  busy: boolean;
  onRun: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <section className="space-y-3 rounded-xl border border-[#f85149]/40 bg-[#1c2330] p-4">
      <h3 className="text-sm font-semibold text-[#e6edf3]">{title}</h3>
      <p className="text-xs leading-relaxed text-[#8b9bb4]">{detail}</p>
      <p className="font-mono text-[11px] text-[#f85149]">{flag}</p>
      <label className="flex items-start gap-2 text-xs text-[#e6edf3]">
        <input
          type="checkbox"
          checked={armed}
          onChange={(event) => setArmed(event.target.checked)}
          className="mt-0.5"
        />
        <span>{confirmLabel}</span>
      </label>
      <button
        type="button"
        disabled={!armed || busy}
        onClick={() => {
          setArmed(false);
          onRun();
        }}
        className="rounded-lg bg-[#f85149] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
      >
        {buttonLabel}
      </button>
    </section>
  );
}

export function EmergencyPanel({
  busy,
  onWrite,
  onChanged,
}: {
  busy: boolean;
  onWrite: AdminWrite;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = (
    purpose: string,
    action: StepUpAction,
    work: (totp: string) => Promise<{ summary: string }>
  ) => {
    setError(null);
    onWrite(purpose, async (totp) => {
      try {
        const result = await work(totp);
        setNotice(result.summary);
        await onChanged();
      } catch (err) {
        if (err instanceof AdminApiError && (err.code === 'totp' || err.unauthenticated)) throw err;
        setError(formatAdminError(err));
      }
    }, action);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[#e6edf3]">Emergência</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#8b9bb4]">
          Cada ação grava um arquivo KILL. Nenhuma delas envia ordem para a corretora a partir deste
          painel.
        </p>
      </div>
      <Note tone="bad">
        Flatten da cripto não chama a Binance. O campo broker_called volta false. Zerar de fato na
        corretora é o comando oficial do agente. O kill da B3 também só grava o arquivo. A B3 está
        em conta real.
      </Note>
      <div className="grid gap-3">
        <ActionCard
          title="Kill da cripto"
          detail="Grava o arquivo e o agente para de operar quando o vê. Não há ordem nova."
          flag="var/crypto/KILL"
          confirmLabel="Confirmo gravar var/crypto/KILL."
          buttonLabel="Gravar kill da cripto"
          busy={busy}
          onRun={() =>
            run('Gravar var/crypto/KILL. Nenhuma ordem é enviada.', { method: 'POST', path: '/api/v2/admin/crypto/kill' }, async (totp) => {
              const result = await adminApi.killCrypto(totp);
              return { summary: `Kill da cripto gravado em ${result.kill_flag}.` };
            })
          }
        />
        <ActionCard
          title="Flatten da cripto"
          detail="Grava o mesmo KILL. Este endpoint não fala com a Binance. O flatten na corretora fica para o comando oficial do agente, com o live já revisado."
          flag="var/crypto/KILL · broker_called=false"
          confirmLabel="Confirmo gravar o KILL sem enviar ordem à Binance."
          buttonLabel="Gravar flatten da cripto"
          busy={busy}
          onRun={() =>
            run('Gravar o KILL da cripto sem chamar a corretora.', { method: 'POST', path: '/api/v2/admin/crypto/flatten' }, async (totp) => {
              const result = await adminApi.flattenCrypto(totp);
              const note = result.note ? ` ${result.note}` : '';
              return {
                summary: `Flatten gravou ${result.kill_flag}. broker_called=${String(result.broker_called)}.${note}`,
              };
            })
          }
        />
        <ActionCard
          title="Kill da B3"
          detail="Só grava var/b3/KILL. Não altera configs/b3.yaml, não faz flatten e não mexe no agente, na ponte nem no terminal. A B3 está LIVE."
          flag="var/b3/KILL"
          confirmLabel="Confirmo gravar var/b3/KILL na conta real, sem flatten por este painel."
          buttonLabel="Gravar kill da B3"
          busy={busy}
          onRun={() =>
            run('Gravar var/b3/KILL. Não há flatten da conta B3 por este painel.', { method: 'POST', path: '/api/v2/admin/b3/kill' }, async (totp) => {
              const result = await adminApi.killB3(totp);
              return { summary: `Kill da B3 gravado em ${result.kill_flag}. Nenhum flatten foi pedido.` };
            })
          }
        />
      </div>
      {notice ? <Note tone="warn">{notice}</Note> : null}
      <ServerError error={error} />
    </div>
  );
}
