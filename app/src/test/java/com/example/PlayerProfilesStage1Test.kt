package com.example

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteOpenHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.core.app.ApplicationProvider
import com.example.api.ApiResult
import com.example.api.ApiService
import com.example.api.DiscordGuildMemberDto
import com.example.api.DiscordStatusDto
import com.example.api.PlayerProfileDto
import com.example.data.local.AdminAccountEntity
import com.example.data.local.AppDatabase
import com.example.data.model.AdminRole
import com.example.ui.screens.AdminScreen
import com.example.ui.theme.FifaTournamentTheme
import com.example.ui.viewmodel.TournamentUiState
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.net.InetSocketAddress
import java.nio.charset.StandardCharsets

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class PlayerProfilesStage1Test {

    @get:Rule
    val composeRule = createComposeRule()

    private val context: Context by lazy { ApplicationProvider.getApplicationContext() }

    @Test
    fun migration7To8PreservesExistingTournamentPlayersAndMatches() {
        val dbName = "migration_7_8_stage1_test.db"
        context.deleteDatabase(dbName)

        val callback = object : SupportSQLiteOpenHelper.Callback(7) {
            override fun onCreate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `tournaments` (
                        `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `name` TEXT NOT NULL,
                        `gameTitle` TEXT NOT NULL,
                        `gameCategory` TEXT NOT NULL,
                        `scoreUnitLabel` TEXT NOT NULL,
                        `description` TEXT NOT NULL,
                        `bannerUri` TEXT,
                        `startDateTime` TEXT NOT NULL,
                        `maxParticipants` INTEGER NOT NULL,
                        `format` TEXT NOT NULL,
                        `playMode` TEXT NOT NULL,
                        `teamSize` INTEGER NOT NULL,
                        `bestOf` INTEGER NOT NULL,
                        `racingPointsConfig` TEXT NOT NULL,
                        `groupCount` INTEGER NOT NULL,
                        `qualifiersPerGroup` INTEGER NOT NULL,
                        `drawMode` TEXT NOT NULL,
                        `knockoutTieRule` TEXT NOT NULL,
                        `matchDurationMinutes` INTEGER NOT NULL,
                        `targetGoalsRule` TEXT NOT NULL,
                        `isRegistrationClosedManual` INTEGER NOT NULL,
                        `isThirdPlaceEnabled` INTEGER NOT NULL,
                        `status` TEXT NOT NULL,
                        `championPlayerId` INTEGER,
                        `createdAt` INTEGER NOT NULL
                    )
                    """.trimIndent()
                )
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `players` (
                        `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `tournamentId` INTEGER NOT NULL,
                        `name` TEXT NOT NULL,
                        `elysiumNetId` TEXT NOT NULL,
                        `avatarUri` TEXT,
                        `level` TEXT NOT NULL,
                        `ovrRating` INTEGER NOT NULL,
                        `clubName` TEXT NOT NULL,
                        `status` TEXT NOT NULL,
                        `groupId` INTEGER,
                        `seedOrder` INTEGER NOT NULL,
                        `registeredAt` INTEGER NOT NULL,
                        FOREIGN KEY(`tournamentId`) REFERENCES `tournaments`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
                    )
                    """.trimIndent()
                )
                db.execSQL(
                    """
                    INSERT INTO `tournaments` VALUES (
                        10, 'بطولة قديمة محفوظة', 'FIFA 22', 'كرة قدم', 'هدف', 'وصف', NULL,
                        '2026-11-01', 16, 'KNOCKOUT', 'SOLO_1V1', 1, 1, '[25,18,15]',
                        4, 2, 'RANDOM', 'SINGLE_MATCH_PENALTIES', 12, 'عادي', 0, 1, 'IN_PROGRESS', 101, 1700000000000
                    )
                    """.trimIndent()
                )
                db.execSQL(
                    """
                    INSERT INTO `players` VALUES (
                        101, 10, 'لاعب سابق', 'old_elysium_1', NULL, 'PRO', 88, 'ريال مدريد', 'APPROVED', NULL, 1, 1700000001000
                    )
                    """.trimIndent()
                )
            }

            override fun onUpgrade(db: SupportSQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
        }

        val helper = FrameworkSQLiteOpenHelperFactory().create(
            SupportSQLiteOpenHelper.Configuration.builder(context)
                .name(dbName)
                .callback(callback)
                .build()
        )
        val db = helper.writableDatabase
        AppDatabase.MIGRATION_7_8.migrate(db)

        db.query("SELECT COUNT(*) FROM player_profiles").use { c ->
            assertTrue(c.moveToFirst())
            assertEquals(0, c.getInt(0))
        }
        db.query("SELECT name, elysiumNetId, xeMoNetId, profileId, cp4Id FROM players WHERE id = 101").use { c ->
            assertTrue(c.moveToFirst())
            assertEquals("لاعب سابق", c.getString(0))
            assertEquals("old_elysium_1", c.getString(1))
            assertEquals("", c.getString(2))
            assertTrue(c.isNull(3))
            assertTrue(c.isNull(4))
        }
        db.query("SELECT name, championPlayerId FROM tournaments WHERE id = 10").use { c ->
            assertTrue(c.moveToFirst())
            assertEquals("بطولة قديمة محفوظة", c.getString(0))
            assertEquals(101L, c.getLong(1))
        }
        db.close()
        context.deleteDatabase(dbName)
    }

    @Test
    fun apiServiceParsesPlayerProfilesAndDuplicateDiscordConflict() = runBlocking {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        val port = server.address.port
        server.createContext("/") { exchange ->
            val path = exchange.requestURI.path
            val method = exchange.requestMethod
            when {
                method == "GET" && path == "/api/state" -> respondJson(
                    exchange,
                    200,
                    """
                    {
                      "tournaments": [],
                      "tournament": null,
                      "players": [],
                      "approvedPlayers": [],
                      "pendingPlayers": [],
                      "rejectedPlayers": [],
                      "groupsWithStandings": [],
                      "leagueStandings": [],
                      "leagueMatches": [],
                      "knockoutMatches": [],
                      "allMatches": [],
                      "races": [],
                      "racingStandings": [],
                      "matchReminders": [],
                      "playerStats": [],
                      "overviewStats": {"totalMatches":0,"completedMatches":0,"totalGoals":0},
                      "championPlayer": null,
                      "isRegistrationOpenNow": false,
                      "hasHeadAdmin": true,
                      "adminDirectory": [],
                      "adminAccounts": [],
                      "currentAdmin": null,
                      "keepSignedIn": true,
                      "lockoutState": {"failedAttempts":0,"lockedUntilMillis":0},
                      "discordStatus": {"oauthConfigured":true,"botConfigured":true,"guildIdConfigured":true,"guildConfigured":true},
                      "playerProfiles": [
                        {
                          "id": 5,
                          "cp4Id": "CP4-000125",
                          "name": "كريم",
                          "avatarUrl": null,
                          "elysiumNetId": "ely_5",
                          "xeMoNetId": "xemo_5",
                          "discordUserId": "109876543210987654",
                          "createdAt": 1730000000000,
                          "tournamentsCount": 3
                        }
                      ]
                    }
                    """.trimIndent()
                )
                method == "POST" && path == "/api/player-profiles" -> respondJson(
                    exchange,
                    409,
                    """
                    {
                      "code": "DUPLICATE_DISCORD_ID",
                      "error": "يوجد ملف مسجل مسبقاً بنفس Discord ID",
                      "existingProfile": {
                        "id": 5,
                        "cp4Id": "CP4-000125",
                        "name": "كريم",
                        "avatarUrl": null,
                        "elysiumNetId": "ely_5",
                        "xeMoNetId": "xemo_5",
                        "discordUserId": "109876543210987654",
                        "createdAt": 1730000000000,
                        "tournamentsCount": 3
                      }
                    }
                    """.trimIndent()
                )
                method == "GET" && path == "/api/discord/guild-members" -> respondJson(
                    exchange,
                    200,
                    """
                    {
                      "ok": true,
                      "members": [
                        {
                          "discordUserId": "209876543210987654",
                          "username": "ahmed_bot",
                          "displayName": "أحمد من البوت",
                          "avatarUrl": null,
                          "linkedProfileId": null,
                          "linkedCp4Id": null
                        }
                      ]
                    }
                    """.trimIndent()
                )
                else -> respondJson(exchange, 404, """{"error":"not found"}""")
            }
        }
        server.start()
        try {
            val api = ApiService("http://127.0.0.1:$port")
            val stateRes = api.fetchArenaState()
            assertTrue(stateRes is ApiResult.Success)
            val state = (stateRes as ApiResult.Success).data
            assertTrue(state.discordStatus.oauthConfigured)
            assertTrue(state.discordStatus.botConfigured)
            assertEquals(1, state.playerProfiles.size)
            assertEquals("CP4-000125", state.playerProfiles[0].cp4Id)
            assertEquals("xemo_5", state.playerProfiles[0].xeMoNetId)

            val dupRes = api.createPlayerProfile("اسم جديد", null, "ely_new", "xemo_new", "109876543210987654")
            assertTrue(dupRes is ApiResult.Error)
            val err = dupRes as ApiResult.Error
            assertEquals(409, err.statusCode)
            assertEquals("DUPLICATE_DISCORD_ID", err.errorCode)
            assertNotNull(err.existingProfile)
            assertEquals("CP4-000125", err.existingProfile?.cp4Id)

            val membersRes = api.fetchDiscordGuildMembers()
            assertTrue(membersRes is ApiResult.Success)
            assertEquals("209876543210987654", (membersRes as ApiResult.Success).data.single().discordUserId)
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun adminPlayersTabShowsDuplicateOpenExistingAndImmutableCp4Id() {
        val profile1 = PlayerProfileDto(
            id = 1L,
            cp4Id = "CP4-000125",
            name = "كريم الموحد",
            elysiumNetId = "ely_karim",
            xeMoNetId = "xemo_karim",
            discordUserId = "109876543210987654",
            createdAt = 1730000000000L,
            tournamentsCount = 2
        )
        val profile2 = PlayerProfileDto(
            id = 2L,
            cp4Id = "CP4-000126",
            name = "كريم المكرر",
            elysiumNetId = "ely_karim_2",
            xeMoNetId = "",
            discordUserId = null,
            createdAt = 1730000001000L,
            tournamentsCount = 1
        )
        val headAdmin = AdminAccountEntity(
            id = 1L,
            username = "HeadAdmin",
            displayName = "Djilali",
            role = AdminRole.HEAD_ADMIN,
            pinHash = "",
            pinSalt = "",
            canManageTournament = true,
            canManagePlayers = true,
            canRunDraw = true,
            canEditScores = true,
            canCrownChampion = true
        )
        val uiState = TournamentUiState(
            isLoaded = true,
            hasServerState = true,
            hasHeadAdmin = true,
            admins = listOf(headAdmin),
            currentAdmin = headAdmin,
            playerProfiles = listOf(profile1, profile2),
            discordStatus = DiscordStatusDto(oauthConfigured = true, botConfigured = true, guildIdConfigured = true, guildConfigured = true),
            discordGuildMembers = listOf(
                DiscordGuildMemberDto("309876543210987654", "bot_user", "عضو بوت")
            )
        )

        var mergedConfirmed = false
        composeRule.setContent {
            FifaTournamentTheme {
                AdminScreen(
                    uiState = uiState,
                    onSetupHeadAdmin = { _, _, _, _ -> },
                    onLogin = { _, _, _ -> },
                    onLogout = {},
                    onImportBanner = { _, _ -> },
                    onSaveTournament = {},
                    onCreateFreshTournament = {},
                    onDeleteTournament = {},
                    onUpdatePlayerStatus = { _, _ -> },
                    onUpdatePlayerDetails = {},
                    onDeletePlayer = {},
                    onCreatePlayerProfile = { _, _, _, _, discordId, _, onDuplicate, _ ->
                        if (discordId == profile1.discordUserId) {
                            onDuplicate(profile1)
                        }
                    },
                    onMergePlayerProfiles = { _, _, confirm, onSuccess, _ ->
                        mergedConfirmed = confirm
                        onSuccess(profile1)
                    },
                    onRunDraw = { _, _ -> },
                    onGenerateKnockoutFromStandings = {},
                    onEditMatch = {},
                    onChangeOwnPin = { _, _ -> },
                    onCreateSubAdmin = { _, _, _, _, _, _, _, _ -> },
                    onUpdateSubAdmin = { _, _, _, _, _, _, _, _, _ -> },
                    onDeleteSubAdmin = {},
                    onCrownChampion = {}
                )
            }
        }
        composeRule.waitForIdle()

        composeRule.onNodeWithTag("admin_tab_players").performClick()
        composeRule.waitForIdle()

        composeRule.onNodeWithTag("unified_profiles_section").assertIsDisplayed()
        composeRule.onNodeWithTag("create_player_profile_button").performScrollTo().performClick()
        composeRule.waitForIdle()

        composeRule.onNodeWithTag("profile_name_input").performTextInput("مستخدم مكرر")
        composeRule.onNodeWithTag("profile_discord_id_input").performTextInput("109876543210987654")
        composeRule.onNodeWithTag("profile_create_submit_button").performClick()
        composeRule.waitForIdle()

        composeRule.onNodeWithTag("duplicate_discord_banner").assertIsDisplayed()
        composeRule.onNodeWithTag("open_existing_profile_button").performClick()
        composeRule.waitForIdle()

        // Existing profile dialog shows immutable disabled CP4 ID
        composeRule.onNodeWithTag("profile_detail_cp4_id").assertIsDisplayed()
        composeRule.onNodeWithTag("profile_detail_cp4_id").assertIsNotEnabled()
        composeRule.onNodeWithText("إغلاق").performClick()
        composeRule.waitForIdle()

        // Explicit manual merge requires confirmation checkbox
        composeRule.onNodeWithTag("merge_profiles_button").performScrollTo().performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("merge_confirm_button").assertIsNotEnabled()
        composeRule.onNodeWithTag("merge_confirm_checkbox").performClick()
        composeRule.onNodeWithTag("merge_confirm_button").assertIsEnabled()
        composeRule.onNodeWithTag("merge_confirm_button").performClick()
        composeRule.waitForIdle()
        assertTrue(mergedConfirmed)
    }

    private fun respondJson(exchange: com.sun.net.httpserver.HttpExchange, code: Int, jsonBody: String) {
        val bytes = jsonBody.toByteArray(StandardCharsets.UTF_8)
        exchange.responseHeaders.set("Content-Type", "application/json; charset=utf-8")
        exchange.sendResponseHeaders(code, bytes.size.toLong())
        exchange.responseBody.use { it.write(bytes) }
    }
}
