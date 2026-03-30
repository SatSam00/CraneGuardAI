import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AlertBanner = ({ alerts, image, onDismiss }) => {
  return (
    <AnimatePresence>
      {alerts && alerts.length > 0 && (
        <motion.div 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-4xl bg-red-600/90 backdrop-blur-md text-white rounded-2xl border border-red-500/50 shadow-[0_20px_50px_rgba(239,68,68,0.3)] overflow-hidden flex items-stretch gap-0"
        >
          {image && (
            <div className="w-1/3 min-w-[200px] border-r border-white/10 relative overflow-hidden group">
               <img 
                 src={image} 
                 alt="Violation Evidence" 
                 className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
               />
               <div className="absolute inset-0 bg-gradient-to-r from-transparent to-red-600/20" />
            </div>
          )}
          
          <div className="flex-1 p-6 flex flex-col justify-center gap-2">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg animate-pulse">
                <AlertTriangle size={24} className="text-white" />
              </div>
              <h4 className="text-xl font-display font-bold tracking-widest uppercase">
                 CRITICAL SAFETY BREACH
              </h4>
            </div>
            
            <p className="text-sm font-mono text-white font-bold bg-black/20 p-2 border border-white/10 rounded uppercase">
               {alerts[0]}
            </p>
            
            <div className="mt-2 flex items-center gap-4">
               <div className="px-3 py-1 bg-red-800 border border-white/20 rounded-full text-[10px] font-mono font-bold tracking-tighter">
                  🔴 MACHINE STOPPED 🚨
               </div>
               <span className="text-[10px] font-mono text-white/50 animate-pulse uppercase tracking-[0.2em]">System Auto-Locked</span>
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
