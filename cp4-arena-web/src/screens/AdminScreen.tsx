import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  Dices,
  Download,
  HardDrive,
  History,
  KeyRound,
  LogOut,
  RotateCcw,
  Settings,
  Shield,
  Swords,
  Trophy,
  Upload,
  UserCog,
  Users
} from 'lucide-react';
import { getHeadAutoBackupSummary } from '../api';
import { EmptyStatePanel } from '../components/PlayerAvatar';
import { adminHasPermission, evaluatePinStrengthClient } from '../types';
import type { ArenaState, Match, PlayerLevel, PlayerProfile, PlayerStatus, RaceEntry, RaceStage } from '../types';
import { isRacingFormat } from '../components/RacingSection';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminFriendlyMatchesTab } from './AdminFriendlyMatchesTab';
import {
  AdminAuditLogTab,
  AdminChampionTab,
  AdminMatchesTab,
  AdminPlayersTab,
  AdminSubAdminsTab
} from './AdminPlayersStaffTabs';
import { AdminDrawTab, AdminTournamentSettingsTab } from './AdminTournamentDrawTabs';

type SectionKey =
  | 'TOURNAMENT'
  | 'PLAYERS'
  | 'DRAW'
  | 'MATCHES'
  | 'FRIENDLY_MATCHES'
  | 'SUB_ADMINS'
  | 'CHAMPION'
  | 'AUDIT';

export function AdminScreen({
  state,
  onSetupHead,
  onLogin,
  onLogout,
  onSaveTournament,
  onCreateFreshTournament,
  onDeleteTournament,
  onAdminAddPlayer,
  onBulkImport,
  onUpdatePlayerStatus,
  onUpdatePlayerDetails,
  onDeletePlayer,
  onRunDraw,
  onGenerateKnockout,
  onEditMatch,
  onQuickUpdateGoals,
  onAutoSchedule,
  onToggleCheckIn,
  onOpenDispute,
  onUpdateOwnProfile,
  onChangeOwnPin,
  onCreateSubAdmin,
  onUpdateSubAdmin,
  onDeleteSubAdmin,
  onCrownChampion,
  onOpenExportShare,
  onDownloadBackup,
  onRestoreBackup,
  onCreateRace,
  onEditRace,
  onGenerateFinalRace,
  onDeleteRace,
  onCreatePlayerProfile,
  onUpdatePlayerProfile,
  onMergePlayerProfiles,
  onLinkPlayerDiscord,
  onReviewFriendlyMatch,
  onNotify
}: {
  state: ArenaState;
  onSetupHead: (p: { username: string; displayName: string; pin: string; keepSignedIn: boolean }) => Promise<void>;
  onLogin: (p: { username: string; pin: string; keepSignedIn: boolean }) => Promise<void>;
  onLogout: () => Promise<void>;
  onSaveTournament: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onCreateFreshTournament: (payload: Record<string, unknown>) => Promise<void>;
  onDeleteTournament: (id: number) => Promise<void>;
  onAdminAddPlayer: (payload: {
    profileId?: number | null;
    name: string;
    elysiumNetId: string;
    xeMoNetId?: string;
    discordUserId?: string | null;
    avatarUrl: string | null;
    level: PlayerLevel;
    ovrRating: number;
    clubName: string;
    status: PlayerStatus;
  }) => Promise<void>;
  onBulkImport: (linesText: string, status: 'APPROVED' | 'PENDING') => Promise<void>;
  onUpdatePlayerStatus: (id: number, status: PlayerStatus) => Promise<void>;
  onUpdatePlayerDetails: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onDeletePlayer: (id: number) => Promise<void>;
  onRunDraw: (manualGroups: Record<number, number>, manualOrder: number[]) => Promise<void>;
  onGenerateKnockout: () => Promise<void>;
  onEditMatch: (m: Match) => void;
  onQuickUpdateGoals: (m: Match, g1: number, g2: number) => void;
  onAutoSchedule: (payload: { startAtMillis?: number; intervalMinutes?: number; onlyUnscheduled?: boolean }) => Promise<void>;
  onToggleCheckIn: (m: Match, slot: 1 | 2) => void;
  onOpenDispute: (m: Match) => void;
  onUpdateOwnProfile: (payload: { displayName: string; username?: string }) => Promise<void>;
  onChangeOwnPin: (currentPin: string, newPin: string) => Promise<void>;
  onCreateSubAdmin: (payload: {
    username: string;
    displayName: string;
    pin: string;
    canManageTournament: boolean;
    canManagePlayers: boolean;
    canRunDraw: boolean;
    canEditScores: boolean;
    canCrownChampion: boolean;
  }) => Promise<void>;
  onUpdateSubAdmin: (
    id: number,
    payload: {
      displayName: string;
      newPin?: string | null;
      isActive: boolean;
      canManageTournament: boolean;
      canManagePlayers: boolean;
      canRunDraw: boolean;
      canEditScores: boolean;
      canCrownChampion: boolean;
    }
  ) => Promise<void>;
  onDeleteSubAdmin: (id: number) => Promise<void>;
  onCrownChampion: (playerId: number | null) => Promise<void>;
  onOpenExportShare: () => void;
  onDownloadBackup: () => Promise<void>;
  onRestoreBackup: (backupData: unknown) => Promise<void>;
  onCreateRace?: (payload: { title?: string; stage?: RaceStage; trackName?: string }) => Promise<void>;
  onEditRace?: (race: RaceEntry) => void;
  onGenerateFinalRace?: (payload?: { title?: string; trackName?: string; qualifiersCount?: number }) => Promise<void>;
  onDeleteRace?: (raceId: number) => Promise<void>;
  onCreatePlayerProfile: (payload: {
    name: string;
    avatarUrl?: string | null;
    elysiumNetId?: string;
    xeMoNetId?: string;
    discordUserId?: string | null;
  }) => Promise<PlayerProfile>;
  onUpdatePlayerProfile: (
    id: number,
    payload: {
      name?: string;
      avatarUrl?: string | null;
      elysiumNetId?: string;
      xeMoNetId?: string;
      discordUserId?: string | null;
    }
  ) => Promise<PlayerProfile>;
  onMergePlayerProfiles: (payload: {
    sourceProfileId: number;
    targetProfileId: number;
    confirmIdentity: boolean;
  }) => Promise<PlayerProfile>;
  onLinkPlayerDiscord: (
    playerId: number,
    payload: {
      targetProfileId?: number | null;
      discordUserId?: string | null;
      discordName?: string | null;
      discordAvatarUrl?: string | null;
      syncIdentity?: boolean;
      confirmMerge?: boolean;
      unlink?: boolean;
    }
  ) => Promise<void>;
  onReviewFriendlyMatch: (
    matchId: number,
    payload: { action: 'APPROVE' | 'REJECT'; reviewNote?: string; score1?: number; score2?: number }
  ) => Promise<void>;
  onNotify: (msg: string) => void;
}) {
  const admin = state.currentAdmin;
  const [showOwnAccountModal, setShowOwnAccountModal] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState('');
  const autoBackup = admin?.role === 'HEAD_ADMIN' ? getHeadAutoBackupSummary() : null;
  const serverLooksResetAfterSleep =
    Boolean(autoBackup) &&
    state.adminAccounts.filter((a) => a.role === 'SUB_ADMIN').length === 0 &&
    state.players.length === 0 &&
    state.allMatches.length === 0 &&
    state.tournaments.length <= 1 &&
    ((autoBackup?.subAdminsCount ?? 0) > 0 ||
      (autoBackup?.playersCount ?? 0) > 0 ||
      (autoBackup?.tournamentsCount ?? 0) > 1);

  const allowedSections: Array<{ key: SectionKey; label: string; icon: React.ReactNode }> = [];
  if (admin) {
    if (adminHasPermission(admin, 'MANAGE_TOURNAMENT')) {
      allowedSections.push({ key: 'TOURNAMENT', label: 'البطولة', icon: <Settings size={15} /> });
    }
    if (adminHasPermission(admin, 'MANAGE_PLAYERS')) {
      const pendingBadge = state.pendingPlayers.length > 0 ? ` (${state.pendingPlayers.length})` : '';
      allowedSections.push({ key: 'PLAYERS', label: `المشاركون${pendingBadge}`, icon: <Users size={15} /> });
    }
    if (adminHasPermission(admin, 'RUN_DRAW')) {
      allowedSections.push({ key: 'DRAW', label: isRacingFormat(state.tournament?.format) ? 'التأهل والسباقات' : 'القرعة', icon: <Dices size={15} /> });
    }
    if (adminHasPermission(admin, 'EDIT_SCORES')) {
      allowedSections.push({ key: 'MATCHES', label: isRacingFormat(state.tournament?.format) ? 'السباقات' : 'المباريات', icon: <Trophy size={15} /> });
    }
    if (adminHasPermission(admin, 'EDIT_SCORES') || adminHasPermission(admin, 'MANAGE_PLAYERS')) {
      const pendingFriendlyCount = (state.friendlyMatches || []).filter((fm) => fm.status === 'PENDING').length;
      const friendlyBadge = pendingFriendlyCount > 0 ? ` (${pendingFriendlyCount})` : '';
      allowedSections.push({
        key: 'FRIENDLY_MATCHES',
        label: `المواجهات الودية${friendlyBadge}`,
        icon: <Swords size={15} />
      });
    }
    if (admin.role === 'HEAD_ADMIN') {
      const subCount = state.adminAccounts.filter((a) => a.role === 'SUB_ADMIN').length;
      allowedSections.push({ key: 'SUB_ADMINS', label: `المشرفون (${subCount}/5)`, icon: <UserCog size={15} /> });
    }
    if (adminHasPermission(admin, 'CROWN_CHAMPION')) {
      allowedSections.push({ key: 'CHAMPION', label: 'التتويج', icon: <Shield size={15} /> });
    }
    if (admin.role === 'HEAD_ADMIN') {
      allowedSections.push({ key: 'AUDIT', label: 'السجل', icon: <History size={15} /> });
    }
  }

  const [selected, setSelected] = useState<SectionKey | null>(null);

  useEffect(() => {
    if (!allowedSections.length) {
      setSelected(null);
    } else if (!selected || !allowedSections.some((s) => s.key === selected)) {
      setSelected(allowedSections[0].key);
    }
  }, [admin?.id, allowedSections.map((s) => s.key).join(','), selected]);

  if (!admin) {
    return (
      <AdminAuthGate
        hasHeadAdmin={state.hasHeadAdmin}
        adminDirectory={state.adminDirectory}
        lockoutState={state.lockoutState}
        persistence={state.persistence}
        onSetupHead={onSetupHead}
        onLogin={onLogin}
      />
    );
  }

  return (
    <div className="stack-col">
      <div className="arena-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>
            لوحة تحكم: {admin.displayName} <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>(@{admin.username})</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--cyber-sky)' }}>
            {admin.role === 'HEAD_ADMIN' ? 'المشرف الرئيسي' : 'مشرف مساعد'} •{' '}
            {state.keepSignedIn ? 'جلسة JWT محفوظة تلقائياً' : 'جلسة مؤقتة نشطة'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '7px 11px', fontSize: '0.8rem' }}
            onClick={() => setShowOwnAccountModal(true)}
            title="حسابي والأمان"
          >
            <KeyRound size={15} />
            <span>حسابي</span>
          </button>
          <button type="button" className="icon-btn" onClick={onLogout} title="تسجيل الخروج" style={{ color: 'var(--crimson-loss)' }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {admin.role === 'HEAD_ADMIN' && serverLooksResetAfterSleep && autoBackup && (
        <div
          className="arena-card arena-card-gold stack-col"
          style={{ gap: 10, padding: '14px 16px', borderColor: 'rgba(245, 158, 11, 0.85)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--championship-gold)' }}>
                تم رصد نسخة محفوظة على جهازك قبل سكون الخادم
              </div>
              <div style={{ fontSize: '0.77rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                تحتوي على: {autoBackup.tournamentsCount} بطولة • {autoBackup.playersCount} لاعب •{' '}
                {autoBackup.subAdminsCount} حسابات مساعدين
              </div>
            </div>
            <button
              type="button"
              className="btn btn-gold"
              disabled={backupBusy}
              onClick={async () => {
                setBackupError('');
                setBackupBusy(true);
                try {
                  await onRestoreBackup(autoBackup.backup);
                } catch (err) {
                  setBackupError(err instanceof Error ? err.message : 'تعذر استعادة النسخة المحفوظة.');
                } finally {
                  setBackupBusy(false);
                }
              }}
            >
              <RotateCcw size={16} />
              <span>{backupBusy ? 'جاري الاستعادة...' : 'استعادة البيانات وحسابات المساعدين الآن'}</span>
            </button>
          </div>
        </div>
      )}

      {admin.role === 'HEAD_ADMIN' && state.persistence && (
        <div
          className={`arena-card stack-col ${state.persistence.mode === 'ephemeral' ? 'arena-card-gold' : ''}`}
          style={{
            gap: 8,
            padding: '12px 16px',
            borderColor:
              state.persistence.mode === 'ephemeral'
                ? 'rgba(245, 158, 11, 0.7)'
                : state.persistence.mode === 'postgres'
                  ? 'rgba(16, 185, 129, 0.55)'
                  : 'rgba(56, 189, 248, 0.45)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {state.persistence.mode === 'ephemeral' ? (
                <AlertTriangle size={18} color="var(--championship-gold)" />
              ) : state.persistence.mode === 'postgres' ? (
                <Cloud size={18} color="var(--emerald-win)" />
              ) : (
                <HardDrive size={18} color="var(--cyber-sky)" />
              )}
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  color:
                    state.persistence.mode === 'ephemeral'
                      ? 'var(--championship-gold)'
                      : state.persistence.mode === 'postgres'
                        ? 'var(--emerald-win)'
                        : 'var(--cyber-sky)'
                }}
              >
                {state.persistence.labelAr}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                disabled={backupBusy}
                onClick={async () => {
                  setBackupError('');
                  setBackupBusy(true);
                  try {
                    await onDownloadBackup();
                  } catch (err) {
                    setBackupError(err instanceof Error ? err.message : 'تعذر تصدير النسخة الاحتياطية.');
                  } finally {
                    setBackupBusy(false);
                  }
                }}
              >
                <Download size={14} />
                <span>تصدير نسخة (JSON)</span>
              </button>
              <label
                className="btn btn-outline"
                style={{ padding: '6px 10px', fontSize: '0.78rem', cursor: backupBusy ? 'wait' : 'pointer' }}
              >
                <Upload size={14} />
                <span>{backupBusy ? 'جاري الاستعادة...' : 'استعادة نسخة'}</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  style={{ display: 'none' }}
                  disabled={backupBusy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setBackupError('');
                    setBackupBusy(true);
                    try {
                      const text = await file.text();
                      const parsed = JSON.parse(text);
                      await onRestoreBackup(parsed);
                    } catch (err) {
                      setBackupError(err instanceof Error ? err.message : 'ملف النسخة الاحتياطية غير صالح.');
                    } finally {
                      setBackupBusy(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {state.persistence.detailAr}
          </div>
          {backupError && (
            <div style={{ fontSize: '0.76rem', color: 'var(--crimson-loss)', fontWeight: 700 }}>{backupError}</div>
          )}
        </div>
      )}

      {allowedSections.length === 0 ? (
        <EmptyStatePanel
          icon={<UserCog size={28} />}
          title="لا توجد صلاحيات مفعلة"
          subtitle="اطلب من المشرف الرئيسي تفعيل الصلاحيات المناسبة لحسابك."
        />
      ) : (
        <>
          {adminHasPermission(admin, 'MANAGE_PLAYERS') && selected !== 'PLAYERS' && (
            <div
              className="arena-subcard"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                borderColor: 'rgba(88, 101, 242, 0.5)',
                background: 'rgba(88, 101, 242, 0.1)'
              }}
            >
              <div style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ color: '#C7D2FE' }}>ربط Discord:</strong>
                <span style={{ color: state.discordStatus?.oauthConfigured ? 'var(--emerald-win)' : 'var(--text-secondary)' }}>
                  OAuth {state.discordStatus?.oauthConfigured ? 'مفعّل' : 'غير مكتمل'}
                </span>
                <span>•</span>
                <span style={{ color: state.discordStatus?.botConfigured && state.discordStatus?.guildIdConfigured ? 'var(--cyber-sky)' : 'var(--text-secondary)' }}>
                  قائمة البوت {state.discordStatus?.botConfigured && state.discordStatus?.guildIdConfigured ? 'مفعّلة' : 'غير مكتملة'}
                </span>
                {state.players.some((p) => !p.discordUserId) && (
                  <>
                    <span>•</span>
                    <span style={{ color: 'var(--amber-draw)', fontWeight: 700 }}>
                      {state.players.filter((p) => !p.discordUserId).length} مشارك غير مربوط
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => setSelected('PLAYERS')}
                data-testid="admin_jump_discord_players_btn"
                style={{
                  padding: '6px 11px',
                  fontSize: '0.76rem',
                  minHeight: 34,
                  background: '#5865F2',
                  borderColor: '#7289DA',
                  color: '#FFFFFF'
                }}
              >
                فتح ربط المشاركين بـ Discord
              </button>
            </div>
          )}

          <div className="chip-scroll-row">
            {allowedSections.map((sec) => (
              <button
                key={sec.key}
                type="button"
                className={`chip ${selected === sec.key ? 'selected' : ''}`}
                onClick={() => setSelected(sec.key)}
              >
                {sec.icon}
                <span>{sec.label}</span>
              </button>
            ))}
          </div>

          <div className="rtl-stage-enter" key={selected}>
            {selected === 'TOURNAMENT' && (
              <AdminTournamentSettingsTab
                state={state}
                onSaveSettings={onSaveTournament}
                onCreateFresh={onCreateFreshTournament}
                onDeleteTournament={onDeleteTournament}
              />
            )}
            {selected === 'PLAYERS' && (
              <AdminPlayersTab
                state={state}
                onAdminAddPlayer={onAdminAddPlayer}
                onBulkImport={onBulkImport}
                onStatusChange={onUpdatePlayerStatus}
                onUpdateDetails={onUpdatePlayerDetails}
                onDeletePlayer={onDeletePlayer}
                onCreatePlayerProfile={onCreatePlayerProfile}
                onUpdatePlayerProfile={onUpdatePlayerProfile}
                onMergePlayerProfiles={onMergePlayerProfiles}
                onLinkPlayerDiscord={onLinkPlayerDiscord}
                onNotify={onNotify}
              />
            )}
            {selected === 'DRAW' &&
              (state.tournament ? (
                <AdminDrawTab
                  state={state}
                  onRunDraw={onRunDraw}
                  onGenerateKnockout={onGenerateKnockout}
                  onGenerateFinalRace={onGenerateFinalRace ? () => onGenerateFinalRace() : undefined}
                />
              ) : (
                <EmptyStatePanel
                  icon={<Dices size={28} />}
                  title="لا توجد بطولة نشطة"
                  subtitle="أنشئ بطولة جديدة من تبويب البطولة أولاً قبل إجراء القرعة."
                />
              ))}
            {selected === 'MATCHES' && (
              <AdminMatchesTab
                state={state}
                onEditMatch={onEditMatch}
                onQuickUpdateGoals={onQuickUpdateGoals}
                onAutoSchedule={onAutoSchedule}
                onToggleCheckIn={onToggleCheckIn}
                onOpenDispute={onOpenDispute}
                onCreateRace={onCreateRace}
                onEditRace={onEditRace}
                onGenerateFinalRace={onGenerateFinalRace}
                onDeleteRace={onDeleteRace}
              />
            )}
            {selected === 'FRIENDLY_MATCHES' && (
              <AdminFriendlyMatchesTab
                friendlyMatches={state.friendlyMatches || []}
                onReviewFriendlyMatch={onReviewFriendlyMatch}
              />
            )}
            {selected === 'SUB_ADMINS' && (
              <AdminSubAdminsTab
                state={state}
                onChangeOwnPin={onChangeOwnPin}
                onCreateSubAdmin={onCreateSubAdmin}
                onUpdateSubAdmin={onUpdateSubAdmin}
                onDeleteSubAdmin={onDeleteSubAdmin}
              />
            )}
            {selected === 'CHAMPION' &&
              (state.tournament ? (
                <AdminChampionTab
                  state={state}
                  onCrownChampion={onCrownChampion}
                  onOpenExportShare={onOpenExportShare}
                />
              ) : (
                <EmptyStatePanel
                  icon={<Trophy size={28} />}
                  title="لا توجد بطولة نشطة"
                  subtitle="أنشئ بطولة جديدة من تبويب البطولة لمتابعة التقدم والتتويج."
                />
              ))}
            {selected === 'AUDIT' && <AdminAuditLogTab state={state} />}
          </div>
        </>
      )}

      {showOwnAccountModal && (
        <AdminOwnAccountModal
          username={admin.username}
          displayName={admin.displayName}
          roleLabel={admin.role === 'HEAD_ADMIN' ? 'المشرف الرئيسي' : 'مشرف مساعد'}
          onClose={() => setShowOwnAccountModal(false)}
          onSaveProfile={async (payload) => {
            await onUpdateOwnProfile(payload);
            setShowOwnAccountModal(false);
          }}
          onChangePin={async (curr, next) => {
            await onChangeOwnPin(curr, next);
            setShowOwnAccountModal(false);
          }}
        />
      )}
    </div>
  );
}

function AdminOwnAccountModal({
  username: initialUsername,
  displayName: initialDisplayName,
  roleLabel,
  onClose,
  onSaveProfile,
  onChangePin
}: {
  username: string;
  displayName: string;
  roleLabel: string;
  onClose: () => void;
  onSaveProfile: (payload: { displayName: string; username?: string }) => Promise<void>;
  onChangePin: (currentPin: string, newPin: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busyProfile, setBusyProfile] = useState(false);
  const [busyPin, setBusyPin] = useState(false);

  const strength = evaluatePinStrengthClient(newPin);
  const profileValid = displayName.trim().length >= 1 && username.trim().length >= 3;
  const pinValid = /^\d{6}$/.test(currentPin) && /^\d{6}$/.test(newPin) && newPin === confirmPin;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--championship-gold)' }}>إدارة حساب المشرف والأمان</h3>
          <div style={{ fontSize: '0.78rem', color: 'var(--cyber-sky)', marginTop: 3 }}>
            الصلاحية: {roleLabel}
          </div>
        </div>

        <div className="arena-subcard stack-col" style={{ gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--championship-gold)' }}>
            بيانات الحساب التعريفية
          </div>
          <div className="field-group">
            <label className="field-label">الاسم الظاهر</label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="الاسم الظاهر في اللوحة"
            />
          </div>
          <div className="field-group">
            <label className="field-label">اسم المستخدم للدخول</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم المستخدم (3 أحرف على الأقل)"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!profileValid || busyProfile}
            onClick={async () => {
              setBusyProfile(true);
              try {
                await onSaveProfile({ displayName: displayName.trim(), username: username.trim() });
              } finally {
                setBusyProfile(false);
              }
            }}
          >
            {busyProfile ? 'جاري الحفظ...' : 'حفظ الاسم واسم المستخدم'}
          </button>
        </div>

        <div className="arena-subcard stack-col" style={{ gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--cyber-sky)' }}>
            تغيير رمز الأمان (PIN)
          </div>
          <input
            className="input score-num"
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="رمز PIN الحالي (6 أرقام)"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <input
            className="input score-num"
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="رمز PIN الجديد (6 أرقام)"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          {newPin && (
            <div style={{ fontSize: '0.76rem', color: 'var(--cyber-sky)' }}>قوة الرمز: {strength.label}</div>
          )}
          <input
            className="input score-num"
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="تأكيد رمز PIN الجديد"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <button
            type="button"
            className="btn btn-outline"
            disabled={!pinValid || busyPin}
            onClick={async () => {
              setBusyPin(true);
              try {
                await onChangePin(currentPin, newPin);
              } finally {
                setBusyPin(false);
              }
            }}
          >
            {busyPin ? 'جاري التحديث...' : 'تحديث رمز PIN وإنهاء الجلسات الأخرى'}
          </button>
        </div>

        <button type="button" className="btn btn-outline" onClick={onClose}>
          إغلاق
        </button>
      </div>
    </div>
  );
}
