package com.example

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.example.api.RaceEntry
import com.example.api.RaceResultEntry
import com.example.api.RacingStandingRow
import com.example.data.local.AppDatabase
import com.example.data.local.PlayerEntity
import com.example.data.local.SessionPreferences
import com.example.data.local.TournamentEntity
import com.example.data.model.GAME_CATALOG
import com.example.data.model.MatchStage
import com.example.data.model.OnlineCompatibilityStatus
import com.example.data.model.PlayMode
import com.example.data.model.PlayerLevel
import com.example.data.model.PlayerStatus
import com.example.data.model.RaceStage
import com.example.data.model.TournamentFormat
import com.example.data.model.TournamentStatus
import com.example.data.model.findApprovedGamePreset
import com.example.data.model.formatRacingPointsConfig
import com.example.data.model.parseRacingPointsConfig
import com.example.data.repository.RepoResult
import com.example.data.repository.TournamentRepository
import com.example.domain.TournamentEngine
import com.example.domain.TournamentExportFormatter
import com.example.ui.viewmodel.TournamentUiState
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class TournamentRepositoryTest {

    private lateinit var context: Context
    private lateinit var db: AppDatabase
    private lateinit var repo: TournamentRepository

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        repo = TournamentRepository(context, db, SessionPreferences(context))
    }

    @After
    fun teardown() {
        db.close()
    }

    @Test
    fun subAdminLimitAndPinAuthWorkCorrectly() = runTest {
        val headRes = repo.setupHeadAdmin("headadmin", "المشرف", "123490")
        assertTrue(headRes is RepoResult.Success)
        val headId = (headRes as RepoResult.Success).data.id

        for (i in 1..5) {
            val subRes = repo.createSubAdmin(
                actingAdminId = headId,
                username = "sub$i",
                displayName = "مساعد $i",
                pin = "20240$i",
                canManageTournament = false,
                canManagePlayers = true,
                canRunDraw = false,
                canEditScores = true,
                canCrownChampion = false
            )
            assertTrue(subRes is RepoResult.Success)
        }

        // 6th sub-admin must be rejected
        val sixth = repo.createSubAdmin(
            actingAdminId = headId,
            username = "sub6",
            displayName = "مساعد 6",
            pin = "999900",
            canManageTournament = false,
            canManagePlayers = true,
            canRunDraw = false,
            canEditScores = true,
            canCrownChampion = false
        )
        assertTrue(sixth is RepoResult.Error)

        // Verify login fails with wrong PIN and succeeds with right PIN
        assertTrue(repo.loginAdmin("sub1", "000000") is RepoResult.Error)
        assertTrue(repo.loginAdmin("sub1", "202401") is RepoResult.Success)
    }

    @Test
    fun fullTournamentLifecycleAutoClosesRegistrationGeneratesKnockoutAndCascadesEdits() = runTest {
        repo.ensureDefaultTournamentShellIfEmpty()
        var tournament = repo.latestTournament.first()!!
        // Configure 4-player, 2-group, 2-qualifiers-per-group tournament
        repo.saveTournamentSettings(
            tournament.copy(
                maxParticipants = 4,
                format = TournamentFormat.GROUPS_KNOCKOUT,
                groupCount = 2,
                qualifiersPerGroup = 1
            )
        )
        tournament = repo.latestTournament.first()!!

        // Register 4 players
        for (i in 1..4) {
            val reg = repo.registerPlayer(
                tournamentId = tournament.id,
                name = "لاعب $i",
                elysiumNetId = "ely_$i",
                avatarUri = null,
                level = PlayerLevel.PRO,
                clubName = "Real Madrid"
            )
            assertTrue(reg is RepoResult.Success)
        }

        // Approve all 4 -> should auto-close registration!
        val registered = repo.players.first()
        registered.forEach { p ->
            assertTrue(repo.updatePlayerStatus(p, PlayerStatus.APPROVED) is RepoResult.Success)
        }
        tournament = repo.latestTournament.first()!!
        assertEquals(TournamentStatus.REGISTRATION_CLOSED, tournament.status)

        // 5th registration must be rejected
        val fifth = repo.registerPlayer(tournament.id, "لاعب 5", "ely_5", null, PlayerLevel.PRO, "")
        assertTrue(fifth is RepoResult.Error)

        // Run Draw
        assertTrue(repo.runDrawAndGenerateSchedule() is RepoResult.Success)
        val groups = repo.groups.first()
        assertEquals(2, groups.size)
        val groupMatches = repo.matches.first()
        assertEquals(2, groupMatches.size) // 2 players per group -> 1 match each

        // Record group scores
        for (m in groupMatches) {
            assertTrue(repo.updateMatchScore(m, 3, 1, null, null, null, null) is RepoResult.Success)
        }

        val approved = repo.players.first().filter { it.status == PlayerStatus.APPROVED }
        val completedMatches = repo.matches.first()
        val groupStandings = groups.map { g ->
            TournamentEngine.computeStandings(
                players = approved.filter { it.groupId == g.id },
                matches = completedMatches.filter { it.groupId == g.id },
                qualifiersCount = 1
            )
        }

        // Generate Knockout (2 qualifiers -> 1 Final)
        assertTrue(repo.generateKnockoutFromCurrentStandings(groupStandings, emptyList()) is RepoResult.Success)
        val finalMatch = repo.matches.first().first { it.stage == MatchStage.FINAL }
        assertNotNull(finalMatch.player1Id)
        assertNotNull(finalMatch.player2Id)

        // Play Final and Crown Champion
        assertTrue(repo.updateMatchScore(finalMatch, 2, 1, null, null, null, null) is RepoResult.Success)
        val updatedFinal = repo.matches.first().first { it.stage == MatchStage.FINAL }
        assertEquals(finalMatch.player1Id, updatedFinal.winnerId)

        assertTrue(repo.crownChampion(updatedFinal.winnerId) is RepoResult.Success)
        assertEquals(TournamentStatus.COMPLETED, repo.latestTournament.first()!!.status)

        // Reopen Final -> Champion cleared automatically
        assertTrue(repo.updateMatchScore(updatedFinal, null, null, null, null, null, null) is RepoResult.Success)
        assertNull(repo.latestTournament.first()!!.championPlayerId)

        // Verify Room @Relation TournamentWithDetails returns participants, groups, and matches
        val details = db.tournamentDao().observeTournamentWithDetails(tournament.id).first()!!
        assertEquals(4, details.participants.size)
        assertEquals(2, details.groups.size)
        assertEquals(3, details.matches.size)

        // Verify ForeignKey CASCADE deletes child rows automatically when tournament is deleted
        db.tournamentDao().deleteTournament(tournament.id)
        assertTrue(db.playerDao().getPlayers(tournament.id).isEmpty())
        assertTrue(db.groupDao().getGroups(tournament.id).isEmpty())
        assertTrue(db.matchDao().getMatches(tournament.id).isEmpty())
    }

    @Test
    fun deleteTournamentRemovesLastTournamentWithoutPhantomRecreationAndSupportsMultiGame() = runTest {
        repo.ensureDefaultTournamentShellIfEmpty()
        val initial = repo.latestTournament.first()!!
        assertEquals("FIFA 22", initial.gameTitle)

        // Delete the only tournament -> must NOT auto-recreate a phantom default tournament
        val delRes = repo.deleteCurrentTournament(initial.id)
        assertTrue(delRes is RepoResult.Success)
        assertTrue(repo.allTournaments.first().isEmpty())
        assertNull(repo.latestTournament.first())

        // Re-running launch seed check must preserve deletion (stay empty)
        repo.ensureDefaultTournamentShellIfEmpty()
        assertTrue(repo.allTournaments.first().isEmpty())
        assertNull(repo.latestTournament.first())

        // Create multiple tournaments for different games (Tekken 7 + Call of Duty)
        assertTrue(
            repo.createFreshTournament(
                TournamentEntity(
                    name = "بطولة Tekken 7",
                    gameTitle = "Tekken 7",
                    gameCategory = "ألعاب قتال — 1 ضد 1",
                    scoreUnitLabel = "جولة",
                    description = "بطولة قتال",
                    startDateTime = "السبت",
                    maxParticipants = 8,
                    format = TournamentFormat.DIRECT_KNOCKOUT,
                    playMode = PlayMode.SOLO_1V1,
                    bestOf = 3
                )
            ) is RepoResult.Success
        )
        assertTrue(
            repo.createFreshTournament(
                TournamentEntity(
                    name = "بطولة Call of Duty",
                    gameTitle = "Call of Duty",
                    gameCategory = "أكشن وتصويب",
                    scoreUnitLabel = "نقطة",
                    description = "بطولة شوتر",
                    startDateTime = "الأحد",
                    maxParticipants = 16,
                    playMode = PlayMode.TEAMS,
                    teamSize = 4,
                    bestOf = 5
                )
            ) is RepoResult.Success
        )

        val all = repo.allTournaments.first()
        assertEquals(2, all.size)
        assertEquals("Call of Duty", repo.latestTournament.first()?.gameTitle)

        val tekken = all.first { it.gameTitle == "Tekken 7" }
        val cod = all.first { it.gameTitle == "Call of Duty" }
        repo.selectTournament(tekken.id)
        assertEquals("Tekken 7", repo.latestTournament.first()?.gameTitle)
        assertEquals("جولة", repo.latestTournament.first()?.scoreUnitLabel)
        assertEquals(3, repo.latestTournament.first()?.bestOf)

        // Delete Tekken 7 -> must switch cleanly to Call of Duty without deleting it
        assertTrue(repo.deleteCurrentTournament(tekken.id) is RepoResult.Success)
        assertEquals(1, repo.allTournaments.first().size)
        assertEquals(cod.id, repo.latestTournament.first()?.id)

        // Delete remaining tournament -> back to 0 tournaments
        assertTrue(repo.deleteCurrentTournament(cod.id) is RepoResult.Success)
        assertTrue(repo.allTournaments.first().isEmpty())
        assertNull(repo.latestTournament.first())
    }

    @Test
    fun approvedGameCatalogContainsExact7GamesWithHonestCompatibilityAndRacingExport() {
        val expectedGames = listOf(
            "FIFA 22",
            "JUMP FORCE",
            "Tekken 7",
            "Mortal Kombat 11",
            "RIDE 4",
            "DriveClub",
            "Call of Duty"
        )
        assertEquals(expectedGames, GAME_CATALOG.map { it.label })

        val deletedGames = listOf("FIFA 16", "EA SPORTS FC 25", "eFootball PES", "NBA 2K", "PUBG", "Tekken 8", "Co-op")
        deletedGames.forEach { removed ->
            assertNull("Removed game should not be in catalog: $removed", findApprovedGamePreset(removed))
        }

        // Verify online compatibility honesty
        assertEquals(OnlineCompatibilityStatus.LOCAL_OR_LAN_ONLY, findApprovedGamePreset("FIFA 22")?.onlineStatus)
        assertEquals(OnlineCompatibilityStatus.LOCAL_OR_LAN_ONLY, findApprovedGamePreset("JUMP FORCE")?.onlineStatus)
        assertEquals(OnlineCompatibilityStatus.LOCAL_OR_LAN_ONLY, findApprovedGamePreset("DriveClub")?.onlineStatus)
        assertEquals(OnlineCompatibilityStatus.VERIFY_REQUIRED, findApprovedGamePreset("Tekken 7")?.onlineStatus)
        assertEquals(OnlineCompatibilityStatus.VERIFY_REQUIRED, findApprovedGamePreset("Mortal Kombat 11")?.onlineStatus)
        assertEquals(OnlineCompatibilityStatus.VERIFY_REQUIRED, findApprovedGamePreset("RIDE 4")?.onlineStatus)
        assertEquals(OnlineCompatibilityStatus.VERIFY_REQUIRED, findApprovedGamePreset("Call of Duty")?.onlineStatus)
        assertFalse(GAME_CATALOG.any { it.onlineStatus == OnlineCompatibilityStatus.OFFICIAL_ONLINE })

        // Verify racing points parsing & export formatting
        val customPts = parseRacingPointsConfig("30, 20, 15, 10")
        assertEquals(listOf(30, 20, 15, 10), customPts)
        assertEquals("[30,20,15,10]", formatRacingPointsConfig(customPts))

        val raceTournament = TournamentEntity(
            id = 99L,
            name = "بطولة RIDE 4 الرسمية",
            gameTitle = "RIDE 4",
            gameCategory = "ألعاب سباق",
            scoreUnitLabel = "نقطة",
            description = "سباقات الدراجات",
            startDateTime = "السبت 20:00",
            maxParticipants = 12,
            format = TournamentFormat.RACE_QUALIFIERS_FINAL,
            playMode = PlayMode.RACE_POINTS,
            qualifiersPerGroup = 4,
            racingPointsConfig = "[30,20,15,10]"
        )
        val p1 = PlayerEntity(id = 1L, tournamentId = 99L, name = "أمين", elysiumNetId = "AM-01")
        val standings = listOf(
            RacingStandingRow(
                rank = 1,
                player = p1,
                racesEntered = 1,
                wins = 1,
                podiums = 1,
                totalPoints = 30,
                bestPosition = 1,
                lastPosition = 1,
                isQualified = true
            )
        )
        val races = listOf(
            RaceEntry(
                id = 5L,
                tournamentId = 99L,
                raceNumber = 1,
                title = "تصفيات 1",
                stage = RaceStage.QUALIFIER,
                trackName = "Mugello",
                isCompleted = true,
                results = listOf(RaceResultEntry(playerId = 1L, position = 1, pointsAwarded = 30))
            )
        )
        val fullSummary = TournamentExportFormatter.buildFullSummaryText(
            TournamentUiState(
                tournament = raceTournament,
                players = listOf(p1),
                approvedPlayers = listOf(p1),
                racingStandings = standings,
                races = races
            )
        )
        assertTrue(fullSummary.contains("RIDE 4"))
        assertTrue(fullSummary.contains("أمين"))
        assertTrue(fullSummary.contains("30 ن"))
        assertTrue(fullSummary.contains("Mugello"))

        val socialPost = TournamentExportFormatter.buildSocialPostText(
            TournamentUiState(
                tournament = raceTournament,
                players = listOf(p1),
                approvedPlayers = listOf(p1),
                racingStandings = standings,
                races = races
            )
        )
        assertTrue(socialPost.contains("30 نقطة"))
    }
}
