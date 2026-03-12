import React, { useState, useEffect, useRef } from 'react';
import { FaMicrophone, FaRedo, FaBrain, FaWifi, FaPlug } from 'react-icons/fa';
import Sidebar from './Sidebar';

const DEFAULT_WS_URL = localStorage.getItem('asr_ws_url') || "";
const API_BASE = "http://localhost:8000";

const VoicePage = ({ onBack, onHomeClick, onMentalStateClick, onHistoryClick, onFAQsClick }) => {
  const [isListening, setIsListening] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [dotCount, setDotCount] = useState(1);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  
  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // Text accumulation
  const accumulatedTextRef = useRef('');
  const currentPartialRef = useRef('');
  const isWaitingForFlushRef = useRef(false);
  const hasProcessedRef = useRef(false);
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

  // Initial bot message
  useEffect(() => {
    setMessages([{
      text: "Hello! I'm here to listen and support you.\nFeel free to share what's on your mind today.",
      isUser: false
    }]);
  }, []);

  // Request microphone permission
  const requestPermission = async () => {
    if (permissionGranted) return true;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissionGranted(true);
      console.log('✅ Microphone permission granted');
      return true;
    } catch (err) {
      console.error('Microphone permission denied:', err);
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

  // Analyze text with API
  const analyzeText = async (text) => {
    if (!text.trim()) {
      console.log('⚠️ No text to analyze');
      return;
    }

    console.log('🧠 Starting analysis:', text.length, 'chars');
    setIsAnalyzing(true);
    
    setMessages(prev => [...prev, { 
      text: "Voice received. Analyzing your message...", 
      isUser: false 
    }]);
    
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('✅ Analysis complete:', data.emotion?.label, '/', data.mental_state?.label);
      
      const analysisData = {
         timestamp: new Date().toISOString(),
          userText: text,
          emotion: {
            label: formatLabel(data.emotion?.label || 'unknown'),
            confidence: ((data.emotion?.confidence || 0) * 100).toFixed(1),
            rawLabel: data.emotion?.label || 'unknown',
            rawScore: data.emotion?.confidence || 0
          },
       mentalHealth: {
            label: formatLabel(data.mental_state?.label || 'unknown'),
            confidence: ((data.mental_state?.confidence || 0) * 100).toFixed(1),
            rawLabel: data.mental_state?.label || 'unknown',
            rawScore: data.mental_state?.confidence || 0
         }
      };;
      
      localStorage.setItem('latestAnalysis', JSON.stringify(analysisData));
      
      const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
      history.push(analysisData);
      if (history.length > 10) history.shift();
      localStorage.setItem('analysisHistory', JSON.stringify(history));
      
      setTimeout(() => {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            text: "Analysis complete! Click 'Mental State' in sidebar to see detailed results.",
            isUser: false
          };
          return newMessages;
        });
      }, 500);
      
    } catch (e) {
      console.error('❌ Analysis failed:', e);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          text: "I'm having trouble analyzing right now. But I'm still here to listen.",
          isUser: false
        };
        return newMessages;
      });
    } finally {
      setIsAnalyzing(false);
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
      console.log('⚠️ Already processed, skipping');
      return;
    }
    
    hasProcessedRef.current = true;
    console.log('📝 Processing final message...');
    
    // Cancel timeout if it exists
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
      console.log('✅ Cancelled timeout');
    }
    
    let finalText = '';
    
    // Priority 1: Accumulated text (best)
    if (accumulatedTextRef.current.trim()) {
      finalText = accumulatedTextRef.current.trim();
      console.log('✅ Using accumulated text:', finalText.length, 'chars');
    }
    // Priority 2: Current partial (fallback)
    else if (currentPartialRef.current.trim()) {
      finalText = currentPartialRef.current.trim();
      console.log('⚠️ Using partial as fallback:', finalText.length, 'chars');
    }
    // Priority 3: UI state (last resort)
    else if (partialTranscript.trim()) {
      finalText = partialTranscript.trim();
      console.log('⚠️ Using UI partial as fallback:', finalText.length, 'chars');
    }
    
    console.log('📊 Final text length:', finalText.length, 'characters');
    
    if (finalText) {
      console.log('✅ Sending user message');
      
      setMessages(prev => [...prev, { 
        text: finalText, 
        isUser: true 
      }]);
      
      analyzeText(finalText);
    } else {
      console.log('❌ NO TEXT CAPTURED!');
      alert('No speech detected. Please try speaking again.');
    }
    
    // Reset buffers for next recording
    accumulatedTextRef.current = '';
    currentPartialRef.current = '';
    setPartialTranscript('');
    isWaitingForFlushRef.current = false;
    setIsStopping(false);
    
    // ⭐ DON'T CLOSE WEBSOCKET - Keep it connected for next recording!
    console.log('✅ Ready for next recording (server still connected)');
  };

  // Connect to ASR WebSocket
  const connectToServer = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('ℹ️ Already connected');
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

    console.log('🔌 Connecting to server...');
    setConnectionStatus('connecting');
    
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setConnectionStatus('connected');
      setIsConnected(true);
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
            
            // Clear partial since we have final
            setPartialTranscript('');
            currentPartialRef.current = '';
            
            // If we're waiting for flush and got final, process it
            if (isWaitingForFlushRef.current && !hasProcessedRef.current) {
              console.log('✅ Got final after flush! Processing in 500ms...');
              setTimeout(() => {
                processFinalMessage();
                // ⭐ DON'T CLOSE - Server stays connected!
              }, 500);
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
    
    ws.onclose = () => {
      console.log('🔌 WebSocket closed');
      setConnectionStatus('disconnected');
      setIsConnected(false);
      wsRef.current = null;
    };

    wsRef.current = ws;
  };

  // Disconnect from server
  const disconnectFromServer = () => {
    if (isListening) {
      stopRecording();
    }
    
    if (wsRef.current) {
      console.log('🔌 Disconnecting from server...');
      try {
        wsRef.current.send(JSON.stringify({ cmd: "close" }));
      } catch (e) {
        console.error('Error sending close:', e);
      }
      wsRef.current.close();
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
      console.log('❌ Cannot record: Not connected to server');
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
    
    console.log('🎤 Starting new recording - all buffers reset');

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
      console.log('🎤 Recording started');
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };

  // Stop Recording - WITH FLUSH but DON'T close server!
  const stopRecording = () => {
    console.log('🛑 Stopping recording...');
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
      console.log('📤 Sending flush command...');
      isWaitingForFlushRef.current = true;
      
      try {
        wsRef.current.send(JSON.stringify({ cmd: "flush" }));
        console.log('✅ Flush command sent');
      } catch (e) {
        console.error('❌ Failed to send flush:', e);
      }
      
      // Set timeout - only process if we haven't already
      flushTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Flush timeout reached (3s)');
        
        if (!hasProcessedRef.current) {
          console.log('⚠️ No final received after flush, processing what we have...');
          processFinalMessage();
          // ⭐ DON'T CLOSE - Server stays connected for next recording!
        } else {
          console.log('✅ Already processed, timeout skipped');
        }
      }, 3000);
    } else {
      // No WebSocket connection, process immediately
      console.log('⚠️ No WebSocket, processing immediately');
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
    
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    
    console.log('🔄 Chat refreshed');
    
    if (isListening) {
      stopRecording();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
    <div className="flex h-screen bg-[#0a0515] text-white overflow-hidden">
      
      <Sidebar 
        onHomeClick={onHomeClick}
        onMentalStateClick={onMentalStateClick}
        onHistoryClick={onHistoryClick}
        onFAQsClick={onFAQsClick}
        currentPage="voice"
      />

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#0a0515] via-[#140a2e] to-[#0a0515]">

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

        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <input
            type="text"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            placeholder="wss://your-ngrok-url.ngrok-free.dev"
            disabled={isConnected || isListening}
            className="px-3 py-2 rounded-full text-sm bg-[#1a1035]/80 border border-purple-500/30 text-white placeholder-purple-300/40 backdrop-blur-md w-72 focus:outline-none focus:border-purple-400 disabled:opacity-50"
          />
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
            <div className="mt-1 text-xs text-yellow-400 text-center">
              Stop recording first
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-3 relative z-10 mt-20">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className="inline-block px-4 py-2 rounded-2xl backdrop-blur-md shadow-md break-words bg-[#1a1035]/60 border border-purple-500/20 text-purple-200 whitespace-pre-line"
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
              <div className="inline-flex items-center px-4 py-2 rounded-2xl backdrop-blur-md shadow-md bg-[#1a1035]/60 border border-purple-500/20 text-purple-200">
                <FaBrain className="animate-pulse mr-2" />
                Analyzing in background...
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
            {!isConnected && (
              <div className="text-yellow-400 mb-2 font-bold">⚠️ Paste the Colab WSS URL above and click "Connect Server" to enable voice recording!</div>
            )}
            {isConnected && (
              <div className="text-green-400 mb-2">✅ Server connected - You can record multiple times!</div>
            )}
            This is an AI assistant for emotional support. For crisis situations, please contact emergency services or a mental health professional.
          </div>
        </div>

      </div>
    </div>
  );
};

export default VoicePage;