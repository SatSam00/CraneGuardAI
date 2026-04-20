import { motion } from 'framer-motion';

export const StatCard = ({ label, value, subtext, color = 'teal', icon: Icon }) => {
  const colorMap = {
    teal: 'text-teal-400 border-teal-500/20 shadow-teal-500/5',
    red: 'text-red-400 border-red-500/20 shadow-red-500/5',
    amber: 'text-amber-400 border-amber-500/20 shadow-amber-500/5',
    slate: 'text-slate-400 border-slate-500/20 shadow-slate-500/5'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-card p-4 md:p-6 border border-white/5 rounded-xl flex flex-col gap-2 hover:border-white/10 transition-colors shadow-lg"
    >
      <div className="flex justify-between items-start">
        <span className="text-[10px] md:text-xs font-mono text-slate-500 uppercase tracking-widest">{label}</span>
        {Icon && <Icon size={16} className="text-slate-600" />}
      </div>
      <div className={`text-3xl md:text-4xl font-display font-bold ${colorMap[color].split(' ')[0]}`}>
        {value}
      </div>
      {subtext && <div className="text-[8px] md:text-[10px] font-mono text-slate-600 uppercase tracking-tighter">{subtext}</div>}
    </motion.div>
  );
};
