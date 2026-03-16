import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AlertBanner = ({ alerts }) => {
  return (
    <AnimatePresence>
      {alerts && alerts.length > 0 && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-red-600 text-white font-bold py-3 px-6 overflow-hidden flex items-center justify-center gap-4 border-b border-red-700 shadow-lg shadow-red-900/20"
        >
          <div className="animate-pulse flex items-center gap-4">
            <AlertTriangle size={20} />
            <span className="text-sm tracking-widest uppercase font-display">
               {alerts[0]} - EMERGENCY ACTION REQUIRED
            </span>
            <AlertTriangle size={20} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
