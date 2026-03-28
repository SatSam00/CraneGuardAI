import React, { useState, useEffect } from 'react';
import { Camera, Bell, ShieldCheck, Map, Save, Trash2, Plus } from 'lucide-react';

export default function Settings() {
  const [config, setConfig] = useState({
    cameraSource: '0',
    telegramToken: '',
    telegramChatId: '',
    alertCooldown: 30,
    ppeDetection: true
  });

  const [zones, setZones] = useState([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');

  useEffect(() => {
    fetch('/api/zones').then(r => r.json()).then(setZones);
  }, []);

  const handleSave = async () => {
      await fetch('/api/zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(zones)
      });
      alert("Settings saved successfully!");
  };

  return (
    <div className="p-8 flex flex-col gap-8 h-full bg-background overflow-y-auto">
      <div>
        <h2 className="text-4xl font-display font-bold text-white tracking-widest leading-none">SYSTEM SETTINGS</h2>
        <p className="text-xs font-mono text-slate-500 mt-2">CONFIGURE HARDWARE AND ALERT PARAMETERS</p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-8">
            {/* Camera Config */}
            <div className="bg-card border border-white/5 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3 text-white border-b border-white/5 pb-4 mb-4">
                    <Camera size={20} className="text-teal-500" />
                    <h3 className="font-display font-bold">CAMERA SOURCE</h3>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">RTSP URL or Device Index</label>
                        <input 
                            type="text" 
                            className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm font-mono text-teal-400 focus:outline-none focus:border-teal-500"
                            value={config.cameraSource}
                            onChange={(e) => setConfig({...config, cameraSource: e.target.value})}
                        />
                    </div>
                </div>
            </div>

            {/* Notifications */}
            <div className="bg-card border border-white/5 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3 text-white border-b border-white/5 pb-4 mb-4">
                    <Bell size={20} className="text-amber-500" />
                    <h3 className="font-display font-bold">ALERT ENGINE</h3>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Telegram Bot Token</label>
                        <input 
                            type="password" 
                            className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm font-mono text-white focus:outline-none focus:border-teal-500"
                            defaultValue="************"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Chat ID</label>
                        <input 
                            type="text" 
                            className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm font-mono text-white focus:outline-none focus:border-teal-500"
                            defaultValue="8271928"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1 flex justify-between">
                            <span>Cooldown Period (seconds)</span>
                            <span className="text-teal-500">{config.alertCooldown}s</span>
                        </label>
                        <input 
                            type="range" min="10" max="120" 
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal-500"
                            value={config.alertCooldown}
                            onChange={(e) => setConfig({...config, alertCooldown: e.target.value})}
                        />
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-8">
            {/* Zone Mapping */}
            <div className="bg-card border border-white/5 rounded-2xl p-6 flex flex-col gap-4 min-h-[500px]">
                <div className="flex items-center justify-between text-white border-b border-white/5 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                        <Map size={20} className="text-pink-500" />
                        <h3 className="font-display font-bold">SAFETY ZONES</h3>
                    </div>
                    <button 
                        onClick={() => setIsDrawingMode(!isDrawingMode)}
                        className="bg-teal-500 text-background p-1 rounded hover:bg-teal-400 transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>
                
                <div className="flex-1 space-y-4">
                    {zones.map((zone, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-xl flex items-center justify-between group">
                            <div className="flex flex-col">
                                <span className="font-display font-bold text-white uppercase">{zone.name}</span>
                                <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">{zone.polygon.length} POL POINTS</span>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-2 text-slate-500 hover:text-white transition-colors"><Save size={14} /></button>
                                <button onClick={() => setZones(zones.filter((z) => z.id !== zone.id))} className="p-2 text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                    
                    {isDrawingMode && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-[10px] font-mono text-slate-500 uppercase block">Draw Active Zone</label>
                                <input 
                                    type="text" 
                                    placeholder="Zone Name"
                                    value={newZoneName}
                                    onChange={(e) => setNewZoneName(e.target.value)}
                                    className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                />
                            </div>
                            <div className="relative aspect-video bg-black rounded-xl border border-white/10 overflow-hidden cursor-crosshair">
                                <canvas 
                                id="zone-canvas"
                                width={640} 
                                height={360} 
                                className="w-full h-full"
                                onClick={(e) => {
                                    const rect = e.target.getBoundingClientRect();
                                    const x = Math.round((e.clientX - rect.left) * (640 / rect.width));
                                    const y = Math.round((e.clientY - rect.top) * (360 / rect.height));
                                    
                                    // Add point to current drawing (mocked state for simplicity in POC)
                                    const currentPoints = window.__drawingPoints || [];
                                    window.__drawingPoints = [...currentPoints, [x, y]];
                                    
                                    const ctx = e.target.getContext('2d');
                                    ctx.strokeStyle = '#14b8a6';
                                    ctx.lineWidth = 2;
                                    ctx.fillStyle = 'rgba(20, 184, 166, 0.2)';
                                    
                                    ctx.clearRect(0,0,640,360);
                                    ctx.beginPath();
                                    window.__drawingPoints.forEach((p, i) => {
                                        if (i === 0) ctx.moveTo(p[0], p[1]);
                                        else ctx.lineTo(p[0], p[1]);
                                        ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
                                    });
                                    if (window.__drawingPoints.length > 2) ctx.closePath();
                                    ctx.stroke();
                                    ctx.fill();
                                }}
                            />
                            <div className="absolute top-2 right-2 flex gap-2">
                                <button 
                                    onClick={() => {
                                        const pts = window.__drawingPoints || [];
                                        if (pts.length < 3) return;
                                        const name = newZoneName.trim() || `Zone ${zones.length + 1}`;
                                        setZones([...zones, { id: `z-${Date.now()}`, name: name, polygon: pts, active: true }]);
                                        setNewZoneName('');
                                        setIsDrawingMode(false);
                                        window.__drawingPoints = [];
                                        const canvas = document.getElementById('zone-canvas');
                                        const ctx = canvas.getContext('2d');
                                        ctx.clearRect(0,0,640,360);
                                    }}
                                    className="bg-teal-500 text-background text-[8px] font-bold px-3 py-1 rounded shadow-lg"
                                >
                                    ADD ZONE
                                </button>
                                <button 
                                    onClick={() => {
                                        window.__drawingPoints = [];
                                        const canvas = document.getElementById('zone-canvas');
                                        const ctx = canvas.getContext('2d');
                                        ctx.clearRect(0,0,640,360);
                                    }}
                                    className="bg-white/10 text-white text-[8px] font-bold px-3 py-1 rounded"
                                >
                                    CLEAR
                                </button>
                            </div>
                        </div>
                    </div>
                    )}
                </div>

                <div className="mt-4 p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl">
                    <div className="flex items-center gap-3 text-teal-500 mb-2">
                        <ShieldCheck size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">AI Guard Enabled</span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-400">YOLOv8 + DeepSORT Active. Zone crossing triggers immediate Telegram alert.</p>
                </div>
            </div>
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-auto pt-8 border-t border-white/5">
         <button className="px-8 py-3 bg-white/5 border border-white/10 rounded-lg text-slate-400 font-display font-bold hover:bg-white/10 transition-colors">DISCARD</button>
         <button onClick={handleSave} className="px-8 py-3 bg-teal-500 rounded-lg text-background font-display font-bold hover:bg-teal-400 transition-transform active:scale-95">SAVE CONFIGURATION</button>
      </div>
    </div>
  );
}
