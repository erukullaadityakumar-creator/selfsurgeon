import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface JsonTreeViewerProps {
  data: Record<string, any>;
}

export default function JsonTreeViewer({ data }: JsonTreeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightKeys = ['score', 'prediction', 'expected', 'failure_type', 'confidence', 'eval_label'];

  const renderValue = (value: any) => {
    if (value === null) return <span className="text-gray-500">null</span>;
    if (typeof value === 'boolean') return <span className="text-emerald-400 font-bold">{value.toString()}</span>;
    if (typeof value === 'number') {
      if (value < 0.5) return <span className="text-[#ff3366] font-mono font-bold">{value}</span>;
      if (value < 0.8) return <span className="text-amber-500 font-mono font-bold">{value}</span>;
      return <span className="text-emerald-400 font-mono font-bold">{value}</span>;
    }
    if (typeof value === 'string') return <span className="text-emerald-400">"{value}"</span>;
    return <span className="text-gray-300">{JSON.stringify(value)}</span>;
  };

  const renderJsonTree = (obj: any, depth = 1): React.ReactNode => {
    return (
      <div className="pl-4 font-mono text-xs font-medium">
        {Object.entries(obj).map(([key, value]) => {
          const isHighlighted = highlightKeys.includes(key);
          const isObject = value !== null && typeof value === 'object';

          return (
            <div 
              key={key} 
              className={`py-0.5 rounded transition-colors ${
                isHighlighted ? 'bg-white/5 border-l border-emerald-400 pl-2 my-0.5' : ''
              }`}
            >
              <span className={`${isHighlighted ? 'text-emerald-400 font-bold' : 'text-[#94a3b8]'}`}>
                "{key}"
              </span>
              <span className="text-[#94a3b8] mr-2">:</span>

              {isObject ? (
                <div className="pl-2 border-l border-white/5 mt-1">
                  {renderJsonTree(value, depth + 1)}
                </div>
              ) : (
                renderValue(value)
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative bg-[#0a0a0f] border border-white/10 rounded-lg p-4 font-mono max-h-[290px] overflow-y-auto">
      <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
        <button
          onClick={handleCopy}
          className="p-1 px-2 rounded bg-white/5 hover:bg-white/10 text-xs text-[#94a3b8] hover:text-[#f1f5f9] transition-all flex items-center gap-1.5"
          title="Copy Trace JSON"
        >
          {copied ? (
            <>
              <Check size={12} className="text-[#10b981]" />
              <span className="text-[10px] text-[#10b981] font-mono">COPIED</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span className="text-[10px] font-mono">COPY</span>
            </>
          )}
        </button>
      </div>

      <div className="text-gray-400">
        <span className="text-purple-400">&#123;</span>
        {renderJsonTree(data)}
        <span className="text-purple-400">&#125;</span>
      </div>
    </div>
  );
}
