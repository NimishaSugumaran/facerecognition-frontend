/**
 * Recognize.jsx — Real-time WebSocket feed + Arduino state machine panel
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, User, Shield, Zap,
  Wifi, WifiOff, DoorOpen, DoorClosed, Radio,
  Clock, Cpu,
} from 'lucide-react';
import { useWebSocket, useSendWS } from '../hooks/useWebSocket.js';

// ── Colour maps ───────────────────────────────────────────────────────────────
const RESULT_COLORS = {
  granted:  { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#10b981' },
  denied:   { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#ef4444' },
  unknown:  { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#f59e0b' },
  scanning: { bg: 'rgba(99,102,241,0.1)',  border: '#6366f1', text: '#818cf8' },
};

const ARDUINO_STATE_CFG = {
  IDLE:        { label: 'Idle',        color: 'var(--dim)',      dot: 'yellow', Icon: DoorClosed },
  ARMED:       { label: 'Armed',       color: 'var(--warn)',     dot: 'yellow', Icon: Radio      },
  RECOGNIZING: { label: 'Recognizing', color: 'var(--accent-b)', dot: 'yellow', Icon: Cpu        },
  DOOR_OPEN:   { label: 'Door Open',   color: 'var(--success)',  dot: 'green',  Icon: DoorOpen   },
  COOLDOWN:    { label: 'Cooldown',    color: 'var(--neon)',     dot: 'yellow', Icon: Clock      },
};

const ARDUINO_EVENT_TYPES = new Set([
  'ultrasonic_triggered', 'motion_confirmed', 'door_opened',
  'door_closed', 'system_ready', 'trigger_timeout',
  'access_denied_reset', 'cooldown_active',
]);

const PIPELINE_STEPS = ['IDLE', 'ARMED', 'RECOGNIZING', 'DOOR_OPEN', 'COOLDOWN'];

export default function Recognize({ systemStatus }) {
  const canvasRef = useRef(null);
  const send      = useSendWS();

  const [latestFrame,   setLatestFrame]   = useState(null);
  const [latestEvent,   setLatestEvent]   = useState(null);
  const [wsConnected,   setWsConnected]   = useState(false);
  const [fps,           setFps]           = useState(0);
  const [eventLog,      setEventLog]      = useState([]);
  const [arduinoState,  setArduinoState]  = useState('IDLE');
  const [arduinoConn,   setArduinoConn]   = useState(false);
  const [doorTimer,     setDoorTimer]     = useState(null);
  const [cooldownTimer, setCooldownTimer] = useState(null);

  const workerEnabled = systemStatus?.worker_enabled ?? false;
  const motionEnabled = systemStatus?.motion_enabled ?? true;

  // helper to push into rolling event log
  const pushEvent = (ev, dot) => {
    setEventLog(prev => [{
      ...ev, _dot: dot,
      _time: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }),
    }, ...prev].slice(0, 12));
  };

  // ── WS subscriptions ───────────────────────────────────────────────────────
  useWebSocket('connected',    () => setWsConnected(true));
  useWebSocket('disconnected', () => setWsConnected(false));
  useWebSocket('frame', (d)   => { setLatestFrame(d.data); setFps(d.fps ?? 0); });

  useWebSocket('ultrasonic_triggered', (d) => { setArduinoState('ARMED');       pushEvent(d, 'yellow'); });
  useWebSocket('motion_confirmed',     (d) => { setArduinoState('RECOGNIZING'); pushEvent(d, 'yellow'); });
  useWebSocket('door_opened',          (d) => { setArduinoState('DOOR_OPEN');   pushEvent(d, 'green');  });
  useWebSocket('door_closed',          (d) => { setArduinoState('COOLDOWN');    pushEvent(d, 'yellow'); });
  useWebSocket('system_ready',         (d) => { setArduinoState('IDLE'); setCooldownTimer(null); pushEvent(d, 'green'); });
  useWebSocket('trigger_timeout',      (d) => { setArduinoState('IDLE'); setDoorTimer(null);     pushEvent(d, 'red');   });
  useWebSocket('access_denied_reset',  (d) => { setArduinoState('IDLE'); pushEvent(d, 'red');   });

  useWebSocket('system_status', (d) => {
    if (d.arduino) {
      setArduinoConn(d.arduino.connected ?? false);
      if (d.arduino.state) setArduinoState(d.arduino.state);
      setDoorTimer(d.arduino.door_open_remaining != null ? Math.ceil(d.arduino.door_open_remaining) : null);
      setCooldownTimer(d.arduino.cooldown_remaining  != null ? Math.ceil(d.arduino.cooldown_remaining)  : null);
    }
  });

  useWebSocket('*', (d) => {
    const ignore = new Set(['frame','pong','system_status','connected','disconnected',
      'no_motion','cooldown', ...ARDUINO_EVENT_TYPES]);
    if (!ignore.has(d.type)) {
      setLatestEvent(d);
      pushEvent(d, d.status === 'granted' ? 'green' : 'red');
    }
    if (d.type === 'cooldown') setLatestEvent(d);
  });

  // ── Canvas: draw frame + bounding box ─────────────────────────────────────
  useEffect(() => {
    if (!latestFrame || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const img    = new Image();
    img.onload = () => {
      canvas.width  = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      if (latestEvent?.bbox && !['no_motion','no_face'].includes(latestEvent.type)) {
        const [x1, y1, x2, y2] = latestEvent.bbox;
        const sx = canvas.width  / 640;
        const sy = canvas.height / 480;
        const bx = x1*sx, by = y1*sy, bw = (x2-x1)*sx, bh = (y2-y1)*sy;

        const color = latestEvent.status === 'granted' ? '#10b981'
                    : latestEvent.status === 'denied'  ? '#ef4444' : '#f59e0b';

        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

        const cs = 14; ctx.lineWidth = 3;
        [[bx,bw+bx,bx,bw+bx],[by,by,bh+by,bh+by]].reduce((acc,_,i,arr)=>{
          if (i===0) return [[arr[0][0],arr[1][0]],[arr[0][1],arr[1][1]],[arr[0][2],arr[1][2]],[arr[0][3],arr[1][3]]];
          return acc;
        }, null);
        [[bx,by,1,1],[bx+bw,by,-1,1],[bx,by+bh,1,-1],[bx+bw,by+bh,-1,-1]]
          .forEach(([px,py,dx,dy]) => {
            ctx.beginPath();
            ctx.moveTo(px+dx*cs, py); ctx.lineTo(px,py); ctx.lineTo(px, py+dy*cs);
            ctx.stroke();
          });

        if (latestEvent.name) {
          const label = `${latestEvent.name}  ${((latestEvent.similarity??0)*100).toFixed(0)}%`;
          ctx.font = 'bold 13px JetBrains Mono, monospace';
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(bx-1, by-24, tw+14, 22);
          ctx.fillStyle = color;
          ctx.fillText(label, bx+6, by-7);
        }
      }
    };
    img.src = `data:image/jpeg;base64,${latestFrame}`;
  }, [latestFrame, latestEvent]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const sc    = RESULT_COLORS[latestEvent?.status ?? 'scanning'] || RESULT_COLORS.scanning;
  const asCfg = ARDUINO_STATE_CFG[arduinoState] || ARDUINO_STATE_CFG.IDLE;
  const AsIcon = asCfg.Icon;
  const curStepIdx = PIPELINE_STEPS.indexOf(arduinoState);

  return (
    <div style={{ flex:1, overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text)', margin:0 }}>Live Recognition</h1>
          <p style={{ fontSize:13, color:'var(--dim)', margin:'4px 0 0' }}>
            ArcFace · WebSocket stream · Arduino door control
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-1 mono" style={{
            fontSize:11, padding:'4px 10px', borderRadius:999,
            background: wsConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border:`1px solid ${wsConnected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: wsConnected ? 'var(--success)' : 'var(--danger)',
          }}>
            {wsConnected ? <Wifi size={11}/> : <WifiOff size={11}/>}
            {wsConnected ? 'Stream Live' : 'Offline'}
          </div>
          <div className="mono" style={{
            fontSize:11, padding:'4px 10px', borderRadius:999,
            background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', color:'var(--accent-b)',
          }}>{fps} fps</div>
          <div className="d-flex align-items-center gap-1 mono" style={{
            fontSize:11, padding:'4px 10px', borderRadius:999,
            background: arduinoConn ? 'rgba(34,211,238,0.1)' : 'rgba(100,100,120,0.1)',
            border:`1px solid ${arduinoConn ? 'rgba(34,211,238,0.3)' : 'rgba(100,100,120,0.2)'}`,
            color: arduinoConn ? 'var(--neon)' : 'var(--dim)',
          }}>
            <Cpu size={11}/>
            Arduino {arduinoConn ? 'Connected' : 'Simulated'}
          </div>
        </div>
      </div>

      {/* Arduino pipeline state bar */}
      <div style={{
        display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
        padding:'10px 16px', borderRadius:10,
        background:'var(--panel)', border:'1px solid var(--border)',
      }}>
        <AsIcon size={15} style={{ color:asCfg.color, flexShrink:0 }}/>
        <span style={{ fontSize:13, fontWeight:700, color:asCfg.color }}>{asCfg.label}</span>
        <span className="mono" style={{ fontSize:10, color:'var(--dim)', marginRight:8 }}>({arduinoState})</span>
        {PIPELINE_STEPS.map((s, i) => {
          const active = i === curStepIdx;
          const past   = i < curStepIdx;
          return (
            <React.Fragment key={s}>
              {i > 0 && <div style={{ width:12, height:1, background: past||active ? 'var(--accent)' : 'var(--border)', flexShrink:0 }}/>}
              <div className="mono" style={{
                fontSize:9, padding:'2px 7px', borderRadius:5, fontWeight:600,
                background: active ? 'rgba(99,102,241,0.2)' : past ? 'rgba(99,102,241,0.06)' : 'var(--surface)',
                border:`1px solid ${active ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                color: active ? 'var(--accent-b)' : 'var(--dim)',
              }}>{s}</div>
            </React.Fragment>
          );
        })}
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          {doorTimer     != null && <span className="mono" style={{ fontSize:11, color:'var(--success)' }}>Door closes in {doorTimer}s</span>}
          {cooldownTimer != null && <span className="mono" style={{ fontSize:11, color:'var(--neon)'    }}>Cooldown {cooldownTimer}s</span>}
        </div>
      </div>

      <div className="row g-4">
        {/* Video */}
        <div className="col-12 col-lg-8 d-flex flex-column gap-3">
          <div style={{
            position:'relative', borderRadius:12, overflow:'hidden',
            background:'var(--void)', border:`2px solid ${sc.border}`,
            transition:'border-color 0.4s', aspectRatio:'4/3',
          }} className="camera-glow">
            <div className="corner-bracket" style={{ position:'absolute', inset:0, zIndex:10, pointerEvents:'none' }}><span/></div>
            <canvas ref={canvasRef} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transform:'scaleX(-1)' }}/>
            {workerEnabled && <div className="scan-line" style={{ zIndex:20 }}/>}

            {!latestFrame && (
              <div style={{ position:'absolute', inset:0, zIndex:25, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(5,5,8,0.95)', gap:12 }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Activity size={24} style={{ color:'var(--dim)' }}/>
                </div>
                <p style={{ color:'var(--dim)', fontSize:14, margin:0 }}>
                  {wsConnected ? 'Recognition will start automatically' : 'Connecting to stream...'}
                </p>
              </div>
            )}

            {/* Result overlay */}
            {latestEvent && !ARDUINO_EVENT_TYPES.has(latestEvent.type) && !['no_motion','system_status'].includes(latestEvent.type) && (
              <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:30, padding:'10px 16px', backdropFilter:'blur(10px)', background:sc.bg, borderTop:`1px solid ${sc.border}30` }}>
                <div className="d-flex align-items-center gap-2">
                  <span className={`pulse-dot ${latestEvent.status==='granted'?'green':latestEvent.status==='denied'?'red':'yellow'}`}/>
                  <span style={{ fontWeight:700, fontSize:14, color:sc.text }}>
                    {latestEvent.name||'Processing'} · {latestEvent.status?.toUpperCase()}
                  </span>
                  {latestEvent.similarity!=null && (
                    <span className="mono" style={{ fontSize:12, color:'var(--dim)', marginLeft:'auto' }}>
                      {(latestEvent.similarity*100).toFixed(1)}% match
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* LIVE badge */}
            {workerEnabled && latestFrame && (
              <div style={{ position:'absolute', top:12, right:12, zIndex:30, display:'flex', alignItems:'center', gap:5, background:'rgba(0,0,0,0.6)', borderRadius:999, padding:'4px 10px' }}>
                <span className="pulse-dot green" style={{ width:6, height:6 }}/>
                <span className="mono" style={{ fontSize:11, color:'var(--dim)' }}>LIVE · {fps}fps</span>
              </div>
            )}

            {/* Arduino state badge on video */}
            {arduinoState !== 'IDLE' && (
              <div style={{ position:'absolute', top:12, left:12, zIndex:30, display:'flex', alignItems:'center', gap:5, background:'rgba(0,0,0,0.7)', borderRadius:999, padding:'4px 10px', border:`1px solid ${asCfg.color}40` }}>
                <span className={`pulse-dot ${asCfg.dot}`} style={{ width:6, height:6 }}/>
                <span className="mono" style={{ fontSize:11, color:asCfg.color }}>{asCfg.label}</span>
              </div>
            )}
          </div>

          {/* Motion toggle — recognition on/off is controlled from Sidebar only */}
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <button onClick={() => send('toggle_motion', !motionEnabled)} disabled={!wsConnected}
              className="btn-ghost d-flex align-items-center gap-2"
              style={{ fontSize:12, color: motionEnabled ? 'var(--neon)' : 'var(--dim)' }}>
              <Activity size={12}/> Motion Gate: {motionEnabled ? 'ON' : 'OFF'}
            </button>
            <span style={{ fontSize:11, color:'var(--dim)' }}>
              Recognition is controlled from the sidebar
            </span>
          </div>
        </div>

        {/* Right panel */}
        <div className="col-12 col-lg-4 d-flex flex-column gap-3">

          {/* Door status */}
          <div className="card p-4">
            <h3 style={{ fontSize:11, color:'var(--dim)', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 12px' }}>Door Status</h3>
            <div className="d-flex align-items-center gap-3 mb-3">
              <div style={{
                width:44, height:44, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                background: arduinoState==='DOOR_OPEN' ? 'rgba(16,185,129,0.15)' : 'rgba(30,30,48,0.5)',
                border:`1px solid ${arduinoState==='DOOR_OPEN' ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
              }}>
                {arduinoState==='DOOR_OPEN'
                  ? <DoorOpen  size={22} style={{ color:'var(--success)' }}/>
                  : <DoorClosed size={22} style={{ color:'var(--dim)' }}/>}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color: arduinoState==='DOOR_OPEN' ? 'var(--success)' : 'var(--text)' }}>
                  {arduinoState==='DOOR_OPEN' ? 'UNLOCKED' : 'LOCKED'}
                </div>
                <div style={{ fontSize:12, color:'var(--dim)' }}>
                  {arduinoState==='DOOR_OPEN' && doorTimer!=null ? `Closes in ${doorTimer}s`
                    : arduinoState==='COOLDOWN' && cooldownTimer!=null ? `Cooldown: ${cooldownTimer}s`
                    : arduinoState==='ARMED' ? 'Person detected — scanning...'
                    : arduinoState==='RECOGNIZING' ? 'Running ArcFace...'
                    : 'Waiting for trigger'}
                </div>
              </div>
            </div>
            {(doorTimer!=null||cooldownTimer!=null) && (
              <div style={{ height:4, background:'var(--surface)', borderRadius:4, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:4, transition:'width 1s linear',
                  background: doorTimer!=null ? 'var(--success)' : 'var(--neon)',
                  width: doorTimer!=null ? `${(doorTimer/10)*100}%` : `${(cooldownTimer/10)*100}%`,
                }}/>
              </div>
            )}
            <div className="d-flex align-items-center gap-2 mt-3" style={{ fontSize:11, color:'var(--dim)' }}>
              <span className={`pulse-dot ${arduinoConn?'green':'yellow'}`} style={{ width:6, height:6 }}/>
              <span className="mono">{arduinoConn ? 'Arduino hardware connected' : 'Software simulation mode'}</span>
            </div>
          </div>

          {/* Last recognition */}
          <div className="card p-4">
            <h3 style={{ fontSize:11, color:'var(--dim)', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 12px' }}>Last Recognition</h3>
            {!latestEvent || ARDUINO_EVENT_TYPES.has(latestEvent.type) || latestEvent.type==='no_motion' ? (
              <div style={{ textAlign:'center', padding:'16px 0', color:'var(--dim)', fontSize:13 }}>
                <User size={22} style={{ marginBottom:6, color:'var(--dim)' }}/>
                <p style={{ margin:0 }}>Awaiting face detection...</p>
              </div>
            ) : (
              <div className="fade-in d-flex flex-column gap-2">
                <div className={latestEvent.status==='granted'?'badge-granted':latestEvent.status==='denied'?'badge-denied':'badge-unknown'}
                  style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:999, fontSize:11, fontWeight:700 }}>
                  <span className={`pulse-dot ${latestEvent.status==='granted'?'green':'red'}`} style={{ width:6, height:6 }}/>
                  {(latestEvent.status??'unknown').toUpperCase()}
                </div>
                {[[User,'Name',latestEvent.name||'—'],[Shield,'Role',latestEvent.role||'—'],
                  [Zap,'Similarity',latestEvent.similarity!=null?`${(latestEvent.similarity*100).toFixed(1)}%`:'—']
                ].map(([Icon,label,val])=>(
                  <div key={label} className="d-flex align-items-start gap-2 p-2 rounded" style={{ background:'var(--surface)' }}>
                    <Icon size={12} style={{ color:'var(--accent)', marginTop:2, flexShrink:0 }}/>
                    <div>
                      <div style={{ fontSize:10, color:'var(--dim)' }}>{label}</div>
                      <div className="mono" style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{val}</div>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize:11, color:'var(--dim)' }}>{latestEvent.message}</div>
              </div>
            )}
          </div>

          {/* Event stream */}
          <div className="card p-3 d-flex flex-column" style={{ gap:4 }}>
            <h3 style={{ fontSize:11, color:'var(--dim)', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 6px' }}>Event Stream</h3>
            {eventLog.length===0 ? (
              <div style={{ fontSize:12, color:'var(--dim)', textAlign:'center', padding:'10px 0' }}>No events yet</div>
            ) : eventLog.map((ev,i)=>(
              <div key={i} className="d-flex align-items-center gap-2 fade-in" style={{ padding:'4px 8px', borderRadius:6, background:'var(--surface)', fontSize:11 }}>
                <span className={`pulse-dot ${ev._dot||'yellow'}`} style={{ width:6, height:6, flexShrink:0 }}/>
                <span className="mono" style={{ color:'var(--text)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {ev.name||ev.type}
                </span>
                {ev.similarity!=null && <span style={{ color:'var(--dim)', fontSize:10, flexShrink:0 }}>{(ev.similarity*100).toFixed(0)}%</span>}
                <span style={{ color:'var(--dim)', fontSize:10, flexShrink:0 }}>{ev._time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}