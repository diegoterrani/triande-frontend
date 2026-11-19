import React, { useMemo, useState } from 'react';
import { redactAuditValue } from '../../api/adminProtocol';
import { ADMIN_ACTION_LABELS, AdminAuditPayload } from '../../api/adminTypes';
import { redactSecrets } from '../../utils/format';
import { StatusBadge } from '../ui/Primitives';
import { formatAdminWhen } from './adminUi';

const PAGE_SIZE = 20;

function cell(value: unknown): string {
  if (value == null) return '—';
  return redactSecrets(JSON.stringify(redactAuditValue(value)));
}

export function AuditPanel({
  audit,
  onRefresh,
}: {
  audit: AdminAuditPayload | null;
  onRefresh: () => Promise<void>;
}) {
  const [page, setPage] = useState(0);
  const [action, setAction] = useState('all');
  const entries = audit?.entries ?? [];
  const actions = useMemo(
    () => [...new Set(entries.map((entry) => entry.action))].sort(),
    [entries]
  );
  const filtered = action === 'all' ? entries : entries.filter((entry) => entry.action === action);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#e6edf3]">Auditoria administrativa</h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#8b9bb4]">
            As entradas mais recentes vêm primeiro. Segredos já chegam redigidos. Esta tabela não
            tenta revelar chave, segredo ou código.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="rounded-lg border border-[#30363d] px-3 py-1.5 text-xs text-[#e6edf3]"
        >
          Atualizar
        </button>
      </div>

      <label className="block text-xs text-[#8b9bb4]">
        Ação
        <select
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(0);
          }}
          className="mt-1 block rounded-lg border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-xs text-[#e6edf3]"
        >
          <option value="all">Todas</option>
          {actions.map((item) => (
            <option key={item} value={item}>
              {ADMIN_ACTION_LABELS[item] ?? item}
            </option>
          ))}
        </select>
      </label>

      {slice.length === 0 ? (
        <p className="rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-6 text-xs text-[#8b9bb4]">
          Nenhuma entrada administrativa ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#30363d]">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-[#161b22] text-[#8b9bb4]">
              <tr>
                <th className="px-3 py-2 font-medium">Quando</th>
                <th className="px-3 py-2 font-medium">Quem</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">Ação</th>
                <th className="px-3 py-2 font-medium">Resultado</th>
                <th className="px-3 py-2 font-medium">Detalhe</th>
                <th className="px-3 py-2 font-medium">Antes</th>
                <th className="px-3 py-2 font-medium">Depois</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((entry, index) => (
                <tr key={`${entry.ts}-${entry.action}-${index}`} className="border-t border-[#30363d] align-top">
                  <td className="px-3 py-2 font-mono text-[11px] text-[#8b9bb4]">{formatAdminWhen(entry.ts)}</td>
                  <td className="px-3 py-2 text-[#e6edf3]">{entry.who}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[#8b9bb4]">{entry.ip}</td>
                  <td className="px-3 py-2">
                    <div className="text-[#e6edf3]">{ADMIN_ACTION_LABELS[entry.action] ?? entry.action}</div>
                    <div className="font-mono text-[10px] text-[#8b9bb4]">{entry.action}</div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge variant={entry.ok ? 'ok' : 'bad'} label={entry.ok ? 'ok' : 'falhou'} />
                  </td>
                  <td className="px-3 py-2 max-w-[16rem] break-words text-[#8b9bb4]">
                    {entry.detail ? cell(entry.detail) : '—'}
                  </td>
                  <td className="px-3 py-2 max-w-[16rem] break-words font-mono text-[10px] text-[#8b9bb4]">
                    {cell(entry.before)}
                  </td>
                  <td className="px-3 py-2 max-w-[16rem] break-words font-mono text-[10px] text-[#e6edf3]">
                    {cell(entry.after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-xs text-[#8b9bb4]">
        <span>
          {from}–{to} de {filtered.length}
          {audit ? ` · ${audit.count} no servidor` : ''}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            className="rounded-lg border border-[#30363d] px-2.5 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={safePage >= pages - 1}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg border border-[#30363d] px-2.5 py-1 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
