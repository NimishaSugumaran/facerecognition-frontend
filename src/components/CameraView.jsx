/**
 * CameraView.jsx — Webcam display with scanning overlay and corner brackets
 */

import React from 'react';
import { Camera, CameraOff } from 'lucide-react';

export default function CameraView({
  videoRef, isActive, error, onStart, onStop,
  isScanning = false, overlayLabel, overlayStatus, compact = false,
}) {
  const height = compact ? 208 : 320;

  const borderColor =
    overlayStatus === 'granted' ? 'var(--success)' :
    overlayStatus === 'denied'  ? 'var(--danger)'  :
    overlayStatus === 'scanning'? 'var(--accent)'  : 'var(--border)';

  return (
    <div style={{
      position: 'relative', height, borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${borderColor}`, transition: 'border-color 0.5s',
      background: 'var(--void)',
    }} className="camera-glow">
      {/* Corner brackets */}
      <div className="corner-bracket" style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
        <span />
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
      />

      {/* Scan line */}
      {isActive && (isScanning || overlayStatus === 'scanning') && (
        <div className="scan-line" style={{ zIndex: 20 }} />
      )}

      {/* No camera placeholder */}
      {!isActive && !error && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, background: 'rgba(5,5,8,0.9)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Camera size={24} style={{ color: 'var(--dim)' }} />
          </div>
          <p style={{ color: 'var(--dim)', fontSize: 14, margin: 0 }}>Camera inactive</p>
          <button onClick={onStart} className="btn-primary" style={{ fontSize: 12, padding: '6px 16px' }}>
            Start Camera
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 8, background: 'rgba(5,5,8,0.9)', padding: '0 16px', textAlign: 'center',
        }}>
          <CameraOff size={28} style={{ color: 'var(--danger)' }} />
          <p style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 600, margin: 0 }}>Camera Error</p>
          <p style={{ color: 'var(--dim)', fontSize: 12, margin: 0 }}>{error}</p>
          <button onClick={onStart} className="btn-ghost" style={{ fontSize: 12, marginTop: 8 }}>Retry</button>
        </div>
      )}

      {/* Recognition result overlay */}
      {overlayLabel && overlayStatus && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
          padding: '10px 16px', backdropFilter: 'blur(8px)',
          borderTop: `1px solid ${
            overlayStatus === 'granted' ? 'rgba(16,185,129,0.25)' :
            overlayStatus === 'denied'  ? 'rgba(239,68,68,0.25)'  : 'rgba(99,102,241,0.25)'
          }`,
          background:
            overlayStatus === 'granted' ? 'rgba(234, 244, 241, 0.1)' :
            overlayStatus === 'denied'  ? 'rgba(239,68,68,0.1)'  : 'rgba(99,102,241,0.1)',
        }}>
          <div className="d-flex align-items-center gap-2">
            <span className={`pulse-dot ${
              overlayStatus === 'granted' ? 'green' :
              overlayStatus === 'denied'  ? 'red'   : 'yellow'
            }`} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{overlayLabel}</span>
          </div>
        </div>
      )}

      {/* LIVE indicator */}
      {isActive && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          borderRadius: 999, padding: '4px 10px',
        }}>
          <span className="pulse-dot green" style={{ width: 6, height: 6 }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>LIVE</span>
        </div>
      )}
    </div>
  );
}