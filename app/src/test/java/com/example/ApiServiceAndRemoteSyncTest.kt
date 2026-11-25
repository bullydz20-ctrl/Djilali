package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.api.ApiResult
import com.example.api.ApiService
import com.example.data.local.SessionPreferences
import com.example.data.local.TournamentEntity
import com.example.data.model.DrawMode
import com.example.data.model.KnockoutTieRule
import com.example.data.model.PlayerLevel
import com.example.data.model.TournamentFormat
import com.example.data.repository.RemoteArenaRepository
import com.example.data.repository.RepoResult
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
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
import java.net.InetSocketAddress
import java.nio.charset.StandardCharsets
import java.util.concurrent.CopyOnWriteArrayList

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ApiServiceAndRemoteSyncTest {

    private lateinit var server: HttpServer
    private var serverPort: Int = 0
    private val recordedRequests = CopyOnWriteArrayList<String>()
    private val recordedAuthHeaders = CopyOnWriteArrayList<String?>()
    private val context: Context by lazy { ApplicationProvider.getApplicationContext() }

    @Before
    fun setUp() {
        recordedRequests.clear()
        recordedAuthHeaders.clear()
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        serverPort = server.address.port

        server.createContext("/") { exchange ->
            val method = exchange.requestMethod
            val path = exchange.requestURI.path
            val query = exchange.requestURI.rawQuery?.let { "?$it" } ?: ""
            recordedRequests.add("$method $path$query")
            recordedAuthHeaders.add(exchange.requestHeaders.getFirst("Authorization"))

            val reqBody = exchange.requestBody.readBytes().toString(StandardCharsets.UTF_8)

            when {
                method == "GET" && path == "/api/health" -> {
                    respondJson(
                        exchange,
                        200,
                        """{"ok":true,"service":"cp4-arena-web","ts":1730000000000,"persistence":{"mode":"postgres","isDurable":true,"labelAr":"PostgreSQL متصل","detailAr":"البيانات محفوظة بشكل دائم"}}"""
                    )
                }

                method == "GET" && path == "/api/state" -> {
                    val auth = exchange.requestHeaders.getFirst("Authorization")
                    val currentAdminJson = if (auth == "Bearer signed-jwt-token-xyz") {
                        """
                        {
                          "id": 1,
                          "username": "djilali",
                          "displayName": "Djilali",
                          "role": "HEAD_ADMIN",
                          "canManageTournament": true,
                          "canManagePlayers": true,
                          "canRunDraw": true,
                          "canEditScores": true,
                          "canCrownChampion": true,
                          "isActive": true
                        }
                        """.trimIndent()
                    } else {
                        "null"
                    }
                    val stateJson = """
                        {
                          "tournaments": [
                            {
                              "id": 7,
                              "name": "Call of Duty",
                              "gameTitle": "COD MW3",
                              "gameCategory": "أكشن وتصويب",
                              "scoreUnitLabel": "نقطة",
                              "description": "بطولة المجتمع الرسمية",
                              "bannerUrl": "/uploads/banner_cod.png",
                              "startDateTime": "الجمعة 21:00",
                              "maxParticipants": 16,
                              "format": "GROUPS_KNOCKOUT",
                              "groupCount": 4,
                              "qualifiersPerGroup": 2,
                              "drawMode": "RANDOM",
                              "knockoutTieRule": "SINGLE_MATCH_PENALTIES",
                              "matchDurationMinutes": 12,
                              "targetGoalsRule": "أعلى نقاط",
                              "isRegistrationClosedManual": false,
                              "status": "REGISTRATION_OPEN",
                              "championPlayerId": null,
                              "createdAt": 1730000000000
                            }
                          ],
                          "tournament": {
                            "id": 7,
                            "name": "Call of Duty",
                            "gameTitle": "COD MW3",
                            "gameCategory": "أكشن وتصويب",
                            "scoreUnitLabel": "نقطة",
                            "description": "بطولة المجتمع الرسمية",
                            "bannerUrl": "/uploads/banner_cod.png",
                            "startDateTime": "الجمعة 21:00",
                            "maxParticipants": 16,
                            "format": "GROUPS_KNOCKOUT",
                            "groupCount": 4,
                            "qualifiersPerGroup": 2,
                            "drawMode": "RANDOM",
                            "knockoutTieRule": "SINGLE_MATCH_PENALTIES",
                            "matchDurationMinutes": 12,
                            "targetGoalsRule": "أعلى نقاط",
                            "isRegistrationClosedManual": false,
                            "status": "REGISTRATION_OPEN",
                            "championPlayerId": null,
                            "createdAt": 1730000000000
                          },
                          "players": [
                            {
                              "id": 101,
                              "tournamentId": 7,
                              "name": "Djilali",
                              "elysiumNetId": "DJ-77",
                              "avatarUrl": "/uploads/avatar_dj.png",
                              "level": "PRO",
                              "ovrRating": 90,
                              "clubName": "Real Madrid",
                              "status": "APPROVED",
                              "groupId": null,
                              "seedOrder": 1,
                              "registeredAt": 1730000001000
                            }
                          ],
                          "approvedPlayers": [],
                          "pendingPlayers": [],
                          "rejectedPlayers": [],
                          "groupsWithStandings": [],
                          "leagueStandings": [],
                          "leagueMatches": [],
                          "knockoutMatches": [],
                          "allMatches": [],
                          "matchReminders": [],
                          "playerStats": [],
                          "overviewStats": {"totalMatches": 0, "completedMatches": 0, "totalGoals": 0},
                          "championPlayer": null,
                          "isRegistrationOpenNow": true,
                          "hasHeadAdmin": true,
                          "adminDirectory": [
                            {"id": 1, "username": "djilali", "displayName": "Djilali", "role": "HEAD_ADMIN", "isActive": true}
                          ],
                          "adminAccounts": [],
                          "currentAdmin": $currentAdminJson,
                          "keepSignedIn": true,
                          "lockoutState": {"failedAttempts": 0, "lockedUntilMillis": 0},
                          "persistence": {"mode": "ephemeral", "isDurable": false, "labelAr": "تخزين مؤقت", "detailAr": "أضف DATABASE_URL"}
                        }
                    """.trimIndent()
                    respondJson(exchange, 200, stateJson)
                }

                method == "POST" && path == "/api/players/register" -> {
                    assertTrue(reqBody.contains("\"elysiumNetId\":\"ELYS-99\""))
                    respondJson(exchange, 201, """{"ok":true,"messageAr":"تم استلام طلب التسجيل بنجاح!"}""")
                }

                method == "POST" && path == "/api/admin/login" -> {
                    respondJson(
                        exchange,
                        200,
                        """
                        {
                          "token": "signed-jwt-token-xyz",
                          "admin": {
                            "id": 1,
                            "username": "djilali",
                            "displayName": "Djilali",
                            "role": "HEAD_ADMIN",
                            "canManageTournament": true,
                            "canManagePlayers": true,
                            "canRunDraw": true,
                            "canEditScores": true,
                            "canCrownChampion": true,
                            "isActive": true
                          },
                          "messageAr": "تم تسجيل الدخول بنجاح."
                        }
                        """.trimIndent()
                    )
                }

                method == "POST" && path == "/api/admin/logout" -> {
                    respondJson(exchange, 200, """{"ok":true,"messageAr":"تم تسجيل الخروج من لوحة المشرف."}""")
                }

                method == "POST" && path == "/api/tournaments" -> {
                    val auth = exchange.requestHeaders.getFirst("Authorization")
                    if (auth == "Bearer signed-jwt-token-xyz") {
                        respondJson(exchange, 201, """{"tournament":{"id":88},"messageAr":"تم إنشاء البطولة"}""")
                    } else {
                        respondJson(exchange, 401, """{"error":"انتهت الجلسة أو غير مصرح"}""")
                    }
                }

                method == "PATCH" && path == "/api/admin/profile" -> {
                    val parsed = org.json.JSONObject(reqBody)
                    assertEquals("Djilali Pro", parsed.getString("displayName"))
                    assertEquals("djilali_new", parsed.getString("username"))
                    respondJson(
                        exchange,
                        200,
                        """
                        {
                          "ok": true,
                          "admin": {
                            "id": 1,
                            "username": "djilali_new",
                            "displayName": "Djilali Pro",
                            "role": "HEAD_ADMIN",
                            "canManageTournament": true,
                            "canManagePlayers": true,
                            "canRunDraw": true,
                            "canEditScores": true,
                            "canCrownChampion": true,
                            "isActive": true
                          },
                          "messageAr": "تم تحديث بيانات حساب المشرف بنجاح."
                        }
                        """.trimIndent()
                    )
                }

                method == "POST" && path == "/api/tournaments/7/players" -> {
                    val parsed = org.json.JSONObject(reqBody)
                    assertEquals("APPROVED", parsed.getString("status"))
                    assertEquals("/uploads/direct_p.png", parsed.getString("avatarUrl"))
                    respondJson(
                        exchange,
                        201,
                        """
                        {
                          "ok": true,
                          "player": {
                            "id": 202,
                            "tournamentId": 7,
                            "name": "Karim Direct",
                            "elysiumNetId": "KM-88",
                            "avatarUrl": "/uploads/direct_p.png",
                            "level": "LEGEND",
                            "ovrRating": 94,
                            "clubName": "Liverpool",
                            "status": "APPROVED",
                            "groupId": null,
                            "seedOrder": 0,
                            "registeredAt": 1730000002000
                          },
                          "messageAr": "تمت إضافة اللاعب بنجاح."
                        }
                        """.trimIndent()
                    )
                }

                method == "PATCH" && path == "/api/players/101" -> {
                    val parsed = org.json.JSONObject(reqBody)
                    assertEquals("/uploads/updated_dj.png", parsed.getString("avatarUrl"))
                    respondJson(exchange, 200, """{"ok":true,"messageAr":"تم تحديث بيانات اللاعب بنجاح."}""")
                }

                method == "PATCH" && path == "/api/matches/55/score" -> {
                    respondJson(exchange, 200, """{"ok":true,"messageAr":"تم حفظ النتيجة"}""")
                }

                method == "POST" && path == "/api/matches/55/check-in" -> {
                    val parsed = org.json.JSONObject(reqBody)
                    assertEquals(1, parsed.getInt("slot"))
                    respondJson(exchange, 200, """{"ok":true,"messageAr":"تم تأكيد الجاهزية"}""")
                }

                method == "POST" && path == "/api/matches/55/vote" -> {
                    val parsed = org.json.JSONObject(reqBody)
                    assertEquals(2, parsed.getInt("slot"))
                    respondJson(exchange, 200, """{"ok":true,"messageAr":"تم تسجيل توقعك"}""")
                }

                method == "POST" && path == "/api/tournaments/7/auto-schedule" -> {
                    val parsed = org.json.JSONObject(reqBody)
                    assertEquals(20, parsed.getInt("intervalMinutes"))
                    respondJson(exchange, 200, """{"ok":true,"scheduledCount":4,"messageAr":"تمت جدولة 4 مباريات"}""")
                }

                method == "POST" && path == "/api/tournaments/7/players/bulk" -> {
                    respondJson(exchange, 201, """{"ok":true,"importedCount":2,"skippedCount":1,"messageAr":"تم استيراد 2 لاعب"}""")
                }

                method == "GET" && path == "/api/events" -> {
                    val sseBytes = (
                        "data: {\"type\":\"connected\"}\n\n" +
                            "data: {\"type\":\"state_updated\",\"reason\":\"score_updated\"}\n\n"
                        ).toByteArray(StandardCharsets.UTF_8)
                    exchange.responseHeaders.add("Content-Type", "text/event-stream; charset=utf-8")
                    exchange.sendResponseHeaders(200, sseBytes.size.toLong())
                    exchange.responseBody.use { it.write(sseBytes) }
                }

                else -> {
                    val textBytes = "Not Found".toByteArray(StandardCharsets.UTF_8)
                    exchange.responseHeaders.add("Content-Type", "text/plain; charset=utf-8")
                    exchange.sendResponseHeaders(404, textBytes.size.toLong())
                    exchange.responseBody.use { it.write(textBytes) }
                }
            }
        }
        server.start()
    }

    @After
    fun tearDown() {
        server.stop(0)
    }

    private fun respondJson(exchange: com.sun.net.httpserver.HttpExchange, code: Int, json: String) {
        val bytes = json.toByteArray(StandardCharsets.UTF_8)
        exchange.responseHeaders.add("Content-Type", "application/json; charset=utf-8")
        exchange.sendResponseHeaders(code, bytes.size.toLong())
        exchange.responseBody.use { it.write(bytes) }
    }

    @Test
    fun defaultBaseUrl_pointsToRenderDeploymentAndNeverLocalhostOrAiStudioPreview() {
        val defaultUrl = ApiService.DEFAULT_BASE_URL
        assertTrue(defaultUrl.startsWith("https://"))
        assertTrue(defaultUrl.contains("onrender.com"))
        assertFalse(defaultUrl.contains("localhost"))
        assertFalse(defaultUrl.contains("127.0.0.1"))
        assertFalse(defaultUrl.contains("ais-pre"))
        assertFalse(defaultUrl.contains("ais-dev"))
    }

    @Test
    fun setBaseUrl_normalizesAndResolvesUploadMediaUrlsWithoutRebuild() {
        val api = ApiService()
        val updated = api.setBaseUrl("  my-custom-arena.onrender.com/  ")
        assertEquals("https://my-custom-arena.onrender.com", updated)
        assertEquals("https://my-custom-arena.onrender.com", api.getBaseUrl())

        val resolved = api.resolveMediaUrl("/uploads/avatar_1.png")
        assertEquals("https://my-custom-arena.onrender.com/uploads/avatar_1.png", resolved)
        assertEquals("/uploads/avatar_1.png", api.toServerMediaPath(resolved))
    }

    @Test
    fun apiService_executesStateRegisterLoginProtectedMutationsAndSseStream() = runBlocking {
        val localUrl = "http://127.0.0.1:$serverPort"
        val api = ApiService()
        api.setBaseUrl(localUrl)

        val health = api.checkHealth()
        assertTrue(health is ApiResult.Success)
        assertTrue((health as ApiResult.Success).data.ok)

        val stateRes = api.fetchArenaState()
        assertTrue(stateRes is ApiResult.Success)
        val state = (stateRes as ApiResult.Success).data
        assertEquals("Call of Duty", state.tournament?.name)
        assertEquals("$localUrl/uploads/banner_cod.png", state.tournament?.bannerUri)
        assertEquals(1, state.players.size)
        assertEquals("$localUrl/uploads/avatar_dj.png", state.players.first().avatarUri)
        assertTrue(state.hasHeadAdmin)

        val regRes = api.registerPlayer(
            tournamentId = 7L,
            name = "Yassine",
            elysiumNetId = "ELYS-99",
            avatarUrl = "$localUrl/uploads/p1.png",
            level = PlayerLevel.LEGEND,
            clubName = "Arsenal"
        )
        assertTrue(regRes is ApiResult.Success)

        val loginRes = api.loginAdmin("djilali", "123456", keepSignedIn = true)
        assertTrue(loginRes is ApiResult.Success)
        assertEquals("signed-jwt-token-xyz", api.getAuthToken())

        val createRes = api.createTournament(
            TournamentEntity(
                name = "PES 21 Cup",
                gameTitle = "PES 2021",
                gameCategory = "كرة قدم",
                scoreUnitLabel = "هدف",
                description = "كأس",
                startDateTime = "السبت",
                maxParticipants = 8,
                format = TournamentFormat.DIRECT_KNOCKOUT,
                groupCount = 2,
                qualifiersPerGroup = 2,
                drawMode = DrawMode.RANDOM,
                knockoutTieRule = KnockoutTieRule.SINGLE_MATCH_PENALTIES,
                matchDurationMinutes = 10,
                targetGoalsRule = "نهائي مباشر"
            )
        )
        assertTrue(createRes is ApiResult.Success)
        assertEquals(88L, (createRes as ApiResult.Success).data)
        assertTrue(recordedAuthHeaders.any { it == "Bearer signed-jwt-token-xyz" })

        val scoreRes = api.updateMatchScore(55L, 3, 1, null, null, null, null)
        assertTrue(scoreRes is ApiResult.Success)

        val profileRes = api.updateOwnProfile("Djilali Pro", "djilali_new")
        assertTrue(profileRes is ApiResult.Success)
        assertEquals("Djilali Pro", (profileRes as ApiResult.Success).data.displayName)
        assertEquals("djilali_new", profileRes.data.username)

        val directAddRes = api.adminAddPlayer(
            tournamentId = 7L,
            name = "Karim Direct",
            elysiumNetId = "KM-88",
            avatarUrl = "$localUrl/uploads/direct_p.png",
            level = PlayerLevel.LEGEND,
            ovrRating = 94,
            clubName = "Liverpool",
            autoApprove = true
        )
        assertTrue(directAddRes is ApiResult.Success)
        assertEquals("$localUrl/uploads/direct_p.png", (directAddRes as ApiResult.Success).data.avatarUri)

        val editPlayerRes = api.updatePlayerDetails(
            state.players.first().copy(
                name = "Djilali Edited",
                avatarUri = "$localUrl/uploads/updated_dj.png"
            )
        )
        assertTrue(editPlayerRes is ApiResult.Success)

        val events = mutableListOf<String>()
        var sawConnected = false
        api.openEventsStream(
            onEvent = { events.add(it) },
            onConnectionChanged = { if (it) sawConnected = true }
        )
        assertTrue(sawConnected)
        assertEquals(listOf("state_updated"), events)
    }

    @Test
    fun apiService_clearsBearerTokenOnUnauthorizedResponse() = runBlocking {
        var unauthorizedCallbackFired = false
        val api = ApiService(onUnauthorized = { unauthorizedCallbackFired = true })
        api.setBaseUrl("http://127.0.0.1:$serverPort")
        api.setAuthToken("expired-or-wrong-token")

        val res = api.createTournament(
            TournamentEntity(
                name = "Unauthorized Test",
                gameTitle = "FIFA 22",
                gameCategory = "كرة قدم",
                scoreUnitLabel = "هدف",
                description = "",
                startDateTime = "",
                maxParticipants = 8,
                format = TournamentFormat.GROUPS_KNOCKOUT,
                groupCount = 2,
                qualifiersPerGroup = 2,
                drawMode = DrawMode.RANDOM,
                knockoutTieRule = KnockoutTieRule.SINGLE_MATCH_PENALTIES,
                matchDurationMinutes = 10,
                targetGoalsRule = ""
            )
        )
        assertTrue(res is ApiResult.Error)
        assertEquals(401, (res as ApiResult.Error).statusCode)
        assertNull(api.getAuthToken())
        assertTrue(unauthorizedCallbackFired)
    }

    @Test
    fun remoteRepository_persistsCustomBaseUrlInDataStoreWithoutRebuild() = runBlocking {
        val prefs = SessionPreferences(context)
        val localUrl = "http://127.0.0.1:$serverPort"
        val repo1 = RemoteArenaRepository(context, prefs, ApiService())
        val testScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        val updateRes = repo1.updateServerBaseUrl(localUrl, testScope, verifyHealthFirst = true)
        assertTrue(updateRes is RepoResult.Success)
        assertEquals(localUrl, repo1.serverBaseUrl.value)
        assertNotNull(repo1.remoteState.value)
        assertEquals("Call of Duty", repo1.remoteState.value?.tournament?.name)
        repo1.stopRealtimeSync()
        testScope.cancel()

        // Simulate fresh app launch restoring Base URL from SessionPreferences
        val repo2 = RemoteArenaRepository(context, SessionPreferences(context), ApiService())
        val scope2 = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val initRes = repo2.initialize(scope2)
        assertTrue(initRes is RepoResult.Success)
        assertTrue(repo2.isServerReachable.value)
        assertEquals(localUrl, repo2.serverBaseUrl.value)
        assertEquals("Call of Duty", repo2.remoteState.value?.tournament?.name)
        repo2.stopRealtimeSync()
        scope2.cancel()
    }

    @Test
    fun apiService_emitsBaseUrlFlowAndDiagnosesNotFoundAndWakingUpOnStartup() = runBlocking {
        val api = ApiService()
        assertEquals(ApiService.DEFAULT_BASE_URL, api.baseUrlFlow.value)

        api.setBaseUrl("https://custom-cp4.onrender.com/")
        assertEquals("https://custom-cp4.onrender.com", api.baseUrlFlow.value)

        api.resetBaseUrl()
        assertEquals(ApiService.DEFAULT_BASE_URL, api.baseUrlFlow.value)

        // Simulate Render 404 Not Found plain text response on /api/health
        val errorServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        val errPort = errorServer.address.port
        var mode = 404
        errorServer.createContext("/") { ex ->
            if (mode == 404) {
                val b = "Not Found".toByteArray(StandardCharsets.UTF_8)
                ex.sendResponseHeaders(404, b.size.toLong())
                ex.responseBody.use { it.write(b) }
            } else {
                val b = "Service Unavailable".toByteArray(StandardCharsets.UTF_8)
                ex.sendResponseHeaders(503, b.size.toLong())
                ex.responseBody.use { it.write(b) }
            }
        }
        errorServer.start()
        try {
            val check404 = api.testStartupConnection("http://127.0.0.1:$errPort")
            assertFalse(check404.isReachable)
            assertTrue(check404.isNotFound)
            assertEquals(404, check404.statusCode)
            assertTrue(check404.messageAr.contains("404 Not Found"))

            mode = 503
            val check503 = api.testStartupConnection("http://127.0.0.1:$errPort")
            assertFalse(check503.isReachable)
            assertFalse(check503.isNotFound)
            assertEquals(503, check503.statusCode)
            assertTrue(check503.messageAr.contains("503"))

            // Verify RemoteArenaRepository startup test fails clearly then recovers when switching URL
            val prefs = SessionPreferences(context)
            prefs.setServerBaseUrl("http://127.0.0.1:$errPort")
            val repo = RemoteArenaRepository(context, prefs, ApiService())
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
            val initErr = repo.initialize(scope)
            assertTrue(initErr is RepoResult.Error)
            assertFalse(repo.isServerReachable.value)
            assertNotNull(repo.connectionError.value)

            val switchRes = repo.updateServerBaseUrl("http://127.0.0.1:$serverPort", scope, verifyHealthFirst = true)
            assertTrue(switchRes is RepoResult.Success)
            assertTrue(repo.isServerReachable.value)
            assertNull(repo.connectionError.value)
            assertEquals("Call of Duty", repo.remoteState.value?.tournament?.name)
            repo.stopRealtimeSync()
            scope.cancel()
        } finally {
            errorServer.stop(0)
        }
    }

    @Test
    fun remoteRepository_autoRestoresAdminSessionAcrossRelaunchAndPreservesLastUsernameOnLogout() = runBlocking {
        val prefs = SessionPreferences(context)
        val localUrl = "http://127.0.0.1:$serverPort"
        prefs.setServerBaseUrl(localUrl)

        val repo1 = RemoteArenaRepository(context, prefs, ApiService(initialBaseUrl = localUrl))
        val scope1 = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val loginRes = repo1.loginAdmin("djilali", "123456", keepSignedIn = true)
        assertTrue(loginRes is RepoResult.Success)
        assertEquals("djilali", repo1.remoteState.value?.currentAdmin?.username)
        repo1.stopRealtimeSync()
        scope1.cancel()

        // Fresh launch must auto-restore admin session from DataStore without asking to re-login
        val repo2 = RemoteArenaRepository(context, SessionPreferences(context), ApiService())
        val scope2 = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val initRes = repo2.initialize(scope2)
        assertTrue(initRes is RepoResult.Success)
        assertEquals("djilali", repo2.remoteState.value?.currentAdmin?.username)
        assertEquals("signed-jwt-token-xyz", repo2.apiService.getAuthToken())

        // After logout, active token is cleared, but lastUsername remains saved for quick login
        repo2.logoutAdmin()
        assertNull(repo2.remoteState.value?.currentAdmin)
        assertEquals("djilali", prefs.getSessionSnapshot().lastUsername)
        repo2.stopRealtimeSync()
        scope2.cancel()
    }

    @Test
    fun apiService_alignsCheckInVoteAutoScheduleBulkImportAndPersistenceWithWebServer() = runBlocking {
        val api = ApiService(initialBaseUrl = "http://127.0.0.1:$serverPort")
        val health = api.checkHealth()
        assertTrue(health is ApiResult.Success)
        val healthData = (health as ApiResult.Success).data
        assertEquals("postgres", healthData.persistence?.mode)
        assertEquals(true, healthData.persistence?.isDurable)

        val stateRes = api.fetchArenaState(tournamentId = 7L, lastUsername = "djilali")
        assertTrue(stateRes is ApiResult.Success)
        val state = (stateRes as ApiResult.Success).data
        assertEquals("ephemeral", state.persistence?.mode)
        assertEquals(false, state.persistence?.isDurable)
        assertEquals(true, state.tournament?.isThirdPlaceEnabled)
        assertTrue(recordedRequests.any { it.contains("/api/state?tournamentId=7&username=djilali") })

        val checkInRes = api.toggleMatchCheckIn(55L, playerSlot = 1, checkedIn = true)
        assertTrue(checkInRes is ApiResult.Success)

        val voteRes = api.voteMatchPrediction(55L, voterKey = "voter-abc", pickedSlot = 2)
        assertTrue(voteRes is ApiResult.Success)

        val scheduleRes = api.autoScheduleMatches(7L, startAtMillis = 1730000100000L, intervalMinutes = 20, onlyUnscheduled = false)
        assertTrue(scheduleRes is ApiResult.Success)
        assertEquals(4, (scheduleRes as ApiResult.Success).data.scheduledCount)

        val bulkRes = api.bulkImportPlayers(7L, linesText = "أحمد | ahmed_1\nيوسف | youcef_2")
        assertTrue(bulkRes is ApiResult.Success)
        assertEquals(2, (bulkRes as ApiResult.Success).data.addedCount)
        assertEquals(1, bulkRes.data.skippedCount)
    }
}
