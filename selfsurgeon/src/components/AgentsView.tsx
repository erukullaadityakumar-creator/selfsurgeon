import React, { useState } from 'react';
import { useSurgeon } from '../context/SurgeonContext';
import { CustomAgent } from '../types';
import { Plus, Edit3, Trash2, X, Check, Save, User, FileCode, Terminal } from 'lucide-react';

export default function AgentsView() {
  const { customAgents, addCustomAgent, editCustomAgent, deleteCustomAgent, selectedAgent, setSelectedAgent } = useSurgeon();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', systemPrompt: '', expectedInputs: '', expectedOutputs: '' });

  const resetForm = () => {
    setForm({ name: '', description: '', systemPrompt: '', expectedInputs: '', expectedOutputs: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (agent: CustomAgent) => {
    setForm({ name: agent.name, description: agent.description, systemPrompt: agent.systemPrompt, expectedInputs: agent.expectedInputs, expectedOutputs: agent.expectedOutputs });
    setEditingId(agent.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      editCustomAgent({ ...form, id: editingId });
    } else {
      addCustomAgent({ ...form, id: `agent_${Date.now()}` });
    }
    resetForm();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 font-sans select-none">
      {/* Agent List */}
      <div className="xl:col-span-5 bg-[#0d0d0f] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-md font-bold text-[#f1f5f9] tracking-tight">Agent Registry</h2>
            <p className="text-xs text-[#94a3b8] font-mono">Manage custom AI agents</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono rounded-lg hover:bg-emerald-500/20 transition-all"
          >
            <Plus size={12} /> New Agent
          </button>
        </div>

        {customAgents.length === 0 && !showForm && (
          <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-white/5 rounded-xl bg-[#0a0a0f]">
            No custom agents yet. Create your first agent!
          </div>
        )}

        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {customAgents.map(agent => (
            <div
              key={agent.id}
              className={`p-4 bg-[#141414] border rounded-xl transition-all cursor-pointer ${
                selectedAgent?.id === agent.id ? 'border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.03)]' : 'border-white/5 hover:border-white/15'
              }`}
              onClick={() => setSelectedAgent(agent)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-emerald-400" />
                  <span className="font-mono text-xs font-bold text-white">{agent.name}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(agent); }} className="p-1 hover:bg-white/10 rounded transition-all">
                    <Edit3 size={12} className="text-gray-400" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this agent?')) deleteCustomAgent(agent.id); if (selectedAgent?.id === agent.id) setSelectedAgent(null); }} className="p-1 hover:bg-white/10 rounded transition-all">
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed mb-2">{agent.description}</p>
              <div className="text-[9px] text-gray-500 font-mono flex gap-3">
                <span className="flex items-center gap-1"><FileCode size={10} /> {agent.systemPrompt.length} chars</span>
                <span className="flex items-center gap-1"><Terminal size={10} /> {agent.expectedInputs.length} chars</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Form / Detail */}
      <div className="xl:col-span-7 bg-[#0d0d0f] border border-white/10 rounded-2xl p-6">
        {showForm ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-md font-bold text-[#f1f5f9] tracking-tight">
                {editingId ? 'Edit Agent' : 'Create New Agent'}
              </h2>
              <button onClick={resetForm} className="p-1 hover:bg-white/10 rounded transition-all">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-gray-500 block mb-1 uppercase">Agent Name</label>
                <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-[#050505] border border-white/10 rounded-lg py-2 px-3 text-xs font-mono text-white" placeholder="e.g., Customer Support Agent" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-gray-500 block mb-1 uppercase">Description</label>
                <textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} className="w-full bg-[#050505] border border-white/10 rounded-lg py-2 px-3 text-xs font-mono text-white resize-none h-16" placeholder="What does this agent do?" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-gray-500 block mb-1 uppercase">System Prompt</label>
                <textarea value={form.systemPrompt} onChange={(e) => setForm(p => ({ ...p, systemPrompt: e.target.value }))} className="w-full bg-[#050505] border border-white/10 rounded-lg py-2 px-3 text-xs font-mono text-white resize-none h-32 font-mono" placeholder="You are a helpful agent that..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-gray-500 block mb-1 uppercase">Expected Inputs</label>
                  <textarea value={form.expectedInputs} onChange={(e) => setForm(p => ({ ...p, expectedInputs: e.target.value }))} className="w-full bg-[#050505] border border-white/10 rounded-lg py-2 px-3 text-xs font-mono text-white resize-none h-20" placeholder="User query, context..." />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-500 block mb-1 uppercase">Expected Outputs</label>
                  <textarea value={form.expectedOutputs} onChange={(e) => setForm(p => ({ ...p, expectedOutputs: e.target.value }))} className="w-full bg-[#050505] border border-white/10 rounded-lg py-2 px-3 text-xs font-mono text-white resize-none h-20" placeholder="Response, action..." />
                </div>
              </div>
              <button onClick={handleSave} className="flex items-center gap-1 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono rounded-lg hover:bg-emerald-500/20 transition-all">
                <Save size={12} /> {editingId ? 'Update Agent' : 'Save Agent'}
              </button>
            </div>
          </div>
        ) : selectedAgent ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-md font-bold text-[#f1f5f9] tracking-tight flex items-center gap-2">
                <User size={16} className="text-emerald-400" /> {selectedAgent.name}
              </h2>
            </div>
            <div className="space-y-4">
              <div className="bg-[#0a0a0f] p-4 rounded-xl border border-white/5">
                <span className="text-[10px] text-gray-500 font-mono block mb-1 uppercase">Description</span>
                <p className="text-xs text-gray-300">{selectedAgent.description}</p>
              </div>
              <div className="bg-[#0a0a0f] p-4 rounded-xl border border-white/5">
                <span className="text-[10px] text-gray-500 font-mono block mb-1 uppercase">System Prompt</span>
                <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">{selectedAgent.systemPrompt}</pre>
                <button onClick={() => navigator.clipboard.writeText(selectedAgent.systemPrompt)} className="mt-2 text-[10px] text-emerald-400 font-mono hover:underline flex items-center gap-1">
                  <Check size={10} /> Copy prompt
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0a0a0f] p-4 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 font-mono block mb-1 uppercase">Expected Inputs</span>
                  <p className="text-xs text-gray-300">{selectedAgent.expectedInputs}</p>
                </div>
                <div className="bg-[#0a0a0f] p-4 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 font-mono block mb-1 uppercase">Expected Outputs</span>
                  <p className="text-xs text-gray-300">{selectedAgent.expectedOutputs}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-zinc-500 font-mono text-xs border border-white/5 rounded-xl bg-[#0a0a0f] h-full flex items-center justify-center">
            <div>
              <User size={32} className="mx-auto mb-3 opacity-30" />
              <p>Select an agent or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
