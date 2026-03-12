import React from 'react';

const SessionSummary = ({ summary, onNewSession }) => {
  if (!summary) return null;

  const startPct = Math.round((summary.start_score || 0) * 100);
  const endPct = Math.round((summary.end_score || 0) * 100);
  const avgPct = Math.round((summary.avg_distress || 0) * 100);
  const topEmotions = summary.top_emotions || [];
  const riskFlags = summary.risk_flags || [];

  const trendColor = {
    'Improved': 'text-green-400',
    'Worsened': 'text-red-400',
    'Stable': 'text-yellow-400'
  }[summary.trend] || 'text-purple-300';

  const trendEmoji = {
    'Improved': '📉',
    'Worsened': '📈',
    'Stable': '➡️'
  }[summary.trend] || '📊';

  return (
    <div className="w-full max-w-md bg-[#1a1035]/80 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-md space-y-4">
      <h3 className="text-center text-purple-200 font-semibold text-lg">📋 Session Summary</h3>

      {/* Core stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryItem label="Messages" value={summary.message_count} />
        <SummaryItem label="Trend" value={`${trendEmoji} ${summary.trend}`} className={trendColor} />
        <SummaryItem label="Primary Emotion" value={capitalize(summary.primary_emotion)} />
        <SummaryItem label="Main Concern" value={capitalize(summary.primary_category)} />
        <SummaryItem label="Start Distress" value={`${startPct}%`} />
        <SummaryItem label="End Distress" value={`${endPct}%`} />
      </div>

      {/* Average distress bar */}
      <div className="bg-purple-900/20 rounded-xl p-3 border border-purple-500/10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-purple-400/70 uppercase tracking-wider">Avg Distress</span>
          <span className="text-sm font-semibold text-purple-100">{avgPct}%</span>
        </div>
        <div className="w-full h-2 bg-purple-900/40 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              avgPct > 70 ? 'bg-red-500' : avgPct > 40 ? 'bg-yellow-400' : 'bg-green-400'
            }`}
            style={{ width: `${Math.min(avgPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Top emotions */}
      {topEmotions.length > 0 && (
        <div className="bg-purple-900/20 rounded-xl p-3 border border-purple-500/10">
          <div className="text-xs text-purple-400/70 uppercase tracking-wider mb-2">Top Emotions</div>
          <div className="flex flex-wrap gap-2">
            {topEmotions.map((e, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-600/20 border border-purple-500/20 text-xs text-purple-200">
                {e.emotion}
                <span className="text-purple-400/60">×{e.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Risk flags */}
      {riskFlags.length > 0 && (
        <div className="bg-red-900/20 rounded-xl p-3 border border-red-500/20">
          <div className="text-xs text-red-400 uppercase tracking-wider mb-2">
            ⚠️ Risk Flags ({riskFlags.length})
          </div>
          <div className="space-y-2">
            {riskFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-red-400/80 font-mono shrink-0">#{flag.message_number}</span>
                <span className="text-red-200/70 break-words">{flag.text_preview}</span>
                <span className="ml-auto shrink-0 text-red-400 font-semibold">
                  {Math.round((flag.confidence || 0) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-purple-900/30 rounded-xl p-3 border border-purple-500/20">
        <div className="text-xs text-purple-400 uppercase tracking-wider mb-1">Recommendation</div>
        <div className="text-sm text-purple-200">{summary.recommendation}</div>
      </div>

      <button
        onClick={onNewSession}
        className="w-full py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium text-sm hover:opacity-90 transition-opacity"
      >
        Start New Session
      </button>
    </div>
  );
};

const SummaryItem = ({ label, value, className = 'text-purple-100' }) => (
  <div className="bg-purple-900/20 rounded-xl p-3 border border-purple-500/10">
    <div className="text-xs text-purple-400/70 uppercase tracking-wider">{label}</div>
    <div className={`text-sm font-semibold mt-0.5 ${className}`}>{value}</div>
  </div>
);

const capitalize = (str) => {
  if (!str) return 'N/A';
  return str.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export default SessionSummary;
