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

const trendColor = { 'Improved': 'text-emerald-600', 'Worsened': 'text-rose-600', 'Stable': 'text-amber-600' };

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
    <div className="flex h-screen bg-[#f0f9f4] text-[#2d3436] overflow-hidden">
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

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#f0f9f4] via-[#fef9f5] to-[#f0f7ff]">
        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(80)].map((_, i) => (
            <div key={i} className="absolute bg-[#a5d6a7]/40 rounded-full animate-pulse"
              style={{
                width: `${Math.random() * 3 + 1}px`, height: `${Math.random() * 3 + 1}px`,
                top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
                animationDuration: `${Math.random() * 3 + 2}s`
              }} />
          ))}
        </div>

        <div className="relative z-10 p-6 border-b border-[#a5d6a7]/20 bg-white/40 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-500/10 rounded-lg shadow-sm">
                <FaFileAlt className="text-3xl text-teal-600" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-800">
                  Session Summaries
                </h1>
                <p className="text-sm text-slate-500 font-medium">
                  {conversations.length} session{conversations.length !== 1 ? 's' : ''} · Click to view summary
                </p>
              </div>
            </div>
            <button onClick={onBack}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full transition-all flex items-center gap-2 shadow-sm font-bold">
              <FaArrowLeft /> Back
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative z-10 scrollbar-thin scrollbar-thumb-teal-200/40 scrollbar-track-transparent" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,150,136,0.2) transparent' }}>
          {loadingMain ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-400 animate-pulse font-medium">Loading sessions...</div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="p-6 bg-teal-500/10 rounded-full mb-6">
                <FaFileAlt className="text-6xl text-teal-600 opacity-40" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">No Sessions Yet</h2>
              <p className="text-slate-500 mb-8 font-medium">Start a conversation first, then come here to see summaries.</p>
              <button onClick={onBack}
                className="px-8 py-3 bg-teal-600 text-white hover:bg-teal-700 rounded-full transition-all flex items-center gap-3 font-bold shadow-lg shadow-teal-500/20">
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
                    className="bg-white/70 border border-[#a5d6a7]/30 rounded-2xl backdrop-blur-md hover:border-teal-400/50 transition-all overflow-hidden shadow-sm">

                    <button
                      onClick={() => toggleSession(conv.session_id)}
                      className="w-full flex items-center justify-between p-5 text-left cursor-pointer hover:bg-teal-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="p-2.5 bg-teal-500/10 rounded-full shrink-0">
                          <FaComments className="text-teal-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-slate-800 truncate">{conv.title}</h3>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                            <span className="flex items-center gap-1.5"><FaClock className="text-teal-400/60" /> {formatDate(conv.created_at)}</span>
                            <span className="flex items-center gap-1.5"><FaComments className="text-sky-400/60" /> {conv.message_count} msgs</span>
                          </div>
                        </div>
                      </div>
                      <FaChevronDown
                        className={`text-slate-400 text-sm transition-transform duration-300 shrink-0 ml-3 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 animate-fadeIn">
                        {isLoading ? (
                          <div className="flex items-center justify-center py-10">
                            <div className="text-slate-400 animate-pulse font-medium">Generating summary...</div>
                          </div>
                        ) : summary?.error ? (
                          <div className="text-center py-10 text-rose-500 font-medium bg-rose-50 rounded-xl border border-rose-100">Failed to generate summary. Try again later.</div>
                        ) : summary?.message_count === 0 ? (
                          <div className="text-center py-10 text-slate-400 font-medium bg-slate-50 rounded-xl border border-slate-100">No messages to summarize in this session.</div>
                        ) : summary ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <StatCard label="Messages" value={summary.message_count} />
                              <StatCard label="Trend"
                                value={summary.trend || 'N/A'}
                                className={trendColor[summary.trend] || 'text-slate-700'} />
                              <StatCard label="Primary Emotion" value={capitalize(summary.primary_emotion)} icon={<FaHeart className="text-rose-400 text-xs" />} />
                              <StatCard label="Main Concern" value={capitalize(summary.primary_category)} icon={<FaBrain className="text-teal-600 text-xs" />} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <DistressBar label="Start Distress" value={Math.round((summary.start_score || 0) * 100)} />
                              <DistressBar label="Avg Distress" value={Math.round((summary.avg_distress || 0) * 100)} />
                              <DistressBar label="End Distress" value={Math.round((summary.end_score || 0) * 100)} />
                            </div>

                            {(summary.top_emotions || []).length > 0 && (
                              <div className="bg-white/50 rounded-xl p-4 border border-[#a5d6a7]/10 shadow-sm">
                                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-3">Top Emotions</div>
                                <div className="flex flex-wrap gap-2">
                                  {summary.top_emotions.map((e, i) => (
                                    <span key={i} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-100 text-xs text-sky-700 font-bold shadow-sm">
                                      {capitalize(e.emotion)}
                                      <span className="text-sky-400/70 border-l border-sky-200 pl-2">×{e.count}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(summary.risk_flags || []).length > 0 && (
                              <div className="bg-rose-50 rounded-xl p-5 border border-rose-100 shadow-sm">
                                <div className="flex items-center gap-2 text-xs text-rose-600 uppercase tracking-wider font-bold mb-4">
                                  <FaExclamationTriangle className="text-rose-500" /> Risk Flags ({summary.risk_flags.length})
                                </div>
                                <div className="space-y-3">
                                  {summary.risk_flags.map((flag, i) => (
                                    <div key={i} className="flex items-start gap-4 text-xs bg-white rounded-xl p-3 border border-rose-100 shadow-sm">
                                      <span className="text-rose-500 font-bold bg-rose-50 px-2 py-1 rounded-md shrink-0">#{flag.message_number}</span>
                                      <span className="text-slate-600 font-medium break-words flex-1 leading-relaxed">"{flag.text_preview}"</span>
                                      <span className="shrink-0 text-rose-600 font-bold bg-rose-100/50 px-2 py-1 rounded-md">{Math.round((flag.confidence || 0) * 100)}%</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                             {summary.recommendation && (
                              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl p-5 border border-teal-100 shadow-sm">
                                <div className="text-[10px] text-teal-600 uppercase tracking-wider font-bold mb-2">Aria's Recommendation</div>
                                <p className="text-sm text-slate-700 leading-relaxed font-medium">{summary.recommendation}</p>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="bg-gradient-to-r from-teal-50 to-sky-50 border border-teal-100 rounded-2xl p-8 mt-10 shadow-sm">
                <h3 className="text-xl font-bold text-teal-800 mb-3">Remember</h3>
                <p className="text-slate-600 leading-relaxed font-medium">
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

const StatCard = ({ label, value, className = 'text-slate-700', icon }) => (
  <div className="bg-white/50 rounded-xl p-3 border border-[#a5d6a7]/10 shadow-sm">
    <div className="flex items-center gap-1.5 mb-1">
      {icon}
      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
    </div>
    <div className={`text-sm font-bold ${className}`}>{value || 'N/A'}</div>
  </div>
);

const DistressBar = ({ label, value }) => {
  const color = value > 70 ? 'bg-rose-500' : value > 40 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="bg-white/50 rounded-xl p-3 border border-[#a5d6a7]/10 shadow-sm">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
        <span className="text-xs font-extrabold text-slate-700">{value}%</span>
      </div>
      <div className="w-full h-2.5 bg-slate-100 border border-slate-200/50 rounded-full overflow-hidden shadow-inner">
        <div className={`h-full rounded-full transition-all duration-700 shadow-sm ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
};

export default SessionSummaryPage;