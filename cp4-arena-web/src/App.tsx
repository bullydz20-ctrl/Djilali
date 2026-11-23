import { useCallback, useEffect, useRef, useState } from 'react';
import { GitBranch, Home, LayoutGrid, Shield, Users } from 'lucide-react';
import {
  adminAddPlayerApi,
  cancelReminderApi,
  changeOwnPinApi,
  createSubAdminApi,
  createTournamentApi,
  crownChampionApi,
  deletePlayerApi,
  deleteSubAdminApi,
  deleteTournamentApi,
  downloadBackupApi,
  fetchArenaState,
  generateKnockoutApi,
  getAuthToken,
  getLastAdminUsername,
  loginAdminApi,
  logoutAdminApi,
  registerPlayerApi,
  restoreBackupApi,
  runDrawApi,
  scheduleReminderApi,
  setAuthToken,
  setLastAdminUsername,
  setupHeadAdminApi,
  updateKnockoutWinnerApi,
  updateMatchScoreApi,
  updateOwnProfileApi,
  updatePlayerDetailsApi,
  updatePlayerStatusApi,
  updateSubAdminApi,
  updateTournamentApi
} from './api';
import {
  ExportShareModal,
  InstallPwaModal,
  MatchReminderModal,
  RegisterPlayerModal,
  ScoreEntryModal
} from './components/Dialogs';
import { TopHeader } from './components/TopHeader';
import { AdminScreen } from './screens/AdminScreen';
import { BracketScreen } from './screens/BracketScreen';
import { GroupsScreen } from './screens/GroupsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlayersScreen } from './screens/PlayersScreen';
import type { ArenaState, Match, PlayerLevel, PlayerStatus } from './types';

type TabKey = 'HOME' | 'PLAYERS' | 'GROUPS' | 'BRACKET' | 'ADMIN';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const NAV_ITEMS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'HOME', label: 'الرئيسية', icon: <Home size={19} /> },
  { key: 'PLAYERS', label: 'المشاركون', icon: <Users size={19} /> },
  { key: 'GROUPS', label: 'المجموعات', icon: <LayoutGrid size={19} /> },
  { key: 'BRACKET', label: 'الإقصائيات', icon: <GitBranch size={19} /> },
  { key: 'ADMIN', label: 'الإدارة', icon: <Shield size={19} /> }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('HOME');
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(() => {
    const raw = new URLSearchParams(window.location.search).get('t');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  });

  const [state, setState] = useState<ArenaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [reminderMatch, setReminderMatch] = useState<Match | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const firedRemindersRef = useRef<Set<number>>(new Set());
  const toastTimerRef = useRef<number | null>(null);
  const activeTidRef = useRef<number | null>(selectedTournamentId);
  activeTidRef.current = selectedTournamentId;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshState = useCallback(async (overrideTid?: number | null) => {
    try {
      const tid = overrideTid !== undefined ? overrideTid : activeTidRef.current;
      let savedUsername = getLastAdminUsername().trim();
      if (!savedUsername && typeof window !== 'undefined') {
        try {
          savedUsername = (window.localStorage.getItem('cp4_last_admin_username') || '').trim();
        } catch {
          savedUsername = '';
        }
      }
      const next = await fetchArenaState(tid, savedUsername || null);
      if (next.currentAdmin) {
        setLastAdminUsername(next.currentAdmin.username);
      } else if (getAuthToken()) {
        setAuthToken(null);
      } else if (next.rememberedUsername) {
        setLastAdminUsername(next.rememberedUsername);
      }
      setState(next);
      setLoadError('');
      if (next.tournament && next.tournament.id !== tid) {
        setSelectedTournamentId(next.tournament.id);
      } else if (!next.tournament && tid !== null) {
        setSelectedTournamentId(null);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'تعذر تحميل بيانات البطولة.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState(selectedTournamentId);
  }, [selectedTournamentId, refreshState]);

  // Cross-device real-time synchronization via Server-Sent Events
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        if (parsed.type && parsed.type !== 'connected') {
          refreshState();
        }
      } catch {
        // ignore malformed heartbeat
      }
    };
    return () => es.close();
  }, [refreshState]);

  // PWA installability & standalone detection
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Poll reminders every 30s to dispatch due browser notifications
  useEffect(() => {
    if (!state?.matchReminders?.length) return;
    const checkDue = () => {
      const now = Date.now();
      for (const rem of state.matchReminders) {
        if (!rem.isEnabled || firedRemindersRef.current.has(rem.id)) continue;
        if (now >= rem.remindAtMillis && now <= rem.scheduledAtMillis + 15 * 60 * 1000) {
          firedRemindersRef.current.add(rem.id);
          const body = `تذكير بمباراة: ${rem.matchTitle} (${rem.matchStageLabel})`;
          showToast(body);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('CP4 ARENA — موعد مباراة', {
              body,
              icon: '/icons/icon-192.png'
            });
          }
        }
      }
    };
    checkDue();
    const timer = window.setInterval(checkDue, 30_000);
    return () => window.clearInterval(timer);
  }, [state?.matchReminders, showToast]);

  const selectTournament = (id: number) => {
    setSelectedTournamentId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('t', String(id));
    window.history.replaceState({}, '', url.toString());
  };

  async function runAction<T extends { messageAr?: string }>(fn: () => Promise<T>): Promise<T> {
    try {
      const res = await fn();
      if (res?.messageAr) showToast(res.messageAr);
      await refreshState();
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تنفيذ العملية.';
      showToast(msg);
      throw err;
    }
  }

  const playersById = new Map((state?.players || []).map((p) => [p.id, p]));
  const remindersByMatchId = new Map((state?.matchReminders || []).map((r) => [r.matchId, r]));

  return (
    <div className="app-shell">
      <TopHeader
        currentAdmin={state?.currentAdmin ?? null}
        tournaments={state?.tournaments ?? []}
        activeTournamentId={state?.tournament?.id ?? selectedTournamentId}
        onSelectTournament={selectTournament}
        onOpenAdmin={() => setActiveTab('ADMIN')}
        onOpenExportShare={() => {
          if (state?.tournament) setShowExportModal(true);
        }}
        onOpenInstallPwa={() => setShowInstallModal(true)}
        canShowInstall={!isStandalone}
      />

      <div className="workspace-body">
        <aside className="side-rail" aria-label="التنقل الرئيسي">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`rail-btn ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        <main className="main-content">
          {loading && !state ? (
            <div className="arena-card" style={{ textAlign: 'center', padding: 36 }}>
              <div style={{ fontWeight: 800, color: 'var(--championship-gold)', marginBottom: 6 }}>
                CP4 ARENA
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                جاري تحميل بيانات الساحة والبطولات...
              </div>
            </div>
          ) : loadError && !state ? (
            <div className="arena-card stack-col" style={{ textAlign: 'center', padding: 28 }}>
              <div style={{ color: 'var(--crimson-loss)', fontWeight: 700 }}>{loadError}</div>
              <button type="button" className="btn btn-primary" onClick={() => refreshState()}>
                إعادة المحاولة
              </button>
            </div>
          ) : state ? (
            <div className="rtl-stage-enter" key={`${activeTab}-${state.tournament?.id ?? 'none'}`}>
              {activeTab === 'HOME' && (
                <HomeScreen
                  state={state}
                  onOpenRegister={() => setShowRegisterModal(true)}
                  onEditMatch={(m) => setEditingMatch(m)}
                  onQuickUpdateGoals={(m, g1, g2) => {
                    runAction(() =>
                      updateMatchScoreApi(m.id, {
                        leg1Score1: g1,
                        leg1Score2: g2,
                        leg2Score1: m.leg2Score1,
                        leg2Score2: m.leg2Score2,
                        penaltyScore1: m.penaltyScore1,
                        penaltyScore2: m.penaltyScore2
                      })
                    ).catch(() => undefined);
                  }}
                  onOpenExportShare={() => {
                    if (state.tournament) setShowExportModal(true);
                  }}
                  onOpenReminder={(m) => setReminderMatch(m)}
                  onCancelReminder={(matchId) => {
                    runAction(() => cancelReminderApi(matchId)).catch(() => undefined);
                  }}
                  onOpenAdmin={() => setActiveTab('ADMIN')}
                />
              )}

              {activeTab === 'PLAYERS' && (
                <PlayersScreen state={state} onOpenRegister={() => setShowRegisterModal(true)} />
              )}

              {activeTab === 'GROUPS' && (
                <GroupsScreen
                  state={state}
                  onEditMatch={(m) => setEditingMatch(m)}
                  onQuickUpdateGoals={(m, g1, g2) => {
                    runAction(() =>
                      updateMatchScoreApi(m.id, {
                        leg1Score1: g1,
                        leg1Score2: g2,
                        leg2Score1: m.leg2Score1,
                        leg2Score2: m.leg2Score2,
                        penaltyScore1: m.penaltyScore1,
                        penaltyScore2: m.penaltyScore2
                      })
                    ).catch(() => undefined);
                  }}
                  onOpenReminder={(m) => setReminderMatch(m)}
                />
              )}

              {activeTab === 'BRACKET' && (
                <BracketScreen
                  state={state}
                  onEditMatch={(m) => setEditingMatch(m)}
                  onSelectWinner={async (matchId, winnerPlayerId) => {
                    await runAction(() => updateKnockoutWinnerApi(matchId, winnerPlayerId));
                  }}
                />
              )}

              {activeTab === 'ADMIN' && (
                <AdminScreen
                  state={state}
                  onSetupHead={async (p) => {
                    await runAction(() => setupHeadAdminApi(p));
                  }}
                  onLogin={async (p) => {
                    try {
                      await runAction(() => loginAdminApi(p));
                    } catch (err) {
                      await refreshState();
                      throw err;
                    }
                  }}
                  onLogout={async () => {
                    await logoutAdminApi();
                    showToast('تم تسجيل الخروج من لوحة المشرف.');
                    await refreshState();
                  }}
                  onSaveTournament={async (id, payload) => {
                    await runAction(() => updateTournamentApi(id, payload));
                  }}
                  onCreateFreshTournament={async (payload) => {
                    const res = await runAction(() => createTournamentApi(payload));
                    if (res.tournament?.id) {
                      selectTournament(res.tournament.id);
                    }
                  }}
                  onDeleteTournament={async (id) => {
                    const res = await deleteTournamentApi(id);
                    if (res?.messageAr) showToast(res.messageAr);
                    const url = new URL(window.location.href);
                    url.searchParams.delete('t');
                    window.history.replaceState({}, '', url.toString());
                    setSelectedTournamentId(null);
                    await refreshState(null);
                  }}
                  onAdminAddPlayer={async (payload) => {
                    if (!state.tournament) return;
                    await runAction(() => adminAddPlayerApi(state.tournament!.id, payload));
                  }}
                  onUpdatePlayerStatus={async (id, status: PlayerStatus) => {
                    await runAction(() => updatePlayerStatusApi(id, status));
                  }}
                  onUpdatePlayerDetails={async (id, payload) => {
                    await runAction(() => updatePlayerDetailsApi(id, payload));
                  }}
                  onDeletePlayer={async (id) => {
                    await runAction(() => deletePlayerApi(id));
                  }}
                  onRunDraw={async (manualGroups, manualOrder) => {
                    if (!state.tournament) return;
                    await runAction(() => runDrawApi(state.tournament!.id, manualGroups, manualOrder));
                  }}
                  onGenerateKnockout={async () => {
                    if (!state.tournament) return;
                    await runAction(() => generateKnockoutApi(state.tournament!.id));
                  }}
                  onEditMatch={(m) => setEditingMatch(m)}
                  onQuickUpdateGoals={(m, g1, g2) => {
                    runAction(() =>
                      updateMatchScoreApi(m.id, {
                        leg1Score1: g1,
                        leg1Score2: g2,
                        leg2Score1: m.leg2Score1,
                        leg2Score2: m.leg2Score2,
                        penaltyScore1: m.penaltyScore1,
                        penaltyScore2: m.penaltyScore2
                      })
                    ).catch(() => undefined);
                  }}
                  onUpdateOwnProfile={async (payload) => {
                    await runAction(() => updateOwnProfileApi(payload));
                  }}
                  onChangeOwnPin={async (currentPin, newPin) => {
                    await runAction(() => changeOwnPinApi(currentPin, newPin));
                  }}
                  onCreateSubAdmin={async (payload) => {
                    await runAction(() => createSubAdminApi(payload));
                  }}
                  onUpdateSubAdmin={async (id, payload) => {
                    await runAction(() => updateSubAdminApi(id, payload));
                  }}
                  onDeleteSubAdmin={async (id) => {
                    await runAction(() => deleteSubAdminApi(id));
                  }}
                  onCrownChampion={async (playerId) => {
                    if (!state.tournament) return;
                    await runAction(() => crownChampionApi(state.tournament!.id, playerId));
                  }}
                  onOpenExportShare={() => {
                    if (state.tournament) setShowExportModal(true);
                  }}
                  onDownloadBackup={async () => {
                    const res = await downloadBackupApi();
                    if (res.messageAr) showToast(res.messageAr);
                  }}
                  onRestoreBackup={async (backupData) => {
                    await runAction(() => restoreBackupApi(backupData));
                  }}
                />
              )}
            </div>
          ) : null}
        </main>
      </div>

      {/* Bottom Mobile Navigation */}
      <nav className="bottom-nav" aria-label="شريط التنقل السفلي">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`bottom-nav-btn ${active ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              <span className="bottom-nav-icon-wrap">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      {showRegisterModal && state?.tournament && (
        <RegisterPlayerModal
          gameTitle={state.tournament.gameTitle}
          tournamentName={state.tournament.name}
          onClose={() => setShowRegisterModal(false)}
          onSubmit={async (payload: {
            name: string;
            elysiumNetId: string;
            avatarUrl: string | null;
            level: PlayerLevel;
            clubName: string;
          }) => {
            await runAction(() =>
              registerPlayerApi({
                tournamentId: state.tournament!.id,
                ...payload
              })
            );
            setShowRegisterModal(false);
          }}
        />
      )}

      {editingMatch &&
        editingMatch.player1Id &&
        editingMatch.player2Id &&
        playersById.get(editingMatch.player1Id) &&
        playersById.get(editingMatch.player2Id) && (
          <ScoreEntryModal
            match={editingMatch}
            player1={playersById.get(editingMatch.player1Id)!}
            player2={playersById.get(editingMatch.player2Id)!}
            scoreUnitLabel={state?.tournament?.scoreUnitLabel || 'نقطة'}
            onClose={() => setEditingMatch(null)}
            onSave={async (payload) => {
              await runAction(() => updateMatchScoreApi(editingMatch.id, payload));
              setEditingMatch(null);
            }}
          />
        )}

      {reminderMatch && (
        <MatchReminderModal
          match={reminderMatch}
          player1={reminderMatch.player1Id ? playersById.get(reminderMatch.player1Id) ?? null : null}
          player2={reminderMatch.player2Id ? playersById.get(reminderMatch.player2Id) ?? null : null}
          existing={remindersByMatchId.get(reminderMatch.id) ?? null}
          onClose={() => setReminderMatch(null)}
          onSave={async (payload) => {
            await runAction(() => scheduleReminderApi(payload));
            setReminderMatch(null);
          }}
          onCancel={async (matchId) => {
            await runAction(() => cancelReminderApi(matchId));
            setReminderMatch(null);
          }}
        />
      )}

      {showExportModal && state?.tournament && (
        <ExportShareModal
          tournamentId={state.tournament.id}
          onClose={() => setShowExportModal(false)}
          onNotify={showToast}
        />
      )}

      {showInstallModal && (
        <InstallPwaModal
          canNativePrompt={Boolean(deferredInstallPrompt)}
          onTriggerNativeInstall={async () => {
            if (!deferredInstallPrompt) return;
            await deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            setDeferredInstallPrompt(null);
          }}
          onClose={() => setShowInstallModal(false)}
        />
      )}

      {toast && (
        <div className="toast-banner" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
