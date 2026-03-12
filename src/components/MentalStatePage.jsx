import React, { useState, useEffect } from 'react';
import { FaBrain, FaHeart, FaHistory, FaArrowLeft, FaCalendar, FaQuoteLeft, FaExclamationTriangle } from 'react-icons/fa';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Sidebar from './Sidebar';

const API_BASE = "http://localhost:8000";
function getToken() { return localStorage.getItem('token'); }
function authHeaders() { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }

const COLORS = ['#a78bfa', '#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f87171', '#818cf8'];
const MENTAL_COLORS = {
  Normal: '#34d399', Anxiety: '#fbbf24', Depression: '#60a5fa',
  Bipolar: '#a78bfa', 'Personality Disorder': '#f472b6', Suicidal: '#ef4444'
};

const MentalStatePage = ({
  onBack, onHomeClick, onMentalStateClick, onHistoryClick, onFAQsClick,
  user, onLogout, onNewChat, currentSessionId
}) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/history`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setHistory((data.history || []).reverse()); // oldest first for charts
    } catch (e) {
      console.error('Load history error:', e);
      setHistory([]);
    } finally { setLoading(false); }
  };

  // Current session entries
  const currentEntries = history.filter(h => h.sessionId === currentSessionId);
  const allEntries = history;
  const displayEntries = showAllHistory ? allEntries : (currentEntries.length > 0 ? currentEntries : allEntries);
  const latest = displayEntries.length > 0 ? displayEntries[displayEntries.length - 1] : null;

  // Prepare chart data
  const timelineData = displayEntries.map((h, i) => ({
    index: i + 1,
    time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    mentalConf: Math.round((h.mentalHealth?.confidence || 0) * 100),
    emotionConf: h.emotion ? Math.round((h.emotion.confidence || 0) * 100) : 0,
    mental: h.mentalHealth?.label || 'Unknown',
    emotion: h.emotion?.label || 'N/A',
  }));

  // Mental state distribution (pie)
  const mentalCounts = {};
  displayEntries.forEach(h => {
    const label = h.mentalHealth?.label || 'Unknown';
    mentalCounts[label] = (mentalCounts[label] || 0) + 1;
  });
  const pieData = Object.entries(mentalCounts).map(([name, value]) => ({ name, value }));

  // Emotion distribution (bar)
  const emotionCounts = {};
  displayEntries.forEach(h => {
    if (h.emotion?.label) {
      const label = h.emotion.label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      emotionCounts[label] = (emotionCounts[label] || 0) + 1;
    }
  });
  const barData = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const formatLabel = (str) => str?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';
  const getMentalColor = (state) => MENTAL_COLORS[state] || '#a78bfa';

  if (loading) {
    return (
      <div className="flex h-screen bg-[#0a0515] text-white overflow-hidden">
        <Sidebar onHomeClick={onHomeClick} onMentalStateClick={onMentalStateClick}
          onHistoryClick={onHistoryClick} onFAQsClick={onFAQsClick}
          currentPage="mental-state" user={user} onLogout={onLogout} onNewChat={onNewChat} />
        <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-br from-[#0a0515] via-[#140a2e] to-[#0a0515]">
          <FaBrain className="text-6xl text-purple-400 mb-4 animate-pulse" />
          <p className="text-purple-300/60">Loading analysis data...</p>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex h-screen bg-[#0a0515] text-white overflow-hidden">
        <Sidebar onHomeClick={onHomeClick} onMentalStateClick={onMentalStateClick}
          onHistoryClick={onHistoryClick} onFAQsClick={onFAQsClick}
          currentPage="mental-state" user={user} onLogout={onLogout} onNewChat={onNewChat} />
        <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-br from-[#0a0515] via-[#140a2e] to-[#0a0515]">
          <FaBrain className="text-6xl text-purple-400 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-purple-300 mb-2">No Analysis Yet</h2>
          <p className="text-purple-300/60 mb-6">Share your thoughts in the chat first.</p>
          <button onClick={onBack}
            className="px-6 py-3 bg-purple-600/30 hover:bg-purple-600/50 rounded-full transition-all flex items-center gap-2">
            <FaArrowLeft /> Back to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0515] text-white overflow-hidden">
      <Sidebar onHomeClick={onHomeClick} onMentalStateClick={onMentalStateClick}
        onHistoryClick={onHistoryClick} onFAQsClick={onFAQsClick}
        currentPage="mental-state" user={user} onLogout={onLogout} onNewChat={onNewChat} />

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#0a0515] via-[#140a2e] to-[#0a0515]">
        {/* Stars */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(100)].map((_, i) => (
            <div key={i} className="absolute bg-white rounded-full opacity-20 animate-pulse"
              style={{ width: `${Math.random()*3+1}px`, height: `${Math.random()*3+1}px`,
                top: `${Math.random()*100}%`, left: `${Math.random()*100}%`,
                animationDuration: `${Math.random()*3+2}s` }} />
          ))}
        </div>

        {/* Header */}
        <div className="relative z-10 p-6 border-b border-purple-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaBrain className="text-3xl text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Mental State Analysis
                </h1>
                <p className="text-sm text-purple-300/60">
                  {showAllHistory ? 'All sessions' : currentEntries.length > 0 ? 'Current session' : 'All sessions'} · {displayEntries.length} analyses
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              {currentEntries.length > 0 && (
                <button onClick={() => setShowAllHistory(!showAllHistory)}
                  className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 rounded-full transition-all flex items-center gap-2 text-sm">
                  <FaHistory /> {showAllHistory ? 'Current Session' : 'All Sessions'}
                </button>
              )}
              <button onClick={onBack}
                className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 rounded-full transition-all flex items-center gap-2">
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 relative z-10">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Latest Analysis Card */}
            {latest && (
              <>
                <div className="flex items-center gap-2 text-purple-300/60 text-sm">
                  <FaCalendar />
                  <span>Latest analysis: {new Date(latest.timestamp).toLocaleString()}</span>
                </div>

                {/* Latest text */}
                <div className="bg-[#1a1035]/60 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FaQuoteLeft className="text-purple-400" />
                    <h3 className="text-lg font-semibold text-purple-300">Latest Message Analyzed</h3>
                  </div>
                  <p className="text-purple-200 leading-relaxed italic">"{latest.userText}"</p>
                </div>

                {/* Analysis Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Emotion */}
                  <div className="bg-[#1a1035]/60 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-blue-500/20 rounded-full"><FaHeart className="text-2xl text-blue-400" /></div>
                      <div>
                        <h3 className="text-lg font-semibold text-purple-300">Emotion Detected</h3>
                        <p className="text-sm text-purple-300/60">Primary emotional state</p>
                      </div>
                    </div>
                    {latest.emotion ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-3xl font-bold text-blue-400">{formatLabel(latest.emotion.label)}</span>
                          <span className="text-2xl font-bold text-purple-300">{Math.round((latest.emotion.confidence || 0) * 100)}%</span>
                        </div>
                        <div className="w-full h-3 bg-purple-900/30 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${Math.round((latest.emotion.confidence || 0) * 100)}%` }} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-purple-300/60 text-sm">Not available</p>
                    )}
                  </div>

                  {/* Mental Health */}
                  <div className="bg-[#1a1035]/60 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-green-500/20 rounded-full"><FaBrain className="text-2xl text-green-400" /></div>
                      <div>
                        <h3 className="text-lg font-semibold text-purple-300">Mental Health State</h3>
                        <p className="text-sm text-purple-300/60">Overall wellness indicator</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-3xl font-bold`} style={{ color: getMentalColor(latest.mentalHealth?.label) }}>
                        {formatLabel(latest.mentalHealth?.label)}
                      </span>
                      <span className="text-2xl font-bold text-purple-300">{Math.round((latest.mentalHealth?.confidence || 0) * 100)}%</span>
                    </div>
                    <div className="w-full h-3 bg-purple-900/30 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${Math.round((latest.mentalHealth?.confidence || 0) * 100)}%` }} />
                    </div>
                    {latest.highRisk && (
                      <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                        <FaExclamationTriangle /> High risk detected. Please reach out for support.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Charts Section */}
            {displayEntries.length >= 2 && (
              <>
                {/* Timeline Chart */}
                <div className="bg-[#1a1035]/60 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-purple-300 mb-4">Confidence Over Time</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a1f45" />
                      <XAxis dataKey="time" stroke="#7c3aed" tick={{ fill: '#a78bfa', fontSize: 11 }} />
                      <YAxis stroke="#7c3aed" tick={{ fill: '#a78bfa', fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1035', border: '1px solid #7c3aed', borderRadius: 12, color: '#e9d5ff' }}
                        formatter={(value, name) => [`${value}%`, name === 'mentalConf' ? 'Mental Health' : 'Emotion']} />
                      <Legend wrapperStyle={{ color: '#a78bfa' }} />
                      <Line type="monotone" dataKey="mentalConf" name="Mental Health" stroke="#34d399" strokeWidth={2} dot={{ fill: '#34d399', r: 4 }} />
                      <Line type="monotone" dataKey="emotionConf" name="Emotion" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Mental State Distribution Pie */}
                  {pieData.length > 0 && (
                    <div className="bg-[#1a1035]/60 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
                      <h3 className="text-lg font-semibold text-purple-300 mb-4">Mental State Distribution</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={MENTAL_COLORS[pieData[i].name] || COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#1a1035', border: '1px solid #7c3aed', borderRadius: 12, color: '#e9d5ff' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Emotion Distribution Bar */}
                  {barData.length > 0 && (
                    <div className="bg-[#1a1035]/60 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
                      <h3 className="text-lg font-semibold text-purple-300 mb-4">Top Emotions</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={barData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a1f45" />
                          <XAxis type="number" stroke="#7c3aed" tick={{ fill: '#a78bfa', fontSize: 11 }} />
                          <YAxis dataKey="name" type="category" stroke="#7c3aed" tick={{ fill: '#a78bfa', fontSize: 11 }} width={100} />
                          <Tooltip contentStyle={{ backgroundColor: '#1a1035', border: '1px solid #7c3aed', borderRadius: 12, color: '#e9d5ff' }} />
                          <Bar dataKey="count" fill="#a78bfa" radius={[0, 6, 6, 0]}>
                            {barData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Recent Analyses List */}
            <div className="bg-[#1a1035]/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-purple-300 mb-4 flex items-center gap-2">
                <FaHistory /> Recent Analyses
              </h3>
              <div className="space-y-3">
                {displayEntries.slice().reverse().slice(0, 10).map((item, idx) => (
                  <div key={idx} className="bg-[#0a0515]/50 border border-purple-500/20 rounded-lg p-4 hover:border-purple-500/40 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-purple-300/60">
                        {new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex gap-4">
                        {item.emotion && (
                          <span className="text-sm font-semibold text-blue-400">{formatLabel(item.emotion.label)}</span>
                        )}
                        <span className="text-sm font-semibold" style={{ color: getMentalColor(item.mentalHealth?.label) }}>
                          {formatLabel(item.mentalHealth?.label)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-purple-300/80 line-clamp-2">"{item.userText}"</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-purple-300 mb-3">Remember</h3>
              <p className="text-purple-200 leading-relaxed">
                This analysis is based on AI interpretation and should not replace professional mental health advice.
                If you're experiencing severe emotional distress, please reach out to a mental health professional or crisis hotline.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MentalStatePage;
