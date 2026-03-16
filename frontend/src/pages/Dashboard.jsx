import React, { useState, useEffect } from 'react';
import { StatCard } from '../components/StatCard';
import { IncidentTable } from '../components/IncidentTable';
import { Shield, AlertCircle, ScanEye, Timer, CheckCircle } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { clsx } from 'clsx';

export default function Dashboard({ onZoneSelect }) {
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({
      violations: 0,
      score: 100,
      zones: 4,
      reaction: 1.2,
      distribution: {},
      trend: []
  });

  const fetchStats = async () => {
    try {
        const [incR, statR] = await Promise.all([
          fetch('/api/incidents'),
          fetch('/api/stats')
        ]);
        const incData = await incR.json();
        const statData = await statR.json();
        
        setIncidents(incData);
        setStats({
            violations: statData.today_violations,
            score: statData.safety_score,
            zones: statData.monitored_zones || 4,
            reaction: statData.avg_reaction_time,
            distribution: statData.distribution || {},
            trend: statData.trend || []
        });
    } catch (err) {
        console.error("Dashboard sync error:", err);
    }
  };

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleAcknowledge = async (id) => {
      setIncidents(prev => prev.map(inc => inc.id === id ? {...inc, acknowledged: true} : inc));
  };

  const chartData = stats.trend.length > 0 ? stats.trend : [
    { time: '08:00', violations: 0, safety: 100 },
    { time: '12:00', violations: 0, safety: 100 },
    { time: '18:00', violations: 0, safety: 100 },
  ];

  return (
    <div className="p-8 flex flex-col gap-8 h-full overflow-y-auto bg-[#0a0c0f] text-slate-200">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-4xl font-display font-bold text-white tracking-widest leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">ANALYTICS DASHBOARD</h2>
            <p className="text-[10px] font-mono text-slate-500 mt-2 uppercase tracking-[0.3em]">Real-Time Safety Intelligence Matrix</p>
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
        <StatCard label="TODAY'S VIOLATIONS" value={stats.violations} color="amber" icon={AlertCircle} subtext="REAL-TIME EVENT STREAM" />
        <StatCard label="SAFETY SCORE" value={`${stats.score}%`} color={stats.score > 80 ? 'teal' : 'red'} icon={CheckCircle} subtext="LIVE RELIABILITY RATING" />
        <StatCard label="MONITORED ZONES" value={stats.zones} color="slate" icon={ScanEye} subtext="AUTOMATED COVERAGE" />
        <StatCard label="AVG REACTION TIME" value={`${stats.reaction}s`} color="teal" icon={Timer} subtext="SYSTEM TO ALERT LATENCY" />
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 bg-card/30 backdrop-blur-sm border border-white/5 rounded-2xl p-8 h-[450px] flex flex-col gap-6 shadow-inner">
            <div className="flex justify-between items-center">
                <h3 className="font-display font-bold text-xl tracking-widest text-white">SAFETY PERFORMANCE TRENDS</h3>
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
             <h3 className="font-display font-bold text-xl tracking-widest text-white text-center">ZONE DISTRIBUTION</h3>
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
                  {Object.entries(stats.distribution).length > 0 ? Object.entries(stats.distribution).map(([label, val]) => (
                      <div key={label} className="group cursor-pointer" onClick={() => onZoneSelect(label)}>
                          <div className="flex justify-between items-end text-[11px] font-mono mb-2">
                              <span className="text-slate-400 group-hover:text-teal-400 transition-colors uppercase tracking-widest leading-none">{label}</span>
                              <span className="text-white font-bold leading-none">{val} <span className="text-[8px] text-slate-600 ml-1">UNITS</span></span>
                          </div>
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden p-[1px]">
                              <div 
                                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(20,184,166,0.5)] transition-all duration-1000 ease-out" 
                                style={{ width: `${Math.min(100, (val / (stats.violations || 1)) * 100)}%` }} 
                              />
                          </div>
                      </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/5 rounded-2xl bg-black/20">
                      <Shield className="text-slate-800 mb-2" size={32} />
                      <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Secure State: No Violations</span>
                    </div>
                  )}
             </div>
        </div>
      </div>

      <div className="mt-4">
          <IncidentTable incidents={incidents} onAcknowledge={handleAcknowledge} />
      </div>
    </div>
  );
}
