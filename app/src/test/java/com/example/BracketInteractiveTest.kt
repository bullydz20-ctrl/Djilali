package com.example

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.example.data.local.AdminAccountEntity
import com.example.data.local.AppDatabase
import com.example.data.local.MatchEntity
import com.example.data.local.PlayerEntity
import com.example.data.local.SessionPreferences
import com.example.data.model.AdminRole
import com.example.data.model.MatchStage
import com.example.data.model.PlayerLevel
import com.example.data.model.PlayerStatus
import com.example.data.model.TournamentFormat
import com.example.data.model.TournamentStatus
import com.example.data.repository.RepoResult
import com.example.data.repository.TournamentRepository
import com.example.ui.screens.BracketScreen
import com.example.ui.theme.FifaTournamentTheme
import com.example.ui.viewmodel.TournamentUiState
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class BracketInteractiveTest {

    @get:Rule
    val composeRule = createComposeRule()

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
    fun repositoryAdvancesWinnersFromRoundOf16ToFinalAndCascadesResets() = runTest {
        repo.ensureDefaultTournamentShellIfEmpty()
        var tournament = repo.latestTournament.first()!!
        repo.saveTournamentSettings(
            tournament.copy(
                maxParticipants = 16,
                format = TournamentFormat.DIRECT_KNOCKOUT
            )
        )
        tournament = repo.latestTournament.first()!!

        for (i in 1..16) {
            assertTrue(
                repo.registerPlayer(
                    tournamentId = tournament.id,
                    name = "بطل $i",
                    elysiumNetId = "EN_$i",
                    avatarUri = null,
                    level = PlayerLevel.PRO,
                    clubName = "Club $i"
                ) is RepoResult.Success
            )
        }
        repo.players.first().forEach { p ->
            assertTrue(repo.updatePlayerStatus(p, PlayerStatus.APPROVED) is RepoResult.Success)
        }

        // Generate 16-player bracket (R16 -> QF -> SF -> Final)
        assertTrue(repo.runDrawAndGenerateSchedule() is RepoResult.Success)
        val initialMatches = repo.matches.first()
        assertEquals(8, initialMatches.count { it.stage == MatchStage.ROUND_OF_16 })
        assertEquals(4, initialMatches.count { it.stage == MatchStage.QUARTER_FINAL })
        assertEquals(2, initialMatches.count { it.stage == MatchStage.SEMI_FINAL })
        assertEquals(1, initialMatches.count { it.stage == MatchStage.FINAL })

        // Pick winners for first two R16 matches feeding into QF #0
        val r16Match0 = initialMatches.first { it.stage == MatchStage.ROUND_OF_16 && it.bracketIndex == 0 }
        val r16Match1 = initialMatches.first { it.stage == MatchStage.ROUND_OF_16 && it.bracketIndex == 1 }
        assertTrue(repo.updateKnockoutMatchWinner(r16Match0, r16Match0.player1Id) is RepoResult.Success)
        assertTrue(repo.updateKnockoutMatchWinner(r16Match1, r16Match1.player2Id) is RepoResult.Success)

        val qf0 = repo.matches.first().first { it.stage == MatchStage.QUARTER_FINAL && it.bracketIndex == 0 }
        assertEquals(r16Match0.player1Id, qf0.player1Id)
        assertEquals(r16Match1.player2Id, qf0.player2Id)

        // Advance QF #0 winner to SF #0
        assertTrue(repo.updateKnockoutMatchWinner(qf0, qf0.player1Id) is RepoResult.Success)
        val sf0AfterAdvance = repo.matches.first().first { it.stage == MatchStage.SEMI_FINAL && it.bracketIndex == 0 }
        assertEquals(r16Match0.player1Id, sf0AfterAdvance.player1Id)

        // Change R16 #0 winner -> QF #0 must reset winner & SF #0 slot cleared!
        val latestR16Match0 = repo.matches.first().first { it.id == r16Match0.id }
        assertTrue(repo.updateKnockoutMatchWinner(latestR16Match0, latestR16Match0.player2Id) is RepoResult.Success)

        val qf0AfterOverride = repo.matches.first().first { it.stage == MatchStage.QUARTER_FINAL && it.bracketIndex == 0 }
        assertEquals(latestR16Match0.player2Id, qf0AfterOverride.player1Id)
        assertNull(qf0AfterOverride.winnerId)

        val sf0AfterReset = repo.matches.first().first { it.stage == MatchStage.SEMI_FINAL && it.bracketIndex == 0 }
        assertNull(sf0AfterReset.player1Id)
    }

    @Test
    fun bracketUiDisplaysStagesFromRoundOf16ToFinalAndUpdatesWinner() {
        val samplePlayers = (1L..16L).map { id ->
            PlayerEntity(
                id = id,
                tournamentId = 1L,
                name = "لاعب $id",
                elysiumNetId = "EN_$id",
                clubName = "Team $id",
                level = PlayerLevel.PRO,
                ovrRating = 88,
                status = PlayerStatus.APPROVED
            )
        }

        val matches = listOf(
            // Round of 16 (first pair)
            MatchEntity(
                id = 10L, tournamentId = 1L, stage = MatchStage.ROUND_OF_16,
                roundNumber = 2, bracketIndex = 0, player1Id = 1L, player2Id = 2L,
                nextMatchId = 20L, nextMatchSlot = 1
            ),
            MatchEntity(
                id = 11L, tournamentId = 1L, stage = MatchStage.ROUND_OF_16,
                roundNumber = 2, bracketIndex = 1, player1Id = 3L, player2Id = 4L,
                nextMatchId = 20L, nextMatchSlot = 2
            ),
            // Quarter Final
            MatchEntity(
                id = 20L, tournamentId = 1L, stage = MatchStage.QUARTER_FINAL,
                roundNumber = 3, bracketIndex = 0, player1Id = 1L, player2Id = 3L,
                isCompleted = true, winnerId = 1L, nextMatchId = 30L, nextMatchSlot = 1
            ),
            // Semi Final
            MatchEntity(
                id = 30L, tournamentId = 1L, stage = MatchStage.SEMI_FINAL,
                roundNumber = 4, bracketIndex = 0, player1Id = 1L, player2Id = 5L,
                nextMatchId = 40L, nextMatchSlot = 1
            ),
            // Final
            MatchEntity(
                id = 40L, tournamentId = 1L, stage = MatchStage.FINAL,
                roundNumber = 5, bracketIndex = 0, player1Id = 1L, player2Id = 9L
            )
        )

        val admin = AdminAccountEntity(
            id = 99L,
            username = "Djilali",
            displayName = "Djilali",
            role = AdminRole.HEAD_ADMIN,
            pinHash = "h",
            pinSalt = "s",
            canEditScores = true
        )

        var selectedMatchId: Long? = null
        var selectedWinnerId: Long? = -1L
        var scoreEditorMatchId: Long? = null

        composeRule.setContent {
            FifaTournamentTheme {
                BracketScreen(
                    uiState = TournamentUiState(
                        isLoaded = true,
                        players = samplePlayers,
                        approvedPlayers = samplePlayers,
                        knockoutMatches = matches,
                        allMatches = matches,
                        currentAdmin = admin
                    ),
                    onEditMatch = { scoreEditorMatchId = it.id },
                    onSelectWinner = { m, wId ->
                        selectedMatchId = m.id
                        selectedWinnerId = wId
                    }
                )
            }
        }
        composeRule.waitForIdle()

        // All 4 roadmap stage filters + full tree + champion pedestal exist
        composeRule.onNodeWithTag("bracket_stage_filter_all").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_stage_filter_ROUND_OF_16").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_stage_filter_QUARTER_FINAL").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_stage_filter_SEMI_FINAL").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_stage_filter_FINAL").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_full_tree").assertIsDisplayed()

        // Filter to Round of 16 and pick Player 1 as winner of match 10
        composeRule.onNodeWithTag("bracket_stage_filter_ROUND_OF_16").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_focused_stage_ROUND_OF_16").assertIsDisplayed()

        composeRule.onNodeWithTag("bracket_match_10").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_pick_winner_p1_10").performScrollTo().performClick()
        composeRule.waitForIdle()

        assertEquals(10L, selectedMatchId)
        assertEquals(1L, selectedWinnerId)

        // Filter to Quarter Final (which already has winnerId = 1L) and clear winner
        composeRule.onNodeWithTag("bracket_stage_filter_QUARTER_FINAL").performScrollTo().performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_match_20").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_clear_winner_20").performScrollTo().performClick()
        composeRule.waitForIdle()

        assertEquals(20L, selectedMatchId)
        assertNull(selectedWinnerId)

        // Filter to Final and open detailed score editor
        composeRule.onNodeWithTag("bracket_stage_filter_FINAL").performScrollTo().performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_champion_pedestal").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_match_40").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_open_score_dialog_40").performScrollTo().performClick()
        composeRule.waitForIdle()

        assertEquals(40L, scoreEditorMatchId)
    }

    @Test
    fun visitorModeShowsBracketReadOnlyWithoutWinnerDialog() {
        val p1 = PlayerEntity(
            id = 1L, tournamentId = 1L, name = "زائر 1", elysiumNetId = "EN1",
            level = PlayerLevel.PRO, ovrRating = 88, status = PlayerStatus.APPROVED
        )
        val p2 = PlayerEntity(
            id = 2L, tournamentId = 1L, name = "زائر 2", elysiumNetId = "EN2",
            level = PlayerLevel.PRO, ovrRating = 87, status = PlayerStatus.APPROVED
        )
        val finalMatch = MatchEntity(
            id = 50L, tournamentId = 1L, stage = MatchStage.FINAL,
            roundNumber = 5, bracketIndex = 0, player1Id = 1L, player2Id = 2L
        )

        composeRule.setContent {
            FifaTournamentTheme {
                BracketScreen(
                    uiState = TournamentUiState(
                        isLoaded = true,
                        players = listOf(p1, p2),
                        approvedPlayers = listOf(p1, p2),
                        knockoutMatches = listOf(finalMatch),
                        currentAdmin = null
                    ),
                    onEditMatch = {},
                    onSelectWinner = { _, _ -> }
                )
            }
        }
        composeRule.waitForIdle()

        composeRule.onNodeWithTag("bracket_match_50").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithText("تحديث الفائز — المباراة النهائية").assertDoesNotExist()
    }

    @Test
    fun symmetricalTwoSidedBracketDisplaysBothWingsCenterFinalAndZoomControls() {
        val players16 = (1L..16L).map { id ->
            PlayerEntity(
                id = id,
                tournamentId = 1L,
                name = "مقاتل $id",
                elysiumNetId = "MK_$id",
                clubName = "Clan $id",
                level = PlayerLevel.PRO,
                ovrRating = 90,
                status = PlayerStatus.APPROVED
            )
        }

        val matches = mutableListOf<MatchEntity>()
        val finalMatch = MatchEntity(
            id = 115L, tournamentId = 1L, stage = MatchStage.FINAL,
            roundNumber = 5, bracketIndex = 0, player1Id = 1L, player2Id = 9L,
            leg1Score1 = 3, leg1Score2 = 1, isCompleted = true, winnerId = 1L
        )
        val sf0 = MatchEntity(
            id = 113L, tournamentId = 1L, stage = MatchStage.SEMI_FINAL,
            roundNumber = 4, bracketIndex = 0, player1Id = 1L, player2Id = 5L,
            leg1Score1 = 3, leg1Score2 = 2, isCompleted = true, winnerId = 1L,
            nextMatchId = 115L, nextMatchSlot = 1
        )
        val sf1 = MatchEntity(
            id = 114L, tournamentId = 1L, stage = MatchStage.SEMI_FINAL,
            roundNumber = 4, bracketIndex = 1, player1Id = 9L, player2Id = 13L,
            leg1Score1 = 3, leg1Score2 = 0, isCompleted = true, winnerId = 9L,
            nextMatchId = 115L, nextMatchSlot = 2
        )
        val qfList = (0 until 4).map { idx ->
            MatchEntity(
                id = 109L + idx, tournamentId = 1L, stage = MatchStage.QUARTER_FINAL,
                roundNumber = 3, bracketIndex = idx,
                player1Id = (idx * 4 + 1).toLong(),
                player2Id = (idx * 4 + 3).toLong(),
                nextMatchId = if (idx < 2) 113L else 114L,
                nextMatchSlot = (idx % 2) + 1
            )
        }
        val r16List = (0 until 8).map { idx ->
            MatchEntity(
                id = 101L + idx, tournamentId = 1L, stage = MatchStage.ROUND_OF_16,
                roundNumber = 2, bracketIndex = idx,
                player1Id = (idx * 2 + 1).toLong(),
                player2Id = (idx * 2 + 2).toLong(),
                nextMatchId = 109L + (idx / 2),
                nextMatchSlot = (idx % 2) + 1
            )
        }
        matches += r16List
        matches += qfList
        matches += listOf(sf0, sf1, finalMatch)

        val model = com.example.ui.components.buildSymmetricalBracketModel(matches)
        assertEquals(4, model.rightWingByStage[MatchStage.ROUND_OF_16]?.size)
        assertEquals(4, model.leftWingByStage[MatchStage.ROUND_OF_16]?.size)
        assertEquals(2, model.rightWingByStage[MatchStage.QUARTER_FINAL]?.size)
        assertEquals(2, model.leftWingByStage[MatchStage.QUARTER_FINAL]?.size)
        assertEquals(1, model.rightWingByStage[MatchStage.SEMI_FINAL]?.size)
        assertEquals(1, model.leftWingByStage[MatchStage.SEMI_FINAL]?.size)
        assertEquals(115L, model.finalMatch?.id)
        assertEquals(15, model.matchNumbersById.size)

        composeRule.setContent {
            FifaTournamentTheme {
                BracketScreen(
                    uiState = TournamentUiState(
                        isLoaded = true,
                        players = players16,
                        approvedPlayers = players16,
                        knockoutMatches = matches,
                        allMatches = matches,
                        championPlayer = players16.first()
                    ),
                    onEditMatch = {},
                    onSelectWinner = { _, _ -> }
                )
            }
        }
        composeRule.waitForIdle()

        composeRule.onNodeWithTag("bracket_full_tree").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_zoom_percent").assertTextEquals("100%")
        composeRule.onNodeWithTag("bracket_wing_filter_right").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_wing_filter_left").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_zoom_in").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_zoom_out").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_zoom_fit").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_zoom_reset").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_round_header_FINAL").performScrollTo().assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_champion_pedestal").performScrollTo().assertIsDisplayed()

        // Switch to Right Wing focused view, then Left Wing focused view
        composeRule.onNodeWithTag("bracket_wing_filter_right").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_wing_focused_RIGHT_WING").assertIsDisplayed()

        composeRule.onNodeWithTag("bracket_wing_filter_left").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_wing_focused_LEFT_WING").assertIsDisplayed()

        // Toggle Horizontal <-> Vertical Esports Bracket modes and verify zoom reset restores 100%
        composeRule.onNodeWithTag("bracket_wing_filter_all").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_zoom_in").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_zoom_percent").assertTextEquals("115%")
        composeRule.onNodeWithTag("bracket_zoom_reset").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_zoom_percent").assertTextEquals("100%")

        composeRule.onNodeWithTag("bracket_mode_horizontal").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_full_tree").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_mode_vertical").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("bracket_full_tree").assertIsDisplayed()
    }

    @Test
    fun presentStagesOnlyAnd64PlayerBracketModelBuildSymmetrically() = runTest {
        repo.ensureDefaultTournamentShellIfEmpty()
        var tournament = repo.latestTournament.first()!!
        repo.saveTournamentSettings(
            tournament.copy(maxParticipants = 64, format = TournamentFormat.DIRECT_KNOCKOUT)
        )
        tournament = repo.latestTournament.first()!!

        for (i in 1..64) {
            assertTrue(
                repo.registerPlayer(
                    tournamentId = tournament.id,
                    name = "نجم $i",
                    elysiumNetId = "STAR_$i",
                    avatarUri = null,
                    level = PlayerLevel.PRO,
                    clubName = "CP4_$i"
                ) is RepoResult.Success
            )
        }
        repo.players.first().forEach { p ->
            assertTrue(repo.updatePlayerStatus(p, PlayerStatus.APPROVED) is RepoResult.Success)
        }
        assertTrue(repo.runDrawAndGenerateSchedule() is RepoResult.Success)
        val matches64 = repo.matches.first()
        assertEquals(63, matches64.size)

        val model64 = com.example.ui.components.buildSymmetricalBracketModel(matches64)
        assertEquals(16, model64.rightWingByStage[MatchStage.ROUND_OF_64]?.size)
        assertEquals(16, model64.leftWingByStage[MatchStage.ROUND_OF_64]?.size)
        assertEquals(8, model64.rightWingByStage[MatchStage.ROUND_OF_32]?.size)
        assertEquals(8, model64.leftWingByStage[MatchStage.ROUND_OF_32]?.size)
        assertEquals(4, model64.rightWingByStage[MatchStage.ROUND_OF_16]?.size)
        assertEquals(4, model64.leftWingByStage[MatchStage.ROUND_OF_16]?.size)
        assertEquals(2, model64.rightWingByStage[MatchStage.QUARTER_FINAL]?.size)
        assertEquals(2, model64.leftWingByStage[MatchStage.QUARTER_FINAL]?.size)
        assertEquals(1, model64.rightWingByStage[MatchStage.SEMI_FINAL]?.size)
        assertEquals(1, model64.leftWingByStage[MatchStage.SEMI_FINAL]?.size)

        // Verify an 8-player bracket hides non-existent R64/R32/R16 pills and shows QF/SF/FINAL
        val sample8 = (1L..8L).map { id ->
            PlayerEntity(
                id = id, tournamentId = 1L, name = "لاعب $id", elysiumNetId = "P8_$id",
                level = PlayerLevel.PRO, ovrRating = 85, status = PlayerStatus.APPROVED
            )
        }
        val qfFinals = listOf(
            MatchEntity(id = 1, tournamentId = 1, stage = MatchStage.QUARTER_FINAL, bracketIndex = 0, player1Id = 1, player2Id = 2, nextMatchId = 5, nextMatchSlot = 1),
            MatchEntity(id = 2, tournamentId = 1, stage = MatchStage.QUARTER_FINAL, bracketIndex = 1, player1Id = 3, player2Id = 4, nextMatchId = 5, nextMatchSlot = 2),
            MatchEntity(id = 3, tournamentId = 1, stage = MatchStage.QUARTER_FINAL, bracketIndex = 2, player1Id = 5, player2Id = 6, nextMatchId = 6, nextMatchSlot = 1),
            MatchEntity(id = 4, tournamentId = 1, stage = MatchStage.QUARTER_FINAL, bracketIndex = 3, player1Id = 7, player2Id = 8, nextMatchId = 6, nextMatchSlot = 2),
            MatchEntity(id = 5, tournamentId = 1, stage = MatchStage.SEMI_FINAL, bracketIndex = 0, nextMatchId = 7, nextMatchSlot = 1),
            MatchEntity(id = 6, tournamentId = 1, stage = MatchStage.SEMI_FINAL, bracketIndex = 1, nextMatchId = 7, nextMatchSlot = 2),
            MatchEntity(id = 7, tournamentId = 1, stage = MatchStage.FINAL, bracketIndex = 0)
        )
        composeRule.setContent {
            FifaTournamentTheme {
                BracketScreen(
                    uiState = TournamentUiState(
                        isLoaded = true,
                        players = sample8,
                        approvedPlayers = sample8,
                        knockoutMatches = qfFinals,
                        allMatches = qfFinals
                    ),
                    onEditMatch = {},
                    onSelectWinner = { _, _ -> }
                )
            }
        }
        composeRule.waitForIdle()

        composeRule.onNodeWithTag("bracket_stage_filter_ROUND_OF_64").assertDoesNotExist()
        composeRule.onNodeWithTag("bracket_stage_filter_ROUND_OF_32").assertDoesNotExist()
        composeRule.onNodeWithTag("bracket_stage_filter_ROUND_OF_16").assertDoesNotExist()
        composeRule.onNodeWithTag("bracket_stage_filter_QUARTER_FINAL").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_stage_filter_SEMI_FINAL").assertIsDisplayed()
        composeRule.onNodeWithTag("bracket_stage_filter_FINAL").assertIsDisplayed()
    }
}
