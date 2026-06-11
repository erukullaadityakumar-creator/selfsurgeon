import React from 'react';
import { LayoutDashboard, Scissors, Sliders, FileCode, Cpu, AlertTriangle, Activity, RefreshCw, User } from 'lucide-react';
import { useSurgeon } from '../context/SurgeonContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export default function Sidebar({ currentTab, setCurrentTab }: SidebarProps) {
  const { status, simulateFailure, triggerSelfHealing, isHealing, healingStep, surgeries, traces } = useSurgeon();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'surgeries', label: 'Surgeries', icon: Scissors, count: surgeries.length },
    { id: 'traces', label: 'Raw Traces', icon: Sliders, count: traces.length },
    { id: 'prompts', label: 'Prompts Registry', icon: FileCode },
    { id: 'agents', label: 'Custom Agents', icon: User },
    { id: 'architecture', label: 'Architecture', icon: Cpu },
  ];

  return (
    <aside className="w-full h-full bg-[#0d0d0f] border-b md:border-b-0 md:border-r border-white/10 flex flex-col justify-between shrink-0 font-sans">
      {/* Sidebar Header */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-white animate-pulse" />
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">SelfSurgeon</h1>
            <p className="text-xs text-zinc-400 font-mono tracking-wide uppercase font-semibold">Mission Control</p>
          </div>
        </div>

        {/* Live Status and Pulse */}
        <div className="mt-6 p-4 bg-[#050505] border border-white/10 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-white`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 bg-white`}></span>
              </span>
              <span className="text-xs font-mono font-medium text-white">
                {status.live_agent_active ? 'AGENT ACTIVE' : 'OFFLINE'}
              </span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono border bg-white/5 border-white/30 text-white`}>
              {status.health_status}
            </span>
          </div>

          <div className="mt-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] text-zinc-400 font-mono">SYSTEM COHERENCE</span>
              <span className="text-xs font-mono font-bold text-white">
                {status.health_score}%
              </span>
            </div>
            {/* Health Bar */}
            <div className="w-full bg-[#16161a] h-1.5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full rounded-full transition-all duration-500 bg-white"
                style={{ width: `${status.health_score}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-1">
        <p className="px-3 mb-2 text-[10px] font-semibold text-zinc-500 font-mono tracking-wider uppercase">Product views</p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md font-mono text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-white/10 text-white border-l-2 border-white'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={16} className={isActive ? 'text-white' : 'text-zinc-400'} />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isActive ? 'bg-white text-black font-semibold' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Simulation Controllers Panel in Sidebar */}
      <div className="p-6 border-t border-white/10 bg-[#070707] space-y-3">
        <p className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
          Quick controls
        </p>

        {isHealing ? (
          <div className="space-y-2 p-3 bg-white/5 border border-white/20 rounded-lg">
            <div className="flex items-center gap-2 text-xs font-mono text-white">
              <RefreshCw className="animate-spin text-white" size={14} />
              <span>Surgery Active...</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono line-clamp-1">{healingStep}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => simulateFailure()}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-mono font-medium rounded border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/15 hover:text-white transition-all duration-200"
            >
              <AlertTriangle size={14} />
              <span>GENERATE ONE FAILURE</span>
            </button>

            <button
              onClick={() => triggerSelfHealing()}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-mono font-semibold rounded bg-white text-black hover:bg-neutral-200 transition-all duration-200"
            >
              <Activity size={14} />
              <span>TRIGGER SELF-HEALING</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
