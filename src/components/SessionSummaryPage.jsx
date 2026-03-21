import React, { useState, useEffect } from 'react';
import { FaFileAlt, FaArrowLeft, FaChevronDown, FaComments, FaClock, FaExclamationTriangle, FaHeart, FaBrain, FaChartLine } from 'react-icons/fa';
import { API_BASE, ENDPOINTS } from '../config/api';
import Sidebar from './Sidebar';

function getToken() { return localStorage.getItem('token'); }
function authHeaders() { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }

const capitalize = (str) => {
  if (!str) return 'N/A';
  return str.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// Backend sends timestamps without 'Z' (e.g. "2026-03-17T11:35:00"), so JS
// treats them as local time instead of UTC. Appending 'Z' forces correct UTC parsing.
const parseTimestamp = (ts) => {
  if (!ts) return new Date(NaN);
  const s = String(ts);
  const hasOffset = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s);
  return new Date(hasOffset ? s : s + 'Z');
};

const formatDate = (timestamp) => {
  const date = parseTimestamp(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kathmandu',
  });
};

const trendColor = { 'Improved': 'text-green-400', 'Worsened': 'text-red-400', 'Stable': 'text-yellow-400' };

const SessionSummaryPage = ({ onBack, onHomeClick, onMentalStateClick, onHistoryClick, onFAQsClick, onSummaryClick, onLogout, user, onNewChat }) => {
  const [conversations, setConversations] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [loadingMain, setLoadingMain] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState({});
  const [expandedSession, setExpandedSession] = useState(null);

  useEffect(() => { loadConversations(); }, []);

  const loadConversations = async () => {
    setLoadingMain(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e) {
      console.error('Load conversations error:', e);
      setConversations([]);
    } finally { setLoadingMain(false); }
  };

  const generateSummary = async (sessionId) => {
    if (summaries[sessionId]) return;
    setLoadingSummary(prev => ({ ...prev, [sessionId]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      setSummaries(prev => ({ ...prev, [sessionId]: data }));
    } catch (e) {
      console.error('Summary error:', e);
      setSummaries(prev => ({ ...prev, [sessionId]: { error: true } }));
    } finally {
      setLoadingSummary(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const toggleSession = (sessionId) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
    } else {
      setExpandedSession(sessionId);
      generateSummary(sessionId);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0515] text-white overflow-hidden">
      <Sidebar
        onHomeClick={onHomeClick}
        onMentalStateClick={onMentalStateClick}
        onHistoryClick={onHistoryClick}
        onFAQsClick={onFAQsClick}
        onSummaryClick={onSummaryClick}
        onLogout={onLogout}
        currentPage="summary"
        user={user}
        onNewChat={onNewChat}
      />

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#0a0515] via-[#140a2e] to-[#0a0515]">
        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(80)].map((_, i) => (
            <div key={i} className="absolute bg-white rounded-full opacity-20 animate-pulse"
              style={{
                width: `${Math.random() * 3 + 1}px`, height: `${Math.random() * 3 + 1}px`,
                top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
                animationDuration: `${Math.random() * 3 + 2}s`
              }} />
          ))}
        </div>

        <div className="relative z-10 p-6 border-b border-purple-500/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaFileAlt className="text-3xl text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Session Summaries
                </h1>
                <p className="text-sm text-purple-300/60">
                  {conversations.length} session{conversations.length !== 1 ? 's' : ''} · Click to view summary
                </p>
              </div>
            </div>
            <button onClick={onBack}
              className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 rounded-full transition-all flex items-center gap-2">
              <FaArrowLeft /> Back
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative z-10 scrollbar-thin scrollbar-thumb-purple-700/40 scrollbar-track-transparent" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(109,40,217,0.4) transparent' }}>
          {loadingMain ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-purple-300/60 animate-pulse">Loading sessions...</div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <FaFileAlt className="text-6xl text-purple-400 mb-4 opacity-40" />
              <h2 className="text-2xl font-bold text-purple-300 mb-2">No Sessions Yet</h2>
              <p className="text-purple-300/60 mb-6">Start a conversation first, then come here to see summaries.</p>
              <button onClick={onBack}
                className="px-6 py-3 bg-purple-600/30 hover:bg-purple-600/50 rounded-full transition-all flex items-center gap-2">
                <FaArrowLeft /> Back to Chat
              </button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4">
              {conversations.map((conv) => {
                const isOpen = expandedSession === conv.session_id;
                const summary = summaries[conv.session_id];
                const isLoading = loadingSummary[conv.session_id];

                return (
                  <div key={conv.session_id}
                    className="bg-[#1a1035]/60 border border-purple-500/20 rounded-2xl backdrop-blur-md hover:border-purple-500/40 transition-all overflow-hidden">

                    <button
                      onClick={() => toggleSession(conv.session_id)}
                      className="w-full flex items-center justify-between p-5 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2.5 bg-purple-500/20 rounded-full shrink-0">
                          <FaComments className="text-purple-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-purple-200 truncate">{conv.title}</h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-purple-300/50">
                            <span className="flex items-center gap-1"><FaClock className="text-[10px]" /> {formatDate(conv.created_at)}</span>
                            <span className="flex items-center gap-1"><FaComments className="text-[10px]" /> {conv.message_count} msgs</span>
                          </div>
                        </div>
                      </div>
                      <FaChevronDown
                        className={`text-purple-400 text-sm transition-transform duration-300 shrink-0 ml-3 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 animate-fadeIn">
                        {isLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-purple-300/60 animate-pulse">Generating summary...</div>
                          </div>
                        ) : summary?.error ? (
                          <div className="text-center py-6 text-purple-300/50">Failed to generate summary. Try again later.</div>
                        ) : summary?.message_count === 0 ? (
                          <div className="text-center py-6 text-purple-300/50">No messages to summarize in this session.</div>
                        ) : summary ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <StatCard label="Messages" value={summary.message_count} />
                              <StatCard label="Trend"
                                value={summary.trend || 'N/A'}
                                className={trendColor[summary.trend] || 'text-purple-100'} />
                              <StatCard label="Primary Emotion" value={capitalize(summary.primary_emotion)} icon={<FaHeart className="text-blue-400 text-xs" />} />
                              <StatCard label="Main Concern" value={capitalize(summary.primary_category)} icon={<FaBrain className="text-green-400 text-xs" />} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <DistressBar label="Start Distress" value={Math.round((summary.start_score || 0) * 100)} />
                              <DistressBar label="Avg Distress" value={Math.round((summary.avg_distress || 0) * 100)} />
                              <DistressBar label="End Distress" value={Math.round((summary.end_score || 0) * 100)} />
                            </div>

                            {(summary.top_emotions || []).length > 0 && (
                              <div className="bg-[#0a0515]/40 rounded-xl p-4 border border-purple-500/10">
                                <div className="text-xs text-purple-400/70 uppercase tracking-wider mb-2">Top Emotions</div>
                                <div className="flex flex-wrap gap-2">
                                  {summary.top_emotions.map((e, i) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-600/20 border border-purple-500/20 text-xs text-purple-200">
                                      {capitalize(e.emotion)}
                                      <span className="text-purple-400/60">×{e.count}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(summary.risk_flags || []).length > 0 && (
                              <div className="bg-red-900/20 rounded-xl p-4 border border-red-500/20">
                                <div className="flex items-center gap-2 text-xs text-red-400 uppercase tracking-wider mb-3">
                                  <FaExclamationTriangle /> Risk Flags ({summary.risk_flags.length})
                                </div>
                                <div className="space-y-2">
                                  {summary.risk_flags.map((flag, i) => (
                                    <div key={i} className="flex items-start gap-3 text-xs bg-red-900/20 rounded-lg p-2.5 border border-red-500/10">
                                      <span className="text-red-400/80 font-mono shrink-0">#{flag.message_number}</span>
                                      <span className="text-red-200/70 break-words flex-1">{flag.text_preview}</span>
                                      <span className="shrink-0 text-red-400 font-semibold">{Math.round((flag.confidence || 0) * 100)}%</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {summary.recommendation && (
                              <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-4 border border-purple-500/20">
                                <div className="text-xs text-purple-400 uppercase tracking-wider mb-2">Recommendation</div>
                                <p className="text-sm text-purple-200 leading-relaxed">{summary.recommendation}</p>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6 mt-6">
                <h3 className="text-lg font-semibold text-purple-300 mb-3">Remember</h3>
                <p className="text-purple-200 leading-relaxed">
                  These summaries are AI-generated interpretations. They should not replace professional mental health evaluation.
                  If you're in crisis, please contact a mental health professional or crisis hotline.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, className = 'text-purple-100', icon }) => (
  <div className="bg-[#0a0515]/40 rounded-xl p-3 border border-purple-500/10">
    <div className="flex items-center gap-1.5 mb-1">
      {icon}
      <span className="text-[10px] text-purple-400/70 uppercase tracking-wider">{label}</span>
    </div>
    <div className={`text-sm font-semibold ${className}`}>{value || 'N/A'}</div>
  </div>
);

const DistressBar = ({ label, value }) => {
  const color = value > 70 ? 'bg-red-500' : value > 40 ? 'bg-yellow-400' : 'bg-green-400';
  return (
    <div className="bg-[#0a0515]/40 rounded-xl p-3 border border-purple-500/10">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-purple-400/70 uppercase tracking-wider">{label}</span>
        <span className="text-xs font-bold text-purple-100">{value}%</span>
      </div>
      <div className="w-full h-2 bg-purple-900/40 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
};

export default SessionSummaryPage;