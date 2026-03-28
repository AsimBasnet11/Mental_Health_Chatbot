import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

import logo from '../assets/logo.png';
import { API_BASE, ENDPOINTS } from '../config/api';


const LoginPage = ({ onLoginSuccess, onGoRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Login failed.'); return; }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch {
      setError('Cannot connect to server. Make sure backend is running.');
    } finally { setLoading(false); }
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter') handleLogin(); };

  return (
    <div className="fixed inset-0 flex bg-[#f0f9f4] text-[#2d3436] items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(100)].map((_, i) => (
          <div key={i} className="absolute bg-[#a5d6a7]/40 rounded-full animate-pulse"
            style={{
              width: `${Math.random() * 2.5 + 0.5}px`, height: `${Math.random() * 2.5 + 0.5}px`,
              top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
              animationDuration: `${Math.random() * 4 + 2}s`, animationDelay: `${Math.random() * 2}s`
            }} />
        ))}
      </div>
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-sky-400/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md mx-4 transform translate-y-6 animate-fadeIn">
        <div className="bg-white/70 backdrop-blur-xl border border-[#a5d6a7]/30 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-teal-900/10">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 animate-float">
              <img src={logo} alt="Aria Logo" className="w-32 h-auto object-contain mx-auto animate-logoGlow" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">MindCare</h1>
            <p className="text-slate-500 mt-2 text-sm font-medium">Welcome back — sign in to continue</p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-6 text-rose-600 text-sm flex items-center gap-2 font-medium shadow-sm">
              <span className="text-rose-500">&#9888;</span> {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-slate-600 text-sm mb-1.5 block font-bold uppercase tracking-wider ml-1">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-600/50" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyPress}
                  placeholder="you@example.com"
                  className="w-full bg-white/50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/5 transition-all duration-300 shadow-sm" />
              </div>
            </div>
            <div>
              <label className="text-slate-600 text-sm mb-1.5 block font-bold uppercase tracking-wider ml-1">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-600/50" />
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyPress} placeholder="••••••••"
                  className="w-full bg-white/50 border border-slate-200 rounded-xl pl-12 pr-12 py-3.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/5 transition-all duration-300 shadow-sm" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <button onClick={handleLogin} disabled={loading}
            className="w-full mt-8 py-4 bg-teal-600 hover:bg-teal-700 rounded-xl font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:translate-y-0">
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <p className="text-center text-slate-500 text-sm font-medium">
            Don't have an account?{' '}
            <button onClick={onGoRegister} className="text-teal-600 hover:text-teal-700 font-bold underline underline-offset-4 transition-colors duration-300">Create one</button>
          </p>
        </div>
        <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-6">Your mental wellness companion</p>
      </div>
    </div>
  );
};

export default LoginPage;