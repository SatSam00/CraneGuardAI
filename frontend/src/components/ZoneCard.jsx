import React from 'react';
import { User, Activity } from 'lucide-react';

export const ZoneCard = ({ name, workerCount, craneActive, danger, machineActive, onToggleMachine }) => {
  return (
    <div className={`bg-card p-4 rounded-xl border transition-all duration-300 ${
      danger ? 'border-red-500 animate-pulse-red' : 'border-white/5'
    }`}>
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-display font-bold text-white leading-none">{name}</h4>
        <div className={`w-2 h-2 rounded-full ${danger ? 'bg-red-500' : 'bg-teal-500'}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/5 p-2 rounded flex items-center gap-2">
          <User size={14} className={workerCount > 0 ? 'text-teal-400' : 'text-slate-600'} />
          <span className="text-xs font-mono">{workerCount} WORKERS</span>
        </div>
        <div className="bg-white/5 p-2 rounded flex items-center gap-2">
          <Activity size={14} className={craneActive ? 'text-amber-400' : 'text-slate-600'} />
          <span className="text-xs font-mono">{craneActive ? 'CRANE ACTIVE' : 'CRANE IDLE'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/5">
        <span className="text-[10px] font-mono text-slate-500 uppercase">Remote Control</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleMachine(); }}
          className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
            machineActive ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400'
          }`}
        >
          {machineActive ? 'STOP MACHINE' : 'START MACHINE'}
        </button>
      </div>
      
      {danger && (
        <div className="mt-3 bg-red-500/20 text-red-500 text-[10px] p-2 text-center rounded font-bold uppercase tracking-wider">
          CRITICAL: STOP OPERATIONS
        </div>
      )}
    </div>
  );
};
