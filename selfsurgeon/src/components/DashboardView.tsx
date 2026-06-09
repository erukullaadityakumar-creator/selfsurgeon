import React, { useState } from 'react';
import { useSurgeon } from '../context/SurgeonContext';
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
} from 'lucide-react';
import JsonTreeViewer from './JsonTreeViewer';
import TerminalWidget from './TerminalWidget';

const failureOptions = [
  { value: 'BOUNDARY_AMBIGUITY', label: 'Boundary ambiguity', note: 'Threshold values route incorrectly' },
  { value: 'OUTPUT_FORMAT_VIOLATION', label: 'Output format', note: 'Plain text returned instead of JSON' },
  { value: 'TOOL_MISUSE', label: 'Tool misuse', note: 'Agent guesses when enrichment is required' },
];

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
  } = useSurgeon();

  const [traceSearchId, setTraceSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFailureType, setSelectedFailureType] = useState('BOUNDARY_AMBIGUITY');
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  const latestSurgery = [...surgeries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  const activePrompt = prompts[0];
  const visibleTrace = selectedTrace || traces[0] || null;
  const deployedCount = surgeries.filter(s => s.deploy_status === 'DEPLOYED').length;
  const failedTraceCount = traces.length;
  const selectedFailure = failureOptions.find(option => option.value === selectedFailureType) || failureOptions[0];

  const handleTraceSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!traceSearchId.trim()) return;
    setIsSearching(true);
    await analyzeTrace(traceSearchId.trim());
    setIsSearching(false);
  };

  const handleGenerate = async () => {
    await generateDemoData(20, selectedFailureType);
  };

  const selectTrace = (trace: typeof traces[number]) => {
    setSelectedTrace(trace);
    setSelectedTraceId(trace.id);
  };

  const stepState = (index: number) => {
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
    <div className="mission-control">
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
        </div>

        <div className="mission-actions">
          <label>
            Failure class
            <select value={selectedFailureType} onChange={(event) => setSelectedFailureType(event.target.value)}>
              {failureOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <p>{selectedFailure.note}</p>
          <div className="mission-action-row">
            <button className="mission-button secondary" onClick={handleGenerate}>
              <RefreshCcw size={16} />
              Generate Failures
            </button>
            <button className="mission-button primary" onClick={triggerSelfHealing} disabled={isHealing}>
              <Play size={16} />
              {isHealing ? 'Healing...' : 'Trigger Self-Healing'}
            </button>
          </div>
        </div>
      </section>

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
              <span className="mission-label">Diagnosis</span>
              <h3>{latestSurgery ? latestSurgery.failure_type.replaceAll('_', ' ').toLowerCase() : 'Waiting for failed traces'}</h3>
              <p>{latestSurgery?.diagnosis_details || 'SelfSurgeon will classify the dominant failure pattern after observing real failed traces.'}</p>
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
          <PromptBlock content={latestSurgery?.old_prompt || activePrompt?.content || 'No prompt loaded yet.'} expanded={showFullPrompt} />
        </div>

        <div className="mission-panel mission-span-6">
          <PanelHeader icon={<ShieldCheck size={17} />} title="Prompt after" subtitle={latestSurgery?.new_version || status.current_prompt_version || 'Production'} />
          <PromptBlock content={latestSurgery?.new_prompt || activePrompt?.content || 'No prompt loaded yet.'} expanded={showFullPrompt} />
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

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
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

function PromptBlock({ content, expanded }: { content: string; expanded: boolean }) {
  return (
    <pre className={`prompt-block ${expanded ? 'expanded' : ''}`}>
      {content}
    </pre>
  );
}
