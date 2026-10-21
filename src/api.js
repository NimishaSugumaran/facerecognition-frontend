/**
 * api.js — Production API + WebSocket service layer v2.0
 */
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL   = import.meta.env.VITE_WS_URL  || 'ws://localhost:8000';

// ── Axios instance ─────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,                // default 30s for all requests
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('arcface_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unified error handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only force logout on 401 for non-register/non-delete requests
    // Register can legitimately get 401 if token expired — show error, don't logout
    const url = err.config?.url || '';
    const isAuthSensitive = !url.includes('/register') && !url.includes('/user');
    if (err.response?.status === 401 && isAuthSensitive) {
      localStorage.removeItem('arcface_token');
      window.dispatchEvent(new Event('arcface:logout'));
    }
    const msg = err.response?.data?.detail || err.message || 'Unknown error';
    return Promise.reject(new Error(msg));
  }
);

// ── Auth ───────────────────────────────────────────────────────────────────
export const login  = (username, password) =>
  api.post('/auth/login', { username, password }).then(r => {
    localStorage.setItem('arcface_token', r.data.access_token);
    return r.data;
  });

export const logout = () => localStorage.removeItem('arcface_token');
export const getMe  = () => api.get('/auth/me').then(r => r.data);
export const isAuthenticated = () => !!localStorage.getItem('arcface_token');

// ── REST endpoints ─────────────────────────────────────────────────────────
export const checkHealth  = () => api.get('/health').then(r => r.data);
export const getStats     = () => api.get('/stats').then(r => r.data);
export const getUsers     = () => api.get('/users').then(r => r.data);
export const getAlerts    = (limit = 20)  => api.get('/alerts', { params: { limit } }).then(r => r.data);
export const getLogs      = (params = {}) => api.get('/logs',   { params }).then(r => r.data);
export const reloadCache  = () => api.post('/reload-cache').then(r => r.data);
export const recognizeFace = (image, check_motion = true) =>
  api.post('/recognize', { image, check_motion }).then(r => r.data);
export const getWorkerStatus = () => api.get('/worker/status').then(r => r.data);
export const controlWorker   = (payload) => api.post('/worker/control', payload).then(r => r.data);

// Register — no JWT needed (local system), long timeout for CPU inference
export const registerUser = (name, role, images) =>
  api.post('/register', { name, role, images }, { timeout: 180000 }).then(r => r.data);

// BUG FIX 2 — Delete user: axios DELETE with a body needs explicit headers.
// Some axios versions drop the Authorization header on DELETE+body requests.
export const deleteUser = (user_id) => {
  const token = localStorage.getItem('arcface_token');
  return axios.delete(
    `${BASE_URL}/user`,
    {
      data: { user_id },
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 10000,
    }
  ).then(r => r.data);
};

// ── WebSocket manager ──────────────────────────────────────────────────────
class WebSocketManager {
  constructor() {
    this.ws       = null;
    this.handlers = {};   // eventType → [callbacks]
    this.reconnectDelay = 2000;
    this._reconnectTimer = null;
    this._intentional = false;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this._intentional = false;
    this._doConnect();
  }

  _doConnect() {
    this.ws = new WebSocket(`${WS_URL}/ws/live`);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this._emit('connected', {});
      this.reconnectDelay = 2000;
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this._emit(msg.type, msg);
        this._emit('*', msg);   // wildcard — receive all events
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      this._emit('disconnected', {});
      if (!this._intentional) {
        console.log(`[WS] Reconnecting in ${this.reconnectDelay}ms…`);
        this._reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 15000);
          this._doConnect();
        }, this.reconnectDelay);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error', err);
      this._emit('error', { error: err });
    };
  }

  disconnect() {
    this._intentional = true;
    clearTimeout(this._reconnectTimer);
    if (this.ws) this.ws.close();
  }

  send(cmd, value) {
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify({ cmd, value }));
  }

  on(type, cb) {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(cb);
    return () => this.off(type, cb);
  }

  off(type, cb) {
    if (this.handlers[type])
      this.handlers[type] = this.handlers[type].filter(h => h !== cb);
  }

  _emit(type, data) {
    (this.handlers[type] || []).forEach(cb => cb(data));
  }
}

export const wsManager = new WebSocketManager();
export default api;