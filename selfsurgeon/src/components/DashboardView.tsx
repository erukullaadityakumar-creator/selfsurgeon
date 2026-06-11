import React, { useState, useRef, useEffect } from 'react';
import { useSurgeon } from '../context/SurgeonContext';
import { FAILURE_TYPES } from '../types';
import '../css/dashboard.css';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  GitCompare,
  HeartPulse,
  Play,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  BarChart3,
  Target,
  Zap,
  Brain,
  Shield,
  Cpu,
} from 'lucide-react';
import JsonTreeViewer from './JsonTreeViewer';
import TerminalWidget from './TerminalWidget';

const failureOptionDetails: Record<string, { label: string; note: string }> = {
  BOUNDARY_AMBIGUITY: { label: 'Boundary ambiguity', note: 'Threshold values route incorrectly' },
  MISSING_CONTEXT: { label: 'Missing context', note: 'Agent lacks required context information' },
  HALLUCINATION: { label: 'Hallucination', note: 'Agent generates ungrounded content' },
  TOOL_FAILURE: { label: 'Tool failure', note: 'Tool call parameters mismatch' },
  MEMORY_FAILURE: { label: 'Memory failure', note: 'Agent fails to retain information' },
  AGENT_CONFLICT: { label: 'Agent conflict', note: 'Multiple agents conflict on routing' },
  RETRIEVAL_FAILURE: { label: 'Retrieval failure', note: 'Failed to retrieve relevant data' },
  REASONING_FAILURE: { label: 'Reasoning failure', note: 'Logical gaps in reasoning chain' },
  CUSTOM: { label: 'Custom', note: 'Describe your own failure scenario' },
};

const lifecycleSteps = ['Observe', 'Diagnose', 'Prescribe', 'Validate', 'Deploy', 'Audit'];

export default function DashboardView() {
  const {
    surgeries,
    traces,
    prompts,
    status,
    selectedTrace,
    setSelectedTrace,
    setSelectedTraceId,
    analyzeTrace,
    triggerSelfHealing,
    isHealing,
    healingStep,
    loading,
    error,
    generateDemoData,
    generateAndHeal,
    autoPipelineStep,
    autoPipelineActive,
    lastJudgeScore,
    lastFixSuggestion,
    executiveSummary,
    customFailureInput,
    setCustomFailureInput,
    selectedAgent,
  } = useSurgeon();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [traceSearchId, setTraceSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFailureType, setSelectedFailureType] = useState('BOUNDARY_AMBIGUITY');
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedFix, setCopiedFix] = useState(false);

  // Preserve scroll position on re-render
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollPosition;
    }
  });

  const latestSurgery = [...surgeries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  const activePrompt = prompts[0];
  const visibleTrace = selectedTrace || traces[0] || null;
  const deployedCount = surgeries.filter(s => s.deploy_status === 'DEPLOYED').length;
  const failedTraceCount = traces.length;
  const selectedFailureDetail = failureOptionDetails[selectedFailureType] || failureOptionDetails.BOUNDARY_AMBIGUITY;

  const handleTraceSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!traceSearchId.trim()) return;
    setIsSearching(true);
    await analyzeTrace(traceSearchId.trim());
    setIsSearching(false);
  };

  const handleGenerate = async () => {
    if (autoPipelineActive) return;
    const type = selectedFailureType === 'CUSTOM' ? (customFailureInput || 'BOUNDARY_AMBIGUITY') : selectedFailureType;
    await generateAndHeal(type);
  };

  const selectTrace = (trace: typeof traces[number]) => {
    setSelectedTrace(trace);
    setSelectedTraceId(trace.id);
  };

  const handleCopyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {}
  };

  const handleCopyFix = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFix(true);
      setTimeout(() => setCopiedFix(false), 3000);
    } catch {}
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      setScrollPosition(scrollRef.current.scrollTop);
    }
  };

  const stepState = (index: number) => {
    if (autoPipelineActive) {
      if (index < autoPipelineStep) return 'complete';
      if (index === autoPipelineStep) return 'active';
      return 'pending';
    }
    if (isHealing) {
      const activeIndex = Math.min(Math.max(lifecycleSteps.findIndex(step => healingStep.toLowerCase().includes(step.toLowerCase())), 0), lifecycleSteps.length - 1);
      if (index < activeIndex) return 'complete';
      if (index === activeIndex) return 'active';
      return 'pending';
    }
    return latestSurgery ? 'complete' : 'pending';
  };

  if (loading) {
    return (
      <div className="mission-loading">
        <div className="mission-spinner" />
        <p>Syncing local SQLite telemetry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mission-error">
        <h2>Backend connection failed</h2>
        <p>Start the FastAPI backend, then refresh Mission Control.</p>
        <pre>{error}</pre>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="mission-control" ref={scrollRef} onScroll={handleScroll}>
      {/* Executive Summary Banner */}
      {executiveSummary && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 flex items-start gap-4 animate-fade-in">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Zap size={20} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-emerald-400 font-mono mb-1">EXECUTIVE SUMMARY</h3>
            <p className="text-xs text-gray-300 font-mono leading-relaxed">{executiveSummary}</p>
          </div>
        </div>
      )}

      <section className="mission-hero">
        <div className="mission-copy">
          <div className="mission-eyebrow">
            <span className="mission-dot" />
            Real local data - SQLite telemetry
          </div>
          <h1>Mission Control</h1>
          <p>
            Generate agent failures, run the self-healing loop, and watch SelfSurgeon diagnose,
            validate, deploy, and audit a safer production prompt.
          </p>
          {selectedAgent && (
            <div className="mt-3 p-3 bg-white/5 border border-white/10 rounded-lg inline-block">
              <span className="text-[10px] text-gray-500 font-mono">SELECTED AGENT</span>
              <p className="text-xs font-bold text-white font-mono mt-1">{selectedAgent.name}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{selectedAgent.description}</p>
            </div>
          )}
        </div>

        <div className="mission-actions">
          <label>
            Failure class
            <select value={selectedFailureType} onChange={(event) => setSelectedFailureType(event.target.value)}>
              {Object.entries(failureOptionDetails).map(([value, opt]) => (
                <option key={value} value={value}>{opt.label}</option>
              ))}
            </select>
          </label>
          {selectedFailureType === 'CUSTOM' && (
            <textarea
              value={customFailureInput}
              onChange={(e) => setCustomFailureInput(e.target.value)}
              placeholder="Describe your failure scenario..."
              className="w-full bg-[#050505] border border-white/14 rounded-lg p-2 text-xs font-mono text-white resize-none h-16"
            />
          )}
          <p>{selectedFailureDetail.note}</p>
          <div className="mission-action-row">
            <button className="mission-button primary" onClick={handleGenerate} disabled={autoPipelineActive}>
              <Zap size={16} />
              {autoPipelineActive ? 'Running 6-Step Pipeline...' : 'Generate & Auto-Heal'}
            </button>
            {selectedFailureType === 'CUSTOM' && customFailureInput && (
              <button className="mission-button secondary" onClick={() => generateAndHeal(customFailureInput)} disabled={autoPipelineActive}>
                <Play size={16} />
                Run Custom Scenario
              </button>
            )}
          </div>
          {/* Auto-pipeline progress */}
          {autoPipelineActive && (
            <div className="mt-2 p-2 bg-white/5 border border-white/10 rounded-lg">
              <div className="flex items-center gap-2 text-xs font-mono text-white">
                <RefreshCcw className="animate-spin" size={12} />
                <span>Step {autoPipelineStep}/6: {lifecycleSteps[autoPipelineStep - 1] || 'Complete'}</span>
              </div>
              <div className="w-full bg-[#16161a] h-1 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${(autoPipelineStep / 6) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* AI Judge Scores */}
      {lastJudgeScore && (
        <section className="bg-[#0d0d0f] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-white font-mono">AI JUDGE SCORES</h2>
            <span className="text-[10px] text-gray-500 font-mono">Per-trace evaluation</span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <ScoreBadge label="Reliability" value={lastJudgeScore.reliability} />
            <ScoreBadge label="Safety" value={lastJudgeScore.safety} />
            <ScoreBadge label="Reasoning" value={lastJudgeScore.reasoning} />
            <ScoreBadge label="Tool Usage" value={lastJudgeScore.toolUsage} />
            <ScoreBadge label="Production Ready" value={lastJudgeScore.productionReadiness} />
            <ScoreBadge label="Overall" value={lastJudgeScore.overall} highlight />
          </div>
        </section>
      )}

      {/* Auto Fix Generator */}
      {lastFixSuggestion && (
        <section className="bg-[#0d0d0f] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-white font-mono">AUTO FIX GENERATOR</h2>
            <span className="text-[10px] text-gray-500 font-mono">One-click copy</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FixCard
              title="Improved Prompt"
              content={lastFixSuggestion.improvedPrompt}
              onCopy={() => handleCopyFix(lastFixSuggestion.improvedPrompt)}
            />
            <FixCard
              title="Improved Agent Design"
              content={lastFixSuggestion.improvedAgentDesign}
              onCopy={() => handleCopyFix(lastFixSuggestion.improvedAgentDesign)}
            />
            <FixCard
              title="Improved Workflow"
              content={lastFixSuggestion.improvedWorkflow}
              onCopy={() => handleCopyFix(lastFixSuggestion.improvedWorkflow)}
            />
          </div>
          {copiedFix && (
            <div className="mt-2 text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <Check size={12} /> Copied to clipboard!
            </div>
          )}
        </section>
      )}

      <section className="mission-metrics">
        <MetricCard icon={<HeartPulse size={18} />} label="System health" value={status.health_status} detail="Backend and local registry online" />
        <MetricCard icon={<AlertTriangle size={18} />} label="Failed traces" value={failedTraceCount} detail="From /api/traces, no mock feed" />
        <MetricCard icon={<ShieldCheck size={18} />} label="Surgeries completed" value={String(status.surgeries_completed)} detail={`${deployedCount} deployed safely`} />
        <MetricCard icon={<GitCompare size={18} />} label="Production prompt" value={status.current_prompt_version || 'unknown'} detail="Current backend registry tag" />
      </section>

      <section className="mission-grid">
        <div className="mission-panel mission-span-8">
          <PanelHeader
            icon={<Activity size={17} />}
            title="Healing lifecycle"
            subtitle={latestSurgery ? `${latestSurgery.failure_type} repaired in latest surgery` : 'Generate failures, then run the loop'}
          />
          <div className="mission-steps">
            {lifecycleSteps.map((step, index) => {
              const state = stepState(index);
              return (
                <div key={step} className={`mission-step ${state}`}>
                  <div className="mission-step-mark">
                    {state === 'complete' ? <CheckCircle2 size={16} /> : index + 1}
                  </div>
                  <span>{step}</span>
                </div>
              );
            })}
          </div>

          <div className="mission-summary-grid">
            <div>
              <span className="mission-label">Root Cause</span>
              <h3>{latestSurgery ? latestSurgery.failure_type.replaceAll('_', ' ').toLowerCase() : 'Waiting for failed traces'}</h3>
              <p>{latestSurgery?.diagnosis_details || lastFixSuggestion?.rootCause || 'SelfSurgeon will classify the dominant failure pattern after observing real failed traces.'}</p>
            </div>
            <div>
              <span className="mission-label">Deployment decision</span>
              <h3>{latestSurgery ? latestSurgery.deploy_status : 'Not run yet'}</h3>
              <p>{latestSurgery?.fix_explanation || 'A candidate prompt is only deployed when validation beats the baseline.'}</p>
            </div>
          </div>
        </div>

        <div className="mission-panel mission-span-4">
          <PanelHeader icon={<Sparkles size={17} />} title="Validation gate" subtitle="Baseline vs candidate" />
          {latestSurgery ? (
            <div className="validation-card">
              <ScoreRow label="Baseline" value={latestSurgery.baseline_accuracy} muted />
              <ScoreRow label="Candidate" value={latestSurgery.candidate_accuracy} />
              <div className="validation-delta">
                <span>Improvement</span>
                <strong>+{Math.round(latestSurgery.improvement * 100)}%</strong>
              </div>
              <div className={`deploy-pill ${latestSurgery.deploy_status.toLowerCase()}`}>
                {latestSurgery.deploy_status === 'DEPLOYED'
                  ? 'Candidate passed deployment gate'
                  : 'Candidate rejected by deployment gate'}
              </div>
            </div>
          ) : (
            <div className="mission-empty compact">No validation result yet.</div>
          )}
        </div>

        <div className="mission-panel mission-span-5">
          <PanelHeader icon={<ClipboardList size={17} />} title="Recent failed traces" subtitle={`${failedTraceCount} active failures visible`} />
          {traces.length ? (
            <div className="trace-list">
              {traces.slice(0, 8).map(trace => (
                <button
                  key={trace.id}
                  className={`trace-row ${visibleTrace?.id === trace.id ? 'selected' : ''}`}
                  onClick={() => selectTrace(trace)}
                >
                  <span>
                    <strong>{trace.failure_type || 'FAILED_TRACE'}</strong>
                    <small>{trace.input}</small>
                  </span>
                  <em>{Math.round(trace.score * 100)}%</em>
                </button>
              ))}
            </div>
          ) : (
            <div className="mission-empty">No failed traces currently returned by the backend.</div>
          )}
        </div>

        <div className="mission-panel mission-span-7">
          <PanelHeader icon={<Search size={17} />} title="Selected trace" subtitle="Prediction, expected output, and raw telemetry" />
          <form onSubmit={handleTraceSearch} className="trace-search">
            <input
              value={traceSearchId}
              onChange={(event) => setTraceSearchId(event.target.value)}
              placeholder="Search by trace ID"
            />
            <button disabled={isSearching}>{isSearching ? 'Loading...' : 'Analyze'}</button>
          </form>
          {visibleTrace ? (
            <div className="trace-detail">
              <div className="trace-detail-grid">
                <TraceFact label="Failure" value={visibleTrace.failure_type || 'None'} />
                <TraceFact label="Prediction" value={visibleTrace.prediction || visibleTrace.output || 'n/a'} />
                <TraceFact label="Expected" value={visibleTrace.expected || 'n/a'} />
                <TraceFact label="Score" value={`${Math.round(visibleTrace.score * 100)}%`} />
              </div>
              <JsonTreeViewer data={visibleTrace.full_json} />
            </div>
          ) : (
            <div className="mission-empty">Select a failed trace after generation.</div>
          )}
        </div>

        <div className="mission-panel mission-span-6">
          <PanelHeader icon={<GitCompare size={17} />} title="Prompt before" subtitle={latestSurgery?.old_version || 'Baseline'} />
          <PromptBlock content={latestSurgery?.old_prompt || activePrompt?.content || 'No prompt loaded yet.'} expanded={showFullPrompt} onCopy={() => handleCopyPrompt(latestSurgery?.old_prompt || activePrompt?.content || '')} copied={copiedPrompt} />
        </div>

        <div className="mission-panel mission-span-6">
          <PanelHeader icon={<ShieldCheck size={17} />} title="Prompt after" subtitle={latestSurgery?.new_version || status.current_prompt_version || 'Production'} />
          <PromptBlock content={latestSurgery?.new_prompt || activePrompt?.content || 'No prompt loaded yet.'} expanded={showFullPrompt} onCopy={() => handleCopyPrompt(latestSurgery?.new_prompt || activePrompt?.content || '')} copied={copiedPrompt} />
          <button className="prompt-toggle" onClick={() => setShowFullPrompt(!showFullPrompt)}>
            {showFullPrompt ? 'Collapse prompts' : 'Show full prompts'}
          </button>
        </div>

        <div className="mission-panel mission-span-7">
          <PanelHeader icon={<ClipboardList size={17} />} title="Surgery history" subtitle="Audited backend records" />
          {surgeries.length ? (
            <div className="surgery-table">
              {surgeries.slice(0, 6).map(surgery => (
                <div key={surgery.id} className="surgery-row">
                  <span>
                    <strong>{surgery.failure_type.replaceAll('_', ' ')}</strong>
                    <small>{new Date(surgery.timestamp).toLocaleString()}</small>
                  </span>
                  <span>{Math.round(surgery.baseline_accuracy * 100)}% to {Math.round(surgery.candidate_accuracy * 100)}%</span>
                  <em>{surgery.deploy_status}</em>
                </div>
              ))}
            </div>
          ) : (
            <div className="mission-empty">No surgeries logged yet.</div>
          )}
        </div>

        <div className="mission-panel mission-span-5">
          <PanelHeader icon={<Activity size={17} />} title="Live run log" subtitle={isHealing ? healingStep : 'Latest frontend actions'} />
          <TerminalWidget />
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string | number; detail: string }) {
  return (
    <div className="mission-metric">
      <div className="mission-metric-top">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}

function PanelHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="panel-header">
      <div>
        <h2>{icon}{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function ScoreRow({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`score-row ${muted ? 'muted' : ''}`}>
      <span>{label}</span>
      <strong>{Math.round(value * 100)}%</strong>
      <div>
        <i style={{ width: `${Math.max(4, Math.round(value * 100))}%` }} />
      </div>
    </div>
  );
}

function TraceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="trace-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PromptBlock({ content, expanded, onCopy, copied }: { content: string; expanded: boolean; onCopy: () => void; copied: boolean }) {
  return (
    <div className="relative">
      <pre className={`prompt-block ${expanded ? 'expanded' : ''}`}>
        {content}
      </pre>
      <button
        onClick={onCopy}
        className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded border border-white/10 transition-all"
        title="Copy prompt"
      >
        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-gray-400" />}
      </button>
    </div>
  );
}

function ScoreBadge({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-xl border font-mono ${highlight ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#0a0a0f] border-white/10'}`}>
      <span className="text-[9px] text-gray-500 block uppercase tracking-wider">{label}</span>
      <span className={`text-lg font-bold block mt-1 ${highlight ? 'text-emerald-400' : value >= 80 ? 'text-emerald-400' : value >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
        {value}
        <span className="text-xs opacity-70">/100</span>
      </span>
    </div>
  );
}

function FixCard({ title, content, onCopy }: { title: string; content: string; onCopy: () => void }) {
  return (
    <div className="bg-[#0a0a0f] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-emerald-400 font-mono uppercase">{title}</span>
        <button onClick={onCopy} className="p-1 hover:bg-white/10 rounded transition-all">
          <Copy size={10} className="text-gray-400" />
        </button>
      </div>
      <p className="text-[11px] text-gray-300 leading-relaxed font-mono">{content}</p>
    </div>
  );
}
