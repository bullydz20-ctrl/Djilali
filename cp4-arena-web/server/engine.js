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

export function buildKnockoutTreeDrafts({ tournamentId, seededSlots, tieRule }) {
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
