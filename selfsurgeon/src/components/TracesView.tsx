import React, { useState } from 'react';
import { useSurgeon } from '../context/SurgeonContext';
import { Trace } from '../types';
import { 
  X, Search, SlidersHorizontal, AlertCircle, CheckCircle, 
  ChevronRight, Calendar, Layers, Activity, Database
} from 'lucide-react';
import JsonTreeViewer from './JsonTreeViewer';

export default function TracesView() {
  const { traces, selectedTrace, setSelectedTrace, addTraceToDataset, selectedTraceId, setSelectedTraceId } = useSurgeon();

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreRange, setScoreRange] = useState<number>(1.0);
  const [selectedFailures, setSelectedFailures] = useState<string[]>([]);
  const [failedOnly, setFailedOnly] = useState(false);
  
  // Modal toggle state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeModalTrace, setActiveModalTrace] = useState<Trace | null>(null);

  // List of all possible non-null failures in mock set
  const failureChoices = ['BOUNDARY_AMBIGUITY', 'TOOL_MISUSE', 'RECURSIVE_LOOP', 'CONTEXT_DRIFT', 'HALLUCINATION', 'OUTPUT_FORMAT_VIOLATION'];

  const toggleFailureSelection = (type: string) => {
    setSelectedFailures(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Click on Card Handler
  const openTraceModal = (trace: Trace) => {
    setActiveModalTrace(trace);
    setIsDetailModalOpen(true);
  };

  // Filter application
  const filteredTraces = traces.filter(trace => {
    const matchesSearch = trace.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          trace.input.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          trace.output.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesScore = trace.score <= scoreRange;
    
    const matchesFailureType = selectedFailures.length === 0 || 
                               (trace.failure_type && selectedFailures.includes(trace.failure_type));

    const matchesFailToggle = !failedOnly || trace.failure_type !== null;

    return matchesSearch && matchesScore && matchesFailureType && matchesFailToggle;
  });

  return (
    <div className="space-y-6 font-sans select-none">
      
      {/* Search and Advanced Observability Sliders */}
      <div className="bg-[#0d0d0f] border border-white/10 rounded-2xl p-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4 border-b border-white/[0.04] pb-4">
          <div>
            <h2 className="text-md font-bold text-[#f1f5f9] tracking-tight">SQLite Trace Analysis</h2>
            <p className="text-xs text-[#94a3b8] font-mono">Query local LLM interactions and validation parameters</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer font-mono text-xs text-[#94a3b8]">
              <input
                type="checkbox"
                checked={failedOnly}
                onChange={(e) => setFailedOnly(e.target.checked)}
                className="rounded text-emerald-400 focus:ring-0 bg-[#0a0a0f] border-white/10"
              />
              <span className={failedOnly ? 'text-[#ff3366] font-bold' : ''}>FAILED EVALS ONLY</span>
            </label>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Search Term input */}
          <div className="md:col-span-4">
            <span className="text-[10px] font-mono font-semibold text-gray-500 block mb-2 uppercase tracking-wider">SEARCH STRINGS</span>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search trace payload..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-white/15 rounded-lg py-1.5 pl-9 pr-4 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Rating score range selector */}
          <div className="md:col-span-3">
            <div className="flex justify-between items-center text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <span>SCORE UPPER LIMIT</span>
              <span className="text-emerald-400 font-bold">{scoreRange.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-mono">0.0</span>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={scoreRange}
                onChange={(e) => setScoreRange(+e.target.value)}
                className="flex-1 accent-emerald-400 h-1.5 bg-[#0a0a0f] rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-gray-500 font-mono">1.0</span>
            </div>
          </div>

          {/* Failure type checklist multi-select selection badges */}
          <div className="md:col-span-5">
            <span className="text-[10px] font-mono font-semibold text-gray-500 block mb-2 uppercase tracking-wider">FILTER FAILURE TYPE</span>
            <div className="flex flex-wrap gap-1.5">
              {failureChoices.map(type => {
                const isSelected = selectedFailures.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleFailureSelection(type)}
                    className={`text-[9px] px-2 py-1 rounded font-mono transition-all border ${
                      isSelected
                        ? 'bg-[#ff3366]/10 border-[#ff3366]/40 text-[#ff3366] font-bold'
                        : 'bg-[#0a0a0f] border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Grid of raw results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTraces.length === 0 ? (
          <div className="col-span-full bg-[#0d0d0f] border border-white/10 p-12 text-center rounded-2xl text-zinc-500 font-mono text-xs">
            No diagnostic traces found matching criteria. Update sliders or search query!
          </div>
        ) : (
          filteredTraces.map((trace) => {
            
            // Score badges color styles
            let scoreBg = '';
            let scoreBorder = '';
            let scoreColor = '';

            if (trace.score >= 0.8) {
              scoreBg = 'bg-[rgba(16,185,129,0.1)]';
              scoreBorder = 'border-[#10b981]/30';
              scoreColor = 'text-[#10b981]';
            } else if (trace.score >= 0.5) {
              scoreBg = 'bg-[rgba(245,158,11,0.1)]';
              scoreBorder = 'border-[#f59e0b]/30';
              scoreColor = 'text-amber-500';
            } else {
              scoreBg = 'bg-[rgba(255,51,102,0.1)]';
              scoreBorder = 'border-[#ff3366]/30';
              scoreColor = 'text-[#ff3366]';
            }

            return (
              <div 
                key={trace.id}
                onClick={() => openTraceModal(trace)}
                className="bg-[#121212] border border-white/5 rounded-xl p-5 hover:translate-y-[-2px] hover:border-white/20 hover:shadow-[0_4px_25px_rgba(255,255,255,0.01)] cursor-pointer transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header metrics */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div>
                      <span className="font-mono text-xs text-white font-bold">{trace.id}</span>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{new Date(trace.timestamp).toLocaleTimeString()}</p>
                    </div>
                    
                    <span className={`text-[10px] px-2 py-0.5 font-mono border rounded ${scoreBg} ${scoreBorder} ${scoreColor}`}>
                      ACC: {trace.score.toFixed(2)}
                    </span>
                  </div>

                  {/* Failure Tag if present */}
                  {trace.failure_type && (
                    <span className="inline-block text-[9px] px-2 py-0.5 bg-[#ff3366]/15 border border-[#ff3366]/20 text-[#ff3366] font-mono rounded font-bold mb-3 uppercase tracking-wider">
                      {trace.failure_type}
                    </span>
                  )}

                  {/* Intercept preview outputs */}
                  <div className="space-y-2.5 mt-1 font-mono text-[11px]">
                    <div className="bg-[#0a0a0f] p-2.5 rounded border border-white/5">
                      <span className="text-[9px] text-gray-500 block select-none uppercase">INPUT PREVIEW</span>
                      <p className="text-gray-300 truncate mt-1">
                        {trace.input}
                      </p>
                    </div>
                    <div className="bg-[#0a0a0f] p-2.5 rounded border border-white/5">
                      <span className="text-[9px] text-gray-500 block select-none uppercase">OUTPUT DELIVERED</span>
                      <p className="text-gray-300 truncate mt-1 text-amber-500">
                        {trace.output}
                      </p>
                    </div>
                  </div>
                </div>

                 {/* Card footer details view button */}
                <div className="border-t border-white/5 pt-3 mt-4 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-gray-500">SPANS COUNT: {trace.spans.length} elements</span>
                  <span className="text-emerald-400 flex items-center gap-0.5 hover:underline">
                    Expand Details <ChevronRight size={12} />
                  </span>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Trace Detail Modal */}
      {isDetailModalOpen && activeModalTrace && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          
          <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            
            {/* Modal header details */}
            <div className="bg-[#0a0a0f] p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-400">{activeModalTrace.id}</span>
                  <span className="text-[10px] text-gray-500 font-mono">| {new Date(activeModalTrace.timestamp).toLocaleString()}</span>
                </div>
                <h3 className="text-md font-bold text-[#f1f5f9] mt-0.5">Span-by-Span Diagnostic Chart</h3>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="text-[#94a3b8] hover:text-[#f1f5f9] p-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scroll area body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Dynamic breakdown parameters grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0a0a0f] p-3 rounded-lg border border-white/5 font-mono">
                  <span className="text-[9px] text-gray-500 block leading-tight">EVALUATION CONFIDENCE SCORE</span>
                  <span className="text-md font-bold text-emerald-400 block mt-1">{activeModalTrace.score.toFixed(2)} / 1.0</span>
                </div>
                <div className="bg-[#0a0a0f] p-3 rounded-lg border border-white/5 font-mono">
                  <span className="text-[9px] text-gray-500 block leading-tight">PREDICTION RESOLVER</span>
                  <span className="text-md font-bold text-amber-500 block mt-1 truncate">{activeModalTrace.prediction}</span>
                </div>
                <div className="bg-[#0a0a0f] p-3 rounded-lg border border-white/5 font-mono">
                  <span className="text-[9px] text-gray-500 block leading-tight">FAILURE TAG STATUS</span>
                  <span className={`text-sm font-bold block mt-1 ${activeModalTrace.failure_type ? 'text-[#ff3366]' : 'text-[#10b981]'}`}>
                    {activeModalTrace.failure_type || 'COHERENT (PASSED)'}
                  </span>
                </div>
              </div>

              {/* Collapsed Trace timing spans list */}
              <div>
                <h4 className="text-xs font-mono font-bold text-[#94a3b8] mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Layers size={14} className="text-emerald-400" /> Span Execution Tree
                </h4>
                
                <div className="space-y-2">
                  {activeModalTrace.spans.map((sp, sIdx) => {
                    return (
                      <div 
                        key={sp.id}
                        className="bg-[#0a0a0f] rounded-lg border border-white/5 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold bg-[#050505] border border-white/10 px-1.5 py-0.5 rounded text-gray-300">
                              {sp.type}
                            </span>
                            <span className="font-bold text-white leading-none">{sp.name}</span>
                            <span className="text-[10px] text-gray-500">({sp.id})</span>
                          </div>
                          
                          <div className="mt-2 text-[11px] text-[#94a3b8] space-y-1">
                            <div><span className="text-gray-500">I:</span> {sp.input}</div>
                            <div><span className="text-gray-500">O:</span> {sp.output}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-[10px] text-gray-500 block">LATENCY</span>
                            <span className="font-bold text-emerald-400">{sp.latency_ms}ms</span>
                          </div>
                          <span className={`text-[9px] px-2 py-0.5 rounded font-bold border ${
                            sp.status === 'SUCCESS' 
                              ? 'bg-[#10b981]/15 border-[#10b981]/30 text-[#10b981]' 
                              : 'bg-[#ff3366]/15 border-[#ff3366]/30 text-[#ff3366]'
                          }`}>
                            {sp.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* JSON tree view toggle */}
              <div>
                <h4 className="text-xs font-mono font-bold text-[#94a3b8] mb-3 uppercase tracking-wider">
                  Raw Observability telemetry Payload
                </h4>
                <JsonTreeViewer data={activeModalTrace.full_json} />
              </div>

            </div>

            {/* Modal action bar footer */}
            <div className="p-4 bg-[#0a0a0f] border-t border-white/10 flex justify-between">
              <button 
                onClick={() => { addTraceToDataset(activeModalTrace.id); setIsDetailModalOpen(false); }}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono font-medium px-4 py-2 rounded text-emerald-400 hover:scale-[1.01] transition-all"
              >
                Add trace to Dataset
              </button>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="bg-white/5 hover:bg-white/10 text-xs font-mono font-medium px-4 py-2 rounded text-[#94a3b8] hover:text-[#f1f5f9] transition-all"
              >
                Close Trace Diagnostics
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
