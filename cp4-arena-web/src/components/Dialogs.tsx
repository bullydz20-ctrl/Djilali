import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BellRing,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Flag,
  ImagePlus,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Smartphone,
  Swords,
  Trophy,
  User,
  UserPlus,
  X
} from 'lucide-react';
import { uploadImageFileApi } from '../api';
import { LEVEL_LABELS, RACE_STAGE_LABELS, STAGE_LABELS } from '../types';
import type {
  FriendlyMatch,
  Match,
  MatchReminder,
  Player,
  PlayerLevel,
  PlayerProfile,
  PlayerStats,
  PlayerUnifiedStats,
  PlayerVictimEntry,
  RaceEntry,
  SeasonLeaderboardEntry
} from '../types';
import { VictimsProfileSection } from './FriendlyMatchModal';
import { PlayerAvatar } from './PlayerAvatar';
import { DiscordLogoIcon } from './TopHeader';

export function RegisterPlayerModal({
  gameTitle,
  tournamentName,
  discordProfile = null,
  onStartDiscordLogin,
  onLogoutDiscord,
  onClose,
  onSubmit
}: {
  gameTitle: string;
  tournamentName: string;
  discordProfile?: PlayerProfile | null;
  onStartDiscordLogin: () => void;
  onLogoutDiscord: () => Promise<void> | void;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    elysiumNetId: string;
    xeMoNetId?: string;
    avatarUrl: string | null;
    level: PlayerLevel;
    clubName: string;
    useDiscordIdentity?: boolean;
  }) => Promise<void>;
}) {
  const [elysiumId, setElysiumId] = useState(discordProfile?.elysiumNetId || '');
  const [xeMoNetId, setXeMoNetId] = useState(discordProfile?.xeMoNetId || '');
  const [clubName, setClubName] = useState('');
  const [level, setLevel] = useState<PlayerLevel>('INTERMEDIATE');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (discordProfile) {
      if (discordProfile.elysiumNetId && !elysiumId.trim()) {
        setElysiumId(discordProfile.elysiumNetId);
      }
      if (discordProfile.xeMoNetId && !xeMoNetId.trim()) {
        setXeMoNetId(discordProfile.xeMoNetId);
      }
    }
  }, [discordProfile?.id, discordProfile?.elysiumNetId, discordProfile?.xeMoNetId]);

  const effectiveName = discordProfile ? discordProfile.name : '';
  const effectiveAvatar = discordProfile ? (discordProfile.avatarUrl ?? null) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!discordProfile || !effectiveName || !elysiumId.trim()) return;
    setErr('');
    setSubmitting(true);
    try {
      await onSubmit({
        name: effectiveName,
        elysiumNetId: elysiumId.trim(),
        xeMoNetId: xeMoNetId.trim(),
        avatarUrl: effectiveAvatar,
        level,
        clubName: clubName.trim(),
        useDiscordIdentity: true
      });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'فشل إرسال الطلب.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()} data-testid="register_player_modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.15rem' }}>
              التسجيل في بطولة {gameTitle}
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{tournamentName}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        {!discordProfile ? (
          <div className="stack-col" data-testid="register_discord_gate">
            <div
              className="arena-subcard stack-col"
              style={{
                gap: 12,
                borderColor: 'rgba(88, 101, 242, 0.55)',
                background: 'rgba(88, 101, 242, 0.12)',
                padding: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--championship-gold)', fontWeight: 800, fontSize: '0.94rem' }}>
                <ShieldCheck size={18} />
                <span>المشاركة تتطلب ربط حساب Discord</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                تعتمد منصة CP4 ARENA على Discord كهوية موحدة للاعبين لمنع التكرار وحفظ رقم CP4 الثابت ونتائجك. اربط حسابك للمتابعة إلى نموذج التسجيل، أو واصل تصفح البطولات بحرية كزائر.
              </div>
              <button
                type="button"
                className="btn"
                onClick={onStartDiscordLogin}
                data-testid="register_discord_login_btn"
                style={{
                  width: '100%',
                  background: '#5865F2',
                  borderColor: '#7289DA',
                  color: '#FFFFFF',
                  fontWeight: 800
                }}
              >
                <DiscordLogoIcon size={18} />
                <span>تسجيل الدخول عبر Discord</span>
              </button>
            </div>

            <button type="button" className="btn btn-outline" onClick={onClose}>
              إغلاق والمتابعة كزائر
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="stack-col">
            <div
              className="arena-subcard stack-col"
              data-testid="register_discord_identity_card"
              style={{
                gap: 8,
                borderColor: 'rgba(88, 101, 242, 0.7)',
                background: 'rgba(88, 101, 242, 0.12)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <PlayerAvatar avatarUrl={discordProfile.avatarUrl} name={discordProfile.name} size={52} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                        {discordProfile.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 7px',
                          borderRadius: 999,
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: 'var(--emerald-win)',
                          fontWeight: 700
                        }}
                      >
                        موثق عبر Discord
                      </span>
                    </div>
                    <div className="score-num" style={{ fontSize: '0.74rem', color: 'var(--cyber-sky)', marginTop: 2 }}>
                      {discordProfile.cp4Id}
                      {discordProfile.discordUserId ? ` • Discord: ${discordProfile.discordUserId}` : ''}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '5px 9px', fontSize: '0.74rem', flexShrink: 0 }}
                  onClick={() => onLogoutDiscord()}
                >
                  تبديل الحساب
                </button>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                تم جلب الاسم والصورة ومعرف Discord تلقائياً من حسابك الموحد. أكمل معرف اللعب أدناه لإرسال طلبك.
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">معرف اللاعب في ElysiumNet / XeMoNet *</label>
              <input
                className="input"
                value={elysiumId}
                onChange={(e) => setElysiumId(e.target.value)}
                placeholder="أدخل معرف ElysiumNet / XeMoNet الإلزامي"
                required
                data-testid="register_elysium_input"
              />
            </div>

            <div className="field-group">
              <label className="field-label">معرف XeMoNet إضافي (اختياري)</label>
              <input
                className="input"
                value={xeMoNetId}
                onChange={(e) => setXeMoNetId(e.target.value)}
                placeholder="إذا كان لديك معرف مختلف على XeMoNet"
              />
            </div>

            <div className="field-group">
              <label className="field-label">الفريق / الشخصية المفضلة (اختياري)</label>
              <input
                className="input"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="نادي، منتخب، أو فئة اللعب"
              />
            </div>

            <div className="field-group">
              <label className="field-label">المستوى المبدئي (قابل للتعديل من المشرف)</label>
              <div className="chip-row">
                {(['BEGINNER', 'INTERMEDIATE', 'PRO', 'LEGEND'] as PlayerLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`chip ${level === lvl ? 'selected' : ''}`}
                    onClick={() => setLevel(lvl)}
                  >
                    {LEVEL_LABELS[lvl].label} ({LEVEL_LABELS[lvl].ovr})
                  </button>
                ))}
              </div>
            </div>

            {err && (
              <div style={{ color: 'var(--crimson-loss)', fontSize: '0.84rem', fontWeight: 700 }}>{err}</div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={submitting || !effectiveName || !elysiumId.trim()}
              >
                {submitting ? 'جاري الإرسال...' : 'إرسال طلب التسجيل'}
              </button>
              <button type="button" className="btn btn-outline" onClick={onClose}>
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function ScoreEntryModal({
  match,
  player1,
  player2,
  scoreUnitLabel,
  bestOf = 1,
  onClose,
  onSave,
  onWalkover,
  onResolveDispute
}: {
  match: Match;
  player1: Player;
  player2: Player;
  scoreUnitLabel: string;
  bestOf?: 1 | 3 | 5;
  onClose: () => void;
  onSave: (payload: {
    leg1Score1: number | null;
    leg1Score2: number | null;
    leg2Score1: number | null;
    leg2Score2: number | null;
    penaltyScore1: number | null;
    penaltyScore2: number | null;
  }) => Promise<void>;
  onWalkover?: (winnerSlot: 1 | 2, reason: string) => Promise<void>;
  onResolveDispute?: (resolutionNote: string) => Promise<void>;
}) {
  const [l1s1, setL1s1] = useState(match.leg1Score1 != null ? String(match.leg1Score1) : '');
  const [l1s2, setL1s2] = useState(match.leg1Score2 != null ? String(match.leg1Score2) : '');
  const [l2s1, setL2s1] = useState(match.leg2Score1 != null ? String(match.leg2Score1) : '');
  const [l2s2, setL2s2] = useState(match.leg2Score2 != null ? String(match.leg2Score2) : '');
  const [p1, setP1] = useState(match.penaltyScore1 != null ? String(match.penaltyScore1) : '');
  const [p2, setP2] = useState(match.penaltyScore2 != null ? String(match.penaltyScore2) : '');
  const [walkoverReason, setWalkoverReason] = useState(match.walkoverReason || 'عدم الحضور في الموعد');
  const [resolutionNote, setResolutionNote] = useState('');
  const [saving, setSaving] = useState(false);

  const isKnockout = match.stage !== 'GROUP' && match.stage !== 'LEAGUE';
  const toInt = (v: string) => (v.trim() === '' ? null : Number(v));
  const s1i = toInt(l1s1);
  const s2i = toInt(l1s2);
  const l2s1i = toInt(l2s1);
  const l2s2i = toInt(l2s2);

  const isTiedForKnockout =
    isKnockout &&
    (match.isTwoLegged
      ? s1i != null && s2i != null && l2s1i != null && l2s2i != null && s1i + l2s1i === s2i + l2s2i
      : s1i != null && s2i != null && s1i === s2i);

  async function submitScores(clearAll = false) {
    setSaving(true);
    try {
      if (clearAll) {
        await onSave({
          leg1Score1: null,
          leg1Score2: null,
          leg2Score1: null,
          leg2Score2: null,
          penaltyScore1: null,
          penaltyScore2: null
        });
      } else {
        await onSave({
          leg1Score1: s1i,
          leg1Score2: s2i,
          leg2Score1: match.isTwoLegged ? l2s1i : null,
          leg2Score2: match.isTwoLegged ? l2s2i : null,
          penaltyScore1: isTiedForKnockout ? toInt(p1) : null,
          penaltyScore2: isTiedForKnockout ? toInt(p2) : null
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.1rem' }}>
              تسجيل / تعديل النتيجة ({scoreUnitLabel})
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {STAGE_LABELS[match.stage].label} • {player1.name} ضد {player2.name}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="field-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <label className="field-label" style={{ color: 'var(--cyber-sky)', margin: 0 }}>
              {match.isTwoLegged ? 'مباراة الذهاب' : 'النتيجة النهائية'}
            </label>
            {bestOf > 1 && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(245,184,46,0.16)',
                  color: 'var(--championship-gold)',
                  fontSize: '0.74rem',
                  fontWeight: 800
                }}
              >
                نظام Best of {bestOf} (الفوز بـ {Math.ceil(bestOf / 2)} جولات)
              </span>
            )}
          </div>
          {bestOf > 1 && !match.isTwoLegged && (
            <div className="chip-row" style={{ marginTop: 6 }}>
              {(bestOf === 3
                ? [
                    [2, 0],
                    [2, 1],
                    [1, 2],
                    [0, 2]
                  ]
                : [
                    [3, 0],
                    [3, 1],
                    [3, 2],
                    [2, 3],
                    [1, 3],
                    [0, 3]
                  ]
              ).map(([a, b]) => (
                <button
                  key={`${a}-${b}`}
                  type="button"
                  className={`chip ${l1s1 === String(a) && l1s2 === String(b) ? 'selected-gold' : ''}`}
                  onClick={() => {
                    setL1s1(String(a));
                    setL1s2(String(b));
                  }}
                >
                  {a} - {b}
                </button>
              ))}
            </div>
          )}
          <div className="grid-2" style={{ marginTop: 6 }}>
            <div>
              <div className="field-label" style={{ marginBottom: 4 }}>{player1.name}</div>
              <input className="input score-num" type="number" min={0} max={999} value={l1s1} onChange={(e) => setL1s1(e.target.value)} />
            </div>
            <div>
              <div className="field-label" style={{ marginBottom: 4 }}>{player2.name}</div>
              <input className="input score-num" type="number" min={0} max={999} value={l1s2} onChange={(e) => setL1s2(e.target.value)} />
            </div>
          </div>
        </div>

        {match.isTwoLegged && (
          <div className="field-group">
            <label className="field-label" style={{ color: 'var(--cyber-sky)' }}>مباراة الإياب</label>
            <div className="grid-2">
              <input className="input score-num" type="number" min={0} max={999} placeholder={player1.name} value={l2s1} onChange={(e) => setL2s1(e.target.value)} />
              <input className="input score-num" type="number" min={0} max={999} placeholder={player2.name} value={l2s2} onChange={(e) => setL2s2(e.target.value)} />
            </div>
          </div>
        )}

        {isTiedForKnockout && (
          <div className="field-group">
            <label className="field-label" style={{ color: 'var(--championship-gold)' }}>
              تعادل — نتيجة الحسم الإضافي / ركلات الترجيح
            </label>
            <div className="grid-2">
              <input className="input score-num" type="number" min={0} max={99} placeholder={`ترجيح ${player1.name}`} value={p1} onChange={(e) => setP1(e.target.value)} />
              <input className="input score-num" type="number" min={0} max={99} placeholder={`ترجيح ${player2.name}`} value={p2} onChange={(e) => setP2(e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={() => submitScores(false)}>
            {saving ? 'جاري الحفظ...' : 'حفظ النتيجة'}
          </button>
          {match.leg1Score1 != null && (
            <button type="button" className="btn btn-danger-outline" disabled={saving} onClick={() => submitScores(true)}>
              مسح
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إلغاء
          </button>
        </div>

        {onWalkover && (
          <div className="arena-subcard stack-col" style={{ gap: 8, borderColor: 'rgba(245, 184, 46, 0.4)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--championship-gold)' }}>
              فوز بالانسحاب / الغياب (3 - 0)
            </div>
            <input
              className="input"
              value={walkoverReason}
              onChange={(e) => setWalkoverReason(e.target.value)}
              placeholder="سبب الانسحاب (اختياري)"
            />
            <div className="grid-2">
              <button
                type="button"
                className="btn btn-outline"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onWalkover(1, walkoverReason);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                فوز {player1.name} (3-0)
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onWalkover(2, walkoverReason);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                فوز {player2.name} (3-0)
              </button>
            </div>
          </div>
        )}

        {match.disputeStatus === 'OPEN' && (
          <div className="arena-subcard stack-col" style={{ gap: 8, borderColor: 'var(--crimson-loss)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--crimson-loss)', fontWeight: 800, fontSize: '0.86rem' }}>
              <AlertTriangle size={16} />
              <span>طعن / إثبات مفتوح ({match.disputeSubmittedBy})</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{match.disputeNote}</div>
            {match.disputeScreenshotUrl && (
              <a
                href={match.disputeScreenshotUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.78rem', color: 'var(--cyber-sky)', fontWeight: 700 }}
              >
                عرض صورة الإثبات المرفقة ↗
              </a>
            )}
            {onResolveDispute && (
              <>
                <input
                  className="input"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="قرار المشرف (اختياري)"
                />
                <button
                  type="button"
                  className="btn btn-gold"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await onResolveDispute(resolutionNote);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>اعتماد وحسم الطعن</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MatchReminderModal({
  match,
  player1,
  player2,
  existing,
  onClose,
  onSave,
  onCancel
}: {
  match: Match;
  player1: Player | null;
  player2: Player | null;
  existing: MatchReminder | null;
  onClose: () => void;
  onSave: (payload: { matchId: number; matchTitle: string; scheduledAtMillis: number; leadMinutes: number }) => Promise<void>;
  onCancel: (matchId: number) => Promise<void>;
}) {
  const defaultDate = new Date(existing?.scheduledAtMillis ?? Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultLocal = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}T${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`;

  const [dateTimeLocal, setDateTimeLocal] = useState(defaultLocal);
  const [leadMinutes, setLeadMinutes] = useState(existing?.leadMinutes ?? 15);
  const [saving, setSaving] = useState(false);

  const matchTitle = `${player1?.name || 'اللاعب 1'} ضد ${player2?.name || 'اللاعب 2'}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const millis = new Date(dateTimeLocal).getTime();
    if (!Number.isFinite(millis)) return;
    setSaving(true);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission().catch(() => undefined);
      }
      await onSave({ matchId: match.id, matchTitle, scheduledAtMillis: millis, leadMinutes });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellRing size={20} color="var(--championship-gold)" />
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.08rem' }}>
              جدولة موعد وتذكير المباراة
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--cyber-sky)', fontWeight: 700 }}>{matchTitle}</div>

        <form onSubmit={handleSubmit} className="stack-col">
          <div className="field-group">
            <label className="field-label">تاريخ ووقت المباراة</label>
            <input
              type="datetime-local"
              className="input"
              value={dateTimeLocal}
              onChange={(e) => setDateTimeLocal(e.target.value)}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">التذكير قبل الموعد بـ</label>
            <div className="chip-row">
              {[5, 10, 15, 30, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`chip ${leadMinutes === m ? 'selected' : ''}`}
                  onClick={() => setLeadMinutes(m)}
                >
                  {m} دقيقة
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ التذكير'}
            </button>
            {existing && (
              <button type="button" className="btn btn-danger-outline" onClick={() => onCancel(match.id)}>
                حذف
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export function ExportShareModal({
  tournamentId,
  onClose,
  onNotify
}: {
  tournamentId: number;
  onClose: () => void;
  onNotify: (msg: string) => void;
}) {
  const [data, setData] = useState<{ fileName: string; fullText: string; socialText: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/tournaments/${tournamentId}/export`)
      .then((r) => r.json())
      .then((res) => {
        if (active && res.ok) setData(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tournamentId]);

  function downloadTxt() {
    if (!data) return;
    const blob = new Blob([data.fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.fileName;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('تم تنزيل ملف ملخص النتائج بنجاح.');
  }

  async function shareSocial() {
    if (!data) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'نتائج CP4 ARENA', text: data.socialText });
        return;
      } catch {
        // user cancelled or unsupported
      }
    }
    await navigator.clipboard.writeText(data.socialText);
    onNotify('تم نسخ ملخص النتائج الجاهز للمشاركة!');
  }

  async function copyFull() {
    if (!data) return;
    await navigator.clipboard.writeText(data.fullText);
    onNotify('تم نسخ التقرير الكامل إلى الحافظة.');
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={20} color="var(--championship-gold)" />
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.1rem' }}>
              تصدير ومشاركة نتائج البطولة
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        {loading || !data ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
            جاري تجهيز التقرير الرسمي...
          </div>
        ) : (
          <>
            <textarea
              readOnly
              className="input"
              value={data.fullText}
              style={{ minHeight: 220, fontSize: '0.8rem', lineHeight: 1.5 }}
            />
            <div className="stack-col" style={{ gap: 8 }}>
              <button type="button" className="btn btn-primary" onClick={downloadTxt}>
                <Download size={18} />
                <span>تنزيل ملف نصي (.txt)</span>
              </button>
              <div className="grid-2">
                <button type="button" className="btn btn-gold" onClick={shareSocial}>
                  <Share2 size={17} />
                  <span>مشاركة سريعة</span>
                </button>
                <button type="button" className="btn btn-outline" onClick={copyFull}>
                  <Copy size={17} />
                  <span>نسخ التقرير</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function InstallPwaModal({
  canNativePrompt,
  onTriggerNativeInstall,
  onClose
}: {
  canNativePrompt: boolean;
  onTriggerNativeInstall: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/icons/icon-192.png"
              alt="CP4 ARENA"
              style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid var(--championship-gold)' }}
            />
            <div>
              <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.08rem' }}>
                تثبيت CP4 ARENA على الشاشة الرئيسية
              </h2>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                تشغيل سريع بملء الشاشة على iPhone وAndroid والكمبيوتر
              </div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        {canNativePrompt && (
          <button
            type="button"
            className="btn btn-gold"
            onClick={async () => {
              await onTriggerNativeInstall();
              onClose();
            }}
          >
            <Download size={18} />
            <span>تثبيت التطبيق الآن (Chrome / Android / Desktop)</span>
          </button>
        )}

        <div className="arena-subcard stack-col" style={{ gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--cyber-sky)', fontWeight: 700 }}>
            <Smartphone size={17} />
            <span>خطوات التثبيت على Safari (iPhone / iPad):</span>
          </div>
          <ol style={{ margin: 0, paddingInlineStart: 20, fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
            <li>افتح الموقع عبر متصفح <strong>Safari</strong>.</li>
            <li>اضغط على أيقونة <strong>المشاركة (Share)</strong> أسفل أو أعلى الشاشة.</li>
            <li>اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.</li>
            <li>اضغط <strong>إضافة (Add)</strong> ليظهر التطبيق باسم وأيقونة <strong>CP4 ARENA</strong>.</li>
          </ol>
        </div>

        <button type="button" className="btn btn-outline" onClick={onClose}>
          حسناً
        </button>
      </div>
    </div>
  );
}

export function PlayerProfileModal({
  player,
  stats,
  seasonEntry,
  matches,
  playersById,
  scoreUnitLabel,
  profileId,
  unifiedStats = null,
  victims = [],
  friendlyMatches = [],
  onClose
}: {
  player: Player;
  stats: PlayerStats | null;
  seasonEntry: SeasonLeaderboardEntry | null;
  matches: Match[];
  playersById: Map<number, Player>;
  scoreUnitLabel: string;
  profileId?: number | null;
  unifiedStats?: PlayerUnifiedStats | null;
  victims?: PlayerVictimEntry[];
  friendlyMatches?: FriendlyMatch[];
  onClose: () => void;
}) {
  const playerMatches = matches.filter((m) => m.player1Id === player.id || m.player2Id === player.id);
  const resolvedProfileId = profileId ?? player.profileId ?? null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PlayerAvatar avatarUrl={player.avatarUrl} name={player.name} size={58} borderColor="var(--championship-gold)" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.12rem' }}>{player.name}</h2>
                {player.cp4Id && (
                  <span
                    className="score-num"
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(245, 184, 46, 0.14)',
                      border: '1px solid rgba(245, 184, 46, 0.45)',
                      color: 'var(--championship-gold)'
                    }}
                  >
                    {player.cp4Id}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--cyber-sky)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Shield size={13} />
                <span>ElysiumNet: {player.elysiumNetId}</span>
                {player.xeMoNetId && <span>• XeMoNet: {player.xeMoNetId}</span>}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                {LEVEL_LABELS[player.level].label} • OVR {player.ovrRating}
                {player.clubName ? ` • ${player.clubName}` : ''}
              </div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        {seasonEntry && (
          <div className="arena-subcard stack-col" style={{ gap: 8, borderColor: 'rgba(245, 184, 46, 0.45)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--championship-gold)', fontWeight: 800, fontSize: '0.88rem' }}>
                <Award size={16} />
                <span>المسيرة العامة في الموسم</span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--cyber-sky)' }}>
                المركز #{seasonEntry.rank} • {seasonEntry.seasonPoints} نقطة
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, textAlign: 'center' }}>
              <ProfileMiniBox label="ألقاب" value={seasonEntry.titles} color="var(--championship-gold)" />
              <ProfileMiniBox label="وصافة" value={seasonEntry.runnerUps} color="var(--cyber-sky)" />
              <ProfileMiniBox label="فوز" value={seasonEntry.wins} color="var(--emerald-win)" />
              <ProfileMiniBox label="نسبة الفوز" value={`${seasonEntry.winRatePercent}%`} color="var(--text-primary)" />
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              {seasonEntry.tournamentsCount} بطولات • {seasonEntry.matchesPlayed} مباراة • سجل {seasonEntry.goalsScored} واستقبل {seasonEntry.goalsConceded} ({seasonEntry.cleanSheets} شباك نظيفة)
            </div>
          </div>
        )}

        <div className="arena-subcard stack-col" style={{ gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--cyber-sky)' }}>
            إحصائيات البطولة الحالية
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, textAlign: 'center' }}>
            <ProfileMiniBox label="لعب" value={stats?.matchesPlayed ?? 0} />
            <ProfileMiniBox label="فوز" value={stats?.wins ?? 0} color="var(--emerald-win)" />
            <ProfileMiniBox label={scoreUnitLabel} value={stats?.goalsScored ?? 0} color="var(--championship-gold)" />
            <ProfileMiniBox label="عليه" value={stats?.goalsConceded ?? 0} />
          </div>
        </div>

        <div className="stack-col" style={{ gap: 6 }}>
          <div style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
            مباريات اللاعب ({playerMatches.length})
          </div>
          {playerMatches.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>لا توجد مباريات مسجلة بعد.</div>
          ) : (
            playerMatches.map((m) => {
              const isP1 = m.player1Id === player.id;
              const oppId = isP1 ? m.player2Id : m.player1Id;
              const opp = oppId ? playersById.get(oppId) : null;
              const sSelf = m.isTwoLegged
                ? isP1
                  ? (m.leg1Score1 ?? 0) + (m.leg2Score1 ?? 0)
                  : (m.leg1Score2 ?? 0) + (m.leg2Score2 ?? 0)
                : isP1
                ? m.leg1Score1
                : m.leg1Score2;
              const sOpp = m.isTwoLegged
                ? isP1
                  ? (m.leg1Score2 ?? 0) + (m.leg2Score2 ?? 0)
                  : (m.leg1Score1 ?? 0) + (m.leg2Score1 ?? 0)
                : isP1
                ? m.leg1Score2
                : m.leg1Score1;
              const won = m.isCompleted && m.winnerId === player.id;
              const lost = m.isCompleted && m.winnerId != null && m.winnerId !== player.id;

              return (
                <div
                  key={m.id}
                  className="arena-subcard"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                >
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                      ضد {opp?.name || 'بانتظار المتأهل'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {STAGE_LABELS[m.stage].label}
                      {m.isWalkover ? ' • انسحاب' : ''}
                    </div>
                  </div>
                  <div
                    className="score-num"
                    style={{
                      fontSize: '0.95rem',
                      color: won ? 'var(--emerald-win)' : lost ? 'var(--crimson-loss)' : 'var(--championship-gold)'
                    }}
                  >
                    {m.leg1Score1 != null ? `${sSelf ?? '-'} : ${sOpp ?? '-'}` : 'لم تُلعب'}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <VictimsProfileSection
          profileId={resolvedProfileId}
          unifiedStats={unifiedStats}
          victims={victims}
          friendlyMatches={friendlyMatches}
          testIdPrefix="profile"
        />
      </div>
    </div>
  );
}

function ProfileMiniBox({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ background: 'rgba(7, 9, 19, 0.55)', borderRadius: 10, padding: '6px 4px' }}>
      <div className="score-num" style={{ fontSize: '1rem', color: color || 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

export function DisputeMatchModal({
  match,
  player1,
  player2,
  onClose,
  onSubmit
}: {
  match: Match;
  player1: Player | null;
  player2: Player | null;
  onClose: () => void;
  onSubmit: (payload: { submittedBy: string; note: string; screenshotUrl?: string | null }) => Promise<void>;
}) {
  const [submittedBy, setSubmittedBy] = useState(player1?.name || '');
  const [note, setNote] = useState(match.disputeNote || '');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(match.disputeScreenshotUrl || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const url = await uploadImageFileApi(file);
      setScreenshotUrl(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'تعذر رفع صورة الإثبات.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flag size={19} color="var(--championship-gold)" />
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.05rem' }}>
              إثبات النتيجة / رفع طعن
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--cyber-sky)', fontWeight: 700 }}>
          {player1?.name || 'اللاعب 1'} ضد {player2?.name || 'اللاعب 2'} • {STAGE_LABELS[match.stage].label}
        </div>

        {match.disputeStatus !== 'NONE' && (
          <div className="arena-subcard" style={{ borderColor: match.disputeStatus === 'OPEN' ? 'var(--crimson-loss)' : 'var(--emerald-win)' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: match.disputeStatus === 'OPEN' ? 'var(--crimson-loss)' : 'var(--emerald-win)' }}>
              {match.disputeStatus === 'OPEN' ? 'يوجد طعن قيد المراجعة حالياً' : 'تم حسم الطعن السابق من المشرف'}
            </div>
            {match.disputeNote && (
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>{match.disputeNote}</div>
            )}
          </div>
        )}

        <div className="field-group">
          <label className="field-label">اسم مقدّم الإثبات أو الطعن *</label>
          <input
            className="input"
            value={submittedBy}
            onChange={(e) => setSubmittedBy(e.target.value)}
            placeholder="اسم اللاعب أو معرف ElysiumNet/ XeMoNat"
          />
        </div>

        <div className="field-group">
          <label className="field-label">النتيجة الفعلية أو تفاصيل الطعن *</label>
          <textarea
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="اكتب النتيجة الحقيقية أو سبب الاعتراض بوضوح..."
          />
        </div>

        <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
          <ImagePlus size={17} />
          <span>{uploading ? 'جاري رفع لقطة الشاشة...' : screenshotUrl ? 'تم إرفاق صورة إثبات ✓' : 'إرفاق لقطة شاشة (اختياري)'}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          />
        </label>

        {screenshotUrl && (
          <img
            src={screenshotUrl}
            alt="إثبات النتيجة"
            style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--card-border)' }}
          />
        )}

        {err && <div style={{ color: 'var(--crimson-loss)', fontSize: '0.82rem', fontWeight: 700 }}>{err}</div>}

        <div className="grid-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || uploading || !submittedBy.trim() || !note.trim()}
            onClick={async () => {
              setSaving(true);
              setErr('');
              try {
                await onSubmit({
                  submittedBy: submittedBy.trim(),
                  note: note.trim(),
                  screenshotUrl
                });
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'تعذر إرسال الطعن.');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'جاري الإرسال...' : 'إرسال للمراجعة'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

export function RaceResultsModal({
  race,
  approvedPlayers,
  pointsConfig,
  onClose,
  onSave
}: {
  race: RaceEntry;
  approvedPlayers: Player[];
  pointsConfig: number[];
  onClose: () => void;
  onSave: (payload: {
    title?: string;
    trackName?: string;
    entries: Array<{ playerId: number; position: number; bestLapOrTime?: string; dnf?: boolean }>;
  }) => Promise<void>;
}) {
  const existingMap = new Map(race.results.map((r) => [r.playerId, r]));
  const roster =
    race.stage === 'FINAL' && race.results.length > 0
      ? approvedPlayers.filter((p) => existingMap.has(p.id))
      : approvedPlayers;
  const playersList = roster.length > 0 ? roster : approvedPlayers;

  const [title, setTitle] = useState(race.title);
  const [trackName, setTrackName] = useState(race.trackName || '');
  const [rows, setRows] = useState(() =>
    playersList.map((p, idx) => {
      const existing = existingMap.get(p.id);
      return {
        playerId: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        position: existing?.position ?? idx + 1,
        bestLapOrTime: existing?.bestLapOrTime ?? '',
        dnf: existing?.dnf ?? false
      };
    })
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.08rem' }}>
              تسجيل مراكز السباق — {RACE_STAGE_LABELS[race.stage]?.label}
            </h2>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              تُحسب النقاط تلقائياً حسب جدول المراكز المعتمد
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="grid-2">
          <div className="field-group">
            <label className="field-label">اسم السباق</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">الحلبة / المسار</label>
            <input className="input" value={trackName} onChange={(e) => setTrackName(e.target.value)} placeholder="اختياري" />
          </div>
        </div>

        <div className="stack-col" style={{ gap: 8 }}>
          {rows.map((row, idx) => {
            const pts = row.dnf ? 0 : (pointsConfig[row.position - 1] ?? 0);
            return (
              <div key={row.playerId} className="arena-subcard stack-col" style={{ gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PlayerAvatar avatarUrl={row.avatarUrl} name={row.name} size={30} />
                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{row.name}</span>
                  </div>
                  <span className="score-num" style={{ color: 'var(--championship-gold)', fontWeight: 800 }}>
                    +{pts} نقطة
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 8, alignItems: 'center' }}>
                  <input
                    className="input score-num"
                    type="number"
                    min={1}
                    max={64}
                    value={row.position}
                    onChange={(e) => {
                      const nextPos = Math.max(1, Number(e.target.value) || 1);
                      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, position: nextPos } : r)));
                    }}
                    aria-label={`مركز ${row.name}`}
                  />
                  <input
                    className="input"
                    value={row.bestLapOrTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, bestLapOrTime: val } : r)));
                    }}
                    placeholder="أفضل لفة / التوقيت (اختياري)"
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={row.dnf}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, dnf: checked } : r)));
                      }}
                    />
                    <span>DNF</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {err && <div style={{ color: 'var(--crimson-loss)', fontSize: '0.82rem', fontWeight: 700 }}>{err}</div>}

        <div className="grid-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || rows.length === 0}
            onClick={async () => {
              setSaving(true);
              setErr('');
              try {
                await onSave({
                  title: title.trim() || race.title,
                  trackName: trackName.trim(),
                  entries: rows.map((r) => ({
                    playerId: r.playerId,
                    position: r.position,
                    bestLapOrTime: r.bestLapOrTime.trim(),
                    dnf: r.dnf
                  }))
                });
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'تعذر حفظ نتائج السباق.');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'جاري الحفظ...' : 'حفظ نتائج السباق وتحديث الترتيب'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountProfileModal({
  profile,
  seasonEntry,
  unifiedStats = null,
  victims = [],
  friendlyMatches = [],
  activeTournamentName,
  isRegistrationOpenNow,
  onOpenSettings,
  onOpenRegister,
  onOpenSubmitFriendly,
  onClose
}: {
  profile: PlayerProfile;
  seasonEntry: SeasonLeaderboardEntry | null;
  unifiedStats?: PlayerUnifiedStats | null;
  victims?: PlayerVictimEntry[];
  friendlyMatches?: FriendlyMatch[];
  activeTournamentName: string | null;
  isRegistrationOpenNow: boolean;
  onOpenSettings: () => void;
  onOpenRegister: () => void;
  onOpenSubmitFriendly?: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const createdLabel = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : '—';

  async function handleCopyCp4() {
    try {
      await navigator.clipboard.writeText(profile.cp4Id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()} data-testid="account_profile_modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={19} color="var(--cyber-sky)" />
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.08rem' }}>
              الملف الشخصي
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div
          className="arena-subcard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderColor: 'rgba(245, 184, 46, 0.45)',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.14), rgba(15, 21, 40, 0.92))'
          }}
        >
          <PlayerAvatar
            avatarUrl={profile.avatarUrl}
            name={profile.name}
            size={58}
            borderColor="var(--championship-gold)"
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
              {profile.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <span
                className="score-num"
                style={{
                  fontSize: '0.78rem',
                  padding: '2px 9px',
                  borderRadius: 999,
                  background: 'rgba(245, 184, 46, 0.16)',
                  border: '1px solid rgba(245, 184, 46, 0.55)',
                  color: 'var(--championship-gold)'
                }}
              >
                {profile.cp4Id}
              </span>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCopyCp4}
                style={{ minHeight: 28, padding: '2px 8px', fontSize: '0.72rem', borderRadius: 999 }}
              >
                {copied ? <Check size={12} color="var(--emerald-win)" /> : <Copy size={12} />}
                <span>{copied ? 'تم النسخ' : 'نسخ المعرف'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="arena-subcard stack-col" style={{ gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ربط Discord</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: '0.76rem',
                fontWeight: 700,
                color: 'var(--emerald-win)'
              }}
            >
              <ShieldCheck size={14} />
              <span>موثق {profile.discordUserId ? `(${profile.discordUserId})` : ''}</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ElysiumNet ID</span>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: profile.elysiumNetId ? 'var(--cyber-sky)' : 'var(--text-muted)' }}>
              {profile.elysiumNetId || 'غير مضاف بعد'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>XeMoNet ID</span>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: profile.xeMoNetId ? 'var(--cyber-sky)' : 'var(--text-muted)' }}>
              {profile.xeMoNetId || 'غير مضاف'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={13} />
              <span>تاريخ الإنشاء</span>
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{createdLabel}</span>
          </div>
        </div>

        {seasonEntry && (
          <div className="arena-subcard stack-col" style={{ gap: 8, borderColor: 'rgba(56, 189, 248, 0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--cyber-sky)' }}>
                إحصائيات الموسم
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--championship-gold)' }}>
                المركز #{seasonEntry.rank} • {seasonEntry.seasonPoints} نقطة
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, textAlign: 'center' }}>
              <ProfileMiniBox label="بطولات" value={seasonEntry.tournamentsCount} />
              <ProfileMiniBox label="ألقاب" value={seasonEntry.titles} color="var(--championship-gold)" />
              <ProfileMiniBox label="فوز" value={seasonEntry.wins} color="var(--emerald-win)" />
              <ProfileMiniBox label="نسبة الفوز" value={`${seasonEntry.winRatePercent}%`} color="var(--cyber-sky)" />
            </div>
          </div>
        )}

        <VictimsProfileSection
          profileId={profile.id}
          unifiedStats={unifiedStats}
          victims={victims}
          friendlyMatches={friendlyMatches}
          testIdPrefix="account_profile"
        />

        {onOpenSubmitFriendly && (
          <button
            type="button"
            className="btn btn-gold"
            onClick={() => {
              onClose();
              onOpenSubmitFriendly();
            }}
            data-testid="account_profile_submit_friendly_btn"
          >
            <Swords size={16} />
            <span>تسجيل مواجهة ودية خارج البطولات</span>
          </button>
        )}

        <div className="grid-2">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          >
            <Settings size={16} />
            <span>تعديل المعرفات</span>
          </button>
          {isRegistrationOpenNow && activeTournamentName ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
            >
              <UserPlus size={16} />
              <span>تسجيل بالبطولة</span>
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onClose}>
              إغلاق
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AccountSettingsModal({
  profile,
  onSaveProfileIds,
  onLogoutDiscord,
  onClose
}: {
  profile: PlayerProfile;
  onSaveProfileIds: (payload: { elysiumNetId: string; xeMoNetId: string }) => Promise<void>;
  onLogoutDiscord: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [elysiumNetId, setElysiumNetId] = useState(profile.elysiumNetId || '');
  const [xeMoNetId, setXeMoNetId] = useState(profile.xeMoNetId || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      await onSaveProfileIds({
        elysiumNetId: elysiumNetId.trim(),
        xeMoNetId: xeMoNetId.trim()
      });
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'تعذر حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()} data-testid="account_settings_modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={19} color="var(--championship-gold)" />
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.08rem' }}>
              إعدادات الحساب
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="arena-subcard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <PlayerAvatar avatarUrl={profile.avatarUrl} name={profile.name} size={42} borderColor="var(--championship-gold)" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{profile.name}</div>
              <div className="score-num" style={{ fontSize: '0.74rem', color: 'var(--cyber-sky)' }}>
                {profile.cp4Id} (ثابت)
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'rgba(88, 101, 242, 0.2)',
              border: '1px solid rgba(129, 140, 248, 0.5)',
              color: '#E0E7FF',
              whiteSpace: 'nowrap'
            }}
          >
            Discord متصل
          </span>
        </div>

        <form onSubmit={handleSave} className="stack-col">
          <div className="field-group">
            <label className="field-label">معرف ElysiumNet</label>
            <input
              className="input"
              value={elysiumNetId}
              onChange={(e) => setElysiumNetId(e.target.value)}
              placeholder="مثال: ELY_Player99"
              maxLength={60}
              data-testid="settings_elysium_input"
            />
          </div>

          <div className="field-group">
            <label className="field-label">معرف XeMoNet (اختياري)</label>
            <input
              className="input"
              value={xeMoNetId}
              onChange={(e) => setXeMoNetId(e.target.value)}
              placeholder="مثال: XEMO_Player99"
              maxLength={60}
              data-testid="settings_xemonet_input"
            />
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            تُستخدم هذه المعرفات لتعبئة نموذج التسجيل تلقائياً في البطولات القادمة، مع بقاء رقم CP4 ومعرف Discord ثابتين.
          </div>

          {err && <div style={{ color: 'var(--crimson-loss)', fontSize: '0.82rem', fontWeight: 700 }}>{err}</div>}

          <div className="grid-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={async () => {
                onClose();
                await onLogoutDiscord();
              }}
            >
              تسجيل الخروج
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
