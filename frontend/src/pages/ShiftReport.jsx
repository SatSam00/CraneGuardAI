/**
 * Module 3F: AI-Generated Shift Safety Report
 * =============================================
 * Allows supervisors to trigger a Claude claude-sonnet-4-20250514-generated safety report at
 * shift end. Displays the report inline and links to the PDF in Supabase.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Loader2, Send, Download, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { API_URL } from '../config';

const today = new Date();
const isoDate = (d) => d.toISOString().slice(0, 16);

export default function ShiftReport() {
  const [shiftStart, setShiftStart] = useState(
    isoDate(new Date(today.setHours(7, 0, 0, 0)))
  );
  const [shiftEnd, setShiftEnd] = useState(isoDate(new Date()));
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);

  const generateReport = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/report/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_start: new Date(shiftStart).toISOString(),
          shift_end:   new Date(shiftEnd).toISOString()
        })
      });
      const data = await res.json();
      if (data.status === 'error') {
        setError(data.error || 'Report generation failed.');
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e.message || 'Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">

      {/* Header */}
      <div className="p-4 md:p-6 border-b border-white/5 bg-card/60 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-teal-400" />
            <h2 className="text-lg font-display font-bold text-white tracking-widest uppercase">
              AI Shift Report
            </h2>
            <span className="text-[9px] font-mono text-fuchsia-400 border border-fuchsia-500/30 px-2 py-0.5 rounded-full uppercase ml-2">
              Claude AI
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1 hidden md:block">
            Generate OSHA-formatted safety analysis for any shift period
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">

          {/* Time Range Picker */}
          <div className="bg-card border border-white/5 rounded-2xl p-6">
            <h3 className="text-sm font-display font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock size={14} className="text-teal-400" />
              Shift Time Range
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Shift Start
                </label>
                <input
                  type="datetime-local"
                  value={shiftStart}
                  onChange={e => setShiftStart(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Shift End
                </label>
                <input
                  type="datetime-local"
                  value={shiftEnd}
                  onChange={e => setShiftEnd(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            <button
              onClick={generateReport}
              disabled={loading}
              className="mt-5 flex items-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/40 text-background font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-lg shadow-teal-500/20 uppercase tracking-wider font-display"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Generating with Claude...</>
                : <><Send size={16} /> Generate AI Report</>
              }
            </button>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3"
              >
                <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-400">Report Generation Failed</p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">{error}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Ensure <code className="text-slate-300">ANTHROPIC_API_KEY</code> is set in backend .env.
                    A plain-text fallback report will still be generated without Anthropic.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-white/5 rounded-2xl overflow-hidden"
              >
                {/* Result header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5 bg-teal-500/5">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-teal-400" />
                    <span className="text-sm font-bold text-teal-400 uppercase tracking-widest font-display">
                      Report Generated
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {result.telegram_sent && (
                      <span className="text-[10px] font-mono border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded-full uppercase">
                        📨 Telegram Sent
                      </span>
                    )}
                    {result.pdf_url && (
                      <a
                        href={result.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] font-mono border border-teal-500/30 text-teal-400 px-2 py-0.5 rounded-full uppercase hover:bg-teal-500/10 transition-colors"
                      >
                        <Download size={10} /> Download PDF
                      </a>
                    )}
                  </div>
                </div>

                {/* Report text */}
                <div className="p-5">
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-auto border border-white/5 bg-black/20 rounded-xl p-4">
                    {result.report_text}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Info Panel */}
          {!result && !loading && !error && (
            <div className="bg-fuchsia-500/5 border border-fuchsia-500/10 rounded-xl p-5">
              <h4 className="text-[11px] font-mono text-fuchsia-300 uppercase tracking-widest mb-3 font-bold">
                📄 What the Report Includes
              </h4>
              <ul className="text-[11px] font-mono text-slate-400 flex flex-col gap-1.5">
                <li>• Executive Summary with overall safety grade (A–F)</li>
                <li>• Incident breakdown by type and severity</li>
                <li>• Highest-risk zone analysis table</li>
                <li>• Worker safety compliance assessment</li>
                <li>• OSHA 1926 specific recommendations</li>
                <li>• Next-shift priority actions for safety supervisor</li>
                <li>• Exported as PDF to Supabase Storage</li>
                <li>• Sent to supervisor via Telegram</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
