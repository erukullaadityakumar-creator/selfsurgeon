import React, { useRef, useEffect } from 'react';
import { Terminal, Trash2, Eye, CircleSlash } from 'lucide-react';
import { useSurgeon } from '../context/SurgeonContext';

export default function TerminalWidget() {
  const { logs, clearLogs, status } = useSurgeon();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const displayedLogs = logs.slice(-12);

  return (
    <div className="bg-[#0d0d0f] border border-white/10 rounded-xl overflow-hidden font-mono mt-6">
      <div className="bg-[#121212] px-4 py-2 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-400" />
          <span className="text-xs font-bold text-[#f1f5f9] uppercase tracking-wider">LOCAL HEALING RUN LOG</span>
        </div>
        <div className="flex items-center gap-2">
          {status.live_agent_active && (
            <span className="flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
              </span>
              <span className="text-[9px] text-emerald-400 tracking-widest font-bold">STREAM LIVE</span>
            </span>
          )}
          <button
            onClick={clearLogs}
            className="text-[#94a3b8] hover:text-[#ff3366] transition-colors p-1 rounded hover:bg-[rgba(255,255,255,0.05)]"
            title="Clear console log list"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="p-4 h-48 overflow-y-auto text-xs space-y-2 select-text font-mono">
        {displayedLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#94a3b8]/40 space-y-1">
            <CircleSlash size={24} />
            <span className="text-[10px]">DIAGNOSTIC CONSOLE PORT CLOSED</span>
          </div>
        ) : (
          displayedLogs.map((log) => {
            let color = 'text-[#94a3b8]';
            let prefix = '[INFO]';
            if (log.level === 'SUCCESS') {
              color = 'text-[#10b981]';
              prefix = '[ OK ]';
            } else if (log.level === 'WARN') {
              color = 'text-[#f59e0b] font-semibold';
              prefix = '[WARN]';
            } else if (log.level === 'ERROR') {
              color = 'text-[#ff3366] font-bold';
              prefix = '[FAIL]';
            } else if (log.level === 'ANALYZE') {
              color = 'text-emerald-400 font-semibold';
              prefix = '[SOLV]';
            }

            return (
              <div key={log.id} className="flex gap-2 leading-relaxed animate-fade-in">
                <span className="text-[#94a3b8]/50 select-none">[{log.timestamp}]</span>
                <span className={color}>{prefix}</span>
                <span className="text-[#f1f5f9] break-all">{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Heartbeat EKG waveform line in terminal background/footer */}
      <div className="h-2 bg-[#050505] border-t border-white/5 relative overflow-hidden flex items-center">
        <svg viewBox="0 0 1000 20" className="w-full h-full opacity-30 text-emerald-400 fill-none">
          <path
            d="M0 10 L450 10 L455 3 L460 17 L465 10 L470 10 L475 10 L480 3 L485 17 L490 10 L500 10 L900 10 L905 3 L910 17 L915 10 L920 10 L1000 10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="animate-[pulse_1.8s_infinite]"
          />
        </svg>
      </div>
    </div>
  );
}
