import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInputBar from './components/ChatInputBar';
import VoicePage from './components/VoicePage';
import MentalStatePage from './components/MentalStatePage';
import HistoryPage from './components/HistoryPage';
import FAQsPage from './components/FAQsPage';
import SessionSummaryPage from './components/SessionSummaryPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';

const API_BASE = "http://localhost:8000";

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function App() {
  // ─── Auth state ───
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [authPage, setAuthPage] = useState('login'); // 'login' | 'register'

  // ─── Chat state ───
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const sessionIdRef = useRef('session_' + Date.now());
  const [sessionEnded, setSessionEnded] = useState(false);
  const [voiceContinueMessages, setVoiceContinueMessages] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Welcome message
  useEffect(() => {
    if (user) showWelcome();
  }, [user]);

  const showWelcome = () => {
    setIsTyping(true);
    const timer = setTimeout(() => {
      setMessages([{
        text: `Hello${user?.name ? `, ${user.name}` : ''}! I'm here to listen and support you.\nFeel free to share what's on your mind today. You can type your message or use the speak button to talk to me directly.`,
        sender: 'bot'
      }]);
      setIsTyping(false);
    }, 600);
    return () => clearTimeout(timer);
  };

  // ─── Auth handlers ───
  const handleLoginSuccess = (u) => {
    setUser(u);
    localStorage.setItem('user', JSON.stringify(u));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setMessages([]);
    setCurrentPage('home');
    sessionIdRef.current = 'session_' + Date.now();
    setSessionEnded(false);
  };

  // ─── Auth gate ───
  if (!user) {
    if (authPage === 'register') {
      return <RegisterPage onLoginSuccess={handleLoginSuccess} onGoLogin={() => setAuthPage('login')} />;
    }
    return <LoginPage onLoginSuccess={handleLoginSuccess} onGoRegister={() => setAuthPage('register')} />;
  }

  // ─── New chat ───
  const handleNewChat = () => {
    sessionIdRef.current = 'session_' + Date.now();
    setMessages([]);
    setSessionEnded(false);
    setCurrentPage('home');
    showWelcome();
  };

  // ─── Continue from history ───
  const handleContinueConversation = async (sid, convType = 'chat') => {
    sessionIdRef.current = sid;
    setSessionEnded(false);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${sid}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load conversation');
      const data = await res.json();
      if (convType === 'voice') {
        // Load into voice page format
        const voiceMsgs = data.messages.map(m => ({ text: m.content, isUser: m.role === 'user' }));
        setVoiceContinueMessages(voiceMsgs);
        setCurrentPage('voice');
      } else {
        setMessages(data.messages.map(m => ({ text: m.content, sender: m.role === 'user' ? 'user' : 'bot' })));
        setCurrentPage('home');
      }
    } catch (e) {
      console.error('Continue conversation error:', e);
      showWelcome();
      setCurrentPage('home');
    }
  };

  const formatLabel = (str) => str.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // ─── Pipeline chat ───
  const analyzeText = async (text) => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    try {
      // Step 1: Full pipeline chat (handles analysis + response + saves to DB)
      const chatRes = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ message: text, session_id: sessionIdRef.current })
      });
      if (!chatRes.ok) throw new Error(`Chat error: ${chatRes.status}`);
      const chatData = await chatRes.json();

      setIsAnalyzing(false);
      setIsTyping(false);

      const emotionTag = chatData.emotion ? `🎭 ${formatLabel(chatData.emotion)} (${Math.round((chatData.emotion_score || 0) * 100)}%)` : '';
      const categoryTag = chatData.category ? `🧠 ${formatLabel(chatData.category)} (${Math.round((chatData.category_score || 0) * 100)}%)` : '';
      const tags = [emotionTag, categoryTag].filter(Boolean).join('  ·  ');

      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          text: chatData.response,
          sender: 'bot',
          tags: chatData.show_analysis ? tags : null
        };
        return newMessages;
      });

    } catch (e) {
      console.error('Pipeline error:', e);
      setIsAnalyzing(false);
      setIsTyping(false);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          text: "I'm having trouble responding right now. But I'm still here to listen.",
          sender: 'bot'
        };
        return newMessages;
      });
    }
  };

  const handleEndSession = async () => {
    if (messages.length <= 1) {
      setMessages(prev => [...prev, { text: "No conversation data to summarize yet. Try chatting first!", sender: 'bot' }]);
      return;
    }
    // Navigate to summary page for the current session
    setCurrentPage('summary');
    // Start a fresh session so going back to chat is a new conversation
    sessionIdRef.current = 'session_' + Date.now();
    setMessages([]);
    setSessionEnded(false);
    showWelcome();
  };

  const sendMessage = () => {
    if (!message.trim() || sessionEnded) return;
    const userMessage = message.trim();
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setMessage('');
    setMessages(prev => [...prev, { text: "Analyzing your message...", sender: 'bot' }]);
    setIsTyping(true);
    analyzeText(userMessage);
  };

  // ─── Navigation ───
  const handleHomeClick        = () => setCurrentPage('home');
  const handleVoiceClick = () => {
    // Always start a new session for Voice
    sessionIdRef.current = 'session_' + Date.now();
    setVoiceContinueMessages(null);
    setCurrentPage('voice');
  };
  const handleMentalStateClick = () => setCurrentPage('mental-state');
  const handleHistoryClick     = () => setCurrentPage('history');
  const handleFAQsClick        = () => setCurrentPage('faqs');
  const handleSummaryClick     = () => setCurrentPage('summary');

  const navProps = {
    onHomeClick: handleHomeClick,
    onMentalStateClick: handleMentalStateClick,
    onHistoryClick: handleHistoryClick,
    onFAQsClick: handleFAQsClick,
    onSummaryClick: handleSummaryClick,
    user, onLogout: handleLogout, onNewChat: handleNewChat,
  };

  if (currentPage === 'voice') {
    return <VoicePage onBack={handleHomeClick} {...navProps} currentSessionId={sessionIdRef.current} initialMessages={voiceContinueMessages} onMessagesLoaded={() => setVoiceContinueMessages(null)} />;
  }
  if (currentPage === 'mental-state') {
    return <MentalStatePage onBack={handleHomeClick} {...navProps} currentSessionId={sessionIdRef.current} />;
  }
  if (currentPage === 'history') {
    return <HistoryPage onBack={handleHomeClick} {...navProps} onContinueConversation={handleContinueConversation} />;
  }
  if (currentPage === 'summary') {
    return <SessionSummaryPage onBack={handleHomeClick} {...navProps} />;
  }
  if (currentPage === 'faqs') {
    return <FAQsPage onBack={handleHomeClick} {...navProps} />;
  }

  // Home (Chat) Page
  return (
    <div className="flex h-screen bg-[#0a0515] text-white overflow-hidden">
      <Sidebar {...navProps} currentPage={currentPage} />

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#0a0515] via-[#140a2e] to-[#0a0515]">
        {/* Stars */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(80)].map((_, i) => (
            <div key={i} className="absolute bg-white rounded-full opacity-30 animate-pulse"
              style={{ width: `${Math.random()*2+1}px`, height: `${Math.random()*2+1}px`,
                top: `${Math.random()*100}%`, left: `${Math.random()*100}%`,
                animationDuration: `${Math.random()*3+2}s` }} />
          ))}
        </div>

        {/* End Session */}
        {!sessionEnded && messages.length > 1 && (
          <div className="relative z-20 flex justify-end p-4 pb-0 shrink-0">
            <button onClick={handleEndSession}
              className="px-4 py-2 rounded-full bg-purple-600/30 border border-purple-500/30 text-purple-200 text-sm hover:bg-purple-600/50 transition-all">
              End Session
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8 space-y-3 relative z-10">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`inline-block px-4 py-2 rounded-2xl backdrop-blur-md shadow-md break-words transition-transform duration-500 transform whitespace-pre-line
                ${msg.sender === 'user'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                  : 'bg-[#1a1035]/60 border border-purple-500/20 text-purple-200 animate-slideUp'}`}
                style={{ maxWidth: '70%' }}>
                {msg.text}
                {msg.tags && (
                  <div className="mt-2 pt-2 border-t border-purple-500/20 text-xs text-purple-400/70">{msg.tags}</div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="inline-flex items-center px-4 py-2 rounded-2xl backdrop-blur-md shadow-md bg-[#1a1035]/60 border border-purple-500/20 animate-fadeIn" style={{ maxWidth: '40%' }}>
                <span className="text-purple-300 mr-2">Bot is typing</span>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce delay-200"></span>
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce delay-400"></span>
                </div>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="inline-flex items-center px-4 py-2 rounded-2xl backdrop-blur-md shadow-md bg-[#1a1035]/60 border border-purple-500/20 animate-fadeIn" style={{ maxWidth: '40%' }}>
                <span className="text-purple-300 mr-2">Analyzing emotions</span>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce delay-200"></span>
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-400"></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="relative z-20">
          <ChatInputBar message={message} setMessage={setMessage} sendMessage={sendMessage}
            onVoiceClick={handleVoiceClick} onNewChat={handleNewChat} />
        </div>
      </div>
    </div>
  );
}

export default App;