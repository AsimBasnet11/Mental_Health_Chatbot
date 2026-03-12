import React, { useState, useEffect } from 'react';
import { Home, Activity, HelpCircle, Clock, Plus, LogOut, User, FileText } from 'lucide-react';
import logo from '../assets/logo.png';

const Sidebar = ({
  onHomeClick, onMentalStateClick, onHistoryClick, onFAQsClick, onSummaryClick,
  currentPage, user, onLogout, onNewChat
}) => {
  const pageToLabel = { 'home': 'Home', 'voice': 'Home', 'mental-state': 'Mental State', 'history': 'History', 'faqs': 'FAQs', 'summary': 'Summary' };
  const [active, setActive] = useState(pageToLabel[currentPage] || 'Home');
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => { setActive(pageToLabel[currentPage] || 'Home'); }, [currentPage]);

  const navItems = [
    { icon: Home, label: 'Home', onClick: onHomeClick },
    { icon: Activity, label: 'Mental State', onClick: onMentalStateClick },
    { icon: FileText, label: 'Summary', onClick: onSummaryClick },
    { icon: Clock, label: 'History', onClick: onHistoryClick },
    { icon: HelpCircle, label: 'FAQs', onClick: onFAQsClick }
  ];

  const handleClick = (item) => { setActive(item.label); item.onClick?.(); };

  return (
    <div className="w-40 h-screen bg-gradient-to-b from-[#0a0515] via-[#1a1035] to-[#0a0515] flex flex-col items-center py-4 gap-2 relative overflow-hidden">

      {/* Logo */}
      <div className="mb-1 relative shrink-0">
        <img src={logo} alt="MindCare Logo" className="w-28 h-auto object-contain animate-logoGlow" />
      </div>

      {/* New Chat Button */}
      {onNewChat && (
        <button onClick={onNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600/40 to-pink-600/40 border border-purple-500/30 rounded-full text-xs text-purple-200 hover:from-purple-600/60 hover:to-pink-600/60 transition-all hover:scale-105 active:scale-95 shrink-0">
          <Plus size={12} /> New Chat
        </button>
      )}

      {/* Nav Items */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        <div className="bg-gradient-to-b from-[#2a1f45]/40 to-[#1a1035]/40 backdrop-blur-sm rounded-full p-3 border border-purple-500/20 max-w-[120px] animate-float">
          <div className="flex flex-col gap-3">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = active === item.label;
              return (
                <button key={index} onClick={() => handleClick(item)}
                  className="relative flex flex-col items-center gap-2 group transition-all duration-300">
                  <div className={`absolute w-16 h-16 rounded-full opacity-0 blur-xl transition-all duration-300 -z-10
                    ${isActive ? 'opacity-50 bg-white/30' : 'bg-purple-400/30 group-hover:opacity-50'}`} />
                  <div className="absolute w-16 h-16 top-0 left-0 pointer-events-none">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="absolute bg-white rounded-full opacity-0 group-hover:opacity-100 animate-pulse"
                        style={{ width: `${Math.random()*3+1}px`, height: `${Math.random()*3+1}px`,
                          top: `${Math.random()*100}%`, left: `${Math.random()*100}%`,
                          animationDelay: `${Math.random()*1}s` }} />
                    ))}
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 ease-out shadow-md
                    ${isActive ? 'bg-white text-[#1a1035] scale-125 shadow-purple-400/70' : 'bg-purple-600/20 group-hover:bg-white group-hover:text-[#1a1035] animate-twinkle'}`}>
                    <Icon size={18} className="transition-colors duration-300" />
                  </div>
                  <span className={`text-[10px] font-medium transform transition-transform duration-300
                    ${isActive ? 'text-white scale-110' : 'text-purple-300 group-hover:text-white group-hover:scale-110'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Profile at Bottom */}
      {user && (
        <div className="relative shrink-0 mt-auto pb-1">
          <button onClick={() => setShowProfile(!showProfile)}
            className="flex flex-col items-center gap-0.5 group transition-all">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-purple-600/30 group-hover:shadow-purple-500/50 transition-all group-hover:scale-110">
              {user.name ? user.name.charAt(0).toUpperCase() : <User size={14} />}
            </div>
            <span className="text-[10px] text-purple-300/70 truncate max-w-[100px]">{user.name || user.email}</span>
          </button>

          {showProfile && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1035]/95 backdrop-blur-xl border border-purple-500/30 rounded-xl p-3 min-w-[160px] shadow-2xl z-50 animate-fadeIn">
              <div className="text-purple-200 text-sm font-medium mb-1 truncate">{user.name}</div>
              <div className="text-purple-400/60 text-xs mb-3 truncate">{user.email}</div>
              <button onClick={() => { setShowProfile(false); onLogout?.(); }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-red-500/15 hover:bg-red-500/30 border border-red-500/20 rounded-lg text-red-400 text-sm transition-all">
                <LogOut size={14} /> Log out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;