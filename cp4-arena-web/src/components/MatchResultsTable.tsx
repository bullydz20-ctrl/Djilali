import { useEffect, useState } from 'react';
import { Bell, BellRing, Check, Edit3, Minus, Plus, Trophy, X } from 'lucide-react';
import { STAGE_LABELS } from '../types';
import type { Match, MatchReminder, Player } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

type FilterMode = 'ALL' | 'PENDING' | 'COMPLETED' | 'KNOCKOUT';

interface MatchResultsTableProps {
  matches: Match[];
  playersById: Map<number, Player>;
  canEdit: boolean;
  scoreUnitLabel: string;
  remindersByMatchId?: Map<number, MatchReminder>;
  onQuickUpdateGoals: (match: Match, p1Goals: number, p2Goals: number) => void;
  onOpenDetailedEditor: (match: Match) => void;
  onOpenReminder?: (match: Match) => void;
  title?: string;
  showFilters?: boolean;
  maxVisibleRows?: number;
}

export function MatchResultsTable({
  matches,
  playersById,
  canEdit,
  scoreUnitLabel,
  remindersByMatchId = new Map(),
  onQuickUpdateGoals,
  onOpenDetailedEditor,
  onOpenReminder,
  title = 'جدول نتائج المباريات الحالية',
  showFilters = true,
  maxVisibleRows
}: MatchResultsTableProps) {
  const [filter, setFilter] = useState<FilterMode>('ALL');

  const filtered = matches.filter((m) => {
    if (filter === 'PENDING') return !m.isCompleted && m.player1Id != null && m.player2Id != null;
    if (filter === 'COMPLETED') return m.isCompleted;
    if (filter === 'KNOCKOUT') return m.stage !== 'GROUP' && m.stage !== 'LEAGUE';
    return true;
  });

  const visible = maxVisibleRows ? filtered.slice(0, maxVisibleRows) : filtered;
  const completedCount = matches.filter((m) => m.isCompleted).length;

  return (
    <div className="arena-card stack-col" style={{ gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={20} color="var(--championship-gold)" />
          <div>
            <div style={{ fontWeight: 800, color: 'var(--championship-gold)', fontSize: '0.98rem' }}>
              {title}
            </div>
            {canEdit && (
              <div style={{ fontSize: '0.73rem', color: 'var(--cyber-sky)' }}>
                عدّل {scoreUnitLabel} كل لاعب مباشرة عبر (+) و (-) ثم اضغط حفظ
              </div>
            )}
          </div>
        </div>

        <span
          style={{
            padding: '5px 10px',
            borderRadius: 10,
            background: 'rgba(37,99,235,0.2)',
            border: '1px solid rgba(37,99,235,0.5)',
            color: 'var(--cyber-sky)',
            fontSize: '0.74rem',
            fontWeight: 700,
            whiteSpace: 'nowrap'
          }}
        >
          {completedCount} / {matches.length} مكتملة
        </span>
      </div>

      {showFilters && matches.length > 0 && (
        <div className="chip-row">
          {(
            [
              ['ALL', `الكل (${matches.length})`],
              ['PENDING', 'بانتظار النتيجة'],
              ['COMPLETED', 'مكتملة'],
              ['KNOCKOUT', 'الإقصائيات']
            ] as Array<[FilterMode, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`chip ${filter === key ? 'selected' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', padding: '8px 0' }}>
          لا توجد مباريات مطابقة للعرض حالياً.
        </div>
      ) : (
        <div className="stack-col" style={{ gap: 10 }}>
          {visible.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              player1={match.player1Id ? playersById.get(match.player1Id) || null : null}
              player2={match.player2Id ? playersById.get(match.player2Id) || null : null}
              canEdit={canEdit}
              reminder={remindersByMatchId.get(match.id) || null}
              onQuickUpdateGoals={onQuickUpdateGoals}
              onOpenDetailedEditor={onOpenDetailedEditor}
              onOpenReminder={onOpenReminder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  player1,
  player2,
  canEdit,
  reminder,
  onQuickUpdateGoals,
  onOpenDetailedEditor,
  onOpenReminder
}: {
  match: Match;
  player1: Player | null;
  player2: Player | null;
  canEdit: boolean;
  reminder: MatchReminder | null;
  onQuickUpdateGoals: (match: Match, g1: number, g2: number) => void;
  onOpenDetailedEditor: (match: Match) => void;
  onOpenReminder?: (match: Match) => void;
}) {
  const [draftP1, setDraftP1] = useState<number | null>(match.leg1Score1);
  const [draftP2, setDraftP2] = useState<number | null>(match.leg1Score2);

  useEffect(() => {
    setDraftP1(match.leg1Score1);
    setDraftP2(match.leg1Score2);
  }, [match.id, match.leg1Score1, match.leg1Score2]);

  const bothReady = player1 != null && player2 != null;
  const isKnockout = match.stage !== 'GROUP' && match.stage !== 'LEAGUE';
  const isP1Winner = match.isCompleted && match.winnerId != null && match.winnerId === player1?.id;
  const isP2Winner = match.isCompleted && match.winnerId != null && match.winnerId === player2?.id;

  const hasDraftChanges =
    (draftP1 !== match.leg1Score1 || draftP2 !== match.leg1Score2) && draftP1 != null && draftP2 != null;

  const statusText = match.isCompleted
    ? 'مكتملة'
    : match.leg1Score1 != null
    ? 'بانتظار الإياب'
    : 'لم تُلعب بعد';
  const statusColor = match.isCompleted
    ? 'var(--emerald-win)'
    : match.leg1Score1 != null
    ? 'var(--amber-draw)'
    : 'var(--cyber-sky)';

  const s1Display = match.isTwoLegged
    ? match.leg1Score1 != null
      ? String(match.leg1Score1 + (match.leg2Score1 ?? 0))
      : '-'
    : draftP1 != null
    ? String(draftP1)
    : '-';

  const s2Display = match.isTwoLegged
    ? match.leg1Score2 != null
      ? String(match.leg1Score2 + (match.leg2Score2 ?? 0))
      : '-'
    : draftP2 != null
    ? String(draftP2)
    : '-';

  const g1 = draftP1 ?? 0;
  const g2 = draftP2 ?? 0;
  const needsPenalties = isKnockout && !match.isTwoLegged && g1 === g2;

  return (
    <div
      style={{
        background: 'rgba(7, 9, 19, 0.55)',
        border: `1px solid ${hasDraftChanges ? 'var(--championship-gold)' : 'rgba(39, 52, 94, 0.7)'}`,
        borderRadius: 14,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.76rem', color: 'var(--cyber-sky)', fontWeight: 700 }}>
          {STAGE_LABELS[match.stage].label}
          {match.scheduledLabel ? ` • ${match.scheduledLabel}` : ''}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {reminder && !match.isCompleted && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 6,
                background: 'rgba(245, 184, 46, 0.16)',
                color: 'var(--championship-gold)',
                fontSize: '0.7rem',
                fontWeight: 700
              }}
            >
              تذكير {new Date(reminder.remindAtMillis).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          <span
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(22,31,59,0.9)',
              color: statusColor,
              fontSize: '0.72rem',
              fontWeight: 700
            }}
          >
            {statusText}
          </span>

          {onOpenReminder && !match.isCompleted && bothReady && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => onOpenReminder(match)}
              title="جدولة تذكير بموعد المباراة"
              style={{
                minWidth: 34,
                minHeight: 34,
                padding: 5,
                color: reminder ? 'var(--championship-gold)' : 'var(--cyber-sky)'
              }}
            >
              {reminder ? <BellRing size={15} /> : <Bell size={15} />}
            </button>
          )}

          {canEdit && bothReady && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => onOpenDetailedEditor(match)}
              title="تعديل النتيجة التفصيلية"
              style={{ minWidth: 34, minHeight: 34, padding: 5, color: 'var(--championship-gold)' }}
            >
              <Edit3 size={15} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <PlayerAvatar
            avatarUrl={player1?.avatarUrl}
            name={player1?.name || '؟'}
            size={36}
            borderColor={isP1Winner ? 'var(--championship-gold)' : 'var(--card-border)'}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: '0.88rem',
                color: isP1Winner ? 'var(--championship-gold)' : 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {player1?.name || 'بانتظار المتأهل'}
            </div>
            {player1 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {player1.elysiumNetId}
              </div>
            )}
          </div>
        </div>

        <div
          className="arena-subcard"
          style={{
            padding: '6px 12px',
            textAlign: 'center',
            borderColor: hasDraftChanges || match.isCompleted ? 'rgba(245,184,46,0.55)' : 'var(--card-border)'
          }}
        >
          <div className="score-num" style={{ fontSize: '1.25rem', lineHeight: 1.1 }}>
            {s1Display} : {s2Display}
          </div>
          {match.isTwoLegged && match.leg1Score1 != null && (
            <div style={{ fontSize: '0.67rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              ذ ({match.leg1Score1}-{match.leg1Score2}) • إ ({match.leg2Score1 ?? '-'}-{match.leg2Score2 ?? '-'})
            </div>
          )}
          {match.penaltyScore1 != null && match.penaltyScore2 != null && (
            <div style={{ fontSize: '0.68rem', color: 'var(--championship-gold)', marginTop: 2 }}>
              حسم {match.penaltyScore1}-{match.penaltyScore2}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 }}>
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: '0.88rem',
                color: isP2Winner ? 'var(--championship-gold)' : 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {player2?.name || 'بانتظار المتأهل'}
            </div>
            {player2 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {player2.elysiumNetId}
              </div>
            )}
          </div>
          <PlayerAvatar
            avatarUrl={player2?.avatarUrl}
            name={player2?.name || '؟'}
            size={36}
            borderColor={isP2Winner ? 'var(--championship-gold)' : 'var(--card-border)'}
          />
        </div>
      </div>

      {canEdit && bothReady && !match.isTwoLegged && (
        <div className="grid-2">
          <GoalStepper
            value={draftP1}
            label={player1?.name || 'اللاعب 1'}
            onInc={() => {
              setDraftP1((v) => Math.min(99, (v ?? 0) + 1));
              setDraftP2((v) => (v == null ? 0 : v));
            }}
            onDec={() => {
              setDraftP1((v) => Math.max(0, (v ?? 0) - 1));
              setDraftP2((v) => (v == null ? 0 : v));
            }}
          />
          <GoalStepper
            value={draftP2}
            label={player2?.name || 'اللاعب 2'}
            onInc={() => {
              setDraftP2((v) => Math.min(99, (v ?? 0) + 1));
              setDraftP1((v) => (v == null ? 0 : v));
            }}
            onDec={() => {
              setDraftP2((v) => Math.max(0, (v ?? 0) - 1));
              setDraftP1((v) => (v == null ? 0 : v));
            }}
          />
        </div>
      )}

      {canEdit && hasDraftChanges && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn ${needsPenalties ? 'btn-gold' : 'btn-primary'}`}
            style={{ flex: 1 }}
            onClick={() => (needsPenalties ? onOpenDetailedEditor(match) : onQuickUpdateGoals(match, g1, g2))}
          >
            <Check size={16} />
            <span>{needsPenalties ? 'إدخال نتيجة الحسم الإضافي' : `حفظ النتيجة (${g1} - ${g2})`}</span>
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setDraftP1(match.leg1Score1);
              setDraftP2(match.leg1Score2);
            }}
            aria-label="إلغاء التعديل"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function GoalStepper({
  value,
  label,
  onInc,
  onDec
}: {
  value: number | null;
  label: string;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <div
      className="arena-subcard"
      style={{
        padding: '4px 6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderColor: value != null ? 'rgba(245,184,46,0.4)' : 'var(--card-border)'
      }}
    >
      <button
        type="button"
        className="icon-btn"
        style={{ minWidth: 34, minHeight: 34, borderRadius: '50%' }}
        disabled={(value ?? 0) <= 0}
        onClick={onDec}
        aria-label={`إنقاص ${label}`}
      >
        <Minus size={14} />
      </button>
      <span className="score-num" style={{ fontSize: '1.1rem', color: value != null ? 'var(--championship-gold)' : 'var(--text-muted)' }}>
        {value != null ? value : '-'}
      </span>
      <button
        type="button"
        className="icon-btn"
        style={{ minWidth: 34, minHeight: 34, borderRadius: '50%', background: 'rgba(37,99,235,0.28)', color: 'var(--cyber-sky)' }}
        onClick={onInc}
        aria-label={`زيادة ${label}`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
