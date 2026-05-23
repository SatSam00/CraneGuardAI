/**
 * Module 3B: Operator Fatigue Monitor
 * Connects to /ws/fatigue — works in both live and simulation mode.
 * Includes an embedded demo video section explaining the feature.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertTriangle, Activity, Clock, Wifi, WifiOff, PlayCircle, Info } from 'lucide-react';
import { WS_URL } from '../config';

// ── Gauge component ──────────────────────────────────────────────────────────
const MetricGauge = ({ label, value, max = 1, unit = '', danger = false, warning = false }) => {
  const pct   = Math.min(100, Math.max(0, (value / max) * 100));
  const color = danger ? '#ef4444' : warning ? '#f59e0b' : '#14b8a6';
  const displayVal = typeof value === 'number'
    ? (unit === '%' ? (value * 100).toFixed(1) : value.toFixed(3))
    : value;

  return (
    <div className="bg-black/20 rounded-xl p-4 border border-white/5">
      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-2xl font-bold mb-2" style={{ color }}>
        {displayVal}{unit}
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: `${pct}%` }}
          transition={{ ease: 'linear', duration: 0.15 }}
        />
      </div>
    </div>
  );
};

// ── Demo video panel ─────────────────────────────────────────────────────────
const DEMO_STEPS = [
  { icon: '👁️', title: 'EAR Tracking', desc: 'Eye Aspect Ratio measured 10× per second. Below 0.22 = eyes closed.' },
  { icon: '📊', title: 'PERCLOS Metric', desc: '% of frames with closed eyes in a rolling 60s window. ≥35% triggers alert.' },
  { icon: '⏱️', title: 'Micro-sleep Detection', desc: 'Continuous closure ≥2 seconds fires an immediate CRITICAL alert.' },
  { icon: '🚨', title: 'Alert & Logging', desc: 'Alert flashes on screen, gets logged to incident table, 30s cooldown prevents spam.' },
];

function DemoVideoPanel() {
  const [activeStep, setActiveStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  // Cycle through steps while "playing"
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setActiveStep(s => (s + 1) % DEMO_STEPS.length);
    }, 2500);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/30 backdrop-blur">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 bg-white/3">
        <PlayCircle size={16} className="text-teal-400" />
        <span className="text-[11px] font-mono uppercase tracking-widest text-teal-400">How Fatigue Detection Works</span>
        <button
          onClick={() => setPlaying(p => !p)}
          className={`ml-auto text-[10px] font-mono px-3 py-1 rounded border transition-all ${
            playing
              ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
              : 'border-teal-500/30 text-teal-400 bg-teal-500/10 hover:bg-teal-500/20'
          }`}
        >
          {playing ? '⏸ Pause' : '▶ Animate'}
        </button>
      </div>

      {/* Step cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {DEMO_STEPS.map((step, i) => (
          <motion.div
            key={i}
            onClick={() => { setActiveStep(i); setPlaying(false); }}
            animate={{
              borderColor: activeStep === i ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.05)',
              backgroundColor: activeStep === i ? 'rgba(20,184,166,0.08)' : 'rgba(0,0,0,0.2)',
              scale: activeStep === i ? 1.02 : 1,
            }}
            transition={{ duration: 0.25 }}
            className="rounded-xl p-3 cursor-pointer border"
          >
            <div className="text-2xl mb-2">{step.icon}</div>
            <div className="text-[11px] font-bold text-white mb-1">{step.title}</div>
            <div className="text-[10px] text-slate-400 leading-relaxed">{step.desc}</div>
          </motion.div>
        ))}
      </div>

      {/* Visual EAR demo bar */}
      <div className="px-5 pb-5">
        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
          <div className="text-[10px] font-mono text-slate-500 mb-3 uppercase tracking-widest">
            Live EAR Simulation Reference
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-red-400 w-16">0.00 SLEEP</span>
            <div className="flex-1 h-3 rounded-full bg-gradient-to-r from-red-600 via-amber-500 to-teal-500 relative">
              {/* Threshold markers */}
              <div className="absolute top-0 bottom-0 w-px bg-white/60" style={{ left: `${(0.22/0.45)*100}%` }}>
                <span className="absolute -top-5 -translate-x-1/2 text-[9px] font-mono text-white whitespace-nowrap">0.22</span>
              </div>
              <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${(0.28/0.45)*100}%` }}>
                <span className="absolute -top-5 -translate-x-1/2 text-[9px] font-mono text-amber-400 whitespace-nowrap">0.28</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-teal-400 w-16 text-right">0.45 AWAKE</span>
          </div>
          <div className="flex justify-between mt-1 text-[9px] font-mono text-slate-500">
            <span>← CLOSED (Alert)</span>
            <span>DROWSY →</span>
            <span>← ALERT</span>
          </div>
        </div>
      </div>

      {/* Info note */}
      <div className="px-5 pb-4 flex items-start gap-2">
        <Info size={12} className="text-slate-500 mt-0.5 shrink-0" />
        <p className="text-[10px] font-mono text-slate-500">
          The live feed below uses your webcam + MediaPipe FaceMesh when available, 
          or runs in <span className="text-teal-400">SIMULATION MODE</span> with a synthetic operator avatar to demonstrate the detection cycle.
        </p>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function FatigueMonitor() {
  const [connected, setConnected] = useState(false);
  const [frame, setFrame]         = useState(null);
  const [fatigue, setFatigue]     = useState(null);
  const [alertLog, setAlertLog]   = useState([]);
  const [wsError, setWsError]     = useState(null);
  const [isSimulation, setIsSimulation] = useState(false);
  const wsRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    setWsError(null);
    const ws = new WebSocket(`${WS_URL}/ws/fatigue`);
    wsRef.current = ws;

    ws.onopen  = () => { setConnected(true); setWsError(null); };
    ws.onclose = () => { setConnected(false); };
    ws.onerror = () => setWsError('WebSocket connection failed. Is the backend running on port 8200?');

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.error) { setWsError(data.error); return; }
        setFrame(`data:image/jpeg;base64,${data.frame}`);
        setFatigue(data);
        setIsSimulation(!!data.simulation);
        if (data.alert) {
          const ts = new Date(data.timestamp).toLocaleTimeString();
          setAlertLog(prev => [
            { type: data.alert_type, time: ts, ear: data.ear, perclos: data.perclos },
            ...prev.slice(0, 49),
          ]);
        }
      } catch (_) {}
    };
  }, []);

  useEffect(() => { connect(); return () => wsRef.current?.close(); }, [connect]);

  const earDanger    = fatigue && fatigue.ear < 0.22;
  const earWarn      = fatigue && fatigue.ear < 0.28;
  const perclosDanger = fatigue && fatigue.perclos > 0.35;
  const perclosWarn  = fatigue && fatigue.perclos > 0.25;
  const isAlert      = fatigue?.alert;
  const phase = fatigue ? (
    earDanger ? 'MICRO-SLEEP' : earWarn ? 'DROWSY' : 'ALERT'
  ) : '—';
  const phaseColor = earDanger ? '#ef4444' : earWarn ? '#f59e0b' : '#14b8a6';

  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto">

      {/* Header */}
      <div className="p-4 md:p-5 border-b border-white/5 bg-black/40 backdrop-blur flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <Eye size={20} className="text-teal-400" />
          <h2 className="text-base font-bold text-white tracking-widest uppercase">Fatigue Monitor</h2>
          <span className={`text-[9px] font-mono border px-2 py-0.5 rounded-full uppercase ${
            connected ? 'text-teal-500 border-teal-500/30' : 'text-slate-500 border-slate-500/30'
          }`}>
            {connected ? '● Live' : '○ Off'}
          </span>
          {isSimulation && connected && (
            <span className="text-[9px] font-mono border px-2 py-0.5 rounded-full uppercase text-amber-400 border-amber-500/30">
              ⚡ Sim Mode
            </span>
          )}
        </div>
        <button
          onClick={connect}
          className="text-[10px] font-mono uppercase tracking-widest px-3 py-2 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors flex items-center gap-2"
        >
          {connected ? <WifiOff size={13} /> : <Wifi size={13} />}
          {connected ? 'Reconnect' : 'Connect'}
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-4 p-4 md:p-5">

        {/* Demo section */}
        <DemoVideoPanel />

        {/* Error banner */}
        <AnimatePresence>
          {wsError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3"
            >
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <span className="text-[11px] font-mono text-red-400">{wsError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main split: camera + metrics */}
        <div className="grid md:grid-cols-[1fr_320px] gap-4">

          {/* Camera feed */}
          <div className="relative bg-black rounded-2xl overflow-hidden border border-white/5 min-h-[260px] flex items-center justify-center">
            <AnimatePresence>
              {isAlert && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [1, 0.3, 1], transition: { repeat: Infinity, duration: 0.6 } }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 border-4 border-red-500 rounded-2xl pointer-events-none z-10"
                />
              )}
            </AnimatePresence>

            {frame ? (
              <img src={frame} alt="Operator Cabin" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center opacity-40 p-8">
                <EyeOff size={44} className="mx-auto mb-3 text-slate-500" />
                <p className="text-xs font-mono text-slate-500">
                  {connected ? 'Receiving stream…' : 'Awaiting connection…'}
                </p>
              </div>
            )}

            {/* In-frame badge */}
            {fatigue && (
              <div className="absolute bottom-3 left-3 flex gap-2 text-[10px] font-mono">
                <span className={`px-2 py-1 rounded ${earDanger ? 'bg-red-600' : earWarn ? 'bg-amber-600' : 'bg-black/60'} text-white`}>
                  EAR {fatigue.ear?.toFixed(3)}
                </span>
                {fatigue.closed_duration > 0.5 && (
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ repeat: Infinity, duration: 0.7 }}
                    className="px-2 py-1 rounded bg-red-600/80 text-white"
                  >
                    CLOSED {fatigue.closed_duration?.toFixed(1)}s
                  </motion.span>
                )}
              </div>
            )}

            {/* Phase badge */}
            {fatigue && (
              <div className="absolute top-3 right-3">
                <motion.div
                  animate={{ backgroundColor: phaseColor + '22', borderColor: phaseColor + '66' }}
                  className="px-3 py-1 rounded-full border text-[10px] font-mono font-bold"
                  style={{ color: phaseColor }}
                >
                  {phase}
                </motion.div>
              </div>
            )}
          </div>

          {/* Right panel: gauges + alert log */}
          <div className="flex flex-col gap-3">
            <MetricGauge
              label="Eye Aspect Ratio (EAR)"
              value={fatigue?.ear ?? 0}
              max={0.45}
              danger={earDanger}
              warning={earWarn}
            />
            <MetricGauge
              label="PERCLOS (eyes closed %)"
              value={fatigue?.perclos ?? 0}
              max={1}
              unit="%"
              danger={perclosDanger}
              warning={perclosWarn}
            />
            <MetricGauge
              label="Continuous Closure"
              value={fatigue?.closed_duration ?? 0}
              max={4}
              unit="s"
              danger={(fatigue?.closed_duration ?? 0) >= 2}
              warning={(fatigue?.closed_duration ?? 0) >= 1}
            />

            {/* Thresholds */}
            <div className="bg-black/20 rounded-xl p-3 border border-white/5 text-[10px] font-mono text-slate-400 flex flex-col gap-1">
              <span className="text-slate-500 uppercase tracking-widest text-[9px] mb-1">Thresholds</span>
              <span>• EAR &lt; 0.22 → Eyes <span className="text-red-400">CLOSED</span></span>
              <span>• Closed ≥ 2.0s → <span className="text-red-400">EAR_CLOSURE</span> alert</span>
              <span>• PERCLOS ≥ 35% → <span className="text-amber-400">PERCLOS</span> alert</span>
              <span>• Cooldown: 30s between alerts</span>
            </div>

            {/* Alert log */}
            <div className="flex-1 bg-black/20 rounded-xl border border-white/5 overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b border-white/5 text-[9px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Clock size={10} /> Alert Log
                {alertLog.length > 0 && (
                  <span className="ml-auto text-red-400">{alertLog.length}</span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                {alertLog.length === 0 ? (
                  <div className="text-center opacity-30 mt-4">
                    <Activity size={20} className="mx-auto mb-2 text-slate-500" />
                    <p className="text-[10px] font-mono text-slate-500">No alerts yet</p>
                  </div>
                ) : (
                  alertLog.map((a, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-[10px] font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={9} className="text-red-400" />
                        <span className="text-red-400 font-bold">{a.type?.replace('_', ' ')}</span>
                        <span className="text-slate-500 ml-auto">{a.time}</span>
                      </div>
                      <div className="text-slate-400 mt-1">
                        EAR: {a.ear?.toFixed(3)} | PERCLOS: {(a.perclos * 100).toFixed(1)}%
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
