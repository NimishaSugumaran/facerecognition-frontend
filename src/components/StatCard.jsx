/**
 * StatCard.jsx — Dashboard statistic card
 */

import React from 'react';

export default function StatCard({ label, value, Icon, color = 'accent', sublabel }) {
  const colorMap = {
    accent:  { bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.2)',  text: '#818cf8', icon: '#6366f1' },
    success: { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  text: '#10b981', icon: '#10b981' },
    danger:  { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   text: '#ef4444', icon: '#ef4444' },
    warn:    { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  text: '#f59e0b', icon: '#f59e0b' },
    neon:    { bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.2)',  text: '#22d3ee', icon: '#22d3ee' },
  };
  const c = colorMap[color] || colorMap.accent;

  return (
    <div className="card p-3 fade-in" style={{ transition: 'border-color 0.3s' }}>
      <div className="d-flex align-items-start justify-content-between mb-2">
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {label}
        </span>
        {Icon && (
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: c.bg, border: `1px solid ${c.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={16} style={{ color: c.icon }} />
          </div>
        )}
      </div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: c.text }}>
        {value ?? '—'}
      </div>
      {sublabel && (
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--dim)' }}>{sublabel}</div>
      )}
    </div>
  );
}