import React, { useMemo, useState } from 'react';
import { AgentId, AuditEntry, UserRole } from '../../types/triade';
import { formatBrasiliaTime } from '../../utils/format';
import { EmptyState, ModeBadge, StatusBadge } from '../ui/Primitives';

export const AuditView: React.FC<{
  entries: AuditEntry[];
  role: UserRole;
}> = ({ entries, role }) => {
  const [agentFilter, setAgentFilter] = useState<AgentId | 'all'>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (agentFilter !== 'all' && e.agent !== agentFilter && e.agent !== 'all') return false;
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      return true;
    });
  }, [entries, agentFilter, actionFilter]);

  if (role !== 'owner' && role !== 'auditor') {
    return (
      <EmptyState
        title="Acesso restrito à Auditoria"
        detail="A trilha de auditoria append-only (var/dashboard/audit.jsonl) é visível apenas para os papéis owner e auditor."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">Trilha de auditoria</h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Registro append-only (var/dashboard/audit.jsonl) · sem edição nem exclusão pela UI
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Filtrar agente na auditoria"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value as AgentId | 'all')}
            className="rounded-lg border border-[#30363d] bg-[#161b22] px-2.5 py-1.5 text-xs text-[#e6edf3]"
          >
            <option value="all">Todos os agentes</option>
            <option value="b3">B3</option>
            <option value="nasdaq">NASDAQ</option>
            <option value="crypto">Cripto</option>
          </select>

          <select
            aria-label="Filtrar ação na auditoria"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-[#30363d] bg-[#161b22] px-2.5 py-1.5 text-xs text-[#e6edf3]"
          >
            <option value="all">Todas as ações</option>
            <option value="flatten">flatten</option>
            <option value="kill">kill</option>
            <option value="kill_all">kill_all</option>
            <option value="kill_clear">kill_clear</option>
            <option value="reset_halt">reset_halt</option>
            <option value="unit_stop">unit_stop</option>
            <option value="unit_start">unit_start</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum registro de auditoria neste filtro"
          detail="Toda ação executada em Controles gera uma linha imutável aqui."
        />
      ) : (
        <div className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#30363d] text-[11px] uppercase text-[#8b9bb4]">
                <tr>
                  <th className="px-4 py-2.5">Horário (BRT)</th>
                  <th className="px-4 py-2.5">Ator / Papel</th>
                  <th className="px-4 py-2.5">Ação</th>
                  <th className="px-4 py-2.5">Alvo / Modo</th>
                  <th className="px-4 py-2.5">Motivo</th>
                  <th className="px-4 py-2.5">Confirmações</th>
                  <th className="px-4 py-2.5">Resultado</th>
                  <th className="px-4 py-2.5">Request ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d] font-mono tabular-nums">
                {filtered.map((entry) => (
                  <tr key={entry.request_id + entry.ts} className="hover:bg-[#161b22]">
                    <td className="px-4 py-2.5 text-[#8b9bb4] whitespace-nowrap">
                      {formatBrasiliaTime(entry.ts, true)}
                    </td>
                    <td className="px-4 py-2.5 font-sans text-[#e6edf3]">
                      {entry.actor}{' '}
                      <span className="font-mono text-[11px] text-[#8b9bb4]">({entry.role})</span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-[#e6edf3]">{entry.action}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#e6edf3]">{entry.agent}</span>
                        <ModeBadge live={entry.mode === 'live'} compact />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-sans text-[#8b9bb4]">{entry.reason}</td>
                    <td className="px-4 py-2.5 text-[#8b9bb4]">
                      {entry.confirmations.join(', ') || '—'}
                    </td>
                    <td className="px-4 py-2.5 font-sans">
                      <StatusBadge
                        variant={entry.result === 'ok' ? 'ok' : 'bad'}
                        label={entry.result}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-[#8b9bb4]">{entry.request_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
