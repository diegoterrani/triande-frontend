import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CandlestickChart,
  Eraser,
  Layers,
  Minus,
  MousePointer,
  Mountain,
  Percent,
  Square,
  TrendingUp,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  AgentId,
  ChartDrawing,
  ChartFormat,
  ChartTradeSpan,
  CurrencyCode,
  DrawingAnchor,
  DrawingTool,
  IndicatorId,
  OhlcvBar,
  PositionDict,
  TimelineEvent,
} from '../../types/triade';
import {
  AGENT_CURRENCIES,
  formatBrasiliaTime,
  formatMoney,
  formatNewYorkTime,
  formatPrice,
} from '../../utils/format';
import {
  computeBollinger,
  computeEMA,
  computeORB,
  computeRSI,
  computeSMA,
  computeVWAP,
} from '../../utils/indicators';
import { EmptyState, StatusBadge } from '../ui/Primitives';

const INDICATOR_META: Array<{
  id: IndicatorId;
  label: string;
  color: string;
  group: 'Sobreposição' | 'Painel';
}> = [
  { id: 'ema9', label: 'EMA 9', color: '#7aa2f7', group: 'Sobreposição' },
  { id: 'ema21', label: 'EMA 21', color: '#d29922', group: 'Sobreposição' },
  { id: 'sma50', label: 'SMA 50', color: '#a371f7', group: 'Sobreposição' },
  { id: 'vwap', label: 'VWAP', color: '#e6edf3', group: 'Sobreposição' },
  { id: 'bollinger', label: 'Bollinger (20,2)', color: '#58a6ff', group: 'Sobreposição' },
  { id: 'orb_range', label: 'Faixa ORB', color: '#d29922', group: 'Sobreposição' },
  { id: 'volume', label: 'Volume', color: '#8b9bb4', group: 'Painel' },
  { id: 'rsi14', label: 'RSI (14)', color: '#7aa2f7', group: 'Painel' },
];

const DRAWING_COLORS = ['#7aa2f7', '#d29922', '#3fb950', '#f85149', '#e6edf3'];
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

function findNearestBarIndex(bars: OhlcvBar[], targetIso: string): number {
  if (bars.length === 0) return -1;
  const targetMs = Date.parse(targetIso);
  if (Number.isNaN(targetMs)) return bars.length - 1;
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < bars.length; i++) {
    const diff = Math.abs(Date.parse(bars[i].ts) - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export const MarketChartPanel: React.FC<{
  agent: AgentId;
  symbol: string;
  contract?: string;
  timeframe: '1m' | '5m' | '15m';
  bars: OhlcvBar[];
  sourceFile: string;
  exists: boolean;
  emptyDetail?: string | null;
  timelineEvents: TimelineEvent[];
  openPositions: PositionDict[];
  compact?: boolean;
  onInspectOrderId?: (clientOrderId: string) => void;
}> = ({
  agent,
  symbol,
  contract,
  timeframe,
  bars,
  sourceFile,
  exists,
  emptyDetail,
  timelineEvents,
  openPositions,
  compact = false,
  onInspectOrderId,
}) => {
  const currency: CurrencyCode = AGENT_CURRENCIES[agent];
  const priceDecimals = agent === 'b3' ? 0 : 2;

  const [format, setFormat] = useState<ChartFormat>('candle');
  const [activeIndicators, setActiveIndicators] = useState<IndicatorId[]>([
    'ema9',
    'ema21',
    'vwap',
    'volume',
  ]);
  const [indicatorsMenuOpen, setIndicatorsMenuOpen] = useState(false);

  const [tool, setTool] = useState<DrawingTool>('cursor');
  const [drawingColor, setDrawingColor] = useState<string>('#7aa2f7');
  const [pendingAnchor, setPendingAnchor] = useState<DrawingAnchor | null>(null);
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);

  const [showTrades, setShowTrades] = useState(true);
  const [showOpenLevels, setShowOpenLevels] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<ChartTradeSpan | null>(null);

  const [visibleCount, setVisibleCount] = useState<number>(60);
  const [scrollOffset, setScrollOffset] = useState<number>(0);

  const [hoverBarIdx, setHoverBarIdx] = useState<number | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Load persisted drawings per (agent, symbol)
  const storageKey = `triade_chart_drawings_${agent}_${symbol}`;
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setDrawings(raw ? (JSON.parse(raw) as ChartDrawing[]) : []);
    } catch {
      setDrawings([]);
    }
    setPendingAnchor(null);
    setSelectedTrade(null);
  }, [storageKey]);

  const saveDrawings = (next: ChartDrawing[]) => {
    setDrawings(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  };

  // Reset scroll offset when bars change
  useEffect(() => {
    setVisibleCount(Math.min(Math.max(bars.length, 24), 72));
    setScrollOffset(0);
  }, [bars.length, agent, symbol]);

  const toggleIndicator = (id: IndicatorId) => {
    setActiveIndicators((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Compute indicators on full bars array
  const indicators = useMemo(() => {
    const closes = bars.map((b) => b.close);
    return {
      ema9: computeEMA(closes, 9),
      ema21: computeEMA(closes, 21),
      sma50: computeSMA(closes, 50),
      vwap: computeVWAP(bars),
      bollinger: computeBollinger(closes, 20, 2),
      orb: computeORB(bars, 6),
      rsi14: computeRSI(closes, 14),
    };
  }, [bars]);

  // Build Trade Spans from journal fill/trade events + open positions
  const tradeSpans = useMemo<ChartTradeSpan[]>(() => {
    const spans: ChartTradeSpan[] = [];
    const matchingEvents = timelineEvents.filter(
      (ev) => ev.agent === agent && (!ev.symbol || ev.symbol === symbol)
    );

    const fillsById = new Map<string, TimelineEvent>();
    for (const ev of matchingEvents) {
      if (ev.event === 'fill' && ev.client_order_id) {
        fillsById.set(ev.client_order_id, ev);
      }
    }

    const handledOrderIds = new Set<string>();
    for (const ev of matchingEvents) {
      if (ev.event === 'trade') {
        const fill = ev.client_order_id ? fillsById.get(ev.client_order_id) : undefined;
        if (ev.client_order_id) handledOrderIds.add(ev.client_order_id);
        spans.push({
          id: `trade-${ev.client_order_id ?? ev.ts}`,
          client_order_id: ev.client_order_id,
          symbol: ev.symbol ?? symbol,
          side: (ev.side === 'sell' ? 'sell' : 'buy'),
          qty: ev.qty ?? 1,
          entryTs: fill?.ts ?? ev.ts,
          entryPrice: ev.entry ?? fill?.price ?? 0,
          exitTs: ev.ts,
          exitPrice: ev.exit ?? 0,
          pnl: ev.pnl,
          fees: ev.fees,
          entry_reason: ev.entry_reason ?? fill?.reason,
          exit_reason: ev.exit_reason,
          source: ev.source,
          mode: ev.mode,
          status: 'closed',
          stopPrice: fill?.stop ?? null,
          targetPrice: fill?.target ?? null,
        });
      }
    }

    // Open positions
    for (const pos of openPositions) {
      if (pos.symbol !== symbol && pos.contract !== symbol) continue;
      handledOrderIds.add(pos.client_order_id);
      spans.push({
        id: `open-${pos.client_order_id}`,
        client_order_id: pos.client_order_id,
        symbol: pos.symbol,
        side: pos.qty >= 0 ? 'buy' : 'sell',
        qty: Math.abs(pos.qty),
        entryTs: pos.opened_at,
        entryPrice: pos.avg_price,
        pnl: pos.unrealized_pnl ?? undefined,
        entry_reason: pos.entry_reason,
        source: pos.source,
        mode: agent === 'b3' ? 'live' : 'paper',
        status: 'open',
        stopPrice: pos.stop_price,
        targetPrice: pos.target_price,
      });
    }

    // Any standalone fills not paired with a trade or open position
    for (const [id, fill] of fillsById.entries()) {
      if (handledOrderIds.has(id)) continue;
      spans.push({
        id: `fill-${id}`,
        client_order_id: id,
        symbol: fill.symbol ?? symbol,
        side: fill.side === 'sell' ? 'sell' : 'buy',
        qty: fill.qty ?? 1,
        entryTs: fill.ts,
        entryPrice: fill.price ?? 0,
        entry_reason: fill.reason,
        source: fill.source,
        mode: fill.mode,
        status: 'open',
        stopPrice: fill.stop ?? null,
        targetPrice: fill.target ?? null,
      });
    }

    return spans;
  }, [timelineEvents, openPositions, agent, symbol]);

  // Visible window slice
  const clampedCount = Math.min(Math.max(16, visibleCount), Math.max(bars.length, 16));
  const maxOffset = Math.max(0, bars.length - clampedCount);
  const safeOffset = Math.min(Math.max(0, scrollOffset), maxOffset);
  const startIdx = Math.max(0, bars.length - clampedCount - safeOffset);
  const endIdx = Math.min(bars.length, startIdx + clampedCount);
  const visibleBars = bars.slice(startIdx, endIdx);

  // SVG Layout dimensions
  const showVolume = activeIndicators.includes('volume');
  const showRsi = activeIndicators.includes('rsi14');
  const width = 960;
  const padL = 16;
  const padR = 76; // Y-axis price labels on right
  const padT = 18;
  const mainH = compact ? 250 : 340;
  const volH = showVolume ? 54 : 0;
  const rsiH = showRsi ? 88 : 0;
  const gap = 14;
  const timeAxisH = 26;
  const totalH =
    padT +
    mainH +
    (showVolume ? gap + volH : 0) +
    (showRsi ? gap + rsiH : 0) +
    timeAxisH;
  const plotW = width - padL - padR;

  // Compute Y bounds for visible bars + overlays
  const { minP, maxP, maxVol } = useMemo(() => {
    if (visibleBars.length === 0) return { minP: 0, maxP: 100, maxVol: 1 };
    const highs: number[] = [];
    const lows: number[] = [];
    let mv = 1;
    for (let i = startIdx; i < endIdx; i++) {
      const b = bars[i];
      highs.push(b.high);
      lows.push(b.low);
      if (b.volume > mv) mv = b.volume;
      if (activeIndicators.includes('bollinger')) {
        const bu = indicators.bollinger.upper[i];
        const bl = indicators.bollinger.lower[i];
        if (bu !== null) highs.push(bu);
        if (bl !== null) lows.push(bl);
      }
    }
    if (showOpenLevels) {
      for (const p of openPositions) {
        if (p.symbol !== symbol && p.contract !== symbol) continue;
        highs.push(p.avg_price);
        lows.push(p.avg_price);
        if (p.stop_price !== null) {
          highs.push(p.stop_price);
          lows.push(p.stop_price);
        }
        if (p.target_price !== null) {
          highs.push(p.target_price);
          lows.push(p.target_price);
        }
      }
    }
    const rawMin = Math.min(...lows);
    const rawMax = Math.max(...highs);
    const pad = (rawMax - rawMin || 1) * 0.08;
    return { minP: rawMin - pad, maxP: rawMax + pad, maxVol: mv };
  }, [visibleBars.length, startIdx, endIdx, bars, activeIndicators, indicators, showOpenLevels, openPositions, symbol]);

  const slotW = visibleBars.length > 0 ? plotW / visibleBars.length : plotW;
  const xForGlobalIdx = (globalIdx: number) =>
    padL + (globalIdx - startIdx + 0.5) * slotW;
  const yForPrice = (price: number) =>
    padT + ((maxP - price) / (maxP - minP || 1)) * mainH;
  const priceForY = (y: number) =>
    maxP - ((y - padT) / mainH) * (maxP - minP || 1);

  const volTop = padT + mainH + gap;
  const rsiTop = padT + mainH + (showVolume ? gap + volH : 0) + gap;

  const yTicks = useMemo(() => {
    const count = 5;
    const step = (maxP - minP) / count;
    return Array.from({ length: count + 1 }, (_, i) => minP + i * step);
  }, [minP, maxP]);

  // Helper to convert pointer event to SVG coordinates -> barIndex + price
  const getAnchorFromPointer = (e: React.MouseEvent<SVGSVGElement>): DrawingAnchor | null => {
    const svg = svgRef.current;
    if (!svg || visibleBars.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = totalH / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const relIdx = Math.round((x - padL) / slotW - 0.5);
    const clampedRel = Math.min(Math.max(0, relIdx), visibleBars.length - 1);
    const globalIdx = startIdx + clampedRel;
    const clampedY = Math.min(Math.max(padT, y), padT + mainH);
    const rawPrice = priceForY(clampedY);
    const roundedPrice =
      agent === 'b3' ? Math.round(rawPrice / 5) * 5 : Number(rawPrice.toFixed(2));

    return {
      barIndex: globalIdx,
      ts: bars[globalIdx]?.ts ?? '',
      price: roundedPrice,
    };
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const anchor = getAnchorFromPointer(e);
    if (!anchor) return;
    setHoverBarIdx(anchor.barIndex);
    setHoverPrice(anchor.price);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool === 'cursor') return;
    const anchor = getAnchorFromPointer(e);
    if (!anchor) return;

    if (tool === 'hline') {
      const next: ChartDrawing = {
        id: `drw-${Date.now()}`,
        tool: 'hline',
        color: drawingColor,
        p1: anchor,
      };
      saveDrawings([...drawings, next]);
      return;
    }

    if (!pendingAnchor) {
      setPendingAnchor(anchor);
    } else {
      const next: ChartDrawing = {
        id: `drw-${Date.now()}`,
        tool,
        color: drawingColor,
        p1: pendingAnchor,
        p2: anchor,
      };
      saveDrawings([...drawings, next]);
      setPendingAnchor(null);
    }
  };

  const buildPolylinePath = (series: Array<number | null>) => {
    let d = '';
    let started = false;
    for (let i = startIdx; i < endIdx; i++) {
      const v = series[i];
      if (v === null || v === undefined) {
        started = false;
        continue;
      }
      const x = xForGlobalIdx(i);
      const y = yForPrice(v);
      d += `${started ? ' L' : ' M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      started = true;
    }
    return d.trim();
  };

  const inspectedIdx = hoverBarIdx !== null && bars[hoverBarIdx] ? hoverBarIdx : bars.length - 1;
  const inspectedBar = bars[inspectedIdx];

  if (!exists || bars.length === 0) {
    return (
      <EmptyState
        title={`Sem barras OHLCV em ${sourceFile}`}
        detail={
          emptyDetail ||
          `Ainda não há histórico de barras recentes para ${symbol} (${agent.toUpperCase()}). Quando o agente gravar ${sourceFile}, os candles aparecem aqui. Nada é inventado.`
        }
        missingPath={sourceFile}
      />
    );
  }

  // Last bar price
  const lastBar = bars[bars.length - 1];
  const lastY = yForPrice(lastBar.close);

  // Mountain path
  const mountainLine = visibleBars
    .map((b, rel) => `${rel === 0 ? 'M' : 'L'} ${xForGlobalIdx(startIdx + rel).toFixed(1)} ${yForPrice(b.close).toFixed(1)}`)
    .join(' ');
  const mountainArea =
    visibleBars.length > 0
      ? `${mountainLine} L ${xForGlobalIdx(endIdx - 1).toFixed(1)} ${(padT + mainH).toFixed(1)} L ${xForGlobalIdx(startIdx).toFixed(1)} ${(padT + mainH).toFixed(1)} Z`
      : '';

  // Preview drawing while waiting for 2nd click
  const previewDrawing: ChartDrawing | null =
    pendingAnchor && tool !== 'cursor' && tool !== 'hline' && hoverBarIdx !== null && hoverPrice !== null
      ? {
          id: 'preview',
          tool,
          color: drawingColor,
          p1: pendingAnchor,
          p2: {
            barIndex: hoverBarIdx,
            ts: bars[hoverBarIdx]?.ts ?? '',
            price: hoverPrice,
          },
        }
      : null;

  const renderDrawing = (drw: ChartDrawing, isPreview = false) => {
    const opacity = isPreview ? 0.65 : 0.92;
    if (drw.tool === 'hline') {
      const y = yForPrice(drw.p1.price);
      if (y < padT || y > padT + mainH) return null;
      return (
        <g key={drw.id} opacity={opacity}>
          <line
            x1={padL}
            x2={width - padR}
            y1={y}
            y2={y}
            stroke={drw.color}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <rect
            x={width - padR + 4}
            y={y - 9}
            width={66}
            height={18}
            rx={4}
            fill={drw.color}
          />
          <text
            x={width - padR + 37}
            y={y + 3.5}
            textAnchor="middle"
            fill="#0d1117"
            fontSize="10"
            fontWeight="700"
            className="font-mono"
          >
            {formatPrice(drw.p1.price, priceDecimals)}
          </text>
        </g>
      );
    }

    if (!drw.p2) return null;
    const x1 = xForGlobalIdx(drw.p1.barIndex);
    const y1 = yForPrice(drw.p1.price);
    const x2 = xForGlobalIdx(drw.p2.barIndex);
    const y2 = yForPrice(drw.p2.price);

    if (drw.tool === 'trendline') {
      return (
        <g key={drw.id} opacity={opacity}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={drw.color} strokeWidth={1.8} />
          <circle cx={x1} cy={y1} r={3.2} fill={drw.color} />
          <circle cx={x2} cy={y2} r={3.2} fill={drw.color} />
        </g>
      );
    }

    if (drw.tool === 'rect') {
      const rx = Math.min(x1, x2);
      const ry = Math.min(y1, y2);
      const rw = Math.max(4, Math.abs(x2 - x1));
      const rh = Math.max(4, Math.abs(y2 - y1));
      return (
        <g key={drw.id} opacity={opacity}>
          <rect
            x={rx}
            y={ry}
            width={rw}
            height={rh}
            fill={drw.color}
            fillOpacity={0.14}
            stroke={drw.color}
            strokeWidth={1.3}
          />
        </g>
      );
    }

    if (drw.tool === 'fib') {
      const leftX = Math.min(x1, x2);
      const rightX = Math.max(Math.max(x1, x2), leftX + 90);
      const pHigh = drw.p1.price;
      const pLow = drw.p2.price;
      return (
        <g key={drw.id} opacity={opacity}>
          {FIB_LEVELS.map((lvl) => {
            const pLvl = pHigh + (pLow - pHigh) * lvl;
            const yLvl = yForPrice(pLvl);
            if (yLvl < padT || yLvl > padT + mainH) return null;
            return (
              <g key={lvl}>
                <line
                  x1={leftX}
                  x2={rightX}
                  y1={yLvl}
                  y2={yLvl}
                  stroke={drw.color}
                  strokeWidth={lvl === 0.5 || lvl === 0.618 ? 1.5 : 1}
                  strokeDasharray={lvl === 0 || lvl === 1 ? undefined : '3 3'}
                />
                <text
                  x={leftX + 4}
                  y={yLvl - 3}
                  fill={drw.color}
                  fontSize="9.5"
                  className="font-mono"
                >
                  {(lvl * 100).toFixed(1)}% ({formatPrice(pLvl, priceDecimals)})
                </text>
              </g>
            );
          })}
        </g>
      );
    }

    return null;
  };

  return (
    <div className="rounded-xl border border-[#30363d] bg-[#1c2330] overflow-hidden">
      {/* Top Chart Toolbar */}
      <div className="border-b border-[#30363d] bg-[#161b22] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Symbol + Format Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 pr-2 border-r border-[#30363d]">
            <span className="font-mono text-sm font-bold text-[#e6edf3]">
              {contract && contract !== symbol ? `${symbol} (${contract})` : symbol}
            </span>
            <span className="rounded bg-[#21262d] px-1.5 py-0.5 font-mono text-[11px] text-[#8b9bb4]">
              {timeframe}
            </span>
          </div>

          {/* Format: Candle vs Montanha */}
          <div
            className="inline-flex rounded-lg border border-[#30363d] bg-[#0d1117] p-0.5 text-xs"
            role="group"
            aria-label="Formato do gráfico"
          >
            <button
              type="button"
              onClick={() => setFormat('candle')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                format === 'candle'
                  ? 'bg-[#1c2330] text-[#e6edf3]'
                  : 'text-[#8b9bb4] hover:text-[#e6edf3]'
              }`}
            >
              <CandlestickChart className="h-3.5 w-3.5" />
              Candle
            </button>
            <button
              type="button"
              onClick={() => setFormat('mountain')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                format === 'mountain'
                  ? 'bg-[#1c2330] text-[#7aa2f7]'
                  : 'text-[#8b9bb4] hover:text-[#e6edf3]'
              }`}
            >
              <Mountain className="h-3.5 w-3.5" />
              Montanha
            </button>
          </div>

          {/* Indicators Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIndicatorsMenuOpen((o) => !o)}
              aria-expanded={indicatorsMenuOpen}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                indicatorsMenuOpen || activeIndicators.length > 0
                  ? 'border-[#7aa2f7]/50 bg-[#1c2330] text-[#e6edf3]'
                  : 'border-[#30363d] bg-[#0d1117] text-[#8b9bb4]'
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-[#7aa2f7]" />
              Indicadores ({activeIndicators.length})
            </button>

            {indicatorsMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-40 w-64 rounded-xl border border-[#30363d] bg-[#161b22] p-2.5 shadow-2xl space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8b9bb4]">
                    Indicadores técnicos
                  </span>
                  <button
                    type="button"
                    onClick={() => setIndicatorsMenuOpen(false)}
                    className="text-[11px] text-[#7aa2f7] hover:underline"
                  >
                    Fechar
                  </button>
                </div>
                {INDICATOR_META.map((ind) => {
                  const active = activeIndicators.includes(ind.id);
                  return (
                    <label
                      key={ind.id}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[#1c2330] cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-[#e6edf3]">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleIndicator(ind.id)}
                          className="accent-[#7aa2f7]"
                        />
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: ind.color }}
                        />
                        <span>{ind.label}</span>
                      </span>
                      <span className="text-[10px] text-[#8b9bb4]">{ind.group}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trade Markers & Stop Levels toggles */}
          <button
            type="button"
            onClick={() => setShowTrades((v) => !v)}
            aria-pressed={showTrades}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              showTrades
                ? 'border-[#3fb950]/50 bg-[#3fb950]/10 text-[#3fb950]'
                : 'border-[#30363d] bg-[#0d1117] text-[#8b9bb4]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Trades ({tradeSpans.length})
          </button>

          <button
            type="button"
            onClick={() => setShowOpenLevels((v) => !v)}
            aria-pressed={showOpenLevels}
            className={`hidden sm:inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              showOpenLevels
                ? 'border-[#f85149]/40 bg-[#f85149]/10 text-[#e6edf3]'
                : 'border-[#30363d] bg-[#0d1117] text-[#8b9bb4]'
            }`}
          >
            Posição/Stop
          </button>
        </div>

        {/* Right: Drawing Tools + Zoom */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div
            className="inline-flex rounded-lg border border-[#30363d] bg-[#0d1117] p-0.5"
            role="group"
            aria-label="Ferramentas de desenho"
          >
            {[
              { id: 'cursor' as DrawingTool, label: 'Cursor / Mira', icon: MousePointer },
              { id: 'trendline' as DrawingTool, label: 'Linha de tendência', icon: TrendingUp },
              { id: 'hline' as DrawingTool, label: 'Linha horizontal', icon: Minus },
              { id: 'rect' as DrawingTool, label: 'Retângulo / Zona', icon: Square },
              { id: 'fib' as DrawingTool, label: 'Retração Fibonacci', icon: Percent },
            ].map((t) => {
              const Icon = t.icon;
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.label}
                  aria-label={t.label}
                  onClick={() => {
                    setTool(t.id);
                    setPendingAnchor(null);
                  }}
                  className={`rounded-md p-1.5 transition-colors ${
                    active
                      ? 'bg-[#7aa2f7] text-[#0d1117]'
                      : 'text-[#8b9bb4] hover:text-[#e6edf3]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>

          {/* Drawing color */}
          <div className="flex items-center gap-1 px-1.5 border-l border-[#30363d]">
            {DRAWING_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor de desenho ${c}`}
                onClick={() => setDrawingColor(c)}
                className={`h-3.5 w-3.5 rounded-full border ${
                  drawingColor === c ? 'border-white scale-110' : 'border-transparent opacity-70'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={drawings.length === 0}
            onClick={() => saveDrawings(drawings.slice(0, -1))}
            title="Desfazer último desenho"
            aria-label="Desfazer último desenho"
            className="rounded-md border border-[#30363d] bg-[#0d1117] p-1.5 text-[#8b9bb4] hover:text-[#e6edf3] disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={drawings.length === 0}
            onClick={() => saveDrawings([])}
            title="Limpar todos os desenhos"
            aria-label="Limpar todos os desenhos"
            className="rounded-md border border-[#30363d] bg-[#0d1117] p-1.5 text-[#8b9bb4] hover:text-[#f85149] disabled:opacity-40"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>

          {/* Zoom */}
          <div className="flex items-center gap-1 pl-1.5 border-l border-[#30363d]">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => Math.max(20, c - 12))}
              title="Aproximar zoom"
              aria-label="Aproximar zoom"
              className="rounded-md border border-[#30363d] bg-[#0d1117] p-1.5 text-[#8b9bb4] hover:text-[#e6edf3]"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setVisibleCount((c) => Math.min(bars.length, c + 12))}
              title="Afastar zoom"
              aria-label="Afastar zoom"
              className="rounded-md border border-[#30363d] bg-[#0d1117] p-1.5 text-[#8b9bb4] hover:text-[#e6edf3]"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Live OHLCV + Indicator Crosshair Bar */}
      <div className="border-b border-[#30363d] bg-[#0b0f14] px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
        <div className="flex flex-wrap items-center gap-3">
          {inspectedBar && (
            <>
              <span className="text-[#8b9bb4]">
                {formatBrasiliaTime(inspectedBar.ts, true)} BRT
                {agent === 'nasdaq' ? ` · ${formatNewYorkTime(inspectedBar.ts)} NY` : ''}
              </span>
              <span>
                A <strong className="text-[#e6edf3]">{formatPrice(inspectedBar.open, priceDecimals)}</strong>
              </span>
              <span>
                Máx <strong className="text-[#3fb950]">{formatPrice(inspectedBar.high, priceDecimals)}</strong>
              </span>
              <span>
                Mín <strong className="text-[#f85149]">{formatPrice(inspectedBar.low, priceDecimals)}</strong>
              </span>
              <span>
                F{' '}
                <strong
                  className={
                    inspectedBar.close >= inspectedBar.open ? 'text-[#3fb950]' : 'text-[#f85149]'
                  }
                >
                  {formatPrice(inspectedBar.close, priceDecimals)}
                </strong>
              </span>
              <span className="text-[#8b9bb4]">
                Vol {inspectedBar.volume.toLocaleString('pt-BR')}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeIndicators.includes('ema9') && indicators.ema9[inspectedIdx] !== null && (
            <span className="text-[#7aa2f7]">
              EMA9 {formatPrice(indicators.ema9[inspectedIdx], priceDecimals)}
            </span>
          )}
          {activeIndicators.includes('ema21') && indicators.ema21[inspectedIdx] !== null && (
            <span className="text-[#d29922]">
              EMA21 {formatPrice(indicators.ema21[inspectedIdx], priceDecimals)}
            </span>
          )}
          {activeIndicators.includes('vwap') && indicators.vwap[inspectedIdx] !== null && (
            <span className="text-[#e6edf3]">
              VWAP {formatPrice(indicators.vwap[inspectedIdx], priceDecimals)}
            </span>
          )}
          {activeIndicators.includes('rsi14') && indicators.rsi14[inspectedIdx] !== null && (
            <span className="text-[#7aa2f7]">
              RSI14 {indicators.rsi14[inspectedIdx]!.toFixed(1)}
            </span>
          )}
          {tool !== 'cursor' && (
            <span className="text-[#d29922]">
              {pendingAnchor
                ? 'Clique no 2º ponto no gráfico...'
                : tool === 'hline'
                  ? 'Clique no preço para inserir linha horizontal'
                  : 'Clique no 1º ponto no gráfico'}
            </span>
          )}
        </div>
      </div>

      {/* Main Interactive SVG Chart Canvas */}
      <div className="bg-[#0b0f14] w-full overflow-x-auto select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${totalH}`}
          className={`w-full min-w-[680px] ${
            tool === 'cursor' ? 'cursor-crosshair' : 'cursor-cell'
          }`}
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={() => {
            setHoverBarIdx(null);
            setHoverPrice(null);
          }}
          onClick={handleSvgClick}
          role="img"
          aria-label={`Gráfico ${format === 'candle' ? 'Candle' : 'Montanha'} de ${symbol}`}
        >
          <defs>
            <linearGradient id={`mountainGrad-${agent}-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7aa2f7" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#7aa2f7" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Price Grid + Right Y-Axis */}
          {yTicks.map((tick, idx) => {
            const y = yForPrice(tick);
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="#30363d"
                  strokeOpacity={0.55}
                  strokeDasharray="3 3"
                />
                <text
                  x={width - padR + 6}
                  y={y + 3.5}
                  fill="#8b9bb4"
                  fontSize="10"
                  className="font-mono"
                >
                  {formatPrice(tick, priceDecimals)}
                </text>
              </g>
            );
          })}

          {/* Vertical axis divider */}
          <line
            x1={width - padR}
            x2={width - padR}
            y1={padT}
            y2={padT + mainH + (showVolume ? gap + volH : 0) + (showRsi ? gap + rsiH : 0)}
            stroke="#30363d"
          />

          {/* ORB Range Overlay */}
          {activeIndicators.includes('orb_range') && indicators.orb && (
            <g>
              <rect
                x={padL}
                y={yForPrice(indicators.orb.high)}
                width={plotW}
                height={Math.max(1, yForPrice(indicators.orb.low) - yForPrice(indicators.orb.high))}
                fill="#d29922"
                fillOpacity={0.07}
              />
              <line
                x1={padL}
                x2={width - padR}
                y1={yForPrice(indicators.orb.high)}
                y2={yForPrice(indicators.orb.high)}
                stroke="#d29922"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <line
                x1={padL}
                x2={width - padR}
                y1={yForPrice(indicators.orb.low)}
                y2={yForPrice(indicators.orb.low)}
                stroke="#d29922"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            </g>
          )}

          {/* Bollinger Bands Overlay */}
          {activeIndicators.includes('bollinger') && (
            <g>
              <path
                d={buildPolylinePath(indicators.bollinger.upper)}
                fill="none"
                stroke="#58a6ff"
                strokeWidth={1.1}
                strokeOpacity={0.75}
              />
              <path
                d={buildPolylinePath(indicators.bollinger.middle)}
                fill="none"
                stroke="#58a6ff"
                strokeWidth={1}
                strokeDasharray="3 3"
                strokeOpacity={0.55}
              />
              <path
                d={buildPolylinePath(indicators.bollinger.lower)}
                fill="none"
                stroke="#58a6ff"
                strokeWidth={1.1}
                strokeOpacity={0.75}
              />
            </g>
          )}

          {/* Price Format: Candle or Mountain */}
          {format === 'mountain' ? (
            <g>
              <path d={mountainArea} fill={`url(#mountainGrad-${agent}-${symbol})`} />
              <path
                d={mountainLine}
                fill="none"
                stroke="#7aa2f7"
                strokeWidth={2}
                strokeLinejoin="round"
              />
            </g>
          ) : (
            <g>
              {visibleBars.map((b, rel) => {
                const gIdx = startIdx + rel;
                const cx = xForGlobalIdx(gIdx);
                const isUp = b.close >= b.open;
                const color = isUp ? '#3fb950' : '#f85149';
                const yHigh = yForPrice(b.high);
                const yLow = yForPrice(b.low);
                const yOpen = yForPrice(b.open);
                const yClose = yForPrice(b.close);
                const bodyTop = Math.min(yOpen, yClose);
                const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));
                const candleW = Math.max(3, Math.min(12, slotW * 0.66));

                return (
                  <g key={b.ts}>
                    <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1.2} />
                    <rect
                      x={cx - candleW / 2}
                      y={bodyTop}
                      width={candleW}
                      height={bodyH}
                      fill={color}
                      rx={1}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Moving Average / VWAP Lines */}
          {activeIndicators.includes('sma50') && (
            <path
              d={buildPolylinePath(indicators.sma50)}
              fill="none"
              stroke="#a371f7"
              strokeWidth={1.5}
            />
          )}
          {activeIndicators.includes('ema21') && (
            <path
              d={buildPolylinePath(indicators.ema21)}
              fill="none"
              stroke="#d29922"
              strokeWidth={1.6}
            />
          )}
          {activeIndicators.includes('ema9') && (
            <path
              d={buildPolylinePath(indicators.ema9)}
              fill="none"
              stroke="#7aa2f7"
              strokeWidth={1.6}
            />
          )}
          {activeIndicators.includes('vwap') && (
            <path
              d={buildPolylinePath(indicators.vwap)}
              fill="none"
              stroke="#e6edf3"
              strokeWidth={1.3}
              strokeDasharray="5 3"
              strokeOpacity={0.85}
            />
          )}

          {/* Open Position / Stop / Target Levels */}
          {showOpenLevels &&
            openPositions
              .filter((p) => p.symbol === symbol || p.contract === symbol)
              .map((pos) => {
                const yAvg = yForPrice(pos.avg_price);
                const yStop = pos.stop_price !== null ? yForPrice(pos.stop_price) : null;
                const yTarget = pos.target_price !== null ? yForPrice(pos.target_price) : null;
                return (
                  <g key={pos.client_order_id}>
                    <line
                      x1={padL}
                      x2={width - padR}
                      y1={yAvg}
                      y2={yAvg}
                      stroke="#7aa2f7"
                      strokeWidth={1.2}
                      strokeDasharray="4 4"
                    />
                    <text x={padL + 6} y={yAvg - 4} fill="#7aa2f7" fontSize="10" className="font-mono">
                      Entrada {pos.qty > 0 ? `+${pos.qty}` : pos.qty} @ {formatPrice(pos.avg_price, priceDecimals)}
                    </text>

                    {yStop !== null && (
                      <>
                        <line
                          x1={padL}
                          x2={width - padR}
                          y1={yStop}
                          y2={yStop}
                          stroke="#f85149"
                          strokeWidth={1.4}
                          strokeDasharray="4 3"
                        />
                        <text x={padL + 6} y={yStop - 4} fill="#f85149" fontSize="10" className="font-mono">
                          STOP obrigatório @ {formatPrice(pos.stop_price, priceDecimals)}
                        </text>
                      </>
                    )}

                    {yTarget !== null && (
                      <>
                        <line
                          x1={padL}
                          x2={width - padR}
                          y1={yTarget}
                          y2={yTarget}
                          stroke="#3fb950"
                          strokeWidth={1.2}
                          strokeDasharray="4 3"
                        />
                        <text x={padL + 6} y={yTarget - 4} fill="#3fb950" fontSize="10" className="font-mono">
                          ALVO @ {formatPrice(pos.target_price, priceDecimals)}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

          {/* Last Close Horizontal Reference */}
          <line
            x1={padL}
            x2={width - padR}
            y1={lastY}
            y2={lastY}
            stroke="#8b9bb4"
            strokeOpacity={0.35}
            strokeDasharray="2 3"
          />
          <rect
            x={width - padR + 3}
            y={lastY - 9}
            width={68}
            height={18}
            rx={4}
            fill={lastBar.close >= lastBar.open ? '#3fb950' : '#f85149'}
          />
          <text
            x={width - padR + 37}
            y={lastY + 3.5}
            textAnchor="middle"
            fill="#0d1117"
            fontSize="10"
            fontWeight="700"
            className="font-mono"
          >
            {formatPrice(lastBar.close, priceDecimals)}
          </text>

          {/* Executed Trades Overlay Markers */}
          {showTrades &&
            tradeSpans.map((tr) => {
              const entryBarIdx = findNearestBarIndex(bars, tr.entryTs);
              const exitBarIdx = tr.exitTs ? findNearestBarIndex(bars, tr.exitTs) : -1;
              const entryVisible = entryBarIdx >= startIdx && entryBarIdx < endIdx;
              const exitVisible = exitBarIdx >= startIdx && exitBarIdx < endIdx;

              const ex = entryVisible ? xForGlobalIdx(entryBarIdx) : null;
              const ey = tr.entryPrice ? yForPrice(tr.entryPrice) : null;
              const xx = exitVisible ? xForGlobalIdx(exitBarIdx) : null;
              const xy = tr.exitPrice ? yForPrice(tr.exitPrice) : null;
              const isWin = (tr.pnl ?? 0) >= 0;
              const entryColor = tr.side === 'buy' ? '#3fb950' : '#f85149';
              const exitColor = isWin ? '#3fb950' : '#f85149';

              return (
                <g
                  key={tr.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTrade(tr);
                  }}
                  className="cursor-pointer"
                >
                  {/* Entry -> Exit span line */}
                  {ex !== null && ey !== null && xx !== null && xy !== null && (
                    <line
                      x1={ex}
                      y1={ey}
                      x2={xx}
                      y2={xy}
                      stroke={exitColor}
                      strokeWidth={1.6}
                      strokeDasharray="4 3"
                    />
                  )}

                  {/* Entry triangle */}
                  {ex !== null && ey !== null && (
                    <g transform={`translate(${ex}, ${ey})`}>
                      {tr.side === 'buy' ? (
                        <polygon
                          points="0,-2 -6,9 6,9"
                          fill={entryColor}
                          stroke="#0d1117"
                          strokeWidth={1.2}
                        />
                      ) : (
                        <polygon
                          points="0,2 -6,-9 6,-9"
                          fill={entryColor}
                          stroke="#0d1117"
                          strokeWidth={1.2}
                        />
                      )}
                      <rect
                        x={-26}
                        y={tr.side === 'buy' ? 12 : -27}
                        width={52}
                        height={14}
                        rx={3}
                        fill="#161b22"
                        stroke={entryColor}
                        strokeWidth={0.9}
                      />
                      <text
                        x={0}
                        y={tr.side === 'buy' ? 22 : -17}
                        textAnchor="middle"
                        fill={entryColor}
                        fontSize="9"
                        fontWeight="700"
                        className="font-mono"
                      >
                        {tr.side === 'buy' ? 'COMPRA' : 'VENDA'}
                      </text>
                    </g>
                  )}

                  {/* Exit diamond */}
                  {xx !== null && xy !== null && (
                    <g transform={`translate(${xx}, ${xy})`}>
                      <polygon
                        points="0,-6 6,0 0,6 -6,0"
                        fill={exitColor}
                        stroke="#0d1117"
                        strokeWidth={1.2}
                      />
                      {tr.pnl !== undefined && (
                        <>
                          <rect
                            x={-34}
                            y={-24}
                            width={68}
                            height={15}
                            rx={3}
                            fill="#161b22"
                            stroke={exitColor}
                            strokeWidth={0.9}
                          />
                          <text
                            x={0}
                            y={-13.5}
                            textAnchor="middle"
                            fill={exitColor}
                            fontSize="9"
                            fontWeight="700"
                            className="font-mono"
                          >
                            {formatMoney(tr.pnl, currency, true)}
                          </text>
                        </>
                      )}
                    </g>
                  )}
                </g>
              );
            })}

          {/* Saved Drawings + Live Preview */}
          {drawings.map((d) => renderDrawing(d, false))}
          {previewDrawing && renderDrawing(previewDrawing, true)}

          {/* Volume Subplot */}
          {showVolume && (
            <g>
              <line x1={padL} x2={width - padR} y1={volTop} y2={volTop} stroke="#30363d" />
              <text x={padL + 4} y={volTop + 11} fill="#8b9bb4" fontSize="9.5" className="font-mono">
                Volume
              </text>
              {visibleBars.map((b, rel) => {
                const cx = xForGlobalIdx(startIdx + rel);
                const h = Math.max(1, (b.volume / maxVol) * (volH - 6));
                const barW = Math.max(2, Math.min(10, slotW * 0.6));
                return (
                  <rect
                    key={b.ts}
                    x={cx - barW / 2}
                    y={volTop + volH - h}
                    width={barW}
                    height={h}
                    fill={b.close >= b.open ? '#3fb950' : '#f85149'}
                    fillOpacity={0.45}
                  />
                );
              })}
            </g>
          )}

          {/* RSI (14) Subplot */}
          {showRsi && (
            <g>
              <line x1={padL} x2={width - padR} y1={rsiTop} y2={rsiTop} stroke="#30363d" />
              {[70, 30].map((lvl) => {
                const y = rsiTop + ((100 - lvl) / 100) * rsiH;
                return (
                  <g key={lvl}>
                    <line
                      x1={padL}
                      x2={width - padR}
                      y1={y}
                      y2={y}
                      stroke="#8b9bb4"
                      strokeOpacity={0.3}
                      strokeDasharray="3 3"
                    />
                    <text
                      x={width - padR + 6}
                      y={y + 3}
                      fill="#8b9bb4"
                      fontSize="9"
                      className="font-mono"
                    >
                      {lvl}
                    </text>
                  </g>
                );
              })}
              <text x={padL + 4} y={rsiTop + 11} fill="#7aa2f7" fontSize="9.5" className="font-mono">
                RSI (14)
              </text>
              <path
                d={(() => {
                  let d = '';
                  let started = false;
                  for (let i = startIdx; i < endIdx; i++) {
                    const v = indicators.rsi14[i];
                    if (v === null) {
                      started = false;
                      continue;
                    }
                    const x = xForGlobalIdx(i);
                    const y = rsiTop + ((100 - v) / 100) * rsiH;
                    d += `${started ? ' L' : ' M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                    started = true;
                  }
                  return d.trim();
                })()}
                fill="none"
                stroke="#7aa2f7"
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* X-Axis Timestamps (Brasília) */}
          {visibleBars.map((b, rel) => {
            const step = Math.max(1, Math.floor(visibleBars.length / 7));
            if (rel % step !== 0 && rel !== visibleBars.length - 1) return null;
            const cx = xForGlobalIdx(startIdx + rel);
            return (
              <text
                key={b.ts}
                x={cx}
                y={totalH - 8}
                textAnchor="middle"
                fill="#8b9bb4"
                fontSize="10"
                className="font-mono"
              >
                {formatBrasiliaTime(b.ts).slice(0, 5)}
              </text>
            );
          })}

          {/* Hover Crosshair */}
          {hoverBarIdx !== null && hoverBarIdx >= startIdx && hoverBarIdx < endIdx && (
            <g pointerEvents="none">
              <line
                x1={xForGlobalIdx(hoverBarIdx)}
                x2={xForGlobalIdx(hoverBarIdx)}
                y1={padT}
                y2={totalH - timeAxisH}
                stroke="#8b9bb4"
                strokeOpacity={0.5}
                strokeDasharray="3 3"
              />
              {hoverPrice !== null && (
                <>
                  <line
                    x1={padL}
                    x2={width - padR}
                    y1={yForPrice(hoverPrice)}
                    y2={yForPrice(hoverPrice)}
                    stroke="#8b9bb4"
                    strokeOpacity={0.5}
                    strokeDasharray="3 3"
                  />
                  <rect
                    x={width - padR + 3}
                    y={yForPrice(hoverPrice) - 9}
                    width={68}
                    height={18}
                    rx={4}
                    fill="#21262d"
                    stroke="#7aa2f7"
                    strokeWidth={0.8}
                  />
                  <text
                    x={width - padR + 37}
                    y={yForPrice(hoverPrice) + 3.5}
                    textAnchor="middle"
                    fill="#e6edf3"
                    fontSize="10"
                    className="font-mono"
                  >
                    {formatPrice(hoverPrice, priceDecimals)}
                  </text>
                </>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Pan Slider when zoomed in */}
      {maxOffset > 0 && (
        <div className="border-t border-[#30363d] bg-[#161b22] px-4 py-1.5 flex items-center gap-3 text-[11px] text-[#8b9bb4]">
          <span>Deslocamento histórico:</span>
          <input
            type="range"
            min={0}
            max={maxOffset}
            value={maxOffset - safeOffset}
            onChange={(e) => setScrollOffset(maxOffset - Number(e.target.value))}
            aria-label="Navegar na janela de barras"
            className="flex-1 accent-[#7aa2f7]"
          />
          <span className="font-mono">
            barras {startIdx + 1}–{endIdx} de {bars.length}
          </span>
        </div>
      )}

      {/* Selected Trade Inspection Bar */}
      {selectedTrade && (
        <div className="border-t border-[#30363d] bg-[#161b22] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge
              variant={selectedTrade.status === 'open' ? 'info' : (selectedTrade.pnl ?? 0) >= 0 ? 'ok' : 'bad'}
              label={selectedTrade.status === 'open' ? 'Posição aberta' : 'Trade encerrado'}
            />
            <span className="font-mono text-[#e6edf3]">
              {selectedTrade.side === 'buy' ? 'COMPRA' : 'VENDA'} {selectedTrade.qty} {selectedTrade.symbol}
            </span>
            <span className="font-mono text-[#8b9bb4]">
              Entrada: {formatPrice(selectedTrade.entryPrice, priceDecimals)} ({formatBrasiliaTime(selectedTrade.entryTs)})
            </span>
            {selectedTrade.exitPrice !== undefined && (
              <span className="font-mono text-[#8b9bb4]">
                → Saída: {formatPrice(selectedTrade.exitPrice, priceDecimals)} ({formatBrasiliaTime(selectedTrade.exitTs)})
              </span>
            )}
            {selectedTrade.pnl !== undefined && (
              <span
                className={`font-mono font-semibold ${
                  selectedTrade.pnl >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'
                }`}
              >
                {formatMoney(selectedTrade.pnl, currency, true)}
              </span>
            )}
            {(selectedTrade.entry_reason || selectedTrade.exit_reason) && (
              <span className="text-[#8b9bb4]">
                · {selectedTrade.entry_reason}
                {selectedTrade.exit_reason ? ` → ${selectedTrade.exit_reason}` : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedTrade.client_order_id && onInspectOrderId && (
              <button
                type="button"
                onClick={() => onInspectOrderId(selectedTrade.client_order_id!)}
                className="rounded-md border border-[#30363d] bg-[#21262d] px-2.5 py-1 text-[11px] font-medium text-[#7aa2f7] hover:bg-[#30363d]"
              >
                Ver na Timeline ({selectedTrade.client_order_id})
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedTrade(null)}
              className="text-[11px] text-[#8b9bb4] hover:text-[#e6edf3]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
