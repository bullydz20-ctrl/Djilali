import type { ReactNode } from 'react';

interface PlayerAvatarProps {
  avatarUrl: string | null | undefined;
  name: string;
  size?: number;
  borderColor?: string;
}

export function PlayerAvatar({
  avatarUrl,
  name,
  size = 44,
  borderColor = 'var(--electric-cobalt)'
}: PlayerAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '؟';
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1.5px solid ${borderColor}`,
        background: 'linear-gradient(135deg, rgba(37,99,235,0.35), rgba(124,58,237,0.45))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontWeight: 800, fontSize: Math.max(12, Math.round(size * 0.4)), color: 'var(--text-primary)' }}>
          {initial}
        </span>
      )}
    </div>
  );
}

export function StatusPill({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 11px',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 700,
        color,
        background: 'rgba(7, 9, 19, 0.86)',
        border: `1px solid ${color}`,
        whiteSpace: 'nowrap'
      }}
    >
      {text}
    </span>
  );
}

export function EmptyStatePanel({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="arena-card" style={{ textAlign: 'center', padding: '26px 18px' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          margin: '0 auto 12px',
          background: 'rgba(37, 99, 235, 0.16)',
          color: 'var(--cyber-sky)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {icon}
      </div>
      <div style={{ fontWeight: 700, fontSize: '1.02rem', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
        {subtitle}
      </div>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary" onClick={onAction} style={{ marginTop: 14 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
