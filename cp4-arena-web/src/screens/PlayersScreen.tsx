import { useState } from 'react';
import { Lock, Search, Shield, UserPlus, Users } from 'lucide-react';
import { EmptyStatePanel, PlayerAvatar } from '../components/PlayerAvatar';
import { LEVEL_LABELS } from '../types';
import type { ArenaState } from '../types';

export function PlayersScreen({
  state,
  onOpenRegister
}: {
  state: ArenaState;
  onOpenRegister: () => void;
}) {
  const [search, setSearch] = useState('');
  const statsById = new Map(state.playerStats.map((s) => [s.player.id, s]));
  const unit = state.tournament?.scoreUnitLabel || 'نقطة';

  const q = search.trim().toLowerCase();
  const filtered = q
    ? state.approvedPlayers.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.elysiumNetId.toLowerCase().includes(q) ||
          p.clubName.toLowerCase().includes(q)
      )
    : state.approvedPlayers;

  return (
    <div className="stack-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.22rem', fontWeight: 800 }}>قائمة المشاركين</h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--cyber-sky)' }}>
            {state.approvedPlayers.length} / {state.tournament?.maxParticipants ?? 16} لاعب معتمد
          </div>
        </div>

        {state.isRegistrationOpenNow ? (
          <button type="button" className="btn btn-primary" onClick={onOpenRegister}>
            <UserPlus size={17} />
            <span>تسجيل</span>
          </button>
        ) : (
          <span
            className="arena-subcard"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--championship-gold)', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <Lock size={15} />
            <span>التسجيل مغلق</span>
          </span>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <Search
          size={18}
          color="var(--cyber-sky)"
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        />
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو معرف ElysiumNet..."
          style={{ paddingRight: 38 }}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyStatePanel
          icon={<Users size={28} />}
          title={
            state.approvedPlayers.length === 0
              ? 'لا يوجد مشاركون معتمدون حتى الآن'
              : 'لا توجد نتائج مطابقة للبحث'
          }
          subtitle={
            state.approvedPlayers.length === 0
              ? 'يمكن للاعبين إرسال طلبات التسجيل بالاسم ومعرف ElysiumNet، وستظهر بطاقاتهم الاحترافية هنا فور اعتمادها.'
              : 'جرّب البحث باسم آخر أو بمعرف ElysiumNet.'
          }
          actionLabel={state.isRegistrationOpenNow && state.approvedPlayers.length === 0 ? 'تسجيل أول لاعب' : undefined}
          onAction={state.isRegistrationOpenNow && state.approvedPlayers.length === 0 ? onOpenRegister : undefined}
        />
      ) : (
        <div className="grid-players">
          {filtered.map((player) => {
            const isChampion = state.championPlayer?.id === player.id;
            const stats = statsById.get(player.id);
            const accent =
              isChampion || player.level === 'LEGEND'
                ? 'var(--championship-gold)'
                : player.level === 'PRO'
                ? 'var(--royal-violet)'
                : player.level === 'INTERMEDIATE'
                ? 'var(--electric-cobalt)'
                : 'var(--cyber-sky)';

            return (
              <div
                key={player.id}
                className="arena-card"
                style={{
                  padding: 14,
                  borderColor: accent,
                  background: `linear-gradient(155deg, rgba(22,31,59,0.95) 0%, var(--midnight-surface) 60%)`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="score-num" style={{ fontSize: '1.55rem', lineHeight: 1, color: accent }}>
                      {player.ovrRating}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>OVR</div>
                  </div>
                  <PlayerAvatar avatarUrl={player.avatarUrl} name={player.name} size={54} borderColor={accent} />
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 8,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: accent,
                      background: 'rgba(7,9,19,0.75)',
                      border: `1px solid ${accent}`
                    }}
                  >
                    {isChampion ? 'البطل' : LEVEL_LABELS[player.level].label}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontWeight: 800,
                    fontSize: '0.96rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {player.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', color: 'var(--cyber-sky)', marginTop: 2 }}>
                  <Shield size={13} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player.elysiumNetId}
                  </span>
                </div>
                {player.clubName && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    الفريق: {player.clubName}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 10,
                    borderRadius: 10,
                    background: 'rgba(7,9,19,0.6)',
                    padding: '6px 8px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    textAlign: 'center'
                  }}
                >
                  <MiniStat label="لعب" value={stats?.matchesPlayed ?? 0} />
                  <MiniStat label="فوز" value={stats?.wins ?? 0} />
                  <MiniStat label={unit} value={stats?.goalsScored ?? 0} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="score-num" style={{ fontSize: '0.95rem' }}>{value}</div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}
