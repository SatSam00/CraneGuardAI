import React from 'react';

export const StatCard = ({ label, value, subtext, color = 'teal', icon: Icon }) => {
  const colorMap = {
    teal: 'text-teal-400 border-teal-500/20',
    red: 'text-red-400 border-red-500/20',
    amber: 'text-amber-400 border-amber-500/20',
    slate: 'text-slate-400 border-slate-500/20'
  };

  return (
    <div className="bg-card p-6 border border-white/5 rounded-xl flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">{label}</span>
        {Icon && <Icon size={16} className="text-slate-600" />}
      </div>
      <div className={`text-4xl font-display font-bold ${colorMap[color].split(' ')[0]}`}>
        {value}
      </div>
      {subtext && <div className="text-[10px] font-mono text-slate-600">{subtext}</div>}
    </div>
  );
};
