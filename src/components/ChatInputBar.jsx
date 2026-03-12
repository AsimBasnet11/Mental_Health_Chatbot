import React, { useState } from 'react';
import { FaMicrophone, FaPaperPlane, FaRedo } from 'react-icons/fa';

const ChatInputBar = ({ message, setMessage, sendMessage, onVoiceClick }) => {
  const [voiceActive, setVoiceActive] = useState(false);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleVoiceClick = () => {
    const newState = !voiceActive;
    setVoiceActive(newState);

    if (newState && onVoiceClick) {
      // Trigger Voice Page in App.jsx
      onVoiceClick();
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col p-4 bg-[#0a0515] relative">

      {/* Input Row */}
      <div className="flex items-center gap-3 w-full">

        {/* Voice Button Left */}
        <button
          onClick={handleVoiceClick}
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all animate-float shadow-[0_0_10px_rgba(138,43,226,0.4)]
            ${voiceActive
              ? 'bg-red-500 shadow-lg shadow-red-400/50 hover:shadow-lg hover:shadow-red-400/70'
              : 'bg-purple-600/20 hover:bg-purple-600/40 hover:shadow-[0_0_20px_rgba(138,43,226,0.7)]'
            }`}
        >
          <FaMicrophone className="text-white" />
        </button>

        {/* Text Input with Send Button */}
        <div className="flex flex-1 relative">
          <input
            type="text"
            placeholder="Write Text Here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-full bg-[#1a1035]/50 border border-purple-500/30 rounded-full px-4 py-3 pr-12 text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400 transition-colors"
          />

          {/* Send Button Inside Input */}
          <button
            onClick={sendMessage}
            className="absolute right-1 top-1.5 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center hover:bg-purple-600/20 transition-all animate-float shadow-[0_0_10px_rgba(138,43,226,0.4)] hover:shadow-[0_0_20px_rgba(138,43,226,0.7)]"
          >
            <FaPaperPlane className="text-white" />
          </button>
        </div>

        {/* Retry / Refresh Button */}
        <button
          onClick={handleRefresh}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-600/20 hover:bg-purple-600/40 flex items-center justify-center transition-all animate-float shadow-[0_0_10px_rgba(138,43,226,0.4)] hover:shadow-[0_0_20px_rgba(138,43,226,0.7)]"
        >
          <FaRedo className="text-white" />
        </button>
      </div>

      {/* Info Text Centered */}
      <div className="mt-2 text-xs text-purple-300/60 text-center">
        This is an AI assistant for emotional support. For crisis situations, please contact emergency services or a mental health professional.
      </div>

      {/* Animated "User is speaking..." while voice active */}
      {voiceActive && (
        <div className="mt-2 text-center text-purple-200 text-sm animate-pulse">
          User is speaking...
        </div>
      )}
    </div>
  );
};

export default ChatInputBar;
