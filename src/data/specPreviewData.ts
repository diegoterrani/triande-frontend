import {
  ActionResponse,
  AgentId,
  AlertItem,
  AnalystEvent,
  ApiTokenRecord,
  AuditEntry,
  BacktestReport,
  DangerActionPayload,
  InfraResponse,
  LogEntry,
  OhlcvBar,
  PreviewScenario,
  RecentBarsResponse,
  RiskResponse,
  StatusResponse,
  StrategyConfig,
  TimelineEvent,
  TimelineResponse,
  UserOperator,
  UserRole,
} from '../types/triade';
import { todayInSaoPaulo } from '../utils/format';

function buildInitialStatus(scenario: PreviewScenario): StatusResponse {
  const today = todayInSaoPaulo();
  const nowIso = new Date().toISOString();

  const b3Live = scenario === 'default_inspection' || scenario === 'b3_live_with_position';
  const hasB3Position = scenario === 'b3_live_with_position';

  return {
    ok: true,
    bind: '127.0.0.1:8765',
    readonly: false,
    kill_all: { present: false, reason: null },
    generated_at: nowIso,
    agents: {
      b3: {
        agent: 'b3',
        label: 'B3',
        market: 'B3 (futuros)',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        contract_current: b3Live ? 'WINZ26' : 'WINZ26 / WDOZ26',
        magic_number: 26011701,
        mode: b3Live ? 'real' : 'papel',
        live_enabled: b3Live,
        live_confirm_ok: b3Live,
        paper_venue: 'simulate',
        units: {
          agent: { unit: 'triade-agent-b3', active: 'active', enabled: 'disabled' },
          xvfb: { unit: 'triade-xvfb-b3', active: 'active', enabled: 'disabled' },
          bridge: { unit: 'triade-bridge-b3', active: 'active', enabled: 'disabled' },
        },
        kill: {
          kill_all: { present: false, reason: null },
          kill_agent: { present: false, reason: null },
          blocked: false,
        },
        state: {
          path: b3Live ? 'var/b3/live-state.json' : 'var/b3/paper-state.json',
          day: b3Live ? today : '2024-08-01',
          equity_peak: 7500,
          day_start_equity: 7500,
          day_peak_equity: hasB3Position ? 7580 : 7500,
          equity_current: hasB3Position ? 7564 : 7500,
          realized_pnl_today: 0,
          trades_today: hasB3Position ? 1 : 0,
          halted: false,
          sticky_halt: false,
          halt_reason: null,
          block_entries: false,
          consecutive_losses: 0,
          trades_by_source: hasB3Position ? { python: 1, llm: 0 } : { python: 0, llm: 0 },
          pnl_by_source: { python: 0, llm: 0 },
          positions: hasB3Position
            ? [
                {
                  symbol: 'WIN',
                  contract: 'WINZ26',
                  qty: 1,
                  avg_price: 128450,
                  stop_price: 128250,
                  target_price: 128850,
                  opened_at: `${today}T10:12:04-03:00`,
                  strategy: 'orb_vwap_trend',
                  entry_reason: 'rompimento ORB 30m acima da VWAP com tendência EMA 9>21',
                  entry_fee: 1.85,
                  client_order_id: 'tAAA8912WINZ26',
                  source: 'python',
                  max_hold_until: null,
                  side: 'buy',
                  current_price: 128770,
                  unrealized_pnl: 64.0,
                },
              ]
            : [],
          drawdown: 0,
          drawdown_pct: 0,
        },
        paper_state: {
          path: 'var/b3/paper-state.json',
          day: '2024-08-01',
          equity_peak: 10000,
          day_start_equity: 10000,
          realized_pnl_today: 185.0,
          trades_today: 2,
          halted: false,
          sticky_halt: false,
          halt_reason: null,
          block_entries: false,
          consecutive_losses: 0,
          trades_by_source: { python: 2 },
          positions: [],
          drawdown: 42.0,
          drawdown_pct: 0.0042,
        },
        bridge: {
          applicable: true,
          safe: true,
          listen: {
            port: b3Live ? 18863 : 18861,
            listening: true,
            binds: [b3Live ? '127.0.0.1:18863' : '127.0.0.1:18861'],
            localhost_only: true,
            unsafe_binds: [],
          },
          check: {
            ok: true,
            pong: true,
            host: '127.0.0.1',
            port: b3Live ? 18863 : 18861,
            raw: '{"pong":true,"trade_allowed":true}',
          },
          secondary_ports: [
            {
              port: 18861,
              label: 'Ponte oficial (unit systemd)',
              listening: true,
              pong: true,
              active_for_live: !b3Live,
            },
            {
              port: 18863,
              label: 'Ponte live atual (processo avulso)',
              listening: true,
              pong: true,
              active_for_live: b3Live,
            },
          ],
        },
        log_file: b3Live ? 'var/b3/logs/live.jsonl' : 'var/b3/logs/paper.jsonl',
        signals: hasB3Position
          ? [
              {
                ts: `${today}T10:12:00-03:00`,
                symbol: 'WIN',
                side: 'buy',
                reason: 'rompimento ORB 30m + VWAP + EMA9>21',
                source: 'python',
              },
            ]
          : [],
        logs: [
          {
            ts: `${today}T09:00:05-03:00`,
            level: 'INFO',
            agent: 'b3',
            mode: b3Live ? 'live' : 'paper',
            msg: 'conciliação inicial concluída; contrato vigente WINZ26 verificado',
          },
          {
            ts: `${today}T09:15:02-03:00`,
            level: 'INFO',
            agent: 'b3',
            mode: b3Live ? 'live' : 'paper',
            msg: 'reconciliação ok; nenhuma reentrada do sinal antigo',
          },
        ],
        session_phase: 'accepting_entries',
        no_new_trades_after: b3Live ? '17:00' : '17:40',
        flatten_time: b3Live ? '17:30' : '18:10',
      },
      nasdaq: {
        agent: 'nasdaq',
        label: 'NASDAQ',
        market: 'NASDAQ / índice',
        currency: 'USD',
        timezone: 'America/New_York',
        contract_current: 'USTEC',
        magic_number: 26011702,
        mode: 'papel',
        live_enabled: false,
        live_confirm_ok: false,
        paper_venue: 'simulate',
        units: {
          agent: { unit: 'triade-agent-nasdaq', active: 'inactive', enabled: 'disabled' },
          xvfb: { unit: 'triade-xvfb-nasdaq', active: 'active', enabled: 'disabled' },
          bridge: { unit: 'triade-bridge-nasdaq', active: 'inactive', enabled: 'disabled' },
        },
        kill: {
          kill_all: { present: false, reason: null },
          kill_agent: { present: false, reason: null },
          blocked: false,
        },
        state: null,
        missing_state_reason: 'ainda não há var/nasdaq/paper-state.json nem var/nasdaq/journal/ neste servidor',
        bridge: {
          applicable: true,
          safe: true,
          listen: {
            port: 18862,
            listening: false,
            binds: [],
            localhost_only: true,
            unsafe_binds: [],
          },
          check: {
            ok: false,
            pong: false,
            host: '127.0.0.1',
            port: 18862,
            error: 'ponte NASDAQ 127.0.0.1:18862 inativa (unidade parada)',
          },
        },
        log_file: 'var/nasdaq/logs/paper.jsonl',
        signals: [],
        logs: [],
        session_phase: 'outside_session',
        no_new_trades_after: '15:15',
        flatten_time: '15:45',
      },
      crypto: {
        agent: 'crypto',
        label: 'Cripto',
        market: 'Cripto (Binance)',
        currency: 'USDT',
        timezone: 'America/Sao_Paulo',
        contract_current: 'BTCUSDT / ETHUSDT',
        mode: 'papel',
        live_enabled: false,
        live_confirm_ok: false,
        paper_venue: 'simulate',
        units: {
          agent: { unit: 'triade-agent-crypto', active: 'active', enabled: 'disabled' },
        },
        kill: {
          kill_all: { present: false, reason: null },
          kill_agent: { present: false, reason: null },
          blocked: false,
        },
        state: {
          path: 'var/crypto/paper-state.json',
          day: today,
          equity_peak: 1000.0,
          day_start_equity: 952.4,
          day_peak_equity: 961.2,
          cash: 936.8,
          equity_current: 936.8,
          realized_pnl_today: -15.6,
          trades_today: 3,
          halted: scenario === 'default_inspection' || scenario === 'b3_live_with_position',
          sticky_halt: scenario === 'default_inspection' || scenario === 'b3_live_with_position',
          halt_reason:
            scenario === 'default_inspection' || scenario === 'b3_live_with_position'
              ? 'drawdown máximo'
              : null,
          block_entries: false,
          consecutive_losses: 2,
          trades_by_source: { python: 2, llm: 1 },
          pnl_by_source: { python: -10.4, llm: -5.2 },
          positions: [],
          drawdown: 63.2,
          drawdown_pct: 0.0632,
          broker: { cash: 936.8, net: 936.8, avg: 0 },
        },
        bridge: {
          applicable: false,
          note: 'Sem ponte MT5 (Binance via Python no Linux)',
        },
        log_file: 'var/crypto/logs/paper.jsonl',
        signals: [
          {
            ts: `${today}T11:42:01-03:00`,
            symbol: 'BTCUSDT',
            side: 'buy',
            reason: 'rompimento da faixa',
            source: 'python',
          },
          {
            ts: `${today}T12:15:10-03:00`,
            symbol: 'ETHUSDT',
            side: 'sell',
            reason: 'cruzamento EMA tendência + ATR',
            source: 'llm',
          },
        ],
        logs: [
          {
            ts: `${today}T12:24:00-03:00`,
            level: 'WARN',
            agent: 'crypto',
            mode: 'paper',
            symbol: 'BTCUSDT',
            msg: 'entrada recusada: agente travado por drawdown máximo (sticky_halt)',
          },
          {
            ts: `${today}T12:18:11-03:00`,
            level: 'INFO',
            agent: 'crypto',
            mode: 'paper',
            symbol: 'ETHUSDT',
            pnl: -5.2,
            msg: 'trade encerrado por stop ATR',
          },
        ],
        session_phase: 'accepting_entries',
        no_new_trades_after: null,
        flatten_time: null,
      },
    },
  };
}

function buildInitialTimeline(scenario: PreviewScenario): TimelineEvent[] {
  const today = todayInSaoPaulo();
  const b3Live = scenario === 'default_inspection' || scenario === 'b3_live_with_position';
  const b3Mode = b3Live ? 'live' : 'paper';
  const b3File = b3Live ? 'var/b3/journal/live.jsonl' : 'var/b3/journal/paper.jsonl';

  const events: TimelineEvent[] = [
    {
      ts: `${today}T12:27:50.202118+00:00`,
      event: 'reconcile',
      agent: 'b3',
      mode: b3Mode,
      source_file: b3File,
      ok: true,
      detalhe: 'conciliação motor × corretora sem divergências',
    },
    {
      ts: `${today}T15:24:00.000000+00:00`,
      event: 'reject',
      agent: 'crypto',
      mode: 'paper',
      source_file: 'var/crypto/journal/paper.jsonl',
      symbol: 'BTCUSDT',
      side: 'buy',
      reason: 'agente travado',
      sinal: 'rompimento da faixa',
      source: 'python',
    },
    {
      ts: `${today}T15:18:11.000000+00:00`,
      event: 'halt',
      agent: 'crypto',
      mode: 'paper',
      source_file: 'var/crypto/journal/paper.jsonl',
      motivo: 'drawdown máximo (6,32% > teto 6,00%, sticky_halt)',
    },
    {
      ts: `${today}T15:18:10.000000+00:00`,
      event: 'trade',
      agent: 'crypto',
      mode: 'paper',
      source_file: 'var/crypto/journal/paper.jsonl',
      symbol: 'ETHUSDT',
      contract: 'ETHUSDT',
      side: 'sell',
      qty: 0.08,
      entry: 3142.5,
      exit: 3205.0,
      pnl: -5.2,
      fees: 0.2,
      entry_reason: 'volume_spike + rejeição na média rápida',
      exit_reason: 'stop',
      client_order_id: 'llm-eth-20261119-03',
      source: 'llm',
      strategy: 'ema_trend_atr',
    },
    {
      ts: `${today}T15:15:10.000000+00:00`,
      event: 'fill',
      agent: 'crypto',
      mode: 'paper',
      source_file: 'var/crypto/journal/paper.jsonl',
      symbol: 'ETHUSDT',
      contract: 'ETHUSDT',
      side: 'sell',
      qty: 0.08,
      price: 3142.5,
      stop: 3205.0,
      fee: 0.1,
      reason: 'volume_spike + rejeição na média rápida',
      client_order_id: 'llm-eth-20261119-03',
      source: 'llm',
      strategy: 'ema_trend_atr',
    },
    {
      ts: `${today}T15:15:08.000000+00:00`,
      event: 'llm_decision',
      agent: 'crypto',
      mode: 'paper',
      source_file: 'var/crypto/journal/llm.jsonl',
      symbol: 'ETHUSDT',
      side: 'sell',
      qty: 0.08,
      stop: 3205.0,
      action: 'enqueue_order',
      status: 'approved',
      idempotency_key: 'llm-eth-20261119-03',
      source: 'llm',
      rationale: 'pressão vendedora após pico de volume 2.4x acima da média',
    },
    {
      ts: `${today}T14:42:05.000000+00:00`,
      event: 'trade',
      agent: 'crypto',
      mode: 'paper',
      source_file: 'var/crypto/journal/paper.jsonl',
      symbol: 'BTCUSDT',
      contract: 'BTCUSDT',
      side: 'buy',
      qty: 0.003,
      entry: 91240.0,
      exit: 92480.0,
      pnl: 3.45,
      fees: 0.27,
      entry_reason: 'rompimento da faixa com tendência EMA 9>21',
      exit_reason: 'alvo parcial ATR',
      client_order_id: 'tAAA-btc-20261119-02',
      source: 'python',
      strategy: 'ema_trend_atr',
    },
    {
      ts: `${today}T14:05:12.000000+00:00`,
      event: 'fill',
      agent: 'crypto',
      mode: 'paper',
      source_file: 'var/crypto/journal/paper.jsonl',
      symbol: 'BTCUSDT',
      contract: 'BTCUSDT',
      side: 'buy',
      qty: 0.003,
      price: 91240.0,
      stop: 90400.0,
      target: 92480.0,
      fee: 0.14,
      reason: 'rompimento da faixa com tendência EMA 9>21',
      client_order_id: 'tAAA-btc-20261119-02',
      source: 'python',
      strategy: 'ema_trend_atr',
    },
    {
      ts: `${today}T14:05:10.000000+00:00`,
      event: 'signal',
      agent: 'crypto',
      mode: 'paper',
      source_file: 'var/crypto/journal/paper.jsonl',
      symbol: 'BTCUSDT',
      side: 'buy',
      reason: 'rompimento da faixa',
      rationale: 'EMA 9 acima da EMA 21 e rompimento do range com ATR favorável',
      strategy: 'ema_trend_atr',
      source: 'python',
      stop: 90400.0,
      target: 92480.0,
    },
    {
      ts: `${today}T13:18:40.000000+00:00`,
      event: 'trade',
      agent: 'crypto',
      mode: 'paper',
      source_file: 'var/crypto/journal/paper.jsonl',
      symbol: 'BTCUSDT',
      contract: 'BTCUSDT',
      side: 'buy',
      qty: 0.004,
      entry: 91800.0,
      exit: 88380.0,
      pnl: -13.85,
      fees: 0.35,
      entry_reason: 'pullback na EMA 9',
      exit_reason: 'stop',
      client_order_id: 'tAAA-btc-20261119-01',
      source: 'python',
      strategy: 'ema_trend_atr',
    },
    {
      ts: `${today}T12:30:01.000000+00:00`,
      event: 'restore',
      agent: 'crypto',
      mode: 'paper',
      source_file: 'var/crypto/journal/paper.jsonl',
      arquivo: 'var/crypto/paper-state.json',
      detalhe: 'estado restaurado no início do ciclo',
    },
  ];

  if (scenario === 'b3_live_with_position') {
    events.unshift(
      {
        ts: `${today}T13:12:04.000000+00:00`,
        event: 'fill',
        agent: 'b3',
        mode: 'live',
        source_file: 'var/b3/journal/live.jsonl',
        symbol: 'WIN',
        contract: 'WINZ26',
        side: 'buy',
        qty: 1,
        price: 128450,
        stop: 128250,
        target: 128850,
        fee: 1.85,
        reason: 'rompimento ORB 30m acima da VWAP',
        client_order_id: 'tAAA8912WINZ26',
        source: 'python',
        strategy: 'orb_vwap_trend',
      },
      {
        ts: `${today}T13:12:01.000000+00:00`,
        event: 'signal',
        agent: 'b3',
        mode: 'live',
        source_file: 'var/b3/journal/live.jsonl',
        symbol: 'WIN',
        contract: 'WINZ26',
        side: 'buy',
        reason: 'rompimento ORB 30m acima da VWAP com tendência EMA 9>21',
        rationale: 'preço rompeu máxima do range de abertura (09:05–09:35) acima da VWAP',
        strategy: 'orb_vwap_trend',
        source: 'python',
        stop: 128250,
        target: 128850,
      }
    );
  }

  return events;
}

export const INITIAL_ANALYST_EVENTS: AnalystEvent[] = [
  {
    ts: `${todayInSaoPaulo()}T15:14:55.000000+00:00`,
    kind: 'volume_spike',
    agent: 'crypto',
    symbol: 'ETHUSDT',
    volume: 4820,
    media: 1980,
    side: 'sell',
    rationale: 'volume 2,43x acima da média de 20 períodos próximo à resistência intradiária',
  },
  {
    ts: `${todayInSaoPaulo()}T15:18:11.000000+00:00`,
    kind: 'halt',
    agent: 'crypto',
    symbol: 'BTCUSDT',
    motivo: 'drawdown máximo atingido — analista impedido de enfileirar novas ordens',
  },
  {
    ts: `${todayInSaoPaulo()}T14:04:40.000000+00:00`,
    kind: 'range_break',
    agent: 'crypto',
    symbol: 'BTCUSDT',
    side: 'buy',
    rationale: 'rompimento limpo da faixa de consolidação de 45 minutos',
  },
];

export const BACKTEST_REPORTS: BacktestReport[] = [
  {
    id: 'b3',
    agent: 'b3',
    title: 'B3 Futuros (Estudo WIN + WDO · orb_vwap_trend)',
    strategy: {
      name: 'orb_vwap_trend',
      params: {
        orb_minutes: 30,
        range_start: '09:05',
        ema_fast: 9,
        ema_slow: 21,
        atr_period: 14,
        atr_mult: 1.5,
        use_vwap_filter: true,
        use_trend_filter: true,
        one_trade_per_day: true,
      },
    },
    data: {
      path: 'data/b3_synthetic_2024_2025.parquet',
      source: 'série sintética (estudo interno)',
      start: '2024-01-02',
      end: '2025-12-30',
      bars: 24960,
      disclaimer:
        'Atenção: série sintética gerada para validação de regras do motor. Não representa execução real de pregão da B3 nem garante retorno futuro.',
    },
    live_warning:
      'Esta amostra de pesquisa inclui WIN e WDO. Em modo REAL (micro_live), o agente B3 opera SOMENTE WIN (contrato vigente WINZ26, 1 contrato).',
    amostra_cheia: {
      trades: 312,
      wins: 168,
      losses: 144,
      win_rate: 0.5385,
      profit_factor: 1.42,
      max_drawdown: 412.5,
      max_drawdown_pct: 0.0412,
      sharpe: 1.38,
      expectancy: 8.65,
      net_pnl: 2698.8,
      fees: 577.2,
      avg_win: 52.4,
      avg_loss: -42.4,
      initial_equity: 10000,
      ending_equity: 12698.8,
      currency: 'BRL',
      days: 480,
      halted: false,
      halt_reason: null,
    },
    dentro_da_amostra: {
      trades: 218,
      wins: 120,
      losses: 98,
      win_rate: 0.5505,
      profit_factor: 1.48,
      max_drawdown: 360.0,
      max_drawdown_pct: 0.036,
      sharpe: 1.46,
      expectancy: 9.42,
      net_pnl: 2053.56,
      fees: 403.3,
      avg_win: 53.1,
      avg_loss: -44.06,
      initial_equity: 10000,
      ending_equity: 12053.56,
      currency: 'BRL',
      days: 336,
      halted: false,
      halt_reason: null,
    },
    fora_da_amostra: {
      trades: 94,
      wins: 48,
      losses: 46,
      win_rate: 0.5106,
      profit_factor: 1.29,
      max_drawdown: 398.4,
      max_drawdown_pct: 0.0398,
      sharpe: 1.19,
      expectancy: 6.86,
      net_pnl: 645.24,
      fees: 173.9,
      avg_win: 50.65,
      avg_loss: -38.82,
      initial_equity: 10000,
      ending_equity: 10645.24,
      currency: 'BRL',
      days: 144,
      halted: false,
      halt_reason: null,
    },
    amostra_cheia_por_ativo: {
      WIN: {
        trades: 184,
        wins: 101,
        losses: 83,
        win_rate: 0.5489,
        profit_factor: 1.46,
        max_drawdown: 295.0,
        max_drawdown_pct: 0.0295,
        sharpe: 1.44,
        expectancy: 9.85,
        net_pnl: 1812.4,
        fees: 340.4,
        avg_win: 54.1,
        avg_loss: -44.0,
        initial_equity: 10000,
        ending_equity: 11812.4,
        currency: 'BRL',
        days: 480,
        halted: false,
        halt_reason: null,
      },
      WDO: {
        trades: 128,
        wins: 67,
        losses: 61,
        win_rate: 0.5234,
        profit_factor: 1.35,
        max_drawdown: 388.0,
        max_drawdown_pct: 0.0388,
        sharpe: 1.21,
        expectancy: 6.92,
        net_pnl: 886.4,
        fees: 236.8,
        avg_win: 49.8,
        avg_loss: -40.16,
        initial_equity: 10000,
        ending_equity: 10886.4,
        currency: 'BRL',
        days: 480,
        halted: false,
        halt_reason: null,
      },
    },
  },
  {
    id: 'crypto',
    agent: 'crypto',
    title: 'Cripto Spot/Futuros (BTCUSDT + ETHUSDT · ema_trend_atr)',
    strategy: {
      name: 'ema_trend_atr',
      params: {
        ema_fast: 9,
        ema_slow: 21,
        atr_period: 14,
        atr_mult: 1.6,
        sizing_mode: 'min_notional',
        leverage: 2,
      },
    },
    data: {
      path: 'data/crypto_btc_eth_15m.parquet',
      source: 'série histórica + amostra sintética normalizada',
      start: '2025-01-01',
      end: '2026-10-31',
      bars: 64224,
      disclaimer:
        'Série histórica com taxas simuladas sem slippage extremo de liquidação; validar limites de drawdown sticky antes de habilitar live.',
    },
    amostra_cheia: {
      trades: 420,
      wins: 198,
      losses: 222,
      win_rate: 0.4714,
      profit_factor: 1.24,
      max_drawdown: 62.4,
      max_drawdown_pct: 0.0624,
      sharpe: 1.08,
      expectancy: 0.68,
      net_pnl: 285.6,
      fees: 84.0,
      avg_win: 7.45,
      avg_loss: -5.36,
      initial_equity: 1000,
      ending_equity: 1285.6,
      currency: 'USDT',
      days: 669,
      halted: true,
      halt_reason: 'drawdown máximo (6,24% no pico)',
    },
    dentro_da_amostra: {
      trades: 294,
      wins: 142,
      losses: 152,
      win_rate: 0.483,
      profit_factor: 1.31,
      max_drawdown: 48.2,
      max_drawdown_pct: 0.0482,
      sharpe: 1.22,
      expectancy: 0.82,
      net_pnl: 241.08,
      fees: 58.8,
      avg_win: 7.62,
      avg_loss: -5.53,
      initial_equity: 1000,
      ending_equity: 1241.08,
      currency: 'USDT',
      days: 468,
      halted: false,
      halt_reason: null,
    },
    fora_da_amostra: {
      trades: 126,
      wins: 56,
      losses: 70,
      win_rate: 0.4444,
      profit_factor: 1.11,
      max_drawdown: 62.4,
      max_drawdown_pct: 0.0624,
      sharpe: 0.74,
      expectancy: 0.35,
      net_pnl: 44.52,
      fees: 25.2,
      avg_win: 7.01,
      avg_loss: -4.97,
      initial_equity: 1000,
      ending_equity: 1044.52,
      currency: 'USDT',
      days: 201,
      halted: true,
      halt_reason: 'drawdown máximo',
    },
  },
  {
    id: 'nasdaq_orb',
    agent: 'nasdaq',
    title: 'NASDAQ USTEC (ny_open_range)',
    strategy: {
      name: 'ny_open_range',
      params: {
        range_start: '09:30',
        entries_after: '10:00',
        no_new_trades_after: '15:15',
        flatten_time: '15:45',
      },
    },
    data: {
      path: 'data/nasdaq_ustec_synth.parquet',
      source: 'série sintética NY session',
      start: '2024-06-01',
      end: '2026-06-01',
      bars: 18450,
      disclaimer:
        'Amostra sintética para calibração do agente NASDAQ (ainda sem autorização para live e sem journal ativo no VPS).',
    },
    amostra_cheia: {
      trades: 196,
      wins: 104,
      losses: 92,
      win_rate: 0.5306,
      profit_factor: 1.37,
      max_drawdown: 280.0,
      max_drawdown_pct: 0.028,
      sharpe: 1.32,
      expectancy: 4.18,
      net_pnl: 819.28,
      fees: 137.2,
      avg_win: 29.1,
      avg_loss: -23.99,
      initial_equity: 10000,
      ending_equity: 10819.28,
      currency: 'USD',
      days: 502,
      halted: false,
      halt_reason: null,
    },
    dentro_da_amostra: {
      trades: 138,
      wins: 75,
      losses: 63,
      win_rate: 0.5435,
      profit_factor: 1.43,
      max_drawdown: 215.0,
      max_drawdown_pct: 0.0215,
      sharpe: 1.4,
      expectancy: 4.74,
      net_pnl: 654.12,
      fees: 96.6,
      avg_win: 29.8,
      avg_loss: -25.1,
      initial_equity: 10000,
      ending_equity: 10654.12,
      currency: 'USD',
      days: 351,
      halted: false,
      halt_reason: null,
    },
    fora_da_amostra: {
      trades: 58,
      wins: 29,
      losses: 29,
      win_rate: 0.5,
      profit_factor: 1.24,
      max_drawdown: 280.0,
      max_drawdown_pct: 0.028,
      sharpe: 1.09,
      expectancy: 2.85,
      net_pnl: 165.16,
      fees: 40.6,
      avg_win: 27.3,
      avg_loss: -21.6,
      initial_equity: 10000,
      ending_equity: 10165.16,
      currency: 'USD',
      days: 151,
      halted: false,
      halt_reason: null,
    },
  },
  {
    id: 'nasdaq_vwap_mr',
    agent: 'nasdaq',
    title: 'NASDAQ USTEC (vwap_mean_reversion — comparativo)',
    strategy: {
      name: 'vwap_mean_reversion',
      params: {
        zscore_entry: 2.1,
        no_new_trades_after: '15:15',
        flatten_time: '15:45',
      },
    },
    data: {
      path: 'data/nasdaq_ustec_synth.parquet',
      source: 'série sintética NY session',
      start: '2024-06-01',
      end: '2026-06-01',
      bars: 18450,
      disclaimer:
        'Experimento comparativo fora da estratégia ativa (ny_open_range). Série sintética apenas.',
    },
    amostra_cheia: {
      trades: 245,
      wins: 132,
      losses: 113,
      win_rate: 0.5388,
      profit_factor: 1.18,
      max_drawdown: 342.0,
      max_drawdown_pct: 0.0342,
      sharpe: 0.92,
      expectancy: 1.85,
      net_pnl: 453.25,
      fees: 171.5,
      avg_win: 22.1,
      avg_loss: -21.8,
      initial_equity: 10000,
      ending_equity: 10453.25,
      currency: 'USD',
      days: 502,
      halted: false,
      halt_reason: null,
    },
    dentro_da_amostra: {
      trades: 170,
      wins: 94,
      losses: 76,
      win_rate: 0.5529,
      profit_factor: 1.24,
      max_drawdown: 260.0,
      max_drawdown_pct: 0.026,
      sharpe: 1.05,
      expectancy: 2.25,
      net_pnl: 382.5,
      fees: 119.0,
      avg_win: 22.6,
      avg_loss: -22.92,
      initial_equity: 10000,
      ending_equity: 10382.5,
      currency: 'USD',
      days: 351,
      halted: false,
      halt_reason: null,
    },
    fora_da_amostra: {
      trades: 75,
      wins: 38,
      losses: 37,
      win_rate: 0.5067,
      profit_factor: 1.08,
      max_drawdown: 342.0,
      max_drawdown_pct: 0.0342,
      sharpe: 0.65,
      expectancy: 0.94,
      net_pnl: 70.75,
      fees: 52.5,
      avg_win: 20.85,
      avg_loss: -19.5,
      initial_equity: 10000,
      ending_equity: 10070.75,
      currency: 'USD',
      days: 151,
      halted: false,
      halt_reason: null,
    },
  },
];

export const STRATEGY_CONFIGS: Record<AgentId, StrategyConfig> = {
  b3: {
    agent: 'b3',
    config_path: 'configs/b3.yaml',
    live_enabled: true,
    paper_venue: 'simulate',
    strategy_name: 'orb_vwap_trend',
    timezone: 'America/Sao_Paulo',
    symbols_research: ['WIN', 'WDO'],
    symbols_live: ['WIN'],
    symbol_mode: 'specific',
    roll_sessions_before: 2,
    contract_current: 'WINZ26',
    research_params: {
      orb_minutes: 30,
      range_start: '09:05',
      no_new_trades_after: '17:40',
      flatten_time: '18:10',
      ema_fast: 9,
      ema_slow: 21,
      atr_period: 14,
      atr_mult: 1.5,
      use_vwap_filter: true,
      use_trend_filter: true,
      one_trade_per_day: true,
      max_trades_per_day: 6,
      max_qty: 2,
      emergency_stop_pct: 0.01,
    },
    micro_live_params: {
      symbols: 'WIN (contrato vigente WINZ26)',
      max_qty: 1,
      stop_required: true,
      max_open_positions: 1,
      max_trades_per_day: 5,
      daily_loss_limit: 'R$ 300,00',
      daily_loss_limit_pct: 0.2,
      max_consecutive_losses: 3,
      max_drawdown_pct: 0.04,
      sticky_drawdown_halt: true,
      no_new_trades_after: '17:00',
      flatten_time: '17:30',
      one_trade_per_day: false,
      max_trades_per_source: 'python: 5 / llm: 5',
      emergency_stop_pct: 0.01,
    },
    costs: {
      fee_per_unit_side: 0.925,
      slippage_ticks: 1,
    },
    llm_editable_bounds: [
      { key: 'atr_mult', type: 'float', min: 1.0, max: 2.5, current: 1.5 },
      { key: 'use_vwap_filter', type: 'bool', current: true },
      { key: 'use_trend_filter', type: 'bool', current: true },
    ],
    env_key_names_only: ['B3_MT5_LOGIN', 'B3_MT5_PASSWORD', 'B3_MT5_SERVER', 'DAYTRADE_LIVE_CONFIRM'],
  },
  nasdaq: {
    agent: 'nasdaq',
    config_path: 'configs/nasdaq.yaml',
    live_enabled: false,
    paper_venue: 'simulate',
    strategy_name: 'ny_open_range',
    timezone: 'America/New_York',
    symbols_research: ['USTEC'],
    symbols_live: ['USTEC'],
    symbol_mode: 'continuous',
    research_params: {
      range_start: '09:30',
      entries_after: '10:00',
      no_new_trades_after: '15:15',
      flatten_time: '15:45',
      max_trades_per_day: 4,
      max_qty: 0.1,
      emergency_stop_pct: 0.01,
    },
    micro_live_params: {
      symbols: 'USTEC (ainda não autorizado a live)',
      max_qty: 0.1,
      stop_required: true,
      max_open_positions: 1,
      max_trades_per_day: 4,
      daily_loss_limit_pct: 0.01,
      max_drawdown_pct: 0.03,
      max_trades_per_source: 'python: 2 / llm: 2',
      no_new_trades_after: '15:15 (America/New_York)',
      flatten_time: '15:45 (America/New_York)',
      emergency_stop_pct: 0.01,
    },
    costs: {
      fee_per_unit_side: 0.35,
      slippage_ticks: 2,
    },
    llm_editable_bounds: [],
    env_key_names_only: ['NASDAQ_MT5_LOGIN', 'NASDAQ_MT5_PASSWORD', 'NASDAQ_MT5_SERVER'],
  },
  crypto: {
    agent: 'crypto',
    config_path: 'configs/crypto.yaml',
    live_enabled: false,
    paper_venue: 'simulate',
    strategy_name: 'ema_trend_atr',
    timezone: 'America/Sao_Paulo',
    symbols_research: ['BTCUSDT', 'ETHUSDT'],
    symbols_live: ['BTCUSDT', 'ETHUSDT'],
    symbol_mode: 'spot_perp_isolated',
    research_params: {
      ema_fast: 9,
      ema_slow: 21,
      atr_period: 14,
      atr_mult: 1.6,
      max_trades_per_day: 6,
      no_new_trades_after: 'não definido (24/7)',
      flatten_time: 'não definido (24/7)',
      emergency_stop_pct: 0.01,
    },
    micro_live_params: {
      symbols: 'BTCUSDT, ETHUSDT',
      sizing_mode: 'min_notional',
      leverage: '2x isolada',
      stop_required: true,
      max_trades_per_day: 4,
      daily_loss_limit_pct: 0.03,
      max_drawdown_pct: 0.06,
      sticky_drawdown_halt: true,
      emergency_stop_pct: 0.01,
    },
    costs: {
      fee_per_unit_side: 0.0004,
      slippage_ticks: 1,
    },
    llm_editable_bounds: [
      { key: 'atr_mult', type: 'float', min: 1.2, max: 2.4, current: 1.6 },
    ],
    env_key_names_only: ['BINANCE_API_KEY', 'BINANCE_API_SECRET'],
  },
};

export class SpecPreviewStore {
  private scenario: PreviewScenario = 'default_inspection';
  private status: StatusResponse;
  private timeline: TimelineEvent[];
  private analystEvents: AnalystEvent[];
  private audit: AuditEntry[];
  private alerts: AlertItem[];
  private users: UserOperator[];
  private tokens: ApiTokenRecord[];
  private telegramEnabled = false;

  constructor() {
    this.status = buildInitialStatus(this.scenario);
    this.timeline = buildInitialTimeline(this.scenario);
    this.analystEvents = [...INITIAL_ANALYST_EVENTS];
    const today = todayInSaoPaulo();
    this.audit = [
      {
        ts: `${today}T08:58:12-03:00`,
        actor: 'diego',
        role: 'owner',
        action: 'unit_start',
        agent: 'b3',
        mode: 'live',
        reason: 'abertura do pregão B3 com WINZ26 na ponte 18863',
        confirmations: ['typed:b3', '2fa:true'],
        result: 'ok',
        request_id: `${today.replace(/-/g, '')}T115812Z-001`,
      },
    ];
    this.alerts = this.deriveAlerts();
    this.users = [
      {
        id: 'u-diego',
        name: 'Diego Terrani',
        email: 'diego.terrani@gmail.com',
        role: 'owner',
        totp_enabled: true,
        last_active_at: new Date().toISOString(),
      },
      {
        id: 'u-auditor',
        name: 'Auditoria Interna',
        email: 'auditor@triade.local',
        role: 'auditor',
        totp_enabled: false,
        last_active_at: `${today}T09:10:00-03:00`,
      },
      {
        id: 'u-service',
        name: 'CI / Coletor Leitura',
        email: 'service@triade.local',
        role: 'service',
        totp_enabled: false,
        last_active_at: `${today}T09:00:00-03:00`,
      },
    ];
    this.tokens = [
      {
        id: 'tok-1',
        label: 'Túnel local Diego',
        role: 'owner',
        prefix: 'trd_live_9f2a…',
        created_at: `${today}T08:40:00-03:00`,
        revoked: false,
      },
      {
        id: 'tok-2',
        label: 'Leitura automatizada',
        role: 'service',
        prefix: 'trd_svc_41c0…',
        created_at: '2026-11-15T14:20:00-03:00',
        revoked: false,
      },
    ];
  }

  getScenario(): PreviewScenario {
    return this.scenario;
  }

  setScenario(next: PreviewScenario): void {
    this.scenario = next;
    this.status = buildInitialStatus(next);
    this.timeline = buildInitialTimeline(next);
    this.alerts = this.deriveAlerts();
  }

  isOffline(): boolean {
    return this.scenario === 'api_offline';
  }

  getStatus(): StatusResponse {
    this.status.generated_at = new Date().toISOString();
    return structuredClone(this.status);
  }

  getTimeline(params?: {
    agent?: AgentId | 'all';
    since?: string;
    until?: string;
    after?: string | null;
    limit?: number;
    mode?: 'all' | 'live' | 'paper';
  }): TimelineResponse {
    const agentFilter = params?.agent && params.agent !== 'all' ? params.agent : null;
    const modeFilter = params?.mode && params.mode !== 'all' ? params.mode : null;
    const today = todayInSaoPaulo();

    let filtered = [...this.timeline];
    if (agentFilter) {
      filtered = filtered.filter((e) => e.agent === agentFilter);
    }
    if (modeFilter) {
      filtered = filtered.filter((e) => e.mode === modeFilter);
    }
    if (params?.after) {
      filtered = filtered.filter((e) => e.ts > params.after!);
    }

    const limit = Math.min(params?.limit ?? 200, 1000);
    const sliced = filtered.slice(0, limit);

    const sources: TimelineResponse['sources'] = [];
    const missing: TimelineResponse['missing'] = [];

    const checkAgents: AgentId[] = agentFilter ? [agentFilter] : ['b3', 'nasdaq', 'crypto'];
    for (const ag of checkAgents) {
      if (ag === 'nasdaq') {
        missing.push({
          agent: 'nasdaq',
          path: 'var/nasdaq/journal/',
          reason: 'ainda não há var/nasdaq/journal/ neste servidor',
        });
      } else {
        const isLive = this.status.agents[ag].live_enabled;
        const m = modeFilter ?? (isLive ? 'live' : 'paper');
        sources.push({
          agent: ag,
          path: `var/${ag}/journal/${m}.jsonl`,
          exists: true,
          kind: 'journal',
          mode: m,
        });
      }
    }

    return {
      ok: true,
      readonly: false,
      exemplo: true,
      agents: checkAgents,
      since: params?.since ?? today,
      until: params?.until ?? today,
      after: params?.after ?? null,
      window: 'latest',
      count: sliced.length,
      total_matched: filtered.length,
      truncated: filtered.length > sliced.length,
      sources,
      missing,
      generated_at: new Date().toISOString(),
      events: structuredClone(sliced),
    };
  }

  getAnalystEvents(agent?: AgentId | 'all'): AnalystEvent[] {
    if (!agent || agent === 'all') return structuredClone(this.analystEvents);
    return structuredClone(this.analystEvents.filter((e) => e.agent === agent));
  }

  getRisk(agent: AgentId, profileOverride?: 'micro_live' | 'research'): RiskResponse {
    const ag = this.status.agents[agent];
    const effectiveProfile = profileOverride ?? (ag.live_enabled ? 'micro_live' : 'research');
    const st = ag.state;
    const cfg = STRATEGY_CONFIGS[agent];
    const isB3Live = agent === 'b3' && effectiveProfile === 'micro_live';

    const dayStart = st?.day_start_equity ?? 0;
    const eqCurrent = st?.equity_current ?? st?.cash ?? dayStart;
    const dayLoss = st ? Math.max(0, dayStart - eqCurrent) : null;
    const dailyLimit = isB3Live ? 300 : agent === 'nasdaq' ? 100 : 30;
    const drawdownPct =
      st && st.equity_peak > 0
        ? Math.max(0, (st.equity_peak - eqCurrent) / st.equity_peak)
        : st?.drawdown_pct ?? null;

    const rejects = this.timeline.filter((e) => e.agent === agent && e.event === 'reject');

    return {
      ok: true,
      agent,
      mode: ag.live_enabled ? 'live' : 'paper',
      profile: effectiveProfile,
      currency: ag.currency,
      timezone: ag.timezone,
      session: {
        no_new_trades_after:
          agent === 'b3'
            ? effectiveProfile === 'micro_live'
              ? '17:00'
              : '17:40'
            : agent === 'nasdaq'
              ? '15:15'
              : null,
        flatten_time:
          agent === 'b3'
            ? effectiveProfile === 'micro_live'
              ? '17:30'
              : '18:10'
            : agent === 'nasdaq'
              ? '15:45'
              : null,
        phase: ag.session_phase ?? 'accepting_entries',
      },
      limits: {
        symbols: effectiveProfile === 'micro_live' ? cfg.symbols_live : cfg.symbols_research,
        max_qty:
          agent === 'b3'
            ? { WIN: effectiveProfile === 'micro_live' ? 1 : 2, ...(effectiveProfile === 'research' ? { WDO: 2 } : {}) }
            : agent === 'nasdaq'
              ? { USTEC: 0.1 }
              : { BTCUSDT: 0.01, ETHUSDT: 0.1 },
        max_open_positions: 1,
        max_trades_per_day:
          agent === 'b3' ? (effectiveProfile === 'micro_live' ? 5 : 6) : 4,
        daily_loss_limit: dailyLimit,
        daily_loss_limit_pct: agent === 'b3' ? 0.2 : agent === 'nasdaq' ? 0.01 : 0.03,
        max_consecutive_losses: 3,
        max_drawdown_pct: agent === 'b3' ? 0.04 : agent === 'nasdaq' ? 0.03 : 0.06,
        sticky_drawdown_halt: agent === 'b3' || agent === 'crypto',
        max_trades_per_source:
          agent === 'b3' ? { python: 5, llm: 5 } : { python: 2, llm: 2 },
        stop_required: true,
        emergency_stop_pct: 0.01,
        one_trade_per_day: agent === 'b3' ? effectiveProfile === 'research' : false,
      },
      usage: {
        trades_today: st?.trades_today ?? 0,
        consecutive_losses: st?.consecutive_losses ?? 0,
        consecutive_losses_assumed: st ? st.consecutive_losses === undefined : false,
        open_positions: st?.positions.length ?? 0,
        open_qty: st ? st.positions.reduce((acc, p) => acc + Math.abs(p.qty), 0) : 0,
        day_loss: dayLoss,
        day_loss_pct_of_limit: dayLoss !== null && dailyLimit > 0 ? dayLoss / dailyLimit : null,
        drawdown_pct: drawdownPct,
        trades_by_source: st?.trades_by_source ?? {},
        halted: st?.halted ?? false,
        sticky_halt: st?.sticky_halt ?? false,
        halt_reason: st?.halt_reason ?? null,
        block_entries: st?.block_entries ?? false,
        kill_blocked: ag.kill.blocked,
      },
      recent_rejects: rejects,
      source_files: {
        config: `${cfg.config_path}#${effectiveProfile}`,
        state: st?.path ?? `var/${agent}/${ag.live_enabled ? 'live' : 'paper'}-state.json`,
      },
      generated_at: new Date().toISOString(),
    };
  }

  getInfra(): InfraResponse {
    const now = new Date();
    const b3BridgePort = this.status.agents.b3.live_enabled ? 18863 : 18861;
    return {
      ok: true,
      generated_at: now.toISOString(),
      dashboard: {
        bind: '127.0.0.1:8765',
        readonly: false,
        version: '1.0.0',
        commit_hash: 'a4f9c21',
        branch: 'main',
        linger: 'no',
      },
      server_clock_utc: now.toISOString(),
      server_clock_brt: now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      disk_var: {
        path: '/opt/triade/var',
        used_mb: 148,
        total_mb: 40960,
        used_pct: 0.36,
        inode_pct: 1.2,
        journal_largest_file: 'var/crypto/journal/paper.jsonl',
        journal_largest_mb: 2.4,
      },
      units: [
        { agent: 'b3', role: 'agent', ...this.status.agents.b3.units.agent },
        { agent: 'b3', role: 'bridge', ...this.status.agents.b3.units.bridge! },
        { agent: 'b3', role: 'xvfb', ...this.status.agents.b3.units.xvfb! },
        { agent: 'nasdaq', role: 'agent', ...this.status.agents.nasdaq.units.agent },
        { agent: 'nasdaq', role: 'bridge', ...this.status.agents.nasdaq.units.bridge! },
        { agent: 'nasdaq', role: 'xvfb', ...this.status.agents.nasdaq.units.xvfb! },
        { agent: 'crypto', role: 'agent', ...this.status.agents.crypto.units.agent },
        { agent: 'dashboard', role: 'dashboard', unit: 'triade-dashboard', active: 'active', enabled: 'disabled' },
      ],
      ports: [
        {
          port: 8765,
          service: 'Super Painel TRIADE',
          binds: ['127.0.0.1:8765'],
          listening: true,
          localhost_only: true,
          unsafe_binds: [],
          pong: null,
        },
        {
          port: 18861,
          service: 'Ponte MT5 B3 (unit oficial)',
          binds: ['127.0.0.1:18861'],
          listening: true,
          localhost_only: true,
          unsafe_binds: [],
          pong: true,
          note: b3BridgePort === 18861 ? 'Em uso' : 'Standby (live atual usa 18863)',
        },
        {
          port: 18863,
          service: 'Ponte MT5 B3 (processo avulso live)',
          binds: ['127.0.0.1:18863'],
          listening: true,
          localhost_only: true,
          unsafe_binds: [],
          pong: true,
          note: b3BridgePort === 18863 ? 'Ativa no live B3 atual' : 'Disponível',
        },
        {
          port: 18862,
          service: 'Ponte MT5 NASDAQ',
          binds: [],
          listening: false,
          localhost_only: true,
          unsafe_binds: [],
          pong: false,
          note: 'Unidade parada (paper_venue=simulate)',
        },
        {
          port: 5971,
          service: 'VNC Terminal B3 (DISPLAY :71)',
          binds: ['127.0.0.1:5971', '::1:5971'],
          listening: true,
          localhost_only: true,
          unsafe_binds: [],
          pong: null,
          note: 'Acesso somente via túnel SSH',
        },
        {
          port: 5972,
          service: 'VNC Terminal NASDAQ (DISPLAY :72)',
          binds: ['127.0.0.1:5972', '::1:5972'],
          listening: true,
          localhost_only: true,
          unsafe_binds: [],
          pong: null,
          note: 'Acesso somente via túnel SSH',
        },
      ],
      terminals: [
        { agent: 'b3', display: ':71', vnc_port: 5971, process_present: true },
        { agent: 'nasdaq', display: ':72', vnc_port: 5972, process_present: true },
      ],
      unsafe_binds_total: [],
    };
  }

  private deriveAlerts(): AlertItem[] {
    const items: AlertItem[] = [];
    const today = todayInSaoPaulo();

    for (const id of ['b3', 'nasdaq', 'crypto'] as AgentId[]) {
      const ag = this.status.agents[id];
      if (ag.kill.blocked) {
        items.push({
          id: `kill-${id}`,
          ts: new Date().toISOString(),
          agent: id,
          mode: ag.live_enabled ? 'live' : 'paper',
          severity: 'critical',
          origin: 'kill',
          title: `Kill switch ativo em ${ag.label}`,
          detail: ag.kill.kill_agent.reason || 'Arquivo KILL presente — novas entradas bloqueadas.',
          acknowledged: false,
        });
      }
      if (ag.state?.halted) {
        items.push({
          id: `halt-${id}`,
          ts: `${today}T12:18:11-03:00`,
          agent: id,
          mode: ag.live_enabled ? 'live' : 'paper',
          severity: ag.live_enabled ? 'critical' : 'warning',
          origin: ag.state.sticky_halt ? 'sticky_halt' : 'halt',
          title: `${ag.label} travado: ${ag.state.halt_reason ?? 'halt'}`,
          detail: ag.state.sticky_halt
            ? 'Halt persistente (sticky) — sobrevive à virada do dia e requer reset explícito do operador.'
            : 'Entradas bloqueadas para este ciclo.',
          acknowledged: false,
        });
      }
      if (ag.live_enabled && ag.bridge.applicable && !ag.bridge.check?.pong) {
        items.push({
          id: `bridge-${id}`,
          ts: new Date().toISOString(),
          agent: id,
          mode: 'live',
          severity: 'critical',
          origin: 'ponte_caida',
          title: `Ponte MT5 indisponível para ${ag.label} em modo REAL`,
          detail: ag.bridge.check?.error || 'Sem resposta pong na ponte configurada.',
          acknowledged: false,
        });
      }
      if ((ag.state?.consecutive_losses ?? 0) >= 2) {
        items.push({
          id: `losses-${id}`,
          ts: `${today}T12:18:10-03:00`,
          agent: id,
          mode: ag.live_enabled ? 'live' : 'paper',
          severity: 'warning',
          origin: '2_perdas_seguidas',
          title: `${ag.label} com ${ag.state?.consecutive_losses} perdas seguidas`,
          detail: 'Próximo do limite de 3 perdas consecutivas.',
          acknowledged: false,
        });
      }
    }

    if (this.status.agents.nasdaq.state === null) {
      items.push({
        id: 'nasdaq-empty',
        ts: `${today}T09:00:00-03:00`,
        agent: 'nasdaq',
        mode: 'paper',
        severity: 'info',
        origin: 'estado_ausente',
        title: 'NASDAQ sem arquivo de estado ou diário',
        detail: 'Unidade triade-agent-nasdaq está parada e ainda não gerou var/nasdaq/journal/.',
        acknowledged: true,
      });
    }

    return items;
  }

  getAlerts(): AlertItem[] {
    return structuredClone(this.alerts);
  }

  acknowledgeAlert(id: string): AlertItem[] {
    this.alerts = this.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a));
    return this.getAlerts();
  }

  getLogs(agent: AgentId, mode: 'effective' | 'live' | 'paper' = 'effective'): LogEntry[] {
    const ag = this.status.agents[agent];
    const targetMode = mode === 'effective' ? (ag.live_enabled ? 'live' : 'paper') : mode;
    const baseLogs = ag.logs ?? [];
    if (agent === 'nasdaq') return [];
    if (targetMode === 'paper' && ag.live_enabled) {
      return [
        {
          ts: '2024-08-01T17:40:00-03:00',
          level: 'INFO',
          agent: 'b3',
          mode: 'paper',
          symbol: 'WDO',
          msg: 'simulação CSV encerrada no horário de pesquisa (paper_venue=simulate)',
        },
        {
          ts: '2024-08-01T14:22:10-03:00',
          level: 'INFO',
          agent: 'b3',
          mode: 'paper',
          symbol: 'WIN',
          pnl: 185.0,
          msg: 'trade simulado encerrado com alvo atingido',
        },
      ];
    }
    return structuredClone(baseLogs);
  }

  getSystemJournalLogs(agent: AgentId): string[] {
    const today = todayInSaoPaulo();
    if (agent === 'nasdaq') {
      return [`-- Sem entradas recentes para triade-agent-nasdaq.service --`];
    }
    if (agent === 'b3') {
      return [
        `${today} 09:00:02 vps systemd[1000]: Started triade-agent-b3.service - TRIADE B3 Agent.`,
        `${today} 09:00:04 vps python[4412]: [b3] carregando configs/b3.yaml (live_enabled=${this.status.agents.b3.live_enabled})`,
        `${today} 09:00:05 vps python[4412]: [b3] conectado na ponte MT5 127.0.0.1:${this.status.agents.b3.bridge.listen?.port ?? 18863} (B3_MT5_LOGIN=[REDIGIDO])`,
        `${today} 09:15:02 vps python[4412]: [b3] reconcile ok; posições abertas=${this.status.agents.b3.state?.positions.length ?? 0}`,
      ];
    }
    return [
      `${today} 08:30:01 vps systemd[1000]: Started triade-agent-crypto.service - TRIADE Crypto Agent.`,
      `${today} 08:30:02 vps python[4520]: [crypto] carregando configs/crypto.yaml (paper_venue=simulate, BINANCE_API_KEY=[REDIGIDO])`,
      `${today} 12:18:11 vps python[4520]: [crypto] HALT sticky ativado: drawdown máximo`,
    ];
  }

  getAudit(): AuditEntry[] {
    return structuredClone(this.audit);
  }

  getUsers(): UserOperator[] {
    return structuredClone(this.users);
  }

  getTokens(): ApiTokenRecord[] {
    return structuredClone(this.tokens);
  }

  issueToken(label: string, role: UserRole): { record: ApiTokenRecord; plaintextOnce: string } {
    const rand = Math.random().toString(36).slice(2, 10);
    const prefix = `trd_${role === 'owner' ? 'live' : 'svc'}_${rand.slice(0, 4)}…`;
    const record: ApiTokenRecord = {
      id: `tok-${Date.now()}`,
      label,
      role,
      prefix,
      created_at: new Date().toISOString(),
      revoked: false,
    };
    this.tokens.unshift(record);
    return { record, plaintextOnce: `trd_${role}_${rand}9xQ2mK8v` };
  }

  revokeToken(id: string): ApiTokenRecord[] {
    this.tokens = this.tokens.map((t) => (t.id === id ? { ...t, revoked: true } : t));
    return this.getTokens();
  }

  getTelegramEnabled(): boolean {
    return this.telegramEnabled;
  }

  setTelegramEnabled(val: boolean): boolean {
    this.telegramEnabled = val;
    return this.telegramEnabled;
  }

  executeDangerAction(
    payload: DangerActionPayload,
    actor: { name: string; role: UserRole }
  ): ActionResponse {
    const reqId = `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-001`;
    if (this.isOffline()) {
      return {
        ok: false,
        agent: payload.agent,
        action: payload.action,
        audit_id: reqId,
        error: 'fail-closed: sem conexão com o VPS',
      };
    }
    if (actor.role !== 'owner') {
      this.audit.unshift({
        ts: new Date().toISOString(),
        actor: actor.name,
        role: actor.role,
        action: payload.action,
        agent: payload.agent,
        mode: 'mixed',
        reason: payload.reason,
        confirmations: [],
        result: 'denied',
        request_id: reqId,
      });
      return {
        ok: false,
        agent: payload.agent,
        action: payload.action,
        audit_id: reqId,
        error: 'permissão negada: exige papel owner',
      };
    }

    const targets: AgentId[] =
      payload.agent === 'all' ? ['b3', 'nasdaq', 'crypto'] : [payload.agent];
    const anyLive = targets.some((id) => this.status.agents[id].live_enabled);

    if (anyLive && payload.action !== 'unit_start') {
      if (!payload.otp || !/^\d{6}$/.test(payload.otp)) {
        return {
          ok: false,
          agent: payload.agent,
          action: payload.action,
          audit_id: reqId,
          error: 'confirmação inválida: código OTP 2FA de 6 dígitos obrigatório em modo REAL',
        };
      }
    }

    const confirmations = [
      `typed:${payload.confirm_agent}`,
      `typed:${payload.confirm_word}`,
      ...(anyLive ? ['2fa:true'] : []),
    ];

    const nowIso = new Date().toISOString();

    if (payload.action === 'kill_all') {
      this.status.kill_all = { present: true, reason: payload.reason };
      for (const id of ['b3', 'nasdaq', 'crypto'] as AgentId[]) {
        const ag = this.status.agents[id];
        ag.kill.kill_all = { present: true, reason: payload.reason };
        ag.kill.blocked = true;
        if (ag.state) ag.state.positions = [];
        this.timeline.unshift({
          ts: nowIso,
          event: 'kill',
          agent: id,
          mode: ag.live_enabled ? 'live' : 'paper',
          source_file: `var/${id}/journal/${ag.live_enabled ? 'live' : 'paper'}.jsonl`,
          motivo: `KILL_ALL: ${payload.reason}`,
        });
      }
    } else if (payload.agent !== 'all') {
      const ag = this.status.agents[payload.agent];
      const mode = ag.live_enabled ? 'live' : 'paper';
      const jFile = `var/${ag.agent}/journal/${mode}.jsonl`;

      if (payload.action === 'kill') {
        ag.kill.kill_agent = { present: true, reason: payload.reason };
        ag.kill.blocked = true;
        if (ag.state) ag.state.positions = [];
        this.timeline.unshift({
          ts: nowIso,
          event: 'kill',
          agent: ag.agent,
          mode,
          source_file: jFile,
          motivo: payload.reason,
        });
      } else if (payload.action === 'flatten') {
        const closedCount = ag.state?.positions.length ?? 0;
        ag.kill.kill_agent = { present: true, reason: `flatten: ${payload.reason}` };
        ag.kill.blocked = true;
        if (ag.state) ag.state.positions = [];
        this.timeline.unshift({
          ts: nowIso,
          event: 'flatten_all',
          agent: ag.agent,
          mode,
          source_file: jFile,
          motivo: payload.reason,
          canceladas: closedCount,
        });
      } else if (payload.action === 'kill_clear') {
        ag.kill.kill_agent = { present: false, reason: null };
        ag.kill.kill_all = { present: false, reason: null };
        this.status.kill_all = { present: false, reason: null };
        ag.kill.blocked = false;
      } else if (payload.action === 'reset_halt') {
        if (ag.state) {
          ag.state.halted = false;
          ag.state.sticky_halt = false;
          ag.state.halt_reason = null;
        }
      } else if (payload.action === 'unit_stop') {
        ag.units.agent.active = 'inactive';
        this.timeline.unshift({
          ts: nowIso,
          event: 'interrupt',
          agent: ag.agent,
          mode,
          source_file: jFile,
          motivo: `systemctl stop: ${payload.reason}`,
        });
      } else if (payload.action === 'unit_start') {
        ag.units.agent.active = 'active';
      }
    }

    this.audit.unshift({
      ts: nowIso,
      actor: actor.name,
      role: actor.role,
      action: payload.action,
      agent: payload.agent,
      mode: anyLive ? 'live' : 'paper',
      reason: payload.reason,
      confirmations,
      result: 'ok',
      request_id: reqId,
    });
    this.alerts = this.deriveAlerts();

    return {
      ok: true,
      agent: payload.agent,
      action: payload.action,
      kill_flag:
        payload.action === 'kill_all'
          ? 'var/KILL_ALL'
          : payload.action === 'kill' || payload.action === 'flatten'
            ? `var/${payload.agent}/KILL`
            : undefined,
      broker_cancel_attempted: payload.action === 'flatten',
      audit_id: reqId,
      message: 'Ação executada e registrada na trilha de auditoria.',
    };
  }

  getRecentBars(
    agent: AgentId,
    symbol?: string,
    timeframe: '1m' | '5m' | '15m' = '5m'
  ): RecentBarsResponse {
    const today = todayInSaoPaulo();
    const stepMinutes = timeframe === '1m' ? 1 : timeframe === '5m' ? 5 : 15;

    if (agent === 'nasdaq') {
      return {
        ok: true,
        agent: 'nasdaq',
        symbol: symbol || 'USTEC',
        contract: 'USTEC',
        timeframe,
        source_file: 'var/nasdaq/recent-bars.json',
        exists: false,
        bars: [],
      };
    }

    const targetSym =
      symbol ||
      (agent === 'b3' ? 'WIN' : 'BTCUSDT');

    const bars: OhlcvBar[] = [];
    const totalBars = 72;

    if (agent === 'b3') {
      // 09:05 BRT (12:05 UTC) onward
      const startMs = Date.parse(`${today}T12:05:00Z`);
      let price = 128180;
      for (let i = 0; i < totalBars; i++) {
        const ts = new Date(startMs + i * stepMinutes * 60_000).toISOString();
        const wave = Math.sin(i * 0.35) * 45 + Math.cos(i * 0.17) * 35;
        let targetDrift = 0;
        if (i >= 6 && i <= 14) targetDrift = 40; // ORB breakout around 10:12 BRT (13:12 UTC)
        else if (i > 14 && i <= 36) targetDrift = 18;
        else if (i > 36) targetDrift = Math.sin(i * 0.22) * 15;

        const open = Math.round(price / 5) * 5;
        const close = Math.round((open + wave * 0.45 + targetDrift) / 5) * 5;
        const wickUp = Math.round((25 + ((i * 17) % 35)) / 5) * 5;
        const wickDn = Math.round((20 + ((i * 13) % 30)) / 5) * 5;
        const high = Math.max(open, close) + wickUp;
        const low = Math.min(open, close) - wickDn;
        const volume = 1400 + ((i * 317) % 2400) + (i >= 12 && i <= 16 ? 2600 : 0);

        bars.push({ ts, open, high, low, close, volume });
        price = close;
      }

      // Anchor 13:12Z (10:12 BRT) near 128450 if within range
      const entryIdx = bars.findIndex((b) => b.ts >= `${today}T13:10:00Z`);
      if (entryIdx >= 0) {
        bars[entryIdx] = {
          ...bars[entryIdx],
          open: 128395,
          high: 128485,
          low: 128380,
          close: 128450,
          volume: bars[entryIdx].volume + 1800,
        };
      }
      const last = bars[bars.length - 1];
      bars[bars.length - 1] = { ...last, close: 128770, high: Math.max(last.high, 128795) };

      return {
        ok: true,
        agent: 'b3',
        symbol: 'WIN',
        contract: 'WINZ26',
        timeframe,
        source_file: 'var/b3/recent-bars.json',
        exists: true,
        bars,
      };
    }

    // Crypto: BTCUSDT or ETHUSDT aligned with var/crypto/journal/paper.jsonl trades
    const isEth = targetSym === 'ETHUSDT';
    const startMs = Date.parse(`${today}T12:15:00Z`);
    let price = isEth ? 3168.0 : 91620.0;

    for (let i = 0; i < totalBars; i++) {
      const ts = new Date(startMs + i * stepMinutes * 60_000).toISOString();
      let delta = 0;
      if (!isEth) {
        if (i >= 10 && i <= 14) delta = -650; // drop toward 88380 stop at ~13:18Z
        else if (i > 14 && i <= 24) delta = 290; // recovery toward 91240 entry at ~14:05Z
        else if (i > 24 && i <= 32) delta = 170; // rally toward 92480 target at ~14:42Z
        else delta = Math.sin(i * 0.4) * 140;
      } else {
        if (i >= 30 && i <= 37) delta = 8.5; // bounce hitting short stop at 3205 around 15:18Z
        else delta = Math.sin(i * 0.38) * 6.2;
      }

      const open = Number(price.toFixed(2));
      const close = Number((open + delta).toFixed(2));
      const spread = isEth ? 7.5 : 190;
      const high = Number((Math.max(open, close) + spread * (0.4 + ((i % 4) * 0.2))).toFixed(2));
      const low = Number((Math.min(open, close) - spread * (0.4 + (((i + 2) % 4) * 0.2))).toFixed(2));
      const volume = isEth
        ? 1800 + ((i * 421) % 2900) + (i === 35 ? 2900 : 0)
        : 420 + ((i * 97) % 680) + (i === 22 ? 640 : 0);

      bars.push({ ts, open, high, low, close, volume });
      price = close;
    }

    // Anchor exact journal trade coordinates for clear visual alignment
    if (!isEth) {
      const iExit1 = bars.findIndex((b) => b.ts >= `${today}T13:15:00Z`);
      if (iExit1 >= 0) {
        bars[iExit1] = { ...bars[iExit1], low: Math.min(bars[iExit1].low, 88360), close: 88380 };
      }
      const iEntry2 = bars.findIndex((b) => b.ts >= `${today}T14:05:00Z`);
      if (iEntry2 >= 0) {
        bars[iEntry2] = { ...bars[iEntry2], open: 91120, close: 91240, high: 91310, low: 91080 };
      }
      const iExit2 = bars.findIndex((b) => b.ts >= `${today}T14:40:00Z`);
      if (iExit2 >= 0) {
        bars[iExit2] = { ...bars[iExit2], high: Math.max(bars[iExit2].high, 92510), close: 92480 };
      }
    } else {
      const iEntry = bars.findIndex((b) => b.ts >= `${today}T15:15:00Z`);
      if (iEntry >= 0) {
        bars[iEntry] = { ...bars[iEntry], open: 3148.0, close: 3142.5, high: 3156.0, low: 3138.0 };
      }
      const iExit = bars.findIndex((b) => b.ts >= `${today}T15:18:00Z`);
      if (iExit >= 0) {
        bars[iExit] = { ...bars[iExit], high: Math.max(bars[iExit].high, 3209.0), close: 3205.0 };
      }
    }

    return {
      ok: true,
      agent: 'crypto',
      symbol: targetSym,
      contract: targetSym,
      timeframe,
      source_file: 'var/crypto/recent-bars.json',
      exists: true,
      bars,
    };
  }
}

export const previewStore = new SpecPreviewStore();
