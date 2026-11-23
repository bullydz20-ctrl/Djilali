import { useEffect, useState } from 'react';
import { Dices, LogOut, Settings, Shield, Trophy, UserCog, Users } from 'lucide-react';
import { EmptyStatePanel } from '../components/PlayerAvatar';
import { adminHasPermission } from '../types';
import type { ArenaState, Match, PlayerStatus } from '../types';
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
  onUpdatePlayerStatus,
  onUpdatePlayerDetails,
  onDeletePlayer,
  onRunDraw,
  onGenerateKnockout,
  onEditMatch,
  onQuickUpdateGoals,
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
  onUpdatePlayerStatus: (id: number, status: PlayerStatus) => Promise<void>;
  onUpdatePlayerDetails: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onDeletePlayer: (id: number) => Promise<void>;
  onRunDraw: (manualGroups: Record<number, number>, manualOrder: number[]) => Promise<void>;
  onGenerateKnockout: () => Promise<void>;
  onEditMatch: (m: Match) => void;
  onQuickUpdateGoals: (m: Match, g1: number, g2: number) => void;
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
      <div className="arena-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>لوحة تحكم: {admin.displayName}</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--cyber-sky)' }}>
            {admin.role === 'HEAD_ADMIN' ? 'المشرف الرئيسي' : 'مشرف مساعد'} • جلسة آمنة نشطة
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={onLogout} title="تسجيل الخروج" style={{ color: 'var(--crimson-loss)' }}>
          <LogOut size={18} />
        </button>
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
    </div>
  );
}
