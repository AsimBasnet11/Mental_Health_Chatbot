import { API_BASE, ENDPOINTS } from '../config/api';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FaBrain, FaHeart, FaHistory, FaArrowLeft, FaQuoteLeft, FaChartLine, FaChevronDown, FaComments, FaClock, FaChartBar, FaChartPie } from 'react-icons/fa';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts';
import Sidebar from './Sidebar';

const formatLabel = (str) => {
  if (!str) return str;
  return str.replace(/_/g, ' ').split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const normaliseConf = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  return n <= 1 ? parseFloat((n * 100).toFixed(1)) : n;
};

const getItemEmotionLabel = (item) => formatLabel(item.emotion?.label || item.emotion_label) || null;
const getItemEmotionConf  = (item) => normaliseConf(item.emotion?.confidence ?? item.emotion_conf ?? 0);
const getItemMentalLabel  = (item) => formatLabel(item.mentalHealth?.label || item.mental_label) || 'Unknown';
const getItemMentalConf   = (item) => normaliseConf(item.mentalHealth?.confidence ?? item.mental_conf ?? 0);
const getUserText         = (item) => item.userText || item.user_text || '';

const getEmotionColor = (emotion) => {
  const colors = {
    joy: 'text-yellow-400', sadness: 'text-blue-400',
    anger: 'text-red-400', fear: 'text-purple-400',
    surprise: 'text-green-400', disgust: 'text-orange-400',
    neutral: 'text-gray-400', love: 'text-pink-400',
    admiration: 'text-yellow-300', amusement: 'text-yellow-500',
    optimism: 'text-green-300', gratitude: 'text-teal-400',
    curiosity: 'text-cyan-400', excitement: 'text-orange-300',
  };
  return colors[emotion?.toLowerCase()] || 'text-purple-400';
};

const getEmotionBg = (emotion) => {
  const colors = {
    joy: '#facc15', sadness: '#60a5fa', anger: '#f87171', fear: '#a78bfa',
    surprise: '#4ade80', disgust: '#fb923c', neutral: '#9ca3af', love: '#f472b6',
    admiration: '#fde047', optimism: '#86efac', gratitude: '#2dd4bf', curiosity: '#22d3ee',
  };
  return colors[emotion?.toLowerCase()] || '#a78bfa';
};

const getMentalHealthColor = (state) => {
  const colors = {
    normal: 'text-green-400', anxiety: 'text-yellow-400',
    depression: 'text-blue-400',
    bipolar: 'text-purple-400', suicidal: 'text-red-600',
    'personality disorder': 'text-pink-400',
  };
  return colors[state?.toLowerCase()] || 'text-purple-400';
};

const getMentalBg = (state) => {
  const colors = {
    normal: '#4ade80', anxiety: '#facc15', depression: '#60a5fa',
    bipolar: '#a78bfa', suicidal: '#dc2626',
    'personality disorder': '#f472b6',
  };
  return colors[state?.toLowerCase()] || '#a78bfa';
};

const parseTimestamp = (ts) => {
  if (!ts) return new Date(NaN);
  const s = String(ts);
  const hasOffset = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s);
  return new Date(hasOffset ? s : s + 'Z');
};

const formatDate = (timestamp) => {
  const date = parseTimestamp(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kathmandu',
  });
};

const computeTrend = (values) => {
  if (!values || values.length < 3) return 'Stable';
  const last3 = values.slice(-3);
  const rising  = last3[2] > last3[1] && last3[1] > last3[0];
  const falling = last3[2] < last3[1] && last3[1] < last3[0];
  if (rising) return 'Improving';
  if (falling) return 'Worsening';
  return 'Stable';
};

const trendColor = (t) =>
  t === 'Improving' ? 'text-green-400' : t === 'Worsening' ? 'text-red-400' : 'text-yellow-400';

/* ══════════════════════════════════════════════════════════
   Aggregate a session's messages into ONE overall result
   ══════════════════════════════════════════════════════════ */
const aggregateSession = (messages) => {
  if (!messages || messages.length === 0) return null;

  const allLabels = new Set();
  messages.forEach(m => {
    const scores = m.mentalHealth?.allScores || m.allScores;
    if (scores) Object.keys(scores).forEach(k => allLabels.add(k));
  });

  const avgMentalScores = {};
  allLabels.forEach(label => {
    let sum = 0, count = 0;
    messages.forEach(m => {
      const scores = m.mentalHealth?.allScores || m.allScores;
      if (scores && scores[label] !== undefined) {
        let v = parseFloat(scores[label]);
        if (v <= 1) v *= 100;
        sum += v;
        count++;
      }
    });
    if (count > 0) avgMentalScores[label] = parseFloat((sum / count).toFixed(1));
  });

  const SEVERITY_ORDER = [
    'suicidal', 'depression', 'bipolar', 'personality disorder',
    'anxiety', 'normal'
  ];
  const CONFIDENCE_THRESHOLD = 15;

  const labelFrequency = {};
  messages.forEach(m => {
    const label = getItemMentalLabel(m)?.toLowerCase();
    if (label && label !== 'unknown') {
      labelFrequency[label] = (labelFrequency[label] || 0) + 1;
    }
  });
  const totalMessages = messages.length || 1;

  const candidates = Object.entries(avgMentalScores)
    .filter(([label, conf]) => label.toLowerCase() !== 'normal' && conf >= CONFIDENCE_THRESHOLD)
    .map(([label, conf]) => {
      const freq = (labelFrequency[label.toLowerCase()] || 0) / totalMessages;
      const severityRank = SEVERITY_ORDER.indexOf(label.toLowerCase());
      const rank = severityRank === -1 ? 98 : severityRank;
      const composite = rank * 10000 - (freq * 50) - (conf * 0.5);
      return { label, conf, freq, rank, composite };
    });

  let topMentalLabel = 'Unknown', topMentalConf = 0;

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.composite - b.composite);
    topMentalLabel = candidates[0].label;
    topMentalConf = candidates[0].conf;
  } else {
    Object.entries(avgMentalScores).forEach(([label, conf]) => {
      if (conf > topMentalConf) { topMentalLabel = label; topMentalConf = conf; }
    });
  }

  if (topMentalLabel === 'Unknown' || topMentalConf === 0) {
    const labelCount = {};
    messages.forEach(m => {
      const label = getItemMentalLabel(m);
      const conf = getItemMentalConf(m);
      if (label && label !== 'Unknown') {
        if (!labelCount[label]) labelCount[label] = { total: 0, count: 0 };
        labelCount[label].total += conf;
        labelCount[label].count += 1;
      }
    });
    const fallbackCandidates = Object.entries(labelCount)
      .filter(([label]) => label.toLowerCase() !== 'normal')
      .map(([label, { total, count }]) => ({ label, avg: total / count, count }))
      .filter(({ avg }) => avg >= CONFIDENCE_THRESHOLD);
    if (fallbackCandidates.length > 0) {
      fallbackCandidates.sort((a, b) => {
        const rA = SEVERITY_ORDER.indexOf(a.label.toLowerCase());
        const rB = SEVERITY_ORDER.indexOf(b.label.toLowerCase());
        const sA = rA === -1 ? 98 : rA;
        const sB = rB === -1 ? 98 : rB;
        if (sA !== sB) return sA - sB;
        return b.avg - a.avg;
      });
      topMentalLabel = fallbackCandidates[0].label;
      topMentalConf = parseFloat(fallbackCandidates[0].avg.toFixed(1));
      avgMentalScores[topMentalLabel] = topMentalConf;
    } else {
      Object.entries(labelCount).forEach(([label, { total, count }]) => {
        const avg = total / count;
        if (avg > topMentalConf) { topMentalLabel = label; topMentalConf = parseFloat(avg.toFixed(1)); }
      });
    }
  }

  const emotionMap = {};
  messages.forEach(m => {
    const label = getItemEmotionLabel(m);
    const conf = getItemEmotionConf(m);
    if (label) {
      if (!emotionMap[label]) emotionMap[label] = { total: 0, count: 0 };
      emotionMap[label].total += conf;
      emotionMap[label].count += 1;
    }
  });

  let topEmotionLabel = null, topEmotionConf = 0, topEmotionFreq = 0;
  Object.entries(emotionMap).forEach(([label, { total, count }]) => {
    if (count > topEmotionFreq || (count === topEmotionFreq && total / count > topEmotionConf)) {
      topEmotionLabel = label;
      topEmotionConf = parseFloat((total / count).toFixed(1));
      topEmotionFreq = count;
    }
  });

  const highRisk = messages.some(m => m.highRisk);

  return {
    topMentalLabel: formatLabel(topMentalLabel),
    topMentalConf,
    avgMentalScores,
    topEmotionLabel,
    topEmotionConf,
    emotionMap,
    highRisk,
    messageCount: messages.length,
  };
};

/* ══════════════════════════════════════════════════════════
   DISTRESS CHART HELPERS
   ══════════════════════════════════════════════════════════ */
const DISTRESS_SCORE = {
  suicidal: 100,
  depression: 80,
  bipolar: 70,
  'personality disorder': 60,
  anxiety: 40,
  normal: 10,
};

const getDistressScore = (label) => {
  if (!label) return 10;
  return DISTRESS_SCORE[label.toLowerCase()] ?? 10;
};

const getDistressColor = (score) => {
  if (score >= 80) return '#f87171';
  if (score >= 60) return '#fb923c';
  if (score >= 40) return '#facc15';
  return '#4ade80';
};

const getDistressZone = (score) => {
  if (score >= 80) return 'Severe';
  if (score >= 60) return 'Moderate-High';
  if (score >= 40) return 'Moderate';
  return 'Mild / Stable';
};

const DistressTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const color = getDistressColor(d.distress);
  return (
    <div className="bg-[#1e1240] border border-purple-500/30 rounded-xl p-3 shadow-lg text-sm">
      <p className="text-purple-300 font-semibold mb-2">Message #{d?.msgNum}</p>
      <p className="font-bold mb-1" style={{ color }}>
        {d.mentalLabel} — {getDistressZone(d.distress)}
      </p>
      {d.emotionLabel && (
        <p className="text-purple-300/70 text-xs">Feeling: {d.emotionLabel}</p>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   SESSION TREND — DISTRESS LEVEL CHART
   ══════════════════════════════════════════════════════════ */
const SessionTrendGraph = ({ messages }) => {
  const chartData = useMemo(() =>
    messages.map((m, i) => {
      const mentalLabel = getItemMentalLabel(m);
      const distress = getDistressScore(mentalLabel);
      return { msgNum: i + 1, distress, mentalLabel, emotionLabel: getItemEmotionLabel(m) };
    }),
    [messages],
  );

  const trend = useMemo(() => computeTrend(chartData.map(d => d.distress)), [chartData]);
  const avgDistress = useMemo(
    () => Math.round(chartData.reduce((s, d) => s + d.distress, 0) / chartData.length),
    [chartData],
  );

  if (messages.length < 2) return null;

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    return <circle cx={cx} cy={cy} r={5} fill={getDistressColor(payload.distress)} stroke="#1e1240" strokeWidth={2} />;
  };

  return (
    <div className="bg-[#231550]/75 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 rounded-full">
            <FaChartLine className="text-2xl text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-purple-300">Distress Level Over Time</h3>
            <p className="text-sm text-purple-300/60">How your mental state shifted across this session</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-purple-300/50 mb-1">Overall Trend</p>
          <p className={`font-bold text-sm ${trendColor(trend)}`}>{trend}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {[
          { label: 'Mild / Stable', color: '#4ade80' },
          { label: 'Moderate', color: '#facc15' },
          { label: 'Moderate-High', color: '#fb923c' },
          { label: 'Severe', color: '#f87171' },
        ].map(z => (
          <span key={z.label} className="flex items-center gap-1.5 text-xs text-purple-300/60">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} />
            {z.label}
          </span>
        ))}
      </div>

      <div className="w-full h-64" style={{ minWidth: 0, minHeight: 256 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.15)" />
            <XAxis dataKey="msgNum" tick={{ fill: '#c4b5fd', fontSize: 12 }} axisLine={{ stroke: 'rgba(139,92,246,0.3)' }} tickLine={false}
              label={{ value: 'Message #', position: 'insideBottomRight', offset: -5, fill: '#a78bfa', fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#c4b5fd', fontSize: 11 }} axisLine={{ stroke: 'rgba(139,92,246,0.3)' }} tickLine={false}
              ticks={[10, 40, 60, 80, 100]}
              tickFormatter={(v) => {
                if (v === 10) return 'Normal';
                if (v === 40) return 'Anxiety';
                if (v === 60) return 'Bipolar';
                if (v === 80) return 'Depression';
                if (v === 100) return 'Suicidal';
                return '';
              }} />
            <Tooltip content={<DistressTooltip />} />
            <Line type="monotone" dataKey="distress" stroke="#a855f7" strokeWidth={2.5}
              dot={<CustomDot />} activeDot={{ r: 7, stroke: '#fff', strokeWidth: 1 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-purple-500/20">
        <div className="text-center">
          <p className="text-xs text-purple-300/50 mb-1">Start</p>
          <p className="font-semibold text-sm" style={{ color: getDistressColor(chartData[0]?.distress) }}>{chartData[0]?.mentalLabel}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-purple-300/50 mb-1">Avg Distress</p>
          <p className="font-semibold text-sm" style={{ color: getDistressColor(avgDistress) }}>{getDistressZone(avgDistress)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-purple-300/50 mb-1">End</p>
          <p className="font-semibold text-sm" style={{ color: getDistressColor(chartData[chartData.length - 1]?.distress) }}>{chartData[chartData.length - 1]?.mentalLabel}</p>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   MENTAL STATE BREAKDOWN BAR CHART
   ══════════════════════════════════════════════════════════ */
const MentalBreakdownChart = ({ avgScores }) => {
  const data = useMemo(() =>
    Object.entries(avgScores)
      .map(([label, value]) => ({ label: formatLabel(label), value: parseFloat(value.toFixed(1)), raw: label }))
      .sort((a, b) => b.value - a.value),
    [avgScores],
  );

  if (data.length === 0) return null;

  return (
    <div className="bg-[#231550]/75 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-green-500/20 rounded-full">
          <FaChartBar className="text-2xl text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-purple-300">Mental State Breakdown</h3>
          <p className="text-sm text-purple-300/60">Average scores across all messages in this session</p>
        </div>
      </div>
      <div className="w-full h-56" style={{ minWidth: 0, minHeight: 224 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.15)" />
            <XAxis dataKey="label" tick={{ fill: '#c4b5fd', fontSize: 11 }} axisLine={{ stroke: 'rgba(139,92,246,0.3)' }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#c4b5fd', fontSize: 12 }} axisLine={{ stroke: 'rgba(139,92,246,0.3)' }} tickLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e1240', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px' }}
              labelStyle={{ color: '#c4b5fd' }}
              formatter={(v) => [`${v}%`, 'Avg Confidence']}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={getMentalBg(entry.raw)} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   EMOTION DISTRIBUTION PIE CHART
   ══════════════════════════════════════════════════════════ */
const EmotionDistributionChart = ({ emotionMap }) => {
  const data = useMemo(() =>
    Object.entries(emotionMap)
      .map(([label, { count }]) => ({ name: label, value: count, fill: getEmotionBg(label) }))
      .sort((a, b) => b.value - a.value),
    [emotionMap],
  );

  if (data.length === 0) return null;

  return (
    <div className="bg-[#231550]/75 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/20 rounded-full">
          <FaChartPie className="text-2xl text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-purple-300">Emotion Distribution</h3>
          <p className="text-sm text-purple-300/60">Which emotions appeared in this session</p>
        </div>
      </div>
      <div className="w-full h-48" style={{ minWidth: 0, minHeight: 192 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={false}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1e1240', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px' }}
              labelStyle={{ color: '#c4b5fd' }}
              formatter={(v, name) => [`${v} message${v !== 1 ? 's' : ''}`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {data.map((entry, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-purple-200">
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.fill }} />
            {entry.name}
            <span className="text-purple-400/60">×{entry.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ══════════════════════════════════════════════════════════ */
const MentalStatePage = ({ onBack, onHomeClick, onMentalStateClick, onHistoryClick, onFAQsClick, onSummaryClick, onNewChat, onLogout, user, currentSessionId }) => {
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [expandedPastSession, setExpandedPastSession] = useState(null);
  const [expandedPastMessages, setExpandedPastMessages] = useState(null);
  const hasFetchedRef = useRef(false);

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    loadAnalysisData();
  }, []);

  const loadAnalysisData = async () => {
    try {
      const token = getToken();
      if (token) {
        const res = await fetch(`${API_BASE}/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAnalysisHistory(data.history || []);
          setLoading(false);
          return;
        }
      }
      const saved = localStorage.getItem('analysisHistory');
      if (saved) setAnalysisHistory(JSON.parse(saved));
    } catch (e) {
      console.error('Error loading history:', e);
      const saved = localStorage.getItem('analysisHistory');
      if (saved) { try { setAnalysisHistory(JSON.parse(saved)); } catch {} }
    } finally { setLoading(false); }
  };

  const currentSessionMessages = useMemo(() => {
    if (!currentSessionId) return [];
    return analysisHistory
      .filter(item => (item.sessionId || item.session_id) === currentSessionId)
      .sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
  }, [analysisHistory, currentSessionId]);

  const sessionResult = useMemo(() => aggregateSession(currentSessionMessages), [currentSessionMessages]);

  const SESSION_GAP_MS = 30 * 60 * 1000;
  const pastSessions = useMemo(() => {
    const others = analysisHistory.filter(item => {
      const sid = item.sessionId || item.session_id;
      return sid !== currentSessionId;
    });
    const sorted = [...others].sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
    const map = new Map();
    let legacyIdx = 0, lastLegacyKey = null, lastLegacyTime = 0;
    sorted.forEach((item) => {
      let key = item.sessionId || item.session_id;
      if (!key) {
        const t = parseTimestamp(item.timestamp).getTime();
        if (!lastLegacyKey || t - lastLegacyTime > SESSION_GAP_MS) { legacyIdx++; lastLegacyKey = `__legacy_${legacyIdx}`; }
        lastLegacyTime = t; key = lastLegacyKey;
      }
      if (!map.has(key)) map.set(key, { sessionId: key, messages: [], firstTimestamp: item.timestamp, lastTimestamp: item.timestamp });
      const g = map.get(key); g.messages.push(item); g.lastTimestamp = item.timestamp;
    });
    return Array.from(map.values()).reverse().map(s => ({
      ...s,
      aggregate: aggregateSession(s.messages),
    }));
  }, [analysisHistory, currentSessionId]);

  useEffect(() => {
    if (!loading && currentSessionMessages.length === 0 && pastSessions.length > 0) {
      setShowPastSessions(true);
    }
  }, [loading, currentSessionMessages.length, pastSessions.length]);

  if (!loading && currentSessionMessages.length === 0 && pastSessions.length === 0) {
    return (
      <div className="flex h-screen bg-[#120820] text-white overflow-hidden">
        <Sidebar onHomeClick={onHomeClick} onMentalStateClick={onMentalStateClick} onHistoryClick={onHistoryClick}
          onFAQsClick={onFAQsClick} onSummaryClick={onSummaryClick} onNewChat={onNewChat} onLogout={onLogout}
          currentPage="mental-state" user={user} />
        <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-br from-[#120820] via-[#1e1240] to-[#120820]">
          <FaBrain className="text-6xl text-purple-400 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-purple-300 mb-2">No Analysis Yet</h2>
          <p className="text-purple-300/60 mb-6">Share your thoughts in the chat first. All messages in this session will be analyzed together.</p>
          <button onClick={onBack} className="px-6 py-3 bg-purple-600/30 hover:bg-purple-600/50 rounded-full transition-all flex items-center gap-2">
            <FaArrowLeft /> Back to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#120820] text-white overflow-hidden">
      <Sidebar onHomeClick={onHomeClick} onMentalStateClick={onMentalStateClick} onHistoryClick={onHistoryClick}
        onFAQsClick={onFAQsClick} onSummaryClick={onSummaryClick} onNewChat={onNewChat} onLogout={onLogout}
        currentPage="mental-state" user={user} />

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#120820] via-[#1e1240] to-[#120820]">

        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(80)].map((_, i) => (
            <div key={i} className="absolute bg-white rounded-full opacity-35 animate-pulse"
              style={{ width: `${Math.random() * 3 + 1}px`, height: `${Math.random() * 3 + 1}px`,
                top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
                animationDuration: `${Math.random() * 3 + 2}s` }} />
          ))}
        </div>

        <div className="relative z-10 p-6 border-b border-purple-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaBrain className="text-3xl text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Session Analysis</h1>
                <p className="text-sm text-purple-300/60">
                  {currentSessionMessages.length > 0
                    ? `${currentSessionMessages.length} message${currentSessionMessages.length !== 1 ? 's' : ''} analyzed in this session`
                    : pastSessions.length > 0
                      ? `${pastSessions.length} past session${pastSessions.length !== 1 ? 's' : ''} available`
                      : 'No messages analyzed yet'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              {pastSessions.length > 0 && (
                <button onClick={() => setShowPastSessions(!showPastSessions)}
                  className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 rounded-full transition-all flex items-center gap-2">
                  <FaHistory /> {showPastSessions ? 'Hide' : 'Past Sessions'} ({pastSessions.length})
                </button>
              )}
              <button onClick={onBack} className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 rounded-full transition-all flex items-center gap-2">
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative z-10 scrollbar-thin scrollbar-thumb-purple-700/40 scrollbar-track-transparent"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(109,40,217,0.4) transparent' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-purple-300/60 animate-pulse">Loading analysis...</div>
            </div>
          ) : (
          <div className="max-w-6xl mx-auto space-y-6">

            {currentSessionMessages.length === 0 && pastSessions.length > 0 && (
              <div className="bg-purple-600/10 border border-purple-500/20 rounded-2xl p-5 flex items-center gap-4">
                <FaBrain className="text-3xl text-purple-400 shrink-0" />
                <div>
                  <h3 className="text-purple-200 font-semibold">No analysis for this session yet</h3>
                  <p className="text-purple-300/60 text-sm mt-1">Start chatting to see real-time analysis. Your past sessions are shown below.</p>
                </div>
                <button onClick={onBack} className="ml-auto px-4 py-2 bg-purple-600/30 hover:bg-purple-600/50 rounded-full transition-all flex items-center gap-2 text-sm shrink-0">
                  <FaArrowLeft className="text-xs" /> Chat
                </button>
              </div>
            )}

            {sessionResult && (
              <div className="bg-gradient-to-r from-[#1e1240]/80 to-[#2a1555]/60 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-full">
                    <FaBrain className="text-2xl text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Overall Session Result</h2>
                    <p className="text-sm text-purple-300/60">Aggregated across all {sessionResult.messageCount} messages in this conversation</p>
                  </div>
                  {sessionResult.highRisk && (
                    <span className="ml-auto px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-full text-red-400 text-sm font-semibold animate-pulse">
                      ⚠ High Risk Detected
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#160d30]/55 rounded-2xl p-5 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <FaBrain className="text-green-400" />
                      <h3 className="text-sm font-semibold text-purple-300">Overall Mental State</h3>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-3xl font-bold ${getMentalHealthColor(sessionResult.topMentalLabel)}`}>
                        {sessionResult.topMentalLabel}
                      </span>
                      <span className="text-2xl font-bold text-purple-300">{sessionResult.topMentalConf.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-3 bg-purple-900/30 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${sessionResult.topMentalConf}%`, backgroundColor: getMentalBg(sessionResult.topMentalLabel) }} />
                    </div>
                    <p className="text-xs text-purple-300/60 mt-2">
                      Confidence: {sessionResult.topMentalConf >= 70 ? 'High' : sessionResult.topMentalConf >= 50 ? 'Moderate' : 'Low'}
                    </p>
                  </div>

                  <div className="bg-[#160d30]/55 rounded-2xl p-5 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <FaHeart className="text-blue-400" />
                      <h3 className="text-sm font-semibold text-purple-300">Dominant Emotion</h3>
                    </div>
                    {sessionResult.topEmotionLabel ? (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-3xl font-bold ${getEmotionColor(sessionResult.topEmotionLabel)}`}>
                            {sessionResult.topEmotionLabel}
                          </span>
                          <span className="text-2xl font-bold text-purple-300">{sessionResult.topEmotionConf.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-3 bg-purple-900/30 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${sessionResult.topEmotionConf}%`, backgroundColor: getEmotionBg(sessionResult.topEmotionLabel) }} />
                        </div>
                        <p className="text-xs text-purple-300/60 mt-2">Most frequent emotion across the session</p>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-20">
                        <p className="text-purple-300/60 text-sm">Emotion analysis not available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentSessionMessages.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {sessionResult?.avgMentalScores && Object.keys(sessionResult.avgMentalScores).length > 0 && (
                  <MentalBreakdownChart avgScores={sessionResult.avgMentalScores} />
                )}
                {sessionResult?.emotionMap && Object.keys(sessionResult.emotionMap).length > 0 && (
                  <EmotionDistributionChart emotionMap={sessionResult.emotionMap} />
                )}
              </div>
            )}

            {currentSessionMessages.length > 0 && (
              <SessionTrendGraph messages={currentSessionMessages} />
            )}

            {currentSessionMessages.length > 0 && (
              <div className="bg-[#231550]/75 border border-purple-500/20 rounded-2xl backdrop-blur-md overflow-hidden">
                <button onClick={() => setMessagesOpen(!messagesOpen)}
                  className="w-full flex items-center justify-between p-5 text-left cursor-pointer">
                  <div className="flex items-center gap-3">
                    <FaComments className="text-purple-400" />
                    <span className="text-lg font-semibold text-purple-300">Individual Messages ({currentSessionMessages.length})</span>
                    <span className="text-sm text-purple-300/50">Per-message detection details</span>
                  </div>
                  <FaChevronDown className={`text-purple-400 text-sm transition-transform duration-300 ${messagesOpen ? 'rotate-180' : ''}`} />
                </button>
                {messagesOpen && (
                  <div className="px-5 pb-5 space-y-3 animate-fadeIn">
                    {currentSessionMessages.map((msg, mi) => (
                      <div key={mi} className="bg-[#160d30]/55 rounded-xl p-4 border border-purple-500/10">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-purple-400 font-semibold text-sm">#{mi + 1}</span>
                          <span className="text-purple-300/50 text-xs">{formatDate(msg.timestamp)}</span>
                          {msg.highRisk && (
                            <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded-full text-red-400 text-xs">⚠ High Risk</span>
                          )}
                        </div>
                        <p className="text-white/90 leading-relaxed text-sm mb-3 italic">&ldquo;{getUserText(msg)}&rdquo;</p>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {getItemEmotionLabel(msg) && (
                            <span className={`px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 ${getEmotionColor(getItemEmotionLabel(msg))}`}>
                              <FaHeart className="inline mr-1 text-[10px]" />
                              {getItemEmotionLabel(msg)} — {getItemEmotionConf(msg).toFixed(1)}%
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20 ${getMentalHealthColor(getItemMentalLabel(msg))}`}>
                            <FaBrain className="inline mr-1 text-[10px]" />
                            {getItemMentalLabel(msg)} — {getItemMentalConf(msg).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-purple-300 mb-3">💡 Remember</h3>
              <p className="text-purple-200 leading-relaxed">
                This analysis is based on AI interpretation and should not replace professional mental health advice.
                If you're experiencing severe emotional distress, please reach out to a mental health professional or crisis hotline.
              </p>
            </div>

            {showPastSessions && pastSessions.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-purple-300 flex items-center gap-2">
                  <FaHistory /> Past Sessions
                  <span className="text-sm font-normal text-purple-300/50 ml-2">{pastSessions.length} session{pastSessions.length !== 1 ? 's' : ''}</span>
                </h3>

                {pastSessions.map((session) => {
                  const isOpen = expandedPastSession === session.sessionId;
                  const agg = session.aggregate;
                  const isMsgOpen = expandedPastMessages === session.sessionId;
                  return (
                    <div key={session.sessionId}
                      className="bg-[#231550]/75 border border-purple-500/20 rounded-2xl backdrop-blur-md hover:border-purple-500/40 transition-all overflow-hidden">
                      <button onClick={() => setExpandedPastSession(isOpen ? null : session.sessionId)}
                        className="w-full flex items-center justify-between p-5 text-left cursor-pointer">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center gap-2 text-purple-300/60 text-sm shrink-0">
                            <FaClock className="text-xs" /> {formatDate(session.firstTimestamp)}
                          </div>
                          <span className="text-purple-500/40">|</span>
                          <span className="flex items-center gap-1 text-purple-400/70 text-sm shrink-0">
                            <FaComments className="text-xs" /> {session.messages.length}
                          </span>
                          {agg?.topMentalLabel && (
                            <span className={`text-sm font-semibold truncate ${getMentalHealthColor(agg.topMentalLabel)}`}>{agg.topMentalLabel}</span>
                          )}
                          {agg?.topEmotionLabel && (
                            <span className={`text-sm font-semibold truncate ${getEmotionColor(agg.topEmotionLabel)}`}>{agg.topEmotionLabel}</span>
                          )}
                          {agg?.highRisk && (
                            <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded-full text-red-400 text-xs shrink-0">High Risk</span>
                          )}
                        </div>
                        <FaChevronDown className={`text-purple-400 text-sm transition-transform duration-300 shrink-0 ml-3 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isOpen && agg && (
                        <div className="px-5 pb-5 space-y-5 animate-fadeIn">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#160d30]/55 rounded-2xl p-5 border border-green-500/20">
                              <div className="flex items-center gap-2 mb-4">
                                <FaBrain className="text-green-400" />
                                <h3 className="text-sm font-semibold text-purple-300">Overall Mental State</h3>
                              </div>
                              <div className="flex items-center justify-between mb-3">
                                <span className={`text-3xl font-bold ${getMentalHealthColor(agg.topMentalLabel)}`}>{agg.topMentalLabel}</span>
                                <span className="text-2xl font-bold text-purple-300">{agg.topMentalConf.toFixed(1)}%</span>
                              </div>
                              <div className="w-full h-3 bg-purple-900/30 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000 ease-out"
                                  style={{ width: `${agg.topMentalConf}%`, backgroundColor: getMentalBg(agg.topMentalLabel) }} />
                              </div>
                              <p className="text-xs text-purple-300/60 mt-2">
                                Confidence: {agg.topMentalConf >= 70 ? 'High' : agg.topMentalConf >= 50 ? 'Moderate' : 'Low'}
                              </p>
                            </div>

                            <div className="bg-[#160d30]/55 rounded-2xl p-5 border border-blue-500/20">
                              <div className="flex items-center gap-2 mb-4">
                                <FaHeart className="text-blue-400" />
                                <h3 className="text-sm font-semibold text-purple-300">Dominant Emotion</h3>
                              </div>
                              {agg.topEmotionLabel ? (
                                <>
                                  <div className="flex items-center justify-between mb-3">
                                    <span className={`text-3xl font-bold ${getEmotionColor(agg.topEmotionLabel)}`}>{agg.topEmotionLabel}</span>
                                    <span className="text-2xl font-bold text-purple-300">{agg.topEmotionConf.toFixed(1)}%</span>
                                  </div>
                                  <div className="w-full h-3 bg-purple-900/30 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-1000 ease-out"
                                      style={{ width: `${agg.topEmotionConf}%`, backgroundColor: getEmotionBg(agg.topEmotionLabel) }} />
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center justify-center h-20">
                                  <p className="text-purple-300/60 text-sm">Not available</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {agg.avgMentalScores && Object.keys(agg.avgMentalScores).length > 0 && (
                              <MentalBreakdownChart avgScores={agg.avgMentalScores} />
                            )}
                            {agg.emotionMap && Object.keys(agg.emotionMap).length > 0 && (
                              <EmotionDistributionChart emotionMap={agg.emotionMap} />
                            )}
                          </div>

                          <SessionTrendGraph messages={session.messages} />

                          <div className="bg-[#160d30]/40 border border-purple-500/10 rounded-2xl overflow-hidden">
                            <button onClick={() => setExpandedPastMessages(isMsgOpen ? null : session.sessionId)}
                              className="w-full flex items-center justify-between p-4 text-left cursor-pointer">
                              <div className="flex items-center gap-3">
                                <FaComments className="text-purple-400 text-sm" />
                                <span className="text-sm font-semibold text-purple-300">Messages ({session.messages.length})</span>
                              </div>
                              <FaChevronDown className={`text-purple-400 text-xs transition-transform duration-300 ${isMsgOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isMsgOpen && (
                              <div className="px-4 pb-4 space-y-2 animate-fadeIn">
                                {session.messages.map((msg, mi) => (
                                  <div key={mi} className="bg-[#160d30]/55 rounded-xl p-3 border border-purple-500/10">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-purple-400 font-semibold text-xs">#{mi + 1}</span>
                                      <span className="text-purple-300/50 text-xs">{formatDate(msg.timestamp)}</span>
                                      {msg.highRisk && (
                                        <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/40 rounded-full text-red-400 text-[10px]">⚠ Risk</span>
                                      )}
                                    </div>
                                    <p className="text-white/90 text-sm mb-2 italic">&ldquo;{getUserText(msg)}&rdquo;</p>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      {getItemEmotionLabel(msg) && (
                                        <span className={`px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 ${getEmotionColor(getItemEmotionLabel(msg))}`}>
                                          <FaHeart className="inline mr-1 text-[10px]" />
                                          {getItemEmotionLabel(msg)} — {getItemEmotionConf(msg).toFixed(1)}%
                                        </span>
                                      )}
                                      <span className={`px-2 py-0.5 rounded-lg bg-green-500/10 border border-green-500/20 ${getMentalHealthColor(getItemMentalLabel(msg))}`}>
                                        <FaBrain className="inline mr-1 text-[10px]" />
                                        {getItemMentalLabel(msg)} — {getItemMentalConf(msg).toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, className = 'text-purple-100', icon }) => (
  <div className="bg-[#160d30]/55 rounded-xl p-3 border border-purple-500/10">
    <div className="flex items-center gap-1.5 mb-1">
      {icon}
      <span className="text-[10px] text-purple-400/70 uppercase tracking-wider">{label}</span>
    </div>
    <div className={`text-sm font-semibold ${className}`}>{value || 'N/A'}</div>
  </div>
);

export default MentalStatePage;