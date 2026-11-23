package com.example.api

import com.example.BuildConfig
import com.example.data.local.AdminAccountEntity
import com.example.data.local.LockoutState
import com.example.data.local.MatchEntity
import com.example.data.local.MatchReminderEntity
import com.example.data.local.PlayerEntity
import com.example.data.local.TournamentEntity
import com.example.data.local.TournamentGroupEntity
import com.example.data.model.AdminRole
import com.example.data.model.DrawMode
import com.example.data.model.KnockoutTieRule
import com.example.data.model.MatchStage
import com.example.data.model.PlayerLevel
import com.example.data.model.PlayerStatus
import com.example.data.model.TournamentFormat
import com.example.data.model.TournamentStatus
import com.example.domain.GroupStandingRow
import com.example.domain.PlayerStats
import com.example.domain.TournamentOverviewStats
import com.example.ui.viewmodel.GroupWithStandings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.Closeable
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.URLEncoder
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import javax.net.ssl.SSLException

sealed class ApiResult<out T> {
    data class Success<T>(val data: T, val messageAr: String = "") : ApiResult<T>()
    data class Error(
        val messageAr: String,
        val statusCode: Int = 0,
        val lockoutState: LockoutState? = null
    ) : ApiResult<Nothing>()
}

data class RemoteArenaState(
    val tournaments: List<TournamentEntity>,
    val tournament: TournamentEntity?,
    val players: List<PlayerEntity>,
    val approvedPlayers: List<PlayerEntity>,
    val pendingPlayers: List<PlayerEntity>,
    val rejectedPlayers: List<PlayerEntity>,
    val groupsWithStandings: List<GroupWithStandings>,
    val leagueStandings: List<GroupStandingRow>,
    val leagueMatches: List<MatchEntity>,
    val knockoutMatches: List<MatchEntity>,
    val allMatches: List<MatchEntity>,
    val matchReminders: List<MatchReminderEntity>,
    val playerStats: List<PlayerStats>,
    val overviewStats: TournamentOverviewStats,
    val championPlayer: PlayerEntity?,
    val isRegistrationOpenNow: Boolean,
    val seasonLeaderboard: List<SeasonLeaderboardEntry> = emptyList(),
    val hallOfFame: List<HallOfFameEntry> = emptyList(),
    val auditLogs: List<AuditLogEntry> = emptyList(),
    val hasHeadAdmin: Boolean,
    val adminDirectory: List<AdminAccountEntity>,
    val adminAccounts: List<AdminAccountEntity>,
    val currentAdmin: AdminAccountEntity?,
    val keepSignedIn: Boolean,
    val lockoutState: LockoutState
)

data class SeasonLeaderboardEntry(
    val rank: Int,
    val elysiumNetId: String,
    val displayName: String,
    val avatarUrl: String?,
    val clubName: String,
    val tournamentsCount: Int,
    val titles: Int,
    val runnerUps: Int,
    val thirdPlaces: Int,
    val matchesPlayed: Int,
    val wins: Int,
    val draws: Int,
    val losses: Int,
    val goalsScored: Int,
    val goalsConceded: Int,
    val cleanSheets: Int,
    val winRatePercent: Int,
    val seasonPoints: Int
)

data class HallOfFameEntry(
    val tournamentId: Long,
    val tournamentName: String,
    val gameTitle: String,
    val startDateTime: String,
    val championName: String,
    val championElysiumNetId: String,
    val championAvatarUrl: String?,
    val runnerUpName: String?,
    val thirdPlaceName: String?,
    val totalGoals: Int,
    val completedMatches: Int,
    val createdAt: Long
)

data class AuditLogEntry(
    val id: Long,
    val adminId: Long?,
    val tournamentId: Long?,
    val actorUsername: String,
    val actorDisplayName: String,
    val actionType: String,
    val summaryAr: String,
    val createdAt: Long
)

data class BulkImportResult(
    val addedCount: Int,
    val skippedCount: Int
)

data class AutoScheduleResult(
    val scheduledCount: Int
)

data class AuthPayload(
    val token: String,
    val admin: AdminAccountEntity,
    val lockoutState: LockoutState?
)

data class HealthCheckResult(
    val ok: Boolean,
    val service: String,
    val timestamp: Long
)

data class ServerConnectionCheck(
    val isReachable: Boolean,
    val baseUrl: String,
    val statusCode: Int = 0,
    val messageAr: String,
    val isNotFound: Boolean = false
)

data class TournamentExportPayload(
    val fileName: String,
    val fullText: String,
    val socialText: String
)

class ApiService(
    initialBaseUrl: String = DEFAULT_BASE_URL,
    private val httpClient: OkHttpClient = defaultHttpClient(),
    private val onUnauthorized: () -> Unit = {}
) {
    companion object {
        val DEFAULT_BASE_URL: String = normalizeBaseUrl(BuildConfig.DEFAULT_RENDER_BASE_URL)
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

        fun defaultHttpClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(25, TimeUnit.SECONDS)
            .writeTimeout(25, TimeUnit.SECONDS)
            .build()

        fun normalizeBaseUrl(rawUrl: String?): String {
            val trimmed = rawUrl?.trim().orEmpty()
            if (trimmed.isEmpty()) {
                return BuildConfig.DEFAULT_RENDER_BASE_URL.trimEnd('/')
            }
            val withScheme = when {
                trimmed.startsWith("https://", ignoreCase = true) -> trimmed
                trimmed.startsWith("http://", ignoreCase = true) -> trimmed
                else -> "https://$trimmed"
            }
            return withScheme.trimEnd('/')
        }

        fun isValidHttpUrl(rawUrl: String): Boolean {
            val trimmed = rawUrl.trim()
            if (trimmed.isEmpty()) return false
            val normalized = normalizeBaseUrl(trimmed)
            if (!normalized.startsWith("https://") && !normalized.startsWith("http://")) return false
            val hostPart = normalized.substringAfter("://").substringBefore("/").substringBefore(":")
            if (hostPart.isBlank() || hostPart.contains(" ")) return false
            return hostPart.equals("localhost", ignoreCase = true) || hostPart.contains(".")
        }
    }

    private val baseUrlRef = AtomicReference(normalizeBaseUrl(initialBaseUrl))
    private val _baseUrlFlow = MutableStateFlow(baseUrlRef.get())
    val baseUrlFlow: StateFlow<String> = _baseUrlFlow.asStateFlow()

    private val authTokenRef = AtomicReference<String?>(null)

    private val sseClient: OkHttpClient = httpClient.newBuilder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .retryOnConnectionFailure(true)
        .build()

    fun getBaseUrl(): String = baseUrlRef.get()

    fun setBaseUrl(newBaseUrl: String): String {
        val normalized = normalizeBaseUrl(newBaseUrl)
        baseUrlRef.set(normalized)
        _baseUrlFlow.value = normalized
        return normalized
    }

    fun resetBaseUrl(): String = setBaseUrl(DEFAULT_BASE_URL)

    fun getAuthToken(): String? = authTokenRef.get()

    fun setAuthToken(token: String?) {
        authTokenRef.set(token?.trim()?.takeIf { it.isNotEmpty() })
    }

    /**
     * Converts relative `/uploads/...` or `/images/...` paths from the server
     * into full URLs bound to the active Base URL.
     */
    fun resolveMediaUrl(rawPathOrUrl: String?): String? {
        val clean = rawPathOrUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return when {
            clean.startsWith("https://", ignoreCase = true) ||
                clean.startsWith("http://", ignoreCase = true) ||
                clean.startsWith("content://", ignoreCase = true) ||
                clean.startsWith("file://", ignoreCase = true) -> clean
            clean.startsWith("/") -> "${getBaseUrl()}$clean"
            else -> "${getBaseUrl()}/$clean"
        }
    }

    /**
     * Converts full server `/uploads/...` URLs back into relative `/uploads/...`
     * when sending tournament/player updates to match web frontend payloads.
     */
    fun toServerMediaPath(rawPathOrUrl: String?): String? {
        val clean = rawPathOrUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val currentBase = getBaseUrl()
        return if (clean.startsWith("$currentBase/uploads/")) {
            clean.removePrefix(currentBase)
        } else {
            clean
        }
    }

    suspend fun checkHealth(overrideBaseUrl: String? = null): ApiResult<HealthCheckResult> {
        val targetBase = if (overrideBaseUrl != null) normalizeBaseUrl(overrideBaseUrl) else getBaseUrl()
        return executeAbsoluteJsonRequest(
            method = "GET",
            url = "$targetBase/api/health",
            bodyJson = null,
            includeAuth = false
        ) { json ->
            HealthCheckResult(
                ok = json.optBoolean("ok", false),
                service = json.optString("service", ""),
                timestamp = json.optLong("ts", 0L)
            )
        }
    }

    /**
     * Tests connectivity against `<baseUrl>/api/health` on startup or after changing URL.
     * Distinguishes 404 (undeployed/wrong Render URL), 502/503 (Render cold-start), timeouts, and DNS errors.
     */
    suspend fun testStartupConnection(overrideBaseUrl: String? = null): ServerConnectionCheck {
        val rawCandidate = overrideBaseUrl ?: getBaseUrl()
        if (overrideBaseUrl != null && !isValidHttpUrl(overrideBaseUrl)) {
            return ServerConnectionCheck(
                isReachable = false,
                baseUrl = rawCandidate.trim(),
                messageAr = "رابط الخادم غير صالح. يرجى إدخال رابط يبدأ بـ https:// مثل https://your-app.onrender.com"
            )
        }
        val targetBase = normalizeBaseUrl(rawCandidate)
        return when (val res = checkHealth(targetBase)) {
            is ApiResult.Success -> {
                if (res.data.ok) {
                    ServerConnectionCheck(
                        isReachable = true,
                        baseUrl = targetBase,
                        statusCode = 200,
                        messageAr = "تم الاتصال بخادم CP4 ARENA المركزي بنجاح ($targetBase)."
                    )
                } else {
                    ServerConnectionCheck(
                        isReachable = false,
                        baseUrl = targetBase,
                        statusCode = 503,
                        messageAr = "الخادم استجاب لكن قاعدة البيانات المركزية غير جاهزة حالياً ($targetBase)."
                    )
                }
            }
            is ApiResult.Error -> ServerConnectionCheck(
                isReachable = false,
                baseUrl = targetBase,
                statusCode = res.statusCode,
                messageAr = res.messageAr,
                isNotFound = res.statusCode == 404
            )
        }
    }

    suspend fun fetchArenaState(tournamentId: Long? = null): ApiResult<RemoteArenaState> {
        val query = if (tournamentId != null && tournamentId > 0L) {
            "?tournamentId=${URLEncoder.encode(tournamentId.toString(), "UTF-8")}"
        } else {
            ""
        }
        return executeJsonRequest(
            method = "GET",
            path = "/api/state$query",
            bodyJson = null
        ) { json -> parseArenaState(json) }
    }

    suspend fun uploadImageDataUrl(dataUrl: String): ApiResult<String> {
        val body = JSONObject().put("dataUrl", dataUrl)
        return executeJsonRequest("POST", "/api/uploads/image", body) { json ->
            json.optString("url")
        }
    }

    suspend fun registerPlayer(
        tournamentId: Long,
        name: String,
        elysiumNetId: String,
        avatarUrl: String?,
        level: PlayerLevel,
        clubName: String
    ): ApiResult<Unit> {
        val body = JSONObject()
            .put("tournamentId", tournamentId)
            .put("name", name)
            .put("elysiumNetId", elysiumNetId)
            .put("avatarUrl", toServerMediaPath(avatarUrl) ?: JSONObject.NULL)
            .put("level", level.name)
            .put("clubName", clubName)
        return executeJsonRequest("POST", "/api/players/register", body) { Unit }
    }

    suspend fun setupHeadAdmin(
        username: String,
        displayName: String,
        pin: String,
        keepSignedIn: Boolean
    ): ApiResult<AuthPayload> {
        val body = JSONObject()
            .put("username", username)
            .put("displayName", displayName)
            .put("pin", pin)
            .put("keepSignedIn", keepSignedIn)
        return executeJsonRequest("POST", "/api/admin/setup-head", body, includeAuth = false) { json ->
            val token = json.optString("token")
            if (token.isNotBlank()) setAuthToken(token)
            AuthPayload(
                token = token,
                admin = parseAdmin(json.getJSONObject("admin")),
                lockoutState = json.optJSONObject("lockoutState")?.let(::parseLockout)
            )
        }
    }

    suspend fun loginAdmin(
        username: String,
        pin: String,
        keepSignedIn: Boolean
    ): ApiResult<AuthPayload> {
        val body = JSONObject()
            .put("username", username)
            .put("pin", pin)
            .put("keepSignedIn", keepSignedIn)
        return executeJsonRequest("POST", "/api/admin/login", body, includeAuth = false) { json ->
            val token = json.optString("token")
            if (token.isNotBlank()) setAuthToken(token)
            AuthPayload(
                token = token,
                admin = parseAdmin(json.getJSONObject("admin")),
                lockoutState = json.optJSONObject("lockoutState")?.let(::parseLockout)
            )
        }
    }

    suspend fun logoutAdmin(): ApiResult<Unit> {
        val res = executeJsonRequest("POST", "/api/admin/logout", JSONObject()) { Unit }
        setAuthToken(null)
        return res
    }

    suspend fun changeOwnPin(currentPin: String, newPin: String): ApiResult<Unit> {
        val body = JSONObject()
            .put("currentPin", currentPin)
            .put("newPin", newPin)
        return executeJsonRequest("POST", "/api/admin/change-pin", body) { json ->
            val token = json.optString("token")
            if (token.isNotBlank()) setAuthToken(token)
            Unit
        }
    }

    suspend fun updateOwnProfile(displayName: String, username: String?): ApiResult<AdminAccountEntity> {
        val body = JSONObject().put("displayName", displayName)
        if (!username.isNullOrBlank()) {
            body.put("username", username)
        }
        return executeJsonRequest("PATCH", "/api/admin/profile", body) { json ->
            val token = json.optString("token")
            if (token.isNotBlank()) setAuthToken(token)
            parseAdmin(json.getJSONObject("admin"))
        }
    }

    suspend fun createSubAdmin(
        username: String,
        displayName: String,
        pin: String,
        canManageTournament: Boolean,
        canManagePlayers: Boolean,
        canRunDraw: Boolean,
        canEditScores: Boolean,
        canCrownChampion: Boolean
    ): ApiResult<Unit> {
        val body = JSONObject()
            .put("username", username)
            .put("displayName", displayName)
            .put("pin", pin)
            .put("canManageTournament", canManageTournament)
            .put("canManagePlayers", canManagePlayers)
            .put("canRunDraw", canRunDraw)
            .put("canEditScores", canEditScores)
            .put("canCrownChampion", canCrownChampion)
        return executeJsonRequest("POST", "/api/admin/sub-admins", body) { Unit }
    }

    suspend fun updateSubAdmin(
        id: Long,
        displayName: String,
        newPin: String?,
        isActive: Boolean,
        canManageTournament: Boolean,
        canManagePlayers: Boolean,
        canRunDraw: Boolean,
        canEditScores: Boolean,
        canCrownChampion: Boolean
    ): ApiResult<Unit> {
        val body = JSONObject()
            .put("displayName", displayName)
            .put("newPin", newPin?.takeIf { it.isNotBlank() } ?: JSONObject.NULL)
            .put("isActive", isActive)
            .put("canManageTournament", canManageTournament)
            .put("canManagePlayers", canManagePlayers)
            .put("canRunDraw", canRunDraw)
            .put("canEditScores", canEditScores)
            .put("canCrownChampion", canCrownChampion)
        return executeJsonRequest("PATCH", "/api/admin/sub-admins/$id", body) { Unit }
    }

    suspend fun deleteSubAdmin(id: Long): ApiResult<Unit> {
        return executeJsonRequest("DELETE", "/api/admin/sub-admins/$id", null) { Unit }
    }

    suspend fun createTournament(tournament: TournamentEntity): ApiResult<Long?> {
        val body = tournamentPayload(tournament)
        return executeJsonRequest("POST", "/api/tournaments", body) { json ->
            json.optJSONObject("tournament")?.optLong("id")?.takeIf { it > 0L }
        }
    }

    suspend fun updateTournament(tournament: TournamentEntity): ApiResult<Unit> {
        val body = tournamentPayload(tournament)
        return executeJsonRequest("PUT", "/api/tournaments/${tournament.id}", body) { Unit }
    }

    suspend fun deleteTournament(tournamentId: Long): ApiResult<Unit> {
        return executeJsonRequest("DELETE", "/api/tournaments/$tournamentId", null) { Unit }
    }

    suspend fun adminAddPlayer(
        tournamentId: Long,
        name: String,
        elysiumNetId: String,
        avatarUrl: String?,
        level: PlayerLevel,
        ovrRating: Int,
        clubName: String,
        autoApprove: Boolean = true
    ): ApiResult<PlayerEntity> {
        val body = JSONObject()
            .put("name", name)
            .put("elysiumNetId", elysiumNetId)
            .put("avatarUrl", toServerMediaPath(avatarUrl) ?: JSONObject.NULL)
            .put("level", level.name)
            .put("ovrRating", ovrRating)
            .put("clubName", clubName)
            .put("status", if (autoApprove) PlayerStatus.APPROVED.name else PlayerStatus.PENDING.name)
        return executeJsonRequest("POST", "/api/tournaments/$tournamentId/players", body) { json ->
            parsePlayer(json.getJSONObject("player"))
        }
    }

    suspend fun updatePlayerStatus(playerId: Long, status: PlayerStatus): ApiResult<Unit> {
        val body = JSONObject().put("status", status.name)
        return executeJsonRequest("PATCH", "/api/players/$playerId/status", body) { Unit }
    }

    suspend fun updatePlayerDetails(player: PlayerEntity): ApiResult<Unit> {
        val body = JSONObject()
            .put("name", player.name)
            .put("elysiumNetId", player.elysiumNetId)
            .put("avatarUrl", toServerMediaPath(player.avatarUri) ?: JSONObject.NULL)
            .put("clubName", player.clubName)
            .put("level", player.level.name)
            .put("ovrRating", player.ovrRating)
        return executeJsonRequest("PATCH", "/api/players/${player.id}", body) { Unit }
    }

    suspend fun deletePlayer(playerId: Long): ApiResult<Unit> {
        return executeJsonRequest("DELETE", "/api/players/$playerId", null) { Unit }
    }

    suspend fun runDraw(
        tournamentId: Long,
        manualGroupAssignments: Map<Long, Int>,
        manualKnockoutOrder: List<Long>
    ): ApiResult<Unit> {
        val groupObj = JSONObject()
        manualGroupAssignments.forEach { (playerId, groupIdx) ->
            groupObj.put(playerId.toString(), groupIdx)
        }
        val orderArr = JSONArray()
        manualKnockoutOrder.forEach { orderArr.put(it) }
        val body = JSONObject()
            .put("manualGroupAssignments", groupObj)
            .put("manualKnockoutOrder", orderArr)
        return executeJsonRequest("POST", "/api/tournaments/$tournamentId/draw", body) { Unit }
    }

    suspend fun generateKnockoutFromStandings(tournamentId: Long): ApiResult<Unit> {
        return executeJsonRequest("POST", "/api/tournaments/$tournamentId/knockout-from-standings", JSONObject()) { Unit }
    }

    suspend fun updateMatchScore(
        matchId: Long,
        leg1Score1: Int?,
        leg1Score2: Int?,
        leg2Score1: Int?,
        leg2Score2: Int?,
        penaltyScore1: Int?,
        penaltyScore2: Int?
    ): ApiResult<Unit> {
        val body = JSONObject()
            .put("leg1Score1", leg1Score1 ?: JSONObject.NULL)
            .put("leg1Score2", leg1Score2 ?: JSONObject.NULL)
            .put("leg2Score1", leg2Score1 ?: JSONObject.NULL)
            .put("leg2Score2", leg2Score2 ?: JSONObject.NULL)
            .put("penaltyScore1", penaltyScore1 ?: JSONObject.NULL)
            .put("penaltyScore2", penaltyScore2 ?: JSONObject.NULL)
        return executeJsonRequest("PATCH", "/api/matches/$matchId/score", body) { Unit }
    }

    suspend fun updateKnockoutWinner(matchId: Long, winnerPlayerId: Long?): ApiResult<Unit> {
        val body = JSONObject().put("winnerPlayerId", winnerPlayerId ?: JSONObject.NULL)
        return executeJsonRequest("PATCH", "/api/matches/$matchId/winner", body) { Unit }
    }

    suspend fun crownChampion(tournamentId: Long, playerId: Long?): ApiResult<Unit> {
        val body = JSONObject().put("playerId", playerId ?: JSONObject.NULL)
        return executeJsonRequest("POST", "/api/tournaments/$tournamentId/champion", body) { Unit }
    }

    suspend fun toggleMatchCheckIn(
        matchId: Long,
        playerSlot: Int,
        checkedIn: Boolean? = null
    ): ApiResult<Unit> {
        val body = JSONObject().put("playerSlot", playerSlot)
        if (checkedIn != null) body.put("checkedIn", checkedIn)
        return executeJsonRequest("POST", "/api/matches/$matchId/checkin", body, includeAuth = false) { Unit }
    }

    suspend fun voteMatchPrediction(
        matchId: Long,
        voterKey: String,
        pickedSlot: Int
    ): ApiResult<Unit> {
        val body = JSONObject()
            .put("voterKey", voterKey)
            .put("pickedSlot", pickedSlot)
        return executeJsonRequest("POST", "/api/matches/$matchId/predict", body, includeAuth = false) { Unit }
    }

    suspend fun submitMatchDispute(
        matchId: Long,
        submittedBy: String,
        note: String,
        screenshotUrl: String?
    ): ApiResult<Unit> {
        val body = JSONObject()
            .put("submittedBy", submittedBy)
            .put("note", note)
            .put("screenshotUrl", toServerMediaPath(screenshotUrl) ?: JSONObject.NULL)
        return executeJsonRequest("POST", "/api/matches/$matchId/dispute", body, includeAuth = false) { Unit }
    }

    suspend fun resolveMatchDispute(
        matchId: Long,
        resolutionNote: String? = null
    ): ApiResult<Unit> {
        val body = JSONObject()
        if (!resolutionNote.isNullOrBlank()) body.put("resolutionNote", resolutionNote)
        return executeJsonRequest("POST", "/api/matches/$matchId/dispute/resolve", body) { Unit }
    }

    suspend fun adminWalkoverMatch(
        matchId: Long,
        winnerSlot: Int,
        reason: String? = null
    ): ApiResult<Unit> {
        val body = JSONObject()
            .put("winnerSlot", winnerSlot)
            .put("reason", reason?.takeIf { it.isNotBlank() } ?: JSONObject.NULL)
        return executeJsonRequest("POST", "/api/matches/$matchId/walkover", body) { Unit }
    }

    suspend fun bulkImportPlayers(
        tournamentId: Long,
        linesText: String,
        status: PlayerStatus = PlayerStatus.APPROVED
    ): ApiResult<BulkImportResult> {
        val body = JSONObject()
            .put("linesText", linesText)
            .put("status", status.name)
        return executeJsonRequest("POST", "/api/tournaments/$tournamentId/players/bulk", body) { json ->
            BulkImportResult(
                addedCount = json.optInt("addedCount", 0),
                skippedCount = json.optInt("skippedCount", 0)
            )
        }
    }

    suspend fun autoScheduleMatches(
        tournamentId: Long,
        startAtMillis: Long,
        intervalMinutes: Int,
        onlyUnscheduled: Boolean = true
    ): ApiResult<AutoScheduleResult> {
        val body = JSONObject()
            .put("startAtMillis", startAtMillis)
            .put("intervalMinutes", intervalMinutes)
            .put("onlyUnscheduled", onlyUnscheduled)
        return executeJsonRequest("POST", "/api/tournaments/$tournamentId/schedule-matches", body) { json ->
            AutoScheduleResult(
                scheduledCount = json.optInt("scheduledCount", 0)
            )
        }
    }

    suspend fun scheduleReminder(
        matchId: Long,
        matchTitle: String,
        scheduledAtMillis: Long,
        leadMinutes: Int
    ): ApiResult<MatchReminderEntity> {
        val body = JSONObject()
            .put("matchId", matchId)
            .put("matchTitle", matchTitle)
            .put("scheduledAtMillis", scheduledAtMillis)
            .put("leadMinutes", leadMinutes)
        return executeJsonRequest("POST", "/api/reminders", body) { json ->
            parseReminder(json.getJSONObject("reminder"))
        }
    }

    suspend fun cancelReminder(matchId: Long): ApiResult<Unit> {
        return executeJsonRequest("DELETE", "/api/reminders/$matchId", null) { Unit }
    }

    suspend fun fetchTournamentExport(tournamentId: Long): ApiResult<TournamentExportPayload> {
        return executeJsonRequest("GET", "/api/tournaments/$tournamentId/export", null) { json ->
            TournamentExportPayload(
                fileName = json.optString("fileName", "cp4_arena_export.txt"),
                fullText = json.optString("fullText", ""),
                socialText = json.optString("socialText", "")
            )
        }
    }

    /**
     * Blocking SSE listener intended to run on a coroutine IO dispatcher.
     * Emits parsed event `type` whenever the central server pushes updates.
     */
    fun openEventsStream(
        onEvent: (eventType: String) -> Unit,
        onConnectionChanged: (connected: Boolean) -> Unit
    ): Closeable {
        val request = Request.Builder()
            .url("${getBaseUrl()}/api/events")
            .header("Accept", "text/event-stream")
            .header("Cache-Control", "no-cache")
            .get()
            .build()

        val call = sseClient.newCall(request)
        try {
            call.execute().use { response ->
                if (!response.isSuccessful) {
                    onConnectionChanged(false)
                    return Closeable { call.cancel() }
                }
                val body = response.body ?: run {
                    onConnectionChanged(false)
                    return Closeable { call.cancel() }
                }
                onConnectionChanged(true)
                val reader = body.charStream().buffered()
                while (!call.isCanceled()) {
                    val line = reader.readLine() ?: break
                    if (line.startsWith("data:")) {
                        val payload = line.removePrefix("data:").trim()
                        if (payload.isNotEmpty()) {
                            runCatching {
                                val json = JSONObject(payload)
                                val type = json.optString("type")
                                if (type.isNotBlank() && type != "connected") {
                                    onEvent(type)
                                }
                            }
                        }
                    }
                }
            }
        } catch (_: Exception) {
            // Caller reconnects with backoff when loop returns
        } finally {
            onConnectionChanged(false)
        }
        return Closeable { call.cancel() }
    }

    private fun tournamentPayload(t: TournamentEntity): JSONObject = JSONObject()
        .put("name", t.name)
        .put("gameTitle", t.gameTitle)
        .put("gameCategory", t.gameCategory)
        .put("scoreUnitLabel", t.scoreUnitLabel)
        .put("description", t.description)
        .put("bannerUrl", toServerMediaPath(t.bannerUri) ?: JSONObject.NULL)
        .put("startDateTime", t.startDateTime)
        .put("maxParticipants", t.maxParticipants)
        .put("format", t.format.name)
        .put("groupCount", t.groupCount)
        .put("qualifiersPerGroup", t.qualifiersPerGroup)
        .put("drawMode", t.drawMode.name)
        .put("knockoutTieRule", t.knockoutTieRule.name)
        .put("matchDurationMinutes", t.matchDurationMinutes)
        .put("targetGoalsRule", t.targetGoalsRule)
        .put("isRegistrationClosedManual", t.isRegistrationClosedManual)
        .put("isThirdPlaceEnabled", t.isThirdPlaceEnabled)

    private suspend fun <T> executeJsonRequest(
        method: String,
        path: String,
        bodyJson: JSONObject?,
        includeAuth: Boolean = true,
        mapper: (JSONObject) -> T
    ): ApiResult<T> = executeAbsoluteJsonRequest(
        method = method,
        url = "${getBaseUrl()}$path",
        bodyJson = bodyJson,
        includeAuth = includeAuth,
        mapper = mapper
    )

    private suspend fun <T> executeAbsoluteJsonRequest(
        method: String,
        url: String,
        bodyJson: JSONObject?,
        includeAuth: Boolean,
        mapper: (JSONObject) -> T
    ): ApiResult<T> = withContext(Dispatchers.IO) {
        try {
            val builder = Request.Builder()
                .url(url)
                .header("Accept", "application/json")

            if (includeAuth) {
                authTokenRef.get()?.let { token ->
                    builder.header("Authorization", "Bearer $token")
                }
            }

            val reqBody = bodyJson?.toString()?.toRequestBody(JSON_MEDIA_TYPE)
            when (method) {
                "GET" -> builder.get()
                "POST" -> builder.post(reqBody ?: "{}".toRequestBody(JSON_MEDIA_TYPE))
                "PUT" -> builder.put(reqBody ?: "{}".toRequestBody(JSON_MEDIA_TYPE))
                "PATCH" -> builder.patch(reqBody ?: "{}".toRequestBody(JSON_MEDIA_TYPE))
                "DELETE" -> if (reqBody != null) builder.delete(reqBody) else builder.delete()
                else -> builder.method(method, reqBody)
            }

            httpClient.newCall(builder.build()).execute().use { response ->
                val rawBody = response.body?.string().orEmpty()
                val json = if (rawBody.isNotBlank()) {
                    runCatching { JSONObject(rawBody) }.getOrElse { JSONObject() }
                } else {
                    JSONObject()
                }

                if (response.code == 401 && includeAuth) {
                    setAuthToken(null)
                    onUnauthorized()
                }

                if (!response.isSuccessful) {
                    val serverError = json.optString("error").takeIf { it.isNotBlank() }
                    val friendlyError = serverError ?: buildHttpErrorMessage(response.code, url)
                    val lock = json.optJSONObject("lockoutState")?.let(::parseLockout)
                    return@withContext ApiResult.Error(
                        messageAr = friendlyError,
                        statusCode = response.code,
                        lockoutState = lock
                    )
                }

                if (rawBody.isNotBlank() && json.length() == 0 && !rawBody.trimStart().startsWith("{")) {
                    return@withContext ApiResult.Error(
                        messageAr = "الرابط ($url) لا يعيد استجابة API صالحة. تأكد من إدخال رابط خدمة الويب الصحيح على Render.",
                        statusCode = response.code
                    )
                }

                val messageAr = json.optString("messageAr", "")
                ApiResult.Success(mapper(json), messageAr)
            }
        } catch (e: Exception) {
            ApiResult.Error(
                messageAr = buildNetworkExceptionMessage(e, url)
            )
        }
    }

    private fun buildHttpErrorMessage(code: Int, requestUrl: String): String {
        val hostBase = runCatching {
            val uri = java.net.URI(requestUrl)
            "${uri.scheme}://${uri.authority}"
        }.getOrDefault(getBaseUrl())

        return when (code) {
            404 -> "الخادم غير موجود على هذا الرابط (404 Not Found): $hostBase. تأكد من نشر الموقع على Render أو حدّث رابط الخادم من زر (تغيير رابط خادم Render)."
            502, 503, 504 -> "خادم Render غير متاح مؤقتاً أو قيد الاستيقاظ حالياً ($code). انتظر 20-30 ثانية ثم أعد المحاولة."
            else -> "تعذر إتمام الطلب من الخادم ($code) على $hostBase."
        }
    }

    private fun buildNetworkExceptionMessage(e: Exception, requestUrl: String): String {
        val hostBase = runCatching {
            val uri = java.net.URI(requestUrl)
            "${uri.scheme}://${uri.authority}"
        }.getOrDefault(getBaseUrl())

        return when (e) {
            is UnknownHostException -> "تعذر العثور على الخادم ($hostBase). تحقق من اتصالك بالإنترنت أو صحة رابط الموقع."
            is SocketTimeoutException -> "انتهت مهلة الاتصال بالخادم ($hostBase). قد يكون الخادم قيد الاستيقاظ على Render، أعد المحاولة بعد لحظات."
            is ConnectException -> "تم رفض الاتصال بالخادم ($hostBase). تأكد أن الخادم يعمل ويستقبل الطلبات."
            is SSLException -> "فشل الاتصال الآمن HTTPS بالخادم ($hostBase). تحقق من شهادة SSL أو صحة الرابط."
            else -> "تعذر الاتصال بخادم CP4 ARENA ($hostBase): ${e.localizedMessage ?: "تحقق من الإنترنت"}"
        }
    }

    private fun parseArenaState(json: JSONObject): RemoteArenaState {
        val tournaments = parseArray(json.optJSONArray("tournaments"), ::parseTournament)
        val tournament = json.optJSONObject("tournament")?.let(::parseTournament)
        val players = parseArray(json.optJSONArray("players"), ::parsePlayer)
        val approvedPlayers = parseArray(json.optJSONArray("approvedPlayers"), ::parsePlayer)
        val pendingPlayers = parseArray(json.optJSONArray("pendingPlayers"), ::parsePlayer)
        val rejectedPlayers = parseArray(json.optJSONArray("rejectedPlayers"), ::parsePlayer)
        val groupsWithStandings = parseArray(json.optJSONArray("groupsWithStandings"), ::parseGroupWithStandings)
        val leagueStandings = parseArray(json.optJSONArray("leagueStandings"), ::parseStandingRow)
        val leagueMatches = parseArray(json.optJSONArray("leagueMatches"), ::parseMatch)
        val knockoutMatches = parseArray(json.optJSONArray("knockoutMatches"), ::parseMatch)
        val allMatches = parseArray(json.optJSONArray("allMatches"), ::parseMatch)
        val matchReminders = parseArray(json.optJSONArray("matchReminders"), ::parseReminder)
        val playerStats = parseArray(json.optJSONArray("playerStats"), ::parsePlayerStats)
        val overviewStats = parseOverviewStats(json.optJSONObject("overviewStats"))
        val championPlayer = json.optJSONObject("championPlayer")?.let(::parsePlayer)
        val seasonLeaderboard = parseArray(json.optJSONArray("seasonLeaderboard"), ::parseSeasonLeaderboardEntry)
        val hallOfFame = parseArray(json.optJSONArray("hallOfFame"), ::parseHallOfFameEntry)
        val auditLogs = parseArray(json.optJSONArray("auditLogs"), ::parseAuditLogEntry)
        val adminDirectory = parseArray(json.optJSONArray("adminDirectory"), ::parseAdmin)
        val adminAccounts = parseArray(json.optJSONArray("adminAccounts"), ::parseAdmin)
        val currentAdmin = json.optJSONObject("currentAdmin")?.let(::parseAdmin)
        val lockoutState = json.optJSONObject("lockoutState")?.let(::parseLockout) ?: LockoutState()

        return RemoteArenaState(
            tournaments = tournaments,
            tournament = tournament,
            players = players,
            approvedPlayers = approvedPlayers,
            pendingPlayers = pendingPlayers,
            rejectedPlayers = rejectedPlayers,
            groupsWithStandings = groupsWithStandings,
            leagueStandings = leagueStandings,
            leagueMatches = leagueMatches,
            knockoutMatches = knockoutMatches,
            allMatches = allMatches,
            matchReminders = matchReminders,
            playerStats = playerStats,
            overviewStats = overviewStats,
            championPlayer = championPlayer,
            isRegistrationOpenNow = json.optBoolean("isRegistrationOpenNow", false),
            seasonLeaderboard = seasonLeaderboard,
            hallOfFame = hallOfFame,
            auditLogs = auditLogs,
            hasHeadAdmin = json.optBoolean("hasHeadAdmin", false),
            adminDirectory = adminDirectory,
            adminAccounts = adminAccounts,
            currentAdmin = currentAdmin,
            keepSignedIn = json.optBoolean("keepSignedIn", true),
            lockoutState = lockoutState
        )
    }

    private inline fun <T> parseArray(arr: JSONArray?, mapper: (JSONObject) -> T): List<T> {
        if (arr == null) return emptyList()
        return buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                arr.optJSONObject(i)?.let { add(mapper(it)) }
            }
        }
    }

    private fun parseTournament(obj: JSONObject): TournamentEntity = TournamentEntity(
        id = obj.optLong("id", 0L),
        name = obj.optString("name", ""),
        gameTitle = obj.optString("gameTitle", "FIFA 22"),
        gameCategory = obj.optString("gameCategory", "كرة قدم"),
        scoreUnitLabel = obj.optString("scoreUnitLabel", "هدف"),
        description = obj.optString("description", ""),
        bannerUri = resolveMediaUrl(obj.optNullableString("bannerUrl")),
        startDateTime = obj.optString("startDateTime", ""),
        maxParticipants = obj.optInt("maxParticipants", 16),
        format = enumOrDefault(obj.optString("format"), TournamentFormat.GROUPS_KNOCKOUT),
        groupCount = obj.optInt("groupCount", 4),
        qualifiersPerGroup = obj.optInt("qualifiersPerGroup", 2),
        drawMode = enumOrDefault(obj.optString("drawMode"), DrawMode.RANDOM),
        knockoutTieRule = enumOrDefault(obj.optString("knockoutTieRule"), KnockoutTieRule.SINGLE_MATCH_PENALTIES),
        matchDurationMinutes = obj.optInt("matchDurationMinutes", 12),
        targetGoalsRule = obj.optString("targetGoalsRule", ""),
        isRegistrationClosedManual = obj.optBoolean("isRegistrationClosedManual", false),
        isThirdPlaceEnabled = obj.optBoolean("isThirdPlaceEnabled", false),
        status = enumOrDefault(obj.optString("status"), TournamentStatus.REGISTRATION_OPEN),
        championPlayerId = obj.optNullableLong("championPlayerId"),
        createdAt = obj.optLong("createdAt", 0L)
    )

    private fun parsePlayer(obj: JSONObject): PlayerEntity = PlayerEntity(
        id = obj.optLong("id", 0L),
        tournamentId = obj.optLong("tournamentId", 0L),
        name = obj.optString("name", ""),
        elysiumNetId = obj.optString("elysiumNetId", ""),
        avatarUri = resolveMediaUrl(obj.optNullableString("avatarUrl")),
        level = enumOrDefault(obj.optString("level"), PlayerLevel.INTERMEDIATE),
        ovrRating = obj.optInt("ovrRating", 81),
        clubName = obj.optString("clubName", ""),
        status = enumOrDefault(obj.optString("status"), PlayerStatus.PENDING),
        groupId = obj.optNullableLong("groupId"),
        seedOrder = obj.optInt("seedOrder", 0),
        registeredAt = obj.optLong("registeredAt", 0L)
    )

    private fun parseGroup(obj: JSONObject): TournamentGroupEntity = TournamentGroupEntity(
        id = obj.optLong("id", 0L),
        tournamentId = obj.optLong("tournamentId", 0L),
        name = obj.optString("name", ""),
        displayOrder = obj.optInt("displayOrder", 0)
    )

    private fun parseStandingRow(obj: JSONObject): GroupStandingRow = GroupStandingRow(
        player = parsePlayer(obj.getJSONObject("player")),
        position = obj.optInt("position", 0),
        played = obj.optInt("played", 0),
        wins = obj.optInt("wins", 0),
        draws = obj.optInt("draws", 0),
        losses = obj.optInt("losses", 0),
        goalsFor = obj.optInt("goalsFor", 0),
        goalsAgainst = obj.optInt("goalsAgainst", 0),
        goalDifference = obj.optInt("goalDifference", 0),
        points = obj.optInt("points", 0),
        isQualified = obj.optBoolean("isQualified", false)
    )

    private fun parseGroupWithStandings(obj: JSONObject): GroupWithStandings = GroupWithStandings(
        group = parseGroup(obj.getJSONObject("group")),
        standings = parseArray(obj.optJSONArray("standings"), ::parseStandingRow),
        matches = parseArray(obj.optJSONArray("matches"), ::parseMatch)
    )

    private fun parseMatch(obj: JSONObject): MatchEntity = MatchEntity(
        id = obj.optLong("id", 0L),
        tournamentId = obj.optLong("tournamentId", 0L),
        stage = enumOrDefault(obj.optString("stage"), MatchStage.GROUP),
        groupId = obj.optNullableLong("groupId"),
        roundNumber = obj.optInt("roundNumber", 1),
        bracketIndex = obj.optInt("bracketIndex", 0),
        player1Id = obj.optNullableLong("player1Id"),
        player2Id = obj.optNullableLong("player2Id"),
        leg1Score1 = obj.optNullableInt("leg1Score1"),
        leg1Score2 = obj.optNullableInt("leg1Score2"),
        leg2Score1 = obj.optNullableInt("leg2Score1"),
        leg2Score2 = obj.optNullableInt("leg2Score2"),
        penaltyScore1 = obj.optNullableInt("penaltyScore1"),
        penaltyScore2 = obj.optNullableInt("penaltyScore2"),
        isTwoLegged = obj.optBoolean("isTwoLegged", false),
        isCompleted = obj.optBoolean("isCompleted", false),
        winnerId = obj.optNullableLong("winnerId"),
        nextMatchId = obj.optNullableLong("nextMatchId"),
        nextMatchSlot = obj.optInt("nextMatchSlot", 1),
        scheduledLabel = obj.optString("scheduledLabel", ""),
        scheduledAtMillis = obj.optNullableLong("scheduledAtMillis"),
        p1CheckedIn = obj.optBoolean("p1CheckedIn", false),
        p2CheckedIn = obj.optBoolean("p2CheckedIn", false),
        isWalkover = obj.optBoolean("isWalkover", false),
        walkoverReason = obj.optString("walkoverReason", ""),
        disputeNote = obj.optString("disputeNote", ""),
        disputeScreenshotUrl = resolveMediaUrl(obj.optNullableString("disputeScreenshotUrl")),
        disputeSubmittedBy = obj.optString("disputeSubmittedBy", ""),
        disputeStatus = obj.optString("disputeStatus", "NONE"),
        votesP1 = obj.optInt("votesP1", 0),
        votesP2 = obj.optInt("votesP2", 0)
    )

    private fun parseReminder(obj: JSONObject): MatchReminderEntity = MatchReminderEntity(
        id = obj.optLong("id", 0L),
        matchId = obj.optLong("matchId", 0L),
        tournamentId = obj.optLong("tournamentId", 0L),
        matchTitle = obj.optString("matchTitle", ""),
        matchStageLabel = obj.optString("matchStageLabel", ""),
        scheduledAtMillis = obj.optLong("scheduledAtMillis", 0L),
        remindAtMillis = obj.optLong("remindAtMillis", 0L),
        leadMinutes = obj.optInt("leadMinutes", 15),
        isEnabled = obj.optBoolean("isEnabled", true),
        isDelivered = false
    )

    private fun parsePlayerStats(obj: JSONObject): PlayerStats = PlayerStats(
        player = parsePlayer(obj.getJSONObject("player")),
        matchesPlayed = obj.optInt("matchesPlayed", 0),
        wins = obj.optInt("wins", 0),
        draws = obj.optInt("draws", 0),
        losses = obj.optInt("losses", 0),
        goalsScored = obj.optInt("goalsScored", 0),
        goalsConceded = obj.optInt("goalsConceded", 0),
        cleanSheets = obj.optInt("cleanSheets", 0),
        winRatePercent = obj.optInt("winRatePercent", 0)
    )

    private fun parseOverviewStats(obj: JSONObject?): TournamentOverviewStats {
        if (obj == null) return TournamentOverviewStats(0, 0, 0, null, null, null)
        return TournamentOverviewStats(
            totalMatches = obj.optInt("totalMatches", 0),
            completedMatches = obj.optInt("completedMatches", 0),
            totalGoals = obj.optInt("totalGoals", 0),
            topScorer = obj.optJSONObject("topScorer")?.let(::parsePlayerStats),
            bestDefense = obj.optJSONObject("bestDefense")?.let(::parsePlayerStats),
            highestWinRate = obj.optJSONObject("highestWinRate")?.let(::parsePlayerStats)
        )
    }

    private fun parseAdmin(obj: JSONObject): AdminAccountEntity = AdminAccountEntity(
        id = obj.optLong("id", 0L),
        username = obj.optString("username", ""),
        displayName = obj.optString("displayName", ""),
        role = enumOrDefault(obj.optString("role"), AdminRole.SUB_ADMIN),
        pinHash = "",
        pinSalt = "",
        canManageTournament = obj.optBoolean("canManageTournament", false),
        canManagePlayers = obj.optBoolean("canManagePlayers", false),
        canRunDraw = obj.optBoolean("canRunDraw", false),
        canEditScores = obj.optBoolean("canEditScores", false),
        canCrownChampion = obj.optBoolean("canCrownChampion", false),
        permissionsHash = "",
        pinUpdatedAt = 0L,
        isActive = obj.optBoolean("isActive", true),
        lastLoginAt = obj.optNullableLong("lastLoginAt"),
        createdAt = obj.optLong("createdAt", 0L)
    )

    private fun parseLockout(obj: JSONObject): LockoutState = LockoutState(
        failedAttempts = obj.optInt("failedAttempts", 0),
        lockedUntilMillis = obj.optLong("lockedUntilMillis", 0L)
    )

    private fun parseSeasonLeaderboardEntry(obj: JSONObject): SeasonLeaderboardEntry = SeasonLeaderboardEntry(
        rank = obj.optInt("rank", 0),
        elysiumNetId = obj.optString("elysiumNetId", ""),
        displayName = obj.optString("displayName", ""),
        avatarUrl = resolveMediaUrl(obj.optNullableString("avatarUrl")),
        clubName = obj.optString("clubName", ""),
        tournamentsCount = obj.optInt("tournamentsCount", 0),
        titles = obj.optInt("titles", 0),
        runnerUps = obj.optInt("runnerUps", 0),
        thirdPlaces = obj.optInt("thirdPlaces", 0),
        matchesPlayed = obj.optInt("matchesPlayed", 0),
        wins = obj.optInt("wins", 0),
        draws = obj.optInt("draws", 0),
        losses = obj.optInt("losses", 0),
        goalsScored = obj.optInt("goalsScored", 0),
        goalsConceded = obj.optInt("goalsConceded", 0),
        cleanSheets = obj.optInt("cleanSheets", 0),
        winRatePercent = obj.optInt("winRatePercent", 0),
        seasonPoints = obj.optInt("seasonPoints", 0)
    )

    private fun parseHallOfFameEntry(obj: JSONObject): HallOfFameEntry = HallOfFameEntry(
        tournamentId = obj.optLong("tournamentId", 0L),
        tournamentName = obj.optString("tournamentName", ""),
        gameTitle = obj.optString("gameTitle", ""),
        startDateTime = obj.optString("startDateTime", ""),
        championName = obj.optString("championName", ""),
        championElysiumNetId = obj.optString("championElysiumNetId", ""),
        championAvatarUrl = resolveMediaUrl(obj.optNullableString("championAvatarUrl")),
        runnerUpName = obj.optNullableString("runnerUpName"),
        thirdPlaceName = obj.optNullableString("thirdPlaceName"),
        totalGoals = obj.optInt("totalGoals", 0),
        completedMatches = obj.optInt("completedMatches", 0),
        createdAt = obj.optLong("createdAt", 0L)
    )

    private fun parseAuditLogEntry(obj: JSONObject): AuditLogEntry = AuditLogEntry(
        id = obj.optLong("id", 0L),
        adminId = obj.optNullableLong("adminId"),
        tournamentId = obj.optNullableLong("tournamentId"),
        actorUsername = obj.optString("actorUsername", ""),
        actorDisplayName = obj.optString("actorDisplayName", ""),
        actionType = obj.optString("actionType", ""),
        summaryAr = obj.optString("summaryAr", ""),
        createdAt = obj.optLong("createdAt", 0L)
    )

    private inline fun <reified T : Enum<T>> enumOrDefault(raw: String?, fallback: T): T {
        if (raw.isNullOrBlank()) return fallback
        return runCatching { enumValueOf<T>(raw) }.getOrDefault(fallback)
    }

    private fun JSONObject.optNullableString(key: String): String? {
        if (!has(key) || isNull(key)) return null
        return optString(key).takeIf { it.isNotBlank() }
    }

    private fun JSONObject.optNullableLong(key: String): Long? {
        if (!has(key) || isNull(key)) return null
        return optLong(key)
    }

    private fun JSONObject.optNullableInt(key: String): Int? {
        if (!has(key) || isNull(key)) return null
        return optInt(key)
    }
}
