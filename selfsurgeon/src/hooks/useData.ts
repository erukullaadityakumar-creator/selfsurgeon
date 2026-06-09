import { useSurgeon } from '../context/SurgeonContext';

export function useSurgeries() {
  const { surgeries, isHealing, triggerSelfHealing, selectedSurgeryId, setSelectedSurgeryId } = useSurgeon();
  return {
    surgeries,
    isHealing,
    triggerSelfHealing,
    selectedSurgeryId,
    setSelectedSurgeryId
  };
}

export function useTraces() {
  const { traces, selectedTrace, analyzeTrace, addTraceToDataset, simulateFailure } = useSurgeon();
  return {
    traces,
    selectedTrace,
    analyzeTrace,
    addTraceToDataset,
    simulateFailure
  };
}

export function usePrompts() {
  const { prompts, status, rollbackPromptVersion } = useSurgeon();
  return {
    prompts,
    currentVersion: status.current_prompt_version,
    rollbackPromptVersion
  };
}
