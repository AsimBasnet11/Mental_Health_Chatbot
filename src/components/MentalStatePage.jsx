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
    joy: 'text-amber-600', sadness: 'text-sky-600',
    anger: 'text-rose-600', fear: 'text-indigo-600',
    surprise: 'text-emerald-600', disgust: 'text-orange-600',
    neutral: 'text-slate-500', love: 'text-pink-600',
    admiration: 'text-amber-500', amusement: 'text-yellow-600',
    optimism: 'text-green-600', gratitude: 'text-teal-600',
    curiosity: 'text-cyan-600', excitement: 'text-orange-500',
  };
  return colors[emotion?.toLowerCase()] || 'text-teal-600';
};

const getEmotionBg = (emotion) => {
  const colors = {
    joy: '#ffb300', sadness: '#039be5', anger: '#e53935', fear: '#3949ab',
    surprise: '#43a047', disgust: '#fb8c00', neutral: '#78909c', love: '#d81b60',
    admiration: '#fdd835', optimism: '#7cb342', gratitude: '#00897b', curiosity: '#00acc1',
  };
  return colors[emotion?.toLowerCase()] || '#00897b';
};

const getMentalHealthColor = (state) => {
  const s = state?.toLowerCase() || '';
  const colors = {
    normal: 'text-emerald-600', anxiety: 'text-amber-600',
    depression: 'text-sky-600', depressed: 'text-sky-600', depressive: 'text-sky-600',
    bipolar: 'text-indigo-600', suicidal: 'text-rose-700',
    'personality disorder': 'text-pink-600',
  };
  return colors[s] || 'text-teal-600';
};

const getMentalBg = (state) => {
  const s = state?.toLowerCase() || '';
  const colors = {
    normal: '#43a047', anxiety: '#ffb300', 
    depression: '#039be5', depressed: '#039be5', depressive: '#039be5',
    bipolar: '#3949ab', suicidal: '#c62828',
    'personality disorder': '#d81b60',
  };
  return colors[s] || '#00897b';
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
  t === 'Improving' ? 'text-emerald-600' : t === 'Worsening' ? 'text-rose-600' : 'text-amber-600';

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
  const CONFIDENCE_THRESHOLD = 5;

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
    <div className="bg-white/95 border border-[#a5d6a7]/30 rounded-xl p-3 shadow-xl text-sm backdrop-blur-md">
      <p className="text-slate-500 font-semibold mb-2">Message #{d?.msgNum}</p>
      <p className="font-bold mb-1" style={{ color }}>
        {d.mentalLabel} — {getDistressZone(d.distress)}
      </p>
      {d.emotionLabel && (
        <p className="text-slate-400 text-xs">Feeling: {d.emotionLabel}</p>
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
    return <circle cx={cx} cy={cy} r={5} fill={getDistressColor(payload.distress)} stroke="#fff" strokeWidth={2} />;
  };

  return (
    <div className="bg-white/80 backdrop-blur-md border border-[#a5d6a7]/30 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-500/10 rounded-full">
            <FaChartLine className="text-2xl text-teal-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Distress Level Over Time</h3>
            <p className="text-sm text-slate-500">How your mental state shifted across this session</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 mb-1 font-medium">Overall Trend</p>
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,150,136,0.1)" />
            <XAxis dataKey="msgNum" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: 'rgba(0,150,136,0.2)' }} tickLine={false}
              label={{ value: 'Message #', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(0,150,136,0.2)' }} tickLine={false}
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

      <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-[#a5d6a7]/20">
        <div className="text-center">
          <p className="text-xs text-slate-400 mb-1">Start</p>
          <p className="font-bold text-sm" style={{ color: getDistressColor(chartData[0]?.distress) }}>{chartData[0]?.mentalLabel}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-400 mb-1">Avg Distress</p>
          <p className="font-bold text-sm" style={{ color: getDistressColor(avgDistress) }}>{getDistressZone(avgDistress)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-400 mb-1">End</p>
          <p className="font-bold text-sm" style={{ color: getDistressColor(chartData[chartData.length - 1]?.distress) }}>{chartData[chartData.length - 1]?.mentalLabel}</p>
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
    <div className="bg-white/80 backdrop-blur-md border border-[#a5d6a7]/30 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-emerald-500/10 rounded-full">
          <FaChartBar className="text-2xl text-emerald-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Mental State Breakdown</h3>
          <p className="text-sm text-slate-500">Average scores across all messages in this session</p>
        </div>
      </div>
      <div className="w-full h-56" style={{ minWidth: 0, minHeight: 224 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 65 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,150,136,0.1)" vertical={false} />
            <XAxis 
              dataKey="label" 
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} 
              axisLine={{ stroke: 'rgba(0,150,136,0.2)' }} 
              tickLine={false} 
              interval={0}
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fill: '#64748b', fontSize: 11 }} 
              axisLine={{ stroke: 'rgba(0,150,136,0.2)' }} 
              tickLine={false} 
              tickFormatter={v => `${v}%`} 
              width={40}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid rgba(0,150,136,0.2)', 
                borderRadius: '12px', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                padding: '8px 12px'
              }}
              itemStyle={{ color: '#2d3436', fontWeight: 600, fontSize: '12px' }}
              labelStyle={{ color: '#64748b', marginBottom: '4px', fontWeight: 600, fontSize: '11px' }}
              formatter={(v) => [`${v}%`, 'Avg Confidence']}
              cursor={{ fill: 'rgba(0,150,136,0.05)' }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
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
    <div className="bg-white/80 backdrop-blur-md border border-[#a5d6a7]/30 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-sky-500/10 rounded-full">
          <FaChartPie className="text-2xl text-sky-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Emotion Distribution</h3>
          <p className="text-sm text-slate-500">Which emotions appeared in this session</p>
        </div>
      </div>
      <div className="w-full h-48" style={{ minWidth: 0, minHeight: 192 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={false}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} fillOpacity={0.8} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(0,150,136,0.2)', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ color: '#2d3436', fontWeight: 600 }}
              labelStyle={{ color: '#64748b', marginBottom: '4px' }}
              formatter={(v, name) => [`${v} message${v !== 1 ? 's' : ''}`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {data.map((entry, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.fill }} />
            {entry.name}
            <span className="text-slate-400">×{entry.value}</span>
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
      <div className="flex h-screen bg-[#f0f9f4] text-[#2d3436] overflow-hidden">
        <Sidebar onHomeClick={onHomeClick} onMentalStateClick={onMentalStateClick} onHistoryClick={onHistoryClick}
          onFAQsClick={onFAQsClick} onSummaryClick={onSummaryClick} onNewChat={onNewChat} onLogout={onLogout}
          currentPage="mental-state" user={user} />
        <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-br from-[#f0f9f4] via-[#fef9f5] to-[#f0f7ff]">
          <FaBrain className="text-6xl text-teal-500 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-teal-800 mb-2">No Analysis Yet</h2>
          <p className="text-slate-500 mb-6 max-w-md text-center">Share your thoughts in the chat first. All messages in this session will be analyzed together.</p>
          <button onClick={onBack} className="px-6 py-3 bg-teal-600 text-white hover:bg-teal-700 rounded-full transition-all flex items-center gap-2 shadow-lg shadow-teal-500/20">
            <FaArrowLeft /> Back to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f0f9f4] text-[#2d3436] overflow-hidden">
      <Sidebar onHomeClick={onHomeClick} onMentalStateClick={onMentalStateClick} onHistoryClick={onHistoryClick}
        onFAQsClick={onFAQsClick} onSummaryClick={onSummaryClick} onNewChat={onNewChat} onLogout={onLogout}
        currentPage="mental-state" user={user} />

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#f0f9f4] via-[#fef9f5] to-[#f0f7ff]">

        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(80)].map((_, i) => (
            <div key={i} className="absolute bg-green-200/40 rounded-full animate-pulse"
              style={{ width: `${Math.random() * 3 + 1}px`, height: `${Math.random() * 3 + 1}px`,
                top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
                animationDuration: `${Math.random() * 3 + 2}s` }} />
          ))}
        </div>

        <div className="relative z-10 p-6 border-b border-[#a5d6a7]/20 bg-white/40 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-500/10 rounded-lg shadow-sm">
                <FaBrain className="text-3xl text-teal-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Session Analysis</h1>
                <p className="text-sm text-slate-500 font-medium">
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
                  className="px-4 py-2 bg-white border border-[#a5d6a7]/40 text-teal-700 hover:bg-teal-50 rounded-full transition-all flex items-center gap-2 shadow-sm font-medium">
                  <FaHistory /> {showPastSessions ? 'Hide' : 'Past Sessions'} ({pastSessions.length})
                </button>
              )}
              <button onClick={onBack} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full transition-all flex items-center gap-2 shadow-sm font-medium">
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative z-10 scrollbar-thin scrollbar-thumb-teal-200/40 scrollbar-track-transparent"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,150,136,0.2) transparent' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-purple-300/60 animate-pulse">Loading analysis...</div>
            </div>
          ) : (
          <div className="max-w-6xl mx-auto space-y-6">

            {currentSessionMessages.length === 0 && pastSessions.length > 0 && (
              <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                <FaBrain className="text-3xl text-teal-600 shrink-0" />
                <div>
                  <h3 className="text-teal-900 font-bold">No analysis for this session yet</h3>
                  <p className="text-slate-500 text-sm mt-1">Start chatting to see real-time analysis. Your past sessions are shown below.</p>
                </div>
                <button onClick={onBack} className="ml-auto px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-full transition-all flex items-center gap-2 text-sm shrink-0 shadow-md">
                  <FaArrowLeft className="text-xs" /> Chat Now
                </button>
              </div>
            )}

            {sessionResult && (
              <div className="bg-white/90 backdrop-blur-md border border-[#a5d6a7]/40 rounded-2xl p-6 shadow-md">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-[#81c784] to-[#4db6ac] rounded-full shadow-md">
                    <FaBrain className="text-2xl text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Overall Session Result</h2>
                    <p className="text-sm text-slate-500 font-medium">Aggregated across all {sessionResult.messageCount} messages in this conversation</p>
                  </div>
                  {sessionResult.highRisk && (
                    <span className="ml-auto px-3 py-1 bg-red-100 border border-red-200 rounded-full text-red-600 text-sm font-bold animate-pulse shadow-sm">
                      ⚠ High Risk Detected
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#f1f8e9] rounded-2xl p-5 border border-[#a5d6a7]/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <FaBrain className="text-teal-600" />
                      <h3 className="text-sm font-bold text-slate-700">Overall Mental State</h3>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-3xl font-bold ${getMentalHealthColor(sessionResult.topMentalLabel)}`}>
                        {sessionResult.topMentalLabel}
                      </span>
                      <span className="text-2xl font-extrabold text-slate-700">{sessionResult.topMentalConf.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-3 bg-white border border-teal-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                        style={{ width: `${sessionResult.topMentalConf}%`, backgroundColor: getMentalBg(sessionResult.topMentalLabel) }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-3 font-semibold">
                      Confidence: {sessionResult.topMentalConf >= 70 ? 'High' : sessionResult.topMentalConf >= 50 ? 'Moderate' : 'Low'}
                    </p>
                  </div>

                  <div className="bg-[#e1f5fe]/50 rounded-2xl p-5 border border-[#81d4fa]/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <FaHeart className="text-sky-600" />
                      <h3 className="text-sm font-bold text-slate-700">Dominant Emotion</h3>
                    </div>
                    {sessionResult.topEmotionLabel ? (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-3xl font-bold ${getEmotionColor(sessionResult.topEmotionLabel)}`}>
                            {sessionResult.topEmotionLabel}
                          </span>
                          <span className="text-2xl font-extrabold text-slate-600">{sessionResult.topEmotionConf.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-3 bg-white border border-sky-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                            style={{ width: `${sessionResult.topEmotionConf}%`, backgroundColor: getEmotionBg(sessionResult.topEmotionLabel) }} />
                        </div>
                        <p className="text-xs text-slate-500 mt-3 font-semibold">Most frequent emotion across the session</p>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-20">
                        <p className="text-slate-400 text-sm font-medium">Emotion analysis not available</p>
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
              <div className="bg-white/80 border border-[#a5d6a7]/20 rounded-2xl backdrop-blur-md overflow-hidden shadow-sm">
                <button onClick={() => setMessagesOpen(!messagesOpen)}
                  className="w-full flex items-center justify-between p-5 text-left cursor-pointer hover:bg-teal-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FaComments className="text-teal-600" />
                    <span className="text-lg font-bold text-slate-800">Individual Messages ({currentSessionMessages.length})</span>
                    <span className="text-sm text-slate-500 font-medium">Per-message detection details</span>
                  </div>
                  <FaChevronDown className={`text-slate-400 text-sm transition-transform duration-300 ${messagesOpen ? 'rotate-180' : ''}`} />
                </button>
                {messagesOpen && (
                  <div className="px-5 pb-5 space-y-3 animate-fadeIn">
                    {currentSessionMessages.map((msg, mi) => (
                      <div key={mi} className="bg-white/50 rounded-xl p-4 border border-[#a5d6a7]/10 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-teal-600 font-bold text-sm">#{mi + 1}</span>
                          <span className="text-slate-400 text-xs font-medium">{formatDate(msg.timestamp)}</span>
                          {msg.highRisk && (
                            <span className="px-2 py-0.5 bg-red-100 border border-red-200 rounded-full text-red-600 text-xs font-bold">⚠ High Risk</span>
                          )}
                        </div>
                        <p className="text-slate-700 leading-relaxed text-sm mb-4 italic font-medium">&ldquo;{getUserText(msg)}&rdquo;</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {getItemEmotionLabel(msg) && (
                            <span className={`px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100 font-bold ${getEmotionColor(getItemEmotionLabel(msg))}`}>
                              <FaHeart className="inline mr-1.5 text-[10px]" />
                              {getItemEmotionLabel(msg)} — {getItemEmotionConf(msg).toFixed(1)}%
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 font-bold ${getMentalHealthColor(getItemMentalLabel(msg))}`}>
                            <FaBrain className="inline mr-1.5 text-[10px]" />
                            {getItemMentalLabel(msg)} — {getItemMentalConf(msg).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-gradient-to-r from-teal-50 to-sky-50 border border-teal-100 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-teal-800 mb-3 flex items-center gap-2">
                <span className="text-xl">💡</span> Remember
              </h3>
              <p className="text-slate-600 leading-relaxed font-medium">
                This analysis is based on AI interpretation and should not replace professional mental health advice.
                If you're experiencing severe emotional distress, please reach out to a mental health professional or crisis hotline.
              </p>
            </div>

            {showPastSessions && pastSessions.length > 0 && (
              <div className="space-y-4 pt-4">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <FaHistory className="text-teal-600" /> Past Sessions
                  <span className="text-sm font-medium text-slate-400 ml-2">{pastSessions.length} session{pastSessions.length !== 1 ? 's' : ''}</span>
                </h3>

                {pastSessions.map((session) => {
                  const isOpen = expandedPastSession === session.sessionId;
                  const agg = session.aggregate;
                  const isMsgOpen = expandedPastMessages === session.sessionId;
                  return (
                    <div key={session.sessionId}
                      className="bg-white/60 border border-slate-200 rounded-2xl backdrop-blur-md hover:border-teal-500/20 transition-all overflow-hidden shadow-sm">
                      <button onClick={() => setExpandedPastSession(isOpen ? null : session.sessionId)}
                        className="w-full flex items-center justify-between p-5 text-left cursor-pointer hover:bg-teal-50/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center gap-2 text-slate-500 text-sm shrink-0 font-medium">
                            <FaClock className="text-xs text-teal-600/50" /> {formatDate(session.firstTimestamp)}
                          </div>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center gap-1.5 text-slate-500 text-sm shrink-0 font-medium">
                            <FaComments className="text-xs text-sky-600/50" /> {session.messages.length}
                          </span>
                          {agg?.topMentalLabel && (
                            <span className={`text-sm font-bold truncate ${getMentalHealthColor(agg.topMentalLabel)}`}>{agg.topMentalLabel}</span>
                          )}
                          {agg?.topEmotionLabel && (
                            <span className={`text-sm font-bold truncate ${getEmotionColor(agg.topEmotionLabel)}`}>{agg.topEmotionLabel}</span>
                          )}
                          {agg?.highRisk && (
                            <span className="px-2 py-0.5 bg-red-100 border border-red-200 rounded-full text-red-600 text-xs font-bold shrink-0">High Risk</span>
                          )}
                        </div>
                        <FaChevronDown className={`text-slate-400 text-sm transition-transform duration-300 shrink-0 ml-3 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isOpen && agg && (
                        <div className="px-5 pb-5 space-y-5 animate-fadeIn">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#f1f8e9]/50 rounded-2xl p-5 border border-[#a5d6a7]/20 shadow-sm">
                              <div className="flex items-center gap-2 mb-4">
                                <FaBrain className="text-teal-600" />
                                <h3 className="text-sm font-bold text-slate-700">Overall Mental State</h3>
                              </div>
                              <div className="flex items-center justify-between mb-3">
                                <span className={`text-3xl font-bold ${getMentalHealthColor(agg.topMentalLabel)}`}>{agg.topMentalLabel}</span>
                                <span className="text-2xl font-extrabold text-slate-700">{agg.topMentalConf.toFixed(1)}%</span>
                              </div>
                              <div className="w-full h-3 bg-white border border-teal-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                                  style={{ width: `${agg.topMentalConf}%`, backgroundColor: getMentalBg(agg.topMentalLabel) }} />
                              </div>
                              <p className="text-xs text-slate-500 mt-3 font-semibold">
                                Confidence: {agg.topMentalConf >= 70 ? 'High' : agg.topMentalConf >= 50 ? 'Moderate' : 'Low'}
                              </p>
                            </div>

                            <div className="bg-[#e1f5fe]/40 rounded-2xl p-5 border border-[#81d4fa]/20 shadow-sm">
                              <div className="flex items-center gap-2 mb-4">
                                <FaHeart className="text-sky-600" />
                                <h3 className="text-sm font-bold text-slate-700">Dominant Emotion</h3>
                              </div>
                              {agg.topEmotionLabel ? (
                                <>
                                  <div className="flex items-center justify-between mb-3">
                                    <span className={`text-3xl font-bold ${getEmotionColor(agg.topEmotionLabel)}`}>{agg.topEmotionLabel}</span>
                                    <span className="text-2xl font-extrabold text-slate-600">{agg.topEmotionConf.toFixed(1)}%</span>
                                  </div>
                                  <div className="w-full h-3 bg-white border border-sky-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                                      style={{ width: `${agg.topEmotionConf}%`, backgroundColor: getEmotionBg(agg.topEmotionLabel) }} />
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center justify-center h-20">
                                  <p className="text-slate-400 text-sm font-medium">Not available</p>
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

                          <div className="bg-white/40 border border-[#a5d6a7]/10 rounded-2xl overflow-hidden shadow-sm">
                            <button onClick={() => setExpandedPastMessages(isMsgOpen ? null : session.sessionId)}
                              className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-teal-50/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <FaComments className="text-teal-600/60 text-sm" />
                                <span className="text-sm font-bold text-slate-700">Messages ({session.messages.length})</span>
                              </div>
                              <FaChevronDown className={`text-slate-400 text-xs transition-transform duration-300 ${isMsgOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isMsgOpen && (
                              <div className="px-4 pb-4 space-y-2 animate-fadeIn">
                                {session.messages.map((msg, mi) => (
                                  <div key={mi} className="bg-white/50 rounded-xl p-3 border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-teal-600 font-bold text-xs">#{mi + 1}</span>
                                      <span className="text-slate-400 text-[10px] font-medium">{formatDate(msg.timestamp)}</span>
                                      {msg.highRisk && (
                                        <span className="px-1.5 py-0.5 bg-red-100 border border-red-200 rounded-full text-red-600 text-[10px] font-bold">⚠ Risk</span>
                                      )}
                                    </div>
                                    <p className="text-slate-600 text-sm mb-2 italic font-medium">&ldquo;{getUserText(msg)}&rdquo;</p>
                                    <div className="flex flex-wrap gap-2 text-[10px]">
                                      {getItemEmotionLabel(msg) && (
                                        <span className={`px-2 py-0.5 rounded-lg bg-sky-50 border border-sky-100 font-bold ${getEmotionColor(getItemEmotionLabel(msg))}`}>
                                          <FaHeart className="inline mr-1 text-[10px]" />
                                          {getItemEmotionLabel(msg)} — {getItemEmotionConf(msg).toFixed(1)}%
                                        </span>
                                      )}
                                      <span className={`px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-100 font-bold ${getMentalHealthColor(getItemMentalLabel(msg))}`}>
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

const StatCard = ({ label, value, className = 'text-slate-700', icon }) => (
  <div className="bg-white/50 rounded-xl p-3 border border-[#a5d6a7]/10 shadow-sm">
    <div className="flex items-center gap-1.5 mb-1">
      {icon}
      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{label}</span>
    </div>
    <div className={`text-sm font-bold ${className}`}>{value || 'N/A'}</div>
  </div>
);

export default MentalStatePage;