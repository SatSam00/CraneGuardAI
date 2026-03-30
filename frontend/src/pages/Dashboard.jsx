import React, { useState, useEffect } from 'react';
import { useWebSocketData } from '../context/WebSocketContext';
import { StatCard } from '../components/StatCard';
import { IncidentTable } from '../components/IncidentTable';
import { AlertBanner } from '../components/AlertBanner';
import { Shield, AlertCircle, ScanEye, Timer, CheckCircle, Loader2 } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { clsx } from 'clsx';

export default function Dashboard({ selectedZone, onZoneSelect }) {
  const { data: wsData, status } = useWebSocketData();
  const [incidents, setIncidents] = useState([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState([]);
  const [stats, setStats] = useState({
      violations: 0,
      score: 100,
      zones: 0,
      reaction: 1.2,
      distribution: {},
      trend: []
  });

  const displayIncidents = incidents
    .filter(inc => !selectedZone || inc.zone_name === selectedZone || inc.zone_id === selectedZone || `Zone ${inc.zone_id}` === selectedZone)
    .map(inc => ({
      ...inc,
      acknowledged: inc.acknowledged || acknowledgedIds.includes(inc.id)
    }));

  const latestUnacknowledged = displayIncidents.find(inc => !inc.acknowledged && !dismissedAlertIds.includes(inc.id));

  // Recalculate local stats based on selection
  useEffect(() => {
    if (wsData?.stats) {
      if (selectedZone) {
        // Focused Stats
        const zoneViolations = wsData.stats.distribution[selectedZone] || 0;
        
        // Calculate trend from filtered incidents for accuracy
        const trendMap = {};
        // Initialize 12h trend buckets (matching backend 2h buckets)
        const now = new Date();
        for (let i = 12; i >= 0; i -= 2) {
            const d = new Date(now.getTime() - i * 60 * 60 * 1000);
            d.setMinutes(0, 0, 0);
            const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            trendMap[label] = { time: label, violations: 0, safety: 100 };
        }

        displayIncidents.forEach(inc => {
            const d = new Date(inc.timestamp);
            d.setMinutes(0, 0, 0);
            const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            if (trendMap[label]) {
                trendMap[label].violations += 1;
                trendMap[label].safety = Math.max(0, 100 - (trendMap[label].violations * 15));
            }
        });

        setStats({
          violations: zoneViolations,
          score: Math.max(0, 100 - (zoneViolations * 10)),
          zones: 1,
          reaction: wsData.stats.avg_reaction_time,
          distribution: { [selectedZone]: zoneViolations },
          trend: Object.values(trendMap).sort((a, b) => a.time.localeCompare(b.time))
        });
      } else {
        // Global Stats
        setStats({
            violations: wsData.stats.today_violations,
            score: wsData.stats.safety_score,
            zones: wsData.stats.monitored_zones || 0,
            reaction: wsData.stats.avg_reaction_time,
            distribution: wsData.stats.distribution || {},
            trend: wsData.stats.trend || []
        });
      }
    }
    
    if (wsData?.incidents) {
      setIncidents(wsData.incidents);
    }
  }, [wsData, selectedZone]);

  if (status !== 'connected' && !wsData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500 h-full bg-[#0a0c0f]">
         <Loader2 className="animate-spin text-teal-500" size={48} />
         <span className="font-mono text-xs uppercase tracking-widest">Awaiting Real-Time Sync...</span>
      </div>
    );
  }

  const handleAcknowledge = async (id) => {
      setAcknowledgedIds(prev => [...prev, id]);
  };

  const chartData = stats.trend.length > 0 ? stats.trend : [
    { time: '08:00', violations: 0, safety: 100 },
    { time: '12:00', violations: 0, safety: 100 },
    { time: '18:00', violations: 0, safety: 100 },
  ];

  return (
    <div className="p-8 flex flex-col gap-8 h-full overflow-y-auto bg-[#0a0c0f] text-slate-200 relative">
      <AlertBanner 
        alerts={latestUnacknowledged ? [`${latestUnacknowledged.type} IN ${latestUnacknowledged.zone_name}`] : []} 
        image={latestUnacknowledged?.frame_url}
        onDismiss={() => {
            const unackIds = displayIncidents.filter(i => !i.acknowledged).map(i => i.id);
            setDismissedAlertIds(prev => [...prev, ...unackIds]);
        }}
      />
      
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
                <h2 className="text-4xl font-display font-bold text-white tracking-widest leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">ANALYTICS DASHBOARD</h2>
                {selectedZone && (
                  <div 
                    onClick={() => onZoneSelect(null)}
                    className="bg-teal-500/20 border border-teal-500/50 px-3 py-1 rounded text-[10px] font-mono text-teal-400 font-bold animate-pulse cursor-pointer hover:bg-teal-500/30 transition-colors flex items-center gap-2"
                  >
                    SYNCED: {selectedZone}
                    <span className="text-[8px] opacity-60">(CLEAR)</span>
                  </div>
                )}
            </div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em]">{selectedZone ? `FILTERED INTELLIGENCE FOR ${selectedZone}` : 'Real-Time Safety Intelligence Matrix'}</p>
        </div>
        <div className="bg-card/50 backdrop-blur-xl px-4 py-2 border border-white/5 rounded-lg flex items-center gap-4 shadow-2xl">
             <div className="flex flex-col items-end">
                <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Global Status</span>
                <span className="text-xs font-bold text-teal-500 uppercase tracking-wider flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                   All Systems Nominal
                </span>
             </div>
             <div className="p-2 bg-teal-500/10 rounded border border-teal-500/20">
                <Shield className="text-teal-500" size={20} />
             </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <StatCard label="TODAY'S VIOLATIONS" value={stats.violations} color="amber" icon={AlertCircle} subtext={selectedZone ? "ZONE SPECIFIC COUNT" : "REAL-TIME EVENT STREAM"} />
        <StatCard label="SAFETY SCORE" value={`${stats.score}%`} color={stats.score > 80 ? 'teal' : 'red'} icon={CheckCircle} subtext="LIVE RELIABILITY RATING" />
        <StatCard label={selectedZone ? "ACTIVE SELECTION" : "MONITORED ZONES"} value={stats.zones} color="slate" icon={ScanEye} subtext={selectedZone ? "FOCUSED VIEW" : "AUTOMATED COVERAGE"} />
        <StatCard label="AVG REACTION TIME" value={`${stats.reaction}s`} color="teal" icon={Timer} subtext="SYSTEM TO ALERT LATENCY" />
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 bg-card/30 backdrop-blur-sm border border-white/5 rounded-2xl p-8 h-[450px] flex flex-col gap-6 shadow-inner">
            <div className="flex justify-between items-center">
                <h3 className="font-display font-bold text-xl tracking-widest text-white uppercase">{selectedZone ? `${selectedZone} TRENDS` : 'SAFETY PERFORMANCE TRENDS'}</h3>
                <div className="flex gap-2">
                   <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                      <div className="w-2 h-2 rounded-full bg-teal-500" /> Operational Safety
                   </div>
                </div>
            </div>
            <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorSafety" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis 
                          dataKey="time" 
                          stroke="#475569" 
                          fontSize={9} 
                          axisLine={false} 
                          tickLine={false} 
                          dy={10}
                        />
                        <YAxis 
                          stroke="#475569" 
                          fontSize={9} 
                          axisLine={false} 
                          tickLine={false} 
                          domain={[0, 100]}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#111418', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px', backdropFilter: 'blur(10px)' }}
                            itemStyle={{ color: '#14b8a6' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="safety" 
                          stroke="#14b8a6" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorSafety)" 
                          animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
        
        <div className="bg-card/30 backdrop-blur-sm border border-white/5 rounded-2xl p-8 h-[450px] flex flex-col gap-8 shadow-inner">
             <h3 className="font-display font-bold text-xl tracking-widest text-white text-center uppercase">{selectedZone ? 'ZONE CONCENTRATION' : 'ZONE DISTRIBUTION'}</h3>
             <div className="flex-1 flex flex-col items-center justify-center relative">
                 <div className="text-center z-10">
                    <div className="text-7xl font-display font-bold text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{stats.violations}</div>
                    <div className="text-[10px] font-mono text-teal-500 uppercase tracking-[0.2em] font-bold">Today's Risk Events</div>
                 </div>
                 {/* Visual indicator ring */}
                 <div className="absolute w-40 h-40 border-4 border-white/5 rounded-full animate-[spin_10s_linear_infinite]" />
                 <div className="absolute w-48 h-48 border border-teal-500/10 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
             </div>
             
             <div className="space-y-6">
                  {Object.entries(stats.distribution).length > 0 ? Object.entries(stats.distribution).map(([label, val]) => {
                      const isSelected = selectedZone === label;
                      return (
                      <div key={label} className={clsx(
                          "group cursor-pointer p-2 rounded-lg transition-all duration-300",
                          isSelected ? "bg-teal-500/10 border border-teal-500/30 scale-[1.02]" : "hover:bg-white/5 border border-transparent"
                      )} onClick={() => onZoneSelect(isSelected ? null : label)}>
                          <div className="flex justify-between items-end text-[11px] font-mono mb-2">
                              <span className={clsx(
                                  "transition-colors uppercase tracking-widest leading-none",
                                  isSelected ? "text-teal-400" : "text-slate-400 group-hover:text-teal-400"
                              )}>{label}</span>
                              <span className="text-white font-bold leading-none">{val} <span className="text-[8px] text-slate-600 ml-1">ALERTS</span></span>
                          </div>
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden p-[1px]">
                              <div 
                                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(20,184,166,0.5)] transition-all duration-1000 ease-out" 
                                style={{ width: `${Math.min(100, (val / (wsData.stats.today_violations || 1)) * 100)}%` }} 
                              />
                          </div>
                      </div>
                      );
                  }) : (
                    <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/5 rounded-2xl bg-black/20">
                      <Shield className="text-slate-800 mb-2" size={32} />
                      <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Secure State: No Violations</span>
                    </div>
                  )}
             </div>
        </div>
      </div>

      <div className="mt-4">
          <IncidentTable incidents={displayIncidents} onAcknowledge={handleAcknowledge} />
      </div>
    </div>
  );
}
