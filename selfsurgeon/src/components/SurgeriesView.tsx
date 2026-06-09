import React, { useState } from 'react';
import { useSurgeon } from '../context/SurgeonContext';
import { Surgery } from '../types';
import { 
  X, Download, ArrowUpDown, ChevronLeft, ChevronRight, 
  Search, SlidersHorizontal, Calendar, Info, HelpCircle, AlertOctagon
} from 'lucide-react';

interface SurgeriesViewProps {
  setCurrentTab: (tab: string) => void;
}

export default function SurgeriesView({ setCurrentTab }: SurgeriesViewProps) {
  const { surgeries, selectedSurgeryId, setSelectedSurgeryId, setSelectedTraceId, analyzeTrace } = useSurgeon();

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFailureType, setFilterFailureType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortField, setSortField] = useState<keyof Surgery>('timestamp');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sorting Handler
  const handleSort = (field: keyof Surgery) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Failure Type', 'Affected Spans', 'Baseline Accuracy', 'Candidate Accuracy', 'Improvement', 'Status', 'Version'];
    const rows = surgeries.map(s => [
      s.id,
      s.timestamp,
      s.failure_type,
      s.affected_traces,
      s.baseline_accuracy,
      s.candidate_accuracy,
      s.improvement,
      s.deploy_status,
      s.new_version
    ]);

    const csvContent = 
      "data:text/csv;charset=utf-8," + 
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `selfsurgeon_surgeries_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Click handler to redirect trace to view raw trace
  const handleTraceLink = async (traceId: string) => {
    setSelectedSurgeryId(null); // close drawer
    setCurrentTab('traces');
    setSelectedTraceId(traceId);
    await analyzeTrace(traceId);
  };

  // List of all unique failure types for dropdown choice
  const failureTypesList = Array.from(new Set(surgeries.map(s => s.failure_type)));

  // Filter & Search Logic
  const filteredSurgeries = surgeries.filter(s => {
    const matchesSearch = s.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.fix_explanation.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.failure_type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFailureType = filterFailureType === 'ALL' || s.failure_type === filterFailureType;
    const matchesStatus = filterStatus === 'ALL' || s.deploy_status === filterStatus;

    return matchesSearch && matchesFailureType && matchesStatus;
  });

  // Sort Logic
  const sortedSurgeries = [...filteredSurgeries].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === 'string') {
      return sortAsc 
        ? (valA as string).localeCompare(valB as string)
        : (valB as string).localeCompare(valA as string);
    }

    if (typeof valA === 'number') {
      return sortAsc 
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    }

    return 0;
  });

  // Pagination Logic
  const totalPages = Math.ceil(sortedSurgeries.length / itemsPerPage) || 1;
  const paginatedSurgeries = sortedSurgeries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Selected surgery object for drawer slide-over
  const activeSurg = surgeries.find(s => s.id === selectedSurgeryId);

  return (
    <div className="relative font-sans select-none min-h-[500px]">
      
      {/* Search & Action bar */}
      <div className="bg-[#121212] border border-white/10 rounded-2xl p-5 mb-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-md font-bold text-white tracking-tight">Surgical Auto-Heal Ledger</h2>
            <p className="text-xs text-zinc-400 font-mono">Archive repository of automated agent code operations</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-xs font-mono text-white flex items-center gap-2 hover:scale-[1.01] transition-all"
            >
              <Download size={14} />
              <span>Export Ledger CSV</span>
            </button>
          </div>
        </div>

        {/* Dynamic filter selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/5">
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 font-mono block mb-1">SEARCH OPERATIONS</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="ID, explanation, type..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full bg-[#050505] border border-white/10 rounded-lg py-1.5 pl-9 pr-4 text-xs font-mono text-white focus:outline-none focus:border-white/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-500 font-mono block mb-1">FAILURE SPECS</label>
            <select
              value={filterFailureType}
              onChange={(e) => { setFilterFailureType(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#050505] border border-white/10 rounded-lg py-1.5 px-3 text-xs font-mono text-white focus:outline-none focus:border-white/50"
            >
              <option value="ALL">ALL FAILURE TYPES</option>
              {failureTypesList.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-500 font-mono block mb-1">ROLLOUT STATUS</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#050505] border border-white/10 rounded-lg py-1.5 px-3 text-xs font-mono text-white focus:outline-none focus:border-white/50"
            >
              <option value="ALL">ALL STATUSES</option>
              <option value="DEPLOYED">DEPLOYED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => { setSearchTerm(''); setFilterFailureType('ALL'); setFilterStatus('ALL'); }}
              className="w-full py-1.5 border border-white/5 hover:border-white/10 hover:bg-white/5 text-xs text-zinc-400 font-mono rounded-lg transition-all"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Main Table area */}
      <div className="bg-[#121212] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-[#050505] text-zinc-400 font-mono border-b border-white/10">
                <th className="p-4 cursor-pointer hover:bg-white/5 select-none" onClick={() => handleSort('timestamp')}>
                  <div className="flex items-center gap-1">TIMESTAMP <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-white/5 select-none" onClick={() => handleSort('id')}>
                  <div className="flex items-center gap-1">SURGERY ID <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-white/5 select-none" onClick={() => handleSort('failure_type')}>
                  <div className="flex items-center gap-1">FAILURE TYPE <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-white/5 select-none text-right" onClick={() => handleSort('affected_traces')}>
                  <div className="flex items-center justify-end gap-1">AFFECTED SPANS <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-white/5 select-none text-right" onClick={() => handleSort('baseline_accuracy')}>
                  <div className="flex items-center justify-end gap-1">BASE <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-white/5 select-none text-right" onClick={() => handleSort('candidate_accuracy')}>
                  <div className="flex items-center justify-end gap-1">CANDIDATE <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-white/5 select-none text-right" onClick={() => handleSort('improvement')}>
                  <div className="flex items-center justify-end gap-1">DELTA <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-white/5 select-none" onClick={() => handleSort('deploy_status')}>
                  <div className="flex items-center gap-1">STATUS <ArrowUpDown size={12} /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedSurgeries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-650 font-mono text-xs">
                    No surgeries yet. Use the sidebar to trigger simulations!
                  </td>
                </tr>
              ) : (
                paginatedSurgeries.map((surg) => {
                  let badge = '';
                  if (surg.deploy_status === 'DEPLOYED') {
                    badge = 'bg-white/10 border-white/20 text-white';
                  } else if (surg.deploy_status === 'REJECTED') {
                    badge = 'bg-zinc-800 border-zinc-700 text-zinc-400';
                  } else {
                    badge = 'bg-white/5 border-white/10 text-white animate-pulse';
                  }

                  return (
                    <tr 
                      key={surg.id}
                      onClick={() => setSelectedSurgeryId(surg.id)}
                      className={`hover:bg-white/[0.02] cursor-pointer transition-colors ${
                        selectedSurgeryId === surg.id ? 'bg-white/[0.03]' : ''
                      }`}
                    >
                      <td className="p-4 font-mono text-zinc-400">
                        {new Date(surg.timestamp).toLocaleDateString()} {new Date(surg.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-4 font-mono font-bold text-white">
                        {surg.id}
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-[10px] bg-[#050505] border border-white/10 px-2 py-1 rounded text-zinc-300">
                          {surg.failure_type}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-zinc-450">
                        {surg.affected_traces}
                      </td>
                      <td className="p-4 text-right font-mono text-zinc-500">
                        {Math.round(surg.baseline_accuracy * 100)}%
                      </td>
                      <td className="p-4 text-right font-mono text-white font-bold">
                        {Math.round(surg.candidate_accuracy * 100)}%
                      </td>
                      <td className="p-4 text-right font-mono text-white font-bold">
                        +{Math.round(surg.improvement * 100)}%
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] px-2 py-0.5 font-mono border rounded ${badge}`}>
                          {surg.deploy_status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer Pagination controls */}
        <div className="bg-[#050505] px-4 py-3 flex items-center justify-between border-t border-white/10 text-xs text-zinc-400 font-mono">
          <div>
            Showing {filteredSurgeries.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredSurgeries.length)} of {filteredSurgeries.length} surgeries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 px-3 bg-white/5 hover:bg-white/10 text-zinc-400 rounded disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft size={14} />
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1 px-3 bg-white/5 hover:bg-white/10 text-zinc-400 rounded disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Row Detail Drawer (Slides/Toggles on Right Side) */}
      {activeSurg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end animate-fade-in font-sans">
          
          <div className="w-full max-w-2xl bg-[#0d0d0f] h-full shadow-[0_0_40px_rgba(0,0,0,0.8)] border-l border-white/15 overflow-y-auto flex flex-col justify-between">
            
            {/* Drawer Header */}
            <div>
              <div className="p-6 bg-[#050505] border-b border-white/10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono font-bold text-white">{activeSurg.id}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      activeSurg.deploy_status === 'DEPLOYED' 
                        ? 'bg-white/10 border-white/20 text-white' 
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    }`}>
                      {activeSurg.deploy_status}
                    </span>
                  </div>
                  <h3 className="text-md font-bold text-white">Surgery Diagnostic Blueprint</h3>
                </div>
                <button 
                  onClick={() => setSelectedSurgeryId(null)}
                  className="text-zinc-400 hover:text-white p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Content Body */}
              <div className="p-6 space-y-6">
                
                {/* Visual medical statistics banner overlay */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#050505] p-3 rounded-xl border border-white/5 font-mono">
                    <span className="text-[9px] text-zinc-500 block leading-tight">BENCHMARK INCIDENT ACCURACY</span>
                    <span className="text-md font-bold text-zinc-400 block mt-1">{(activeSurg.baseline_accuracy * 100).toFixed(0)}%</span>
                  </div>
                  <div className="bg-[#050505] p-3 rounded-xl border border-white/5 font-mono">
                    <span className="text-[9px] text-zinc-500 block leading-tight">CANDIDATE SUITE ACCURACY</span>
                    <span className="text-md font-bold text-white block mt-1">{(activeSurg.candidate_accuracy * 100).toFixed(0)}%</span>
                  </div>
                  <div className="bg-[#050505] p-3 rounded-xl border border-white/5 font-mono">
                    <span className="text-[9px] text-zinc-500 block leading-tight">IMPROVEMENT DELTA</span>
                    <span className="text-md font-bold text-white block mt-1">+{Math.round(activeSurg.improvement * 100)}%</span>
                  </div>
                </div>

                {/* Root explanation */}
                <div>
                  <h4 className="text-xs font-mono font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">ROOT CAUSE SYNTHESIS</h4>
                  <p className="text-sm bg-white/[0.02] border border-white/5 p-4 rounded-xl leading-relaxed text-zinc-300">
                    {activeSurg.diagnosis_details}
                  </p>
                </div>

                {/* SVG Chart for Baseline vs Candidate */}
                <div>
                  <h4 className="text-xs font-mono font-bold text-zinc-400 mb-3 uppercase tracking-wider">
                    EXPERIMENT REPORT CHART (BASELINE VS CANDIDATE)
                  </h4>
                  <div className="bg-[#050505] border border-white/5 p-4 rounded-xl">
                    <svg viewBox="0 0 500 220" className="w-full overflow-visible font-mono">
                      {/* Grid Lines */}
                      <line x1="50" y1="20" x2="450" y2="20" stroke="rgba(255,255,255,0.04)" />
                      <line x1="50" y1="70" x2="450" y2="70" stroke="rgba(255,255,255,0.04)" />
                      <line x1="50" y1="120" x2="450" y2="120" stroke="rgba(255,255,255,0.04)" />
                      <line x1="50" y1="170" x2="450" y2="170" stroke="rgba(255,255,255,0.08)" />

                      {/* Y-Axis scale tags */}
                      <text x="35" y="24" textAnchor="end" fill="#71717a" className="text-[10px]">100%</text>
                      <text x="35" y="74" textAnchor="end" fill="#71717a" className="text-[10px]">60%</text>
                      <text x="35" y="124" textAnchor="end" fill="#71717a" className="text-[10px]">30%</text>
                      <text x="35" y="174" textAnchor="end" fill="#71717a" className="text-[10px]">0%</text>

                      {/* Custom SVG bars generator */}
                      {activeSurg.experiment_results.slice(0, 4).map((test, index) => {
                        const colWidth = 100;
                        const xOffset = 55 + index * colWidth;

                        // Height calculations
                        const baselineHeight = test.baseline * 150;
                        const candidateHeight = test.candidate * 150;

                        return (
                          <g key={index}>
                            {/* Baseline Bar (grey) */}
                            <rect
                              x={xOffset + 15}
                              y={170 - baselineHeight}
                              width="24"
                              height={baselineHeight}
                              fill="#52525b"
                              fillOpacity="0.8"
                              rx="2"
                              className="transition-all duration-500 hover:fill-opacity-100"
                            />
                            {/* Candidate Bar (white) */}
                            <rect
                              x={xOffset + 43}
                              y={170 - candidateHeight}
                              width="24"
                              height={candidateHeight}
                              fill="#ffffff"
                              fillOpacity="0.8"
                              rx="2"
                              className="transition-all duration-500 hover:fill-opacity-100"
                            />
                            {/* X Axis Labelling */}
                            <text
                              x={xOffset + 40}
                              y="192"
                              textAnchor="middle"
                              fill="#a1a1aa"
                              className="text-[9px] truncate max-w-[85px] select-all"
                            >
                              {test.test_case.substring(4)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    <div className="flex justify-center gap-6 mt-2 text-[10px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-zinc-650 rounded-xs" />
                        <span className="text-zinc-400">BASELINE CASE PROMPT</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-white rounded-xs" />
                        <span className="text-zinc-400">CANDIDATE RECONSTRUCTED</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clickable Trace logs referenced */}
                <div>
                  <h4 className="text-xs font-mono font-bold text-zinc-400 mb-2 uppercase tracking-wider">AFFECTED OBSERVABILITY TRACE TARGETS</h4>
                  <div className="space-y-1.5">
                    {activeSurg.trace_ids.map((trId) => (
                      <div 
                        key={trId}
                        onClick={() => handleTraceLink(trId)}
                        className="bg-[#050505] p-3 rounded-lg border border-white/5 flex items-center justify-between group hover:border-white/30 cursor-pointer transition-all"
                      >
                        <span className="font-mono text-xs text-white font-bold group-hover:underline">
                          {trId}
                        </span>
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                          VIEW RAW SPANS <ChevronRight size={12} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Side-by-side comparative diff code */}
                <div>
                  <h4 className="text-xs font-mono font-bold text-zinc-400 mb-2 uppercase tracking-wider">REMEDIATION SYSTEM DIFF</h4>
                  <div className="grid grid-cols-1 gap-2 leading-relaxed">
                    <div className="bg-[#050505] p-3 rounded-lg border border-white/5">
                      <span className="text-[10px] text-zinc-400 font-mono font-bold block mb-1">ORIGINAL COMPILER PROMPT</span>
                      <pre className="text-[11px] font-mono text-zinc-400 max-h-[140px] overflow-y-auto whitespace-pre-wrap">
                        {activeSurg.old_prompt}
                      </pre>
                    </div>
                    <div className="bg-[#050505] p-3 rounded-lg border border-white/5">
                      <span className="text-[10px] text-zinc-200 font-mono font-bold block mb-1">DEPLOYED CORRECTIONS</span>
                      <pre className="text-[11px] font-mono text-white max-h-[140px] overflow-y-auto whitespace-pre-wrap">
                        {activeSurg.new_prompt}
                      </pre>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer option */}
            <div className="p-4 bg-[#050505] border-t border-white/10 flex justify-end">
              <button 
                onClick={() => setSelectedSurgeryId(null)}
                className="bg-white/5 hover:bg-white/10 text-xs font-mono font-medium px-4 py-2 rounded text-zinc-400 hover:text-white transition-all"
              >
                Close Trace Drawer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
