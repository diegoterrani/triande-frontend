import React, { useContext, useEffect, useMemo, useState } from 'react';
import { LiveRevisionContext } from '../../api/liveContext';
import { triadeApi } from '../../api/triade';
import { AgentId, LogEntry, LogsPayload } from '../../types/triade';
import { AGENT_NAMES, formatBrasiliaTime, redactSecrets } from '../../utils/format';
import { EmptyState, ErrorState, StatusBadge } from '../ui/Primitives';

export const LogsView: React.FC = () => {
  const [agent, setAgent] = useState<AgentId>('b3');
  const [layer, setLayer] = useState<'operational' | 'systemd'>('operational');
  const [logMode, setLogMode] = useState<'effective' | 'paper' | 'live'>('effective');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [query, setQuery] = useState('');
  const [opLogs, setOpLogs] = useState<LogEntry[]>([]);
  const [sysLogs, setSysLogs] = useState<string[]>([]);
  const [meta, setMeta] = useState<LogsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const revision = useContext(LiveRevisionContext);

  useEffect(() => {
    let cancel = false;
    triadeApi
      .getLogs(agent, logMode)
      .then((payload) => {
        if (cancel) return;
        setOpLogs(payload.entries);
        setSysLogs(payload.systemd_journal);
        setMeta(payload);
        setError(null);
      })
      .catch((err) => {
        if (cancel) return;
        setOpLogs([]);
        setSysLogs([]);
        setMeta(null);
        setError(err instanceof Error ? err.message : 'Falha ao carregar logs');
      });
    return () => {
      cancel = true;
    };
  }, [agent, logMode, revision]);

  const filteredOp = useMemo(() => {
    return opLogs.filter((l) => {
      if (levelFilter !== 'ALL' && l.level !== levelFilter) return false;
      if (query.trim()) {
        const hay = `${l.msg} ${l.symbol ?? ''} ${l.reason ?? ''}`.toLowerCase();
        if (!hay.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [opLogs, levelFilter, query]);

  const filteredSys = useMemo(() => {
    return sysLogs
      .map(redactSecrets)
      .filter((line) => !query.trim() || line.toLowerCase().includes(query.trim().toLowerCase()));
  }, [sysLogs, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">Logs</h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Operacional (var/&lt;agente&gt;/logs/) e sistema (journalctl) com redator SECRET_RE ativo
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-[#30363d] bg-[#161b22] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setLayer('operational')}
            className={`rounded-md px-3 py-1 font-medium ${
              layer === 'operational' ? 'bg-[#1c2330] text-[#e6edf3]' : 'text-[#8b9bb4]'
            }`}
          >
            Operacional (JSONL)
          </button>
          <button
            type="button"
            onClick={() => setLayer('systemd')}
            className={`rounded-md px-3 py-1 font-medium ${
              layer === 'systemd' ? 'bg-[#1c2330] text-[#e6edf3]' : 'text-[#8b9bb4]'
            }`}
          >
            Sistema (journalctl)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">Agente</label>
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value as AgentId)}
            className="rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3]"
          >
            <option value="b3">B3</option>
            <option value="nasdaq">NASDAQ</option>
            <option value="crypto">Cripto</option>
          </select>
        </div>

        {layer === 'operational' && (
          <>
            <div>
              <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">Arquivo de log</label>
              <select
                value={logMode}
                onChange={(e) => setLogMode(e.target.value as 'effective' | 'paper' | 'live')}
                className="rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs text-[#e6edf3]"
              >
                <option value="effective">Modo efetivo</option>
                <option value="live">live.jsonl</option>
                <option value="paper">paper.jsonl (ver paper também)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">Nível</label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as 'ALL' | 'INFO' | 'WARN' | 'ERROR')}
                className="rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-xs font-mono text-[#e6edf3]"
              >
                <option value="ALL">Todos</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>
          </>
        )}

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] uppercase text-[#8b9bb4] mb-1">Buscar texto</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar mensagem..."
            className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-xs font-mono text-[#e6edf3]"
          />
        </div>

        <StatusBadge variant="info" label="SECRET_RE ativo" />
        {meta?.path && (
          <span className="font-mono text-[11px] text-[#8b9bb4]">
            {meta.path} · existe: {String(meta.exists)} · modo {meta.mode}
          </span>
        )}
      </div>

      {error && <ErrorState message={error} />}

      {/* Output */}
      {layer === 'operational' ? (
        filteredOp.length === 0 ? (
          <EmptyState
            title={`Sem log de ${logMode === 'effective' ? 'modo efetivo' : logMode} ainda para ${AGENT_NAMES[agent]}`}
            detail="Quando o agente gravar linhas em var/<agente>/logs/*.jsonl, elas aparecerão aqui."
            missingPath={`var/${agent}/logs/${logMode === 'paper' ? 'paper' : 'live'}.jsonl`}
          />
        ) : (
          <div className="rounded-xl border border-[#30363d] bg-[#0b0f14] p-4 font-mono text-xs space-y-2 overflow-x-auto">
            {filteredOp.map((l, i) => (
              <div key={i} className="flex items-start gap-3 leading-relaxed">
                <span className="text-[#8b9bb4] shrink-0">{formatBrasiliaTime(l.ts, true)}</span>
                <span
                  className={`shrink-0 font-semibold ${
                    l.level === 'ERROR'
                      ? 'text-[#f85149]'
                      : l.level === 'WARN'
                        ? 'text-[#d29922]'
                        : 'text-[#7aa2f7]'
                  }`}
                >
                  {l.level}
                </span>
                <span className="text-[#e6edf3]">{redactSecrets(l.msg)}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        filteredSys.length === 0 ? (
          <EmptyState
            title="Sem journal systemd neste payload"
            detail="O campo systemd_journal de GET /api/v2/logs vem vazio para este agente. Não há journal local de mentira."
          />
        ) : (
          <div className="rounded-xl border border-[#30363d] bg-[#0b0f14] p-4 font-mono text-xs space-y-1.5 overflow-x-auto">
            {filteredSys.map((line, i) => (
              <div key={i} className="text-[#e6edf3] whitespace-pre-wrap">
                {line}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};
