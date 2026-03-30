import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Bell, ShieldCheck, Map, Trash2, Plus, Loader2, Check } from 'lucide-react';
import { useWebSocketData } from '../context/WebSocketContext';

export default function Settings() {
    const { data: wsData, status } = useWebSocketData();
  const [config, setConfig] = useState({
    cameraSource: '0',
    telegramToken: '',
    telegramChatId: '',
    alertCooldown: 30,
    ppeDetection: true
  });

  const [zones, setZones] = useState([]);
    const [loadingZones, setLoadingZones] = useState(true);
    const [saveState, setSaveState] = useState('idle');
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
    const [selectedZoneId, setSelectedZoneId] = useState(null);
    const [draftRect, setDraftRect] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
        const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 });

    const canvasRef = useRef(null);
    const frameImageRef = useRef(null);
    const dragStartRef = useRef(null);

    const frameSrc = wsData?.frame ? `data:image/jpeg;base64,${wsData.frame}` : null;

  useEffect(() => {
        const loadZones = async () => {
            try {
                const res = await fetch('/api/zones');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setZones(data);
                }
            } finally {
                setLoadingZones(false);
            }
        };

        loadZones();
  }, []);

    const drawZonePolygon = (ctx, zone, highlighted = false) => {
        const points = zone.polygon || [];
        if (points.length < 3) return;

        ctx.beginPath();
        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p[0], p[1]);
            else ctx.lineTo(p[0], p[1]);
        });
        ctx.closePath();

        const color = zone.active === false ? '#6b7280' : highlighted ? '#14b8a6' : '#22c55e';
        ctx.strokeStyle = color;
        ctx.lineWidth = highlighted ? 4 : 2;
        ctx.fillStyle = zone.active === false ? 'rgba(107,114,128,0.15)' : 'rgba(34,197,94,0.16)';
        ctx.fill();
        ctx.stroke();

        const anchor = points[0];
        ctx.fillStyle = color;
        ctx.font = 'bold 22px monospace';
        ctx.fillText(zone.name || zone.id, anchor[0] + 6, anchor[1] - 8);
    };

    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const width = canvas.width;
        const height = canvas.height;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        if (frameImageRef.current) {
            ctx.drawImage(frameImageRef.current, 0, 0, width, height);
        } else {
            ctx.fillStyle = '#05070b';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#64748b';
            ctx.font = '16px monospace';
            ctx.fillText('Waiting for camera frame...', 40, 50);
        }

        zones.forEach((zone) => drawZonePolygon(ctx, zone, zone.id === selectedZoneId));

        if (draftRect) {
            const { x1, y1, x2, y2 } = draftRect;
            const minX = Math.min(x1, x2);
            const minY = Math.min(y1, y2);
            const w = Math.abs(x2 - x1);
            const h = Math.abs(y2 - y1);

            ctx.setLineDash([8, 6]);
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 2;
            ctx.strokeRect(minX, minY, w, h);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
            ctx.fillRect(minX, minY, w, h);
        }
    }, [draftRect, selectedZoneId, zones]);

    useEffect(() => {
        redrawCanvas();
    }, [redrawCanvas]);

    useEffect(() => {
        if (!frameSrc) return;
        const img = new Image();
        img.onload = () => {
            frameImageRef.current = img;
            setCanvasSize({ width: img.width || 1280, height: img.height || 720 });
            redrawCanvas();
        };
        img.src = frameSrc;
    }, [frameSrc, redrawCanvas]);

    const getCanvasPoint = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(canvas.width, Math.round((event.clientX - rect.left) * (canvas.width / rect.width))));
        const y = Math.max(0, Math.min(canvas.height, Math.round((event.clientY - rect.top) * (canvas.height / rect.height))));
        return { x, y };
    };

    const handleCanvasMouseDown = (event) => {
        if (!isDrawingMode) return;
        const { x, y } = getCanvasPoint(event);
        dragStartRef.current = { x, y };
        setDraftRect({ x1: x, y1: y, x2: x, y2: y });
        setIsDragging(true);
    };

    const handleCanvasMouseMove = (event) => {
        if (!isDrawingMode || !isDragging || !dragStartRef.current) return;
        const { x, y } = getCanvasPoint(event);
        const start = dragStartRef.current;
        setDraftRect({ x1: start.x, y1: start.y, x2: x, y2: y });
    };

    const handleCanvasMouseUp = () => {
        if (!isDrawingMode) return;
        setIsDragging(false);
    };

    const addDraftZone = () => {
        if (!draftRect) return;
        const minX = Math.min(draftRect.x1, draftRect.x2);
        const minY = Math.min(draftRect.y1, draftRect.y2);
        const maxX = Math.max(draftRect.x1, draftRect.x2);
        const maxY = Math.max(draftRect.y1, draftRect.y2);

        if ((maxX - minX) < 20 || (maxY - minY) < 20) return;

        const polygon = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
        const cleanName = newZoneName.trim();
        const zoneLabel = cleanName || `Zone ${zones.length + 1}`;
        const zoneId = cleanName
            ? cleanName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `ZONE_${Date.now()}`
            : `ZONE_${Date.now()}`;

        const nextZone = {
            id: zoneId,
            name: zoneLabel,
            polygon,
            active: true
        };

        const nextZones = [...zones, nextZone];
        setZones(nextZones);
        syncZones(nextZones);
        setSelectedZoneId(zoneId);
        setNewZoneName('');
        setDraftRect(null);
        setIsDrawingMode(false);
    };

    const clearDraft = () => {
        setDraftRect(null);
        dragStartRef.current = null;
    };

    const syncZones = async (nextZones) => {
        setSaveState('saving');
        try {
            await fetch('/api/zones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nextZones)
            });
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 1500);
        } catch {
            setSaveState('idle');
        }
    };

  const handleSave = async () => {
            await syncZones(zones);
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
                        onClick={() => {
                          setIsDrawingMode((prev) => !prev);
                          clearDraft();
                        }}
                        className="bg-teal-500 text-background px-3 py-1 rounded hover:bg-teal-400 transition-colors text-[10px] font-mono tracking-wider"
                    >
                        <span className="inline-flex items-center gap-1"><Plus size={14} /> ADD CUSTOM BOX</span>
                    </button>
                </div>
                
                <div className="flex-1 space-y-4">
                                        {loadingZones ? (
                                            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                                                <Loader2 size={14} className="animate-spin" />
                                                Loading zone definitions...
                                            </div>
                                        ) : zones.map((zone) => (
                                                <div
                                                    key={zone.id}
                                                    className={`bg-white/5 border p-4 rounded-xl flex items-center justify-between group cursor-pointer ${selectedZoneId === zone.id ? 'border-teal-500/70' : 'border-white/5'}`}
                                                    onClick={() => setSelectedZoneId(zone.id)}
                                                >
                            <div className="flex flex-col">
                                <span className="font-display font-bold text-white uppercase">{zone.name}</span>
                                                                <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">{(zone.polygon || []).length} POL POINTS</span>
                            </div>
                                                        <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const nextZones = zones.map((z) => z.id === zone.id ? { ...z, active: !z.active } : z);
                                                                        setZones(nextZones);
                                                                        syncZones(nextZones);
                                                                    }}
                                                                    className={`px-2 py-1 text-[9px] rounded border ${zone.active !== false ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-500/10 border-slate-500/30 text-slate-400'}`}
                                                                >
                                                                    {zone.active !== false ? 'ON' : 'OFF'}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const nextZones = zones.filter((z) => z.id !== zone.id);
                                                                        setZones(nextZones);
                                                                        syncZones(nextZones);
                                                                        if (selectedZoneId === zone.id) setSelectedZoneId(null);
                                                                    }}
                                                                    className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                                                                    title="Delete zone"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                            </div>
                        </div>
                                        ))}
                    
                    {isDrawingMode && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                                                <label className="text-[10px] font-mono text-slate-500 uppercase block">Draw New Area From Camera</label>
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
                                  ref={canvasRef}
                                                                    width={canvasSize.width}
                                                                    height={canvasSize.height}
                                  className="w-full h-full"
                                  onMouseDown={handleCanvasMouseDown}
                                  onMouseMove={handleCanvasMouseMove}
                                  onMouseUp={handleCanvasMouseUp}
                                  onMouseLeave={handleCanvasMouseUp}
                                />
                                <div className="absolute left-2 top-2 text-[10px] font-mono px-2 py-1 rounded bg-black/50 border border-white/10 text-slate-300">
                                  {status === 'connected' ? 'LIVE CAMERA FRAME' : 'NO LIVE FEED'}
                                </div>
                            <div className="absolute top-2 right-2 flex gap-2">
                                <button 
                                    onClick={addDraftZone}
                                    className="bg-teal-500 text-background text-[8px] font-bold px-3 py-1 rounded shadow-lg"
                                >
                                    ADD ZONE
                                </button>
                                <button 
                                    onClick={clearDraft}
                                    className="bg-white/10 text-white text-[8px] font-bold px-3 py-1 rounded"
                                >
                                    CLEAR
                                </button>
                            </div>
                            <div className="absolute bottom-2 left-2 text-[9px] font-mono px-2 py-1 rounded bg-black/50 border border-white/10 text-slate-300">
                              Drag on the frame to draw a new green box area
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
            <button onClick={handleSave} className="px-8 py-3 bg-teal-500 rounded-lg text-background font-display font-bold hover:bg-teal-400 transition-transform active:scale-95 flex items-center gap-2">
                {saveState === 'saving' && <Loader2 size={16} className="animate-spin" />}
                {saveState === 'saved' && <Check size={16} />}
                {saveState === 'saving' ? 'SAVING...' : saveState === 'saved' ? 'SAVED' : 'SAVE CONFIGURATION'}
            </button>
      </div>
    </div>
  );
}
