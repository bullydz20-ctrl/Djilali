import { LayoutGrid } from 'lucide-react';
import { EmptyStatePanel, PlayerAvatar } from '../components/PlayerAvatar';
import { MatchResultsTable } from '../components/MatchResultsTable';
import { adminHasPermission } from '../types';
import type { ArenaState, GroupStandingRow, Match, Player } from '../types';

export function GroupsScreen({
  state,
  onEditMatch,
  onQuickUpdateGoals,
  onOpenReminder
}: {
  state: ArenaState;
  onEditMatch: (m: Match) => void;
  onQuickUpdateGoals: (m: Match, g1: number, g2: number) => void;
  onOpenReminder: (m: Match) => void;
}) {
  const t = state.tournament;
  const playersById = new Map<number, Player>(state.players.map((p) => [p.id, p]));
  const remindersByMatchId = new Map(state.matchReminders.map((r) => [r.matchId, r]));
  const canEditScores = adminHasPermission(state.currentAdmin, 'EDIT_SCORES');
  const unit = t?.scoreUnitLabel || 'نقطة';

  if (!t) return null;

  if (t.format === 'DIRECT_KNOCKOUT') {
    return (
      <EmptyStatePanel
        icon={<LayoutGrid size={28} />}
        title="البطولة بنظام الخروج المباشر"
        subtitle="هذه البطولة تبدأ مباشرة من الأدوار الإقصائية دون مرحلة مجموعات أو دوري."
      />
    );
  }

  if (state.groupsWithStandings.length === 0 && state.leagueStandings.length === 0) {
    return (
      <EmptyStatePanel
        icon={<LayoutGrid size={28} />}
        title="لم يتم توزيع المجموعات / الدوري بعد"
        subtitle="بمجرد اعتماد اللاعبين وإجراء القرعة من لوحة الإدارة، ستظهر جداول الترتيب والمواجهات هنا مباشرة."
      />
    );
  }

  return (
    <div className="stack-col">
      {state.groupsWithStandings.map((grp) => (
        <div key={grp.group.id} className="stack-col" style={{ gap: 10 }}>
          <StandingsCard title={grp.group.name} rows={grp.standings} />
          {grp.matches.length > 0 && (
            <MatchResultsTable
              title={`مواجهات ${grp.group.name}`}
              matches={grp.matches}
              playersById={playersById}
              canEdit={canEditScores}
              scoreUnitLabel={unit}
              remindersByMatchId={remindersByMatchId}
              onQuickUpdateGoals={onQuickUpdateGoals}
              onOpenDetailedEditor={onEditMatch}
              onOpenReminder={onOpenReminder}
              showFilters={false}
            />
          )}
        </div>
      ))}

      {state.leagueStandings.length > 0 && (
        <div className="stack-col" style={{ gap: 10 }}>
          <StandingsCard title="جدول ترتيب الدوري" rows={state.leagueStandings} />
          {state.leagueMatches.length > 0 && (
            <MatchResultsTable
              title="مواجهات مرحلة الدوري"
              matches={state.leagueMatches}
              playersById={playersById}
              canEdit={canEditScores}
              scoreUnitLabel={unit}
              remindersByMatchId={remindersByMatchId}
              onQuickUpdateGoals={onQuickUpdateGoals}
              onOpenDetailedEditor={onEditMatch}
              onOpenReminder={onOpenReminder}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StandingsCard({ title, rows }: { title: string; rows: GroupStandingRow[] }) {
  return (
    <div className="arena-card" style={{ overflowX: 'auto' }}>
      <div style={{ fontWeight: 800, color: 'var(--championship-gold)', marginBottom: 10, fontSize: '1rem' }}>
        {title}
      </div>
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="col-player">اللاعب</th>
            <th>لعب</th>
            <th>ف</th>
            <th>ت</th>
            <th>خ</th>
            <th>ف.أ</th>
            <th style={{ color: 'var(--championship-gold)' }}>نقاط</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.player.id} className={r.isQualified ? 'standings-row-qualified' : ''}>
              <td style={{ fontWeight: 800, color: r.isQualified ? 'var(--emerald-win)' : 'var(--text-secondary)' }}>
                {r.position}
              </td>
              <td className="col-player">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PlayerAvatar avatarUrl={r.player.avatarUrl} name={r.player.name} size={28} />
                  <span style={{ fontWeight: 700 }}>{r.player.name}</span>
                </div>
              </td>
              <td>{r.played}</td>
              <td>{r.wins}</td>
              <td>{r.draws}</td>
              <td>{r.losses}</td>
              <td dir="ltr">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
              <td className="score-num" style={{ fontSize: '1rem', color: 'var(--championship-gold)' }}>
                {r.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
