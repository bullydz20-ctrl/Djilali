import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  Gamepad2,
  GitBranch,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X
} from 'lucide-react';
import { hasAnyAdminAccess } from '../types';
import type { AdminAccount, PlayerProfile, Tournament } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

export function DiscordLogoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export type HeaderNavTab = 'HOME' | 'PLAYERS' | 'GROUPS' | 'BRACKET' | 'ADMIN';
export type HeaderUserMode = 'GUEST' | 'MEMBER' | 'ADMIN';

export interface HeaderViewState {
  mode: HeaderUserMode;
  canAccessAdmin: boolean;
  hasDiscordMember: boolean;
  showDiscordConnectCta: boolean;
  showAdminButton: boolean;
  showShareButton: boolean;
  showGuestWelcome: boolean;
}

export function resolveHeaderViewState({
  currentAdmin,
  discordProfile
}: {
  currentAdmin: AdminAccount | null;
  discordProfile: PlayerProfile | null;
}): HeaderViewState {
  const canAccessAdmin = hasAnyAdminAccess(currentAdmin);
  const hasDiscordMember = Boolean(discordProfile);
  const mode: HeaderUserMode = canAccessAdmin ? 'ADMIN' : hasDiscordMember ? 'MEMBER' : 'GUEST';

  return {
    mode,
    canAccessAdmin,
    hasDiscordMember,
    showDiscordConnectCta: !hasDiscordMember,
    showAdminButton: canAccessAdmin,
    showShareButton: hasDiscordMember || canAccessAdmin,
    showGuestWelcome: mode === 'GUEST'
  };
}

export interface TopHeaderProps {
  currentAdmin: AdminAccount | null;
  discordProfile: PlayerProfile | null;
  tournaments: Tournament[];
  activeTournamentId: number | null;
  activeTab?: HeaderNavTab;
  onSelectTournament: (id: number) => void;
  onNavigateTab?: (tab: HeaderNavTab) => void;
  onOpenAdmin: () => void;
  onLogoutAdmin?: () => void;
  onOpenExportShare: () => void;
  onOpenInstallPwa: () => void;
  onStartDiscordLogin: () => void;
  onLogoutDiscord: () => void;
  onOpenMyProfile?: () => void;
  onOpenAccountSettings?: () => void;
  canShowInstall: boolean;
  initialOpenMenu?: 'GUEST' | 'ACCOUNT' | null;
}

const GUEST_QUICK_TABS: Array<{ key: Exclude<HeaderNavTab, 'ADMIN'>; label: string; icon: React.ReactNode }> = [
  { key: 'HOME', label: 'الرئيسية', icon: <Home size={16} /> },
  { key: 'PLAYERS', label: 'المشاركون', icon: <Users size={16} /> },
  { key: 'GROUPS', label: 'المجموعات', icon: <LayoutGrid size={16} /> },
  { key: 'BRACKET', label: 'الإقصائيات', icon: <GitBranch size={16} /> }
];

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function TopHeader({
  currentAdmin,
  discordProfile,
  tournaments,
  activeTournamentId,
  activeTab = 'HOME',
  onSelectTournament,
  onNavigateTab,
  onOpenAdmin,
  onLogoutAdmin,
  onOpenExportShare,
  onOpenInstallPwa,
  onStartDiscordLogin,
  onLogoutDiscord,
  onOpenMyProfile,
  onOpenAccountSettings,
  canShowInstall,
  initialOpenMenu = null
}: TopHeaderProps) {
  const [openMenu, setOpenMenu] = useState<'GUEST' | 'ACCOUNT' | null>(initialOpenMenu);
  const [isScrolled, setIsScrolled] = useState(false);
  const [dropdownShiftX, setDropdownShiftX] = useState(0);
  const [dropdownMaxH, setDropdownMaxH] = useState<number | undefined>(undefined);

  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const viewState = resolveHeaderViewState({ currentAdmin, discordProfile });
  const hasActiveTournament = activeTournamentId != null || tournaments.length > 0;

  // Compact header smoothly on vertical scroll without covering page content
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const y = window.scrollY || 0;
      setIsScrolled((prev) => {
        if (!prev && y > 36) return true;
        if (prev && y < 12) return false;
        return prev;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menu if auth mode changes (e.g. login / logout)
  useEffect(() => {
    setOpenMenu(null);
  }, [viewState.mode, discordProfile?.id, currentAdmin?.id]);

  // Dismiss dropdown when clicking/tapping outside or pressing Escape
  useEffect(() => {
    if (!openMenu || typeof document === 'undefined') return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (menuContainerRef.current && target && !menuContainerRef.current.contains(target)) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  // Keep dropdown menus strictly inside viewport bounds across mobile & desktop screens
  useIsomorphicLayoutEffect(() => {
    if (!openMenu || typeof window === 'undefined') {
      setDropdownShiftX(0);
      setDropdownMaxH(undefined);
      return;
    }

    const clampToViewport = () => {
      const el = dropdownRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const safeMargin = 12;

      setDropdownShiftX((prevShift) => {
        const naturalLeft = rect.left - prevShift;
        const naturalRight = rect.right - prevShift;
        let nextShift = 0;
        if (naturalLeft < safeMargin) {
          nextShift = safeMargin - naturalLeft;
        } else if (naturalRight > vw - safeMargin) {
          nextShift = vw - safeMargin - naturalRight;
        }
        return Math.round(nextShift);
      });

      const availableHeight = Math.max(180, Math.floor(vh - rect.top - 16));
      setDropdownMaxH(availableHeight);
    };

    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [openMenu, viewState.mode]);

  const closeAndRun = (fn?: () => void) => {
    setOpenMenu(null);
    fn?.();
  };

  return (
    <header
      className={`top-header ${isScrolled ? 'is-scrolled' : ''}`}
      data-header-mode={viewState.mode}
      data-testid="cp4_top_header"
    >
      <div className="top-header-accent" aria-hidden="true" />
      <div className="top-header-inner">
        {/* Brand Identity + Optional Compact Guest Welcome */}
        <div className="brand-group">
          <img
            src="/images/community-logo.jpg"
            alt="شعار CP4 ARENA"
            className="brand-logo"
          />
          <div className="brand-copy">
            <div className="brand-title-row">
              <h1 className="brand-title">CP4 ARENA</h1>
              {viewState.showGuestWelcome && (
                <span className="brand-welcome" data-testid="header_guest_welcome">
                  <Sparkles size={11} aria-hidden="true" />
                  <span>أهلاً بك في ساحة البطولات</span>
                </span>
              )}
            </div>
            <p className="brand-subtitle">COMMUNITY PS4 &amp; GAMING ONLINE</p>
          </div>
        </div>

        {/* Dynamic User State Actions */}
        <div className="header-actions" ref={menuContainerRef}>
          {/* Admin-only Management Button (never rendered for Guest or normal Member) */}
          {viewState.showAdminButton && currentAdmin && (
            <button
              type="button"
              onClick={() => closeAndRun(onOpenAdmin)}
              className="header-admin-btn"
              data-testid="header_admin_btn"
              title="فتح لوحة الإدارة"
            >
              <ShieldCheck size={15} />
              <span>الإدارة</span>
            </button>
          )}

          {/* Compact Share Button (visible in header for Members & Admins, plus inside Guest menu on compact phones) */}
          {viewState.showShareButton && hasActiveTournament && (
            <button
              type="button"
              className="header-share-btn"
              onClick={() => closeAndRun(onOpenExportShare)}
              data-testid="header_share_btn"
              title="تصدير ومشاركة النتائج"
              aria-label="تصدير ومشاركة نتائج البطولة"
            >
              <Share2 size={15} />
              <span className="header-share-label">مشاركة</span>
            </button>
          )}

          {/* Member / Admin Account Card with Dropdown Menu */}
          {discordProfile ? (
            <div className="header-dropdown-anchor">
              <button
                type="button"
                className={`header-account-trigger ${openMenu === 'ACCOUNT' ? 'open' : ''}`}
                data-testid="header_account_trigger"
                aria-haspopup="menu"
                aria-expanded={openMenu === 'ACCOUNT'}
                onClick={() => setOpenMenu((prev) => (prev === 'ACCOUNT' ? null : 'ACCOUNT'))}
              >
                <div className="header-account-summary" data-testid="header_discord_badge">
                  <PlayerAvatar
                    avatarUrl={discordProfile.avatarUrl}
                    name={discordProfile.name}
                    size={isScrolled ? 26 : 30}
                    borderColor="var(--championship-gold)"
                  />
                  <div className="header-account-text">
                    <span className="header-account-name">{discordProfile.name}</span>
                    <span className="header-cp4-badge score-num" data-testid="header_cp4_id">
                      {discordProfile.cp4Id}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  size={15}
                  className={`header-account-chevron ${openMenu === 'ACCOUNT' ? 'rotated' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {openMenu === 'ACCOUNT' && (
                <div
                  ref={dropdownRef}
                  role="menu"
                  aria-label="قائمة الحساب"
                  className="header-dropdown-menu"
                  data-testid="header_account_menu"
                  style={{
                    transform: dropdownShiftX ? `translateX(${dropdownShiftX}px)` : undefined,
                    maxHeight: dropdownMaxH ? `${dropdownMaxH}px` : undefined
                  }}
                >
                  <div className="header-dropdown-profile-card">
                    <PlayerAvatar
                      avatarUrl={discordProfile.avatarUrl}
                      name={discordProfile.name}
                      size={38}
                      borderColor="var(--championship-gold)"
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="header-dropdown-profile-name">{discordProfile.name}</div>
                      <div className="header-dropdown-profile-meta">
                        <span className="score-num" style={{ color: 'var(--championship-gold)' }}>
                          {discordProfile.cp4Id}
                        </span>
                        <span className="header-verified-dot">• Discord موثق</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    className="header-dropdown-item"
                    data-testid="account_menu_profile"
                    onClick={() => closeAndRun(onOpenMyProfile)}
                  >
                    <User size={16} color="var(--cyber-sky)" />
                    <span>الملف الشخصي</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="header-dropdown-item"
                    data-testid="account_menu_settings"
                    onClick={() => closeAndRun(onOpenAccountSettings)}
                  >
                    <Settings size={16} color="var(--championship-gold)" />
                    <span>الإعدادات</span>
                  </button>

                  {canShowInstall && (
                    <button
                      type="button"
                      role="menuitem"
                      className="header-dropdown-item"
                      data-testid="account_menu_install"
                      onClick={() => closeAndRun(onOpenInstallPwa)}
                    >
                      <Download size={16} color="var(--championship-gold)" />
                      <span>تثبيت التطبيق</span>
                    </button>
                  )}

                  <div className="header-dropdown-divider" />

                  <button
                    type="button"
                    role="menuitem"
                    className="header-dropdown-item danger"
                    data-testid="account_menu_logout"
                    onClick={() => closeAndRun(onLogoutDiscord)}
                  >
                    <LogOut size={16} />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>
          ) : viewState.canAccessAdmin && currentAdmin ? (
            /* Authenticated Admin who has not linked a Discord player profile yet */
            <div className="header-dropdown-anchor">
              <button
                type="button"
                className={`header-account-trigger ${openMenu === 'ACCOUNT' ? 'open' : ''}`}
                data-testid="header_account_trigger"
                aria-haspopup="menu"
                aria-expanded={openMenu === 'ACCOUNT'}
                onClick={() => setOpenMenu((prev) => (prev === 'ACCOUNT' ? null : 'ACCOUNT'))}
              >
                <div className="header-account-summary">
                  <div className="header-admin-avatar" aria-hidden="true">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="header-account-text">
                    <span className="header-account-name">{currentAdmin.displayName}</span>
                    <span className="header-admin-role-tag">
                      {currentAdmin.role === 'HEAD_ADMIN' ? 'المشرف العام' : 'مشرف'}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  size={15}
                  className={`header-account-chevron ${openMenu === 'ACCOUNT' ? 'rotated' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {openMenu === 'ACCOUNT' && (
                <div
                  ref={dropdownRef}
                  role="menu"
                  aria-label="قائمة حساب المشرف"
                  className="header-dropdown-menu"
                  data-testid="header_account_menu"
                  style={{
                    transform: dropdownShiftX ? `translateX(${dropdownShiftX}px)` : undefined,
                    maxHeight: dropdownMaxH ? `${dropdownMaxH}px` : undefined
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="header-dropdown-item"
                    data-testid="account_menu_admin_panel"
                    onClick={() => closeAndRun(onOpenAdmin)}
                  >
                    <ShieldCheck size={16} color="var(--championship-gold)" />
                    <span>لوحة الإدارة</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="header-dropdown-item"
                    data-testid="header_discord_login_btn"
                    onClick={() => closeAndRun(onStartDiscordLogin)}
                  >
                    <DiscordLogoIcon size={16} />
                    <span>ربط حساب Discord</span>
                  </button>

                  {canShowInstall && (
                    <button
                      type="button"
                      role="menuitem"
                      className="header-dropdown-item"
                      data-testid="account_menu_install"
                      onClick={() => closeAndRun(onOpenInstallPwa)}
                    >
                      <Download size={16} color="var(--championship-gold)" />
                      <span>تثبيت التطبيق</span>
                    </button>
                  )}

                  {onLogoutAdmin && (
                    <>
                      <div className="header-dropdown-divider" />
                      <button
                        type="button"
                        role="menuitem"
                        className="header-dropdown-item danger"
                        data-testid="admin_menu_logout"
                        onClick={() => closeAndRun(onLogoutAdmin)}
                      >
                        <LogOut size={16} />
                        <span>تسجيل الخروج</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Guest (Unlinked Visitor): Clear Discord Connect CTA + Main Menu Button (NO CP4 ID, NO Admin, NO Logout) */
            <>
              <button
                type="button"
                onClick={() => closeAndRun(onStartDiscordLogin)}
                className="header-discord-cta"
                data-testid="header_discord_login_btn"
                title="ربط حساب Discord"
              >
                <DiscordLogoIcon size={16} />
                <span>ربط حساب Discord</span>
              </button>

              <div className="header-dropdown-anchor">
                <button
                  type="button"
                  className={`header-menu-btn ${openMenu === 'GUEST' ? 'open' : ''}`}
                  data-testid="header_main_menu_btn"
                  aria-haspopup="menu"
                  aria-expanded={openMenu === 'GUEST'}
                  aria-label="القائمة الرئيسية"
                  title="القائمة الرئيسية"
                  onClick={() => setOpenMenu((prev) => (prev === 'GUEST' ? null : 'GUEST'))}
                >
                  {openMenu === 'GUEST' ? <X size={18} /> : <Menu size={18} />}
                  <span className="header-menu-btn-label">القائمة</span>
                </button>

                {openMenu === 'GUEST' && (
                  <div
                    ref={dropdownRef}
                    role="menu"
                    aria-label="القائمة الرئيسية"
                    className="header-dropdown-menu"
                    data-testid="header_main_menu"
                    style={{
                      transform: dropdownShiftX ? `translateX(${dropdownShiftX}px)` : undefined,
                      maxHeight: dropdownMaxH ? `${dropdownMaxH}px` : undefined
                    }}
                  >
                    <div className="header-dropdown-guest-banner">
                      <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--championship-gold)' }}>
                        أهلاً بك في CP4 ARENA
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        تصفح البطولات والمواجهات بحرية، أو اربط Discord لتسريع التسجيل.
                      </div>
                    </div>

                    {onNavigateTab && (
                      <div className="header-dropdown-nav-group">
                        {GUEST_QUICK_TABS.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            role="menuitem"
                            className={`header-dropdown-item ${activeTab === item.key ? 'active' : ''}`}
                            data-testid={`guest_menu_nav_${item.key.toLowerCase()}`}
                            onClick={() => closeAndRun(() => onNavigateTab(item.key))}
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {hasActiveTournament && (
                      <button
                        type="button"
                        role="menuitem"
                        className="header-dropdown-item"
                        data-testid="guest_menu_share"
                        onClick={() => closeAndRun(onOpenExportShare)}
                      >
                        <Share2 size={16} color="var(--cyber-sky)" />
                        <span>مشاركة نتائج البطولة</span>
                      </button>
                    )}

                    {canShowInstall && (
                      <button
                        type="button"
                        role="menuitem"
                        className="header-dropdown-item"
                        data-testid="guest_menu_install"
                        onClick={() => closeAndRun(onOpenInstallPwa)}
                      >
                        <Download size={16} color="var(--championship-gold)" />
                        <span>تثبيت التطبيق</span>
                      </button>
                    )}

                    <div className="header-dropdown-divider" />

                    <button
                      type="button"
                      role="menuitem"
                      className="header-dropdown-item discord-accent"
                      data-testid="guest_menu_discord_connect"
                      onClick={() => closeAndRun(onStartDiscordLogin)}
                    >
                      <DiscordLogoIcon size={16} />
                      <span>ربط حساب Discord</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tournament & Game Switcher Bar (strictly separated below top bar to prevent any overlap) */}
      {tournaments.length > 0 && (
        <div className="tournament-ribbon" data-testid="header_tournament_ribbon">
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
