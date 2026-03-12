import React, { useState, useEffect } from 'react';
import { FaBrain, FaHeart, FaHistory, FaArrowLeft, FaCalendar, FaQuoteLeft } from 'react-icons/fa';
import Sidebar from './Sidebar';

const MentalStatePage = ({ onBack, onHomeClick, onMentalStateClick, onHistoryClick, onFAQsClick }) => {
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadAnalysisData();
    const handleStorageChange = () => loadAnalysisData();
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(loadAnalysisData, 2000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const loadAnalysisData = () => {
    const latest = localStorage.getItem('latestAnalysis');
    if (latest) setLatestAnalysis(JSON.parse(latest));
    const history = localStorage.getItem('analysisHistory');
    if (history) setAnalysisHistory(JSON.parse(history));
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getEmotionColor = (emotion) => {
    const colors = {
      joy: 'text-yellow-400', sadness: 'text-blue-400',
      anger: 'text-red-400', fear: 'text-purple-400',
      surprise: 'text-pink-400', disgust: 'text-green-400',
      neutral: 'text-gray-400'
    };
    return colors[emotion?.toLowerCase()] || 'text-blue-400';
  };

  const getMentalHealthColor = (state) => {
    const colors = {
      normal: 'text-green-400', anxiety: 'text-yellow-400',
      depression: 'text-blue-400', stress: 'text-orange-400',
      bipolar: 'text-purple-400', suicidal: 'text-red-400',
      'personality disorder': 'text-pink-400'
    };
    return colors[state?.toLowerCase()] || 'text-green-400';
  };

  if (!latestAnalysis) {
    return (
      <div className="flex h-screen bg-[#0a0515] text-white overflow-hidden">
        <Sidebar
          onHomeClick={onHomeClick}
          onMentalStateClick={onMentalStateClick}
          onHistoryClick={onHistoryClick}
          onFAQsClick={onFAQsClick}
          currentPage="mental-state"
        />
        <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-br from-[#0a0515] via-[#140a2e] to-[#0a0515]">
          <FaBrain className="text-6xl text-purple-400 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-purple-300 mb-2">No Analysis Yet</h2>
          <p className="text-purple-300/60 mb-6">Share your thoughts in the chat first.</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-purple-600/30 hover:bg-purple-600/50 rounded-full transition-all flex items-center gap-2"
          >
            <FaArrowLeft />
            Back to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0515] text-white overflow-hidden">

      <Sidebar
        onHomeClick={onHomeClick}
        onMentalStateClick={onMentalStateClick}
        onHistoryClick={onHistoryClick}
        onFAQsClick={onFAQsClick}
        currentPage="mental-state"
      />

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#0a0515] via-[#140a2e] to-[#0a0515]">

        {/* Animated Stars */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(100)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-white rounded-full opacity-20 animate-pulse"
              style={{
                width: `${Math.random() * 3 + 1}px`,
                height: `${Math.random() * 3 + 1}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDuration: `${Math.random() * 3 + 2}s`
              }}
            />
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
                <p className="text-sm text-purple-300/60">Your latest emotional and mental health assessment</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 rounded-full transition-all flex items-center gap-2"
              >
                <FaHistory />
                {showHistory ? 'Hide' : 'Show'} History
              </button>
              <button
                onClick={onBack}
                className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 rounded-full transition-all flex items-center gap-2"
              >
                <FaArrowLeft />
                Back
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 relative z-10">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Timestamp */}
            <div className="flex items-center gap-2 text-purple-300/60 text-sm">
              <FaCalendar />
              <span>Analyzed on {formatDate(latestAnalysis.timestamp)}</span>
            </div>

            {/* User Text */}
            <div className="bg-[#1a1035]/60 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <FaQuoteLeft className="text-purple-400" />
                <h3 className="text-lg font-semibold text-purple-300">What You Shared</h3>
              </div>
              <p className="text-purple-200 leading-relaxed italic">
                "{latestAnalysis.userText}"
              </p>
            </div>

            {/* Analysis Grid */}
            <div className="grid md:grid-cols-2 gap-6">

              {/* Emotion */}
              <div className="bg-[#1a1035]/60 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-500/20 rounded-full">
                    <FaHeart className="text-2xl text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-purple-300">Emotion Detected</h3>
                    <p className="text-sm text-purple-300/60">Primary emotional state</p>
                  </div>
                </div>

                {/* ── null check for emotion ── */}
                {latestAnalysis.emotion ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-3xl font-bold ${getEmotionColor(latestAnalysis.emotion.rawLabel)}`}>
                          {latestAnalysis.emotion.label}
                        </span>
                        <span className="text-2xl font-bold text-purple-300">
                          {latestAnalysis.emotion.confidence}%
                        </span>
                      </div>
                      <div className="w-full h-3 bg-purple-900/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${latestAnalysis.emotion.confidence}%` }}
                        />
                      </div>
                    </div>
                    <div className="pt-4 border-t border-purple-500/20">
                      <p className="text-sm text-purple-300/70">
                        Confidence Level: <span className="font-semibold text-purple-300">
                          {latestAnalysis.emotion.confidence >= 70 ? 'High' : latestAnalysis.emotion.confidence >= 50 ? 'Moderate' : 'Low'}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24">
                    <p className="text-purple-300/60 text-sm text-center">
                      Emotion analysis skipped for high risk detection.
                    </p>
                  </div>
                )}
              </div>

              {/* Mental Health */}
              <div className="bg-[#1a1035]/60 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-green-500/20 rounded-full">
                    <FaBrain className="text-2xl text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-purple-300">Mental Health State</h3>
                    <p className="text-sm text-purple-300/60">Overall mental wellness indicator</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-3xl font-bold ${getMentalHealthColor(latestAnalysis.mentalHealth.rawLabel)}`}>
                        {latestAnalysis.mentalHealth.label}
                      </span>
                      <span className="text-2xl font-bold text-purple-300">
                        {latestAnalysis.mentalHealth.confidence}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-purple-900/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${latestAnalysis.mentalHealth.confidence}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-purple-500/20">
                    <p className="text-sm text-purple-300/70">
                      Confidence Level: <span className="font-semibold text-purple-300">
                        {latestAnalysis.mentalHealth.confidence >= 70 ? 'High' : latestAnalysis.mentalHealth.confidence >= 50 ? 'Moderate' : 'Low'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Disclaimer */}
            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-purple-300 mb-3">💡 Remember</h3>
              <p className="text-purple-200 leading-relaxed">
                This analysis is based on AI interpretation and should not replace professional mental health advice.
                If you're experiencing severe emotional distress, please reach out to a mental health professional or crisis hotline.
              </p>
            </div>

            {/* History */}
            {showHistory && analysisHistory.length > 1 && (
              <div className="bg-[#1a1035]/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6">
                <h3 className="text-xl font-semibold text-purple-300 mb-4 flex items-center gap-2">
                  <FaHistory />
                  Analysis History
                </h3>
                <div className="space-y-3">
                  {analysisHistory.slice().reverse().map((analysis, index) => (
                    <div
                      key={index}
                      className="bg-[#0a0515]/50 border border-purple-500/20 rounded-lg p-4 hover:border-purple-500/40 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-purple-300/60">{formatDate(analysis.timestamp)}</span>
                        <div className="flex gap-4">
                          {/* ── null check for history emotion ── */}
                          {analysis.emotion && (
                            <span className={`text-sm font-semibold ${getEmotionColor(analysis.emotion.rawLabel)}`}>
                              {analysis.emotion.label}
                            </span>
                          )}
                          <span className={`text-sm font-semibold ${getMentalHealthColor(analysis.mentalHealth.rawLabel)}`}>
                            {analysis.mentalHealth.label}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-purple-300/80 line-clamp-2">
                        "{analysis.userText}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

export default MentalStatePage;