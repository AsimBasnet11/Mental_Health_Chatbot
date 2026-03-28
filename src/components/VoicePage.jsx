import React, { useState, useEffect, useRef } from 'react';
import { FaMicrophone, FaRedo, FaBrain, FaWifi, FaPlug, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import { API_BASE, ASR_WS_URL, ENDPOINTS } from '../config/api';
import Sidebar from './Sidebar';

const DEFAULT_WS_URL = localStorage.getItem('asr_ws_url') || ASR_WS_URL;
// API_BASE now imported from config/api.js

function getToken() { return localStorage.getItem('token'); }
function authHeaders() { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }

const VoicePage = ({ onBack, onHomeClick, onMentalStateClick, onHistoryClick, onFAQsClick, onSummaryClick, user, onLogout, onNewChat, currentSessionId, initialMessages, onMessagesLoaded }) => {
  const [isListening, setIsListening] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [dotCount, setDotCount] = useState(1);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const ttsEnabledRef = useRef(true); // ref so speakResponse always reads latest value
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const messagesEndRef = useRef(null);
  const manualDisconnectRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const MAX_RECONNECT_ATTEMPTS = 6;
  
  // Text accumulation
  const accumulatedTextRef = useRef('');
  const currentPartialRef = useRef('');
  const isWaitingForFlushRef = useRef(false);
  const hasProcessedRef = useRef(false);
  const lastFinalTimestampRef = useRef(0);
  const flushTimeoutRef = useRef(null);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isListening]);

  // Animate "Listening..." dots
  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => setDotCount(prev => (prev % 3) + 1), 500);
    return () => clearInterval(interval);
  }, [isListening]);

  // Initial bot message or continue from history
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      if (onMessagesLoaded) onMessagesLoaded();
    } else {
      setMessages([{
        text: "Hello! I'm here to listen and support you.\nFeel free to share what's on your mind today.",
        isUser: false
      }]);
    }
  }, []);

  // Auto-connect on mount if a WS URL is available. Use robust reconnect/backoff
  // when the socket closes unexpectedly. Manual disconnects (via button)
  // set `manualDisconnectRef` so we don't auto-reconnect.
  useEffect(() => {
    manualDisconnectRef.current = false;
    if (wsUrl && wsUrl.trim()) {
      connectToServer();
    }
    return () => {
      manualDisconnectRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      disconnectFromServer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Request microphone permission
  const requestPermission = async () => {
    if (permissionGranted) return true;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissionGranted(true);
      console.log('[Mic] Permission granted');
      return true;
    } catch (err) {
      console.error('[Mic] Permission denied:', err);
      alert('Microphone permission is required!');
      return false;
    }
  };

  // Format label for display
  const formatLabel = (str) => {
    return str
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Text-to-Speech — uses Edge TTS neural voices via backend
  const ttsAudioRef = useRef(null);

  const speakResponse = async (text) => {
    // Always check ref — never stale even inside async callbacks
    if (!ttsEnabledRef.current || !text) return;

    // Stop any current playback
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    window.speechSynthesis.cancel();

    try {
      setIsSpeaking(true);
      const res = await fetch(`${API_BASE}${ENDPOINTS.TTS}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // en-US-AriaNeural — warm, natural, human-like female voice
        body: JSON.stringify({ text, voice: "en-US-AriaNeural" })
      });

      // Check again after async — user may have toggled off while fetching
      if (!ttsEnabledRef.current) {
        setIsSpeaking(false);
        return;
      }

      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      ttsAudioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        ttsAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        ttsAudioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      console.error('[TTS] Backend TTS failed, falling back to browser:', err);
      setIsSpeaking(false);
      // Check again before browser fallback
      if (!ttsEnabledRef.current) return;
      // Fallback to browser TTS — most human-like female voice available
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.88;
      utterance.pitch = 1.1;
      utterance.volume = 1.0;
      // Try to pick a female voice
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v =>
        v.name.includes('Female') ||
        v.name.includes('Samantha') ||
        v.name.includes('Karen') ||
        v.name.includes('Moira') ||
        v.name.includes('Aria') ||
        v.name.includes('Jenny') ||
        (v.name.includes('Google') && v.name.includes('US') && v.lang === 'en-US')
      );
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Analyze text with full pipeline (same as chat page)
  const analyzeText = async (text) => {
    if (!text.trim()) {
      console.log('[Voice] No text to analyze');
      return;
    }

    console.log('[Voice] Starting pipeline:', text.length, 'chars');
    setIsAnalyzing(true);
    setIsTyping(true);
    
    // Show placeholder bot message while processing
    setMessages(prev => [...prev, { 
      text: "Analyzing your message...", 
      isUser: false 
    }]);
    
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message: text, session_id: currentSessionId, source: "voice" })
      });
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      
      const chatData = await res.json();
      console.log('[Voice] Pipeline complete:', chatData.emotion, '/', chatData.category);

      setIsAnalyzing(false);
      setIsTyping(false);

      // Build analysis tags (same format as chat page)
      const emotionTag = chatData.emotion ? `🎭 ${formatLabel(chatData.emotion)} (${Math.round((chatData.emotion_score || 0) * 100)}%)` : '';
      const categoryTag = chatData.category ? `🧠 ${formatLabel(chatData.category)} (${Math.round((chatData.category_score || 0) * 100)}%)` : '';
      const tags = [emotionTag, categoryTag].filter(Boolean).join('  ·  ');

      // Replace placeholder with actual AI response
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          text: chatData.response,
          isUser: false,
          tags: chatData.show_analysis ? tags : null
        };
        return newMessages;
      });

      // Speak the response aloud
      speakResponse(chatData.response);
      
    } catch (e) {
      console.error('[Voice] Pipeline failed:', e);
      setIsAnalyzing(false);
      setIsTyping(false);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          text: "I'm having trouble responding right now. But I'm still here to listen.",
          isUser: false
        };
        return newMessages;
      });
    }
  };

  // Helper: convert Float32 -> PCM16
  const floatTo16BitPCM = (float32Array) => {
    const len = float32Array.length;
    const buffer = new ArrayBuffer(len * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < len; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      const val = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(i * 2, val, true);
    }
    return buffer;
  };

  // Process and send the final message
  const processFinalMessage = () => {
    // Prevent double processing
    if (hasProcessedRef.current) {
      console.log('[Voice] Already processed, skipping');
      return;
    }
    
    hasProcessedRef.current = true;
    console.log('[Voice] Processing final message...');
    
    // Cancel timeout if it exists
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
      console.log('[Voice] Cancelled timeout');
    }
    
    let finalText = '';
    
    // Priority 1: Accumulated text (best)
    if (accumulatedTextRef.current.trim()) {
      finalText = accumulatedTextRef.current.trim();
      console.log('[Voice] Using accumulated text:', finalText.length, 'chars');
    }
    // Priority 2: Current partial (fallback)
    else if (currentPartialRef.current.trim()) {
      finalText = currentPartialRef.current.trim();
      console.log('[Voice] Using partial as fallback:', finalText.length, 'chars');
    }
    // Priority 3: UI state (last resort)
    else if (partialTranscript.trim()) {
      finalText = partialTranscript.trim();
      console.log('[Voice] Using UI partial as fallback:', finalText.length, 'chars');
    }
    
    console.log('[Voice] Final text length:', finalText.length, 'characters');
    
    if (finalText) {
      console.log('[Voice] Sending user message');
      
      setMessages(prev => [...prev, { 
        text: finalText, 
        isUser: true 
      }]);
      
      analyzeText(finalText);
    } else {
      console.log('[Voice] No text captured');
      alert('No speech detected. Please try speaking again.');
    }
    
    // Reset buffers for next recording
    accumulatedTextRef.current = '';
    currentPartialRef.current = '';
    setPartialTranscript('');
    isWaitingForFlushRef.current = false;
    setIsStopping(false);
    
    // Keep WebSocket open for next recording
    console.log('[Voice] Ready for next recording');
  };

  // Connect to ASR WebSocket
  const connectToServer = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    if (!wsUrl.trim()) {
      alert('Please enter the ASR WebSocket URL first!\nGet it from the Colab notebook (Cell 6).');
      return;
    }

    // Ensure URL ends with /ws/asr
    let url = wsUrl.trim();
    if (!url.endsWith('/ws/asr')) {
      url = url.replace(/\/+$/, '') + '/ws/asr';
    }

    // Save for next session
    localStorage.setItem('asr_ws_url', wsUrl.trim());

    console.log('[WS] Connecting to server...');
    setConnectionStatus('connecting');
    manualDisconnectRef.current = false;
    
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnectionStatus('connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "partial") {
          const partialText = (data.text || '').trim();
          if (partialText) {
            console.log('[PARTIAL]:', partialText.substring(0, 50));
            setPartialTranscript(partialText);
            currentPartialRef.current = partialText;
          }
        } 
        else if (data.type === "final") {
          const finalText = (data.text || '').trim();
          if (finalText) {
            console.log('[FINAL]:', finalText);
            
            // ACCUMULATE all finals
            if (accumulatedTextRef.current) {
              accumulatedTextRef.current += ' ' + finalText;
            } else {
              accumulatedTextRef.current = finalText;
            }

            console.log('[ACCUMULATED]:', accumulatedTextRef.current.length, 'chars');
            // Mark when a final chunk arrived
            lastFinalTimestampRef.current = Date.now();

            // Clear partial since we have final
            setPartialTranscript('');
            currentPartialRef.current = '';

            // If we're waiting for flush and got final, process it shortly
            if (isWaitingForFlushRef.current && !hasProcessedRef.current) {
              console.log('[Voice] Got final after flush, processing shortly...');
              setTimeout(() => {
                processFinalMessage();
              }, 100);
            }
          }
        }
        else if (data.type === "info") {
          const msg = data.msg || '';
          if (msg) {
            console.log('[ASR Info]:', msg);
          }
        }
      } catch (e) {
        console.log('Non-JSON message:', event.data);
      }
    };
    
    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
      setConnectionStatus('error');
    };
    
    ws.onclose = (ev) => {
      console.log('[WS] Closed', ev);
      setConnectionStatus('disconnected');
      setIsConnected(false);
      wsRef.current = null;
      // If user didn't manually disconnect, attempt reconnect with backoff
      if (!manualDisconnectRef.current) {
        const attempts = reconnectAttemptsRef.current || 0;
        if (attempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
          reconnectAttemptsRef.current = attempts + 1;
          console.log('[WS] Scheduling reconnect in', delay, 'ms (attempt', reconnectAttemptsRef.current + ')');
          reconnectTimeoutRef.current = setTimeout(() => {
            connectToServer();
          }, delay);
        } else {
          console.warn('[WS] Max reconnect attempts reached; not reconnecting automatically');
        }
      }
    };

    wsRef.current = ws;
  };

  // Disconnect from server
  const disconnectFromServer = () => {
    manualDisconnectRef.current = true;
    if (isListening) {
      stopRecording();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      console.log('[WS] Disconnecting...');
      try {
        wsRef.current.send(JSON.stringify({ cmd: "close" }));
      } catch (e) {
        console.error('Error sending close:', e);
      }
      try { wsRef.current.close(); } catch (e) { /* ignore */ }
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    setIsConnected(false);
  };

  // Toggle server connection
  const handleServerToggle = () => {
    if (isConnected) {
      disconnectFromServer();
    } else {
      connectToServer();
    }
  };

  // Start Recording
  const startRecording = async () => {
    if (!isConnected || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('Please connect to server first (click green connect button)!');
      console.log('[Voice] Cannot record: not connected');
      return;
    }

    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    // Reset ALL flags and buffers for new recording
    accumulatedTextRef.current = '';
    currentPartialRef.current = '';
    setPartialTranscript('');
    isWaitingForFlushRef.current = false;
    hasProcessedRef.current = false;
    setIsStopping(false);
    
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    
    // Cancel any ongoing TTS so mic doesn't pick up bot voice
    window.speechSynthesis.cancel();
    if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; }
    setIsSpeaking(false);
    
    console.log('[Voice] Starting new recording');

    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ 
        sampleRate: 16000 
      });
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      mediaStreamRef.current = mediaStream;

      const source = audioContextRef.current.createMediaStreamSource(mediaStream);
      const bufferSize = 2048;
      const processor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

      processor.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        wsRef.current.send(floatTo16BitPCM(input));
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processorRef.current = processor;
      setIsListening(true);
      console.log('[Voice] Recording started');
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };

  // Stop Recording - WITH FLUSH but DON'T close server!
  const stopRecording = () => {
    console.log('[Voice] Stopping recording...');
    setIsStopping(true);
    
    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setIsListening(false);

    // SEND FLUSH COMMAND
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[Voice] Sending flush...');
      isWaitingForFlushRef.current = true;
      
      try {
        wsRef.current.send(JSON.stringify({ cmd: "flush" }));
        console.log('[Voice] Flush sent');
      } catch (e) {
        console.error('[Voice] Flush failed:', e);
      }
      
      // Set timeout - only process if we haven't already. Slightly extended
      // to reduce races; if a final arrived very recently, wait a bit longer
      flushTimeoutRef.current = setTimeout(() => {
        console.log('[Voice] Flush timeout (4s)');

        if (!hasProcessedRef.current) {
          const now = Date.now();
          const sinceLastFinal = now - (lastFinalTimestampRef.current || 0);
          if (sinceLastFinal < 800) {
            console.log('[Voice] Recent final arrived', sinceLastFinal, 'ms ago — delaying processing');
            setTimeout(() => {
              if (!hasProcessedRef.current) processFinalMessage();
            }, 500);
          } else {
            console.log('[Voice] No recent final, processing available text');
            processFinalMessage();
          }
        } else {
          console.log('[Voice] Already processed, timeout skipped');
        }
      }, 4000);
    } else {
      // No WebSocket connection, process immediately
      console.log('[Voice] No WebSocket, processing immediately');
      processFinalMessage();
    }
  };

  // Handle Voice Button Click
  const handleVoiceToggle = async () => {
    if (!isListening && !isStopping) {
      await startRecording();
    } else if (isListening && !isStopping) {
      stopRecording();
    }
  };

  // Refresh/Clear Chat
  const handleRefresh = () => {
    setMessages([{
      text: "Hello! I'm here to listen and support you.\nFeel free to share what's on your mind today.",
      isUser: false
    }]);
    setPartialTranscript('');
    accumulatedTextRef.current = '';
    currentPartialRef.current = '';
    isWaitingForFlushRef.current = false;
    hasProcessedRef.current = false;
    setIsStopping(false);
    setSessionEnded(false);
    
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    console.log('[Voice] Chat refreshed');
    
    if (isListening) {
      stopRecording();
    }
  };

  // End Session — same as chat page
  const handleEndSession = async () => {
    if (messages.length <= 1) {
      setMessages(prev => [...prev, { text: "No conversation data to summarize yet. Try speaking first!", isUser: false }]);
      return;
    }
    setSessionEnded(true);
    onSummaryClick();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; }
      if (isListening) {
        stopRecording();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex h-screen bg-[#120820] text-white overflow-hidden">
      
      <Sidebar 
        onHomeClick={onHomeClick}
        onMentalStateClick={onMentalStateClick}
        onHistoryClick={onHistoryClick}
        onFAQsClick={onFAQsClick}
        onSummaryClick={onSummaryClick}
        currentPage="voice"
        user={user} onLogout={onLogout} onNewChat={onNewChat}
      />

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#120820] via-[#1e1240] to-[#120820]">

        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(80)].map((_, i) => (
            <div 
              key={i} 
              className="absolute bg-white rounded-full opacity-40 animate-pulse"
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

        {/* Top bar: Connect + TTS + End Session */}
        <div className="relative z-20 flex items-center justify-between p-4 pb-0 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleServerToggle}
              disabled={isListening}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all shadow-xl
                ${isConnected 
                  ? 'bg-green-600/80 hover:bg-green-700/80 border-2 border-green-400' 
                  : 'bg-gray-600/80 hover:bg-gray-700/80 border-2 border-gray-400'
                }
                ${isListening ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                backdrop-blur-md`}
            >
              {isConnected ? (
                <>
                  <FaWifi className="text-white animate-pulse" />
                  <span className="text-sm font-bold text-white">Connected</span>
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                </>
              ) : (
                <>
                  <FaPlug className="text-white" />
                  <span className="text-sm font-bold text-white">Connect Server</span>
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                </>
              )}
            </button>
            {isListening && (
              <span className="text-xs text-yellow-400">Stop recording first</span>
            )}

            {/* TTS Toggle */}
            <button
              onClick={() => { setTtsEnabled(prev => { const next = !prev; ttsEnabledRef.current = next; if (!next) { window.speechSynthesis.cancel(); if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; } } return next; }); setIsSpeaking(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all backdrop-blur-md border
                ${ttsEnabled
                  ? 'bg-purple-600/40 border-purple-400/40 text-purple-100'
                  : 'bg-gray-600/40 border-gray-500/30 text-gray-400'}`}
              title={ttsEnabled ? 'Mute voice responses' : 'Unmute voice responses'}
            >
              {ttsEnabled ? <FaVolumeUp className="text-sm" /> : <FaVolumeMute className="text-sm" />}
              <span className="text-xs font-medium">{ttsEnabled ? 'TTS On' : 'TTS Off'}</span>
            </button>
          </div>

          {/* End Session */}
          {!sessionEnded && messages.length > 1 && (
            <button onClick={handleEndSession}
              className="px-4 py-2 rounded-full bg-purple-600/30 border border-purple-500/30 text-purple-100 text-sm hover:bg-purple-600/50 transition-all">
              End Session
            </button>
          )}
        </div>

        {/* Messages — purple scrollbar to match dark background */}
        <div
          className="flex-1 overflow-y-auto p-8 space-y-3 relative z-10 scrollbar-thin scrollbar-thumb-purple-700/40 scrollbar-track-transparent"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(109,40,217,0.4) transparent',
          }}
        >
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`inline-block px-4 py-2 rounded-2xl backdrop-blur-md shadow-md break-words transition-transform duration-500 transform whitespace-pre-line text-justify
                  ${msg.isUser
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                    : 'bg-[#231550]/75 border border-purple-500/20 text-purple-100 animate-slideUp'}`}
                style={{ maxWidth: '70%' }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {isListening && (
            <div className="flex justify-end">
              <div 
                className="inline-flex items-center px-4 py-2 rounded-2xl backdrop-blur-md shadow-md
                  bg-purple-600/30 border border-purple-400 text-white animate-fadeIn break-words"
                style={{ maxWidth: '60%' }}
              >
                Listening{'.'.repeat(dotCount)}
                {partialTranscript && `: ${partialTranscript}`}
              </div>
            </div>
          )}

          {isStopping && (
            <div className="flex justify-end">
              <div 
                className="inline-flex items-center px-4 py-2 rounded-2xl backdrop-blur-md shadow-md
                  bg-yellow-600/30 border border-yellow-400 text-white animate-pulse"
                style={{ maxWidth: '60%' }}
              >
                Processing your speech...
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="inline-flex items-center px-4 py-2 rounded-2xl backdrop-blur-md shadow-md bg-[#231550]/75 border border-purple-500/20 animate-fadeIn" style={{ maxWidth: '40%' }}>
                <span className="text-purple-300 mr-2">Analyzing emotions</span>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce delay-200"></span>
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-400"></span>
                </div>
              </div>
            </div>
          )}

          {isTyping && !isAnalyzing && (
            <div className="flex justify-start">
              <div className="inline-flex items-center px-4 py-2 rounded-2xl backdrop-blur-md shadow-md bg-[#231550]/75 border border-purple-500/20 animate-fadeIn" style={{ maxWidth: '40%' }}>
                <span className="text-purple-300 mr-2">Bot is typing</span>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce delay-200"></span>
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce delay-400"></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="flex flex-col items-center relative z-20 p-4">
          <div className="relative w-full flex items-center justify-center">
            
            <button 
              onClick={onBack}
              className="absolute left-4 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-white rounded-full shadow-md shadow-purple-400/50 transition-all"
            >
              ← Back
            </button>

            <button 
              onClick={handleVoiceToggle}
              disabled={!isConnected || isStopping}
              className={`w-16 h-16 rounded-full flex items-center justify-center
                ${!isConnected || isStopping
                  ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                  : isListening 
                    ? 'bg-red-600 shadow-[0_0_20px_rgba(255,0,0,0.7)] animate-pulse cursor-pointer'
                    : 'bg-purple-600/30 shadow-[0_0_10px_rgba(138,43,226,0.4)] hover:scale-110 cursor-pointer'
                }
                transition-all animate-float`}
              title={!isConnected ? "Connect to server first!" : isStopping ? "Processing..." : ""}
            >
              <FaMicrophone className="text-white text-xl" />
            </button>

            <button 
              onClick={handleRefresh}
              className="absolute right-4 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-white rounded-full shadow-md shadow-purple-400/50 transition-all flex items-center gap-2"
            >
              <FaRedo className="text-sm" />
              Refresh
            </button>
          </div>

          <div className="mt-4 text-xs text-purple-300/60 text-center px-4">
            {connectionStatus === 'connecting' && (
              <div className="text-yellow-400 mb-2 font-bold">Connecting to server...</div>
            )}
            {connectionStatus === 'disconnected' && (
              <div className="text-yellow-400 mb-2 font-bold">Click "Connect Server" to enable voice recording.</div>
            )}
            {connectionStatus === 'connected' && (
              <div className="text-green-400 mb-2">Server connected — you can record multiple times.</div>
            )}
            {connectionStatus === 'error' && (
              <div className="text-red-400 mb-2">Connection error — try reconnecting.</div>
            )}
            {isSpeaking && (
              <div className="text-purple-300 mb-1 animate-pulse">Speaking...</div>
            )}
            This is an AI assistant for emotional support. For crisis situations, please contact emergency services or a mental health professional.
          </div>
        </div>

      </div>
    </div>
  );
};

export default VoicePage;