import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import logo from '../assets/logo.png';
import { API_BASE, ENDPOINTS } from '../config/api';

// API_BASE now imported from config/api.js

const RegisterPage = ({ onLoginSuccess, onGoLogin }) => {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirm) { setError('Please fill in all fields.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Registration failed.'); return; }
      // After registering, go to Sign In page (do not auto-login)
      onGoLogin();
    } catch {
      setError('Cannot connect to server. Make sure backend is running.');
    } finally { setLoading(false); }
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter') handleRegister(); };

  return (
    <div className="fixed inset-0 flex bg-[#0a0515] text-white items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(100)].map((_, i) => (
          <div key={i} className="absolute bg-white rounded-full opacity-20 animate-pulse"
            style={{ width: `${Math.random()*2.5+0.5}px`, height: `${Math.random()*2.5+0.5}px`,
              top: `${Math.random()*100}%`, left: `${Math.random()*100}%`,
              animationDuration: `${Math.random()*4+2}s`, animationDelay: `${Math.random()*2}s` }} />
        ))}
      </div>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-pink-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] bg-purple-700/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md mx-4 mt-8 animate-fadeIn">
        <div className="bg-[#1a1035]/70 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-purple-900/30">
          <div className="text-center mb-3">
            <div className="mx-auto mb-1 animate-float">
              <img src={logo} alt="MindCare Logo" className="w-16 h-auto object-contain mx-auto animate-logoGlow" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-300 via-purple-300 to-pink-400 bg-clip-text text-transparent">Join MindCare</h1>
            <p className="text-purple-300/50 mt-1 text-sm">Start your mental wellness journey</p>
          </div>

          {error && (
            <div className="bg-red-500/15 border border-red-500/40 rounded-xl px-4 py-3 mb-5 text-red-300 text-sm flex items-center gap-2">
              <span className="text-red-400">&#9888;</span> {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-purple-300/70 text-sm mb-1.5 block font-medium">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400/50" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleKeyPress}
                  placeholder="Your name"
                  className="w-full bg-[#0a0515]/50 border border-purple-500/25 rounded-xl pl-11 pr-4 py-3 text-white placeholder-purple-400/30 focus:outline-none focus:border-purple-400/60 focus:bg-[#0a0515]/70 transition-all duration-300" />
              </div>
            </div>
            <div>
              <label className="text-purple-300/70 text-sm mb-1.5 block font-medium">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400/50" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyPress}
                  placeholder="you@example.com"
                  className="w-full bg-[#0a0515]/50 border border-purple-500/25 rounded-xl pl-11 pr-4 py-3 text-white placeholder-purple-400/30 focus:outline-none focus:border-purple-400/60 focus:bg-[#0a0515]/70 transition-all duration-300" />
              </div>
            </div>
            <div>
              <label className="text-purple-300/70 text-sm mb-1.5 block font-medium">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400/50" />
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyPress} placeholder="Min 6 characters"
                  className="w-full bg-[#0a0515]/50 border border-purple-500/25 rounded-xl pl-11 pr-11 py-3 text-white placeholder-purple-400/30 focus:outline-none focus:border-purple-400/60 focus:bg-[#0a0515]/70 transition-all duration-300" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400/50 hover:text-purple-300 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-purple-300/70 text-sm mb-1.5 block font-medium">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400/50" />
                <input type={showConfirm ? 'text' : 'password'} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} onKeyDown={handleKeyPress} placeholder="••••••••"
                  className="w-full bg-[#0a0515]/50 border border-purple-500/25 rounded-xl pl-11 pr-11 py-3 text-white placeholder-purple-400/30 focus:outline-none focus:border-purple-400/60 focus:bg-[#0a0515]/70 transition-all duration-300" />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400/50 hover:text-purple-300 transition-colors">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button onClick={handleRegister} disabled={loading}
            className="w-full mt-5 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 rounded-xl font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-600/30 hover:shadow-pink-500/50 hover:scale-[1.02] active:scale-[0.98]">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Creating account...
              </span>
            ) : 'Create Account'}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-purple-500/20" />
            <span className="text-purple-400/40 text-xs">or</span>
            <div className="flex-1 h-px bg-purple-500/20" />
          </div>

          <p className="text-center text-purple-300/50 text-sm">
            Already have an account?{' '}
            <button onClick={onGoLogin} className="text-purple-400 hover:text-pink-400 font-semibold transition-colors duration-300">Sign in</button>
          </p>
        </div>
        <p className="text-center text-purple-500/30 text-xs mt-3">Your mental wellness companion</p>
      </div>
    </div>
  );
};

export default RegisterPage;
