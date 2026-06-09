import React from 'react';
import { 
  ArrowRight, ShieldCheck, Cpu, Database, Binary, Info, HelpCircle
} from 'lucide-react';

export default function ArchitectureView() {
  
  // Surgical tools descriptions
  const surgicalTools = [
    { name: 'retrieve_spans', desc: 'Queries the local SQLite trace store to retrieve input/output payload parameters.', category: 'Telemetry' },
    { name: 'match_evaluators', desc: 'Validates predictions against medical expected labels on evaluation criteria databases.', category: 'Evaluation' },
    { name: 'cluster_failures', desc: 'Groups failed cases by logical markers (e.g. BOUNDARY_AMBIGUITY, HALLUCINATION).', category: 'Clustering' },
    { name: 'synthesize_remediations', desc: 'Prompts Gemini-3 to generate targeted prompt instruction additions addressing failures.', category: 'Synthesis' },
    { name: 'compile_experiments', desc: 'Spawns diagnostic verification checks of the candidates on testbed sandboxes.', category: 'Sandbox' },
    { name: 'compare_metrics', desc: 'Asserts comparative accuracy and latency performance before approving deployments.', category: 'Analytics' },
    { name: 'rollout_prompt', desc: 'Commits approved prompt candidate versions to hot production shards in real-time.', category: 'Rollout' },
    { name: 'rollback_prompt', desc: 'Restores prior stable prompt versions if safety logs detect unexpected performance drift.', category: 'Recovery' }
  ];

  // Steps
  const howItWorksSteps = [
    { num: 1, title: 'Continuous Observability', desc: 'The agent runs production-like workloads and persists local trace records with inputs, outputs, expected routes, scores, and prompt versions.' },
    { num: 2, title: 'Anomaly Identification', desc: 'The evaluation layer audits agent outputs against expected rules. If accuracy falls below 80%, SelfSurgeon logs a failure.' },
    { num: 3, title: 'Root Cause Diagnosis', desc: 'An autonomous diagnosis agent inspects low-scoring spans, extracts failed outputs, and identifies specific flaws like logic ambiguities.' },
    { num: 4, title: 'Generative Repair', desc: 'SelfSurgeon queries Gemini, supplying the diagnosed root cause and previous prompt scripts to synthesize a corrected system prompt candidate.' },
    { num: 5, title: 'Evaluation Sandboxing', desc: 'The diagnostic system tests the new prompt on historical failure datasets to prevent logical regressions.' },
    { num: 6, title: 'Safe Production Rollout', desc: 'If experimental scores exceed the baseline, the candidate is hot-deployed to active production traffic.' }
  ];

  return (
    <div className="space-y-6 font-sans select-none text-xs">
      
      {/* 1. Full-width Architecture Diagram Card */}
      <div className="bg-[#0d0d0f] border border-white/10 rounded-2xl p-6">
        <div className="mb-6">
          <h2 className="text-md font-bold text-[#f1f5f9] tracking-tight">System Data Topology Flow</h2>
          <p className="text-xs text-[#94a3b8] font-mono">End-to-End surgical feedback flow visualization</p>
        </div>

        {/* The Diagram Flow graphic panel */}
        <div className="bg-[#0a0a0f] border border-white/5 p-6 rounded-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-around gap-4 min-h-[160px]">
          
          {/* Node 1 */}
          <div className="p-4 bg-[#141414] border border-white/10 rounded-xl text-center w-40 hover:border-emerald-500/40 transition-all duration-300">
            <Cpu className="mx-auto text-emerald-400 mb-2" size={24} />
            <span className="font-mono font-bold text-[#f1f5f9] tracking-tight text-[11px]">AGENT WORKLOAD</span>
            <span className="text-[9px] text-[#94a3b8] block font-mono mt-0.5">Executes Production</span>
          </div>

          <div className="flex flex-col items-center">
            <ArrowRight className="text-emerald-400 animate-pulse hidden md:block" />
            <span className="text-[9px] text-emerald-400 font-mono mt-1 font-bold">SPANS TELEMETRY</span>
          </div>

          {/* Node 2 */}
          <div className="p-4 bg-[#141414] border border-[#ff3366]/30 rounded-xl text-center w-40 hover:border-[#ff3366]/60 transition-all duration-300">
            <Database className="mx-auto text-[#ff3366] mb-2" size={24} />
            <span className="font-mono font-bold text-[#f1f5f9] tracking-tight text-[11px]">SQLITE TRACE STORE</span>
            <span className="text-[9px] text-gray-500 block font-mono mt-0.5">Local observability records</span>
          </div>

          <div className="flex flex-col items-center">
            <ArrowRight className="text-emerald-400 animate-pulse hidden md:block" />
            <span className="text-[9px] text-emerald-400 font-mono mt-1 font-bold">MUTATION INSTRUCTIONS</span>
          </div>

          {/* Node 3 */}
          <div className="p-4 bg-[#141414] border border-amber-500/30 rounded-xl text-center w-40 hover:border-amber-500/60 transition-all duration-300">
            <Binary className="mx-auto text-amber-500 mb-2" size={24} />
            <span className="font-mono font-bold text-[#f1f5f9] tracking-tight text-[11px]">EVALUATION LAYER</span>
            <span className="text-[9px] text-gray-500 block font-mono mt-0.5">Accuracy checks</span>
          </div>

          <div className="flex flex-col items-center">
            <ArrowRight className="text-emerald-400 animate-pulse hidden md:block" />
            <span className="text-[9px] text-emerald-400 font-mono mt-1 font-bold">PROMPT REMEDIATION</span>
          </div>

          {/* Node 4 */}
          <div className="p-4 bg-[#141414] border border-[#10b981]/30 rounded-xl text-center w-40 hover:border-[#10b981]/60 transition-all duration-300">
            <ShieldCheck className="mx-auto text-[#10b981] mb-2" size={24} />
            <span className="font-mono font-bold text-[#f1f5f9] tracking-tight text-[11px]">GEMINI SHARD</span>
            <span className="text-[9px] text-[#94a3b8] block font-mono mt-0.5">Surgical Synthesis LLM</span>
          </div>

        </div>
      </div>

      {/* 2. Step-by-Step and Tool Inventory Split side-by-side */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Step-by-Step numerical sequence (7 cols) */}
        <div className="xl:col-span-7 bg-[#0d0d0f] border border-white/10 rounded-2xl p-6">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#f1f5f9] tracking-tight">Active Operation Pipeline Steps (1-6)</h3>
            <p className="text-xs text-[#94a3b8]">Step-by-step diagnostic sequence</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {howItWorksSteps.map((step) => (
              <div key={step.num} className="bg-[#0a0a0f] p-4 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold flex items-center justify-center text-xs">
                    {step.num}
                  </span>
                  <span className="font-bold text-[#f1f5f9] text-xs">{step.title}</span>
                </div>
                <p className="text-[#94a3b8] leading-relaxed text-[11px]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Surgical tool inventory panel (5 cols) */}
        <div className="xl:col-span-5 bg-[#0d0d0f] border border-white/10 rounded-2xl p-6">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#f1f5f9] tracking-tight">SelfSurgeon Surgical Tools</h3>
            <p className="text-xs text-[#94a3b8]">Valid tool definitions inside SelfSurgeon toolkit schema</p>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {surgicalTools.map((tool) => (
              <div 
                key={tool.name}
                className="bg-[#0a0a0f] p-3 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all font-mono"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-emerald-400 font-bold text-[11px]">{tool.name}</span>
                  <span className="text-[9px] text-[#94a3b8] px-1.5 py-0.5 bg-white/5 border border-white/5 rounded">
                    {tool.category}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-sans leading-relaxed">
                  {tool.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 3. Tech stack badges container */}
      <div className="bg-[#0d0d0f] border border-white/10 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#f1f5f9] tracking-tight">Validated Engineering Stack</h3>
            <p className="text-xs text-[#94a3b8] font-mono">Standard components and technologies deployed</p>
          </div>

          {/* Glowing tech badges */}
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full font-mono text-gray-300">
              ⚡ Python Fast-API
            </span>
            <span className="px-3 py-1 bg-[#10b981]/10 border border-[#10b981]/20 rounded-full font-mono text-[#10b981]">
              SQLite Traces
            </span>
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full font-mono text-emerald-400">
              🤖 Gemini Pro 2.5
            </span>
            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full font-mono text-gray-300">
              📘 TypeScript 5
            </span>
            <span className="px-3 py-1 bg-sky-500/10 border border-sky-500/20 rounded-full font-mono text-sky-400">
              💎 React 19 + Tailwind
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
