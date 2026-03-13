import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInputBar from './components/ChatInputBar';
import VoicePage from './components/VoicePage';
import MentalStatePage from './components/MentalStatePage';
import HistoryPage from './components/HistoryPage';
import FAQsPage from './components/FAQsPage';
import SentimentGraph from './components/SentimentGraph';
import SessionSummary from './components/SessionSummary';

const API_BASE = "http://localhost:8000";

function App() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [sessionId] = useState(() => 'session_' + Date.now());
  const [sentimentData, setSentimentData] = useState([]);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Initial bot welcome message on page load
  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(() => {
      setMessages([
        {
          text: `Hello! I'm here to listen and support you.\nFeel free to share what's on your mind today. You can type your message or use the speak button to talk to me directly.`,
          sender: 'bot'
        }
      ]);
      setIsTyping(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Format label for display
  const formatLabel = (str) => {
    return str
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Analyze text with API and get AI counselor response
  const analyzeText = async (text) => {
    if (!text.trim()) return;

    setIsAnalyzing(true);

    try {
      // Step 1: Analyze emotion + mental health (existing endpoint)
      const analysisRes = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!analysisRes.ok) throw new Error(`Analysis error: ${analysisRes.status}`);
      const analysisData = await analysisRes.json();

      const mentalLabel = analysisData.mental_state?.label || 'Unknown';
      const mentalConf  = analysisData.mental_state?.confidence || 0;
      const emotionLabel = analysisData.emotion?.label || null;
      const emotionConf  = analysisData.emotion?.confidence || 0;
      const isHighRisk   = analysisData.high_risk || false;

      const storedData = {
        timestamp: new Date().toISOString(),
        userText: text,
        highRisk: isHighRisk,
        emotion: emotionLabel ? {
          label     : formatLabel(emotionLabel),
          confidence: (emotionConf * 100).toFixed(1),
          rawLabel  : emotionLabel,
          rawScore  : emotionConf
        } : null,
        mentalHealth: {
          label     : formatLabel(mentalLabel),
          confidence: (mentalConf * 100).toFixed(1),
          rawLabel  : mentalLabel,
          rawScore  : mentalConf,
          riskLevel : analysisData.mental_state?.risk_level || 'Low',
          allScores : analysisData.mental_state?.all_scores || {}
        }
      };

      localStorage.setItem('latestAnalysis', JSON.stringify(storedData));
      const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
      history.push(storedData);
      if (history.length > 10) history.shift();
      localStorage.setItem('analysisHistory', JSON.stringify(history));

      setIsAnalyzing(false);
      setIsTyping(true);

      // Step 2: Get AI counselor response (full pipeline)
      // Pass pre-computed analysis to avoid running detection models twice
      const chatRes = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          emotion: analysisData.emotion?.label || null,
          emotion_score: analysisData.emotion?.confidence || 0,
          category: analysisData.mental_state?.label || null,
          category_score: analysisData.mental_state?.confidence || 0
        })
      });

      if (!chatRes.ok) throw new Error(`Chat error: ${chatRes.status}`);
      const chatData = await chatRes.json();

      setIsTyping(false);

      // Show AI response with analysis tags
      const emotionTag = chatData.emotion ? `🎭 ${formatLabel(chatData.emotion)} (${Math.round((chatData.emotion_score || 0) * 100)}%)` : '';
      const categoryTag = chatData.category ? `🧠 ${formatLabel(chatData.category)} (${Math.round((chatData.category_score || 0) * 100)}%)` : '';
      const tags = [emotionTag, categoryTag].filter(Boolean).join('  ·  ');

      setMessages(prev => {
        const newMessages = [...prev];
        // Replace "Analyzing..." message with the actual response
        newMessages[newMessages.length - 1] = {
          text: chatData.response,
          sender: 'bot',
          tags: chatData.show_analysis ? tags : null
        };
        return newMessages;
      });

      // Update sentiment data
      fetchSentiment();

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

  // Fetch sentiment trend data
  const fetchSentiment = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sentiment?session_id=${sessionId}`);
      const data = await res.json();
      setSentimentData(data.scores || []);
    } catch (e) {
      console.error('Sentiment fetch error:', e);
    }
  };

  // End session and get summary
  const handleEndSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      if (data.message_count > 0) {
        setSessionSummary(data);
        setSessionEnded(true);
      } else {
        setMessages(prev => [...prev, {
          text: "No conversation data to summarize yet. Try chatting first!",
          sender: 'bot'
        }]);
      }
    } catch (e) {
      console.error('Summary error:', e);
    }
  };

  // Send message
  const sendMessage = () => {
    if (!message.trim() || sessionEnded) return;

    const userMessage = message.trim();
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setMessage('');

    // Show analyzing placeholder
    setMessages(prev => [...prev, { text: "Analyzing your message...", sender: 'bot' }]);
    analyzeText(userMessage);
  };

  // Navigation handlers
  const handleHomeClick        = () => setCurrentPage('home');
  const handleVoiceClick       = () => setCurrentPage('voice');
  const handleMentalStateClick = () => setCurrentPage('mental-state');
  const handleHistoryClick     = () => setCurrentPage('history');
  const handleFAQsClick        = () => setCurrentPage('faqs');

  // Render pages
  if (currentPage === 'voice') {
    return (
      <VoicePage
        onBack={handleHomeClick}
        onHomeClick={handleHomeClick}
        onMentalStateClick={handleMentalStateClick}
        onHistoryClick={handleHistoryClick}
        onFAQsClick={handleFAQsClick}
      />
    );
  }

  if (currentPage === 'mental-state') {
    return (
      <MentalStatePage
        onBack={handleHomeClick}
        onHomeClick={handleHomeClick}
        onMentalStateClick={handleMentalStateClick}
        onHistoryClick={handleHistoryClick}
        onFAQsClick={handleFAQsClick}
      />
    );
  }

  if (currentPage === 'history') {
    return (
      <HistoryPage
        onBack={handleHomeClick}
        onHomeClick={handleHomeClick}
        onMentalStateClick={handleMentalStateClick}
        onHistoryClick={handleHistoryClick}
        onFAQsClick={handleFAQsClick}
      />
    );
  }

  if (currentPage === 'faqs') {
    return (
      <FAQsPage
        onBack={handleHomeClick}
        onHomeClick={handleHomeClick}
        onMentalStateClick={handleMentalStateClick}
        onHistoryClick={handleHistoryClick}
        onFAQsClick={handleFAQsClick}
      />
    );
  }

  // Home Page
  return (
    <div className="flex h-screen bg-[#0a0515] text-white overflow-hidden">

      {/* Sidebar */}
      <Sidebar
        onHomeClick={handleHomeClick}
        onMentalStateClick={handleMentalStateClick}
        onHistoryClick={handleHistoryClick}
        onFAQsClick={handleFAQsClick}
        currentPage={currentPage}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#0a0515] via-[#140a2e] to-[#0a0515]">

        {/* Animated Stars */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(80)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-white rounded-full opacity-30 animate-pulse"
              style={{
                width: `${Math.random() * 2 + 1}px`,
                height: `${Math.random() * 2 + 1}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDuration: `${Math.random() * 3 + 2}s`
              }}
            />
          ))}
        </div>

        {/* End Session Button */}
        {!sessionEnded && messages.length > 1 && (
          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={handleEndSession}
              className="px-4 py-2 rounded-full bg-purple-600/30 border border-purple-500/30 text-purple-200 text-sm hover:bg-purple-600/50 transition-all"
            >
              End Session
            </button>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-3 relative z-10">

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`inline-block px-4 py-2 rounded-2xl backdrop-blur-md shadow-md break-words transition-transform duration-500 transform whitespace-pre-line
                  ${msg.sender === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                    : 'bg-[#1a1035]/60 border border-purple-500/20 text-purple-200 animate-slideUp'
                  }`}
                style={{ maxWidth: '70%' }}
              >
                {msg.text}
                {msg.tags && (
                  <div className="mt-2 pt-2 border-t border-purple-500/20 text-xs text-purple-400/70">
                    {msg.tags}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Session Summary Card */}
          {sessionSummary && (
            <div className="flex justify-center">
              <SessionSummary summary={sessionSummary} onNewSession={() => window.location.reload()} />
            </div>
          )}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div
                className="inline-flex items-center px-4 py-2 rounded-2xl backdrop-blur-md shadow-md bg-[#1a1035]/60 border border-purple-500/20 animate-fadeIn break-words"
                style={{ maxWidth: '40%' }}
              >
                <span className="text-purple-300 mr-2">Bot is typing</span>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce delay-200"></span>
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce delay-400"></span>
                </div>
              </div>
            </div>
          )}

          {/* Analyzing Indicator */}
          {isAnalyzing && (
            <div className="flex justify-start">
              <div
                className="inline-flex items-center px-4 py-2 rounded-2xl backdrop-blur-md shadow-md bg-[#1a1035]/60 border border-purple-500/20 animate-fadeIn"
                style={{ maxWidth: '40%' }}
              >
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

        {/* Chat Input Bar */}
        <div className="relative z-20">
          <ChatInputBar
            message={message}
            setMessage={setMessage}
            sendMessage={sendMessage}
            onVoiceClick={handleVoiceClick}
          />
        </div>

      </div>

      {/* Right Panel: Sentiment Graph */}
      {sentimentData.length > 0 && (
        <div className="w-80 bg-[#0d0820] border-l border-purple-500/20 p-4 overflow-y-auto">
          <SentimentGraph data={sentimentData} />
        </div>
      )}

    </div>
  );
}

export default App;