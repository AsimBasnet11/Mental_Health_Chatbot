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
    <div className="w-44 h-screen bg-gradient-to-b from-[#e8f5e9] via-[#f1f8e9] to-[#e8f5e9] flex flex-col items-center py-8 gap-0 relative overflow-hidden shadow-2xl border-r border-[#a5d6a7]/30">

      {/* Top Group: Logo & New Chat */}
      <div className="w-full flex flex-col items-center gap-6 shrink-0 px-4">
        <div className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95">
          <img
            src={logo}
            alt="MindCare Logo"
            onClick={() => window.location.reload()}
            className="w-32 h-auto object-contain animate-logoGlow"
          />
        </div>

        {onNewChat && (
          <button onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#009688] to-[#00796b] rounded-2xl text-xs text-white hover:from-[#00796b] hover:to-[#004d40] transition-all hover:shadow-lg hover:shadow-teal-500/20 active:scale-[0.98] font-bold tracking-wide shadow-md">
            <Plus size={16} /> New Chat
          </button>
        )}
      </div>

      {/* Middle Group: Nav Menu */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0 py-8">
        <div className="bg-white/40 backdrop-blur-md rounded-[2rem] p-4 border border-white/40 w-[140px] shadow-sm flex flex-col gap-5 items-center">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = active === item.label;
            return (
              <button key={index} onClick={() => handleClick(item)}
                className="relative flex flex-col items-center gap-1.5 group transition-all duration-300 w-full">
                <div className={`absolute w-full h-full rounded-2xl opacity-0 blur-xl transition-all duration-300 -z-10
                    ${isActive ? 'opacity-40 bg-[#009688]/40' : 'group-hover:opacity-40 group-hover:bg-[#e0f2f1]'}`} />

                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ease-out shadow-sm
                    ${isActive ? 'bg-[#009688] text-white scale-110 shadow-lg shadow-[#009688]/30' : 'bg-white/50 text-slate-600 group-hover:bg-[#009688] group-hover:text-white group-hover:scale-105'}`}>
                  <Icon size={20} className="transition-transform duration-300" />
                </div>
                <span className={`text-[10px] font-extrabold uppercase tracking-widest transition-all duration-300
                    ${isActive ? 'text-[#009688] opacity-100' : 'text-slate-400 opacity-60 group-hover:text-[#009688] group-hover:opacity-100'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Group: Profile */}
      {user && (
        <div className="w-full px-4 pt-4 mt-auto mb-2 shrink-0 border-t border-[#a5d6a7]/10">
          <div className="relative w-full flex justify-center">
            <button onClick={() => setShowProfile(!showProfile)}
              className="flex flex-col items-center gap-1 group transition-all">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#009688] to-[#00796b] flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-teal-500/20 group-hover:scale-110 transition-transform">
                {user.name ? user.name.charAt(0).toUpperCase() : <User size={18} />}
              </div>
              <span className="text-[10px] font-extrabold text-[#009688] uppercase tracking-widest opacity-80 group-hover:opacity-100 truncate max-w-[120px]">
                {user.name || 'User'}
              </span>
            </button>

            {showProfile && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-[180px] bg-white/95 backdrop-blur-2xl border border-slate-100 rounded-2xl p-3 shadow-2xl z-50 animate-fadeIn text-slate-700">
                <div className="text-[#009688] text-xs font-bold mb-0.5 truncate uppercase tracking-widest text-center">{user.name}</div>
                <div className="text-slate-400 text-[10px] mb-3 truncate text-center">{user.email}</div>
                <button onClick={() => { setShowProfile(false); onLogout?.(); }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl text-rose-500 text-xs font-bold transition-all">
                  <LogOut size={14} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;