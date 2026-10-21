/**
 * Alerts.jsx — Unknown person alerts with live WS feed
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, AlertTriangle, RefreshCw, Clock, Target } from 'lucide-react';
import { getAlerts } from '../api.js';
import { useWebSocket } from '../hooks/useWebSocket.js';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
}

export default function Alerts() {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setAlerts((await getAlerts(50)).alerts); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { const id = setInterval(fetch, 30000); return () => clearInterval(id); }, [fetch]);

  // Live prepend from WS
  useWebSocket('unknown_detected', (ev) => {
    setAlerts(prev => [{
      _id: Date.now(),
      timestamp: ev.timestamp,
      best_similarity: ev.similarity,
      message: ev.message || 'Unknown person attempted access',
    }, ...prev].slice(0, 50));
  });

  return (
    <div style={{ flex:1, overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:20 }}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text)', margin:0 }}>Security Alerts</h1>
          <p style={{ fontSize:13, color:'var(--dim)', margin:'4px 0 0' }}>Unknown person detections · live via WebSocket</p>
        </div>
        <button onClick={fetch} disabled={loading} className="btn-ghost d-flex align-items-center gap-2" style={{ fontSize:12 }}>
          <RefreshCw size={12} className={loading?'animate-spin':''}/> Refresh
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="card d-flex align-items-center gap-3 p-3" style={{ border:'1px solid rgba(245,158,11,0.25)', background:'rgba(245,158,11,0.05)' }}>
          <AlertTriangle size={18} style={{ color:'var(--warn)', flexShrink:0 }}/>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--warn)', margin:0 }}>
              {alerts.length} unidentified attempt{alerts.length!==1?'s':''} detected
            </p>
            <p style={{ fontSize:12, color:'var(--dim)', margin:'2px 0 0' }}>
              Snapshots saved to <span className="mono">unknown_alerts/</span>
            </p>
          </div>
        </div>
      )}

      {error && <div className="card" style={{ padding:14, color:'var(--danger)', border:'1px solid rgba(239,68,68,0.3)', fontSize:13 }}>⚠ {error}</div>}

      {loading && alerts.length===0 ? (
        <div className="d-flex flex-column gap-3">{Array.from({length:4}).map((_,i)=><div key={i} className="card animate-pulse" style={{ height:80, background:'var(--surface)'}}/>)}</div>
      ) : alerts.length===0 ? (
        <div className="card p-5 text-center">
          <div style={{ width:52, height:52, borderRadius:'50%', margin:'0 auto 14px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Bell size={22} style={{ color:'var(--success)' }}/>
          </div>
          <p style={{ fontWeight:600, color:'var(--text)', margin:0 }}>No alerts</p>
          <p style={{ fontSize:13, color:'var(--dim)', margin:'4px 0 0' }}>All attempts identified</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {alerts.map((a,i)=>(
            <div key={a._id||i} className="card p-4 fade-in"
              style={{ border:'1px solid rgba(245,158,11,0.15)', transition:'border-color 0.2s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(245,158,11,0.3)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(245,158,11,0.15)'}>
              <div className="d-flex align-items-start gap-3">
                <div style={{ width:38, height:38, borderRadius:8, flexShrink:0, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <AlertTriangle size={16} style={{ color:'var(--warn)' }}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span style={{ fontWeight:600, fontSize:13, color:'var(--warn)' }}>Unknown Person</span>
                    <span className="badge-unknown mono" style={{ fontSize:10, padding:'2px 7px', borderRadius:999 }}>ALERT</span>
                  </div>
                  <p style={{ fontSize:12, color:'var(--dim)', margin:'4px 0 0' }}>{a.message}</p>
                  <div className="d-flex flex-wrap gap-3 mt-2">
                    <div className="d-flex align-items-center gap-1 mono" style={{ fontSize:11, color:'var(--dim)' }}>
                      <Clock size={10}/>{fmt(a.timestamp)}
                    </div>
                    {a.best_similarity!=null && (
                      <div className="d-flex align-items-center gap-1 mono" style={{ fontSize:11, color:'var(--dim)' }}>
                        <Target size={10}/>Best match: {(a.best_similarity*100).toFixed(1)}% (threshold 45%)
                      </div>
                    )}
                  </div>
                  {a.image_path && (
                    <div style={{ marginTop:8 }}>
                      <span className="mono" style={{ fontSize:11, color:'var(--dim)', background:'var(--surface)', padding:'2px 8px', borderRadius:4 }}>📁 {a.image_path}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}