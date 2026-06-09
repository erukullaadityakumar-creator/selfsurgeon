import React, { useState } from 'react';
import { useSurgeon } from '../context/SurgeonContext';
import { PromptVersion } from '../types';
import { 
  X, Check, History, ArrowUpDown, ChevronRight, FileCode, CheckCircle2, 
  CornerDownLeft, AlertCircle, GitCompare, RefreshCw
} from 'lucide-react';

export default function PromptsView() {
  const { prompts, status, rollbackPromptVersion } = useSurgeon();

  const [leftVerId, setLeftVerId] = useState('v_20240615_091512');
  const [rightVerId, setRightVerId] = useState('v_20240620_183000');
  
  // Rollback confirmation states
  const [rollbackConfirmVersion, setRollbackConfirmVersion] = useState<string | null>(null);

  const activePromptProduct = prompts.find(p => p.status === 'PRODUCTION') || prompts[0];

  const leftPrompt = prompts.find(p => p.version === leftVerId) || prompts[0];
  const rightPrompt = prompts.find(p => p.version === rightVerId) || prompts[0];

  const handleRollbackExecute = () => {
    if (rollbackConfirmVersion) {
      rollbackPromptVersion(rollbackConfirmVersion);
      setRollbackConfirmVersion(null);
    }
  };

  // Helper function to simulate a line-by-line split prompt diff (green=added, red=removed, yellow=modified)
  const renderCompareSplitDiff = (left: string, right: string) => {
    const leftLines = left.split('\n');
    const rightLines = right.split('\n');
    const maxLines = Math.max(leftLines.length, rightLines.length);

    const diffRows = [];
    for (let i = 0; i < maxLines; i++) {
      const leftLine = leftLines[i] || '';
      const rightLine = rightLines[i] || '';

      // Set default diff styles based on mock content lines
      let leftColor = 'text-gray-400';
      let leftBg = '';
      let rightColor = 'text-gray-300';
      let rightBg = '';

      if (leftLine !== rightLine) {
        if (!leftLine && rightLine) {
          // Addition on right
          rightBg = 'bg-emerald-500/10 border-l-2 border-emerald-500';
          rightColor = 'text-[#10b981] font-bold';
        } else if (leftLine && !rightLine) {
          // Deletion on left
          leftBg = 'bg-rose-500/10 border-l-2 border-rose-500';
          leftColor = 'text-red-500 line-through';
        } else {
          // Modification
          leftBg = 'bg-amber-500/10 border-l-2 border-amber-500';
          leftColor = 'text-amber-500/80';
          rightBg = 'bg-emerald-500/10 border-l-2 border-emerald-500';
          rightColor = 'text-[#10b981] font-bold';
        }
      }

      diffRows.push(
        <div key={i} className="grid grid-cols-1 md:grid-cols-2 border-b border-white/[0.02] font-mono text-xs">
          <div className={`p-2 overflow-x-auto min-h-[30px] pr-4 ${leftBg} ${leftColor} break-words whitespace-pre-wrap`}>
            <span className="text-[#94a3b8]/30 select-none mr-2">{(i+1).toString().padStart(2, '0')}</span>
            {leftLine}
          </div>
          <div className={`p-2 border-l border-white/5 overflow-x-auto min-h-[30px] pl-4 ${rightBg} ${rightColor} break-words whitespace-pre-wrap`}>
            <span className="text-[#94a3b8]/30 select-none mr-2">{(i+1).toString().padStart(2, '0')}</span>
            {rightLine}
          </div>
        </div>
      );
    }

    return (
      <div className="border border-white/10 rounded-xl overflow-hidden bg-[#050505]">
        {/* Diff Legend labels */}
        <div className="grid grid-cols-2 bg-[#121212] text-zinc-400 font-mono text-[10px] uppercase border-b border-white/10 p-2 text-center">
          <div className="font-bold border-r border-white/5 truncate">ID LEFT: {leftVerId}</div>
          <div className="font-bold truncate">ID RIGHT: {rightVerId}</div>
        </div>
        <div className="flex justify-center gap-4 bg-[#0a0a0f] border-b border-white/5 py-1.5 text-[9px] font-mono text-zinc-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-rose-500/20 border-l border-rose-500" /> DELETED / INLINE-RED</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500/20 border-l border-amber-500" /> MODIFIED</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500/20 border-l border-emerald-500" /> ADDED / INSERTION</span>
        </div>
        <div className="max-h-[380px] overflow-y-auto divide-y divide-white/5">
          {diffRows}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 font-sans select-none">
      
      {/* Left Column — Version Registry list (5 cols) */}
      <div className="xl:col-span-4 bg-[#0d0d0f] border border-white/10 rounded-2xl p-6">
        <div className="mb-4">
          <h2 className="text-md font-bold text-[#f1f5f9] tracking-tight">Vulnerability Prompt Registry</h2>
          <p className="text-xs text-[#94a3b8] font-mono">Archive pipeline containing all compiled prompts</p>
        </div>

        {/* Release Timelines list */}
        <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
          {prompts.map((version) => {
            const isProduction = version.version === status.current_prompt_version;
            
            // Release Status labels
            let statusBadge = '';
            if (isProduction) {
              statusBadge = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
            } else if (version.status === 'SUPERSEDED') {
              statusBadge = 'bg-white/5 border-white/10 text-gray-400';
            } else if (version.status === 'ARCHIVED') {
              statusBadge = 'bg-rose-500/5 border-rose-500/10 text-rose-500/50';
            } else {
              statusBadge = 'bg-amber-500/10 border-amber-500/30 text-amber-500';
            }

            return (
              <div 
                key={version.version}
                className={`p-4 bg-[#141414] border rounded-xl transition-all ${
                  isProduction 
                    ? 'border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.03)]' 
                    : 'border-white/5 hover:border-white/15'
                }`}
              >
                {/* Release Card header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-white tracking-tight">{version.version}</span>
                  <span className={`text-[9px] px-2 py-0.5 font-mono border rounded font-semibold ${statusBadge}`}>
                    {isProduction ? 'PRODUCTION' : version.status}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1.5 mb-2">
                  <span className="font-bold text-emerald-400">ACCURACY SCORE: {Math.round(version.accuracy * 100)}%</span>
                  <span>•</span>
                  <span>{new Date(version.timestamp).toLocaleDateString()}</span>
                </div>

                <p className="text-xs text-[#94a3b8] leading-relaxed mb-3 pr-2">
                  {version.changelog}
                </p>

                {/* Card Rollback Trigger if not in prod */}
                {!isProduction && (
                  <div className="border-t border-white/[0.04] pt-2.5 flex justify-end">
                    <button
                      onClick={() => setRollbackConfirmVersion(version.version)}
                      className="text-[10px] font-mono font-medium px-2.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-all flex items-center gap-1"
                    >
                      <CornerDownLeft size={10} />
                      <span>Rollback Version</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column — Prompt Differential Tool (8 cols) */}
      <div className="xl:col-span-8 bg-[#0d0d0f] border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/[0.04] pb-4">
          <div>
            <h2 className="text-md font-bold text-[#f1f5f9] tracking-tight flex items-center gap-2">
              <span className="text-amber-500">📊</span> Custom Prompt Comparison Tool
            </h2>
            <p className="text-xs text-[#94a3b8] font-mono">Render and trace differences line-by-line</p>
          </div>

          {/* Interactive version selectors */}
          <div className="flex items-center gap-2">
            <select
              value={leftVerId}
              onChange={(e) => setLeftVerId(e.target.value)}
              className="bg-[#0a0a0f] border border-[rgba(255,255,255,0.08)] rounded-lg py-1 px-2.5 text-xs font-mono text-white focus:outline-none"
            >
              {prompts.map(p => (
                <option key={p.version} value={p.version}>Left: {p.version}</option>
              ))}
            </select>
            <span className="text-[#94a3b8] font-mono text-xs">vs</span>
            <select
              value={rightVerId}
              onChange={(e) => setRightVerId(e.target.value)}
              className="bg-[#0a0a0f] border border-[rgba(255,255,255,0.08)] rounded-lg py-1 px-2.5 text-xs font-mono text-white focus:outline-none"
            >
              {prompts.map(p => (
                <option key={p.version} value={p.version}>Right: {p.version}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Diff view content */}
        {renderCompareSplitDiff(leftPrompt.content, rightPrompt.content)}
      </div>

      {/* Rollback Safety confirmation Modal */}
      {rollbackConfirmVersion && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-2">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-md font-bold text-[#f1f5f9]">Authorize Prompt Rollback?</h3>
              <p className="text-xs text-[#94a3b8] leading-relaxed">
                You are about to roll back the active production system agent tag to version <span className="text-amber-500 font-mono font-bold font-mono">{rollbackConfirmVersion}</span>. This redirects live evaluation validations.
              </p>
              
              <div className="p-3 bg-[#0a0a0f] rounded-lg border border-white/5 text-[11px] text-gray-400 font-mono text-left">
                Accuracy score will adjust to match target parameters history version.
              </div>
            </div>

            <div className="bg-[#0a0a0f] p-4 flex gap-2 border-t border-[rgba(255,255,255,0.08)]">
              <button
                onClick={() => setRollbackConfirmVersion(null)}
                className="flex-1 py-2 text-xs font-mono text-gray-400 hover:text-white hover:bg-white/5 border border-white/5 rounded-lg transition-all"
              >
                Cancel Reversion
              </button>
              <button
                onClick={handleRollbackExecute}
                className="flex-1 py-2 text-xs font-mono font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-lg hover:scale-[1.01] transition-all"
              >
                Confirm ROLLBACK
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
