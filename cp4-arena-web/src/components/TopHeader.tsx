import { Download, Gamepad2, LogOut, Share2, ShieldCheck, UserCog } from 'lucide-react';
import type { AdminAccount, PlayerProfile, Tournament } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

export function DiscordLogoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

interface TopHeaderProps {
  currentAdmin: AdminAccount | null;
  discordProfile: PlayerProfile | null;
  tournaments: Tournament[];
  activeTournamentId: number | null;
  onSelectTournament: (id: number) => void;
  onOpenAdmin: () => void;
  onOpenExportShare: () => void;
  onOpenInstallPwa: () => void;
  onStartDiscordLogin: () => void;
  onLogoutDiscord: () => void;
  canShowInstall: boolean;
}

export function TopHeader({
  currentAdmin,
  discordProfile,
  tournaments,
  activeTournamentId,
  onSelectTournament,
  onOpenAdmin,
  onOpenExportShare,
  onOpenInstallPwa,
  onStartDiscordLogin,
  onLogoutDiscord,
  canShowInstall
}: TopHeaderProps) {
  return (
    <header className="top-header">
      <div className="top-header-inner">
        <div className="brand-group">
          <img
            src="/images/community-logo.jpg"
            alt="شعار CP4 ARENA"
            className="brand-logo"
          />
          <div style={{ minWidth: 0 }}>
            <h1 className="brand-title">CP4 ARENA</h1>
            <p className="brand-subtitle">COMMUNITY PS4 &amp; GAMING ONLINE</p>
          </div>
        </div>

        <div className="header-actions">
          {discordProfile ? (
            <div
              data-testid="header_discord_badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                borderRadius: 12,
                background: 'rgba(88, 101, 242, 0.2)',
                border: '1px solid rgba(129, 140, 248, 0.55)',
                maxWidth: 185
              }}
            >
              <PlayerAvatar avatarUrl={discordProfile.avatarUrl} name={discordProfile.name} size={26} />
              <div style={{ minWidth: 0, lineHeight: 1.15 }}>
                <div
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {discordProfile.name}
                </div>
                <div className="score-num" style={{ fontSize: '0.64rem', color: 'var(--cyber-sky)' }}>
                  {discordProfile.cp4Id}
                </div>
              </div>
              <button
                type="button"
                onClick={onLogoutDiscord}
                title="تسجيل الخروج من Discord"
                aria-label="تسجيل الخروج من Discord"
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onStartDiscordLogin}
              className="btn"
              data-testid="header_discord_login_btn"
              title="تسجيل الدخول عبر Discord"
              style={{
                minHeight: 40,
                padding: '6px 11px',
                fontSize: '0.78rem',
                borderRadius: 12,
                background: 'rgba(88, 101, 242, 0.22)',
                borderColor: '#5865F2',
                color: '#E0E7FF'
              }}
            >
              <DiscordLogoIcon size={16} />
              <span>تسجيل الدخول عبر Discord</span>
            </button>
          )}

          {canShowInstall && (
            <button
              type="button"
              className="icon-btn"
              onClick={onOpenInstallPwa}
              title="تثبيت التطبيق على الشاشة الرئيسية"
              aria-label="تثبيت CP4 ARENA على الشاشة الرئيسية"
              style={{
                borderColor: 'rgba(245, 184, 46, 0.45)',
                color: 'var(--championship-gold)'
              }}
            >
              <Download size={18} />
            </button>
          )}

          <button
            type="button"
            className="icon-btn"
            onClick={onOpenExportShare}
            title="تصدير ومشاركة النتائج"
            aria-label="تصدير ومشاركة نتائج البطولة"
            style={{ color: 'var(--cyber-sky)' }}
          >
            <Share2 size={18} />
          </button>

          <button
            type="button"
            onClick={onOpenAdmin}
            className="btn"
            style={{
              minHeight: 40,
              padding: '6px 12px',
              fontSize: '0.8rem',
              borderRadius: 12,
              background: currentAdmin ? 'rgba(245, 184, 46, 0.16)' : 'rgba(37, 99, 235, 0.2)',
              borderColor: currentAdmin ? 'var(--championship-gold)' : 'var(--electric-cobalt)',
              color: currentAdmin ? 'var(--championship-gold)' : 'var(--text-primary)'
            }}
          >
            {currentAdmin ? <ShieldCheck size={16} /> : <UserCog size={16} />}
            <span>{currentAdmin ? currentAdmin.displayName : 'الإدارة'}</span>
          </button>
        </div>
      </div>

      {tournaments.length > 0 && (
        <div className="tournament-ribbon">
          <div className="tournament-ribbon-inner">
            {tournaments.map((t) => {
              const selected = t.id === activeTournamentId;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`tournament-pill ${selected ? 'active' : ''}`}
                  onClick={() => onSelectTournament(t.id)}
                >
                  <Gamepad2 size={14} color={selected ? 'var(--championship-gold)' : 'var(--cyber-sky)'} />
                  <span>{t.name}</span>
                  <span className="tournament-game-tag">{t.gameTitle}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
