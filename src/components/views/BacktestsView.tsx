import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BacktestMetricsBlock, BacktestReport } from '../../types/triade';
import { AGENT_NAMES, formatMoney, formatPct } from '../../utils/format';
import { StatusBadge } from '../ui/Primitives';

export const BacktestsView: React.FC<{ reports: BacktestReport[] }> = ({ reports }) => {
  const [selectedId, setSelectedId] = useState<string>(reports[0]?.id ?? 'b3');
  const active = reports.find((r) => r.id === selectedId) ?? reports[0];

  const renderRow = (label: string, getter: (b: BacktestMetricsBlock) => React.ReactNode) => {
    if (!active) return null;
    return (
      <tr className="hover:bg-[#161b22]">
        <td className="px-4 py-2.5 text-[#8b9bb4]">{label}</td>
        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#e6edf3]">
          {getter(active.amostra_cheia)}
        </td>
        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#e6edf3]">
          {getter(active.dentro_da_amostra)}
        </td>
        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#e6edf3]">
          {getter(active.fora_da_amostra)}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-[#e6edf3]">Backtests (IS vs OOS)</h1>
        <p className="text-xs text-[#8b9bb4] mt-0.5">
          Relatórios gerados em artifacts/backtests/*.json · somente leitura (sem botão de publicação
          direta para live)
        </p>
      </div>

      {/* Report selector cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {reports.map((rep) => {
          const isSel = rep.id === active?.id;
          return (
            <button
              key={rep.id}
              type="button"
              onClick={() => setSelectedId(rep.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                isSel
                  ? 'border-[#7aa2f7] bg-[#1c2330]'
                  : 'border-[#30363d] bg-[#161b22] hover:bg-[#1c2330]/70'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#7aa2f7]">
                  {AGENT_NAMES[rep.agent]}
                </span>
                <span className="font-mono text-[11px] text-[#8b9bb4]">
                  {rep.data.bars.toLocaleString('pt-BR')} barras
                </span>
              </div>
              <div className="mt-1 text-sm font-semibold text-[#e6edf3] line-clamp-1">
                {rep.strategy.name}
              </div>
              <div className="mt-1 font-mono text-[11px] text-[#8b9bb4]">
                {rep.data.start} → {rep.data.end}
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="space-y-4">
          {/* Prominent Disclaimer */}
          <div className="flex items-start gap-2.5 rounded-xl border border-[#d29922]/50 bg-[#d29922]/10 px-4 py-3 text-xs text-[#d29922]">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong>Aviso da amostra ({active.data.source}):</strong> {active.data.disclaimer}
              <div className="mt-1 font-mono text-[11px] text-[#e6edf3]/80">
                Arquivo: {active.data.path}
              </div>
            </div>
          </div>

          {active.live_warning && (
            <div className="rounded-xl border border-[#f85149]/40 bg-[#f85149]/10 px-4 py-2.5 text-xs text-[#e6edf3]">
              <strong className="text-[#f85149]">Diferença estudo × live:</strong>{' '}
              {active.live_warning}
            </div>
          )}

          {/* IS vs OOS Table */}
          <section className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#30363d] flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[#e6edf3]">{active.title}</h2>
              {active.amostra_cheia.halted && (
                <StatusBadge
                  variant="warn"
                  label={`Halt no backtest: ${active.amostra_cheia.halt_reason}`}
                />
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#30363d] text-[11px] uppercase text-[#8b9bb4]">
                  <tr>
                    <th className="px-4 py-2.5">Métrica</th>
                    <th className="px-4 py-2.5 text-right">Amostra cheia</th>
                    <th className="px-4 py-2.5 text-right">Dentro da amostra (IS)</th>
                    <th className="px-4 py-2.5 text-right">Fora da amostra (OOS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363d]">
                  {renderRow('Trades (Wins / Losses)', (b) => `${b.trades} (${b.wins}W / ${b.losses}L)`)}
                  {renderRow('Win rate', (b) => formatPct(b.win_rate))}
                  {renderRow('Profit factor', (b) => b.profit_factor.toFixed(2))}
                  {renderRow('PnL líquido', (b) => formatMoney(b.net_pnl, b.currency, true))}
                  {renderRow('Taxas', (b) => formatMoney(b.fees, b.currency))}
                  {renderRow('Expectativa média', (b) => formatMoney(b.expectancy, b.currency, true))}
                  {renderRow('Sharpe', (b) => b.sharpe.toFixed(2))}
                  {renderRow('Max drawdown', (b) => `${formatMoney(b.max_drawdown, b.currency)} (${formatPct(b.max_drawdown_pct)})`)}
                  {renderRow('Ganho médio / Perda média', (b) => `${formatMoney(b.avg_win, b.currency, true)} / ${formatMoney(b.avg_loss, b.currency, true)}`)}
                  {renderRow('Equity inicial → final', (b) => `${formatMoney(b.initial_equity, b.currency)} → ${formatMoney(b.ending_equity, b.currency)}`)}
                </tbody>
              </table>
            </div>
          </section>

          {/* Asset breakdown */}
          {active.amostra_cheia_por_ativo && (
            <section className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#30363d]">
                <h2 className="text-base font-semibold text-[#e6edf3]">
                  Quebra por ativo (amostra cheia)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#30363d] text-[11px] uppercase text-[#8b9bb4]">
                    <tr>
                      <th className="px-4 py-2.5">Ativo</th>
                      <th className="px-4 py-2.5 text-right">Trades</th>
                      <th className="px-4 py-2.5 text-right">Win rate</th>
                      <th className="px-4 py-2.5 text-right">Profit factor</th>
                      <th className="px-4 py-2.5 text-right">PnL líquido</th>
                      <th className="px-4 py-2.5 text-right">Max DD</th>
                      <th className="px-4 py-2.5">Status no live B3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d] font-mono tabular-nums">
                    {Object.entries(active.amostra_cheia_por_ativo).map(([sym, b]) => (
                      <tr key={sym} className="hover:bg-[#161b22]">
                        <td className="px-4 py-2.5 font-semibold text-[#e6edf3]">{sym}</td>
                        <td className="px-4 py-2.5 text-right">{b.trades}</td>
                        <td className="px-4 py-2.5 text-right">{formatPct(b.win_rate)}</td>
                        <td className="px-4 py-2.5 text-right">{b.profit_factor.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-[#3fb950]">
                          {formatMoney(b.net_pnl, b.currency, true)}
                        </td>
                        <td className="px-4 py-2.5 text-right">{formatPct(b.max_drawdown_pct)}</td>
                        <td className="px-4 py-2.5 font-sans">
                          {sym === 'WIN' ? (
                            <StatusBadge variant="ok" label="Permitido no live (WINZ26)" />
                          ) : (
                            <StatusBadge variant="neutral" label="Apenas pesquisa/paper" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
