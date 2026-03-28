import React, { useState } from 'react';
import { FaMicrophone, FaPaperPlane, FaRedo } from 'react-icons/fa';

const ChatInputBar = ({ message, setMessage, sendMessage, onVoiceClick, onNewChat }) => {
  const [voiceActive, setVoiceActive] = useState(false);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
  };

  const handleVoiceClick = () => {
    const newState = !voiceActive;
    setVoiceActive(newState);
    if (newState && onVoiceClick) onVoiceClick();
  };

  const handleRefresh = () => {
    if (onNewChat) onNewChat();
    else window.location.reload();
  };

  return (
    <div className="flex flex-col p-4 bg-[#f0f9f4]/80 backdrop-blur-md border-t border-[#a5d6a7]/20 relative">
      <div className="flex items-center gap-3 w-full">
        <button onClick={handleVoiceClick}
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all animate-float shadow-sm
            ${voiceActive ? 'bg-red-500 shadow-md shadow-red-400/50 hover:shadow-lg hover:shadow-red-400/70'
              : 'bg-[#a5d6a7]/40 text-[#2d3436] hover:bg-[#81c784]/60 hover:shadow-md hover:shadow-[#81c784]/30'}`}>
          <FaMicrophone className={voiceActive ? "text-white" : "text-slate-700"} />
        </button>

        <div className="flex flex-1 items-center relative">
          <input type="text" placeholder="Share your thoughts..." value={message}
            onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyPress}
            className="w-full bg-white border border-[#a5d6a7]/50 rounded-full pl-4 pr-12 py-3 text-[#2d3436] placeholder-slate-400 focus:outline-none focus:border-[#4db6ac] transition-all focus:ring-1 focus:ring-[#4db6ac]/30 shadow-sm" />
          <button onClick={sendMessage}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-[#4db6ac] hover:bg-[#26a69a] transition-all shadow-sm text-white">
            <FaPaperPlane className="text-sm" />
          </button>
        </div>

        <button onClick={handleRefresh}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-[#ffe0b2]/60 hover:bg-[#ffb74d]/80 flex items-center justify-center transition-all animate-float shadow-sm text-orange-800"
          title="New Chat">
          <FaRedo />
        </button>
      </div>

      <div className="mt-2 text-[10px] text-slate-500 text-center font-medium">
        This is an AI assistant for emotional support. For crisis situations, please contact emergency services or a mental health professional.
      </div>

      {voiceActive && (
        <div className="mt-2 text-center text-red-500 text-sm font-bold animate-pulse">Voice recording active...</div>
      )}
    </div>
  );
};

export default ChatInputBar;