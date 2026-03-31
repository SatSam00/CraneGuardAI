import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AlertBanner = ({ alerts, image, onDismiss }) => {
  const primaryAlert = alerts?.[0] || '';
  const severity = primaryAlert.startsWith('CRITICAL:')
    ? 'critical'
    : primaryAlert.startsWith('WARNING:')
      ? 'warning'
      : 'notice';

  const severityStyles = {
    critical: {
      container: 'bg-red-600/90 border-red-500/50 shadow-[0_20px_50px_rgba(239,68,68,0.3)]',
      heading: 'CRITICAL SAFETY BREACH',
      chip: 'bg-red-800',
      chipText: 'MACHINE STOPPED',
      pulseText: 'System Auto-Locked',
      imageOverlay: 'to-red-600/20'
    },
    warning: {
      container: 'bg-amber-600/90 border-amber-500/50 shadow-[0_20px_50px_rgba(245,158,11,0.3)]',
      heading: 'SAFETY WARNING',
      chip: 'bg-amber-800',
      chipText: 'REDUCE RISK',
      pulseText: 'Operator Attention Required',
      imageOverlay: 'to-amber-600/20'
    },
    notice: {
      container: 'bg-sky-700/90 border-sky-500/50 shadow-[0_20px_50px_rgba(14,165,233,0.3)]',
      heading: 'SAFETY NOTICE',
      chip: 'bg-sky-900',
      chipText: 'KEEP MACHINE OFF',
      pulseText: 'Monitoring Worker Presence',
      imageOverlay: 'to-sky-700/20'
    }
  };

  const ui = severityStyles[severity];

  return (
    <AnimatePresence>
      {alerts && alerts.length > 0 && (
        <motion.div 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-4xl backdrop-blur-md text-white rounded-2xl border overflow-hidden flex items-stretch gap-0 ${ui.container}`}
        >
          {image && (
            <div className="w-1/3 min-w-[200px] border-r border-white/10 relative overflow-hidden group">
               <img 
                 src={image} 
                 alt="Violation Evidence" 
                 className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
               />
               <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${ui.imageOverlay}`} />
            </div>
          )}
          
          <div className="flex-1 p-6 flex flex-col justify-center gap-2">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg animate-pulse">
                <AlertTriangle size={24} className="text-white" />
              </div>
              <h4 className="text-xl font-display font-bold tracking-widest uppercase">
                  {ui.heading}
              </h4>
            </div>
            
            <p className="text-sm font-mono text-white font-bold bg-black/20 p-2 border border-white/10 rounded uppercase">
                {primaryAlert}
            </p>
            
            <div className="mt-2 flex items-center gap-4">
                <div className={`px-3 py-1 ${ui.chip} border border-white/20 rounded-full text-[10px] font-mono font-bold tracking-tighter`}>
                  {ui.chipText}
               </div>
                <span className="text-[10px] font-mono text-white/50 animate-pulse uppercase tracking-[0.2em]">{ui.pulseText}</span>
            </div>
          </div>

          <button 
            onClick={onDismiss}
            className="p-4 hover:bg-white/10 transition-colors uppercase font-mono text-[10px] border-l border-white/5 flex items-center gap-2"
          >
            DISMISS <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
