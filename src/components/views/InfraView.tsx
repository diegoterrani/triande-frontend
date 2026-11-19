import React from 'react';
import { AlertOctagon, CheckCircle2, HardDrive, RefreshCw, Server } from 'lucide-react';
import { InfraResponse } from '../../types/triade';
import { ErrorState, MetricBlock, StatusBadge } from '../ui/Primitives';

export const InfraView: React.FC<{
  infra: InfraResponse | null;
  error: string | null;
  onRefresh: () => void;
}> = ({ infra, error, onRefresh }) => {
  if (error) {
    return <ErrorState message={error} onRetry={onRefresh} />;
  }
  if (!infra) return null;

  const hasUnsafeBinds = infra.unsafe_binds_total.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">Saúde da infraestrutura (VPS)</h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Units systemd, pontes MT5 (18861, 18863 e 18862), binds localhost e disco · sem acesso
            a credenciais ou telas de conta
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs font-medium text-[#e6edf3] hover:bg-[#1c2330]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar checagem
        </button>
      </div>

      {hasUnsafeBinds && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-xl border border-[#f85149] bg-[#f85149]/15 px-4 py-3 text-xs font-semibold text-[#f85149]"
        >
          <AlertOctagon className="h-4 w-4 shrink-0" />
          INCIDENTE DE SEGURANÇA: bind fora de 127.0.0.1 detectado ({infra.unsafe_binds_total.join(', ')}).
        </div>
      )}

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
          <MetricBlock
            label="Painel (/api/health)"
            value={infra.dashboard.bind}
            subtext={`versão ${infra.dashboard.version} · ${infra.dashboard.branch}@${infra.dashboard.commit_hash}`}
            tone="good"
          />
        </div>
        <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
          <MetricBlock
            label="Linger (loginctl)"
            value={`Linger=${infra.dashboard.linger}`}
            subtext="Deve permanecer no neste desenho"
            tone={infra.dashboard.linger === 'no' ? 'good' : 'warn'}
          />
        </div>
        <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
          <MetricBlock
            label="Disco /opt/triade/var"
            value={
              infra.disk_var.used_mb == null
                ? '—'
                : `${infra.disk_var.used_mb} MB (${infra.disk_var.used_pct ?? '—'}%)`
            }
            subtext={`inode ${infra.disk_var.inode_pct ?? '—'}% · maior: ${infra.disk_var.journal_largest_file ?? '—'} (${infra.disk_var.journal_largest_mb ?? '—'} MB)`}
          />
        </div>
        <div className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4">
          <MetricBlock
            label="Relógio do servidor (Brasília)"
            value={infra.server_clock_brt || '—'}
            subtext={
              infra.server_clock_utc
                ? `UTC: ${infra.server_clock_utc.slice(11, 19)}Z`
                : 'UTC: —'
            }
          />
        </div>
      </div>

      {/* Ports & Bridges */}
      <section className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-[#7aa2f7]" />
            <h2 className="text-base font-semibold text-[#e6edf3]">
              Portas, binds e pontes MT5 (127.0.0.1 only)
            </h2>
          </div>
          <span className="text-[11px] text-[#8b9bb4]">
            Ping sem --init (nunca inicializa terminal pela UI)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#30363d] text-[11px] uppercase text-[#8b9bb4]">
              <tr>
                <th className="px-4 py-2.5">Porta</th>
                <th className="px-4 py-2.5">Serviço</th>
                <th className="px-4 py-2.5">Binds observados (ss)</th>
                <th className="px-4 py-2.5">Escuta / Pong</th>
                <th className="px-4 py-2.5">Segurança</th>
                <th className="px-4 py-2.5">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d] font-mono tabular-nums">
              {infra.ports.map((p) => (
                <tr key={p.port} className="hover:bg-[#161b22]">
                  <td className="px-4 py-2.5 font-semibold text-[#e6edf3]">:{p.port}</td>
                  <td className="px-4 py-2.5 font-sans text-[#e6edf3]">{p.service}</td>
                  <td className="px-4 py-2.5 text-[#8b9bb4]">
                    {p.binds.length > 0 ? p.binds.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-sans">
                    {p.listening ? (
                      <StatusBadge
                        variant="ok"
                        label={
                          p.pong === true
                            ? 'listening · pong ok'
                            : p.pong === false
                              ? 'listening · sem pong'
                              : 'listening'
                        }
                      />
                    ) : (
                      <StatusBadge variant="neutral" label="sem escuta" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-sans">
                    {p.unsafe_binds.length > 0 ? (
                      <StatusBadge variant="bad" label="BIND PÚBLICO" />
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#3fb950]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> localhost_only
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-sans text-[#8b9bb4]">{p.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Units + MT5 Terminals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-8 rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#30363d]">
            <h2 className="text-base font-semibold text-[#e6edf3]">
              Unidades systemd (--user)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#30363d] text-[11px] uppercase text-[#8b9bb4]">
                <tr>
                  <th className="px-4 py-2.5">Unit</th>
                  <th className="px-4 py-2.5">Agente</th>
                  <th className="px-4 py-2.5">Papel</th>
                  <th className="px-4 py-2.5">Estado (is-active)</th>
                  <th className="px-4 py-2.5">Boot (is-enabled)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d] font-mono">
                {infra.units.map((u) => (
                  <tr key={u.unit} className="hover:bg-[#161b22]">
                    <td className="px-4 py-2.5 text-[#e6edf3]">{u.unit}</td>
                    <td className="px-4 py-2.5 text-[#8b9bb4]">{u.agent}</td>
                    <td className="px-4 py-2.5 text-[#8b9bb4]">{u.role}</td>
                    <td className="px-4 py-2.5 font-sans">
                      <StatusBadge
                        variant={
                          u.active === 'active'
                            ? 'ok'
                            : u.active === 'failed'
                              ? 'bad'
                              : 'neutral'
                        }
                        label={u.active}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-[#8b9bb4]">{u.enabled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-4 rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-[#7aa2f7]" />
            <h2 className="text-base font-semibold text-[#e6edf3]">Terminais MT5 (VNC externo)</h2>
          </div>
          <div className="space-y-2.5 text-xs">
            {infra.terminals.map((t) => (
              <div
                key={t.agent}
                className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-[#e6edf3] uppercase">{t.agent}</div>
                  <div className="font-mono text-[#8b9bb4] mt-0.5">
                    DISPLAY {t.display} · VNC :{t.vnc_port}
                  </div>
                </div>
                <StatusBadge
                  variant={t.process_present ? 'ok' : 'neutral'}
                  label={t.process_present ? 'processo presente' : 'ausente'}
                />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#8b9bb4]">
            Sem captura de tela nem dados de conta no painel. Acesso gráfico permanece fora do painel
            via túnel SSH nas portas 5971 / 5972.
          </p>
        </section>
      </div>
    </div>
  );
};
