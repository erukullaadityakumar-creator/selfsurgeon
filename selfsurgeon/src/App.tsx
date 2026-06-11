import React, { useState } from 'react';
import { SurgeonProvider } from './context/SurgeonContext';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import SurgeriesView from './components/SurgeriesView';
import TracesView from './components/TracesView';
import PromptsView from './components/PromptsView';
import ArchitectureView from './components/ArchitectureView';
import AgentsView from './components/AgentsView';

// Mobile navigations import
import { LayoutDashboard, Scissors, Sliders, FileCode, Cpu, User } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  const renderActiveTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'surgeries':
        return <SurgeriesView setCurrentTab={setCurrentTab} />;
      case 'traces':
        return <TracesView />;
      case 'prompts':
        return <PromptsView />;
      case 'architecture':
        return <ArchitectureView />;
      case 'agents':
        return <AgentsView />;
      default:
        return <DashboardView />;
    }
  };

  const mobileNavItems = [
    { id: 'dashboard', label: 'Dash', icon: LayoutDashboard },
    { id: 'surgeries', label: 'Surgery', icon: Scissors },
    { id: 'traces', label: 'Traces', icon: Sliders },
    { id: 'prompts', label: 'Prompts', icon: FileCode },
    { id: 'agents', label: 'Agents', icon: User },
    { id: 'architecture', label: 'Arch', icon: Cpu }
  ];

  return (
    <SurgeonProvider>
      <div className="h-screen w-screen bg-[#050505] text-white flex flex-col md:flex-row font-sans selection:bg-white/20 selection:text-white box-border relative overflow-hidden">
        
        {/* Immersive Scanlines Layer */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] z-50" style={{ background: 'repeating-linear-gradient(0deg, #fff, #fff 1px, transparent 1px, transparent 2px)', backgroundSize: '100% 2px' }}></div>
        
        {/* Desktop Sidebar (hidden on small layouts) */}
        <div className="hidden md:block md:h-full md:w-72 md:shrink-0">
          <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-[#000000]">
          
          {/* Immersive Theme Top Header */}
          <header className="border-b border-white/10 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#121212]/70 backdrop-blur-md z-10 sticky top-0">
            <div className="flex items-center gap-3">
              <Cpu size={22} className="text-white" />
              <div>
                <h1 className="text-md sm:text-lg font-bold tracking-wider text-white uppercase font-mono">SELFSURGEON</h1>
                <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-mono">Mission Control for Self-Healing AI Agents</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 self-stretch sm:self-auto justify-between sm:justify-start">
              <button onClick={() => setCurrentTab('traces')} className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-all cursor-pointer">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,1)]"></div>
                <span className="text-[10px] sm:text-xs font-semibold text-white font-mono tracking-wider">SYSTEM MONITORING</span>
              </button>
              
              <div className="text-right font-mono">
                <div className="text-[10px] text-zinc-400">MODE: <span className="text-white">LOCAL</span></div>
                <div className="text-[9px] text-white opacity-80 uppercase">SQLite trace store</div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:p-8 space-y-6 pb-24 md:pb-8">
            <div className="animate-fade-in transition-all duration-300">
              {renderActiveTabContent()}
            </div>
          </main>
        </div>

        {/* Mobile bottom tab navigation menu */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#121212] border-t border-white/10 px-2 py-1 z-40">
          <div className="flex justify-around items-center">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex flex-col items-center justify-center p-2 text-center transition-all ${
                    isActive ? 'text-white font-bold' : 'text-zinc-400'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[9px] font-mono mt-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </SurgeonProvider>
  );
}
