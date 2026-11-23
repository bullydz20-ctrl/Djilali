import { useEffect, useState } from 'react';
import { Dices, KeyRound, LogOut, Settings, Shield, Trophy, UserCog, Users } from 'lucide-react';
import { EmptyStatePanel } from '../components/PlayerAvatar';
import { adminHasPermission, evaluatePinStrengthClient } from '../types';
import type { ArenaState, Match, PlayerLevel, PlayerStatus } from '../types';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminChampionTab, AdminMatchesTab, AdminPlayersTab, AdminSubAdminsTab } from './AdminPlayersStaffTabs';
import { AdminDrawTab, AdminTournamentSettingsTab } from './AdminTournamentDrawTabs';

type SectionKey = 'TOURNAMENT' | 'PLAYERS' | 'DRAW' | 'MATCHES' | 'SUB_ADMINS' | 'CHAMPION';

export function AdminScreen({
  state,
  onSetupHead,
  onLogin,
  onLogout,
  onSaveTournament,
  onCreateFreshTournament,
  onDeleteTournament,
  onAdminAddPlayer,
  onUpdatePlayerStatus,
  onUpdatePlayerDetails,
  onDeletePlayer,
  onRunDraw,
  onGenerateKnockout,
  onEditMatch,
  onQuickUpdateGoals,
  onUpdateOwnProfile,
  onChangeOwnPin,
  onCreateSubAdmin,
  onUpdateSubAdmin,
  onDeleteSubAdmin,
  onCrownChampion,
  onOpenExportShare
}: {
  state: ArenaState;
  onSetupHead: (p: { username: string; displayName: string; pin: string; keepSignedIn: boolean }) => Promise<void>;
  onLogin: (p: { username: string; pin: string; keepSignedIn: boolean }) => Promise<void>;
  onLogout: () => Promise<void>;
  onSaveTournament: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onCreateFreshTournament: (payload: Record<string, unknown>) => Promise<void>;
  onDeleteTournament: (id: number) => Promise<void>;
  onAdminAddPlayer: (payload: {
    name: string;
    elysiumNetId: string;
    avatarUrl: string | null;
    level: PlayerLevel;
    ovrRating: number;
    clubName: string;
    status: PlayerStatus;
  }) => Promise<void>;
  onUpdatePlayerStatus: (id: number, status: PlayerStatus) => Promise<void>;
  onUpdatePlayerDetails: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onDeletePlayer: (id: number) => Promise<void>;
  onRunDraw: (manualGroups: Record<number, number>, manualOrder: number[]) => Promise<void>;
  onGenerateKnockout: () => Promise<void>;
  onEditMatch: (m: Match) => void;
  onQuickUpdateGoals: (m: Match, g1: number, g2: number) => void;
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
}) {
  const admin = state.currentAdmin;
  const [showOwnAccountModal, setShowOwnAccountModal] = useState(false);

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
      allowedSections.push({ key: 'DRAW', label: 'القرعة', icon: <Dices size={15} /> });
    }
    if (adminHasPermission(admin, 'EDIT_SCORES')) {
      allowedSections.push({ key: 'MATCHES', label: 'المباريات', icon: <Trophy size={15} /> });
    }
    if (admin.role === 'HEAD_ADMIN') {
      const subCount = state.adminAccounts.filter((a) => a.role === 'SUB_ADMIN').length;
      allowedSections.push({ key: 'SUB_ADMINS', label: `المشرفون (${subCount}/5)`, icon: <UserCog size={15} /> });
    }
    if (adminHasPermission(admin, 'CROWN_CHAMPION')) {
      allowedSections.push({ key: 'CHAMPION', label: 'التتويج', icon: <Shield size={15} /> });
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

      {allowedSections.length === 0 ? (
        <EmptyStatePanel
          icon={<UserCog size={28} />}
          title="لا توجد صلاحيات مفعلة"
          subtitle="اطلب من المشرف الرئيسي تفعيل الصلاحيات المناسبة لحسابك."
        />
      ) : (
        <>
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
                onStatusChange={onUpdatePlayerStatus}
                onUpdateDetails={onUpdatePlayerDetails}
                onDeletePlayer={onDeletePlayer}
              />
            )}
            {selected === 'DRAW' &&
              (state.tournament ? (
                <AdminDrawTab
                  state={state}
                  onRunDraw={onRunDraw}
                  onGenerateKnockout={onGenerateKnockout}
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
