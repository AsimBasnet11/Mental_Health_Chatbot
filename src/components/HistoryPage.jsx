import React, { useState, useEffect } from 'react';
import { FaTrash, FaClock, FaComments, FaArrowRight, FaArrowLeft, FaMicrophone } from 'react-icons/fa';
import { MessageSquare } from 'lucide-react';
import Sidebar from './Sidebar';

import { API_BASE } from '../config/api';
function getToken() { return localStorage.getItem('token'); }
function authHeaders() { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }

const HistoryPage = ({
  onBack, onHomeClick, onMentalStateClick, onHistoryClick, onFAQsClick, onSummaryClick,
  user, onLogout, onNewChat, onContinueConversation, onHistoryCleared
}) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { loadConversations(); }, []);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e) {
      console.error('Load conversations error:', e);
      setConversations([]);
    } finally { setLoading(false); }
  };

  const loadMessages = async (sessionId) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${sessionId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setSelectedConv(data);
      setSelectedMessages(data.messages || []);
    } catch (e) {
      console.error('Load messages error:', e);
    } finally { setLoadingMessages(false); }
  };

  const deleteConversation = async (sessionId) => {
    try {
      await fetch(`${API_BASE}/api/conversations/${sessionId}`, { method: 'DELETE', headers: authHeaders() });
      setConversations(prev => prev.filter(c => c.session_id !== sessionId));
      if (selectedConv?.session_id === sessionId) { setSelectedConv(null); setSelectedMessages([]); }
    } catch (e) { console.error('Delete error:', e); }
    setDeleteId(null);
  };

  const clearAll = async () => {
    try {
      await fetch(`${API_BASE}/api/conversations`, { method: 'DELETE', headers: authHeaders() });
      setConversations([]); setSelectedConv(null); setSelectedMessages([]); if (onHistoryCleared) onHistoryCleared();
    } catch (e) { console.error('Clear all error:', e); }
    setShowClearConfirm(false);
  };

  const formatTime = (timestamp) => {
    if (!timestamp && timestamp !== 0) return '';

    // Normalize numeric timestamps (seconds -> milliseconds)
    let t = timestamp;
    if (typeof t === 'string' && /^\d+$/.test(t)) t = parseInt(t, 10);
    if (typeof t === 'number' && t < 1e12) t = t * 1000;

    // Ensure UTC parsing — append Z if missing so JS treats as UTC not local
    if (typeof t === 'string' && !t.endsWith('Z') && !t.includes('+')) {
      t = t + 'Z';
    }

    const date = new Date(t);
    if (isNaN(date.getTime())) return '';

    // Calculate relative time correctly
    const now = new Date();
    const diffMs = now - date;
    if (diffMs < 0) return date.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' });

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffSeconds / 3600);
    const diffDays = Math.floor(diffSeconds / 86400);

    if (diffSeconds < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    // Display Nepal time for absolute dates
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Kathmandu',
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const handleContinue = (sessionId, forceType) => {
    const conv = conversations.find(c => c.session_id === sessionId);
    let convType = conv?.conv_type || 'chat';
    if (forceType) convType = forceType;
    if (onContinueConversation) onContinueConversation(sessionId, convType);
  };

  return (
    <div className="flex h-screen bg-[#f0f9f4] text-[#2d3436] overflow-hidden">
      <Sidebar onHomeClick={onHomeClick} onMentalStateClick={onMentalStateClick}
        onHistoryClick={onHistoryClick} onFAQsClick={onFAQsClick} onSummaryClick={onSummaryClick}
        currentPage="history" user={user} onLogout={onLogout} onNewChat={onNewChat} />

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#f0f9f4] via-[#fef9f5] to-[#f0f7ff]">
        {/* Stars */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(80)].map((_, i) => (
            <div key={i} className="absolute bg-[#a5d6a7]/40 rounded-full animate-pulse"
              style={{ width: `${Math.random()*2+1}px`, height: `${Math.random()*2+1}px`,
                top: `${Math.random()*100}%`, left: `${Math.random()*100}%`,
                animationDuration: `${Math.random()*3+2}s` }} />
          ))}
        </div>

        {/* Header */}
        <div className="relative z-10 p-6 border-b border-[#a5d6a7]/20 bg-white/40 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800">
                Conversations
              </h1>
              <p className="text-slate-500 mt-1 font-medium">
                {conversations.length > 0 ? `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}` : 'No conversations yet'}
              </p>
            </div>
            <div className="flex gap-3">
              {conversations.length > 0 && (
                <button onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-full transition-all text-rose-600 font-bold shadow-sm">
                  <FaTrash className="text-sm" /> Clear All
                </button>
              )}
              <button onClick={onBack}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full transition-all flex items-center gap-2 shadow-sm font-bold">
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>
        </div>

        {/* Clear Confirmation Modal */}
        {showClearConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
              <h3 className="text-xl font-bold text-slate-800 mb-3">Clear All Conversations?</h3>
              <p className="text-slate-500 mb-6 font-medium">This will permanently delete all conversations and messages. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-all text-slate-700 font-bold">Cancel</button>
                <button onClick={clearAll}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-full transition-all text-white font-bold shadow-lg shadow-rose-500/20">Clear All</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete single confirmation */}
        {deleteId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
              <h3 className="text-xl font-bold text-slate-800 mb-3">Delete Conversation?</h3>
              <p className="text-slate-500 mb-6 font-medium">This conversation and all its messages will be permanently deleted.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-all text-slate-700 font-bold">Cancel</button>
                <button onClick={() => deleteConversation(deleteId)}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-full transition-all text-white font-bold shadow-lg shadow-rose-500/20">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden relative z-10 flex">

          {/* Conversation list (left panel) */}
          <div className={`${selectedConv ? 'w-1/3 border-r border-[#a5d6a7]/20' : 'w-full'} overflow-y-auto p-6 transition-all duration-300`}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-slate-400 animate-pulse font-medium">Loading conversations...</div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-24 h-24 bg-teal-500/10 rounded-full flex items-center justify-center mb-6 shadow-sm">
                  <MessageSquare className="w-12 h-12 text-teal-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">No Conversations Yet</h2>
                <p className="text-slate-500 max-w-md font-medium leading-relaxed">Start chatting to see your conversations here. You can continue any conversation later!</p>
                <button onClick={onHomeClick}
                  className="mt-8 px-8 py-3 bg-teal-600 text-white hover:bg-teal-700 rounded-full transition-all font-bold shadow-lg shadow-teal-500/20">
                  Start a Conversation
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-w-4xl mx-auto">
                {conversations.map((conv, index) => (
                  <div key={conv.session_id}
                    onClick={() => loadMessages(conv.session_id)}
                    className={`bg-white/70 border rounded-2xl p-5 backdrop-blur-md cursor-pointer transition-all animate-fadeIn shadow-sm hover:shadow-md
                      ${selectedConv?.session_id === conv.session_id ? 'border-teal-400 bg-white/90 ring-4 ring-teal-500/5' : 'border-[#a5d6a7]/30 hover:border-teal-400/50'}`}
                    style={{ animationDelay: `${index * 40}ms` }}>

                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-slate-800 font-bold text-sm leading-tight flex-1 mr-4 line-clamp-2">
                        {conv.title || 'Untitled conversation'}
                      </h3>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{formatTime(conv.updated_at)}</span>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteId(conv.session_id); }}
                          className="p-1.5 hover:bg-rose-50 rounded-full transition-all text-slate-300 hover:text-rose-500">
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-slate-500 text-[11px] font-bold">
                        {conv.conv_type === 'voice' ? (
                          <span className="flex items-center gap-1.5 text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md"><FaMicrophone className="text-[10px]" /> Voice</span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md"><FaComments className="text-[10px]" /> Chat</span>
                        )}
                        <span className="flex items-center gap-1.5"><FaComments className="text-teal-500/50" /> {conv.message_count} messages</span>
                        <span className="flex items-center gap-1.5"><FaClock className="text-orange-400/50" /> {formatTime(conv.created_at)}</span>
                      </div>
                    </div>

                    {conv.last_message && (
                      <p className="text-slate-400 text-xs mt-3 line-clamp-1 italic font-medium">
                        {conv.last_role === 'user' ? 'You: ' : 'Aria: '}{conv.last_message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message detail panel (right) */}
          {selectedConv && (
            <div className="flex-1 flex flex-col overflow-hidden bg-white/40 backdrop-blur-md">
              {/* Detail header */}
              <div className="p-5 border-b border-[#a5d6a7]/20 flex items-center justify-between bg-white/40">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-slate-800 truncate">{selectedConv.title}</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">{selectedMessages.length} messages</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelectedConv(null); setSelectedMessages([]); }}
                    className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-600 text-lg">
                    ✕
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-teal-200/40 scrollbar-track-transparent" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,150,136,0.2) transparent' }}>
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-slate-400 animate-pulse font-medium">Loading messages...</div>
                  </div>
                ) : (
                  selectedMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`inline-block px-5 py-3 rounded-2xl max-w-[80%] break-words whitespace-pre-line text-sm font-medium shadow-sm transition-all
                        ${msg.role === 'user'
                          ? 'bg-[#bbdefb] text-blue-900 border border-[#90caf9]'
                          : 'bg-[#ffebee] text-rose-900 border border-[#ffcdd2]'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Continue button at bottom */}
              <div className="p-5 border-t border-[#a5d6a7]/20 flex gap-4 bg-white/20">
                <button onClick={() => handleContinue(selectedConv.session_id, 'chat')}
                  className="w-1/2 py-4 bg-teal-600 text-white hover:bg-teal-700 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-teal-500/10">
                  <FaComments /> Continue Chat
                </button>
                <button onClick={() => handleContinue(selectedConv.session_id, 'voice')}
                  className="w-1/2 py-4 bg-rose-500 text-white hover:bg-rose-600 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-rose-500/10">
                  <FaMicrophone /> Continue Voice
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;