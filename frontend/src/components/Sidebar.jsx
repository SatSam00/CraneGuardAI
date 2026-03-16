import React from 'react';
import { LayoutDashboard, Video, Map, Settings, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const SidebarLink = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={twMerge(
      "flex items-center gap-3 px-6 py-4 w-full transition-all duration-200 border-l-4 border-transparent hover:bg-white/5",
      active ? "bg-white/10 border-teal-500 text-teal-400" : "text-slate-400"
    )}
  >
    <Icon size={20} />
    <span className="font-display text-sm font-semibold tracking-wider">{label}</span>
  </button>
);

export const Sidebar = ({ activeTab, setActiveTab }) => {
  return (
    <div className="w-64 h-screen bg-card border-r border-white/5 flex flex-col pt-8">
      <div className="px-6 mb-12 flex items-center gap-3">
        <div className="w-8 h-8 bg-teal-500 rounded flex items-center justify-center font-bold text-background">C</div>
        <h1 className="text-2xl font-display font-bold text-white tracking-tighter">CRANE<span className="text-teal-500">AI</span></h1>
      </div>
      
      <nav className="flex-1">
        <SidebarLink icon={Video} label="LIVE MONITOR" active={activeTab === 'live'} onClick={() => setActiveTab('live')} />
        <SidebarLink icon={LayoutDashboard} label="DASHBOARD" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <SidebarLink icon={Map} label="HEATMAP" active={activeTab === 'heatmap'} onClick={() => setActiveTab('heatmap')} />
        <SidebarLink icon={Settings} label="SETTINGS" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </nav>

      <div className="p-6 text-[10px] font-mono text-slate-600">
        SYSTEM STATUS: <span className="text-teal-500">OPTIMAL</span><br/>
        V2.4.0-STABLE
      </div>
    </div>
  );
};
