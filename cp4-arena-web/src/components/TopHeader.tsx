import { Download, Gamepad2, Share2, ShieldCheck, UserCog } from 'lucide-react';
import type { AdminAccount, Tournament } from '../types';

interface TopHeaderProps {
  currentAdmin: AdminAccount | null;
  tournaments: Tournament[];
  activeTournamentId: number | null;
  onSelectTournament: (id: number) => void;
  onOpenAdmin: () => void;
  onOpenExportShare: () => void;
  onOpenInstallPwa: () => void;
  canShowInstall: boolean;
}

export function TopHeader({
  currentAdmin,
  tournaments,
  activeTournamentId,
  onSelectTournament,
  onOpenAdmin,
  onOpenExportShare,
  onOpenInstallPwa,
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
