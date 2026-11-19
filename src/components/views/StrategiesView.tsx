import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { AgentId, StrategyConfig } from '../../types/triade';
import { AGENT_NAMES } from '../../utils/format';
import { ModeBadge, StatusBadge } from '../ui/Primitives';

export const StrategiesView: React.FC<{
  configs: Record<AgentId, StrategyConfig>;
}> = ({ configs }) => {
  const [agent, setAgent] = useState<AgentId>('b3');
  const cfg = configs[agent];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e6edf3]">
            Estratégias e parâmetros (somente leitura no MVP)
          </h1>
          <p className="text-xs text-[#8b9bb4] mt-0.5">
            Configurações de configs/*.yaml · sem leitura de .env e sem botão para alterar live_enabled
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-[#30363d] bg-[#161b22] p-0.5 text-xs">
          {(['b3', 'nasdaq', 'crypto'] as AgentId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAgent(id)}
              className={`rounded-md px-3 py-1 font-medium ${
                agent === id ? 'bg-[#1c2330] text-[#e6edf3]' : 'text-[#8b9bb4]'
              }`}
            >
              {AGENT_NAMES[id]}
            </button>
          ))}
        </div>
      </div>

      {/* Header meta */}
      <div className="rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-semibold text-[#e6edf3]">{AGENT_NAMES[agent]}</span>
          <ModeBadge live={cfg.live_enabled} compact />
          <span className="font-mono text-[#8b9bb4]">
            estratégia: <strong className="text-[#e6edf3]">{cfg.strategy_name}</strong>
          </span>
          <span className="font-mono text-[#8b9bb4]">
            symbol_mode: <strong className="text-[#e6edf3]">{cfg.symbol_mode}</strong>
          </span>
          {cfg.contract_current && (
            <span className="font-mono text-[#8b9bb4]">
              contrato vigente: <strong className="text-[#e6edf3]">{cfg.contract_current}</strong>
              {cfg.roll_sessions_before !== undefined
                ? ` (roll_sessions_before: ${cfg.roll_sessions_before})`
                : ''}
            </span>
          )}
        </div>
        <span className="font-mono text-[#8b9bb4]">{cfg.config_path}</span>
      </div>

      {/* Micro Live vs Research */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-[#30363d] bg-[#1c2330] border-t-[3px] border-t-[#f85149] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#e6edf3]">
              Perfil efetivo (micro_live)
            </h2>
            <StatusBadge
              variant={cfg.live_enabled ? 'bad' : 'neutral'}
              label={cfg.live_enabled ? 'ativo no live' : 'reserva (live desligado)'}
            />
          </div>
          <dl className="divide-y divide-[#30363d] text-xs">
            {Object.entries(cfg.micro_live_params).map(([k, v]) => (
              <div key={k} className="py-2 flex items-center justify-between gap-4">
                <dt className="font-mono text-[#8b9bb4]">{k}</dt>
                <dd className="font-mono text-[#e6edf3] text-right">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-[#30363d] bg-[#1c2330] border-t-[3px] border-t-[#58a6ff] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#e6edf3]">
              Perfil de pesquisa (paper / backtest)
            </h2>
            <StatusBadge variant="info" label={`paper_venue: ${cfg.paper_venue}`} />
          </div>
          <dl className="divide-y divide-[#30363d] text-xs">
            {Object.entries(cfg.research_params).map(([k, v]) => (
              <div key={k} className="py-2 flex items-center justify-between gap-4">
                <dt className="font-mono text-[#8b9bb4]">{k}</dt>
                <dd className="font-mono text-[#e6edf3] text-right">{String(v)}</dd>
              </div>
            ))}
            <div className="py-2 flex items-center justify-between gap-4">
              <dt className="font-mono text-[#8b9bb4]">fee_per_unit_side / slippage_ticks</dt>
              <dd className="font-mono text-[#e6edf3]">
                {cfg.costs.fee_per_unit_side} / {cfg.costs.slippage_ticks} tick(s)
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* LLM bounds + Prohibited edits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-[#30363d] bg-[#1c2330] p-4 space-y-3">
          <h2 className="text-base font-semibold text-[#e6edf3]">
            Limites autorizados em llm.parameters (v2)
          </h2>
          {cfg.llm_editable_bounds.length === 0 ? (
            <p className="text-xs text-[#8b9bb4]">
              Nenhum parâmetro ajustável pelo analista configurado para este agente.
            </p>
          ) : (
            <div className="space-y-2 text-xs font-mono">
              {cfg.llm_editable_bounds.map((b) => (
                <div
                  key={b.key}
                  className="flex items-center justify-between rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2"
                >
                  <span className="text-[#e6edf3]">{b.key}</span>
                  <span className="text-[#8b9bb4]">
                    tipo: {b.type}
                    {b.min !== undefined ? ` · bounds [${b.min}..${b.max}]` : ''} · atual:{' '}
                    <strong className="text-[#7aa2f7]">{String(b.current)}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#e6edf3]">
            <Lock className="h-4 w-4 text-[#f85149]" />
            Campos proibidos no painel
          </div>
          <p className="text-xs text-[#8b9bb4]">
            Não é permitido editar pelo painel: <code className="text-[#e6edf3]">live_enabled</code>,{' '}
            <code className="text-[#e6edf3]">mt5.demo</code>, credenciais,{' '}
            <code className="text-[#e6edf3]">DAYTRADE_LIVE_CONFIRM</code>, binds de rede ou magic
            number.
          </p>
          <div className="text-[11px] font-mono text-[#8b9bb4] pt-1">
            Chaves de ambiente referenciadas (apenas nomes): {cfg.env_key_names_only.join(', ')}
          </div>
        </section>
      </div>
    </div>
  );
};
