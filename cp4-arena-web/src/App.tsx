import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, Home, LayoutGrid, Shield, Users } from 'lucide-react';
import {
  adminAddPlayerApi,
  autoScheduleMatchesApi,
  bulkImportPlayersApi,
  cancelReminderApi,
  changeOwnPinApi,
  createPlayerProfileApi,
  createRaceApi,
  createSubAdminApi,
  createTournamentApi,
  crownChampionApi,
  deletePlayerApi,
  deleteRaceApi,
  deleteSubAdminApi,
  deleteTournamentApi,
  downloadBackupApi,
  fetchArenaState,
  fetchBackupJsonApi,
  generateFinalRaceApi,
  generateKnockoutApi,
  getAuthToken,
  getLastAdminUsername,
  linkPlayerDiscordApi,
  loginAdminApi,
  logoutAdminApi,
  logoutDiscordSessionApi,
  mergePlayerProfilesApi,
  registerPlayerApi,
  resolveMatchDisputeApi,
  restoreBackupApi,
  runDrawApi,
  saveHeadAutoBackup,
  saveRaceResultsApi,
  scheduleReminderApi,
  setAuthToken,
  setLastAdminUsername,
  setupHeadAdminApi,
  submitMatchDisputeApi,
  toggleMatchCheckInApi,
  updateKnockoutWinnerApi,
  updateMatchScoreApi,
  updateOwnProfileApi,
  updatePlayerDetailsApi,
  updatePlayerProfileApi,
  updatePlayerStatusApi,
  updateSubAdminApi,
  updateTournamentApi,
  voteMatchPredictionApi,
  walkoverMatchApi
} from './api';
import { TopHeader } from './components/TopHeader';
import { HomeScreen } from './screens/HomeScreen';
import type {
  ArenaState,
  Match,
  Player,
  PlayerLevel,
  PlayerProfile,
  PlayerStatus,
  RaceEntry
} from './types';

const PlayersScreen = lazy(() => import('./screens/PlayersScreen').then((m) => ({ default: m.PlayersScreen })));
const GroupsScreen = lazy(() => import('./screens/GroupsScreen').then((m) => ({ default: m.GroupsScreen })));
const BracketScreen = lazy(() => import('./screens/BracketScreen').then((m) => ({ default: m.BracketScreen })));
const AdminScreen = lazy(() => import('./screens/AdminScreen').then((m) => ({ default: m.AdminScreen })));

const DisputeMatchModal = lazy(() =>
  import('./components/Dialogs').then((m) => ({ default: m.DisputeMatchModal }))
);
const ExportShareModal = lazy(() =>
  import('./components/Dialogs').then((m) => ({ default: m.ExportShareModal }))
);
const InstallPwaModal = lazy(() =>
  import('./components/Dialogs').then((m) => ({ default: m.InstallPwaModal }))
);
const MatchReminderModal = lazy(() =>
  import('./components/Dialogs').then((m) => ({ default: m.MatchReminderModal }))
);
const PlayerProfileModal = lazy(() =>
  import('./components/Dialogs').then((m) => ({ default: m.PlayerProfileModal }))
);
const RaceResultsModal = lazy(() =>
  import('./components/Dialogs').then((m) => ({ default: m.RaceResultsModal }))
);
const RegisterPlayerModal = lazy(() =>
  import('./components/Dialogs').then((m) => ({ default: m.RegisterPlayerModal }))
);
const ScoreEntryModal = lazy(() =>
  import('./components/Dialogs').then((m) => ({ default: m.ScoreEntryModal }))
);

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

  const [showRegisterModal, setShowRegisterModal] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('register') === '1';
  });
  const [discordProfileOverride, setDiscordProfileOverride] = useState<PlayerProfile | null | undefined>(undefined);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editingRace, setEditingRace] = useState<RaceEntry | null>(null);
  const [reminderMatch, setReminderMatch] = useState<Match | null>(null);
  const [disputeMatch, setDisputeMatch] = useState<Match | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const firedRemindersRef = useRef<Set<number>>(new Set());
  const toastTimerRef = useRef<number | null>(null);
  const activeTidRef = useRef<number | null>(selectedTournamentId);
  activeTidRef.current = selectedTournamentId;

  const refreshInFlightRef = useRef(false);
  const pendingRefreshRef = useRef<{ queued: boolean; overrideTid?: number | null }>({ queued: false });
  const lastAutoBackupAtRef = useRef(0);
  const autoBackupTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshState = useCallback(async (overrideTid?: number | null) => {
    if (refreshInFlightRef.current) {
      pendingRefreshRef.current = { queued: true, overrideTid };
      return;
    }
    refreshInFlightRef.current = true;
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
      if (next.currentAdmin?.role === 'HEAD_ADMIN') {
        const hasMeaningfulData =
          next.adminAccounts.some((a) => a.role === 'SUB_ADMIN') ||
          next.players.length > 0 ||
          next.allMatches.length > 0 ||
          next.tournaments.length > 1;
        const now = Date.now();
        if (hasMeaningfulData && now - lastAutoBackupAtRef.current >= 180_000) {
          lastAutoBackupAtRef.current = now;
          if (autoBackupTimerRef.current) window.clearTimeout(autoBackupTimerRef.current);
          autoBackupTimerRef.current = window.setTimeout(() => {
            fetchBackupJsonApi().then(saveHeadAutoBackup).catch(() => undefined);
          }, 800);
        }
      }
      if (next.tournament && next.tournament.id !== tid) {
        setSelectedTournamentId(next.tournament.id);
      } else if (!next.tournament && tid !== null) {
        setSelectedTournamentId(null);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'تعذر تحميل بيانات البطولة.');
    } finally {
      setLoading(false);
      refreshInFlightRef.current = false;
      if (pendingRefreshRef.current.queued) {
        const queued = pendingRefreshRef.current;
        pendingRefreshRef.current = { queued: false };
        void refreshState(queued.overrideTid);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (autoBackupTimerRef.current) window.clearTimeout(autoBackupTimerRef.current);
    };
  }, []);

  useEffect(() => {
    refreshState(selectedTournamentId);
  }, [selectedTournamentId, refreshState]);

  // Cross-device real-time synchronization via Server-Sent Events (debounced to coalesce bursts)
  useEffect(() => {
    const es = new EventSource('/api/events');
    let debounceTimer: number | null = null;
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        if (parsed.type && parsed.type !== 'connected') {
          if (debounceTimer) window.clearTimeout(debounceTimer);
          debounceTimer = window.setTimeout(() => {
            refreshState();
          }, 220);
        }
      } catch {
        // ignore malformed heartbeat
      }
    };
    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      es.close();
    };
  }, [refreshState]);

  // Clean up returnTo query params after full-page Discord OAuth redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('register')) {
      url.searchParams.delete('register');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Listen for Discord OAuth callback popup completion
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as {
        type?: string;
        ok?: boolean;
        cp4Id?: string;
        name?: string;
        avatarUrl?: string | null;
        discordUserId?: string | null;
        elysiumNetId?: string;
        xeMoNetId?: string;
        profileId?: number | null;
        profile?: PlayerProfile | null;
        created?: boolean;
        duplicate?: boolean;
        errorAr?: string;
        error?: string;
      } | null;
      if (!data || data.type !== 'cp4_discord_oauth_result') return;
      if (data.ok) {
        if (data.profile) {
          setDiscordProfileOverride(data.profile);
        } else if (data.profileId && data.cp4Id && data.name) {
          setDiscordProfileOverride({
            id: data.profileId,
            cp4Id: data.cp4Id,
            name: data.name,
            avatarUrl: data.avatarUrl ?? null,
            elysiumNetId: data.elysiumNetId || '',
            xeMoNetId: data.xeMoNetId || '',
            discordUserId: data.discordUserId ?? null,
            createdAt: Date.now()
          });
        }
        const prefix = data.created ? 'تم تسجيل الدخول عبر Discord' : 'تم تسجيل الدخول بحساب Discord';
        showToast(`${prefix}${data.cp4Id ? ` (${data.cp4Id})` : ''}${data.name ? ` — ${data.name}` : ''}`);
        refreshState();
      } else {
        const errText = data.errorAr || data.error;
        if (errText) showToast(errText);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refreshState, showToast]);

  const activeDiscordProfile =
    discordProfileOverride !== undefined ? discordProfileOverride : (state?.currentDiscordProfile ?? null);

  const startDiscordLogin = useCallback(
    (returnToPath = '/') => {
      if (state?.discordStatus && !state.discordStatus.oauthConfigured) {
        showToast('ربط Discord OAuth غير مُفعّل على الخادم بعد. يرجى ضبط متغيرات DISCORD_CLIENT_ID و DISCORD_CLIENT_SECRET و DISCORD_REDIRECT_URI.');
        return;
      }
      const startUrl = `/api/discord/oauth/start?returnTo=${encodeURIComponent(returnToPath)}`;
      const preferSameTab =
        isStandalone ||
        window.matchMedia('(pointer: coarse)').matches ||
        window.innerWidth < 900;
      if (preferSameTab) {
        window.location.href = startUrl;
        return;
      }
      const popup = window.open(startUrl, 'cp4_discord_oauth', 'width=520,height=740');
      if (!popup) {
        window.location.href = startUrl;
      }
    },
    [state?.discordStatus, isStandalone, showToast]
  );

  const handleLogoutDiscord = useCallback(async () => {
    try {
      await logoutDiscordSessionApi();
      setDiscordProfileOverride(null);
      showToast('تم تسجيل الخروج من حساب Discord.');
      await refreshState();
    } catch {
      showToast('تعذر تسجيل الخروج من Discord.');
    }
  }, [refreshState, showToast]);

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

  const playersById = useMemo(
    () => new Map((state?.players || []).map((p) => [p.id, p])),
    [state?.players]
  );
  const remindersByMatchId = useMemo(
    () => new Map((state?.matchReminders || []).map((r) => [r.matchId, r])),
    [state?.matchReminders]
  );

  return (
    <div className="app-shell">
      <TopHeader
        currentAdmin={state?.currentAdmin ?? null}
        discordProfile={activeDiscordProfile}
        tournaments={state?.tournaments ?? []}
        activeTournamentId={state?.tournament?.id ?? selectedTournamentId}
        onSelectTournament={selectTournament}
        onOpenAdmin={() => setActiveTab('ADMIN')}
        onOpenExportShare={() => {
          if (state?.tournament) setShowExportModal(true);
        }}
        onOpenInstallPwa={() => setShowInstallModal(true)}
        onStartDiscordLogin={() => startDiscordLogin(showRegisterModal ? '/?register=1' : '/')}
        onLogoutDiscord={handleLogoutDiscord}
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
                  discordProfile={activeDiscordProfile}
                  onStartDiscordLogin={() => startDiscordLogin('/')}
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
                  onToggleCheckIn={(m, slot) => {
                    runAction(() => toggleMatchCheckInApi(m.id, slot)).catch(() => undefined);
                  }}
                  onVotePrediction={(m, slot) => {
                    runAction(() => voteMatchPredictionApi(m.id, slot)).catch(() => undefined);
                  }}
                  onOpenDispute={(m) => setDisputeMatch(m)}
                  onOpenPlayerProfile={(p) => setProfilePlayer(p)}
                  onCelebrateChampion={() => showToast('🏆 تحية كبيرة لبطل البطولة!')}
                  onOpenAdmin={() => setActiveTab('ADMIN')}
                  onCreateRace={async (payload) => {
                    if (!state.tournament) return;
                    await runAction(() => createRaceApi(state.tournament!.id, payload));
                  }}
                  onEditRace={(race) => setEditingRace(race)}
                  onGenerateFinalRace={async (payload) => {
                    if (!state.tournament) return;
                    await runAction(() => generateFinalRaceApi(state.tournament!.id, payload));
                  }}
                  onDeleteRace={async (raceId) => {
                    await runAction(() => deleteRaceApi(raceId));
                  }}
                />
              )}

              <Suspense
                fallback={
                  <div className="arena-card" style={{ textAlign: 'center', padding: 28, color: 'var(--text-secondary)' }}>
                    جاري تحميل القسم...
                  </div>
                }
              >
                {activeTab === 'PLAYERS' && (
                  <PlayersScreen
                    state={state}
                    discordProfile={activeDiscordProfile}
                    onStartDiscordLogin={() => startDiscordLogin('/')}
                    onOpenRegister={() => setShowRegisterModal(true)}
                    onOpenPlayerProfile={(p) => setProfilePlayer(p)}
                  />
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
                  onToggleCheckIn={(m, slot) => {
                    runAction(() => toggleMatchCheckInApi(m.id, slot)).catch(() => undefined);
                  }}
                  onVotePrediction={(m, slot) => {
                    runAction(() => voteMatchPredictionApi(m.id, slot)).catch(() => undefined);
                  }}
                  onOpenDispute={(m) => setDisputeMatch(m)}
                  onCreateRace={async (payload) => {
                    if (!state.tournament) return;
                    await runAction(() => createRaceApi(state.tournament!.id, payload));
                  }}
                  onEditRace={(race) => setEditingRace(race)}
                  onGenerateFinalRace={async (payload) => {
                    if (!state.tournament) return;
                    await runAction(() => generateFinalRaceApi(state.tournament!.id, payload));
                  }}
                  onDeleteRace={async (raceId) => {
                    await runAction(() => deleteRaceApi(raceId));
                  }}
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
                  onBulkImport={async (linesText, status) => {
                    if (!state.tournament) return;
                    await runAction(() => bulkImportPlayersApi(state.tournament!.id, linesText, status));
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
                  onAutoSchedule={async (payload) => {
                    if (!state.tournament) return;
                    await runAction(() => autoScheduleMatchesApi(state.tournament!.id, payload));
                  }}
                  onToggleCheckIn={(m, slot) => {
                    runAction(() => toggleMatchCheckInApi(m.id, slot)).catch(() => undefined);
                  }}
                  onOpenDispute={(m) => setDisputeMatch(m)}
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
                  onCreateRace={async (payload) => {
                    if (!state.tournament) return;
                    await runAction(() => createRaceApi(state.tournament!.id, payload));
                  }}
                  onEditRace={(race) => setEditingRace(race)}
                  onGenerateFinalRace={async (payload) => {
                    if (!state.tournament) return;
                    await runAction(() => generateFinalRaceApi(state.tournament!.id, payload));
                  }}
                  onDeleteRace={async (raceId) => {
                    await runAction(() => deleteRaceApi(raceId));
                  }}
                  onCreatePlayerProfile={async (payload) => {
                    const res = await createPlayerProfileApi(payload);
                    if (res.messageAr) showToast(res.messageAr);
                    await refreshState();
                    return res.profile;
                  }}
                  onUpdatePlayerProfile={async (id, payload) => {
                    const res = await updatePlayerProfileApi(id, payload);
                    if (res.messageAr) showToast(res.messageAr);
                    await refreshState();
                    return res.profile;
                  }}
                  onMergePlayerProfiles={async (payload) => {
                    const res = await mergePlayerProfilesApi(payload);
                    if (res.messageAr) showToast(res.messageAr);
                    await refreshState();
                    return res.profile;
                  }}
                  onLinkPlayerDiscord={async (playerId, payload) => {
                    const res = await linkPlayerDiscordApi(playerId, payload);
                    if (res.messageAr) showToast(res.messageAr);
                    await refreshState();
                  }}
                  onNotify={showToast}
                />
              )}
              </Suspense>
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
      <Suspense fallback={null}>
        {showRegisterModal && state?.tournament && (
        <RegisterPlayerModal
          gameTitle={state.tournament.gameTitle}
          tournamentName={state.tournament.name}
          discordProfile={activeDiscordProfile}
          onStartDiscordLogin={() => startDiscordLogin('/?register=1')}
          onLogoutDiscord={handleLogoutDiscord}
          onClose={() => setShowRegisterModal(false)}
          onSubmit={async (payload: {
            name: string;
            elysiumNetId: string;
            xeMoNetId?: string;
            avatarUrl: string | null;
            level: PlayerLevel;
            clubName: string;
            useDiscordIdentity?: boolean;
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
            bestOf={state?.tournament?.bestOf ?? 1}
            onClose={() => setEditingMatch(null)}
            onSave={async (payload) => {
              await runAction(() => updateMatchScoreApi(editingMatch.id, payload));
              setEditingMatch(null);
            }}
            onWalkover={async (winnerSlot, reason) => {
              await runAction(() => walkoverMatchApi(editingMatch.id, winnerSlot, reason));
              setEditingMatch(null);
            }}
            onResolveDispute={async (resolutionNote) => {
              await runAction(() => resolveMatchDisputeApi(editingMatch.id, resolutionNote));
              setEditingMatch(null);
            }}
          />
        )}

      {editingRace && state?.tournament && (
        <RaceResultsModal
          race={editingRace}
          approvedPlayers={state.approvedPlayers}
          pointsConfig={state.tournament.racingPointsConfig}
          onClose={() => setEditingRace(null)}
          onSave={async (payload) => {
            await runAction(() => saveRaceResultsApi(editingRace.id, payload));
            setEditingRace(null);
          }}
        />
      )}

      {disputeMatch && (
        <DisputeMatchModal
          match={disputeMatch}
          player1={disputeMatch.player1Id ? playersById.get(disputeMatch.player1Id) ?? null : null}
          player2={disputeMatch.player2Id ? playersById.get(disputeMatch.player2Id) ?? null : null}
          onClose={() => setDisputeMatch(null)}
          onSubmit={async (payload) => {
            await runAction(() => submitMatchDisputeApi(disputeMatch.id, payload));
            setDisputeMatch(null);
          }}
        />
      )}

      {profilePlayer && state && (
        <PlayerProfileModal
          player={profilePlayer}
          stats={state.playerStats.find((s) => s.player.id === profilePlayer.id) ?? null}
          seasonEntry={
            (state.seasonLeaderboard || []).find(
              (e) => e.elysiumNetId.trim().toLowerCase() === profilePlayer.elysiumNetId.trim().toLowerCase()
            ) ?? null
          }
          matches={state.allMatches}
          playersById={playersById}
          scoreUnitLabel={state.tournament?.scoreUnitLabel || 'نقطة'}
          onClose={() => setProfilePlayer(null)}
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
      </Suspense>

      {toast && (
        <div className="toast-banner" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
