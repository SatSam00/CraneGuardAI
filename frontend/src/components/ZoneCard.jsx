import { motion } from 'framer-motion';
import { User, Activity } from 'lucide-react';

export const ZoneCard = ({ name, workerCount, craneActive, danger, machineActive, onToggleMachine, enabled = true, onToggleEnabled }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.02 }}
      className={`bg-card p-4 rounded-xl border transition-all duration-300 relative overflow-hidden shadow-xl ${
        !enabled ? 'opacity-50 grayscale' : danger ? 'border-red-500 animate-pulse-red' : 'border-white/5'
      }`}
    >
      {!enabled && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-20 flex items-center justify-center">
            <span className="text-[10px] font-mono font-bold text-white/40 tracking-[0.3em] uppercase rotate-[-12deg]">Monitoring Offline</span>
        </div>
      )}

      <div className="flex justify-between items-center mb-4 relative z-30">
        <h4 className="font-display font-bold text-white text-lg md:text-xl leading-none">{name}</h4>
        <div className="flex items-center gap-3">
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleEnabled(); }}
                className={`px-3 py-1.5 md:px-2 md:py-1 rounded text-[9px] md:text-[8px] font-mono font-bold transition-all border pointer-events-auto h-8 md:h-auto flex items-center justify-center ${
                    enabled ? 'bg-teal-500/20 border-teal-500/50 text-teal-400' : 'bg-red-500/20 border-red-500/50 text-red-500'
                }`}
            >
                {enabled ? 'ON' : 'OFF'}
            </button>
            <div className={`w-3 h-3 md:w-2 md:h-2 rounded-full ${!enabled ? 'bg-slate-700' : danger ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.5)]'}`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/5 p-3 md:p-2 rounded flex items-center gap-2 border border-white/5">
          <User size={16} className={
            danger ? 'text-red-500 animate-pulse' : 
            workerCount > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-600'
          } />
          <span className={
            danger ? 'text-[10px] md:text-xs font-mono text-red-500 font-bold' : 
            workerCount > 0 ? 'text-[10px] md:text-xs font-mono text-amber-500' : 'text-[10px] md:text-xs font-mono text-slate-500'
          }>
            {workerCount} WORKERS
          </span>
        </div>
        <div className="bg-white/5 p-3 md:p-2 rounded flex items-center gap-2 border border-white/5">
          <Activity size={16} className={craneActive ? 'text-teal-400' : 'text-slate-600'} />
          <span className="text-[10px] md:text-xs font-mono text-slate-400 uppercase">{craneActive ? 'ACTIVE' : 'IDLE'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/5">
        <span className="text-[9px] md:text-[10px] font-mono text-slate-500 uppercase tracking-tighter">Remote Control</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleMachine(); }}
          className={`px-4 py-2 md:px-3 md:py-1 rounded text-[11px] md:text-[10px] font-bold transition-all shadow-md active:scale-95 ${
            machineActive ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-slate-700 text-slate-400'
          }`}
        >
          {machineActive ? 'STOP MACHINE' : 'START MACHINE'}
        </button>
      </div>
      
      {danger && (
        <motion.div 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mt-3 bg-red-500/20 text-red-500 text-[10px] p-2 text-center rounded font-bold uppercase tracking-wider border border-red-500/20"
        >
          CRITICAL BREACH
        </motion.div>
      )}
    </motion.div>
  );
};
