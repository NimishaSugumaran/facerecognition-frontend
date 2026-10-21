/**
 * App.jsx — Root application with auth gate + WebSocket lifecycle
 */
import React, { useState, useEffect, useRef } from 'react';
import { wsManager, isAuthenticated, logout } from './api.js';
import Login    from './pages/Login.jsx';
import Sidebar  from './components/Sidebar.jsx';
import Dashboard  from './pages/Dashboard.jsx';
import Recognize  from './pages/Recognize.jsx';
import Register   from './pages/Register.jsx';
import Logs       from './pages/Logs.jsx';
import Users      from './pages/Users.jsx';
import Alerts     from './pages/Alerts.jsx';

const PAGE_MAP = { dashboard: Dashboard, recognize: Recognize, register: Register, logs: Logs, users: Users, alerts: Alerts };

export default function App() {
  const [authed,       setAuthed]       = useState(isAuthenticated());
  const [page,         setPage]         = useState('dashboard');
  const [wsConnected,  setWsConnected]  = useState(false);
  const [alertCount,   setAlertCount]   = useState(0);
  const [systemStatus, setSystemStatus] = useState(null);
  const wsStarted = useRef(false);   // guard against StrictMode double-mount

  // Logout event from api interceptor
  useEffect(() => {
    const h = () => { setAuthed(false); };
    window.addEventListener('arcface:logout', h);
    return () => window.removeEventListener('arcface:logout', h);
  }, []);

  // WebSocket lifecycle — connect once, clean up on unmount/logout
  useEffect(() => {
    if (!authed) return;
    // Prevent StrictMode double-mounting from opening 2 WS connections
    if (wsStarted.current) return;
    wsStarted.current = true;

    wsManager.connect();
    const u1 = wsManager.on('connected',         () => setWsConnected(true));
    const u2 = wsManager.on('disconnected',       () => setWsConnected(false));
    const u3 = wsManager.on('system_status',      (d) => setSystemStatus(d));
    const u4 = wsManager.on('control_ack',        (d) => {
      // Keep systemStatus in sync with server acks
      if (d.recognition_enabled !== undefined)
        setSystemStatus(prev => ({ ...prev, worker_enabled: d.recognition_enabled }));
      if (d.motion_enabled !== undefined)
        setSystemStatus(prev => ({ ...prev, motion_enabled: d.motion_enabled }));
    });
    const u5 = wsManager.on('unknown_detected',   () => setAlertCount(c => c + 1));

    return () => {
      u1(); u2(); u3(); u4(); u5();
      wsManager.disconnect();
      wsStarted.current = false;
    };
  }, [authed]);

  const handleLogout = () => { logout(); wsManager.disconnect(); setAuthed(false); };

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const ActivePage = PAGE_MAP[page] || Dashboard;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative', zIndex: 10 }}>
      <Sidebar
        active={page} onNavigate={setPage}
        alertCount={alertCount} wsConnected={wsConnected}
        systemStatus={systemStatus} onLogout={handleLogout}
      />
      <main style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minWidth: 0, overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 24px', borderBottom: '1px solid var(--border)',
          background: 'rgba(13,13,20,0.85)', backdropFilter: 'blur(8px)', flexShrink: 0,
        }}>
          <div className="d-flex align-items-center gap-2 mono" style={{ fontSize: 12, color: 'var(--dim)' }}>
            <span>ArcFace OS v2</span>
            <span style={{ color: 'var(--border)' }}>›</span>
            <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{page}</span>
          </div>
          <div className="d-flex align-items-center gap-3">
            {/* WS status */}
            <div className="d-flex align-items-center gap-2 mono" style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 999,
              background: wsConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${wsConnected ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              color: wsConnected ? 'var(--success)' : 'var(--danger)',
            }}>
              <span className={`pulse-dot ${wsConnected ? 'green' : 'red'}`} style={{ width: 6, height: 6 }} />
              {wsConnected ? 'Stream Live' : 'Stream Offline'}
            </div>
            {/* Worker enabled pill */}
            {systemStatus && (
              <div className="d-flex align-items-center gap-2 mono" style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 999,
                background: systemStatus.worker_enabled ? 'rgba(99,102,241,0.12)' : 'rgba(100,100,120,0.1)',
                border: `1px solid ${systemStatus.worker_enabled ? 'rgba(99,102,241,0.3)' : 'rgba(100,100,120,0.2)'}`,
                color: systemStatus.worker_enabled ? 'var(--accent-b)' : 'var(--dim)',
              }}>
                {systemStatus.worker_enabled ? `▶ ${systemStatus.fps ?? 0} fps` : '⏸ Paused'}
              </div>
            )}
          </div>
        </header>

        <div style={{ flex: '1 1 0%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ActivePage key={page} systemStatus={systemStatus} />
        </div>
      </main>
    </div>
  );
}