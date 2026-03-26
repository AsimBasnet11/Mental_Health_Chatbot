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
    <div className="flex h-screen bg-[#120820] text-white overflow-hidden">
      <Sidebar onHomeClick={onHomeClick} onMentalStateClick={onMentalStateClick}
        onHistoryClick={onHistoryClick} onFAQsClick={onFAQsClick} onSummaryClick={onSummaryClick}
        currentPage="history" user={user} onLogout={onLogout} onNewChat={onNewChat} />

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#120820] via-[#1e1240] to-[#120820]">
        {/* Stars */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(80)].map((_, i) => (
            <div key={i} className="absolute bg-white rounded-full opacity-40 animate-pulse"
              style={{ width: `${Math.random()*2+1}px`, height: `${Math.random()*2+1}px`,
                top: `${Math.random()*100}%`, left: `${Math.random()*100}%`,
                animationDuration: `${Math.random()*3+2}s` }} />
          ))}
        </div>

        {/* Header */}
        <div className="relative z-10 p-6 border-b border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Conversations
              </h1>
              <p className="text-purple-300/60 mt-1">
                {conversations.length > 0 ? `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}` : 'No conversations yet'}
              </p>
            </div>
            <div className="flex gap-3">
              {conversations.length > 0 && (
                <button onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-full transition-all text-red-400 hover:text-red-300">
                  <FaTrash className="text-sm" /> Clear All
                </button>
              )}
              <button onClick={onBack}
                className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 rounded-full transition-all flex items-center gap-2">
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>
        </div>

        {/* Clear Confirmation Modal */}
        {showClearConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1e1240] border border-purple-500/30 rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-3">Clear All Conversations?</h3>
              <p className="text-purple-300/80 mb-6">This will permanently delete all conversations and messages. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-full transition-all text-white">Cancel</button>
                <button onClick={clearAll}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-full transition-all text-white font-semibold">Clear All</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete single confirmation */}
        {deleteId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1e1240] border border-purple-500/30 rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-3">Delete Conversation?</h3>
              <p className="text-purple-300/80 mb-6">This conversation and all its messages will be permanently deleted.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-full transition-all text-white">Cancel</button>
                <button onClick={() => deleteConversation(deleteId)}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-full transition-all text-white font-semibold">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden relative z-10 flex">

          {/* Conversation list (left panel) */}
          <div className={`${selectedConv ? 'w-1/3 border-r border-purple-500/20' : 'w-full'} overflow-y-auto p-6 transition-all duration-300`}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-purple-300/60 animate-pulse">Loading conversations...</div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-24 h-24 bg-purple-600/20 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="w-12 h-12 text-purple-400" />
                </div>
                <h2 className="text-2xl font-semibold text-purple-300 mb-2">No Conversations Yet</h2>
                <p className="text-purple-300/60 max-w-md">Start chatting to see your conversations here. You can continue any conversation later!</p>
                <button onClick={onHomeClick}
                  className="mt-6 px-6 py-3 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 rounded-full transition-all text-white">
                  Start a Conversation
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-w-3xl mx-auto">
                {conversations.map((conv, index) => (
                  <div key={conv.session_id}
                    onClick={() => loadMessages(conv.session_id)}
                    className={`bg-[#231550]/80 border rounded-2xl p-4 backdrop-blur-md cursor-pointer transition-all animate-fadeIn hover:bg-[#231550]/85
                      ${selectedConv?.session_id === conv.session_id ? 'border-purple-400/60 bg-[#231550]/90' : 'border-purple-500/20 hover:border-purple-500/40'}`}
                    style={{ animationDelay: `${index * 40}ms` }}>

                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-white font-medium text-sm leading-tight flex-1 mr-3 line-clamp-2">
                        {conv.title || 'Untitled conversation'}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-purple-300/50 text-xs">{formatTime(conv.updated_at)}</span>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteId(conv.session_id); }}
                          className="p-1 hover:bg-red-500/20 rounded-full transition-all text-purple-400/40 hover:text-red-400">
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-purple-300/50 text-xs">
                        {conv.conv_type === 'voice' ? (
                          <span className="flex items-center gap-1 text-pink-400/70"><FaMicrophone /> Voice</span>
                        ) : (
                          <span className="flex items-center gap-1"><FaComments /> Chat</span>
                        )}
                        <span className="flex items-center gap-1">{conv.message_count} messages</span>
                        <span className="flex items-center gap-1"><FaClock /> {formatTime(conv.created_at)}</span>
                      </div>
                    </div>

                    {conv.last_message && (
                      <p className="text-purple-300/40 text-xs mt-2 line-clamp-1 italic">
                        {conv.last_role === 'user' ? 'You: ' : 'Bot: '}{conv.last_message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message detail panel (right) */}
          {selectedConv && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Detail header */}
              <div className="p-4 border-b border-purple-500/20 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-white truncate">{selectedConv.title}</h2>
                  <p className="text-purple-300/50 text-xs">{selectedMessages.length} messages</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelectedConv(null); setSelectedMessages([]); }}
                    className="p-2 hover:bg-purple-600/20 rounded-full transition-all text-purple-300/60 hover:text-white text-sm">
                    ✕
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-thin scrollbar-thumb-purple-700/40 scrollbar-track-transparent" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(109,40,217,0.4) transparent' }}>
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-purple-300/60 animate-pulse">Loading messages...</div>
                  </div>
                ) : (
                  selectedMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`inline-block px-4 py-2 rounded-2xl max-w-[75%] break-words whitespace-pre-line text-sm
                        ${msg.role === 'user'
                          ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                          : 'bg-[#231550]/80 border border-purple-500/20 text-purple-100'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Continue button at bottom */}
              <div className="p-4 border-t border-purple-500/20 flex gap-3">
                <button onClick={() => handleContinue(selectedConv.session_id, 'chat')}
                  className="w-1/2 py-3 bg-gradient-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/50 hover:to-pink-600/50 border border-purple-500/30 rounded-xl text-white font-medium transition-all flex items-center justify-center gap-2">
                  <FaComments /> Continue in Chat
                </button>
                <button onClick={() => handleContinue(selectedConv.session_id, 'voice')}
                  className="w-1/2 py-3 bg-gradient-to-r from-pink-600/30 to-purple-600/30 hover:from-pink-600/50 hover:to-purple-600/50 border border-pink-500/30 rounded-xl text-white font-medium transition-all flex items-center justify-center gap-2">
                  <FaMicrophone /> Continue in Voice
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