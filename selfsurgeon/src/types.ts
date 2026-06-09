export interface Surgery {
  id: string;
  timestamp: string;
  failure_type: 'BOUNDARY_AMBIGUITY' | 'TOOL_MISUSE' | 'RECURSIVE_LOOP' | 'CONTEXT_DRIFT' | 'HALLUCINATION' | 'PROMPT_INJECTION' | 'OUTPUT_FORMAT_VIOLATION' | 'LATENCY_SPIKE';
  affected_traces: number;
  baseline_accuracy: number;
  candidate_accuracy: number;
  improvement: number;
  deploy_status: 'DEPLOYED' | 'REJECTED' | 'IN_PROGRESS';
  old_version: string;
  new_version: string;
  diagnosis_confidence: number;
  fix_explanation: string;
  diagnosis_details: string;
  old_prompt: string;
  new_prompt: string;
  experiment_results: Array<{ test_case: string; baseline: number; candidate: number }>;
  trace_ids: string[];
}

export interface TraceSpan {
  id: string;
  name: string;
  type: 'LLM' | 'TOOL' | 'CHAIN' | 'ROUTING';
  latency_ms: number;
  status: 'SUCCESS' | 'ERROR';
  input: string;
  output: string;
  metadata?: Record<string, any>;
}

export interface Trace {
  id: string;
  timestamp: string;
  score: number;
  failure_type: string | null;
  confidence: number;
  input: string;
  output: string;
  expected: string;
  prediction: string;
  spans: TraceSpan[];
  full_json: Record<string, any>;
}

export interface PromptVersion {
  version: string;
  timestamp: string;
  changelog: string;
  accuracy: number;
  status: 'PRODUCTION' | 'CANDIDATE' | 'SUPERSEDED' | 'ARCHIVED';
  content: string;
}

export interface SystemStatus {
  health_score: number;
  health_status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  live_agent_active: boolean;
  surgeries_completed: number;
  accuracy_improvement: number;
  current_prompt_version: string;
  last_surgery_timestamp: string;
}

export interface LogLine {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'ANALYZE';
  message: string;
}
