import { useState } from 'react';
import { CheckCircle2, Edit3, GitBranch, RefreshCw, Trophy, X } from 'lucide-react';
import { EmptyStatePanel, PlayerAvatar } from '../components/PlayerAvatar';
import { STAGE_LABELS, adminHasPermission } from '../types';
import type { ArenaState, Match, MatchStage, Player } from '../types';

const KNOCKOUT_STAGES: MatchStage[] = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];

export function BracketScreen({
  state,
  onEditMatch,
  onSelectWinner
}: {
  state: ArenaState;
  onEditMatch: (m: Match) => void;
  onSelectWinner: (matchId: number, winnerPlayerId: number | null) => Promise<void>;
}) {
  const [selectedStage, setSelectedStage] = useState<MatchStage | null>(null);
  const [winnerDialogMatch, setWinnerDialogMatch] = useState<Match | null>(null);

  const playersById = new Map<number, Player>(state.players.map((p) => [p.id, p]));
  const canEdit = adminHasPermission(state.currentAdmin, 'EDIT_SCORES');

  if (state.knockoutMatches.length === 0) {
    return (
      <EmptyStatePanel
        icon={<GitBranch size={28} />}
        title="لم تبدأ الأدوار الإقصائية بعد"
        subtitle="يمكنك إجراء قرعة إقصائية مباشرة أو تأهيل المتصدرين من المجموعات/الدوري عبر لوحة المشرف."
      />
    );
  }

  const byStage = new Map<MatchStage, Match[]>();
  for (const st of KNOCKOUT_STAGES) {
    const list = state.knockoutMatches
      .filter((m) => m.stage === st)
      .sort((a, b) => a.bracketIndex - b.bracketIndex);
    if (list.length > 0) byStage.set(st, list);
  }

  const presentStages = KNOCKOUT_STAGES.filter((st) => byStage.has(st));
  const finalMatch = byStage.get('FINAL')?.[0] ?? null;
  const resolvedChampion =
    state.championPlayer ?? (finalMatch?.winnerId ? playersById.get(finalMatch.winnerId) || null : null);

  return (
    <div className="stack-col">
      {/* Stage Filter Pills */}
      <div className="chip-scroll-row">
        <button
          type="button"
          className={`chip ${selectedStage === null ? 'selected-gold' : ''}`}
          onClick={() => setSelectedStage(null)}
        >
          الشجرة الكاملة
        </button>
        {KNOCKOUT_STAGES.map((st) => {
          const stageMatches = byStage.get(st) || [];
          const completed = stageMatches.filter((m) => m.isCompleted).length;
          const total = stageMatches.length;
          return (
            <button
              key={st}
              type="button"
              disabled={total === 0}
              className={`chip ${selectedStage === st ? 'selected' : ''}`}
              onClick={() => setSelectedStage(st)}
            >
              {STAGE_LABELS[st].label} ({total > 0 ? `${completed}/${total}` : '—'})
            </button>
          );
        })}
      </div>

      {selectedStage === null ? (
        /* Interactive RTL Bracket Tree with SVG Connectors */
        <div
          className="arena-card"
          style={{
            overflowX: 'auto',
            padding: 18,
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'flex-start',
              gap: 0,
              minWidth: 'max-content'
            }}
          >
            {presentStages.map((stage, stageIdx) => {
              const matches = byStage.get(stage) || [];
              const firstRoundMatches = (byStage.get(presentStages[0]) || []).length || 1;
              const baseUnit = 132;
              const slotHeight = baseUnit * Math.pow(2, stageIdx);
              const totalHeight = firstRoundMatches * baseUnit;
              const nextStage = presentStages[stageIdx + 1];
              const nextMatches = nextStage ? byStage.get(nextStage) || [] : [];

              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ width: 232 }}>
                    <div
                      style={{
                        textAlign: 'center',
                        fontWeight: 800,
                        fontSize: '0.86rem',
                        color: stage === 'FINAL' ? 'var(--championship-gold)' : 'var(--cyber-sky)',
                        marginBottom: 12,
                        height: 24
                      }}
                    >
                      {STAGE_LABELS[stage].label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', height: totalHeight }}>
                      {matches.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            height: slotHeight,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <BracketMatchCard
                            match={m}
                            player1={m.player1Id ? playersById.get(m.player1Id) || null : null}
                            player2={m.player2Id ? playersById.get(m.player2Id) || null : null}
                            isFinal={stage === 'FINAL'}
                            canEdit={canEdit}
                            onTap={() => setWinnerDialogMatch(m)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {nextMatches.length > 0 && (
                    <BracketConnectorSvg
                      matchesInRound={matches}
                      nextMatchCount={nextMatches.length}
                      slotHeight={slotHeight}
                      nextSlotHeight={slotHeight * 2}
                      totalHeight={totalHeight}
                      headerOffset={36}
                    />
                  )}
                </div>
              );
            })}

            {/* Champion Pedestal Connector + Card */}
            {finalMatch && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ paddingTop: 36 }}>
                  <svg width={34} height={(byStage.get(presentStages[0])?.length || 1) * 132}>
                    <line
                      x1={34}
                      y1={((byStage.get(presentStages[0])?.length || 1) * 132) / 2}
                      x2={0}
                      y2={((byStage.get(presentStages[0])?.length || 1) * 132) / 2}
                      stroke={resolvedChampion ? 'var(--championship-gold)' : 'var(--card-border)'}
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div
                  style={{
                    width: 190,
                    paddingTop: 36,
                    height: 36 + (byStage.get(presentStages[0])?.length || 1) * 132,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <div
                    className="arena-card"
                    style={{
                      width: '100%',
                      textAlign: 'center',
                      borderColor: resolvedChampion ? 'var(--championship-gold)' : 'var(--card-border)',
                      background: resolvedChampion
                        ? 'linear-gradient(180deg, rgba(245,184,46,0.2), var(--midnight-surface))'
                        : 'var(--midnight-surface)'
                    }}
                  >
                    <Trophy
                      size={28}
                      color={resolvedChampion ? 'var(--championship-gold)' : 'var(--text-muted)'}
                      style={{ margin: '0 auto 6px' }}
                    />
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--championship-gold)', marginBottom: 8 }}>
                      بطل البطولة
                    </div>
                    {resolvedChampion ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <PlayerAvatar
                          avatarUrl={resolvedChampion.avatarUrl}
                          name={resolvedChampion.name}
                          size={44}
                          borderColor="var(--championship-gold)"
                        />
                        <div style={{ fontWeight: 800 }}>{resolvedChampion.name}</div>
                        {resolvedChampion.clubName && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--cyber-sky)' }}>
                            {resolvedChampion.clubName}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>يتحدد من النهائي</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Focused Single Stage List */
        <div className="stack-col" style={{ gap: 10 }}>
          {(byStage.get(selectedStage) || []).map((m) => (
            <BracketMatchCard
              key={m.id}
              match={m}
              player1={m.player1Id ? playersById.get(m.player1Id) || null : null}
              player2={m.player2Id ? playersById.get(m.player2Id) || null : null}
              isFinal={selectedStage === 'FINAL'}
              canEdit={canEdit}
              onTap={() => setWinnerDialogMatch(m)}
            />
          ))}
        </div>
      )}

      {winnerDialogMatch && winnerDialogMatch.player1Id && winnerDialogMatch.player2Id && (
        <WinnerDialog
          match={winnerDialogMatch}
          p1={playersById.get(winnerDialogMatch.player1Id)!}
          p2={playersById.get(winnerDialogMatch.player2Id)!}
          onClose={() => setWinnerDialogMatch(null)}
          onPickWinner={async (wId) => {
            await onSelectWinner(winnerDialogMatch.id, wId);
            setWinnerDialogMatch(null);
          }}
          onOpenScoreEditor={() => {
            const target = winnerDialogMatch;
            setWinnerDialogMatch(null);
            onEditMatch(target);
          }}
        />
      )}
    </div>
  );
}

function BracketMatchCard({
  match,
  player1,
  player2,
  isFinal,
  canEdit,
  onTap
}: {
  match: Match;
  player1: Player | null;
  player2: Player | null;
  isFinal: boolean;
  canEdit: boolean;
  onTap: () => void;
}) {
  const canTap = canEdit && player1 != null && player2 != null;
  const p1Won = match.isCompleted && match.winnerId != null && match.winnerId === player1?.id;
  const p2Won = match.isCompleted && match.winnerId != null && match.winnerId === player2?.id;

  const s1 = match.isTwoLegged
    ? match.leg1Score1 != null
      ? String(match.leg1Score1 + (match.leg2Score1 ?? 0))
      : '-'
    : match.leg1Score1 != null
    ? String(match.leg1Score1)
    : '-';

  const s2 = match.isTwoLegged
    ? match.leg1Score2 != null
      ? String(match.leg1Score2 + (match.leg2Score2 ?? 0))
      : '-'
    : match.leg1Score2 != null
    ? String(match.leg1Score2)
    : '-';

  return (
    <div
      onClick={canTap ? onTap : undefined}
      role={canTap ? 'button' : undefined}
      tabIndex={canTap ? 0 : undefined}
      style={{
        width: '100%',
        borderRadius: 15,
        background: isFinal ? 'var(--elevated-navy)' : 'var(--midnight-surface)',
        border: `${isFinal ? 2 : 1}px solid ${
          isFinal
            ? 'var(--championship-gold)'
            : match.isCompleted
            ? 'var(--emerald-win)'
            : canTap
            ? 'var(--electric-cobalt)'
            : 'var(--card-border)'
        }`,
        overflow: 'hidden',
        cursor: canTap ? 'pointer' : 'default'
      }}
    >
      <div
        style={{
          background: 'rgba(7,9,19,0.6)',
          padding: '5px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.72rem'
        }}
      >
        <span style={{ color: isFinal ? 'var(--championship-gold)' : 'var(--text-secondary)', fontWeight: 700 }}>
          {isFinal ? 'النهائي الكبير' : `${STAGE_LABELS[match.stage].label} #${match.bracketIndex + 1}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {match.penaltyScore1 != null && match.penaltyScore2 != null && (
            <span style={{ color: 'var(--championship-gold)', fontWeight: 700 }}>
              ر.ت {match.penaltyScore1}-{match.penaltyScore2}
            </span>
          )}
          {match.isCompleted && <CheckCircle2 size={13} color="var(--emerald-win)" />}
          {canTap && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '1px 6px',
                borderRadius: 6,
                background: 'rgba(37,99,235,0.24)',
                color: 'var(--cyber-sky)',
                fontWeight: 700
              }}
            >
              <Edit3 size={11} />
              <span>{match.winnerId ? 'تعديل' : 'تحديد'}</span>
            </span>
          )}
        </div>
      </div>

      <BracketSlotRow player={player1} score={s1} isWinner={p1Won} isEliminated={p2Won} />
      <div style={{ height: 1, background: 'rgba(39,52,94,0.5)' }} />
      <BracketSlotRow player={player2} score={s2} isWinner={p2Won} isEliminated={p1Won} />
    </div>
  );
}

function BracketSlotRow({
  player,
  score,
  isWinner,
  isEliminated
}: {
  player: Player | null;
  score: string;
  isWinner: boolean;
  isEliminated: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 10px',
        background: isWinner
          ? 'rgba(245,184,46,0.14)'
          : isEliminated
          ? 'rgba(7,9,19,0.28)'
          : 'transparent'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <PlayerAvatar
          avatarUrl={player?.avatarUrl}
          name={player?.name || '؟'}
          size={24}
          borderColor={isWinner ? 'var(--championship-gold)' : 'var(--card-border)'}
        />
        <span
          style={{
            fontSize: '0.82rem',
            fontWeight: isWinner ? 800 : 500,
            color: isWinner ? 'var(--championship-gold)' : player ? 'var(--text-primary)' : 'var(--text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {player?.name || 'بانتظار المتأهل'}
        </span>
      </div>
      <span
        className="score-num"
        style={{
          padding: '2px 8px',
          borderRadius: 6,
          background: isWinner ? 'rgba(245,184,46,0.22)' : 'var(--elevated-navy)',
          color: isWinner ? 'var(--championship-gold)' : 'var(--text-primary)',
          fontSize: '0.88rem'
        }}
      >
        {score}
      </span>
    </div>
  );
}

function BracketConnectorSvg({
  matchesInRound,
  nextMatchCount,
  slotHeight,
  nextSlotHeight,
  totalHeight,
  headerOffset
}: {
  matchesInRound: Match[];
  nextMatchCount: number;
  slotHeight: number;
  nextSlotHeight: number;
  totalHeight: number;
  headerOffset: number;
}) {
  const w = 44;
  // In RTL flex layout, child column is on the right (x = w) and parent column is on the left (x = 0)
  const childX = w;
  const parentX = 0;
  const midX = w / 2;

  const paths: Array<{ d: string; active: boolean }> = [];
  for (let i = 0; i < nextMatchCount; i++) {
    const topY = slotHeight * (i * 2) + slotHeight / 2;
    const botY = slotHeight * (i * 2 + 1) + slotHeight / 2;
    const parentY = nextSlotHeight * i + nextSlotHeight / 2;
    const topM = matchesInRound[i * 2];
    const botM = matchesInRound[i * 2 + 1];
    paths.push({
      d: `M ${childX} ${topY} L ${midX} ${topY} L ${midX} ${parentY} L ${parentX} ${parentY}`,
      active: Boolean(topM?.winnerId)
    });
    paths.push({
      d: `M ${childX} ${botY} L ${midX} ${botY} L ${midX} ${parentY} L ${parentX} ${parentY}`,
      active: Boolean(botM?.winnerId)
    });
  }

  return (
    <div style={{ paddingTop: headerOffset, flexShrink: 0 }}>
      <svg width={w} height={totalHeight} style={{ display: 'block' }}>
        {paths
          .filter((p) => !p.active)
          .map((p, idx) => (
            <path
              key={`in_${idx}`}
              d={p.d}
              fill="none"
              stroke="var(--card-border)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        {paths
          .filter((p) => p.active)
          .map((p, idx) => (
            <path
              key={`ac_${idx}`}
              d={p.d}
              fill="none"
              stroke="var(--championship-gold)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
      </svg>
    </div>
  );
}

function WinnerDialog({
  match,
  p1,
  p2,
  onClose,
  onPickWinner,
  onOpenScoreEditor
}: {
  match: Match;
  p1: Player;
  p2: Player;
  onClose: () => void;
  onPickWinner: (id: number | null) => Promise<void>;
  onOpenScoreEditor: () => void;
}) {
  const isFinal = match.stage === 'FINAL';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.08rem' }}>
              تحديث الفائز — {STAGE_LABELS[match.stage].label}
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {isFinal ? 'اختر بطل البطولة أو سجّل النتيجة الكاملة' : 'اختر المتأهل للدور التالي أو أدخل الأهداف'}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        {[p1, p2].map((player) => {
          const isCurrent = match.winnerId === player.id;
          return (
            <button
              key={player.id}
              type="button"
              className="arena-subcard"
              onClick={() => onPickWinner(player.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                borderColor: isCurrent ? 'var(--championship-gold)' : 'var(--card-border)',
                background: isCurrent ? 'rgba(245,184,46,0.16)' : 'var(--elevated-navy)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PlayerAvatar avatarUrl={player.avatarUrl} name={player.name} size={38} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: isCurrent ? 'var(--championship-gold)' : 'var(--text-primary)' }}>
                    {player.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{player.elysiumNetId}</div>
                </div>
              </div>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: isCurrent ? 'var(--championship-gold)' : 'rgba(37,99,235,0.25)',
                  color: isCurrent ? 'var(--midnight-surface)' : 'var(--cyber-sky)'
                }}
              >
                {isCurrent ? 'الفائز الحالي ✓' : isFinal ? 'تتويج' : 'تأهيل'}
              </span>
            </button>
          );
        })}

        <button type="button" className="btn btn-primary" onClick={onOpenScoreEditor}>
          إدخال النتيجة التفصيلية
        </button>

        {match.winnerId != null && (
          <button type="button" className="btn btn-danger-outline" onClick={() => onPickWinner(null)}>
            <RefreshCw size={16} />
            <span>إلغاء تحديد الفائز وإعادة الفتح</span>
          </button>
        )}
      </div>
    </div>
  );
}
