/**
 * Users.jsx — User management with simple inline delete confirmation
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Users as UsersIcon, Trash2, RefreshCw, Shield, User, Calendar, Database, X, Check } from 'lucide-react';
import { getUsers, deleteUser } from '../api.js';
import { useWebSocket } from '../hooks/useWebSocket.js';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Users() {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [confirm,  setConfirm]  = useState(null);   // user_id waiting confirmation
  const [deleting, setDeleting] = useState(null);   // user_id being deleted

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getUsers();
      setUsers(data.users);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useWebSocket('user_registered', (ev) => {
    setUsers(prev => [...prev, {
      user_id: ev.user_id, name: ev.name,
      role: ev.role, created_at: ev.timestamp,
    }]);
  });
  useWebSocket('user_deleted', (ev) => {
    setUsers(prev => prev.filter(u => u.user_id !== ev.user_id));
  });

  // Step 1: first click — show inline confirm
  const handleDeleteClick = (uid) => {
    setConfirm(uid);
  };

  // Step 2: confirmed — actually delete
  const handleConfirm = async (uid) => {
    setDeleting(uid);
    setConfirm(null);
    try {
      await deleteUser(uid);
      setUsers(prev => prev.filter(u => u.user_id !== uid));
    } catch (e) {
      setError(`Delete failed: ${e.message}`);
    } finally {
      setDeleting(null);
    }
  };

  // Cancel
  const handleCancel = () => setConfirm(null);

  const admins = users.filter(u => u.role === 'admin').length;
  const guests = users.filter(u => u.role === 'guest').length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>User Management</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', margin: '4px 0 0' }}>Registered faces</p>
        </div>
        <button onClick={fetchUsers} disabled={loading} className="btn-ghost d-flex align-items-center gap-2" style={{ fontSize: 12 }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="row g-3">
        {[
          { v: users.length, l: 'Total',  I: UsersIcon, c: 'var(--text)' },
          { v: admins,       l: 'Admins', I: Shield,    c: 'var(--accent-b)' },
          { v: guests,       l: 'Guests', I: User,      c: 'var(--neon)' },
        ].map(({ v, l, I, c }) => (
          <div key={l} className="col-4">
            <div className="card p-3 text-center">
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
              <div className="d-flex align-items-center justify-content-center gap-1 mt-1" style={{ fontSize: 12, color: 'var(--dim)' }}>
                <I size={11} /> {l}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="card d-flex align-items-center justify-content-between" style={{ padding: '12px 16px', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* User grid */}
      {loading && users.length === 0 ? (
        <div className="row g-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="col-12 col-sm-6 col-lg-4">
              <div className="card animate-pulse" style={{ height: 180, background: 'var(--surface)' }} />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="card p-5 text-center">
          <UsersIcon size={32} style={{ color: 'var(--dim)', margin: '0 auto 12px', display: 'block' }} />
          <p style={{ color: 'var(--dim)', margin: 0 }}>No users registered yet.</p>
          <p style={{ color: 'var(--dim)', fontSize: 13, margin: '4px 0 0' }}>Go to Register to add the first user.</p>
        </div>
      ) : (
        <div className="row g-3">
          {users.map((u) => {
            const isConfirming = confirm  === u.user_id;
            const isDeleting   = deleting === u.user_id;

            return (
              <div key={u.user_id} className="col-12 col-sm-6 col-lg-4">
                <div className="card p-4 fade-in d-flex flex-column gap-3"
                  style={{ height: '100%', transition: 'border-color 0.2s' }}>

                  {/* Top row — name + delete control */}
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    {/* Avatar + name */}
                    <div className="d-flex align-items-center gap-2">
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: u.role === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(34,211,238,0.1)',
                        border:     u.role === 'admin' ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(34,211,238,0.25)',
                      }}>
                        {u.role === 'admin'
                          ? <Shield size={14} style={{ color: 'var(--accent)' }} />
                          : <User   size={14} style={{ color: 'var(--neon)' }} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{u.name}</div>
                        <span className={u.role === 'admin' ? 'badge-admin' : 'badge-guest'}
                          style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, display: 'inline-block', marginTop: 2 }}>
                          {u.role}
                        </span>
                      </div>
                    </div>

                    {/* Delete button — single trash icon, no overlay tricks */}
                    {!isConfirming && !isDeleting && (
                      <button
                        onClick={() => handleDeleteClick(u.user_id)}
                        className="btn-danger"
                        style={{ flexShrink: 0, fontSize: 11, padding: '5px 10px' }}
                        title="Delete user"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}

                    {/* Spinner while deleting */}
                    {isDeleting && (
                      <div style={{ flexShrink: 0, padding: '5px 10px' }}>
                        <RefreshCw size={13} className="animate-spin" style={{ color: 'var(--danger)' }} />
                      </div>
                    )}
                  </div>

                  {/* ── Inline confirm panel — appears inside the card, no overlays ── */}
                  {isConfirming && (
                    <div style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.35)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>
                        Delete <span style={{ color: 'var(--text)' }}>{u.name}</span>?
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--dim)', lineHeight: 1.4 }}>
                        This removes all face embeddings and cannot be undone.
                      </p>
                      <div className="d-flex gap-2">
                        <button
                          onClick={() => handleConfirm(u.user_id)}
                          style={{
                            flex: 1,
                            background: 'var(--danger)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '7px 0',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                            fontFamily: 'Syne, sans-serif',
                          }}
                        >
                          <Check size={13} /> Yes, Delete
                        </button>
                        <button
                          onClick={handleCancel}
                          style={{
                            flex: 1,
                            background: 'transparent',
                            color: 'var(--dim)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: '7px 0',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                            fontFamily: 'Syne, sans-serif',
                          }}
                        >
                          <X size={13} /> Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Details */}
                  <div className="d-flex flex-column gap-1" style={{ fontSize: 11, color: 'var(--dim)' }}>
                    <div className="d-flex align-items-center gap-1">
                      <Database size={10} />
                      <span className="mono">{u.frame_count || '?'} embeddings</span>
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      <Calendar size={10} />
                      <span className="mono">{fmt(u.created_at)}</span>
                    </div>
                  </div>

                  {/* User ID */}
                  <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <p className="mono" title={u.user_id}
                      style={{ fontSize: 10, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                      {u.user_id}
                    </p>
                  </div>

                  {/* Access policy */}
                  <div style={{
                    fontSize: 11, borderRadius: 8, padding: '5px 10px',
                    background: u.role === 'admin' ? 'rgba(99,102,241,0.08)' : 'rgba(34,211,238,0.08)',
                    color:      u.role === 'admin' ? 'var(--accent-b)' : 'var(--neon)',
                  }}>
                    {u.role === 'admin' ? '24/7 unrestricted access' : 'Access: 09:00 - 18:00 only'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}