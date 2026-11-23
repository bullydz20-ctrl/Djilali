import {
  KnockoutTieRule,
  MATCH_STAGE_META,
  MatchStage,
  TOURNAMENT_FORMAT_META,
  TOURNAMENT_STATUS_META
} from './constants.js';

const ARABIC_GROUP_LETTERS = [
  'المجموعة أ',
  'المجموعة ب',
  'المجموعة ج',
  'المجموعة د',
  'المجموعة هـ',
  'المجموعة و',
  'المجموعة ز',
  'المجموعة ح'
];

export function groupDisplayName(index) {
  return ARABIC_GROUP_LETTERS[index] ?? `المجموعة ${index + 1}`;
}

export function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateRoundRobinMatches({
  tournamentId,
  stage,
  groupId = null,
  playerIds,
  doubleRoundRobin = false
}) {
  if (playerIds.length < 2) return [];
  const rotated = [...playerIds];
  if (rotated.length % 2 !== 0) {
    rotated.push(null);
  }
  const n = rotated.length;
  const numRounds = n - 1;
  const half = n / 2;
  const result = [];

  for (let round = 0; round < numRounds; round++) {
    for (let i = 0; i < half; i++) {
      const p1 = rotated[i];
      const p2 = rotated[n - 1 - i];
      if (p1 !== null && p2 !== null) {
        const home = round % 2 === 0 ? p1 : p2;
        const away = round % 2 === 0 ? p2 : p1;
        result.push({
          tournamentId,
          stage,
          groupId,
          roundNumber: round + 1,
          bracketIndex: result.length,
          player1Id: home,
          player2Id: away,
          isTwoLegged: false,
          isCompleted: false,
          winnerId: null,
          nextMatchId: null,
          nextMatchSlot: 1,
          scheduledLabel: `الجولة ${round + 1}`,
          scheduledAtMillis: null
        });
      }
    }
    const last = rotated.pop();
    rotated.splice(1, 0, last);
  }

  if (doubleRoundRobin) {
    const firstLegCount = result.length;
    for (let i = 0; i < firstLegCount; i++) {
      const m = result[i];
      result.push({
        ...m,
        roundNumber: m.roundNumber + numRounds,
        bracketIndex: result.length,
        player1Id: m.player2Id,
        player2Id: m.player1Id,
        scheduledLabel: `الجولة ${m.roundNumber + numRounds}`
      });
    }
  }

  return result;
}

export function distributePlayersIntoGroups(players, groups, shuffle = true) {
  if (!groups.length || !players.length) return players;
  const ordered = shuffle ? shuffleArray(players) : players;
  return ordered.map((player, idx) => ({
    ...player,
    groupId: groups[idx % groups.length].id,
    seedOrder: idx + 1
  }));
}

export function computeStandings(players, matches, qualifiersCount) {
  if (!players.length) return [];
  const accMap = new Map();
  for (const p of players) {
    accMap.set(p.id, {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      pts: 0
    });
  }

  for (const match of matches) {
    if (!match.isCompleted) continue;
    const p1 = match.player1Id;
    const p2 = match.player2Id;
    const s1 = match.leg1Score1;
    const s2 = match.leg1Score2;
    if (p1 == null || p2 == null || s1 == null || s2 == null) continue;

    const a1 = accMap.get(p1);
    const a2 = accMap.get(p2);

    if (a1) {
      a1.played += 1;
      a1.gf += s1;
      a1.ga += s2;
      if (s1 > s2) {
        a1.wins += 1;
        a1.pts += 3;
      } else if (s1 === s2) {
        a1.draws += 1;
        a1.pts += 1;
      } else {
        a1.losses += 1;
      }
    }
    if (a2) {
      a2.played += 1;
      a2.gf += s2;
      a2.ga += s1;
      if (s2 > s1) {
        a2.wins += 1;
        a2.pts += 3;
      } else if (s2 === s1) {
        a2.draws += 1;
        a2.pts += 1;
      } else {
        a2.losses += 1;
      }
    }
  }

  const rows = players.map((player) => {
    const a = accMap.get(player.id);
    return {
      player,
      position: 0,
      played: a.played,
      wins: a.wins,
      draws: a.draws,
      losses: a.losses,
      goalsFor: a.gf,
      goalsAgainst: a.ga,
      goalDifference: a.gf - a.ga,
      points: a.pts,
      isQualified: false
    };
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.player.name.localeCompare(b.player.name, 'ar');
  });

  return rows.map((row, idx) => ({
    ...row,
    position: idx + 1,
    isQualified: idx < qualifiersCount
  }));
}

export function buildKnockoutSeedPairsFromGroups(groupStandings, qualifiersPerGroup) {
  const allQualified = [];
  if (groupStandings.length >= 2 && qualifiersPerGroup >= 2) {
    const firsts = groupStandings.map((g) => g[0]?.player?.id).filter((id) => id != null);
    const seconds = groupStandings.map((g) => g[1]?.player?.id).filter((id) => id != null);
    const paired = [];
    let idx = 0;
    while (idx < firsts.length) {
      if (idx + 1 < firsts.length && idx + 1 < seconds.length) {
        paired.push(firsts[idx], seconds[idx + 1], firsts[idx + 1], seconds[idx]);
        idx += 2;
      } else {
        paired.push(firsts[idx]);
        if (seconds[idx] != null) paired.push(seconds[idx]);
        idx += 1;
      }
    }
    for (let pos = 2; pos < qualifiersPerGroup; pos++) {
      for (const group of groupStandings) {
        const id = group[pos]?.player?.id;
        if (id != null && !paired.includes(id)) paired.push(id);
      }
    }
    allQualified.push(...paired);
  } else {
    for (let pos = 0; pos < qualifiersPerGroup; pos++) {
      for (const group of groupStandings) {
        const id = group[pos]?.player?.id;
        if (id != null) allQualified.push(id);
      }
    }
  }

  const capped = allQualified.slice(0, 16);
  const bracketSize = Math.min(16, nextPowerOfTwo(Math.max(2, capped.length)));
  const padded = new Array(bracketSize).fill(null);
  for (let i = 0; i < capped.length; i++) {
    padded[i] = capped[i];
  }
  return padded;
}

export function buildKnockoutTreeDrafts({ tournamentId, seededSlots, tieRule, includeThirdPlace = false }) {
  const bracketSize = Math.max(2, Math.min(16, nextPowerOfTwo(Math.max(2, seededSlots.length))));
  const padded = Array.from({ length: bracketSize }, (_, i) => seededSlots[i] ?? null);

  let stages;
  if (bracketSize === 16) {
    stages = [MatchStage.FINAL, MatchStage.SEMI_FINAL, MatchStage.QUARTER_FINAL, MatchStage.ROUND_OF_16];
  } else if (bracketSize === 8) {
    stages = [MatchStage.FINAL, MatchStage.SEMI_FINAL, MatchStage.QUARTER_FINAL];
  } else if (bracketSize === 4) {
    stages = [MatchStage.FINAL, MatchStage.SEMI_FINAL];
  } else {
    stages = [MatchStage.FINAL];
  }

  const drafts = [];
  const roundStartIndices = new Map();

  stages.forEach((stage, depth) => {
    const matchCount = 1 << depth;
    roundStartIndices.set(depth, drafts.length);
    const isFirstRound = depth === stages.length - 1;
    const isFinal = stage === MatchStage.FINAL;
    const twoLegged = tieRule === KnockoutTieRule.TWO_LEGS_FINAL_SINGLE && !isFinal;
    const stageMeta = MATCH_STAGE_META[stage];

    for (let i = 0; i < matchCount; i++) {
      const tempIndex = drafts.length;
      const parentDepth = depth - 1;
      const parentTempIndex =
        parentDepth >= 0 ? roundStartIndices.get(parentDepth) + Math.floor(i / 2) : null;
      const slotInParent = i % 2 === 0 ? 1 : 2;
      const p1 = isFirstRound ? padded[i * 2] ?? null : null;
      const p2 = isFirstRound ? padded[i * 2 + 1] ?? null : null;

      drafts.push({
        tempIndex,
        parentTempIndex,
        slotInParent,
        entity: {
          tournamentId,
          stage,
          groupId: null,
          roundNumber: stageMeta.order,
          bracketIndex: i,
          player1Id: p1,
          player2Id: p2,
          isTwoLegged: twoLegged,
          isCompleted: false,
          winnerId: null,
          nextMatchId: null,
          nextMatchSlot: slotInParent,
          scheduledLabel: stageMeta.labelAr,
          scheduledAtMillis: null
        }
      });
    }
  });

  if (includeThirdPlace && bracketSize >= 4) {
    const stageMeta = MATCH_STAGE_META[MatchStage.THIRD_PLACE];
    drafts.push({
      tempIndex: drafts.length,
      parentTempIndex: null,
      slotInParent: 1,
      entity: {
        tournamentId,
        stage: MatchStage.THIRD_PLACE,
        groupId: null,
        roundNumber: stageMeta.order,
        bracketIndex: 0,
        player1Id: null,
        player2Id: null,
        isTwoLegged: false,
        isCompleted: false,
        winnerId: null,
        nextMatchId: null,
        nextMatchSlot: 1,
        scheduledLabel: stageMeta.labelAr,
        scheduledAtMillis: null
      }
    });
  }

  return drafts;
}

function resolvePenalties(p1, p2, pen1, pen2) {
  if (pen1 == null || pen2 == null) {
    return { ok: false, error: 'انتهى اللقاء بالتعادل — يرجى إدخال نتيجة الحسم الإضافي / ركلات الترجيح لتحديد المتأهل.' };
  }
  if (pen1 < 0 || pen2 < 0) {
    return { ok: false, error: 'نتيجة الحسم الإضافي غير صالحة.' };
  }
  if (pen1 === pen2) {
    return { ok: false, error: 'لا يمكن أن تنتهي جولة الحسم بالتعادل.' };
  }
  return { ok: true, isCompleted: true, winnerId: pen1 > pen2 ? p1 : p2 };
}

export function resolveMatchResult({ match, leg1S1, leg1S2, leg2S1, leg2S2, pen1, pen2 }) {
  const p1 = match.player1Id;
  const p2 = match.player2Id;
  if (p1 == null || p2 == null) {
    return { ok: false, error: 'لا يمكن تسجيل النتيجة قبل تحديد طرفي المباراة.' };
  }
  if (leg1S1 == null || leg1S2 == null) {
    return { ok: true, isCompleted: false, winnerId: null };
  }
  if (leg1S1 < 0 || leg1S2 < 0 || (leg2S1 != null && leg2S1 < 0) || (leg2S2 != null && leg2S2 < 0)) {
    return { ok: false, error: 'النتيجة لا يمكن أن تكون سالبة.' };
  }

  const isGroupOrLeague = match.stage === MatchStage.GROUP || match.stage === MatchStage.LEAGUE;
  if (isGroupOrLeague) {
    let winnerId = null;
    if (leg1S1 > leg1S2) winnerId = p1;
    else if (leg1S2 > leg1S1) winnerId = p2;
    return { ok: true, isCompleted: true, winnerId };
  }

  if (match.isTwoLegged) {
    if (leg2S1 == null || leg2S2 == null) {
      return { ok: true, isCompleted: false, winnerId: null };
    }
    const agg1 = leg1S1 + leg2S1;
    const agg2 = leg1S2 + leg2S2;
    if (agg1 > agg2) return { ok: true, isCompleted: true, winnerId: p1 };
    if (agg2 > agg1) return { ok: true, isCompleted: true, winnerId: p2 };
    return resolvePenalties(p1, p2, pen1, pen2);
  }

  if (leg1S1 > leg1S2) return { ok: true, isCompleted: true, winnerId: p1 };
  if (leg1S2 > leg1S1) return { ok: true, isCompleted: true, winnerId: p2 };
  return resolvePenalties(p1, p2, pen1, pen2);
}

export function computeTournamentStats(players, matches) {
  const statsMap = new Map();
  for (const p of players) {
    statsMap.set(p.id, { played: 0, wins: 0, draws: 0, losses: 0, gs: 0, gc: 0, cs: 0 });
  }
  let totalGoals = 0;
  let completedMatches = 0;

  for (const match of matches) {
    if (match.isCompleted) completedMatches += 1;
    const p1 = match.player1Id;
    const p2 = match.player2Id;
    if (p1 == null || p2 == null) continue;
    const s1 = match.leg1Score1;
    const s2 = match.leg1Score2;
    if (s1 != null && s2 != null && match.isCompleted) {
      const l2g1 = match.isTwoLegged ? match.leg2Score1 ?? 0 : 0;
      const l2g2 = match.isTwoLegged ? match.leg2Score2 ?? 0 : 0;
      const tot1 = s1 + l2g1;
      const tot2 = s2 + l2g2;
      totalGoals += tot1 + tot2;

      const a1 = statsMap.get(p1);
      const a2 = statsMap.get(p2);

      if (a1) {
        a1.played += 1;
        a1.gs += tot1;
        a1.gc += tot2;
        if (s2 === 0 && (!match.isTwoLegged || l2g2 === 0)) a1.cs += 1;
        if (match.winnerId === p1) a1.wins += 1;
        else if (match.winnerId === p2) a1.losses += 1;
        else if (tot1 > tot2) a1.wins += 1;
        else if (tot1 === tot2) a1.draws += 1;
        else a1.losses += 1;
      }
      if (a2) {
        a2.played += 1;
        a2.gs += tot2;
        a2.gc += tot1;
        if (s1 === 0 && (!match.isTwoLegged || l2g1 === 0)) a2.cs += 1;
        if (match.winnerId === p2) a2.wins += 1;
        else if (match.winnerId === p1) a2.losses += 1;
        else if (tot2 > tot1) a2.wins += 1;
        else if (tot2 === tot1) a2.draws += 1;
        else a2.losses += 1;
      }
    }
  }

  const playerStats = players
    .map((player) => {
      const a = statsMap.get(player.id);
      const winRatePercent = a.played > 0 ? Math.floor((a.wins * 100) / a.played) : 0;
      return {
        player,
        matchesPlayed: a.played,
        wins: a.wins,
        draws: a.draws,
        losses: a.losses,
        goalsScored: a.gs,
        goalsConceded: a.gc,
        cleanSheets: a.cs,
        winRatePercent
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.goalsScored !== a.goalsScored) return b.goalsScored - a.goalsScored;
      return a.goalsConceded - b.goalsConceded;
    });

  const active = playerStats.filter((s) => s.matchesPlayed > 0);
  const topScorer = active.reduce(
    (best, cur) =>
      !best || cur.goalsScored > best.goalsScored || (cur.goalsScored === best.goalsScored && cur.matchesPlayed < best.matchesPlayed)
        ? cur
        : best,
    null
  );
  const bestDefense = active.reduce((best, cur) => {
    if (!best) return cur;
    const avgCur = cur.goalsConceded / cur.matchesPlayed;
    const avgBest = best.goalsConceded / best.matchesPlayed;
    if (avgCur < avgBest) return cur;
    if (avgCur === avgBest && cur.cleanSheets > best.cleanSheets) return cur;
    return best;
  }, null);
  const highestWinRate = active.reduce(
    (best, cur) =>
      !best || cur.winRatePercent > best.winRatePercent || (cur.winRatePercent === best.winRatePercent && cur.wins < best.wins)
        ? cur
        : best,
    null
  );

  return {
    playerStats,
    overviewStats: {
      totalMatches: matches.length,
      completedMatches,
      totalGoals,
      topScorer,
      bestDefense,
      highestWinRate
    }
  };
}

function formatMatchLine(match, playersById) {
  const p1 = match.player1Id ? playersById.get(match.player1Id)?.name ?? 'بانتظار المتأهل' : 'بانتظار المتأهل';
  const p2 = match.player2Id ? playersById.get(match.player2Id)?.name ?? 'بانتظار المتأهل' : 'بانتظار المتأهل';
  let scoreStr = 'لم تُلعب';
  if (match.isTwoLegged && match.leg1Score1 != null) {
    const tot1 = match.leg1Score1 + (match.leg2Score1 ?? 0);
    const tot2 = (match.leg1Score2 ?? 0) + (match.leg2Score2 ?? 0);
    scoreStr = `${tot1} - ${tot2} (ذ ${match.leg1Score1}-${match.leg1Score2} / إ ${match.leg2Score1 ?? '-'}-${match.leg2Score2 ?? '-'})`;
  } else if (match.leg1Score1 != null && match.leg1Score2 != null) {
    scoreStr = `${match.leg1Score1} - ${match.leg1Score2}`;
  } else if (match.isCompleted) {
    scoreStr = 'حُسمت';
  }
  const penStr =
    match.penaltyScore1 != null && match.penaltyScore2 != null
      ? ` [حسم ${match.penaltyScore1}-${match.penaltyScore2}]`
      : '';
  const winnerName = match.winnerId ? playersById.get(match.winnerId)?.name : null;
  const winnerSuffix = winnerName ? ` ★ الفائز: ${winnerName}` : '';
  return `${p1} (${scoreStr}${penStr}) ${p2}${winnerSuffix}`;
}

export function buildExportData(state) {
  const t = state.tournament;
  const playersById = new Map(state.players.map((p) => [p.id, p]));
  const stats = state.overviewStats;
  const unit = t?.scoreUnitLabel || 'نقطة';
  const gameTitle = t?.gameTitle || 'CP4 ARENA';
  const finalMatch = state.knockoutMatches.find((m) => m.stage === MatchStage.FINAL);
  const thirdPlaceMatch = state.knockoutMatches.find((m) => m.stage === MatchStage.THIRD_PLACE);
  const resolvedChampion =
    state.championPlayer ?? (finalMatch?.winnerId ? playersById.get(finalMatch.winnerId) : null);

  const lines = [];
  lines.push('════════════════════════════════════════');
  lines.push('🏆 ملخص نتائج البطولة الرسمية — CP4 ARENA');
  lines.push('════════════════════════════════════════');
  lines.push(`البطولة: ${t?.name ?? 'بطولة CP4 ARENA'}`);
  lines.push(`اللعبة: ${gameTitle}`);
  lines.push('المجتمع: COMMUNITY PS4 & GAMING ONLINE');
  if (t) {
    lines.push(`النظام: ${TOURNAMENT_FORMAT_META[t.format]?.labelAr ?? t.format}`);
    lines.push(`الحالة: ${TOURNAMENT_STATUS_META[t.status]?.labelAr ?? t.status}`);
    lines.push(`المشاركون المعتمدون: ${state.approvedPlayers.length} / ${t.maxParticipants}`);
  }
  lines.push(`تقدم المباريات: ${stats.completedMatches} / ${stats.totalMatches} مكتملة`);
  lines.push(`إجمالي (${unit}): ${stats.totalGoals}`);
  lines.push('');

  if (resolvedChampion) {
    lines.push(`🥇 بطل البطولة: ${resolvedChampion.name} (${resolvedChampion.elysiumNetId})`);
    if (resolvedChampion.clubName) lines.push(`   الفريق / النادي: ${resolvedChampion.clubName}`);
    if (finalMatch?.isCompleted && finalMatch.winnerId) {
      const runnerUpId = finalMatch.winnerId === finalMatch.player1Id ? finalMatch.player2Id : finalMatch.player1Id;
      const runnerUp = runnerUpId ? playersById.get(runnerUpId) : null;
      if (runnerUp) lines.push(`🥈 الوصيف: ${runnerUp.name} (${runnerUp.elysiumNetId})`);
    }
    if (thirdPlaceMatch?.isCompleted && thirdPlaceMatch.winnerId) {
      const thirdPlayer = playersById.get(thirdPlaceMatch.winnerId);
      if (thirdPlayer) lines.push(`🥉 المركز الثالث: ${thirdPlayer.name} (${thirdPlayer.elysiumNetId})`);
    }
    lines.push('');
  }

  lines.push('── أبرز الجوائز والإحصائيات ──');
  lines.push(`• هداف البطولة / الأكثر تسجيلاً: ${stats.topScorer ? `${stats.topScorer.player.name} (${stats.topScorer.goalsScored} ${unit})` : 'لم يتحدد بعد'}`);
  lines.push(`• أقوى دفاع: ${stats.bestDefense ? `${stats.bestDefense.player.name} (استقبل ${stats.bestDefense.goalsConceded} | نظيفة ${stats.bestDefense.cleanSheets})` : 'لم يتحدد بعد'}`);
  lines.push(`• أعلى نسبة فوز: ${stats.highestWinRate ? `${stats.highestWinRate.player.name} (${stats.highestWinRate.winRatePercent}% - ${stats.highestWinRate.wins} فوز)` : 'لم يتحدد بعد'}`);

  if (state.groupsWithStandings.length > 0) {
    lines.push('');
    lines.push('── ترتيب المجموعات ──');
    for (const grp of state.groupsWithStandings) {
      lines.push(`[${grp.group.name}]`);
      for (const row of grp.standings) {
        const qual = row.isQualified ? ' ✓ متأهل' : '';
        const diff = row.goalDifference > 0 ? `+${row.goalDifference}` : `${row.goalDifference}`;
        lines.push(`  ${row.position}. ${row.player.name} — ${row.points} ن (لعب ${row.played} | ف ${row.wins} | ت ${row.draws} | خ ${row.losses} | ف.أ ${diff})${qual}`);
      }
    }
  } else if (state.leagueStandings.length > 0) {
    lines.push('');
    lines.push('── ترتيب جدول الدوري ──');
    for (const row of state.leagueStandings) {
      const qual = row.isQualified ? ' ✓ متأهل' : '';
      const diff = row.goalDifference > 0 ? `+${row.goalDifference}` : `${row.goalDifference}`;
      lines.push(`  ${row.position}. ${row.player.name} — ${row.points} ن (لعب ${row.played} | ف ${row.wins} | ت ${row.draws} | خ ${row.losses} | ف.أ ${diff})${qual}`);
    }
  }

  if (state.knockoutMatches.length > 0) {
    lines.push('');
    lines.push('── نتائج الأدوار الإقصائية ──');
    const byStage = new Map();
    for (const m of state.knockoutMatches) {
      if (!byStage.has(m.stage)) byStage.set(m.stage, []);
      byStage.get(m.stage).push(m);
    }
    const orderedStages = [...byStage.keys()].sort((a, b) => MATCH_STAGE_META[a].order - MATCH_STAGE_META[b].order);
    for (const st of orderedStages) {
      lines.push(`▶ ${MATCH_STAGE_META[st].labelAr}`);
      for (const m of byStage.get(st).sort((a, b) => a.bracketIndex - b.bracketIndex)) {
        lines.push(`  • ${formatMatchLine(m, playersById)}`);
      }
    }
  }

  const groupOrLeagueMatches = state.allMatches.filter((m) => m.stage === MatchStage.GROUP || m.stage === MatchStage.LEAGUE);
  if (groupOrLeagueMatches.length > 0) {
    lines.push('');
    lines.push('── نتائج مباريات المجموعات / الدوري ──');
    for (const m of groupOrLeagueMatches) {
      lines.push(`  • ${formatMatchLine(m, playersById)}`);
    }
  }

  lines.push('');
  lines.push('تم الإنشاء عبر منصة CP4 ARENA الرسمية');

  const social = [];
  social.push(`🏆 ${t?.name ?? 'بطولة CP4 ARENA'} [${gameTitle}]`);
  social.push('🎮 CP4 ARENA • COMMUNITY PS4 & GAMING ONLINE');
  social.push('');
  if (resolvedChampion) {
    social.push(`👑 البطل المتوج: ${resolvedChampion.name} (${resolvedChampion.elysiumNetId})`);
  } else {
    social.push(`📊 الحالة: ${TOURNAMENT_STATUS_META[t?.status]?.labelAr ?? 'جارية'} (${stats.completedMatches}/${stats.totalMatches} مباراة)`);
  }
  if (finalMatch && (finalMatch.isCompleted || finalMatch.leg1Score1 != null)) {
    social.push(`🔥 النهائي: ${formatMatchLine(finalMatch, playersById)}`);
  }
  if (thirdPlaceMatch && thirdPlaceMatch.isCompleted) {
    social.push(`🥉 المركز الثالث: ${formatMatchLine(thirdPlaceMatch, playersById)}`);
  }
  const semis = state.knockoutMatches.filter((m) => m.stage === MatchStage.SEMI_FINAL && m.isCompleted).sort((a, b) => a.bracketIndex - b.bracketIndex);
  if (semis.length > 0) {
    social.push('⚡ نصف النهائي:');
    for (const m of semis) social.push(`• ${formatMatchLine(m, playersById)}`);
  }
  if (stats.topScorer) {
    social.push(`⚽ الأكثر تسجيلاً: ${stats.topScorer.player.name} (${stats.topScorer.goalsScored} ${unit})`);
  }
  social.push(`🥅 إجمالي (${unit}): ${stats.totalGoals}`);
  social.push('');
  const gameTag = gameTitle.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Gaming';
  social.push(`#CP4_ARENA #${gameTag} #ElysiumNet`);

  const rawSlug = (t?.name ?? 'cp4_arena').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28);
  const fileName = rawSlug ? `${rawSlug}_results.txt` : 'cp4_arena_results.txt';

  return {
    fileName,
    fullText: lines.join('\n'),
    socialText: social.join('\n')
  };
}

function summarizePlayerSlim(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    elysiumNetId: row.elysium_net_id,
    avatarUrl: row.avatar_url ?? null,
    clubName: row.club_name ?? '',
    level: row.level,
    ovrRating: row.ovr_rating
  };
}

export function computeSeasonLeaderboard(db) {
  const tournaments = db.prepare('SELECT id, status, champion_player_id FROM tournaments').all();
  const approvedPlayers = db
    .prepare("SELECT * FROM players WHERE status = 'APPROVED' ORDER BY registered_at ASC, id ASC")
    .all();
  const completedMatches = db.prepare('SELECT * FROM matches WHERE is_completed = 1').all();

  if (!approvedPlayers.length) return [];

  const playerById = new Map();
  const keyByPlayerId = new Map();
  const aggByKey = new Map();

  for (const p of approvedPlayers) {
    playerById.set(p.id, p);
    const normKey = String(p.elysium_net_id || '').trim().toLowerCase();
    if (!normKey) continue;
    keyByPlayerId.set(p.id, normKey);

    let entry = aggByKey.get(normKey);
    if (!entry) {
      entry = {
        elysiumKey: normKey,
        name: p.name,
        elysiumNetId: p.elysium_net_id,
        avatarUrl: p.avatar_url ?? null,
        clubName: p.club_name ?? '',
        level: p.level,
        ovrRating: p.ovr_rating,
        tournamentIds: new Set(),
        titles: 0,
        runnerUps: 0,
        thirdPlaces: 0,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        cleanSheets: 0
      };
      aggByKey.set(normKey, entry);
    } else {
      // Keep freshest identity metadata
      entry.name = p.name;
      entry.elysiumNetId = p.elysium_net_id;
      if (p.avatar_url) entry.avatarUrl = p.avatar_url;
      if (p.club_name) entry.clubName = p.club_name;
      entry.level = p.level;
      entry.ovrRating = Math.max(entry.ovrRating, p.ovr_rating || 81);
    }
    entry.tournamentIds.add(p.tournament_id);
  }

  // Track tournament podium placements
  const finalsByTournament = new Map();
  const thirdsByTournament = new Map();
  for (const m of completedMatches) {
    if (m.stage === MatchStage.FINAL) finalsByTournament.set(m.tournament_id, m);
    if (m.stage === MatchStage.THIRD_PLACE) thirdsByTournament.set(m.tournament_id, m);

    const p1 = m.player1_id;
    const p2 = m.player2_id;
    if (p1 == null || p2 == null) continue;
    const key1 = keyByPlayerId.get(p1);
    const key2 = keyByPlayerId.get(p2);
    const e1 = key1 ? aggByKey.get(key1) : null;
    const e2 = key2 ? aggByKey.get(key2) : null;

    const s1 = m.leg1_score1;
    const s2 = m.leg1_score2;
    const l2s1 = m.is_two_legged ? (m.leg2_score1 ?? 0) : 0;
    const l2s2 = m.is_two_legged ? (m.leg2_score2 ?? 0) : 0;
    const hasScores = s1 != null && s2 != null;
    const tot1 = hasScores ? s1 + l2s1 : 0;
    const tot2 = hasScores ? s2 + l2s2 : 0;

    if (e1) {
      e1.matchesPlayed += 1;
      e1.goalsScored += tot1;
      e1.goalsConceded += tot2;
      if (hasScores && s2 === 0 && (!m.is_two_legged || l2s2 === 0)) e1.cleanSheets += 1;
      if (m.winner_id === p1) e1.wins += 1;
      else if (m.winner_id === p2) e1.losses += 1;
      else if (hasScores && tot1 > tot2) e1.wins += 1;
      else if (hasScores && tot1 < tot2) e1.losses += 1;
      else e1.draws += 1;
    }
    if (e2) {
      e2.matchesPlayed += 1;
      e2.goalsScored += tot2;
      e2.goalsConceded += tot1;
      if (hasScores && s1 === 0 && (!m.is_two_legged || l2s1 === 0)) e2.cleanSheets += 1;
      if (m.winner_id === p2) e2.wins += 1;
      else if (m.winner_id === p1) e2.losses += 1;
      else if (hasScores && tot2 > tot1) e2.wins += 1;
      else if (hasScores && tot2 < tot1) e2.losses += 1;
      else e2.draws += 1;
    }
  }

  for (const t of tournaments) {
    const finalM = finalsByTournament.get(t.id);
    const champId = t.champion_player_id ?? finalM?.winner_id ?? null;
    if (champId != null) {
      const k = keyByPlayerId.get(champId);
      if (k && aggByKey.has(k)) aggByKey.get(k).titles += 1;
    }
    if (finalM?.winner_id != null) {
      const runnerUpId = finalM.winner_id === finalM.player1_id ? finalM.player2_id : finalM.player1_id;
      if (runnerUpId != null) {
        const k = keyByPlayerId.get(runnerUpId);
        if (k && aggByKey.has(k)) aggByKey.get(k).runnerUps += 1;
      }
    }
    const thirdM = thirdsByTournament.get(t.id);
    if (thirdM?.winner_id != null) {
      const k = keyByPlayerId.get(thirdM.winner_id);
      if (k && aggByKey.has(k)) aggByKey.get(k).thirdPlaces += 1;
    }
  }

  const list = [...aggByKey.values()].map((e) => {
    const seasonPoints =
      e.titles * 25 +
      e.runnerUps * 12 +
      e.thirdPlaces * 7 +
      e.wins * 3 +
      e.draws * 1 +
      e.cleanSheets * 1;
    const winRatePercent = e.matchesPlayed > 0 ? Math.floor((e.wins * 100) / e.matchesPlayed) : 0;
    return {
      rank: 0,
      elysiumKey: e.elysiumKey,
      displayName: e.name,
      elysiumNetId: e.elysiumNetId,
      avatarUrl: e.avatarUrl,
      clubName: e.clubName,
      level: e.level,
      ovrRating: e.ovrRating,
      tournamentsCount: e.tournamentIds.size,
      titles: e.titles,
      runnerUps: e.runnerUps,
      thirdPlaces: e.thirdPlaces,
      matchesPlayed: e.matchesPlayed,
      wins: e.wins,
      draws: e.draws,
      losses: e.losses,
      goalsScored: e.goalsScored,
      goalsConceded: e.goalsConceded,
      cleanSheets: e.cleanSheets,
      winRatePercent,
      seasonPoints
    };
  });

  list.sort((a, b) => {
    if (b.seasonPoints !== a.seasonPoints) return b.seasonPoints - a.seasonPoints;
    if (b.titles !== a.titles) return b.titles - a.titles;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const gdB = b.goalsScored - b.goalsConceded;
    const gdA = a.goalsScored - a.goalsConceded;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsScored - a.goalsScored;
  });

  return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export function buildHallOfFame(db) {
  const tournaments = db
    .prepare("SELECT * FROM tournaments WHERE status = 'COMPLETED' OR champion_player_id IS NOT NULL ORDER BY created_at DESC, id DESC")
    .all();

  if (!tournaments.length) return [];

  const getPlayerStmt = db.prepare('SELECT * FROM players WHERE id = ?');
  const getMatchesStmt = db.prepare('SELECT * FROM matches WHERE tournament_id = ?');

  return tournaments
    .map((t) => {
      const matches = getMatchesStmt.all(t.id);
      const finalM = matches.find((m) => m.stage === MatchStage.FINAL && m.is_completed);
      const thirdM = matches.find((m) => m.stage === MatchStage.THIRD_PLACE && m.is_completed);
      const champId = t.champion_player_id ?? finalM?.winner_id ?? null;
      const champion = champId != null ? summarizePlayerSlim(getPlayerStmt.get(champId)) : null;
      if (!champion) return null;

      let runnerUp = null;
      if (finalM?.winner_id != null) {
        const runnerId = finalM.winner_id === finalM.player1_id ? finalM.player2_id : finalM.player1_id;
        if (runnerId != null) runnerUp = summarizePlayerSlim(getPlayerStmt.get(runnerId));
      }
      const thirdPlace = thirdM?.winner_id != null ? summarizePlayerSlim(getPlayerStmt.get(thirdM.winner_id)) : null;

      let totalGoals = 0;
      let completedMatches = 0;
      for (const m of matches) {
        if (m.is_completed) completedMatches += 1;
        if (m.leg1_score1 != null && m.leg1_score2 != null) {
          totalGoals += m.leg1_score1 + m.leg1_score2 + (m.is_two_legged ? (m.leg2_score1 ?? 0) + (m.leg2_score2 ?? 0) : 0);
        }
      }

      return {
        tournamentId: t.id,
        tournamentName: t.name,
        gameTitle: t.game_title,
        gameCategory: t.game_category,
        scoreUnitLabel: t.score_unit_label,
        startDateTime: t.start_date_time,
        createdAt: t.created_at,
        completedMatches,
        totalMatches: matches.length,
        totalGoals,
        championName: champion.name,
        championElysiumNetId: champion.elysiumNetId,
        championAvatarUrl: champion.avatarUrl,
        runnerUpName: runnerUp?.name ?? null,
        thirdPlaceName: thirdPlace?.name ?? null
      };
    })
    .filter(Boolean);
}
