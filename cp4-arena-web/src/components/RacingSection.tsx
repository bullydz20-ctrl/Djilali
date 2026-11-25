import { useState } from 'react';
import { Award, CheckCircle2, Edit3, Flag, Plus, Trash2, Trophy } from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar';
import { RACE_STAGE_LABELS } from '../types';
import type { ArenaState, RaceEntry, RaceStage } from '../types';

export function isRacingFormat(format?: string | null): boolean {
  return format === 'RACE_POINTS' || format === 'RACE_QUALIFIERS_FINAL';
}

export function RacingOverviewPanel({
  state,
  canEdit,
  canRunDraw,
  onCreateRace,
  onEditRace,
  onGenerateFinalRace,
  onDeleteRace
}: {
  state: ArenaState;
  canEdit: boolean;
  canRunDraw?: boolean;
  onCreateRace?: (payload: { title?: string; stage?: RaceStage; trackName?: string }) => Promise<void>;
  onEditRace?: (race: RaceEntry) => void;
  onGenerateFinalRace?: (payload?: { title?: string; trackName?: string; qualifiersCount?: number }) => Promise<void>;
  onDeleteRace?: (raceId: number) => Promise<void>;
}) {
  const t = state.tournament;
  const races = state.races || [];
  const standings = state.racingStandings || [];
  const playersById = new Map(state.players.map((p) => [p.id, p]));
  const [newTitle, setNewTitle] = useState('');
  const [newTrack, setNewTrack] = useState('');
  const [busy, setBusy] = useState(false);

  if (!t) return null;

  const isQualifiersMode = t.format === 'RACE_QUALIFIERS_FINAL';
  const pointsConfig = t.racingPointsConfig || [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

  return (
    <div className="stack-col">
      {/* Points Config Pill Summary */}
      <div className="arena-card stack-col" style={{ gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--championship-gold)', fontWeight: 800 }}>
            <Flag size={18} />
            <span>نظام نقاط المراكز ({t.gameTitle})</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--cyber-sky)', fontWeight: 700 }}>
            {isQualifiersMode ? `تصفيات ثم نهائي (يتأهل ${t.qualifiersPerGroup})` : 'نقاط وترتيب بعد كل سباق'}
          </span>
        </div>
        <div className="chip-row">
          {pointsConfig.slice(0, 10).map((pts, idx) => (
            <span
              key={idx}
              style={{
                padding: '4px 9px',
                borderRadius: 8,
                background: idx < 3 ? 'rgba(245,184,46,0.16)' : 'var(--elevated-navy)',
                border: `1px solid ${idx < 3 ? 'rgba(245,184,46,0.5)' : 'var(--card-border)'}`,
                fontSize: '0.74rem',
                fontWeight: 700,
                color: idx < 3 ? 'var(--championship-gold)' : 'var(--text-primary)'
              }}
            >
              #{idx + 1}: {pts} ن
            </span>
          ))}
        </div>
      </div>

      {/* Live Racing Leaderboard */}
      <div className="arena-card" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 800, color: 'var(--championship-gold)', fontSize: '1rem' }}>
            الترتيب العام للمتسابقين
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            السباقات المكتملة: {races.filter((r) => r.isCompleted).length} / {races.length}
          </span>
        </div>

        {standings.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            بانتظار اعتماد المتسابقين وتسجيل نتائج السباق الأول.
          </div>
        ) : (
          <table className="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th className="col-player">المتسابق</th>
                <th>سباقات</th>
                <th>فوز</th>
                <th>بوديوم</th>
                <th>أفضل مركز</th>
                <th style={{ color: 'var(--championship-gold)' }}>النقاط</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr key={row.player.id} className={isQualifiersMode && row.isQualified ? 'standings-row-qualified' : ''}>
                  <td style={{ fontWeight: 800, color: row.rank <= 3 ? 'var(--championship-gold)' : 'var(--text-secondary)' }}>
                    {row.rank}
                  </td>
                  <td className="col-player">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PlayerAvatar avatarUrl={row.player.avatarUrl} name={row.player.name} size={28} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{row.player.name}</div>
                        {isQualifiersMode && row.isQualified && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--emerald-win)', fontWeight: 700 }}>
                            متأهل للنهائي
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{row.racesEntered}</td>
                  <td>{row.wins}</td>
                  <td>{row.podiums}</td>
                  <td>{row.bestPosition != null ? `#${row.bestPosition}` : '—'}</td>
                  <td className="score-num" style={{ fontSize: '1rem', color: 'var(--championship-gold)' }}>
                    {row.totalPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Admin Add Race / Generate Final */}
      {canEdit && onCreateRace && (
        <div className="arena-card stack-col" style={{ gap: 10 }}>
          <div style={{ fontWeight: 800, color: 'var(--cyber-sky)' }}>إدارة جولات السباق</div>
          <div className="grid-2">
            <input
              className="input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={`عنوان السباق (مثال: السباق ${races.length + 1})`}
            />
            <input
              className="input"
              value={newTrack}
              onChange={(e) => setNewTrack(e.target.value)}
              placeholder="اسم الحلبة / المسار (اختياري)"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || state.approvedPlayers.length < 2}
              onClick={async () => {
                setBusy(true);
                try {
                  await onCreateRace({
                    title: newTitle.trim() || undefined,
                    trackName: newTrack.trim() || undefined,
                    stage: isQualifiersMode ? 'QUALIFIER' : 'REGULAR'
                  });
                  setNewTitle('');
                  setNewTrack('');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus size={16} />
              <span>إضافة سباق جديد</span>
            </button>

            {isQualifiersMode && canRunDraw && onGenerateFinalRace && (
              <button
                type="button"
                className="btn btn-gold"
                disabled={busy || standings.length < 2}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onGenerateFinalRace({
                      trackName: newTrack.trim() || undefined,
                      qualifiersCount: t.qualifiersPerGroup
                    });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trophy size={16} />
                <span>تأهيل المتصدرين للسباق النهائي ({t.qualifiersPerGroup})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Races List */}
      <div className="stack-col" style={{ gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: '1rem' }}>جدول السباقات ({races.length})</div>
        {races.length === 0 ? (
          <div className="arena-card" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            لم يتم فتح أي سباق بعد. استخدم لوحة الإدارة لإضافة السباق الأول.
          </div>
        ) : (
          races.map((race) => {
            const isFinal = race.stage === 'FINAL';
            const sortedResults = [...(race.results || [])].sort((a, b) => a.position - b.position);
            return (
              <div
                key={race.id}
                className={`arena-card stack-col ${isFinal ? 'arena-card-gold' : ''}`}
                style={{ gap: 10 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: isFinal ? 'rgba(245,184,46,0.2)' : 'rgba(56,189,248,0.16)',
                          color: isFinal ? 'var(--championship-gold)' : 'var(--cyber-sky)'
                        }}
                      >
                        {RACE_STAGE_LABELS[race.stage]?.label || race.stage}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '0.96rem' }}>{race.title}</span>
                    </div>
                    {race.trackName && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                        المسار: {race.trackName}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {race.isCompleted && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: 'var(--emerald-win)'
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>مكتمل</span>
                      </span>
                    )}
                    {canEdit && onEditRace && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                        onClick={() => onEditRace(race)}
                      >
                        <Edit3 size={14} />
                        <span>{race.isCompleted ? 'تعديل المراكز' : 'تسجيل المراكز'}</span>
                      </button>
                    )}
                    {canEdit && onDeleteRace && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="حذف السباق"
                        onClick={() => onDeleteRace(race.id)}
                        style={{ color: 'var(--crimson-loss)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {sortedResults.length > 0 ? (
                  <div className="stack-col" style={{ gap: 6 }}>
                    {sortedResults.map((res) => {
                      const racer = playersById.get(res.playerId);
                      if (!racer) return null;
                      return (
                        <div
                          key={res.id}
                          className="arena-subcard"
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span
                              className="score-num"
                              style={{
                                width: 26,
                                textAlign: 'center',
                                fontWeight: 800,
                                color:
                                  res.dnf
                                    ? 'var(--crimson-loss)'
                                    : res.position === 1
                                      ? 'var(--championship-gold)'
                                      : 'var(--text-primary)'
                              }}
                            >
                              {res.dnf ? 'DNF' : `#${res.position}`}
                            </span>
                            <PlayerAvatar avatarUrl={racer.avatarUrl} name={racer.name} size={28} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{racer.name}</div>
                              {res.bestLapOrTime && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--cyber-sky)' }}>{res.bestLapOrTime}</div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <Award size={14} color="var(--championship-gold)" />
                            <span className="score-num" style={{ color: 'var(--championship-gold)', fontWeight: 800 }}>
                              +{res.pointsAwarded} ن
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    لم يتم تسجيل نتائج هذا السباق بعد.
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
