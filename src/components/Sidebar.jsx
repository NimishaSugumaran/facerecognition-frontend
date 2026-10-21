/**
 * Sidebar.jsx — Single control point for recognition + motion
 * Auto-starts the VideoWorker as soon as WS connects (no manual click needed first time).
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Eye, UserPlus, ClipboardList, Users, Bell,
  LayoutDashboard, Zap, LogOut, Play, Pause, Activity,
} from 'lucide-react';
import { wsManager } from '../api.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',   Icon: LayoutDashboard },
  { id: 'recognize', label: 'Live Feed',   Icon: Activity },
  { id: 'register',  label: 'Register',    Icon: UserPlus },
  { id: 'logs',      label: 'Access Logs', Icon: ClipboardList },
  { id: 'users',     label: 'Users',       Icon: Users },
  { id: 'alerts',    label: 'Alerts',      Icon: Bell },
];

export default function Sidebar({ active, onNavigate, alertCount = 0, wsConnected, systemStatus, onLogout }) {
  const workerEnabled = systemStatus?.worker_enabled ?? false;
  const motionEnabled = systemStatus?.motion_enabled ?? true;
  const autoStarted   = useRef(false);   // only auto-start once per session

  // Auto-start recognition as soon as WS connects — no button click needed
  useEffect(() => {
    if (wsConnected && !workerEnabled && !autoStarted.current) {
      autoStarted.current = true;
      wsManager.send('toggle_recognition', true);
    }
  }, [wsConnected, workerEnabled]);

  const toggleRecognition = () => wsManager.send('toggle_recognition', !workerEnabled);
  const toggleMotion      = () => wsManager.send('toggle_motion',      !motionEnabled);

  return (
    <aside style={{
      display: 'flex', flexDirection: 'column', width: 220, flexShrink: 0,
      height: '100%', borderRight: '1px solid var(--border)',
      background: 'var(--panel)', zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-pulse-slow" style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'var(--accent)', opacity: 0.2 }} />
          <Eye size={16} style={{ color: 'var(--accent-b)', position: 'relative', zIndex: 1 }} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)', letterSpacing: '0.04em' }}>ArcFace</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>Production v2.0</div>
        </div>
      </div>

      {/* Stream status */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="d-flex align-items-center gap-2" style={{ fontSize: 11 }}>
          <span className={`pulse-dot ${wsConnected ? 'green' : 'red'}`} />
          <span style={{ color: 'var(--dim)' }}>
            {wsConnected ? 'Stream connected' : 'Reconnecting...'}
          </span>
        </div>
        {systemStatus && (
          <div className="mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>
            {systemStatus.cached_users ?? 0} users · {systemStatus.fps ?? 0} fps
          </div>
        )}
      </div>

      {/* ── Single recognition control block ── */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={toggleRecognition}
          disabled={!wsConnected}
          className={workerEnabled ? 'btn-danger' : 'btn-primary'}
          style={{ fontSize: 12, padding: '8px 12px', width: '100%', justifyContent: 'center', gap: 6 }}>
          {workerEnabled
            ? <><Pause size={12}/> Pause Recognition</>
            : <><Play  size={12}/> Start Recognition</>}
        </button>

        <button
          onClick={toggleMotion}
          disabled={!wsConnected}
          className="btn-ghost"
          style={{
            fontSize: 11, padding: '5px 12px', width: '100%',
            justifyContent: 'center', gap: 6,
            color:       motionEnabled ? 'var(--neon)' : 'var(--dim)',
            borderColor: motionEnabled ? 'rgba(34,211,238,0.3)' : undefined,
          }}>
          <Activity size={11}/>
          Motion Gate: {motionEnabled ? 'ON' : 'OFF'}
        </button>

        {/* Status indicator row */}
        <div className="d-flex align-items-center justify-content-between" style={{ fontSize: 10, color: 'var(--dim)', paddingTop: 2 }}>
          <span className="mono">
            {workerEnabled ? 'Recognition running' : 'Recognition paused'}
          </span>
          <span className={`pulse-dot ${workerEnabled ? 'green' : 'red'}`} style={{ width: 6, height: 6 }} />
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button key={id} onClick={() => onNavigate(id)}
              className={`nav-btn${isActive ? ' active' : ''}`}>
              <span className="nav-active-bar" />
              <Icon size={15} style={{ color: isActive ? 'var(--accent)' : 'inherit', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{label}</span>
              {id === 'alerts' && alertCount > 0 && (
                <span className="badge-denied mono" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999 }}>
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="d-flex align-items-center gap-2 mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
          <Zap size={10} style={{ color: 'var(--accent)' }} />
          ArcFace R100 · InsightFace
        </div>
        <button onClick={onLogout} className="btn-ghost d-flex align-items-center gap-2"
          style={{ fontSize: 11, padding: '6px 10px', width: '100%' }}>
          <LogOut size={12}/> Sign Out
        </button>
      </div>
    </aside>
  );
}