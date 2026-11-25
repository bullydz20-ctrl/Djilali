import {
  AlertTriangle,
  Award,
  Bell,
  Clock,
  Crown,
  Gamepad2,
  Lock,
  Medal,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Trophy,
  UserPlus,
  Users
} from 'lucide-react';
import { EmptyStatePanel, PlayerAvatar, StatusPill } from '../components/PlayerAvatar';
import { MatchResultsTable } from '../components/MatchResultsTable';
import { RacingOverviewPanel, isRacingFormat } from '../components/RacingSection';
import {
  FORMAT_LABELS,
  PLAY_MODE_LABELS,
  STATUS_LABELS,
  TIE_RULE_LABELS,
  adminHasPermission
} from '../types';
import type { ArenaState, Match, Player, RaceEntry, RaceStage } from '../types';

export function HomeScreen({
  state,
  onOpenRegister,
  onEditMatch,
  onQuickUpdateGoals,
  onOpenExportShare,
  onOpenReminder,
  onCancelReminder,
  onToggleCheckIn,
  onVotePrediction,
  onOpenDispute,
  onOpenPlayerProfile,
  onCelebrateChampion,
  onOpenAdmin,
  onCreateRace,
  onEditRace,
  onGenerateFinalRace,
  onDeleteRace
}: {
  state: ArenaState;
  onOpenRegister: () => void;
  onEditMatch: (m: Match) => void;
  onQuickUpdateGoals: (m: Match, g1: number, g2: number) => void;
  onOpenExportShare: () => void;
  onOpenReminder: (m: Match) => void;
  onCancelReminder: (matchId: number) => void;
  onToggleCheckIn: (m: Match, slot: 1 | 2) => void;
  onVotePrediction: (m: Match, slot: 1 | 2) => void;
  onOpenDispute: (m: Match) => void;
  onOpenPlayerProfile: (player: Player) => void;
  onCelebrateChampion: () => void;
  onOpenAdmin?: () => void;
  onCreateRace?: (payload: { title?: string; stage?: RaceStage; trackName?: string }) => Promise<void>;
  onEditRace?: (race: RaceEntry) => void;
  onGenerateFinalRace?: (payload?: { title?: string; trackName?: string; qualifiersCount?: number }) => Promise<void>;
  onDeleteRace?: (raceId: number) => Promise<void>;
}) {
  const t = state.tournament;
  const playersById = new Map<number, Player>(state.players.map((p) => [p.id, p]));
  const remindersByMatchId = new Map(state.matchReminders.map((r) => [r.matchId, r]));
  const canEditScores = adminHasPermission(state.currentAdmin, 'EDIT_SCORES');
  const canRunDraw = adminHasPermission(state.currentAdmin, 'RUN_DRAW');

  if (!t) {
    return (
      <EmptyStatePanel
        icon={<Trophy size={28} />}
        title="لا توجد بطولة نشطة حالياً"
        subtitle="يمكن للمشرف إنشاء بطولة جديدة لأي لعبة من لوحة الإدارة."
        actionLabel={onOpenAdmin ? 'إنشاء بطولة من الإدارة' : undefined}
        onAction={onOpenAdmin}
      />
    );
  }

  const unit = t.scoreUnitLabel || 'نقطة';
  const statusColor =
    t.status === 'REGISTRATION_OPEN'
      ? 'var(--emerald-win)'
      : t.status === 'GROUP_STAGE' || t.status === 'KNOCKOUT_STAGE'
      ? 'var(--cyber-sky)'
      : 'var(--championship-gold)';

  const progressPct =
    t.maxParticipants > 0
      ? Math.min(100, Math.round((state.approvedPlayers.length / t.maxParticipants) * 100))
      : 0;

  const topPlayers = state.playerStats.filter((s) => s.matchesPlayed > 0).slice(0, 5);
  const orderedMatches = [...state.allMatches].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    return b.roundNumber - a.roundNumber;
  });

  return (
    <div className="stack-col">
      {/* Hero Banner Card */}
      <div className="arena-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 22 }}>
        <div style={{ position: 'relative', height: 205 }}>
          <img
            src={t.bannerUrl || '/images/default-banner.jpg'}
            alt={t.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(7,9,19,0.22) 0%, rgba(7,9,19,0.74) 60%, var(--midnight-surface) 100%)'
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              left: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap'
            }}
          >
            <StatusPill text={STATUS_LABELS[t.status]} color={statusColor} />
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 11px',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 700,
                background: 'rgba(15, 21, 40, 0.88)',
                border: '1px solid var(--electric-cobalt)',
                color: 'var(--cyber-sky)'
              }}
            >
              <Gamepad2 size={14} />
              <span>{t.gameTitle}</span>
            </span>
          </div>

          <div style={{ position: 'absolute', bottom: 12, right: 16, left: 16 }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {t.name}
            </h2>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {t.description}
            </p>
          </div>
        </div>

        <div style={{ padding: 16 }} className="stack-col">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', fontWeight: 700 }}>
              <Users size={17} color="var(--cyber-sky)" />
              <span>
                المشاركون المعتمدون: {state.approvedPlayers.length} / {t.maxParticipants}
              </span>
            </div>
            {state.pendingPlayers.length > 0 && (
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--championship-gold)' }}>
                {state.pendingPlayers.length} قيد المراجعة
              </span>
            )}
          </div>

          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: 'var(--elevated-navy)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: progressPct >= 100 ? 'var(--championship-gold)' : 'var(--electric-cobalt)',
                transition: 'width 0.3s ease'
              }}
            />
          </div>

          <div className="grid-2">
            <div className="arena-subcard" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem' }}>
              <Clock size={15} color="var(--cyber-sky)" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.startDateTime || 'يُحدد لاحقاً'}
              </span>
            </div>
            <div className="arena-subcard" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem' }}>
              <Gamepad2 size={15} color="var(--cyber-sky)" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {FORMAT_LABELS[t.format]}
              </span>
            </div>
          </div>

          {state.isRegistrationOpenNow ? (
            <button type="button" className="btn btn-primary" onClick={onOpenRegister}>
              <UserPlus size={18} />
              <span>سجّل في البطولة الآن</span>
            </button>
          ) : (
            <button type="button" className="btn btn-outline" disabled>
              <Lock size={16} color="var(--championship-gold)" />
              <span style={{ color: 'var(--championship-gold)' }}>
                {state.approvedPlayers.length >= t.maxParticipants
                  ? 'التسجيل مغلق لاكتمال العدد'
                  : 'التسجيل مغلق حالياً'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Champion Showcase */}
      {state.championPlayer && (
        <div
          className="arena-card arena-card-gold"
          style={{
            background:
              'linear-gradient(110deg, rgba(245,184,46,0.22), rgba(124,58,237,0.18), rgba(37,99,235,0.18))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: 'rgba(245,184,46,0.2)',
                border: '1.5px solid var(--championship-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Trophy size={28} color="var(--championship-gold)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--championship-gold)' }}>
                بطل البطولة المتوّج
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{state.championPlayer.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--cyber-sky)' }}>
                ElysiumNet/ XeMoNat: {state.championPlayer.elysiumNetId}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="icon-btn"
                onClick={onCelebrateChampion}
                title="إطلاق مؤثرات التتويج"
                style={{ color: 'var(--championship-gold)', borderColor: 'var(--championship-gold)' }}
              >
                <Sparkles size={17} />
              </button>
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => onOpenPlayerProfile(state.championPlayer!)}
              >
                <PlayerAvatar
                  avatarUrl={state.championPlayer.avatarUrl}
                  name={state.championPlayer.name}
                  size={56}
                  borderColor="var(--championship-gold)"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rules Card */}
      {(() => {
        const gamePreset = (state.gameCatalog || []).find(
          (g) => g.label.toLowerCase() === t.gameTitle.trim().toLowerCase()
        );
        const isRacing = isRacingFormat(t.format);
        const modeText =
          t.playMode === 'TEAMS'
            ? `${PLAY_MODE_LABELS.TEAMS} (${t.teamSize} ضد ${t.teamSize})`
            : PLAY_MODE_LABELS[t.playMode || 'SOLO_1V1'];

        return (
          <div className="arena-card stack-col" style={{ gap: 10 }}>
            <div style={{ fontWeight: 800, color: 'var(--championship-gold)', fontSize: '1rem' }}>
              قوانين ونظام البطولة ({t.gameTitle})
            </div>
            <div className="grid-2">
              <RuleItem icon={<Users size={15} />} title="نمط اللعب" value={modeText} />
              <RuleItem icon={<Award size={15} />} title="نظام الحسم واللعب" value={t.targetGoalsRule} />
              {isRacing ? (
                <RuleItem
                  icon={<Clock size={15} />}
                  title="نظام السباقات"
                  value={t.format === 'RACE_QUALIFIERS_FINAL' ? `تصفيات ثم نهائي (${t.qualifiersPerGroup})` : 'نقاط وترتيب'}
                />
              ) : (
                <RuleItem
                  icon={<Trophy size={15} />}
                  title={t.bestOf > 1 ? 'نظام المواجهة' : 'الأدوار الإقصائية'}
                  value={t.bestOf > 1 ? `Best of ${t.bestOf}` : TIE_RULE_LABELS[t.knockoutTieRule].short}
                />
              )}
              <RuleItem icon={<Clock size={15} />} title="مدة الجلسة" value={`${t.matchDurationMinutes} دقيقة`} />
            </div>

            {gamePreset && (
              <div
                className="arena-subcard stack-col"
                style={{
                  gap: 4,
                  borderColor:
                    gamePreset.onlineStatus === 'LOCAL_OR_LAN_ONLY'
                      ? 'rgba(245, 184, 46, 0.55)'
                      : 'rgba(56, 189, 248, 0.45)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color:
                      gamePreset.onlineStatus === 'LOCAL_OR_LAN_ONLY'
                        ? 'var(--championship-gold)'
                        : 'var(--cyber-sky)'
                  }}
                >
                  {gamePreset.onlineStatus === 'LOCAL_OR_LAN_ONLY' ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <ShieldCheck size={14} />
                  )}
                  <span>{gamePreset.onlineStatusLabelAr}</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {gamePreset.compatibilityNoteAr}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Overview Statistics */}
      <div style={{ fontWeight: 800, fontSize: '1.08rem' }}>إحصائيات البطولة وأفضل اللاعبين</div>
      <div className="grid-2">
        <StatCard
          icon={<Trophy size={17} color="var(--cyber-sky)" />}
          label={`إجمالي (${unit})`}
          value={String(state.overviewStats.totalGoals)}
          subtext={`في ${state.overviewStats.completedMatches} / ${state.overviewStats.totalMatches} مباراة`}
          accent="var(--cyber-sky)"
        />
        <StatCard
          icon={<Star size={17} color="var(--championship-gold)" />}
          label="الأكثر تسجيلاً"
          value={state.overviewStats.topScorer?.player.name || '—'}
          subtext={
            state.overviewStats.topScorer
              ? `${state.overviewStats.topScorer.goalsScored} ${unit}`
              : 'بانتظار المباريات'
          }
          accent="var(--championship-gold)"
        />
        <StatCard
          icon={<Shield size={17} color="var(--emerald-win)" />}
          label="أقوى دفاع"
          value={state.overviewStats.bestDefense?.player.name || '—'}
          subtext={
            state.overviewStats.bestDefense
              ? `استقبل ${state.overviewStats.bestDefense.goalsConceded} • نظيفة ${state.overviewStats.bestDefense.cleanSheets}`
              : 'بانتظار المباريات'
          }
          accent="var(--emerald-win)"
        />
        <StatCard
          icon={<TrendingUp size={17} color="var(--royal-violet)" />}
          label="أعلى نسبة فوز"
          value={state.overviewStats.highestWinRate?.player.name || '—'}
          subtext={
            state.overviewStats.highestWinRate
              ? `${state.overviewStats.highestWinRate.winRatePercent}% (${state.overviewStats.highestWinRate.wins} فوز)`
              : 'بانتظار المباريات'
          }
          accent="var(--royal-violet)"
        />
      </div>

      {topPlayers.length > 0 && (
        <div className="stack-col" style={{ gap: 8 }}>
          {topPlayers.map((s) => (
            <div
              key={s.player.id}
              className="arena-card"
              role="button"
              tabIndex={0}
              onClick={() => onOpenPlayerProfile(s.player)}
              style={{
                padding: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PlayerAvatar avatarUrl={s.player.avatarUrl} name={s.player.name} size={40} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{s.player.name}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    {s.wins} فوز • {s.draws} تعادل • {s.losses} خسارة
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="score-num" style={{ fontSize: '1.35rem', color: 'var(--championship-gold)' }}>
                  {s.goalsScored}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{unit}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live Match Results or Racing Standings */}
      {isRacingFormat(t.format) ? (
        <RacingOverviewPanel
          state={state}
          canEdit={canEditScores}
          canRunDraw={canRunDraw}
          onCreateRace={onCreateRace}
          onEditRace={onEditRace}
          onGenerateFinalRace={onGenerateFinalRace}
          onDeleteRace={onDeleteRace}
        />
      ) : (
        <>
          <div style={{ fontWeight: 800, fontSize: '1.08rem' }}>جدول المباريات والنتائج المباشرة</div>
          {state.allMatches.length === 0 ? (
            <EmptyStatePanel
              icon={<Gamepad2 size={28} />}
              title="لم تبدأ القرعة بعد"
              subtitle="عند اعتماد اللاعبين وإجراء القرعة من لوحة المشرف، ستظهر جميع المباريات والنتائج المباشرة هنا لجميع الأجهزة."
            />
          ) : (
            <MatchResultsTable
              matches={orderedMatches}
              playersById={playersById}
              canEdit={canEditScores}
              scoreUnitLabel={unit}
              remindersByMatchId={remindersByMatchId}
              onQuickUpdateGoals={onQuickUpdateGoals}
              onOpenDetailedEditor={onEditMatch}
              onOpenReminder={onOpenReminder}
              onToggleCheckIn={onToggleCheckIn}
              onVotePrediction={onVotePrediction}
              onOpenDispute={onOpenDispute}
              maxVisibleRows={12}
            />
          )}
        </>
      )}

      {/* Season Leaderboard */}
      {state.seasonLeaderboard?.length > 0 && (
        <div className="arena-card stack-col" style={{ gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--championship-gold)', fontWeight: 800 }}>
              <Crown size={18} />
              <span>الترتيب العام للموسم (جميع البطولات)</span>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              {state.seasonLeaderboard.length} لاعب
            </span>
          </div>
          <div className="stack-col" style={{ gap: 7 }}>
            {state.seasonLeaderboard.slice(0, 8).map((entry) => (
              <div
                key={entry.elysiumNetId}
                className="arena-subcard"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  borderColor: entry.rank === 1 ? 'rgba(245,184,46,0.55)' : 'var(--card-border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span
                    className="score-num"
                    style={{
                      width: 26,
                      textAlign: 'center',
                      fontSize: '1rem',
                      color: entry.rank <= 3 ? 'var(--championship-gold)' : 'var(--text-secondary)'
                    }}
                  >
                    #{entry.rank}
                  </span>
                  <PlayerAvatar avatarUrl={entry.avatarUrl} name={entry.displayName} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.displayName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {entry.titles > 0 ? `🏆 ${entry.titles} • ` : ''}
                      {entry.wins} فوز • {entry.tournamentsCount} بطولات
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'left', flexShrink: 0 }}>
                  <div className="score-num" style={{ fontSize: '1.1rem', color: 'var(--championship-gold)' }}>
                    {entry.seasonPoints}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--cyber-sky)' }}>نقطة</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hall of Fame */}
      {state.hallOfFame?.length > 0 && (
        <div className="arena-card arena-card-gold stack-col" style={{ gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--championship-gold)', fontWeight: 800 }}>
            <Medal size={18} />
            <span>سجل البطولات الذهبي (Hall of Fame)</span>
          </div>
          <div className="stack-col" style={{ gap: 8 }}>
            {state.hallOfFame.map((item) => (
              <div key={item.tournamentId} className="arena-subcard stack-col" style={{ gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{item.tournamentName}</div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--cyber-sky)', fontWeight: 700 }}>{item.gameTitle}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--championship-gold)', fontWeight: 800 }}>
                    🥇 البطل: {item.championName}
                  </span>
                  {item.runnerUpName && (
                    <span style={{ color: 'var(--text-primary)' }}>🥈 الوصيف: {item.runnerUpName}</span>
                  )}
                  {item.thirdPlaceName && (
                    <span style={{ color: 'var(--cyber-sky)' }}>🥉 الثالث: {item.thirdPlaceName}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {item.completedMatches} مباراة مكتملة • {item.totalGoals} هدف/نقطة
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Reminders */}
      {state.matchReminders.length > 0 && (
        <div className="arena-card stack-col" style={{ gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--championship-gold)', fontWeight: 800 }}>
            <Bell size={18} />
            <span>التنبيهات ومواعيد المباريات المجدولة ({state.matchReminders.length})</span>
          </div>
          {state.matchReminders.map((rem) => (
            <div
              key={rem.id}
              className="arena-subcard"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{rem.matchTitle}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cyber-sky)' }}>
                  {rem.matchStageLabel} • {new Date(rem.scheduledAtMillis).toLocaleString('ar-EG')} (تنبيه قبل {rem.leadMinutes} د)
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onCancelReminder(rem.matchId)}
                aria-label="إلغاء التذكير"
                style={{ color: 'var(--crimson-loss)' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Export & Share Card */}
      <div className="arena-card arena-card-gold" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>تصدير ومشاركة نتائج البطولة</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            نزّل ملف النتائج النصي (.txt) أو شارك ملخص البطولة مباشرة
          </div>
        </div>
        <button type="button" className="btn btn-gold" onClick={onOpenExportShare}>
          <Share2 size={17} />
          <span>تصدير / مشاركة</span>
        </button>
      </div>
    </div>
  );
}

function RuleItem({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="arena-subcard">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--cyber-sky)', fontSize: '0.76rem' }}>
        {icon}
        <span style={{ color: 'var(--text-secondary)' }}>{title}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: '0.84rem', marginTop: 4 }}>{value}</div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  accent
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  accent: string;
}) {
  return (
    <div className="arena-card" style={{ padding: 12, borderColor: accent }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        {icon}
        <span>{label}</span>
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: '1.05rem',
          marginTop: 6,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: accent, marginTop: 2 }}>{subtext}</div>
    </div>
  );
}
