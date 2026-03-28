import React from 'react';
import { AlertTriangle, Info, Image as ImageIcon } from 'lucide-react';

export const IncidentTable = ({ incidents, onAcknowledge }) => {
  return (
    <div className="bg-card border border-white/5 rounded-xl overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/2">
        <h3 className="font-display font-bold text-lg tracking-widest text-white">RECENT INCIDENTS</h3>
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Digital Audit Trail</span>
      </div>
      <table className="w-full text-left text-sm font-mono">
        <thead className="bg-white/5 text-slate-400">
          <tr>
            <th className="p-4 font-normal uppercase text-[10px] tracking-widest">Time</th>
            <th className="p-4 font-normal uppercase text-[10px] tracking-widest">Evidence</th>
            <th className="p-4 font-normal uppercase text-[10px] tracking-widest">Zone</th>
            <th className="p-4 font-normal uppercase text-[10px] tracking-widest">Type</th>
            <th className="p-4 font-normal uppercase text-[10px] tracking-widest">Severity</th>
            <th className="p-4 font-normal uppercase text-[10px] tracking-widest">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {incidents.map((incident) => (
            <tr key={incident.id} className="hover:bg-white/5 transition-colors group">
              <td className="p-4 text-slate-300">
                {new Date(incident.timestamp).toLocaleTimeString()}
              </td>
              <td className="p-4">
                {incident.frame_url ? (
                  <div className="relative group/img cursor-pointer">
                    <img 
                      src={incident.frame_url} 
                      alt="Violation Evidence" 
                      className="w-12 h-8 object-cover rounded border border-white/10 hover:scale-[3] hover:translate-x-12 hover:z-50 transition-all duration-300 shadow-xl"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity rounded">
                       <ImageIcon size={12} className="text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-8 bg-white/5 rounded border border-white/5 flex items-center justify-center">
                    <span className="text-[8px] text-slate-600">N/A</span>
                  </div>
                )}
              </td>
              <td className="p-4 font-bold text-white uppercase tracking-wider">{incident.zone_name}</td>
              <td className="p-4 text-slate-400 text-xs">{incident.type}</td>
              <td className="p-4">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-tighter ${
                  incident.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'
                }`}>
                  {incident.severity}
                </span>
              </td>
              <td className="p-4">
                {incident.acknowledged ? (
                  <div className="flex items-center gap-2 text-teal-500 text-[10px] uppercase font-bold">
                    <div className="w-1 h-1 rounded-full bg-teal-500" />
                    ACKNOWLEDGED
                  </div>
                ) : (
                  <button 
                    onClick={() => onAcknowledge(incident.id)}
                    className="bg-red-600 hover:bg-red-500 text-white text-[10px] px-3 py-1 rounded-sm font-bold uppercase tracking-widest shadow-lg shadow-red-500/20 group-hover:scale-105 transition-all"
                  >
                    ACKNOWLEDGE
                  </button>
                )}
              </td>
            </tr>
          ))}
          {incidents.length === 0 && (
            <tr>
              <td colSpan="6" className="p-20 text-center">
                 <div className="flex flex-col items-center gap-4 opacity-20">
                    <AlertTriangle size={48} className="text-slate-500" />
                    <span className="text-[10px] font-mono text-slate-500 tracking-[0.5em] uppercase">No violations recorded for this period</span>
                 </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
