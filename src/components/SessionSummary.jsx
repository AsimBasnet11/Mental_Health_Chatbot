import React from 'react';

const SessionSummary = ({ summary, onNewSession }) => {
  if (!summary) return null;

  const startPct = Math.round((summary.start_score || 0) * 100);
  const endPct = Math.round((summary.end_score || 0) * 100);

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

      <div className="grid grid-cols-2 gap-3">
        <SummaryItem label="Messages" value={summary.message_count} />
        <SummaryItem label="Trend" value={`${trendEmoji} ${summary.trend}`} className={trendColor} />
        <SummaryItem label="Primary Emotion" value={capitalize(summary.primary_emotion)} />
        <SummaryItem label="Main Concern" value={capitalize(summary.primary_category)} />
        <SummaryItem label="Start Distress" value={`${startPct}%`} />
        <SummaryItem label="End Distress" value={`${endPct}%`} />
      </div>

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
