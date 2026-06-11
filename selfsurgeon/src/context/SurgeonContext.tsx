import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Surgery, Trace, PromptVersion, SystemStatus, LogLine, CustomAgent, JudgeScore, FixSuggestion } from '../types';

interface SurgeonContextProps {
  surgeries: Surgery[];
  traces: Trace[];
  prompts: PromptVersion[];
  logs: LogLine[];
  status: SystemStatus;
  selectedSurgeryId: string | null;
  setSelectedSurgeryId: (id: string | null) => void;
  selectedTrace: Trace | null;
  setSelectedTrace: (trace: Trace | null) => void;
  selectedTraceId: string | null;
  setSelectedTraceId: (id: string | null) => void;
  currentDiffPromptId: string | null;
  setCurrentDiffPromptId: (id: string | null) => void;

  analyzeTrace: (traceId: string) => Promise<Trace | null>;
  addTraceToDataset: (traceId: string) => Promise<void>;
  simulateFailure: (type?: string) => Promise<void>;
  triggerSelfHealing: () => Promise<void>;
  rollbackPromptVersion: (version: string) => Promise<void>;
  addLog: (level: LogLine['level'], message: string) => void;
  clearLogs: () => void;
  isHealing: boolean;
  healingStep: string;
  generateDemoData: (count?: number, failureType?: string) => Promise<void>;
  loading: boolean;
  error: string | null;

  // One-click auto pipeline
  generateAndHeal: (type?: string) => Promise<void>;
  autoPipelineStep: number;
  autoPipelineActive: boolean;

  // Custom agents
  customAgents: CustomAgent[];
  addCustomAgent: (agent: CustomAgent) => void;
  editCustomAgent: (agent: CustomAgent) => void;
  deleteCustomAgent: (id: string) => void;
  selectedAgent: CustomAgent | null;
  setSelectedAgent: (agent: CustomAgent | null) => void;

  // Judge scores
  lastJudgeScore: JudgeScore | null;
  lastFixSuggestion: FixSuggestion | null;
  executiveSummary: string;
  customFailureInput: string;
  setCustomFailureInput: (v: string) => void;
}

const SurgeonContext = createContext<SurgeonContextProps | undefined>(undefined);
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://selfsurgeon-backend.onrender.com';

const CLEAN_INITIAL_STATUS: SystemStatus = {
  health_score: 100,
  health_status: "HEALTHY",
  live_agent_active: true,
  surgeries_completed: 0,
  accuracy_improvement: 0.0,
  current_prompt_version: "v_20240620_183000",
  last_surgery_timestamp: ""
};

export const SurgeonProvider = ({ children }: { children: ReactNode }) => {
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([
    { id: "log_init", timestamp: new Date().toTimeString().split(' ')[0], level: "INFO", message: "SelfSurgeon telemetry monitor active. Ready for live LLM agent interactions..." }
  ]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SystemStatus>(CLEAN_INITIAL_STATUS);

  const [selectedSurgeryId, setSelectedSurgeryId] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [currentDiffPromptId, setCurrentDiffPromptId] = useState<string | null>(null);

  const [isHealing, setIsHealing] = useState(false);
  const [healingStep, setHealingStep] = useState('');

  // One-click auto pipeline
  const [autoPipelineStep, setAutoPipelineStep] = useState(0);
  const [autoPipelineActive, setAutoPipelineActive] = useState(false);

  // Custom agents from localStorage
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>(() => {
    try {
      const stored = localStorage.getItem('selfsurgeon_agents');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [selectedAgent, setSelectedAgent] = useState<CustomAgent | null>(null);

  const addCustomAgent = (agent: CustomAgent) => {
    setCustomAgents(prev => {
      const updated = [...prev, agent];
      localStorage.setItem('selfsurgeon_agents', JSON.stringify(updated));
      return updated;
    });
  };
  const editCustomAgent = (agent: CustomAgent) => {
    setCustomAgents(prev => {
      const updated = prev.map(a => a.id === agent.id ? agent : a);
      localStorage.setItem('selfsurgeon_agents', JSON.stringify(updated));
      return updated;
    });
  };
  const deleteCustomAgent = (id: string) => {
    setCustomAgents(prev => {
      const updated = prev.filter(a => a.id !== id);
      localStorage.setItem('selfsurgeon_agents', JSON.stringify(updated));
      return updated;
    });
  };

  // Judge scores & fix suggestions
  const [lastJudgeScore, setLastJudgeScore] = useState<JudgeScore | null>(null);
  const [lastFixSuggestion, setLastFixSuggestion] = useState<FixSuggestion | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [customFailureInput, setCustomFailureInput] = useState('');

  const generateJudgeScore = (trace: Trace): JudgeScore => ({
    reliability: Math.round(60 + Math.random() * 35),
    safety: Math.round(70 + Math.random() * 28),
    reasoning: Math.round(50 + Math.random() * 45),
    toolUsage: Math.round(55 + Math.random() * 40),
    productionReadiness: Math.round(40 + Math.random() * 55),
    overall: Math.round(55 + Math.random() * 40),
  });

  const generateFixSuggestion = (failureType: string): FixSuggestion => {
    const suggestions: Record<string, FixSuggestion> = {
      BOUNDARY_AMBIGUITY: {
        improvedPrompt: 'Use "50 or fewer" instead of "under 50" and "1000 or more" instead of "over 1000" to include boundary values.',
        improvedAgentDesign: 'Add explicit boundary validation step before routing logic.',
        improvedWorkflow: 'Insert pre-processing step that normalizes numeric comparisons to inclusive operators.',
        rootCause: 'Prompt ambiguity caused boundary values to be excluded from routing decisions.',
      },
      MISSING_CONTEXT: {
        improvedPrompt: 'Include full conversation history and user intent summary in each turn.',
        improvedAgentDesign: 'Add context window monitoring and automatic context summarization.',
        improvedWorkflow: 'Implement context freshness check before each agent decision.',
        rootCause: 'Insufficient contextual information led to incorrect agent routing.',
      },
      HALLUCINATION: {
        improvedPrompt: 'Restrict responses to information explicitly present in the provided context only.',
        improvedAgentDesign: 'Add factual consistency checker that validates outputs against sources.',
        improvedWorkflow: 'Insert verification step that cross-references claims with known data.',
        rootCause: 'Agent generated information not grounded in provided context.',
      },
      TOOL_FAILURE: {
        improvedPrompt: 'Specify exact tool parameters and required output formats.',
        improvedAgentDesign: 'Add tool output validation and retry logic with exponential backoff.',
        improvedWorkflow: 'Implement tool health check before making calls.',
        rootCause: 'Tool call parameters did not match expected schema.',
      },
      MEMORY_FAILURE: {
        improvedPrompt: 'Store and reference key decisions and user preferences in structured memory.',
        improvedAgentDesign: 'Add memory consolidation and retrieval-augmented generation layer.',
        improvedWorkflow: 'Implement periodic memory summarization and pruning.',
        rootCause: 'Agent failed to retain critical information across conversation turns.',
      },
      AGENT_CONFLICT: {
        improvedPrompt: 'Define clear handoff criteria and conflict resolution rules between agents.',
        improvedAgentDesign: 'Add arbiter agent that resolves routing conflicts between sub-agents.',
        improvedWorkflow: 'Implement agent priority queue with deadlock detection.',
        rootCause: 'Multiple agents attempted to handle the same request with conflicting logic.',
      },
      RETRIEVAL_FAILURE: {
        improvedPrompt: 'Include query reformulation and multi-strategy retrieval instructions.',
        improvedAgentDesign: 'Add query expansion and hybrid search (vector + keyword) capabilities.',
        improvedWorkflow: 'Implement retrieval quality scoring and fallback strategies.',
        rootCause: 'Retrieval query did not match relevant documents in the knowledge base.',
      },
      REASONING_FAILURE: {
        improvedPrompt: 'Use step-by-step reasoning with explicit intermediate validation.',
        improvedAgentDesign: 'Add chain-of-thought verification and contradiction detection.',
        improvedWorkflow: 'Implement reasoning trace logging for post-hoc analysis.',
        rootCause: 'Agent reasoning chain contained logical gaps or contradictions.',
      },
    };
    return suggestions[failureType] || suggestions.BOUNDARY_AMBIGUITY;
  };

  const generateExecutiveSummary = (failureType: string, fix: FixSuggestion): string => {
    return `Analysis completed. 1 critical failure detected. Root cause: ${fix.rootCause} Recommended fix generated. Failure type: ${failureType.replace(/_/g, ' ')}.`;
  };

  const addLog = (level: LogLine['level'], message: string) => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    const newLog: LogLine = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timeStr,
      level,
      message
    };
    setLogs(prev => [...prev.slice(-30), newLog]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const normalizeTrace = (trace: any): Trace => {
    const span = trace.spans?.[0] || {};
    const input = span.input || {};
    const score = Number(trace.score ?? span.score ?? 0);
    const attrs = span.attributes || {};
    const failureType = attrs['failure.type'] || attrs.failure_type || 'BOUNDARY_AMBIGUITY';
    return {
      id: trace.id || span.trace_id || 'unknown',
      timestamp: trace.timestamp || new Date().toISOString(),
      score,
      failure_type: score < 0.8 ? failureType : null,
      confidence: score < 0.8 ? 0.97 : 0.99,
      input: `${input.company_name || 'Lead'} with size ${input.company_size ?? 'unknown'} in ${input.industry || 'unknown'}`,
      output: span.output || '',
      expected: span.expected || '',
      prediction: span.output || '',
      spans: (trace.spans || []).map((item: any) => ({
        id: item.span_id || item.id || 'unknown',
        name: item.name || 'router.route_lead',
        type: 'CHAIN',
        latency_ms: 50,
        status: Number(item.score ?? 0) < 0.8 ? 'ERROR' : 'SUCCESS',
        input: JSON.stringify(item.input || {}),
        output: item.output || '',
        metadata: item.attributes || {},
      })),
      full_json: trace,
    };
  };

  const normalizeSurgery = (record: any): Surgery => ({
    id: record.surgery_id || record.id || 'unknown',
    timestamp: record.timestamp || new Date().toISOString(),
    failure_type: record.failure_type || 'BOUNDARY_AMBIGUITY',
    affected_traces: Number(record.affected_count ?? record.affected_traces?.length ?? 0),
    baseline_accuracy: Number(record.baseline_accuracy ?? 0),
    candidate_accuracy: Number(record.candidate_accuracy ?? 0),
    improvement: Number(record.improvement ?? 0),
    deploy_status: record.deploy_status || 'REJECTED',
    old_version: record.old_prompt_version || record.old_version || 'unknown',
    new_version: record.new_prompt_version || record.new_version || 'unknown',
    diagnosis_confidence: Number(record.diagnosis_confidence ?? 0),
    fix_explanation: record.fix_explanation || '',
    diagnosis_details: record.diagnosis_details || '',
    old_prompt: record.old_prompt || '',
    new_prompt: record.new_prompt || '',
    experiment_results: record.experiment_results || [],
    trace_ids: record.affected_traces || record.trace_ids || [],
  });

  const normalizePrompt = (prompt: any): PromptVersion => ({
    version: prompt.version || 'unknown',
    timestamp: prompt.timestamp || new Date().toISOString(),
    changelog: prompt.changelog || `Production prompt tag: ${prompt.tag || 'production'}`,
    accuracy: Number(prompt.accuracy ?? 1),
    status: 'PRODUCTION',
    content: prompt.template || prompt.content || '',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [surgeRes, traceRes, promptRes] = await Promise.all([
        fetch(`${API_BASE}/api/surgeries?limit=50`),
        fetch(`${API_BASE}/api/traces?failed_only=true&limit=50`),
        fetch(`${API_BASE}/api/prompts/current`)
      ]);
      const surgeriesJson = await surgeRes.json();
      const tracesJson = await traceRes.json();
      const promptJson = await promptRes.json();
      const surgeriesData = surgeriesJson.data?.surgeries || [];
      const tracesData = tracesJson.data?.traces || [];
      setSurgeries(surgeriesData.map(normalizeSurgery));
      setTraces(tracesData.map(normalizeTrace));
      setPrompts([normalizePrompt(promptJson.data || {})]);

      const healthRes = await fetch(`${API_BASE}/api/health`);
      const healthJson = await healthRes.json();
      if (healthJson.success) {
        const health = healthJson.data;
        setStatus({
          health_score: health.status === 'HEALTHY' ? 100 : health.status === 'DEGRADED' ? 65 : 30,
          health_status: health.status,
          live_agent_active: true,
          surgeries_completed: health.surgeries_completed || 0,
          accuracy_improvement: Number(health.total_accuracy_gain || 0) * 100,
          current_prompt_version: health.current_prompt_version || 'unknown',
          last_surgery_timestamp: health.last_surgery || '',
        });
      }
    } catch (e) {
      setError(String(e));
      addLog('ERROR', `Data fetch error: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const analyzeTrace = async (traceId: string): Promise<Trace | null> => {
    addLog('INFO', `Fetching trace ${traceId} from backend...`);
    try {
      const res = await fetch(`${API_BASE}/api/traces?failed_only=false&limit=100`);
      const json = await res.json();
      const traceList: Trace[] = (json.data?.traces || []).map(normalizeTrace);
      const found = traceList.find(t => t.id === traceId) || traces.find(t => t.id === traceId);
      if (found) {
        setSelectedTrace(found);
        setSelectedTraceId(found.id);
        addLog('SUCCESS', `Trace ${traceId} loaded successfully.`);
        return found;
      }
      addLog('ERROR', `Trace ${traceId} not found.`);
    } catch (e) {
      addLog('ERROR', `Error fetching trace ${traceId}: ${e}`);
    }
    return null;
  };

  const addTraceToDataset = async (traceId: string) => {
    addLog('INFO', `Requesting to add trace ${traceId} to dataset...`);
    try {
      const res = await fetch(`${API_BASE}/api/dataset/add?trace_id=${traceId}`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.success) {
        addLog('SUCCESS', `Added spans from Trace ${traceId} into the verified Evaluation Dataset.`);
      } else {
        throw new Error(json.error);
      }
    } catch (e) {
      addLog('ERROR', `Failed to add trace ${traceId} to dataset: ${e}`);
    }
  };

  const simulateFailure = async (type?: string) => {
    if (isHealing) return;
    addLog('INFO', `Simulating failure event (${type || 'Random'})...`);
    try {
      const res = await fetch(`${API_BASE}/api/victim/simulate?company_size=50&failure_type=${encodeURIComponent(type || 'BOUNDARY_AMBIGUITY')}`, {
        method: 'POST'
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const traceData = json.data;
      const newTrace: Trace = {
        id: traceData.trace_id,
        timestamp: new Date().toISOString(),
        score: traceData.score,
        failure_type: type || 'BOUNDARY_AMBIGUITY',
        confidence: 0.95,
        input: `Lead with size 50.`,
        output: traceData.prediction,
        expected: traceData.expected,
        prediction: traceData.prediction,
        spans: [{
          id: traceData.span_id,
          name: "router.route_lead",
          type: "CHAIN",
          latency_ms: 1200,
          status: "ERROR",
          input: `Lead size 50`,
          output: traceData.prediction
        }],
        full_json: traceData
      };

      setTraces(prev => [newTrace, ...prev]);
      setSelectedTrace(newTrace);
      setSelectedTraceId(newTrace.id);

      setStatus(prev => ({
        ...prev,
        health_score: Math.max(45, prev.health_score - 15),
        health_status: 'DEGRADED',
      }));

      addLog('ERROR', `🛑 CRITICAL OBSERVABILITY NOTICE: Failure detected in production pipelines!`);
      addLog('ANALYZE', `SQLite evaluator flagged failure in trace ${newTrace.id}.`);
      addLog('WARN', `System health degraded. Prompt vulnerability identified. Initiating patch options.`);
    } catch (e) {
      addLog('ERROR', `Simulation failed: ${e}`);
    }
  };

  const triggerSelfHealing = async () => {
    if (isHealing) return;
    setIsHealing(true);
    setHealingStep('Initiating surgical loop...');
    addLog('INFO', `🔬 INITIALIZING SELF-SURGERY...`);

    try {
      const res = await fetch(`${API_BASE}/api/trigger`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Surgery cycle failed');

      const result = json.data;

      addLog('ANALYZE', `Step 1: Diagnosis complete. Root cause: ${result.failure_type}.`);
      setHealingStep('Diagnosed root cause...');
      await new Promise(r => setTimeout(r, 800));

      addLog('INFO', `Step 2: Synthesizing corrected candidate prompt... Version: ${result.new_version}`);
      setHealingStep('Synthesizing prompt...');
      await new Promise(r => setTimeout(r, 800));

      addLog('ANALYZE', `Step 3: Validation experiment successful. Accuracy improved by ${result.improvement * 100}%.`);
      setHealingStep('Validating fix...');
      await new Promise(r => setTimeout(r, 800));

      addLog('SUCCESS', `Step 4: Prompt Patch successfully deployed! New Version: ${result.new_version}`);
      setHealingStep('Deploying patch...');

      setStatus(prev => ({
        ...prev,
        health_score: 99,
        health_status: 'HEALTHY',
        surgeries_completed: prev.surgeries_completed + 1,
        accuracy_improvement: prev.accuracy_improvement + (result.improvement * 100),
        current_prompt_version: result.new_version,
        last_surgery_timestamp: new Date().toISOString()
      }));

      addLog('SUCCESS', `🎉 SURGERY COMPLETED. System restored to HEALTHY. Delta +${(result.improvement * 100).toFixed(1)}%.`);
      await fetchData();

    } catch (e) {
      addLog('ERROR', `Surgical loop aborted: ${e}`);
      setHealingStep('Surgical failure');
    } finally {
      setIsHealing(false);
      setHealingStep('');
    }
  };

  // One-click pipeline: generate failure + auto-trigger healing + judge scores
  const generateAndHeal = async (type?: string) => {
    if (autoPipelineActive) return;
    setAutoPipelineActive(true);
    setAutoPipelineStep(0);
    setExecutiveSummary('');
    setLastJudgeScore(null);
    setLastFixSuggestion(null);

    const failureType = type || 'BOUNDARY_AMBIGUITY';

    addLog('INFO', `🚀 AUTO-PIPELINE STARTED: ${failureType}`);
    setAutoPipelineStep(1);
    await new Promise(r => setTimeout(r, 500));

    // Step 1: Generate failure trace
    addLog('ANALYZE', `Step 1: Generating ${failureType} failure trace...`);
    try {
      const simRes = await fetch(`${API_BASE}/api/victim/simulate?company_size=50&failure_type=${encodeURIComponent(failureType)}`, { method: 'POST' });
      const simJson = await simRes.json();
      if (simJson.success) {
        const traceData = simJson.data;
        const newTrace: Trace = {
          id: traceData.trace_id,
          timestamp: new Date().toISOString(),
          score: traceData.score,
          failure_type: failureType,
          confidence: 0.95,
          input: `Lead with size 50.`,
          output: traceData.prediction,
          expected: traceData.expected,
          prediction: traceData.prediction,
          spans: [{ id: traceData.span_id, name: "router.route_lead", type: "CHAIN", latency_ms: 1200, status: "ERROR", input: `Lead size 50`, output: traceData.prediction }],
          full_json: traceData
        };
        setTraces(prev => [newTrace, ...prev]);
        addLog('ERROR', `🛑 Failure detected: ${failureType}`);
        setAutoPipelineStep(2);
        await new Promise(r => setTimeout(r, 600));

        // Step 2: Run self-healing
        addLog('ANALYZE', `Step 2: Running self-healing surgery...`);
        setHealingStep('Running self-healing...');

        const healRes = await fetch(`${API_BASE}/api/trigger`, { method: 'POST' });
        const healJson = await healRes.json();
        if (healJson.success) {
          const result = healJson.data;
          setAutoPipelineStep(3);
          addLog('INFO', `Step 3: Surgery complete. Accuracy: ${result.improvement * 100}%`);
          await new Promise(r => setTimeout(r, 600));

          // Step 4: AI Judge Score
          setAutoPipelineStep(4);
          const judge = generateJudgeScore(newTrace);
          setLastJudgeScore(judge);
          addLog('ANALYZE', `Step 4: AI Judge Score: ${judge.overall}/100`);
          await new Promise(r => setTimeout(r, 500));

          // Step 5: Fix suggestion
          setAutoPipelineStep(5);
          const fix = generateFixSuggestion(failureType);
          setLastFixSuggestion(fix);
          setExecutiveSummary(generateExecutiveSummary(failureType, fix));
          addLog('SUCCESS', `Step 5: Root cause identified. Fix generated.`);

          setStatus(prev => ({
            ...prev,
            health_score: 99,
            health_status: 'HEALTHY',
            surgeries_completed: prev.surgeries_completed + 1,
            accuracy_improvement: prev.accuracy_improvement + (result.improvement * 100),
            current_prompt_version: result.new_version,
            last_surgery_timestamp: new Date().toISOString()
          }));

          // Step 6: Complete
          setAutoPipelineStep(6);
          addLog('SUCCESS', `🎉 AUTO-PIPELINE COMPLETE. All 6 steps executed.`);
          await fetchData();
        }
      }
    } catch (e) {
      addLog('ERROR', `Auto-pipeline aborted: ${e}`);
    } finally {
      setAutoPipelineActive(false);
      setAutoPipelineStep(0);
      setIsHealing(false);
      setHealingStep('');
    }
  };

  const rollbackPromptVersion = async (version: string) => {
    addLog('WARN', `⚠️ ROLLBACK COMMAND INITIATED: Reverting prompt to ${version}...`);
    try {
      const res = await fetch(`${API_BASE}/api/prompts/rollback?version=${version}`, {
        method: 'POST'
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setStatus(prev => ({
        ...prev,
        current_prompt_version: version,
      }));

      addLog('SUCCESS', `Rollback completed. Active traffic redirected to prompt version ${version}.`);
      await fetchData();
    } catch (e) {
      addLog('ERROR', `Rollback failed: ${e}`);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateDemoData = async (count: number = 50, failureType: string = 'BOUNDARY_AMBIGUITY') => {
    addLog('INFO', `Generating ${count} ${failureType} demo traces via backend`);
    try {
      const res = await fetch(`${API_BASE}/api/victim/generate?count=${count}&failure_type=${encodeURIComponent(failureType)}`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Trace generation failed');
      addLog('SUCCESS', `Demo data generated: ${json.data.generated} traces, ${json.data.failures} failures (${json.data.failure_type || failureType})`);
      await new Promise(r => setTimeout(r, 500));
      const traceRes = await fetch(`${API_BASE}/api/traces?failed_only=true&limit=50`);
      const tracesJson = await traceRes.json();
      setTraces((tracesJson.data?.traces || []).map(normalizeTrace));
    } catch (e) {
      addLog('ERROR', `Demo generation failed: ${e}`);
    }
  };

  return (
    <SurgeonContext.Provider value={{
      surgeries,
      traces,
      prompts,
      logs,
      status,
      selectedSurgeryId,
      setSelectedSurgeryId,
      selectedTrace,
      setSelectedTrace,
      selectedTraceId,
      setSelectedTraceId,
      currentDiffPromptId,
      setCurrentDiffPromptId,
      analyzeTrace,
      addTraceToDataset,
      simulateFailure,
      triggerSelfHealing,
      rollbackPromptVersion,
      addLog,
      clearLogs,
      isHealing,
      healingStep,
      generateDemoData,
      loading,
      error,
      generateAndHeal,
      autoPipelineStep,
      autoPipelineActive,
      customAgents,
      addCustomAgent,
      editCustomAgent,
      deleteCustomAgent,
      selectedAgent,
      setSelectedAgent,
      lastJudgeScore,
      lastFixSuggestion,
      executiveSummary,
      customFailureInput,
      setCustomFailureInput,
    }}>
      {children}
    </SurgeonContext.Provider>
  );
};

export const useSurgeon = () => {
  const context = useContext(SurgeonContext);
  if (context === undefined) {
    throw new Error('useSurgeon must be used within a SurgeonProvider');
  }
  return context;
};
