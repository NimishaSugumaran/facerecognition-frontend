/**
 * Login.jsx — JWT auth login page
 */
import React, { useState } from 'react';
import { Eye, Lock, User } from 'lucide-react';
import { login } from '../api.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await login(username, password);
      onLogin();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--void)', position: 'relative',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.04) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="card fade-in" style={{ width: '100%', maxWidth: 380, padding: 36, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div className="d-flex align-items-center gap-3 mb-4" style={{ justifyContent: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Eye size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', letterSpacing: '0.03em' }}>ArcFace OS</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>Recognition System v2.0</div>
          </div>
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)', textAlign: 'center', marginBottom: 24 }}>
          Admin Login
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>Username</label>
            <div style={{ position: 'relative' }}>
              <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)' }} />
              <input className="input-field" style={{ paddingLeft: 34 }}
                type="text" placeholder="admin" value={username}
                onChange={e => setUsername(e.target.value)} required />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)' }} />
              <input className="input-field" style={{ paddingLeft: 34 }}
                type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', fontSize: 13 }}>
              ⚠ {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-100 d-flex align-items-center justify-content-center gap-2" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Authenticating…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--dim)', marginTop: 20, marginBottom: 0 }}>
          Default: <span className="mono">admin / admin123</span> — change in .env
        </p>
      </div>
    </div>
  );
}