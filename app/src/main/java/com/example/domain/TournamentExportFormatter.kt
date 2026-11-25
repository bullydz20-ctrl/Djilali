package com.example.domain

import com.example.data.local.MatchEntity
import com.example.data.local.PlayerEntity
import com.example.data.model.MatchStage
import com.example.data.model.PlayMode
import com.example.ui.viewmodel.TournamentUiState

object TournamentExportFormatter {

    fun buildSuggestedFileName(uiState: TournamentUiState): String {
        val raw = uiState.tournament?.name ?: "fifa22_tournament"
        val asciiSlug = raw
            .lowercase()
            .replace(Regex("[^a-z0-9]+"), "_")
            .trim('_')
            .take(28)
        return if (asciiSlug.isNotBlank()) {
            "${asciiSlug}_results.txt"
        } else {
            "fifa22_tournament_results.txt"
        }
    }

    fun buildFullSummaryText(uiState: TournamentUiState): String {
        val playersById = uiState.players.associateBy { it.id }
        val t = uiState.tournament
        val gameTitle = t?.gameTitle?.ifBlank { "FIFA 22" } ?: "FIFA 22"
        val scoreUnit = t?.scoreUnitLabel?.ifBlank { "نقطة" } ?: "هدف"
        val stats = uiState.overviewStats
        val finalMatch = uiState.knockoutMatches.find { it.stage == MatchStage.FINAL }
        val thirdMatch = uiState.knockoutMatches.find { it.stage == MatchStage.THIRD_PLACE }
        val resolvedChampion = uiState.championPlayer
            ?: finalMatch?.winnerId?.let { playersById[it] }
        val runnerUp = if (finalMatch?.isCompleted == true && finalMatch.winnerId != null) {
            val loserId = if (finalMatch.winnerId == finalMatch.player1Id) finalMatch.player2Id else finalMatch.player1Id
            loserId?.let { playersById[it] }
        } else null
        val thirdPlacePlayer = if (thirdMatch?.isCompleted == true && thirdMatch.winnerId != null) {
            playersById[thirdMatch.winnerId]
        } else null

        return buildString {
            appendLine("════════════════════════════════════════")
            appendLine("🏆 ملخص نتائج البطولة الرسمية")
            appendLine("════════════════════════════════════════")
            appendLine("البطولة: ${t?.name ?: "بطولة CP4 ARENA"}")
            appendLine("اللعبة: $gameTitle (${t?.gameCategory ?: "ألعاب إلكترونية"})")
            appendLine("المجتمع: COMMUNITY PS4 JAILBREAK ONLINE")
            if (t != null) {
                val playModeDesc = if (t.playMode == PlayMode.TEAMS) {
                    "${t.playMode.labelAr} (${t.teamSize} لاعبين)"
                } else {
                    t.playMode.labelAr
                }
                appendLine("النظام: ${t.format.labelAr} • $playModeDesc")
                if (t.bestOf > 1) {
                    appendLine("صيغة السلسلة: Best of ${t.bestOf}")
                }
                appendLine("الحالة: ${t.status.labelAr}")
                appendLine("المشاركون المعتمدون: ${uiState.approvedPlayers.size} / ${t.maxParticipants}")
            }
            if (t?.format?.isRacing == true) {
                val completedRaces = uiState.races.count { it.isCompleted }
                appendLine("السباقات المكتملة: $completedRaces / ${uiState.races.size}")
            } else {
                appendLine("تقدم المباريات: ${stats.completedMatches} / ${stats.totalMatches} مكتملة")
                if (scoreUnit == "هدف") {
                    appendLine("إجمالي الأهداف المسجلة: ${stats.totalGoals}")
                } else {
                    appendLine("إجمالي النقاط ($scoreUnit): ${stats.totalGoals}")
                }
            }
            appendLine()

            if (resolvedChampion != null) {
                appendLine("🥇 بطل البطولة: ${resolvedChampion.name} (${resolvedChampion.elysiumNetId})")
                if (resolvedChampion.clubName.isNotBlank()) {
                    appendLine("   النادي: ${resolvedChampion.clubName}")
                }
                if (runnerUp != null) {
                    appendLine("🥈 الوصيف: ${runnerUp.name} (${runnerUp.elysiumNetId})")
                }
                if (thirdPlacePlayer != null) {
                    appendLine("🥉 المركز الثالث: ${thirdPlacePlayer.name} (${thirdPlacePlayer.elysiumNetId})")
                }
                appendLine()
            }

            appendLine("── أبرز الجوائز والإحصائيات ──")
            val topLabel = if (scoreUnit == "هدف") "هداف البطولة" else "الأعلى تسجيلاً"
            appendLine(
                "• $topLabel: " + (stats.topScorer?.let { "${it.player.name} (${it.goalsScored} $scoreUnit)" } ?: "لم يتحدد بعد")
            )
            appendLine(
                "• أقوى دفاع: " + (stats.bestDefense?.let { "${it.player.name} (استقبل ${it.goalsConceded} | شباك نظيفة ${it.cleanSheets})" } ?: "لم يتحدد بعد")
            )
            appendLine(
                "• أعلى نسبة فوز: " + (stats.highestWinRate?.let { "${it.player.name} (${it.winRatePercent}% - ${it.wins} فوز)" } ?: "لم يتحدد بعد")
            )

            if (t?.format?.isRacing == true && uiState.racingStandings.isNotEmpty()) {
                appendLine()
                appendLine("── ترتيب المتسابقين والنقاط ──")
                uiState.racingStandings.forEach { row ->
                    val qualBadge = if (row.isQualified) " ✓ متأهل للنهائي" else ""
                    val bestStr = row.bestPosition?.let { " | أفضل مركز #$it" } ?: ""
                    appendLine("  ${row.rank}. ${row.player.name} — ${row.totalPoints} ن (سباقات ${row.racesEntered} | فوز ${row.wins} | منصة ${row.podiums}$bestStr)$qualBadge")
                }
                if (uiState.races.isNotEmpty()) {
                    appendLine()
                    appendLine("── سجل السباقات ──")
                    uiState.races.forEach { race ->
                        val trackSuffix = if (race.trackName.isNotBlank()) " — ${race.trackName}" else ""
                        val statusTag = if (race.isCompleted) "مكتمل" else "بانتظار النتائج"
                        appendLine("  • ${race.title} (${race.stage.labelAr}$trackSuffix) [$statusTag]")
                    }
                }
            } else if (uiState.groupsWithStandings.isNotEmpty()) {
                appendLine()
                appendLine("── ترتيب المجموعات ──")
                uiState.groupsWithStandings.forEach { groupData ->
                    appendLine("[${groupData.group.name}]")
                    groupData.standings.forEach { row ->
                        val qualBadge = if (row.isQualified) " ✓ متأهل" else ""
                        val diffSign = if (row.goalDifference > 0) "+${row.goalDifference}" else "${row.goalDifference}"
                        appendLine("  ${row.position}. ${row.player.name} — ${row.points} ن (لعب ${row.played} | ف ${row.wins} | ت ${row.draws} | خ ${row.losses} | ف.أ $diffSign)$qualBadge")
                    }
                }
            } else if (uiState.leagueStandings.isNotEmpty()) {
                appendLine()
                appendLine("── ترتيب جدول الدوري ──")
                uiState.leagueStandings.forEach { row ->
                    val qualBadge = if (row.isQualified) " ✓ متأهل" else ""
                    val diffSign = if (row.goalDifference > 0) "+${row.goalDifference}" else "${row.goalDifference}"
                    appendLine("  ${row.position}. ${row.player.name} — ${row.points} ن (لعب ${row.played} | ف ${row.wins} | ت ${row.draws} | خ ${row.losses} | ف.أ $diffSign)$qualBadge")
                }
            }

            if (uiState.knockoutMatches.isNotEmpty()) {
                appendLine()
                appendLine("── نتائج الأدوار الإقصائية ──")
                val groupedKnockout = uiState.knockoutMatches
                    .groupBy { it.stage }
                    .toList()
                    .sortedBy { it.first.order }
                groupedKnockout.forEach { (stage, matches) ->
                    appendLine("▶ ${stage.labelAr}")
                    matches.sortedBy { it.bracketIndex }.forEach { match ->
                        appendLine("  • ${formatMatchLine(match, playersById)}")
                    }
                }
            }

            val groupOrLeagueMatches = uiState.allMatches.filter {
                it.stage == MatchStage.GROUP || it.stage == MatchStage.LEAGUE
            }
            if (groupOrLeagueMatches.isNotEmpty()) {
                appendLine()
                appendLine("── نتائج مباريات المجموعات / الدوري ──")
                groupOrLeagueMatches.forEach { match ->
                    appendLine("  • ${formatMatchLine(match, playersById)}")
                }
            }

            appendLine()
            appendLine("تم الإنشاء بواسطة منصة CP4 ARENA")
        }.trim()
    }

    fun buildSocialPostText(uiState: TournamentUiState): String {
        val playersById = uiState.players.associateBy { it.id }
        val t = uiState.tournament
        val gameTitle = t?.gameTitle?.ifBlank { "FIFA 22" } ?: "FIFA 22"
        val scoreUnit = t?.scoreUnitLabel?.ifBlank { "نقطة" } ?: "هدف"
        val gameTag = gameTitle.replace(Regex("[^A-Za-z0-9]+"), "").ifBlank { "CP4Arena" }
        val stats = uiState.overviewStats
        val finalMatch = uiState.knockoutMatches.find { it.stage == MatchStage.FINAL }
        val thirdMatch = uiState.knockoutMatches.find { it.stage == MatchStage.THIRD_PLACE }
        val resolvedChampion = uiState.championPlayer
            ?: finalMatch?.winnerId?.let { playersById[it] }
        val runnerUp = if (finalMatch?.isCompleted == true && finalMatch.winnerId != null) {
            val loserId = if (finalMatch.winnerId == finalMatch.player1Id) finalMatch.player2Id else finalMatch.player1Id
            loserId?.let { playersById[it] }
        } else null
        val thirdPlacePlayer = if (thirdMatch?.isCompleted == true && thirdMatch.winnerId != null) {
            playersById[thirdMatch.winnerId]
        } else null

        return buildString {
            appendLine("🏆 ${t?.name ?: "بطولة CP4 ARENA"} ($gameTitle)")
            appendLine("🎮 CP4 ARENA — COMMUNITY PS4 ONLINE")
            appendLine()
            if (resolvedChampion != null) {
                appendLine("👑 البطل المتوج: ${resolvedChampion.name} (${resolvedChampion.elysiumNetId})")
                if (runnerUp != null) appendLine("🥈 الوصيف: ${runnerUp.name}")
                if (thirdPlacePlayer != null) appendLine("🥉 المركز الثالث: ${thirdPlacePlayer.name}")
            } else if (t?.format?.isRacing == true) {
                val completedRaces = uiState.races.count { it.isCompleted }
                appendLine("🏎️ الحالة: ${t.status.labelAr} ($completedRaces/${uiState.races.size} سباقات)")
                uiState.racingStandings.take(3).forEach { row ->
                    appendLine("  ${row.rank}. ${row.player.name}: ${row.totalPoints} نقطة")
                }
            } else {
                appendLine("📊 الحالة: ${t?.status?.labelAr ?: "جارية"} (${stats.completedMatches}/${stats.totalMatches} مباراة)")
            }

            if (finalMatch != null && (finalMatch.isCompleted || finalMatch.leg1Score1 != null)) {
                appendLine("🔥 النهائي: ${formatMatchLine(finalMatch, playersById)}")
            }

            if (thirdMatch != null && (thirdMatch.isCompleted || thirdMatch.leg1Score1 != null)) {
                appendLine("🥉 المركز الثالث: ${formatMatchLine(thirdMatch, playersById)}")
            }

            val semis = uiState.knockoutMatches
                .filter { it.stage == MatchStage.SEMI_FINAL && it.isCompleted }
                .sortedBy { it.bracketIndex }
            if (semis.isNotEmpty()) {
                appendLine("⚡ نصف النهائي:")
                semis.forEach { m ->
                    appendLine("• ${formatMatchLine(m, playersById)}")
                }
            }

            stats.topScorer?.let { top ->
                val label = if (scoreUnit == "هدف") "الهداف" else "الأعلى تسجيلاً"
                appendLine("⚽ $label: ${top.player.name} (${top.goalsScored} $scoreUnit)")
            }
            if (scoreUnit == "هدف") {
                appendLine("🥅 إجمالي الأهداف: ${stats.totalGoals}")
            } else {
                appendLine("🎯 إجمالي $scoreUnit: ${stats.totalGoals}")
            }
            appendLine()
            append("#CP4Arena #$gameTag #ElysiumNet")
        }.trim()
    }

    private fun formatMatchLine(
        match: MatchEntity,
        playersById: Map<Long, PlayerEntity>
    ): String {
        val p1 = match.player1Id?.let { playersById[it]?.name } ?: "بانتظار المتأهل"
        val p2 = match.player2Id?.let { playersById[it]?.name } ?: "بانتظار المتأهل"
        val scoreStr = when {
            match.isTwoLegged && match.leg1Score1 != null -> {
                val tot1 = match.leg1Score1 + (match.leg2Score1 ?: 0)
                val tot2 = (match.leg1Score2 ?: 0) + (match.leg2Score2 ?: 0)
                "$tot1 - $tot2 (ذ ${match.leg1Score1}-${match.leg1Score2} / إ ${match.leg2Score1 ?: "-"}-${match.leg2Score2 ?: "-"})"
            }
            match.leg1Score1 != null && match.leg1Score2 != null -> {
                "${match.leg1Score1} - ${match.leg1Score2}"
            }
            match.isCompleted -> "حُسمت"
            else -> "لم تُلعب"
        }
        val penStr = if (match.penaltyScore1 != null && match.penaltyScore2 != null) {
            " [ترجيح ${match.penaltyScore1}-${match.penaltyScore2}]"
        } else ""
        val winnerName = match.winnerId?.let { playersById[it]?.name }
        val winnerSuffix = if (winnerName != null) " ★ الفائز: $winnerName" else ""
        return "$p1 ($scoreStr$penStr) $p2$winnerSuffix"
    }
}
