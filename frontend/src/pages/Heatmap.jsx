import React, { useState, useEffect } from 'react';
import { useWebSocketData } from '../context/WebSocketContext';
import { clsx } from 'clsx';
import { Loader2, ArrowUpRight } from 'lucide-react';

export default function Heatmap({ selectedZone, onZoneSelect }) {
  const { data: wsData } = useWebSocketData();
  const [stats, setStats] = useState({ distribution: {} });
  const [loading, setLoading] = useState(true);
  const [zoneStatus, setZoneStatus] = useState({});

  // Sync with WebSocket data
  useEffect(() => {
    if (wsData?.stats) {
      setStats(wsData.stats);
      setLoading(false);
    }
    if (wsData?.zone_status) {
      setZoneStatus(wsData.zone_status);
    }
  }, [wsData]);

  const getZoneDisplayData = (zoneId, zoneInfo) => {
    const zoneName = zoneInfo.name || zoneId;
    const count = stats.distribution[zoneName] || stats.distribution[zoneId] || 0;
    
    // Safety Intelligence Tiering:
    let risk = 'low'; // Green (Safe)
    if (zoneInfo.danger || count > 15) risk = 'high'; // Red (Danger)
    else if (zoneInfo.worker_count > 0 || count > 5) risk = 'medium'; // Yellow (Warning)
    
    return { name: zoneName, count, risk, liveData: zoneInfo };
  };

  const getRiskStyles = (risk, liveData) => {
    // 🔴 RED ZONE: Danger (Machine + Human)
    if (liveData?.danger) return 'bg-red-500/60 border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse';
    
    // 🟡 YELLOW ZONE: Warning (Worker presence near idle machine)
    if (liveData?.worker_count > 0 || risk === 'medium') return 'bg-amber-500/40 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-pulse';

    // 🟢 GREEN ZONE: Safe (Nominal)
    if (risk === 'high') return 'bg-red-500/40 border-red-500'; 
    return 'bg-teal-500/5 border-teal-500/10 hover:bg-teal-500/15';
  };

  return (
    <div className="p-8 flex flex-col gap-8 h-full bg-[#0a0c0f] overflow-hidden text-slate-200">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h2 className="text-4xl font-display font-bold text-white tracking-widest leading-none">SPATIAL RISK HEATMAP</h2>
            {selectedZone && (
              <div className="bg-teal-500/20 border border-teal-500/50 px-3 py-1 rounded text-[10px] font-mono text-teal-400 font-bold animate-pulse">
                SYNCED: {selectedZone}
              </div>
            )}
            {/* Added real-time sync indicator */}
            <div className="flex items-center gap-1.5 ml-2">
               <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
               <span className="text-[8px] font-mono text-teal-500/60 uppercase tracking-widest font-bold">Live Stream</span>
            </div>
          </div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em]">Temporal Aggregation of Aisle Violations</p>
        </div>
        
        <div className="flex items-center gap-4">
             <div className="flex flex-col gap-1 items-end mr-4">
                  <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Zone Filter</span>
                  <select 
                    value={selectedZone || ''} 
                    onChange={(e) => onZoneSelect(e.target.value || null)}
                    className="bg-card/50 border border-white/10 rounded px-4 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer backdrop-blur-md"
                  >
                    <option value="">All Zones</option>
                    {Object.keys(stats.distribution).map(z => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
             </div>

             <div className="flex items-center gap-6 bg-card/30 p-4 border border-white/5 rounded-xl backdrop-blur-md">
                  <div className="flex flex-col gap-2">
                       <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest text-right">Risk Gradient</div>
                       <div className="flex gap-4">
                           <div className="flex items-center gap-2 text-[9px] font-mono"><div className="w-2.5 h-2.5 bg-red-500/60 border border-red-400 rounded-sm" /> 🔴 RED: CRITICAL HAZARD (MACHINE ON + HUMAN)</div>
                           <div className="flex items-center gap-2 text-[9px] font-mono"><div className="w-2.5 h-2.5 bg-amber-500/40 border border-amber-400 rounded-sm" /> 🟡 YELLOW: WARNING (IDLE MACHINE + HUMAN)</div>
                           <div className="flex items-center gap-2 text-[9px] font-mono"><div className="w-2.5 h-2.5 bg-teal-500/10 border border-teal-400 rounded-sm" /> 🟢 GREEN: SAFE (NOMINAL)</div>
                       </div>
                  </div>
             </div>
        </div>
      </div>

      <div className="flex-1 bg-card/20 border border-white/5 rounded-2xl p-10 flex flex-col gap-8 relative overflow-hidden shadow-2xl">
        {/* Floor grid background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
             <Loader2 className="animate-spin" size={40} />
             <span className="font-mono text-xs uppercase tracking-widest">Compiling Spatial Data...</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-6 flex-1 max-h-[600px] overflow-y-auto">
            {Object.entries(zoneStatus).map(([id, info]) => {
                const data = getZoneDisplayData(id, info);
                const isSelected = selectedZone === id || selectedZone === data.name || selectedZone === `Zone ${id}`;
                
                return (
                <div 
                    key={id}
                    onClick={() => onZoneSelect(isSelected ? null : data.name)}
                    className={clsx(
                    "group relative rounded-xl border transition-all duration-500 hover:scale-105 hover:z-20 cursor-pointer flex flex-col items-center justify-center overflow-hidden min-h-[160px]",
                    getRiskStyles(data.risk, data.liveData),
                    isSelected ? "ring-2 ring-teal-500 border-teal-500 scale-105 z-10" : "grayscale-[0.2]"
                    )}
                >
                    {/* Live Worker Indicator / Tiered Badge */}
                    {data.liveData?.worker_count > 0 && (
                        <div className={clsx(
                            "absolute top-2 right-2 flex flex-col items-end gap-1 px-2 py-1.5 rounded border shadow-lg backdrop-blur-md",
                            data.liveData.danger ? "bg-red-950/60 border-red-500 ring-2 ring-red-500/20" : "bg-amber-950/40 border-amber-500/50"
                        )}>
                            <div className="flex items-center gap-1.5">
                                <div className={clsx("w-1.5 h-1.5 rounded-full", data.liveData.danger ? "bg-red-500 animate-ping" : "bg-amber-500 animate-pulse")} />
                                <span className={clsx("text-[7px] font-mono font-bold uppercase", data.liveData.danger ? "text-red-100" : "text-amber-100")}>
                                    {data.liveData.danger ? "🔴 CRITICAL HAZARD" : "🟡 WARNING"}
                                </span>
                            </div>
                            {data.liveData.danger && (
                                <span className="text-[5px] font-mono font-bold text-red-300 uppercase tracking-tighter leading-none">MACHINE ON + HUMAN DETECTED</span>
                            )}
                        </div>
                    )}

                    {/* Zone Identifier label */}
                    <div className="absolute top-3 left-3 flex flex-col">
                        <span className={clsx("text-[10px] font-mono font-bold tracking-tighter uppercase", isSelected ? "text-teal-400" : "text-white/40")}>{data.name}</span>
                        <div className={clsx("w-4 h-[1px] mt-1", isSelected ? "bg-teal-500/50" : "bg-white/10")} />
                    </div>

                    {/* Centered Violation Count */}
                    <div className="flex flex-col items-center gap-1 transition-transform group-hover:scale-110">
                        <span className={clsx("text-4xl font-display font-bold", data.count > 0 || isSelected ? "text-white" : "text-white/20")}>
                            {data.count}
                        </span>
                        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.2em] font-bold">Alert Count</span>
                    </div>

                    {/* Interactive Overlay */}
                    <div className="opacity-0 group-hover:opacity-100 absolute inset-0 bg-[#000000ed] backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-4 text-center transition-all duration-300 border border-teal-500/20">
                        <ArrowUpRight className="text-teal-500 absolute top-4 right-4" size={16} />
                        <span className="text-[10px] font-mono text-teal-400 uppercase tracking-widest mb-1 font-bold">{data.name}</span>
                        <div className="h-[1px] w-12 bg-teal-500/20 my-2" />
                        <span className="text-2xl font-display font-bold text-white mb-1">{data.count} ALERTS</span>
                        {data.liveData?.worker_count > 0 && (
                            <p className="text-[8px] font-mono text-amber-500 uppercase tracking-tighter mb-1">Active Worker Present</p>
                        )}
                        <p className="text-[8px] font-mono text-slate-500 leading-tight">Total historical safety violations recorded for this specific zone.</p>
                    </div>
                </div>
                );
            })}
          </div>
        )}

        <div className="flex justify-between items-center mt-auto border-t border-white/5 pt-6 relative z-10">
            <div className="flex items-center gap-4">
               <div className="flex flex-col">
                  <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-1">System Health</span>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                     <span className="text-[10px] font-mono text-teal-500/80 font-bold uppercase tracking-widest">Grid Active</span>
                  </div>
               </div>
               <div className="w-[1px] h-8 bg-white/5 ml-2" />
               <div className="flex flex-col ml-2">
                  <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-1">Last Sample</span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{new Date().toLocaleTimeString()}</span>
               </div>
            </div>
            
            <button className="flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white font-display text-xs font-bold tracking-[0.2em] px-8 py-3 rounded-full border border-white/10 transition-all active:scale-95 shadow-xl">
                EXPORT ARCHITECTURAL DATA
            </button>
        </div>
      </div>
    </div>
  );
}
