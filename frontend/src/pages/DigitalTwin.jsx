/**
 * Module 3E: Digital Twin Simulation Layer
 * ==========================================
 * Real-time bird's-eye 2D site map rendered with SVG.
 * Polls /twin/state every 200ms and plots:
 *   - Workers (teal dots) with forecast arrows
 *   - Cranes (amber rectangles)
 *   - Safety zones (colored polygons)
 *
 * Supervisors can drag new zones onto the map for "what-if" scenarios.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Cpu, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';

const POLL_MS = 250;

const RISK_COLOR = (score) => {
  if (score >= 0.7) return '#ef4444';
  if (score >= 0.4) return '#f59e0b';
  return '#14b8a6';
};

const ZonePoly = ({ zone, width, height }) => {
  if (!zone.polygon || zone.polygon.length < 3) return null;
  const pts = zone.polygon.map(([nx, ny]) => `${nx * width},${ny * height}`).join(' ');
  const color = zone.danger ? '#ef4444' : zone.active ? '#14b8a6' : '#64748b';
  return (
    <g>
      <polygon
        points={pts}
        fill={`${color}22`}
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={zone.active ? 'none' : '6,4'}
      />
      <text
        x={zone.polygon[0][0] * width}
        y={zone.polygon[0][1] * height - 6}
        fill={color}
        fontSize="10"
        fontFamily="monospace"
        fontWeight="bold"
      >
        {zone.name}
      </text>
    </g>
  );
};

const WorkerDot = ({ worker, width, height }) => {
  const cx = worker.x * width;
  const cy = worker.y * height;
  const color = RISK_COLOR(worker.risk_score || 0);

  return (
    <g>
      {/* Forecast arrow */}
      {worker.forecast_x != null && (
        <line
          x1={cx} y1={cy}
          x2={worker.forecast_x * width}
          y2={worker.forecast_y * height}
          stroke="#c026d3"
          strokeWidth="1.5"
          strokeDasharray="4,3"
          markerEnd="url(#arrowhead)"
        />
      )}
      {/* Worker dot */}
      <circle cx={cx} cy={cy} r={7} fill={color} opacity={0.9} />
      <circle cx={cx} cy={cy} r={11} fill="transparent" stroke={color} strokeWidth="1.5" opacity={0.4} />
      <text x={cx} y={cy - 14} fill={color} fontSize="9" fontFamily="monospace" textAnchor="middle">
        #{worker.id} {worker.risk_score > 0 ? `⚠ ${(worker.risk_score * 100).toFixed(0)}%` : ''}
      </text>
    </g>
  );
};

const CraneDot = ({ crane, width, height }) => {
  const cx = crane.x * width;
  const cy = crane.y * height;
  return (
    <g>
      <rect x={cx - 12} y={cy - 8} width={24} height={16} rx={3}
        fill="#f59e0b22" stroke="#f59e0b" strokeWidth="1.5" />
      <text x={cx} y={cy + 4} fill="#f59e0b" fontSize="8" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
        🏗{crane.id}
      </text>
    </g>
  );
};

export default function DigitalTwin() {
  const [twinState, setTwinState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const svgRef = useRef(null);
  const [svgDims, setSvgDims] = useState({ w: 800, h: 450 });

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setSvgDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    if (svgRef.current) ro.observe(svgRef.current);
    return () => ro.disconnect();
  }, []);

  const fetchTwin = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/twin/state`);
      const data = await res.json();
      setTwinState(data);
      setError(null);
    } catch (e) {
      setError('Backend unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTwin();
    const id = setInterval(fetchTwin, POLL_MS);
    return () => clearInterval(id);
  }, [fetchTwin]);

  const workers = twinState?.workers || [];
  const cranes  = twinState?.cranes  || [];
  const zones   = twinState?.zones   || [];

  const dangerCount  = workers.filter(w => w.risk_score >= 0.7).length;
  const warningCount = workers.filter(w => w.risk_score >= 0.4 && w.risk_score < 0.7).length;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-white/5 bg-card/60 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch size={20} className="text-teal-400" />
            <h2 className="text-lg font-display font-bold text-white tracking-widest uppercase">Digital Twin</h2>
            <span className="text-[9px] font-mono text-teal-500 border border-teal-500/30 px-2 py-0.5 rounded-full uppercase ml-2">
              Live
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1 hidden md:block">
            Bird's-eye site map — real-time normalised coordinate space
          </p>
        </div>

        {/* Stats Bar */}
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-white font-display">{workers.length}</div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Workers</div>
          </div>
          <div className="w-px bg-white/5" />
          <div className="text-center">
            <div className="text-xl font-bold text-amber-400 font-display">{cranes.length}</div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Cranes</div>
          </div>
          <div className="w-px bg-white/5" />
          <div className="text-center">
            <div className={`text-xl font-bold font-display ${dangerCount > 0 ? 'text-red-400' : 'text-teal-400'}`}>
              {dangerCount}
            </div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">High Risk</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-4 py-2 text-[10px] font-mono text-slate-400 border-b border-white/5 bg-card/30 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-teal-500 inline-block"/> Safe Worker</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"/> Warning Risk</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"/> High Risk</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-400/50 border border-amber-400 inline-block"/> Crane</span>
        <span className="flex items-center gap-1.5"><span className="w-12 h-px border border-dashed border-fuchsia-500 inline-block"/> Forecast</span>
      </div>

      {/* SVG Canvas */}
      <div className="flex-1 relative" ref={svgRef}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw size={24} className="text-teal-500 animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center opacity-40">
              <AlertTriangle size={36} className="mx-auto mb-2 text-red-400" />
              <p className="text-xs font-mono text-slate-400">{error}</p>
            </div>
          </div>
        )}
        {!loading && !error && (
          <svg
            width="100%"
            height="100%"
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
          >
            <defs>
              <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="#c026d3" />
              </marker>
              {/* Grid */}
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff08" strokeWidth="0.5" />
              </pattern>
            </defs>

            {/* Background grid */}
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Zones first (bottom layer) */}
            {zones.map((zone, i) => (
              <ZonePoly key={zone.id || i} zone={zone} width={svgDims.w} height={svgDims.h} />
            ))}

            {/* Cranes */}
            {cranes.map(crane => (
              <CraneDot key={crane.id} crane={crane} width={svgDims.w} height={svgDims.h} />
            ))}

            {/* Workers on top */}
            {workers.map(worker => (
              <WorkerDot key={worker.id} worker={worker} width={svgDims.w} height={svgDims.h} />
            ))}

            {/* Timestamp watermark */}
            <text x="8" y={svgDims.h - 8} fill="#ffffff15" fontSize="9" fontFamily="monospace">
              {twinState?.timestamp ? new Date(twinState.timestamp).toLocaleTimeString() : ''}
            </text>
          </svg>
        )}
      </div>
    </div>
  );
}
