import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export const IncidentTable = ({ incidents, onAcknowledge }) => {
  return (
    <div className="bg-card border border-white/5 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/5 flex justify-between items-center">
        <h3 className="font-display font-bold text-lg">RECENT INCIDENTS</h3>
        <span className="text-[10px] font-mono text-slate-500">LATEST 100 EVENTS</span>
      </div>
      <table className="w-full text-left text-sm font-mono">
        <thead className="bg-white/5 text-slate-400">
          <tr>
            <th className="p-4 font-normal uppercase text-xs">Time</th>
            <th className="p-4 font-normal uppercase text-xs">Zone</th>
            <th className="p-4 font-normal uppercase text-xs">Type</th>
            <th className="p-4 font-normal uppercase text-xs">Severity</th>
            <th className="p-4 font-normal uppercase text-xs">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {incidents.map((incident) => (
            <tr key={incident.id} className="hover:bg-white/5 transition-colors group">
              <td className="p-4 text-slate-300">
                {new Date(incident.timestamp).toLocaleTimeString()}
              </td>
              <td className="p-4 font-bold text-white">{incident.zone_name}</td>
              <td className="p-4 text-slate-400">{incident.type}</td>
              <td className="p-4">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  incident.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'
                }`}>
                  {incident.severity}
                </span>
              </td>
              <td className="p-4">
                {incident.acknowledged ? (
                  <span className="text-teal-500 text-[10px] uppercase font-bold">ACKNOWLEDGED</span>
                ) : (
                  <button 
                    onClick={() => onAcknowledge(incident.id)}
                    className="bg-red-500 text-white text-[10px] px-3 py-1 rounded-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ACKNOWLEDGE
                  </button>
                )}
              </td>
            </tr>
          ))}
          {incidents.length === 0 && (
            <tr>
              <td colSpan="5" className="p-12 text-center text-slate-600">NO INCIDENTS DETECTED TODAY</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
