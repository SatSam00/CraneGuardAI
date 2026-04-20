import React from 'react';
import { LayoutDashboard, Video, Map, Settings, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const SidebarLink = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={twMerge(
      "flex flex-col md:flex-row items-center gap-1 md:gap-3 px-3 md:px-6 py-2 md:py-4 w-full transition-all duration-200 border-b-2 md:border-b-0 md:border-l-4 border-transparent hover:bg-white/5",
      active ? "bg-white/10 border-teal-500 text-teal-400" : "text-slate-400"
    )}
  >
    <Icon size={20} className={twMerge("md:w-5 md:h-5 w-6 h-6 transition-transform duration-300", active && "scale-110")} />
    <span className="font-display text-[10px] md:text-sm font-semibold tracking-wider text-center md:text-left opacity-80 group-hover:opacity-100">{label}</span>
  </button>
);

export const Sidebar = ({ activeTab, setActiveTab }) => {
  return (
    <div className="w-full md:w-64 h-auto md:h-screen bg-card/80 backdrop-blur-xl border-t md:border-t-0 md:border-r border-white/5 flex flex-row md:flex-col items-center md:items-stretch fixed bottom-0 md:relative z-[200] order-last md:order-first shadow-[0_-10px_25px_rgba(0,0,0,0.5)] md:shadow-none">
      <div className="hidden md:flex px-6 py-8 mb-4 items-center gap-3">
        <div className="w-8 h-8 bg-teal-500 rounded flex items-center justify-center font-bold text-background shadow-[0_0_15px_rgba(20,184,166,0.5)]">C</div>
        <h1 className="text-2xl font-display font-bold text-white tracking-tighter">CRANE<span className="text-teal-500 font-black">AI</span></h1>
      </div>
      
      <nav className="flex-1 flex flex-row md:flex-col justify-around md:justify-start w-full px-2 md:px-0 py-2 md:py-0">
        <SidebarLink icon={Video} label="LIVE" active={activeTab === 'live'} onClick={() => setActiveTab('live')} />
        <SidebarLink icon={LayoutDashboard} label="STATS" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <SidebarLink icon={Map} label="MAP" active={activeTab === 'heatmap'} onClick={() => setActiveTab('heatmap')} />
        <SidebarLink icon={Settings} label="CONFIG" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </nav>

      <div className="hidden md:block p-6 text-[10px] font-mono text-slate-600">
        SYSTEM STATUS: <span className="text-teal-500">OPTIMAL</span><br/>
        V2.4.0-STABLE
      </div>
    </div>
  );
};
