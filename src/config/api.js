// Centralized API and endpoint configuration

export const API_BASE = "http://localhost:8000";
export const ASR_WS_URL = "wss://vixenish-vihaan-unstrategically.ngrok-free.dev/ws/asr";

export const ENDPOINTS = {
  CHAT: "/api/chat",
  REGISTER: "/register",
  LOGIN: "/login",
  HISTORY: "/api/conversations",
  SUMMARY: "/api/summary",
  HEALTH: "/health",
  HISTORY_ITEMS: "/history",
  TTS: "/api/tts"
};
