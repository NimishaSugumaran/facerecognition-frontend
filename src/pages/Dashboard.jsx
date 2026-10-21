/**
 * Dashboard.jsx — Real-time stats with WS live event feed
 */
import React, { useEffect, useState } from 'react';
import { Users, CheckCircle, XCircle, Bell, Calendar, Database, RefreshCw, Activity, Wifi } from 'lucide-react';
import { getStats, reloadCache } from '../api.js';
import { useWebSocket } from '../hooks/useWebSocket.js';

function StatCard({ label, value, Icon, color = 'accent', sublabel }) {
  const c = {
    accent:  { bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.2)',  text: '#818cf8', icon: '#6366f1' },
    success: { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  text: '#10b981', icon: '#10b981' },
    danger:  { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   text: '#ef4444', icon: '#ef4444' },
    warn:    { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  text: '#f59e0b', icon: '#f59e0b' },
    neon:    { bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.2)',  text: '#22d3ee', icon: '#22d3ee' },
  }[color] || {};
  return (
    <div className="card p-3 fade-in">
      <div className="d-flex align-items-start justify-content-between mb-2">
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
        {Icon && (
          <div style={{ width: 30, height: 30, borderRadius: 8, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={14} style={{ color: c.icon }} />
          </div>
        )}
      </div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: c.text }}>{value ?? '—'}</div>
      {sublabel && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>{sublabel}</div>}
    </div>
  );
}

export default function Dashboard({ systemStatus }) {
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [reloading, setReloading] = useState(false);
  const [liveLog,   setLiveLog]   = useState([]);   // rolling event feed

  const fetchStats = async () => {
    try { setError(null); setStats(await getStats()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 15000);
    return () => clearInterval(id);
  }, []);

  // Live event feed via WS — update stats counters in real-time
  useWebSocket('*', (ev) => {
    if (['access_granted', 'access_denied', 'unknown_detected'].includes(ev.type)) {
      setLiveLog(prev => [{
        name:   ev.name || 'Unknown',
        status: ev.status,
        sim:    ev.similarity,
        ts:     new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type:   ev.type,
      }, ...prev].slice(0, 10));
      // Optimistic counter bump
      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          total_logs: (prev.total_logs || 0) + 1,
          today_logs: (prev.today_logs || 0) + 1,
          granted: ev.status === 'granted' ? (prev.granted || 0) + 1 : prev.granted,
          denied:  ev.status === 'denied'  ? (prev.denied  || 0) + 1 : prev.denied,
          unknown_alerts: ev.type === 'unknown_detected' ? (prev.unknown_alerts || 0) + 1 : prev.unknown_alerts,
        };
      });
    }
  });

  const handleReload = async () => {
    setReloading(true);
    try { await reloadCache(); await fetchStats(); }
    catch (e) { setError(e.message); }
    finally { setReloading(false); }
  };

  const grantRate = stats && stats.total_logs > 0
    ? Math.round((stats.granted / stats.total_logs) * 100) : 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>System Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', margin: '4px 0 0' }}>Real-time access control overview</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {systemStatus?.worker_enabled && (
            <div className="d-flex align-items-center gap-1 mono" style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 999,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: 'var(--accent-b)',
            }}>
              <Activity size={11} /> {stats?.fps ?? 0} fps
            </div>
          )}
          <button onClick={handleReload} disabled={reloading} className="btn-ghost d-flex align-items-center gap-2" style={{ fontSize: 12 }}>
            <RefreshCw size={12} className={reloading ? 'animate-spin' : ''} />
            {reloading ? 'Reloading…' : 'Reload Cache'}
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ padding: 14, color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13 }}>⚠ {error}</div>}

      {/* Stats grid */}
      {loading ? (
        <div className="row g-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="col-6 col-lg-4">
              <div className="card animate-pulse" style={{ height: 100, background: 'var(--surface)' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="row g-3">
          {[
            { label: 'Total Users',       value: stats?.total_users,                        Icon: Users,       color: 'accent',  sub: `${stats?.cached_users} cached` },
            { label: 'Access Granted',    value: stats?.granted,                            Icon: CheckCircle, color: 'success', sub: 'All time' },
            { label: 'Access Denied',     value: stats?.denied,                             Icon: XCircle,     color: 'danger',  sub: 'All time' },
            { label: 'Unknown Alerts',    value: stats?.unknown_alerts,                     Icon: Bell,        color: 'warn',    sub: 'Unidentified attempts' },
            { label: "Today's Activity",  value: stats?.today_logs,                         Icon: Calendar,    color: 'neon',    sub: 'Attempts today' },
            { label: 'Grant Rate',        value: `${grantRate}%`,                           Icon: Database,    color: 'accent',  sub: `${stats?.total_logs} total` },
          ].map(({ label, value, Icon, color, sub }) => (
            <div key={label} className="col-6 col-lg-4">
              <StatCard label={label} value={value} Icon={Icon} color={color} sublabel={sub} />
            </div>
          ))}
        </div>
      )}

      <div className="row g-3">
        {/* Donut chart */}
        {stats && stats.total_logs > 0 && (
          <div className="col-12 col-lg-5">
            <div className="card p-4" style={{ height: '100%' }}>
              <h3 style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Access Breakdown</h3>
              <div className="d-flex align-items-center gap-4 flex-wrap">
                <svg width="110" height="110" viewBox="0 0 120 120">
                  {(() => {
                    const total = stats.granted + stats.denied;
                    const r = 48, cx = 60, cy = 60, circ = 2 * Math.PI * r;
                    const gp = total > 0 ? stats.granted / total : 0;
                    const gd = gp * circ;
                    const dd = (1 - gp) * circ;
                    return (<>
                      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e30" strokeWidth="14" />
                      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#10b981" strokeWidth="14"
                        strokeDasharray={`${gd} ${circ - gd}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
                      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef4444" strokeWidth="14"
                        strokeDasharray={`${dd} ${circ - dd}`} strokeDashoffset={-gd} strokeLinecap="round" transform="rotate(-90 60 60)" />
                      <text x={cx} y={cy - 4}  textAnchor="middle" fill="#e2e8f0" fontSize="17" fontWeight="bold" fontFamily="JetBrains Mono">{grantRate}%</text>
                      <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="Syne">grant rate</text>
                    </>);
                  })()}
                </svg>
                <div className="d-flex flex-column gap-2">
                  {[['var(--success)', 'Granted', stats.granted], ['var(--danger)', 'Denied', stats.denied], ['var(--warn)', 'Unknown', stats.unknown_alerts]].map(([clr, lbl, val]) => (
                    <div key={lbl} className="d-flex align-items-center gap-2">
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: clr, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--dim)' }}>{lbl}</span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: clr, marginLeft: 6 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live event feed */}
        <div className="col-12 col-lg-7">
          <div className="card p-4 d-flex flex-column" style={{ gap: 8, height: '100%' }}>
            <div className="d-flex align-items-center justify-content-between">
              <h3 style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Live Event Feed</h3>
              <div className="d-flex align-items-center gap-1 mono" style={{ fontSize: 10, color: 'var(--success)' }}>
                <Wifi size={10} /> WebSocket
              </div>
            </div>
            {liveLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--dim)', fontSize: 13 }}>
                Start recognition to see live events
              </div>
            ) : (
              liveLog.map((ev, i) => (
                <div key={i} className="d-flex align-items-center gap-3 fade-in" style={{
                  padding: '7px 10px', borderRadius: 8, background: 'var(--surface)', fontSize: 12,
                }}>
                  <span className={`pulse-dot ${ev.status === 'granted' ? 'green' : 'red'}`} style={{ width: 7, height: 7, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text)', fontWeight: 600, flex: 1 }}>{ev.name}</span>
                  <span className={ev.status === 'granted' ? 'badge-granted' : 'badge-denied'}
                    style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999 }}>{ev.status}</span>
                  {ev.sim != null && (
                    <span className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>{(ev.sim * 100).toFixed(0)}%</span>
                  )}
                  <span className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>{ev.ts}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* System info */}
      <div className="card p-4">
        <h3 style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>System Info</h3>
        <div className="row g-2">
          {[
            ['Model',          'InsightFace ArcFace R100'],
            ['Similarity',     'Cosine (threshold: 0.45)'],
            ['Anti-spoof',     'EAR blink + centroid movement'],
            ['Motion detect',  'Frame diff + OpenCV contours'],
            ['Stream',         'WebSocket /ws/live (15fps)'],
            ['Auth',           'JWT (24h expire)'],
            ['Worker',         systemStatus?.worker_enabled ? `Running · ${systemStatus.fps ?? 0}fps` : 'Paused'],
            ['WS clients',     `${stats?.ws_clients ?? 0} connected`],
          ].map(([k, v]) => (
            <div key={k} className="col-12 col-sm-6 d-flex gap-2" style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--dim)', width: 110, flexShrink: 0 }}>{k}</span>
              <span className="mono" style={{ color: 'var(--accent-b)', fontSize: 11, wordBreak: 'break-all' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}