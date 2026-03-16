import React, { useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { AlertBanner } from '../components/AlertBanner';
import { ZoneCard } from '../components/ZoneCard';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export default function LiveMonitor({ selectedZone, onZoneSelect }) {
  const host = window.location.hostname || '127.0.0.1';
  const { data, status } = useWebSocket(`ws://${host}:8200/ws/feed`);
  const canvasRef = useRef(null);

  const [machineStates, setMachineStates] = React.useState({});
  const focusZone = selectedZone;
  const setFocusZone = onZoneSelect;
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')); // Warning beep sound

  const zoneStatus = data?.zone_status || {};
  const alerts = data?.alerts || [];

  useEffect(() => {
    if (data && data.frame && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          // Normalize focusZone to find potential match in IDs or Names
          const activeZoneId = Object.keys(zoneStatus).find(id => 
            id === focusZone || zoneStatus[id]?.name === focusZone || `Zone ${id}` === focusZone
          );

          if (activeZoneId && zoneStatus[activeZoneId]) {
            const poly = zoneStatus[activeZoneId].polygon || [];
            if (poly.length > 0) {
              const minX = Math.min(...poly.map(p => p[0]));
              const minY = Math.min(...poly.map(p => p[1]));
              const maxX = Math.max(...poly.map(p => p[0]));
              const maxY = Math.max(...poly.map(p => p[1]));
              
              const padding = 80;
              const sx = Math.max(0, minX - padding);
              const sy = Math.max(0, minY - padding);
              const sw = Math.min(img.width - sx, (maxX - minX) + padding * 2);
              const sh = Math.min(img.height - sy, (maxY - minY) + padding * 2);

              ctx.clearRect(0, 0, canvas.width, canvas.height);
              // Draw cropped view
              ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
              
              // Draw Overlay labels in crop
              ctx.fillStyle = 'rgba(20, 184, 166, 0.8)';
              ctx.font = 'bold 24px Inter';
              ctx.fillText(`${zoneStatus[activeZoneId].name} - MAGNIFIED`, 40, 60);
              return;
            }
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = `data:image/jpeg;base64,${data.frame}`;
    }
  }, [data, focusZone, zoneStatus]);

  // Handle Warning Sound
  useEffect(() => {
    const hasDanger = Object.values(zoneStatus).some(z => z.danger);
    if (hasDanger) {
      audioRef.current.play().catch(e => console.log("Audio play blocked"));
    }
  }, [zoneStatus]);

  React.useEffect(() => {
    if (data?.machine_states !== undefined) {
      setMachineStates(data.machine_states);
    }
  }, [data]);

  const toggleMachine = async (zoneId = null) => {
    const currentState = zoneId ? machineStates[zoneId] : Object.values(machineStates).some(s => s);
    const newState = !currentState;
    
    await fetch('/api/machine/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: zoneId, active: newState })
    });
    
    if (zoneId) {
      setMachineStates(prev => ({ ...prev, [zoneId]: newState }));
    } else {
      const allNew = {};
      Object.keys(machineStates).forEach(k => allNew[k] = newState);
      setMachineStates(allNew);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      <AlertBanner alerts={alerts} />
      
      <div className="p-8 grid grid-cols-12 gap-8 flex-1 overflow-auto relative z-10">
        <div className="col-span-9 flex flex-col gap-4">
          <div className="flex justify-between items-end bg-card/80 backdrop-blur-xl p-4 border border-white/5 rounded-t-xl">
             <div className="flex items-center gap-6">
                <div>
                   <h2 className="text-3xl font-display font-bold text-white tracking-widest leading-none">
                      {focusZone ? `MAGNIFIED VIEW: ${zoneStatus[Object.keys(zoneStatus).find(id => id === focusZone || zoneStatus[id].name === focusZone || `Zone ${id}` === focusZone)]?.name || focusZone}` : 'PRIMARY BROADCAST'}
                   </h2>
                   <div className="flex items-center gap-2 mt-2">
                       <div className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-teal-500 animate-pulse' : 'bg-red-500'}`} title={status} />
                       <span className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]">{status}</span>
                   </div>
                </div>
                
                <div className="flex gap-2">
                   <button 
                     onClick={() => setFocusZone(null)}
                     className={clsx(
                        "px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-widest transition-all border",
                        !focusZone ? "bg-teal-500 border-teal-500 text-background shadow-[0_0_10px_rgba(20,184,166,0.3)]" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                     )}
                   >
                     COMBINE ALL
                   </button>
                   <button 
                     onClick={() => toggleMachine()}
                     className={clsx(
                        "px-4 py-1.5 rounded font-display font-bold text-sm tracking-widest transition-all",
                        Object.values(machineStates).some(s => s) 
                           ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]" 
                           : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                     )}
                   >
                     {Object.values(machineStates).some(s => s) ? 'STOP MACHINE' : 'START MACHINE'}
                   </button>
                </div>
             </div>
             
             <div className="text-[10px] font-mono text-slate-600 flex flex-col items-end">
                <span>SIGNAL: {focusZone ? 'ENHANCED LENS' : 'WIDE FIELD'}</span>
                <span className="mt-1 text-teal-500/50 uppercase tracking-widest font-bold">Encrypted Stream</span>
             </div>
          </div>
          
          <div className="relative aspect-video bg-black rounded-b-xl border-x border-b border-white/5 ring-1 ring-white/5 overflow-hidden shadow-2xl">
            {status !== 'connected' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card text-white/20 gap-4">
                  <Loader2 className="animate-spin" size={48} />
                  <span className="font-mono text-xs uppercase tracking-widest">Awaiting Video Stream...</span>
                </div>
            ) : null}
            <canvas 
                ref={canvasRef} 
                width={1280} 
                height={720} 
                className="w-full h-full object-contain"
            />
            
            <div className="absolute bottom-4 left-4 flex gap-2">
               {Object.entries(zoneStatus).map(([id, status]) => {
                  const isSelected = focusZone === id || status.name === focusZone || `Zone ${id}` === focusZone;
                  return (
                     <button 
                        key={id}
                        onClick={() => setFocusZone(isSelected ? null : id)}
                        className={clsx(
                           "px-3 py-1 rounded-full text-[10px] font-mono border transition-all flex items-center gap-2",
                           isSelected ? "bg-teal-500/20 border-teal-500 text-teal-400" : "bg-black/60 border-white/10 text-slate-500 backdrop-blur-md"
                        )}
                      >
                         <div className={`w-1 h-1 rounded-full ${status.danger ? 'bg-red-500 animate-pulse' : 'bg-teal-500/40'}`} />
                         {status.name}
                     </button>
                  );
               })}
            </div>

            {alerts.length > 0 && (
                <div className="absolute inset-0 border-4 border-red-500 pointer-events-none animate-pulse" />
            )}
          </div>
        </div>

        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
            <h3 className="font-display font-bold text-slate-400 text-sm tracking-widest px-1">ACTIVE MONITORING</h3>
            {Object.entries(zoneStatus).length > 0 ? (
                Object.entries(zoneStatus).map(([id, status]) => {
                    const isSelected = focusZone === id || status.name === focusZone || `Zone ${id}` === focusZone;
                    return (
                        <div 
                          key={id} 
                          onClick={() => setFocusZone(isSelected ? null : id)} 
                          className={clsx(
                            "cursor-pointer transition-all duration-300",
                            isSelected ? "ring-2 ring-teal-500 scale-[1.02]" : "hover:translate-x-1"
                          )}
                        >
                           <ZoneCard 
                               name={status.name} 
                               workerCount={status.worker_count}
                               craneActive={status.crane_active}
                               danger={status.danger}
                               machineActive={machineStates[id]}
                               onToggleMachine={() => toggleMachine(id)}
                           />
                        </div>
                    );
                })
            ) : (
                <div className="text-xs font-mono text-slate-700 p-8 text-center border border-dashed border-white/5 rounded-xl">
                    Initializing Zones...
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
