'use client';

import React, { useState } from 'react';
import { 
  TrendingUp, 
  Layers, 
  CircleDot, 
  Coffee, 
  CreditCard, 
  Calendar, 
  Sparkles, 
  Activity, 
  Clock, 
  ArrowUpRight,
  Filter,
  Flame,
  CheckCircle2
} from 'lucide-react';

export interface ChartDataPoint {
  date: string;
  fullDate?: string;
  isoDate?: string;
  totalSales: number;
  poolSales: number;
  snookerSales: number;
  tableSales: number;
  cafeSales: number;
  foodSales?: number;
  drinksSales?: number;
  cigarettesSales?: number;
  creditSales: number;
  tableHours: number;
}

export interface AnalyticsLineChartsProps {
  data: {
    periodLabel?: string;
    chartData?: ChartDataPoint[];
    dailyTrend?: any[];
    chartSummary?: {
      totalSales: number;
      snookerSales: number;
      poolSales: number;
      tableSales: number;
      cafeSales: number;
      creditSales: number;
    };
    categoryRevenue?: {
      billiards: number;
      cafe: number;
      drinks: number;
      cigarettes: number;
      other: number;
    };
  };
  onSelectDate?: (isoDate: string) => void;
}

type MetricKey = 'all' | 'total' | 'billiards' | 'cafe' | 'credit';

export const AnalyticsLineCharts: React.FC<AnalyticsLineChartsProps> = ({ data, onSelectDate }) => {
  const [activeTab, setActiveTab] = useState<MetricKey>('all');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Normalize points sorted chronologically
  const points: ChartDataPoint[] = React.useMemo(() => {
    if (data.chartData && data.chartData.length > 0) {
      return data.chartData;
    }
    if (data.dailyTrend && data.dailyTrend.length > 0) {
      return data.dailyTrend
        .slice()
        .reverse()
        .map(d => ({
          date: d.date,
          fullDate: d.date,
          isoDate: d.isoDate,
          totalSales: d.total || 0,
          poolSales: d.poolRev || 0,
          snookerSales: d.snookerRev || 0,
          tableSales: d.tableRev || 0,
          cafeSales: d.cafeRev || d.menuRev || 0,
          foodSales: 0,
          drinksSales: 0,
          cigarettesSales: 0,
          creditSales: d.creditRev || 0,
          tableHours: d.tableHours || 0
        }));
    }
    return [];
  }, [data.chartData, data.dailyTrend]);

  // Totals calculation
  const totals = React.useMemo(() => {
    if (data.chartSummary) {
      return data.chartSummary;
    }
    return points.reduce((acc, p) => ({
      totalSales: acc.totalSales + p.totalSales,
      snookerSales: acc.snookerSales + p.snookerSales,
      poolSales: acc.poolSales + p.poolSales,
      tableSales: acc.tableSales + p.tableSales,
      cafeSales: acc.cafeSales + p.cafeSales,
      creditSales: acc.creditSales + p.creditSales
    }), {
      totalSales: 0,
      snookerSales: 0,
      poolSales: 0,
      tableSales: 0,
      cafeSales: 0,
      creditSales: 0
    });
  }, [data.chartSummary, points]);

  if (!points || points.length === 0) {
    return null;
  }

  // SVG Chart Geometry
  const svgWidth = 840;
  const svgHeight = 280;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 40;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Determine Max Y value based on activeTab
  const maxY = React.useMemo(() => {
    let max = 0;
    for (const p of points) {
      if (activeTab === 'all' || activeTab === 'total') {
        max = Math.max(max, p.totalSales, p.tableSales, p.cafeSales, p.creditSales);
      } else if (activeTab === 'billiards') {
        max = Math.max(max, p.snookerSales, p.poolSales, p.tableSales);
      } else if (activeTab === 'cafe') {
        max = Math.max(max, p.cafeSales);
      } else if (activeTab === 'credit') {
        max = Math.max(max, p.creditSales);
      }
    }
    // Round to nearest sensible boundary
    if (max <= 500) return 500;
    if (max <= 1000) return 1000;
    if (max <= 2500) return 2500;
    if (max <= 5000) return 5000;
    if (max <= 10000) return 10000;
    return Math.ceil(max / 5000) * 5000;
  }, [points, activeTab]);

  const getYCoord = (val: number) => {
    const clamped = Math.max(0, val);
    return padTop + plotHeight - (clamped / maxY) * plotHeight;
  };

  const getXCoord = (index: number) => {
    if (points.length <= 1) return padLeft + plotWidth / 2;
    return padLeft + (index / (points.length - 1)) * plotWidth;
  };

  // Generate Clean Linear Path (Professional Financial / SaaS Analytics Style - No Childish Curves)
  const buildSmoothPath = (values: number[]) => {
    if (values.length === 0) return '';
    const pts = values.map((v, i) => ({ x: getXCoord(i), y: getYCoord(v) }));
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      path += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }
    return path;
  };

  const buildAreaPath = (values: number[]) => {
    const linePath = buildSmoothPath(values);
    if (!linePath) return '';
    const lastX = getXCoord(values.length - 1).toFixed(1);
    const firstX = getXCoord(0).toFixed(1);
    const bottomY = (padTop + plotHeight).toFixed(1);
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  // Generate Local Sparkline Linear Paths (Scaled strictly to micro-card viewBox - No Curves)
  const buildSparklinePath = (values: number[], w = 200, h = 42, customMax?: number) => {
    if (!values || values.length === 0) return '';
    const padX = 6;
    const padY = 6;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;
    const peak = customMax ?? Math.max(...values, 0);

    const pts = values.map((v, i) => {
      const x = values.length <= 1 ? w / 2 : padX + (i / (values.length - 1)) * plotW;
      const y = peak > 0 ? (padY + plotH) - (Math.max(0, v) / peak) * plotH : (padY + plotH);
      return { x, y };
    });

    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      path += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }
    return path;
  };

  const buildSparklineArea = (values: number[], w = 200, h = 42, customMax?: number) => {
    const line = buildSparklinePath(values, w, h, customMax);
    if (!line) return '';
    const padX = 6;
    const lastX = values.length <= 1 ? (w / 2).toFixed(1) : (w - padX).toFixed(1);
    const firstX = values.length <= 1 ? (w / 2).toFixed(1) : padX.toFixed(1);
    return `${line} L ${lastX} ${h} L ${firstX} ${h} Z`;
  };

  // Series Values
  const totalSeries = points.map(p => p.totalSales);
  const snookerSeries = points.map(p => p.snookerSales);
  const poolSeries = points.map(p => p.poolSales);
  const cafeSeries = points.map(p => p.cafeSales);
  const creditSeries = points.map(p => p.creditSales);

  // Y-Axis Ticks (4 intervals)
  const yTicks = [0, maxY * 0.25, maxY * 0.5, maxY * 0.75, maxY];

  // X-Axis Display Labels Filter (max ~8 labels)
  const xStep = Math.max(1, Math.ceil(points.length / 8));
  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="space-y-6">

      {/* ========================================================================= */}
      {/* 1. MASTER INTERACTIVE MULTI-LINE VISUAL INTELLIGENCE GRAPH                */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
        
        {/* Header with Title and Mode Filter Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-slate-900 text-white shadow-2xs">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-display">
                Revenue &amp; Credit Performance Trajectory
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Interactive line trends for Total Revenue, Snooker vs Pool station play, Cafe orders &amp; Credit extended
            </p>
          </div>

          {/* Metric Selector Pills */}
          <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 self-start lg:self-auto">
            {[
              { id: 'all', label: 'All Series (Compare)' },
              { id: 'total', label: 'Overall Total' },
              { id: 'billiards', label: 'Snooker vs Pool' },
              { id: 'cafe', label: 'Cafe Sales' },
              { id: 'credit', label: 'Credits Extended' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as MetricKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period Totals Ribbon / Legends */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Legend 1: Overall Total */}
          <div 
            onClick={() => setActiveTab('total')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'total'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white border-slate-200/90 text-slate-800 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 rounded-full shrink-0 ${activeTab === 'total' ? 'bg-slate-300' : 'bg-slate-900'}`} />
              <span className={activeTab === 'total' ? 'text-slate-300' : 'text-slate-500'}>Overall Total</span>
            </div>
            <p className={`text-lg font-black font-mono mt-1 ${activeTab === 'total' ? 'text-white' : 'text-slate-900'}`}>
              ₹{totals.totalSales.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Legend 2: Mid Snooker */}
          <div 
            onClick={() => setActiveTab('billiards')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'billiards'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white border-slate-200/90 text-slate-800 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 rounded-full shrink-0 ${activeTab === 'billiards' ? 'bg-indigo-300' : 'bg-indigo-500'}`} />
              <span className={activeTab === 'billiards' ? 'text-slate-300' : 'text-slate-500'}>Mid Snooker</span>
            </div>
            <p className={`text-lg font-black font-mono mt-1 ${activeTab === 'billiards' ? 'text-white' : 'text-slate-900'}`}>
              ₹{totals.snookerSales.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Legend 3: Pool Tables */}
          <div 
            onClick={() => setActiveTab('billiards')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'billiards'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white border-slate-200/90 text-slate-800 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 rounded-full shrink-0 ${activeTab === 'billiards' ? 'bg-teal-300' : 'bg-teal-600'}`} />
              <span className={activeTab === 'billiards' ? 'text-slate-300' : 'text-slate-500'}>Pool Tables</span>
            </div>
            <p className={`text-lg font-black font-mono mt-1 ${activeTab === 'billiards' ? 'text-white' : 'text-slate-900'}`}>
              ₹{totals.poolSales.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Legend 4: Cafe & Drinks */}
          <div 
            onClick={() => setActiveTab('cafe')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'cafe'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white border-slate-200/90 text-slate-800 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 rounded-full shrink-0 ${activeTab === 'cafe' ? 'bg-amber-300' : 'bg-amber-600'}`} />
              <span className={activeTab === 'cafe' ? 'text-slate-300' : 'text-slate-500'}>Cafe Sales</span>
            </div>
            <p className={`text-lg font-black font-mono mt-1 ${activeTab === 'cafe' ? 'text-white' : 'text-slate-900'}`}>
              ₹{totals.cafeSales.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Legend 5: Credit Extended */}
          <div 
            onClick={() => setActiveTab('credit')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'credit'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white border-slate-200/90 text-slate-800 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 rounded-full shrink-0 ${activeTab === 'credit' ? 'bg-rose-300' : 'bg-rose-600'}`} />
              <span className={activeTab === 'credit' ? 'text-slate-300' : 'text-slate-500'}>Credits Extended</span>
            </div>
            <p className={`text-lg font-black font-mono mt-1 ${activeTab === 'credit' ? 'text-white' : 'text-slate-900'}`}>
              ₹{totals.creditSales.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* SVG Interactive Line Chart Canvas */}
        <div className="relative w-full overflow-hidden bg-slate-50/50 rounded-2xl border border-slate-100 p-2 sm:p-4 select-none">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              {/* Executive Muted Gradients (Ultra subtle, no neon brightness) */}
              <linearGradient id="grad-total" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="grad-snooker" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#475569" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#475569" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="grad-pool" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d9488" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="grad-cafe" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b45309" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="grad-credit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#991b1b" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#991b1b" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Labels */}
            {yTicks.map((val, idx) => {
              const y = getYCoord(val);
              return (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={svgWidth - padRight}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray={idx === 0 ? '0' : '4 4'}
                    strokeWidth={idx === 0 ? '1.5' : '1'}
                  />
                  <text
                    x={padLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fontWeight="600"
                    fill="#94a3b8"
                    fontFamily="monospace"
                  >
                    ₹{val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : val.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Area Fills Under Active Lines */}
            {(activeTab === 'total' || activeTab === 'all') && (
              <path d={buildAreaPath(totalSeries)} fill="url(#grad-total)" />
            )}
            {(activeTab === 'billiards') && (
              <>
                <path d={buildAreaPath(snookerSeries)} fill="url(#grad-snooker)" />
                <path d={buildAreaPath(poolSeries)} fill="url(#grad-pool)" />
              </>
            )}
            {(activeTab === 'cafe') && (
              <path d={buildAreaPath(cafeSeries)} fill="url(#grad-cafe)" />
            )}
            {(activeTab === 'credit') && (
              <path d={buildAreaPath(creditSeries)} fill="url(#grad-credit)" />
            )}

            {/* Professional Linear Stroke Lines (Muted Executive Palette) */}
            {/* 1. Cafe Line (Muted Warm Amber) */}
            {(activeTab === 'all' || activeTab === 'cafe') && (
              <path
                d={buildSmoothPath(cafeSeries)}
                fill="none"
                stroke="#b45309"
                strokeWidth={activeTab === 'cafe' ? 2 : 1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* 2. Pool Line (Muted Teal) */}
            {(activeTab === 'all' || activeTab === 'billiards') && (
              <path
                d={buildSmoothPath(poolSeries)}
                fill="none"
                stroke="#0d9488"
                strokeWidth={activeTab === 'billiards' ? 2 : 1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* 3. Snooker Line (Muted Slate-Steel) */}
            {(activeTab === 'billiards' || activeTab === 'all') && (
              <path
                d={buildSmoothPath(snookerSeries)}
                fill="none"
                stroke="#64748b"
                strokeWidth={activeTab === 'billiards' ? 2 : 1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* 4. Credit Line (Muted Dark Crimson - Dashed) */}
            {(activeTab === 'all' || activeTab === 'credit') && (
              <path
                d={buildSmoothPath(creditSeries)}
                fill="none"
                stroke="#991b1b"
                strokeWidth={activeTab === 'credit' ? 2 : 1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="4 4"
              />
            )}

            {/* 5. Overall Total Sales (Deep Slate 900 - Master Clean Line) */}
            {(activeTab === 'all' || activeTab === 'total') && (
              <path
                d={buildSmoothPath(totalSeries)}
                fill="none"
                stroke="#0f172a"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Point Nodes (Clean vertex circles on real data points) */}
            {points.length <= 31 && points.map((_, i) => {
              const x = getXCoord(i);
              const isHov = hoverIndex === i;
              return (
                <g key={`node-${i}`} className="pointer-events-none">
                  {(activeTab === 'all' || activeTab === 'total') && (
                    <circle
                      cx={x}
                      cy={getYCoord(totalSeries[i])}
                      r={isHov ? 4.5 : 2.5}
                      fill="#0f172a"
                      stroke="#ffffff"
                      strokeWidth={isHov ? 2 : 1.5}
                    />
                  )}
                  {activeTab === 'billiards' && (
                    <>
                      <circle
                        cx={x}
                        cy={getYCoord(snookerSeries[i])}
                        r={isHov ? 4.5 : 2.5}
                        fill="#64748b"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                      <circle
                        cx={x}
                        cy={getYCoord(poolSeries[i])}
                        r={isHov ? 4.5 : 2.5}
                        fill="#0d9488"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    </>
                  )}
                  {activeTab === 'cafe' && (
                    <circle
                      cx={x}
                      cy={getYCoord(cafeSeries[i])}
                      r={isHov ? 4.5 : 2.5}
                      fill="#b45309"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  )}
                  {activeTab === 'credit' && (
                    <circle
                      cx={x}
                      cy={getYCoord(creditSeries[i])}
                      r={isHov ? 4.5 : 2.5}
                      fill="#991b1b"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  )}
                </g>
              );
            })}

            {/* Vertical Indicator on Hover */}
            {hoverIndex !== null && (
              <g>
                <line
                  x1={getXCoord(hoverIndex)}
                  y1={padTop}
                  x2={getXCoord(hoverIndex)}
                  y2={padTop + plotHeight}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                {/* Dots on the active series */}
                {(activeTab === 'all' || activeTab === 'total') && (
                  <circle
                    cx={getXCoord(hoverIndex)}
                    cy={getYCoord(totalSeries[hoverIndex])}
                    r="4.5"
                    fill="#0f172a"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                )}
                {(activeTab === 'all' || activeTab === 'billiards') && (
                  <>
                    <circle
                      cx={getXCoord(hoverIndex)}
                      cy={getYCoord(snookerSeries[hoverIndex])}
                      r="4"
                      fill="#64748b"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={getXCoord(hoverIndex)}
                      cy={getYCoord(poolSeries[hoverIndex])}
                      r="4"
                      fill="#0d9488"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </>
                )}
                {(activeTab === 'all' || activeTab === 'cafe') && (
                  <circle
                    cx={getXCoord(hoverIndex)}
                    cy={getYCoord(cafeSeries[hoverIndex])}
                    r="4"
                    fill="#b45309"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
                {(activeTab === 'all' || activeTab === 'credit') && (
                  <circle
                    cx={getXCoord(hoverIndex)}
                    cy={getYCoord(creditSeries[hoverIndex])}
                    r="4"
                    fill="#991b1b"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            )}

            {/* X-Axis Dates */}
            {points.map((p, idx) => {
              if (idx % xStep !== 0 && idx !== points.length - 1) return null;
              const x = getXCoord(idx);
              return (
                <text
                  key={idx}
                  x={x}
                  y={padTop + plotHeight + 20}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="#64748b"
                >
                  {p.date}
                </text>
              );
            })}

            {/* Hover Detection Overlay Slices */}
            {points.map((p, idx) => {
              const x = getXCoord(idx);
              const sliceWidth = plotWidth / points.length;
              return (
                <rect
                  key={idx}
                  x={x - sliceWidth / 2}
                  y={padTop}
                  width={sliceWidth}
                  height={plotHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(idx)}
                  onClick={() => {
                    if (p.isoDate && onSelectDate) {
                      onSelectDate(p.isoDate);
                    }
                  }}
                />
              );
            })}
          </svg>

          {/* Floating Hover Tooltip Card */}
          {hoveredPoint && hoverIndex !== null && (
            <div
              className="absolute z-30 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-xl border border-slate-700/80 text-xs space-y-2 min-w-[210px] animate-in fade-in zoom-in-95 duration-100"
              style={{
                left: `${Math.min(
                  80,
                  Math.max(10, ((getXCoord(hoverIndex) / svgWidth) * 100))
                )}%`,
                top: '15px'
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 font-bold">
                <span className="text-slate-200">{hoveredPoint.fullDate || hoveredPoint.date}</span>
                <span className="text-[10px] font-mono text-indigo-400">
                  {hoveredPoint.tableHours > 0 ? `${hoveredPoint.tableHours}h play` : '0h play'}
                </span>
              </div>

              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between items-center text-indigo-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    Overall Total:
                  </span>
                  <span>₹{hoveredPoint.totalSales.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-purple-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Mid Snooker:
                  </span>
                  <span>₹{hoveredPoint.snookerSales.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Pool Tables:
                  </span>
                  <span>₹{hoveredPoint.poolSales.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Cafe Sales:
                  </span>
                  <span>₹{hoveredPoint.cafeSales.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-rose-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    Credit Issued:
                  </span>
                  <span>₹{hoveredPoint.creditSales.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-800 text-[9px] text-slate-400 flex items-center justify-between">
                <span>Click point to filter date</span>
                <ArrowUpRight className="w-3 h-3 text-slate-400" />
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. FOUR DEDICATED INDIVIDUAL LINE CARDS                                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Card 1: Overall Lounge Total Sales */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Overall Total Sales
              </span>
              <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900 font-display">
                ₹{totals.totalSales.toLocaleString('en-IN')}
              </span>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Full lounge revenue billed
              </p>
            </div>
          </div>

          {/* Micro Sparkline */}
          <div className="pt-2 border-t border-slate-100">
            <svg viewBox="0 0 200 42" className="w-full h-10 overflow-hidden">
              <defs>
                <linearGradient id="spark-total" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d={buildSparklineArea(totalSeries, 200, 42)}
                fill="url(#spark-total)"
              />
              <path
                d={buildSparklinePath(totalSeries, 200, 42)}
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1">
              <span>{points[0]?.date}</span>
              <span>{points[points.length - 1]?.date}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Mid Snooker & Pool Stations */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Snooker &amp; Pool Stations
              </span>
              <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                <Layers className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900 font-display">
                ₹{(totals.snookerSales + totals.poolSales).toLocaleString('en-IN')}
              </span>
              <div className="flex items-center gap-2 text-xs font-semibold mt-0.5">
                <span className="text-slate-600 font-bold">
                  Snooker: ₹{totals.snookerSales.toLocaleString('en-IN')}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-teal-700 font-bold">
                  Pool: ₹{totals.poolSales.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Dual Micro Sparkline */}
          <div className="pt-2 border-t border-slate-100">
            <svg viewBox="0 0 200 42" className="w-full h-10 overflow-hidden">
              <path
                d={buildSparklinePath(snookerSeries, 200, 42, Math.max(...snookerSeries, ...poolSeries, 1))}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              <path
                d={buildSparklinePath(poolSeries, 200, 42, Math.max(...snookerSeries, ...poolSeries, 1))}
                fill="none"
                stroke="#0d9488"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1">
              <span className="text-slate-600 font-bold">● Snooker</span>
              <span className="text-teal-700 font-bold">● Pool</span>
            </div>
          </div>
        </div>

        {/* Card 3: Cafe & Kitchen Sales */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Cafe &amp; Kitchen Sales
              </span>
              <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                <Coffee className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900 font-display">
                ₹{totals.cafeSales.toLocaleString('en-IN')}
              </span>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Food, shakes &amp; cold beverages
              </p>
            </div>
          </div>

          {/* Micro Sparkline */}
          <div className="pt-2 border-t border-slate-100">
            <svg viewBox="0 0 200 42" className="w-full h-10 overflow-hidden">
              <defs>
                <linearGradient id="spark-cafe" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b45309" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#b45309" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d={buildSparklineArea(cafeSeries, 200, 42)}
                fill="url(#spark-cafe)"
              />
              <path
                d={buildSparklinePath(cafeSeries, 200, 42)}
                fill="none"
                stroke="#b45309"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1">
              <span>{points[0]?.date}</span>
              <span>{points[points.length - 1]?.date}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Credit Extended (Outstanding Accounts) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Credits Extended
              </span>
              <span className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
                <CreditCard className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900 font-display">
                ₹{totals.creditSales.toLocaleString('en-IN')}
              </span>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                New credit added in period
              </p>
            </div>
          </div>

          {/* Micro Sparkline */}
          <div className="pt-2 border-t border-slate-100">
            <svg viewBox="0 0 200 42" className="w-full h-10 overflow-hidden">
              <defs>
                <linearGradient id="spark-credit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#991b1b" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#991b1b" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d={buildSparklineArea(creditSeries, 200, 42)}
                fill="url(#spark-credit)"
              />
              <path
                d={buildSparklinePath(creditSeries, 200, 42)}
                fill="none"
                stroke="#991b1b"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1">
              <span>{points[0]?.date}</span>
              <span>{points[points.length - 1]?.date}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

