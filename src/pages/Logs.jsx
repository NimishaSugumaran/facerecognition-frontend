/**
 * Logs.jsx
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { getLogs } from '../api.js';
import { useWebSocket } from '../hooks/useWebSocket.js';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
}

function StatusBadge({ status }) {
  return status === 'granted'
    ? <span className="badge-granted d-inline-flex align-items-center gap-1 mono" style={{ padding:'2px 8px', borderRadius:999, fontSize:11, fontWeight:600 }}><CheckCircle size={10}/> Granted</span>
    : <span className="badge-denied  d-inline-flex align-items-center gap-1 mono" style={{ padding:'2px 8px', borderRadius:999, fontSize:11, fontWeight:600 }}><XCircle   size={10}/> Denied</span>;
}

export default function Logs() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [search,  setSearch]  = useState('');
  const [sf,      setSf]      = useState('');
  const [limit,   setLimit]   = useState(50);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setLogs((await getLogs({ limit, status: sf, name: search })).logs); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [limit, sf, search]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { const id = setInterval(fetch, 20000); return () => clearInterval(id); }, [fetch]);

  // Prepend live events
  useWebSocket('*', (ev) => {
    if (['access_granted','access_denied','unknown_detected'].includes(ev.type)) {
      setLogs(prev => [{
        _id: Date.now(), name: ev.name || 'Unknown', role: ev.role || '',
        status: ev.status, similarity: ev.similarity, timestamp: ev.timestamp,
      }, ...prev].slice(0, limit));
    }
  });

  const granted = logs.filter(l => l.status === 'granted').length;
  const denied  = logs.filter(l => l.status === 'denied').length;

  return (
    <div style={{ flex:1, overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:20 }}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text)', margin:0 }}>Access Logs</h1>
          <p style={{ fontSize:13, color:'var(--dim)', margin:'4px 0 0' }}>Live-updated via WebSocket</p>
        </div>
        <button onClick={fetch} disabled={loading} className="btn-ghost d-flex align-items-center gap-2" style={{ fontSize:12 }}>
          <RefreshCw size={12} className={loading?'animate-spin':''}/> Refresh
        </button>
      </div>

      <div className="row g-3">
        {[{v:logs.length,l:'Shown',c:'var(--text)'},{v:granted,l:'Granted',c:'var(--success)'},{v:denied,l:'Denied',c:'var(--danger)'}].map(({v,l,c})=>(
          <div key={l} className="col-4">
            <div className="card p-3 text-center">
              <div className="mono" style={{ fontSize:20, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:12, color:'var(--dim)' }}>{l}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-3 d-flex flex-wrap align-items-center gap-3">
        <Filter size={13} style={{ color:'var(--dim)', flexShrink:0 }}/>
        <div style={{ position:'relative', flex:1, minWidth:140 }}>
          <Search size={12} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--dim)' }}/>
          <input className="input-field" style={{ paddingLeft:28, paddingTop:8, paddingBottom:8, fontSize:12 }} placeholder="Search name…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="input-field" style={{ width:140, paddingTop:8, paddingBottom:8, fontSize:12 }} value={sf} onChange={e=>setSf(e.target.value)}>
          <option value="">All statuses</option><option value="granted">Granted</option><option value="denied">Denied</option>
        </select>
        <select className="input-field" style={{ width:110, paddingTop:8, paddingBottom:8, fontSize:12 }} value={limit} onChange={e=>setLimit(Number(e.target.value))}>
          {[25,50,100,200].map(n=><option key={n} value={n}>Last {n}</option>)}
        </select>
      </div>

      {error && <div className="card" style={{ padding:14, color:'var(--danger)', border:'1px solid rgba(239,68,68,0.3)', fontSize:13 }}>⚠ {error}</div>}

      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['Name','Role','Status','Similarity','Timestamp'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, color:'var(--dim)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0
                ? Array.from({length:6}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:5}).map((__,j)=>(
                    <td key={j} style={{ padding:'10px 14px' }}><div className="animate-pulse" style={{ height:14, background:'var(--surface)', borderRadius:4 }}/></td>
                  ))}</tr>
                ))
                : logs.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign:'center', padding:'40px 0', color:'var(--dim)', fontSize:14 }}>No logs found</td></tr>
                  : logs.map((log,i)=>(
                    <tr key={log._id||i} className="fade-in" style={{ borderBottom:'1px solid rgba(30,30,48,0.4)', transition:'background 0.15s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'10px 14px', fontWeight:600, color:'var(--text)' }}>{log.name||'—'}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span className={log.role==='admin'?'badge-admin':'badge-guest'} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, display:'inline-block' }}>{log.role||'—'}</span>
                      </td>
                      <td style={{ padding:'10px 14px' }}><StatusBadge status={log.status}/></td>
                      <td className="mono" style={{ padding:'10px 14px', color:'var(--dim)', fontSize:12 }}>
                        {log.similarity!=null?`${(log.similarity*100).toFixed(1)}%`:'—'}
                      </td>
                      <td className="mono" style={{ padding:'10px 14px', color:'var(--dim)', fontSize:11, whiteSpace:'nowrap' }}>
                        <span className="d-flex align-items-center gap-1"><Clock size={10}/>{fmt(log.timestamp)}</span>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {logs.length>0 && (
          <div className="d-flex justify-content-between mono" style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', fontSize:11, color:'var(--dim)' }}>
            <span>{logs.length} records</span><span>Live via WebSocket · refreshes every 20s</span>
          </div>
        )}
      </div>
    </div>
  );
}