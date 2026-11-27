import { useMemo, useState } from 'react';
import { Calendar, Gamepad2, ImagePlus, ShieldAlert, Skull, Swords, X } from 'lucide-react';
import { uploadImageFileApi } from '../api';
import { PlayerAvatar } from './PlayerAvatar';
import type {
  FriendlyMatch,
  GameCatalogItem,
  PlayerProfile,
  PlayerUnifiedStats,
  PlayerVictimEntry,
  RegisteredPlayerDirectoryEntry
} from '../types';

export function FriendlyMatchModal({
  discordProfile,
  gameCatalog,
  directory,
  defaultGameTitle,
  onClose,
  onSubmit
}: {
  discordProfile: PlayerProfile;
  gameCatalog: GameCatalogItem[];
  directory: RegisteredPlayerDirectoryEntry[];
  defaultGameTitle?: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    gameTitle: string;
    opponentProfileId: number;
    score1: number;
    score2: number;
    matchDate: string;
    proofImageUrl?: string | null;
  }) => Promise<void>;
}) {
  const availableOpponents = useMemo(
    () => directory.filter((p) => p.id !== discordProfile.id),
    [directory, discordProfile.id]
  );

  const initialGame =
    (defaultGameTitle &&
      gameCatalog.find((g) => g.label.toLowerCase() === defaultGameTitle.trim().toLowerCase())?.label) ||
    gameCatalog[0]?.label ||
    'FIFA 22';

  const [gameTitle, setGameTitle] = useState(initialGame);
  const [opponentQuery, setOpponentQuery] = useState('');
  const [opponentProfileId, setOpponentProfileId] = useState<number>(availableOpponents[0]?.id ?? 0);
  const [score1, setScore1] = useState('0');
  const [score2, setScore2] = useState('0');
  const [matchDate, setMatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const filteredOpponents = useMemo(() => {
    const q = opponentQuery.trim().toLowerCase();
    if (!q) return availableOpponents;
    return availableOpponents.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.cp4Id.toLowerCase().includes(q) ||
        p.elysiumNetId.toLowerCase().includes(q)
    );
  }, [availableOpponents, opponentQuery]);

  const selectedOpponent =
    filteredOpponents.find((p) => p.id === opponentProfileId) || filteredOpponents[0] || null;
  const activeCatalogItem = gameCatalog.find((g) => g.label === gameTitle);

  async function handleProofUpload(file: File | null) {
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const url = await uploadImageFileApi(file);
      setProofImageUrl(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'تعذر رفع صورة الإثبات.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const targetOppId = selectedOpponent?.id || 0;
    if (!targetOppId) {
      setErr('يرجى اختيار الخصم من قائمة اللاعبين المسجلين.');
      return;
    }
    const n1 = Number(score1);
    const n2 = Number(score2);
    if (!Number.isInteger(n1) || !Number.isInteger(n2) || n1 < 0 || n2 < 0 || n1 > 99 || n2 > 99) {
      setErr('يرجى إدخال نتيجة صحيحة من 0 إلى 99.');
      return;
    }
    if (!matchDate) {
      setErr('يرجى تحديد تاريخ المواجهة.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        gameTitle,
        opponentProfileId: targetOppId,
        score1: n1,
        score2: n2,
        matchDate,
        proofImageUrl
      });
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'تعذر إرسال طلب المواجهة الودية.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel modal-panel-sheet"
        onClick={(e) => e.stopPropagation()}
        data-testid="friendly_match_modal"
      >
        <div className="modal-sheet-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Swords size={19} color="var(--championship-gold)" style={{ flexShrink: 0 }} />
            <h2
              style={{
                margin: 0,
                color: 'var(--championship-gold)',
                fontSize: '0.98rem',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              تسجيل مواجهة ودية خارج البطولات
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="إغلاق"
            style={{ minWidth: 38, minHeight: 38, padding: 6, flexShrink: 0 }}
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-sheet-form">
          <div className="modal-sheet-body">
            <div
              className="arena-subcard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderColor: 'rgba(88, 101, 242, 0.5)',
                background: 'rgba(88, 101, 242, 0.12)'
              }}
            >
              <PlayerAvatar avatarUrl={discordProfile.avatarUrl} name={discordProfile.name} size={34} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {discordProfile.name}
                </div>
                <div className="score-num" style={{ fontSize: '0.72rem', color: 'var(--cyber-sky)' }}>
                  {discordProfile.cp4Id} • مرسل النتيجة
                </div>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">اللعبة *</label>
              <select
                className="input"
                value={gameTitle}
                onChange={(e) => setGameTitle(e.target.value)}
                data-testid="friendly_game_select"
              >
                {gameCatalog.map((g) => (
                  <option key={g.id} value={g.label}>
                    {g.label} — {g.categoryAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="field-label">اختيار الخصم من اللاعبين المسجلين *</label>
              <input
                className="input"
                value={opponentQuery}
                onChange={(e) => setOpponentQuery(e.target.value)}
                placeholder="بحث بالاسم أو CP4 ID أو ElysiumNet..."
              />
              <select
                className="input"
                value={selectedOpponent?.id ?? 0}
                onChange={(e) => setOpponentProfileId(Number(e.target.value))}
                data-testid="friendly_opponent_select"
              >
                {filteredOpponents.length === 0 ? (
                  <option value={0}>لا يوجد لاعب مطابق</option>
                ) : (
                  filteredOpponents.map((opp) => (
                    <option key={opp.id} value={opp.id}>
                      {opp.name} ({opp.cp4Id}){opp.elysiumNetId ? ` — ${opp.elysiumNetId}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="grid-2">
              <div className="field-group">
                <label
                  className="field-label"
                  style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  نتيجتك ({activeCatalogItem?.scoreUnitLabel || 'نقطة'}) *
                </label>
                <input
                  className="input score-num"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={score1}
                  onChange={(e) => setScore1(e.target.value)}
                  data-testid="friendly_score1_input"
                />
              </div>
              <div className="field-group">
                <label
                  className="field-label"
                  style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  نتيجة {selectedOpponent?.name || 'الخصم'} *
                </label>
                <input
                  className="input score-num"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={score2}
                  onChange={(e) => setScore2(e.target.value)}
                  data-testid="friendly_score2_input"
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">تاريخ المواجهة *</label>
              <input
                className="input"
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                data-testid="friendly_date_input"
              />
            </div>

            <div className="stack-col" style={{ gap: 6 }}>
              <label className="btn btn-outline" style={{ cursor: uploading ? 'wait' : 'pointer', width: '100%' }}>
                <ImagePlus size={16} />
                <span>
                  {uploading
                    ? 'جاري رفع صورة الإثبات...'
                    : proofImageUrl
                    ? 'تم إرفاق صورة الإثبات ✓ (تغيير)'
                    : 'إرفاق صورة إثبات النتيجة (اختياري)'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  disabled={uploading}
                  onChange={(e) => handleProofUpload(e.target.files?.[0] || null)}
                />
              </label>
              {proofImageUrl && (
                <div style={{ position: 'relative' }}>
                  <img
                    src={proofImageUrl}
                    alt="إثبات المواجهة الودية"
                    style={{
                      width: '100%',
                      maxHeight: 140,
                      objectFit: 'cover',
                      borderRadius: 12,
                      border: '1px solid var(--card-border)'
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setProofImageUrl(null)}
                    aria-label="إزالة الصورة"
                    style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(7,9,19,0.85)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            <div
              className="arena-subcard"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 10px',
                fontSize: '0.73rem',
                color: 'var(--text-secondary)',
                borderColor: 'rgba(245, 184, 46, 0.35)'
              }}
            >
              <ShieldAlert size={15} color="var(--championship-gold)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ lineHeight: 1.5 }}>
                المواجهات الودية تُراجع من الإدارة قبل اعتمادها، ولا تمنح نقاطاً في ترتيب الموسم العام، وتُحتسب في الإحصائيات وقسم «ضحاياك» فور الاعتماد.
              </span>
            </div>
          </div>

          <div className="modal-sheet-footer">
            {err && <div style={{ color: 'var(--crimson-loss)', fontSize: '0.8rem', fontWeight: 700 }}>{err}</div>}
            <div className="grid-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || uploading || availableOpponents.length === 0}
                data-testid="friendly_submit_btn"
              >
                {saving ? 'جاري الإرسال...' : 'إرسال للمراجعة'}
              </button>
              <button type="button" className="btn btn-outline" onClick={onClose}>
                إلغاء
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function VictimsProfileSection({
  profileId,
  unifiedStats,
  victims,
  friendlyMatches = [],
  testIdPrefix = 'profile'
}: {
  profileId?: number | null;
  unifiedStats?: PlayerUnifiedStats | null;
  victims?: PlayerVictimEntry[];
  friendlyMatches?: FriendlyMatch[];
  testIdPrefix?: string;
}) {
  const safeVictims = victims || [];
  const nearVictims = (unifiedStats?.h2hRecords || [])
    .filter((r) => !r.isQualifiedVictim && r.winsCount > 0)
    .slice(0, 4);

  const playerFriendlyHistory = useMemo(() => {
    if (!profileId) return [];
    return friendlyMatches.filter(
      (fm) => fm.player1ProfileId === profileId || fm.player2ProfileId === profileId
    );
  }, [friendlyMatches, profileId]);

  return (
    <div className="stack-col" style={{ gap: 10 }}>
      {unifiedStats && unifiedStats.totalMatches > 0 && (
        <div className="arena-subcard stack-col" style={{ gap: 8, borderColor: 'rgba(56, 189, 248, 0.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--cyber-sky)' }}>
              السجل الشامل (بطولات + مواجهات ودية معتمدة)
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {unifiedStats.tournamentMatches} بطولة • {unifiedStats.friendlyMatches} ودية
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, textAlign: 'center' }}>
            <MiniStatCell label="المباريات" value={unifiedStats.totalMatches} />
            <MiniStatCell label="فوز" value={unifiedStats.wins} color="var(--emerald-win)" />
            <MiniStatCell label="خسارة" value={unifiedStats.losses} color="var(--crimson-loss)" />
            <MiniStatCell label="نسبة الفوز" value={`${unifiedStats.winRatePercent}%`} color="var(--championship-gold)" />
          </div>
        </div>
      )}

      <div
        className="arena-subcard stack-col"
        style={{
          gap: 8,
          borderColor: safeVictims.length > 0 ? 'rgba(245, 184, 46, 0.55)' : 'var(--card-border)',
          background:
            safeVictims.length > 0
              ? 'linear-gradient(135deg, rgba(245, 184, 46, 0.12), rgba(15, 21, 40, 0.92))'
              : undefined
        }}
        data-testid={`${testIdPrefix}_victims_section`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--championship-gold)', fontWeight: 800, fontSize: '0.92rem' }}>
            <Skull size={17} />
            <span>ضحاياك ({safeVictims.length})</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            يتأهل الخصم عند 5+ انتصارات في اللعبة نفسها
          </span>
        </div>

        {safeVictims.length === 0 ? (
          <div style={{ fontSize: '0.79rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            لم يتأهل أي خصم في قائمة «ضحاياك» بعد. حقق 5 انتصارات معتمدة ضد نفس الخصم في لعبة واحدة ليظهر هنا.
          </div>
        ) : (
          <div className="stack-col" style={{ gap: 7 }}>
            {safeVictims.map((v) => (
              <div
                key={`${v.opponentProfileId}-${v.gameTitle}`}
                className="arena-subcard"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 11px',
                  borderColor: 'rgba(245, 184, 46, 0.4)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <PlayerAvatar
                    avatarUrl={v.opponentAvatarUrl}
                    name={v.opponentName}
                    size={38}
                    borderColor="var(--championship-gold)"
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {v.opponentName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: 999,
                          background: 'rgba(56, 189, 248, 0.14)',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          color: 'var(--cyber-sky)'
                        }}
                      >
                        <Gamepad2 size={11} />
                        <span>{v.gameTitle}</span>
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        (بطولات {v.tournamentWins} • وديات {v.friendlyWins})
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'left', flexShrink: 0 }}>
                  <div className="score-num" style={{ fontSize: '1.15rem', color: 'var(--championship-gold)' }}>
                    {v.winsCount}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--emerald-win)', fontWeight: 700 }}>انتصارات</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {nearVictims.length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {nearVictims.map((r) => (
              <span
                key={`${r.opponentProfileId}-${r.gameTitle}`}
                style={{
                  fontSize: '0.71rem',
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: 'rgba(15, 21, 40, 0.85)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-secondary)'
                }}
              >
                {r.opponentName} • {r.gameTitle}:{' '}
                <strong className="score-num" style={{ color: 'var(--cyber-sky)' }}>
                  {r.winsCount}/5
                </strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {playerFriendlyHistory.length > 0 && (
        <div className="stack-col" style={{ gap: 6 }}>
          <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
            المواجهات الودية ({playerFriendlyHistory.length})
          </div>
          {playerFriendlyHistory.slice(0, 8).map((fm) => {
            const isP1 = fm.player1ProfileId === profileId;
            const oppName = isP1 ? fm.player2Name : fm.player1Name;
            const selfScore = isP1 ? fm.score1 : fm.score2;
            const oppScore = isP1 ? fm.score2 : fm.score1;
            const statusLabel =
              fm.status === 'APPROVED' ? 'معتمدة' : fm.status === 'REJECTED' ? 'مرفوضة' : 'قيد المراجعة';
            const statusColor =
              fm.status === 'APPROVED'
                ? 'var(--emerald-win)'
                : fm.status === 'REJECTED'
                ? 'var(--crimson-loss)'
                : 'var(--championship-gold)';

            return (
              <div
                key={fm.id}
                className="arena-subcard"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.81rem', fontWeight: 700 }}>
                    ضد {oppName} • <span style={{ color: 'var(--cyber-sky)' }}>{fm.gameTitle}</span>
                  </div>
                  <div style={{ fontSize: '0.71rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Calendar size={11} />
                      {fm.matchDate}
                    </span>
                    <span style={{ color: statusColor, fontWeight: 700 }}>• {statusLabel}</span>
                  </div>
                  {fm.reviewNote && (
                    <div style={{ fontSize: '0.7rem', color: statusColor, marginTop: 2 }}>
                      ملاحظة الإدارة: {fm.reviewNote}
                    </div>
                  )}
                </div>
                <div className="score-num" style={{ fontSize: '0.96rem', color: statusColor, flexShrink: 0 }}>
                  {selfScore} : {oppScore}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStatCell({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ background: 'rgba(7, 9, 19, 0.55)', borderRadius: 10, padding: '6px 4px' }}>
      <div className="score-num" style={{ fontSize: '1rem', color: color || 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}
