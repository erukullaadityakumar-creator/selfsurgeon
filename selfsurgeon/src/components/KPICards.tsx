import React, { useState } from 'react';
import { Copy, Check, TrendingUp, Scissors, Target, Clock, Heart } from 'lucide-react';
import { useSurgeon } from '../context/SurgeonContext';

export default function KPICards() {
  const { status, surgeries } = useSurgeon();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(status.current_prompt_version);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Build a nice numeric trend of candidate accuracies for the sparkline
  const sortedSurgeries = [...surgeries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const sparklineData = sortedSurgeries.map(s => s.candidate_accuracy * 100);

  // Generate SVG path for sparkline with dimensions 120 x 40
  const generateSparklinePath = (data: number[]) => {
    if (data.length < 2) return '';
    const min = Math.min(...data, 50);
    const max = Math.max(...data, 100);
    const range = max - min || 1;
    const width = 120;
    const height = 30;
    const padding = 2;
    
    return data
      .map((val, index) => {
        const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - ((val - min) / range) * (height - padding * 2) - padding;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const sparklinePath = generateSparklinePath(sparklineData);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Surgeries Completed */}
      <div className="bg-[#121212] border border-white/10 rounded-xl p-5 hover:translate-y-[-2px] hover:border-white/30 hover:shadow-[0_4px_20px_rgba(255,255,255,0.03)] transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] sm:text-xs font-mono font-bold text-zinc-400 tracking-wider">SURGERIES COMPLETED</span>
          <Scissors size={16} className="text-white" />
        </div>
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="text-3xl font-mono font-bold text-white tracking-tight">
              {status.surgeries_completed}
            </span>
            <div className="flex items-center gap-1 mt-1 text-[11px] font-mono text-zinc-300">
              <TrendingUp size={12} />
              <span>+{(surgeries.filter(s => s.deploy_status === 'DEPLOYED').length)} success</span>
            </div>
          </div>
          
          {/* Sparkline chart */}
          <div className="w-24 h-8 overflow-visible">
            <svg viewBox="0 0 120 30" className="w-full h-full">
              <defs>
                <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {sparklinePath && (
                <>
                  <path
                    d={`${sparklinePath} L 118 30 L 2 30 Z`}
                    fill="url(#sparkGradient)"
                  />
                  <path
                    d={sparklinePath}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
            </svg>
          </div>
        </div>
        {/* Horizontal Progress Gauge */}
        <div className="mt-3 h-1 bg-white/5 overflow-hidden rounded-full">
          <div className="w-2/3 h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]"></div>
        </div>
      </div>

      {/* Accuracy Improvement */}
      <div className="bg-[#121212] border border-white/10 rounded-xl p-5 hover:translate-y-[-2px] hover:border-white/30 hover:shadow-[0_4px_20px_rgba(255,255,255,0.03)] transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] sm:text-xs font-mono font-bold text-zinc-400 tracking-wider">ACCURACY GAIN</span>
          <Target size={16} className="text-white" />
        </div>
        <div className="mb-2">
          <span className="text-3xl font-mono font-bold text-white tracking-tight">
            +{status.accuracy_improvement}%
          </span>
          <p className="text-[11px] text-zinc-400 font-mono mt-1">
            Over benchmark baseline v0.9
          </p>
        </div>
        {/* Horizontal Progress Gauge */}
        <div className="mt-3 h-1 bg-white/5 overflow-hidden rounded-full">
          <div className="w-[82%] h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]"></div>
        </div>
      </div>

      {/* Current Prompt Version */}
      <div className="bg-[#121212] border border-white/10 rounded-xl p-5 hover:translate-y-[-2px] hover:border-white/30 hover:shadow-[0_4px_20px_rgba(255,255,255,0.03)] transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] sm:text-xs font-mono font-bold text-zinc-400 tracking-wider">ACTIVE PROMPT</span>
          <Clock size={16} className="text-zinc-400" />
        </div>
        <div className="mb-2">
          <div className="flex items-center justify-between mt-1">
            <span className="font-mono text-xs font-bold text-white px-2 py-1 rounded bg-white/10 border border-white/20 truncate max-w-[85%]">
              {status.current_prompt_version}
            </span>
            <button
              onClick={handleCopy}
              className="text-zinc-400 hover:text-white p-1.5 rounded hover:bg-white/5 transition-colors"
              title="Copy version tag"
            >
              {copied ? <Check size={14} className="text-white" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-zinc-400 font-mono mt-2">
            Auto-healing deployed version
          </p>
        </div>
        {/* Horizontal Progress Gauge */}
        <div className="mt-3 h-1 bg-white/5 overflow-hidden rounded-full">
          <div className="w-[60%] h-full bg-zinc-400"></div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-[#121212] border border-white/10 rounded-xl p-5 hover:translate-y-[-2px] hover:border-white/30 hover:shadow-[0_4px_20px_rgba(255,255,255,0.03)] transition-all duration-300 relative overflow-hidden">
        
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] sm:text-xs font-mono font-bold text-zinc-400 tracking-wider">SYSTEM COHERENCE</span>
          <Heart size={16} className="text-white" />
        </div>
        <div className="mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold tracking-tight text-white">
              {status.health_status}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 font-mono mt-1">
            Core safety evaluators active
          </p>
        </div>
        {/* Horizontal Progress Gauge */}
        <div className="mt-3 h-1 bg-white/5 overflow-hidden rounded-full">
          <div className={`h-full bg-white ${status.health_status === 'HEALTHY' ? 'w-full' : 'w-[75%]'}`}></div>
        </div>
      </div>
    </div>
  );
}
