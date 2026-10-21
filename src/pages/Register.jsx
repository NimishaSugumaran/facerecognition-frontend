/**
 * Register.jsx — User registration with webcam + JWT
 * Registration is fire-and-forget: form clears immediately,
 * completion is signalled by the WebSocket user_registered event.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Camera, Loader, UserPlus, Trash2, CheckCircle } from 'lucide-react';
import { useWebcam } from '../hooks/useWebcam.js';
import { registerUser } from '../api.js';
import { useWebSocket } from '../hooks/useWebSocket.js';

const TARGET = 15;

export default function Register() {
  const { videoRef, isActive, error: camError, startCamera, stopCamera, captureFrame } = useWebcam();
  const [name,          setName]          = useState('');
  const [role,          setRole]          = useState('guest');
  const [images,        setImages]        = useState([]);
  const [capturing,     setCapturing]     = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [status,        setStatus]        = useState(null);
  const [elapsed,       setElapsed]       = useState(0);
  const [pendingName,   setPendingName]   = useState(null);  // name being processed
  const timerRef = useRef(null);

  // Tick elapsed counter while submitting
  useEffect(() => {
    if (submitting) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [submitting]);

  // Listen for WS completion event from backend
  useWebSocket('user_registered', (ev) => {
    setSubmitting(false);
    setPendingName(null);
    setStatus({
      t: 'success',
      m: `Registered "${ev.name}" (${ev.role}) successfully. Ready to recognise.`,
    });
  });

  const autoCapture = useCallback(async () => {
    if (!isActive) await startCamera();
    setImages([]); setCapturing(true);
    setStatus({ t: 'info', m: `Capturing ${TARGET} frames - face the camera...` });
    const captured = [];
    for (let i = 0; i < TARGET; i++) {
      await new Promise(r => setTimeout(r, 400));
      const f = captureFrame();
      if (f) captured.push(f);
    }
    setImages(captured); setCapturing(false);
    setStatus({
      t: captured.length >= 5 ? 'ok' : 'warn',
      m: `Captured ${captured.length}. ${captured.length >= 5 ? 'Ready to register.' : 'Need at least 5.'}`,
    });
  }, [isActive, startCamera, captureFrame]);

  const handleSubmit = async () => {
    if (!name.trim()) { setStatus({ t: 'error', m: 'Name is required.' }); return; }
    if (images.length < 5) { setStatus({ t: 'error', m: 'Capture at least 5 images first.' }); return; }

    const submitName   = name.trim();
    const submitRole   = role;
    const submitImages = [...images];

    // Clear form immediately — user can do other things while server processes
    setName('');
    setImages([]);
    setSubmitting(true);
    setPendingName(submitName);
    setStatus({
      t: 'info',
      m: `Processing "${submitName}" in background — ArcFace embedding extraction running on server CPU (30-90s). You will be notified when done.`,
    });

    // Fire and forget — server notifies via WebSocket when complete
    registerUser(submitName, submitRole, submitImages).catch((e) => {
      setSubmitting(false);
      setPendingName(null);
      if (e.message.includes('timeout') || e.message.includes('Network Error')) {
        setStatus({
          t: 'warn',
          m: `Network timeout — but "${submitName}" was likely saved on the server. Check the Users page to confirm.`,
        });
      } else {
        setStatus({ t: 'error', m: e.message });
      }
    });
    // Success is handled by useWebSocket('user_registered') above
  };

  const SC = {
    info:    { bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)', color: 'var(--accent-b)' },
    ok:      { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)', color: 'var(--success)' },
    warn:    { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)', color: 'var(--warn)' },
    error:   { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',  color: 'var(--danger)' },
    success: { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)', color: 'var(--success)' },
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Register New User</h1>
        <p style={{ fontSize: 13, color: 'var(--dim)', margin: '4px 0 0' }}>Capture face images to train ArcFace embeddings</p>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-7 d-flex flex-column gap-3">
          {/* Camera preview */}
          <div style={{ position: 'relative', height: 300, borderRadius: 12, overflow: 'hidden', background: 'var(--void)', border: '1px solid var(--border)' }} className="camera-glow">
            <div className="corner-bracket" style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}><span /></div>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            {!isActive && !camError && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(5,5,8,0.92)' }}>
                <Camera size={28} style={{ color: 'var(--dim)' }} />
                <p style={{ color: 'var(--dim)', fontSize: 14, margin: 0 }}>Camera inactive</p>
                <button onClick={startCamera} className="btn-primary d-flex align-items-center gap-2"><Camera size={14} /> Open Camera</button>
              </div>
            )}
            {camError && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(5,5,8,0.92)', padding: 16, textAlign: 'center' }}>
                <p style={{ color: 'var(--danger)', fontWeight: 600, margin: 0 }}>Camera Error</p>
                <p style={{ color: 'var(--dim)', fontSize: 12, margin: 0 }}>{camError}</p>
                <button onClick={startCamera} className="btn-ghost" style={{ marginTop: 8, fontSize: 12 }}>Retry</button>
              </div>
            )}
            {isActive && <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 999, padding: '4px 10px' }}>
              <span className="pulse-dot green" style={{ width: 6, height: 6 }} /><span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>LIVE</span>
            </div>}
          </div>

          {/* Controls */}
          <div className="d-flex flex-wrap gap-2">
            {!isActive ? (
              <button onClick={startCamera} className="btn-primary d-flex align-items-center gap-2"><Camera size={14} /> Open Camera</button>
            ) : (
              <>
                <button onClick={autoCapture} disabled={capturing || submitting} className="btn-primary d-flex align-items-center gap-2">
                  {capturing ? <><Loader size={13} className="animate-spin" /> Capturing…</> : <><Camera size={13} /> Auto-Capture {TARGET} Frames</>}
                </button>
                <button onClick={() => { const f = captureFrame(); if (f && images.length < 20) setImages(p => [...p, f]); }}
                  disabled={capturing || submitting || images.length >= 20} className="btn-ghost" style={{ fontSize: 12 }}>
                  + One Shot
                </button>
                <button onClick={stopCamera} className="btn-ghost" style={{ fontSize: 12 }}>Disconnect</button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 0 && (
            <div className="card p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Frames ({images.length}/{TARGET})
                </span>
                <button onClick={() => setImages([])} className="btn-danger" style={{ fontSize: 11, padding: '2px 8px' }}>Clear</button>
              </div>
              <div style={{ height: 6, background: 'var(--surface)', borderRadius: 4, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 4, width: `${Math.min((images.length / TARGET) * 100, 100)}%`, transition: 'width 0.3s' }} />
              </div>
              <div className="d-flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} style={{ position: 'relative', width: 52, height: 52, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={img} alt={i} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => setImages(p => p.filter((_, j) => j !== i))}
                      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                      <Trash2 size={12} style={{ color: 'var(--danger)' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col-12 col-lg-5 d-flex flex-column gap-3">
          <div className="card p-4 d-flex flex-column gap-3">
            <h3 style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>User Details</h3>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>Full Name *</label>
              <input className="input-field" type="text" placeholder="e.g. John Smith" value={name} onChange={e => setName(e.target.value)} disabled={submitting} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>Role *</label>
              <div className="d-flex gap-2">
                {['admin', 'guest'].map(r => (
                  <label key={r} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, border: role === r ? (r === 'admin' ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(34,211,238,0.3)') : '1px solid var(--border)', background: role === r ? (r === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(34,211,238,0.1)') : 'transparent', color: role === r ? (r === 'admin' ? 'var(--accent-b)' : 'var(--neon)') : 'var(--dim)', transition: 'all 0.2s' }}>
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} style={{ display: 'none' }} />
                    {r === 'admin' ? '🛡 Admin' : '👤 Guest'}
                  </label>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6, marginBottom: 0 }}>
                {role === 'admin' ? '24/7 unrestricted access' : 'Access 09:00–18:00 only'}
              </p>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--dim)' }}>
              {[['Images', <span className="mono" style={{ color: images.length >= 5 ? 'var(--success)' : 'var(--warn)', fontWeight: 700 }}>{images.length}/{TARGET}</span>], ['Min required', <span className="mono">5</span>], ['Anti-spoof', <span className="mono" style={{ color: 'var(--accent)' }}>enabled</span>]].map(([k, v]) => (
                <div key={k} className="d-flex justify-content-between">{k}{v}</div>
              ))}
            </div>
            <button onClick={handleSubmit} disabled={submitting || images.length < 5 || !name.trim()}
              className="btn-primary w-100 d-flex align-items-center justify-content-center gap-2">
              {submitting
                ? <><Loader size={13} className="animate-spin"/> Processing "{pendingName}"... ({elapsed}s)</>
                : <><UserPlus size={13}/> Register User</>}
            </button>
          </div>

          {status && (
            <div className="card fade-in" style={{ padding: 14, fontSize: 13, lineHeight: 1.6, background: SC[status.t]?.bg, border: `1px solid ${SC[status.t]?.border}`, color: SC[status.t]?.color }}>
              {status.m}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}