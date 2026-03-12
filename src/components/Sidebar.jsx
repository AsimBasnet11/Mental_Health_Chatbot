import React, { useState, useEffect } from 'react';
import { Home, Activity, HelpCircle, Clock } from 'lucide-react';
import logo from '../assets/logo.png'; // path to your logo

const Sidebar = ({ 
  onHomeClick, 
  onMentalStateClick, 
  onHistoryClick, 
  onFAQsClick,
  currentPage  // ← Receive current page from App
}) => {
  // Map currentPage to sidebar labels
  const pageToLabel = {
    'home': 'Home',
    'voice': 'Home',  // Voice goes back to Home
    'mental-state': 'Mental State',
    'history': 'History',
    'faqs': 'FAQs'
  };

  // Sync active state with actual current page
  const [active, setActive] = useState(pageToLabel[currentPage] || 'Home');

  // Update active state when currentPage changes
  useEffect(() => {
    setActive(pageToLabel[currentPage] || 'Home');
  }, [currentPage]);

  const navItems = [
    { icon: Home, label: 'Home', onClick: onHomeClick },
    { icon: Activity, label: 'Mental State', onClick: onMentalStateClick },
    { icon: Clock, label: 'History', onClick: onHistoryClick },
    { icon: HelpCircle, label: 'FAQs', onClick: onFAQsClick }
  ];

  // Handle navigation clicks
  const handleClick = (item) => {
    console.log('Sidebar clicked:', item.label);
    setActive(item.label);  // Update visual state
    
    // Call the appropriate handler
    if (item.onClick) {
      console.log(`🎯 Calling handler for ${item.label}`);
      item.onClick();
    }
  };

  return (
    <div className="w-40 min-h-screen bg-gradient-to-b from-[#0a0515] via-[#1a1035] to-[#0a0515] flex flex-col items-center py-8 gap-8 relative">
      
      {/* Logo Image with Glow */}
      <div className="mb-4 relative">
        <img
          src={logo}
          alt="MindCare Logo"
          className="w-34 h-auto object-contain animate-logoGlow"
        />
      </div>

      {/* Centered Glass Navigation Container with Floating Animation */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="bg-gradient-to-b from-[#2a1f45]/40 to-[#1a1035]/40 backdrop-blur-sm rounded-full p-4 border border-purple-500/20 max-w-[120px] animate-float">
          <div className="flex flex-col gap-6">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = active === item.label; // check active page

              return (
                <button
                  key={index}
                  onClick={() => handleClick(item)}
                  className={`relative flex flex-col items-center gap-2 group transition-all duration-300`}
                >
                  {/* Glowing Circle */}
                  <div className={`absolute w-16 h-16 rounded-full opacity-0 blur-xl transition-all duration-300 -z-10
                                  ${isActive ? 'opacity-50 bg-white/30' : 'bg-purple-400/30 group-hover:opacity-50'}`}>
                  </div>

                  {/* Sparkles */}
                  <div className="absolute w-16 h-16 top-0 left-0 pointer-events-none">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute bg-white rounded-full opacity-0 group-hover:opacity-100 animate-pulse"
                        style={{
                          width: `${Math.random() * 3 + 1}px`,
                          height: `${Math.random() * 3 + 1}px`,
                          top: `${Math.random() * 100}%`,
                          left: `${Math.random() * 100}%`,
                          animationDelay: `${Math.random() * 1}s`
                        }}
                      ></div>
                    ))}
                  </div>

                  {/* Icon with shimmer */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center
                                  transition-transform duration-300 ease-out shadow-md
                                  ${isActive 
                                    ? 'bg-white text-[#1a1035] scale-125 shadow-purple-400/70' 
                                    : 'bg-purple-600/20 group-hover:bg-white group-hover:text-[#1a1035] animate-twinkle'
                                  }`}
                  >
                    <Icon size={20} className="transition-colors duration-300" />
                  </div>

                  {/* Label */}
                  <span className={`text-xs font-medium transform transition-transform duration-300
                                   ${isActive ? 'text-white scale-110' : 'text-purple-300 group-hover:text-white group-hover:scale-110'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;