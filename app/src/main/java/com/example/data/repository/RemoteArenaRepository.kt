package com.example.data.repository

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import com.example.api.ApiResult
import com.example.api.ApiService
import com.example.api.RemoteArenaState
import com.example.data.local.AdminAccountEntity
import com.example.data.local.AdminSessionState
import com.example.data.local.MatchEntity
import com.example.data.local.MatchReminderEntity
import com.example.data.local.PlayerEntity
import com.example.data.local.SessionPreferences
import com.example.data.local.TournamentEntity
import com.example.data.model.PlayerLevel
import com.example.data.model.PlayerStatus
import com.example.notifications.MatchReminderScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.Closeable
import kotlin.math.max
import kotlin.math.roundToInt

class RemoteArenaRepository(
    private val context: Context,
    private val sessionPrefs: SessionPreferences,
    val apiService: ApiService = ApiService()
) {
    private val _remoteState = MutableStateFlow<RemoteArenaState?>(null)
    val remoteState: StateFlow<RemoteArenaState?> = _remoteState.asStateFlow()

    val serverBaseUrl: StateFlow<String> = apiService.baseUrlFlow

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _isRealtimeConnected = MutableStateFlow(false)
    val isRealtimeConnected: StateFlow<Boolean> = _isRealtimeConnected.asStateFlow()

    private val _isServerReachable = MutableStateFlow(true)
    val isServerReachable: StateFlow<Boolean> = _isServerReachable.asStateFlow()

    private val _connectionError = MutableStateFlow<String?>(null)
    val connectionError: StateFlow<String?> = _connectionError.asStateFlow()

    private val _selectedTournamentId = MutableStateFlow<Long?>(null)
    private var sseJob: Job? = null
    private var activeStreamHandle: Closeable? = null

    suspend fun initialize(scope: CoroutineScope): RepoResult<Unit> {
        val savedUrl = sessionPrefs.getServerBaseUrlOnce()
        if (!savedUrl.isNullOrBlank()) {
            apiService.setBaseUrl(savedUrl)
        }

        val sessionSnapshot = sessionPrefs.getSessionSnapshot()
        val savedToken = sessionPrefs.getAuthTokenOnce()
        if (sessionSnapshot.keepSignedIn && !savedToken.isNullOrBlank()) {
            apiService.setAuthToken(savedToken)
        } else {
            apiService.setAuthToken(null)
            sessionPrefs.clearRemoteAuthSession()
        }

        _selectedTournamentId.value = sessionPrefs.getSelectedTournamentIdOnce()
        _isSyncing.value = true

        val startupCheck = apiService.testStartupConnection()
        if (!startupCheck.isReachable) {
            _isServerReachable.value = false
            _connectionError.value = startupCheck.messageAr
            _isSyncing.value = false
            startRealtimeSync(scope)
            return RepoResult.Error(startupCheck.messageAr)
        }

        _isServerReachable.value = true
        _connectionError.value = null
        val stateRes = refreshState()
        startRealtimeSync(scope)
        return when (stateRes) {
            is RepoResult.Success -> RepoResult.Success(Unit)
            is RepoResult.Error -> RepoResult.Error(stateRes.messageAr)
        }
    }

    fun startRealtimeSync(scope: CoroutineScope) {
        sseJob?.cancel()
        runCatching { activeStreamHandle?.close() }
        sseJob = scope.launch(Dispatchers.IO) {
            var backoffMs = 2_000L
            while (isActive) {
                activeStreamHandle = apiService.openEventsStream(
                    onEvent = {
                        scope.launch {
                            refreshState()
                        }
                    },
                    onConnectionChanged = { connected ->
                        _isRealtimeConnected.value = connected
                        if (connected) {
                            backoffMs = 2_000L
                            _isServerReachable.value = true
                        }
                    }
                )
                if (!isActive) break
                delay(backoffMs)
                backoffMs = (backoffMs * 2L).coerceAtMost(15_000L)
            }
        }
    }

    fun stopRealtimeSync() {
        sseJob?.cancel()
        sseJob = null
        runCatching { activeStreamHandle?.close() }
        activeStreamHandle = null
        _isRealtimeConnected.value = false
    }

    suspend fun refreshState(overrideTournamentId: Long? = _selectedTournamentId.value): RepoResult<RemoteArenaState> {
        _isSyncing.value = true
        return when (val res = apiService.fetchArenaState(overrideTournamentId)) {
            is ApiResult.Success -> {
                val state = res.data
                _remoteState.value = state
                _isServerReachable.value = true
                _connectionError.value = null
                _isSyncing.value = false

                val activeId = state.tournament?.id
                if (activeId != null && activeId != _selectedTournamentId.value) {
                    _selectedTournamentId.value = activeId
                    sessionPrefs.setSelectedTournamentId(activeId)
                } else if (activeId == null && _selectedTournamentId.value != null) {
                    _selectedTournamentId.value = null
                    sessionPrefs.setSelectedTournamentId(null)
                }

                if (state.currentAdmin == null && apiService.getAuthToken() == null) {
                    sessionPrefs.clearRemoteAuthSession()
                }

                syncRemindersWithDeviceScheduler(state.matchReminders)
                RepoResult.Success(state)
            }
            is ApiResult.Error -> {
                _isSyncing.value = false
                _isServerReachable.value = false
                _connectionError.value = res.messageAr
                if (res.statusCode == 401) {
                    sessionPrefs.clearRemoteAuthSession()
                }
                RepoResult.Error(res.messageAr)
            }
        }
    }

    suspend fun selectTournament(tournamentId: Long?) {
        _selectedTournamentId.value = tournamentId
        sessionPrefs.setSelectedTournamentId(tournamentId)
        refreshState(tournamentId)
    }

    suspend fun testServerConnection(rawUrl: String): RepoResult<String> {
        val check = apiService.testStartupConnection(rawUrl)
        return if (check.isReachable) {
            RepoResult.Success(check.baseUrl, check.messageAr)
        } else {
            RepoResult.Error(check.messageAr)
        }
    }

    suspend fun updateServerBaseUrl(
        rawUrl: String,
        scope: CoroutineScope,
        verifyHealthFirst: Boolean = true
    ): RepoResult<String> {
        if (!ApiService.isValidHttpUrl(rawUrl)) {
            return RepoResult.Error("يرجى إدخال عنوان موقع صالح (مثل https://your-app.onrender.com).")
        }
        val normalized = ApiService.normalizeBaseUrl(rawUrl)
        if (verifyHealthFirst) {
            val healthCheck = apiService.testStartupConnection(normalized)
            if (!healthCheck.isReachable) {
                return RepoResult.Error(healthCheck.messageAr)
            }
        }

        val previousBaseUrl = apiService.getBaseUrl()
        val changed = !previousBaseUrl.equals(normalized, ignoreCase = true)
        apiService.setBaseUrl(normalized)
        sessionPrefs.setServerBaseUrl(normalized)

        if (changed) {
            // Token issued by previous server is not valid on a different host
            apiService.setAuthToken(null)
            sessionPrefs.clearRemoteAuthSession()
            _selectedTournamentId.value = null
            sessionPrefs.setSelectedTournamentId(null)
        }

        val startupCheck = apiService.testStartupConnection(normalized)
        if (!startupCheck.isReachable) {
            _isServerReachable.value = false
            _connectionError.value = startupCheck.messageAr
            startRealtimeSync(scope)
            return RepoResult.Success(normalized, "تم حفظ رابط الخادم ($normalized)، لكن تعذر الوصول إليه الآن: ${startupCheck.messageAr}")
        }

        startRealtimeSync(scope)
        val stateRes = refreshState(null)
        return if (stateRes is RepoResult.Success) {
            RepoResult.Success(normalized, "تم ربط التطبيق بالخادم المركزي ($normalized) بنجاح.")
        } else {
            RepoResult.Success(normalized, "تم حفظ رابط الخادم ($normalized)، جاري محاولة المزامنة...")
        }
    }

    suspend fun uploadPickedImage(uri: Uri): RepoResult<String> = withContext(Dispatchers.IO) {
        val dataUrl = compressUriToDataUrl(uri)
            ?: return@withContext RepoResult.Error("تعذر قراءة الصورة المختارة أو تحويلها.")
        when (val res = apiService.uploadImageDataUrl(dataUrl)) {
            is ApiResult.Success -> {
                val resolved = apiService.resolveMediaUrl(res.data) ?: res.data
                RepoResult.Success(resolved)
            }
            is ApiResult.Error -> RepoResult.Error(res.messageAr)
        }
    }

    suspend fun setupHeadAdmin(
        username: String,
        displayName: String,
        pin: String,
        keepSignedIn: Boolean
    ): RepoResult<AdminAccountEntity> {
        return when (val res = apiService.setupHeadAdmin(username, displayName, pin, keepSignedIn)) {
            is ApiResult.Success -> {
                sessionPrefs.saveRemoteAuthSession(
                    token = res.data.token,
                    adminId = res.data.admin.id,
                    username = res.data.admin.username,
                    role = res.data.admin.role.name,
                    keepSignedIn = keepSignedIn
                )
                refreshState()
                RepoResult.Success(res.data.admin, res.messageAr.ifBlank { "تم إعداد حساب المشرف الرئيسي على الخادم." })
            }
            is ApiResult.Error -> {
                refreshState()
                RepoResult.Error(res.messageAr)
            }
        }
    }

    suspend fun loginAdmin(
        username: String,
        pin: String,
        keepSignedIn: Boolean
    ): RepoResult<AdminAccountEntity> {
        return when (val res = apiService.loginAdmin(username, pin, keepSignedIn)) {
            is ApiResult.Success -> {
                sessionPrefs.saveRemoteAuthSession(
                    token = res.data.token,
                    adminId = res.data.admin.id,
                    username = res.data.admin.username,
                    role = res.data.admin.role.name,
                    keepSignedIn = keepSignedIn
                )
                refreshState()
                RepoResult.Success(res.data.admin, res.messageAr.ifBlank { "تم تسجيل الدخول بنجاح." })
            }
            is ApiResult.Error -> {
                refreshState()
                RepoResult.Error(res.messageAr)
            }
        }
    }

    suspend fun logoutAdmin() {
        apiService.logoutAdmin()
        sessionPrefs.clearRemoteAuthSession()
        refreshState()
    }

    suspend fun changeOwnPin(currentPin: String, newPin: String): RepoResult<Unit> {
        return executeAndRefresh { apiService.changeOwnPin(currentPin, newPin) }
    }

    suspend fun updateOwnProfile(displayName: String, username: String?): RepoResult<Unit> {
        return when (val res = apiService.updateOwnProfile(displayName, username)) {
            is ApiResult.Success -> {
                val updated = res.data
                val snapshot = sessionPrefs.getSessionSnapshot()
                sessionPrefs.saveRemoteAuthSession(
                    token = apiService.getAuthToken(),
                    adminId = updated.id,
                    username = updated.username,
                    role = updated.role.name,
                    keepSignedIn = snapshot.keepSignedIn
                )
                refreshState()
                RepoResult.Success(Unit, res.messageAr.ifBlank { "تم تحديث بيانات حساب المشرف بنجاح." })
            }
            is ApiResult.Error -> {
                if (res.statusCode == 401) {
                    sessionPrefs.clearRemoteAuthSession()
                    refreshState()
                }
                RepoResult.Error(res.messageAr)
            }
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
    ): RepoResult<Unit> = executeAndRefresh {
        apiService.createSubAdmin(
            username = username,
            displayName = displayName,
            pin = pin,
            canManageTournament = canManageTournament,
            canManagePlayers = canManagePlayers,
            canRunDraw = canRunDraw,
            canEditScores = canEditScores,
            canCrownChampion = canCrownChampion
        )
    }

    suspend fun updateSubAdminPermissions(
        target: AdminAccountEntity,
        displayName: String,
        newPin: String?,
        isActive: Boolean,
        canManageTournament: Boolean,
        canManagePlayers: Boolean,
        canRunDraw: Boolean,
        canEditScores: Boolean,
        canCrownChampion: Boolean
    ): RepoResult<Unit> = executeAndRefresh {
        apiService.updateSubAdmin(
            id = target.id,
            displayName = displayName,
            newPin = newPin,
            isActive = isActive,
            canManageTournament = canManageTournament,
            canManagePlayers = canManagePlayers,
            canRunDraw = canRunDraw,
            canEditScores = canEditScores,
            canCrownChampion = canCrownChampion
        )
    }

    suspend fun deleteSubAdmin(target: AdminAccountEntity): RepoResult<Unit> = executeAndRefresh {
        apiService.deleteSubAdmin(target.id)
    }

    suspend fun registerPlayer(
        tournamentId: Long,
        name: String,
        elysiumNetId: String,
        avatarUri: String?,
        level: PlayerLevel,
        clubName: String
    ): RepoResult<Unit> = executeAndRefresh {
        apiService.registerPlayer(
            tournamentId = tournamentId,
            name = name,
            elysiumNetId = elysiumNetId,
            avatarUrl = avatarUri,
            level = level,
            clubName = clubName
        )
    }

    suspend fun adminAddPlayer(
        tournamentId: Long,
        name: String,
        elysiumNetId: String,
        avatarUri: String?,
        level: PlayerLevel,
        ovrRating: Int,
        clubName: String,
        autoApprove: Boolean
    ): RepoResult<PlayerEntity> = executeAndRefresh {
        apiService.adminAddPlayer(
            tournamentId = tournamentId,
            name = name,
            elysiumNetId = elysiumNetId,
            avatarUrl = avatarUri,
            level = level,
            ovrRating = ovrRating,
            clubName = clubName,
            autoApprove = autoApprove
        )
    }

    suspend fun updatePlayerStatus(player: PlayerEntity, newStatus: PlayerStatus): RepoResult<Unit> =
        executeAndRefresh { apiService.updatePlayerStatus(player.id, newStatus) }

    suspend fun updatePlayerDetails(player: PlayerEntity): RepoResult<Unit> =
        executeAndRefresh { apiService.updatePlayerDetails(player) }

    suspend fun deletePlayer(player: PlayerEntity): RepoResult<Unit> =
        executeAndRefresh { apiService.deletePlayer(player.id) }

    suspend fun saveTournamentSettings(updated: TournamentEntity): RepoResult<Unit> =
        executeAndRefresh { apiService.updateTournament(updated) }

    suspend fun createFreshTournament(newTournament: TournamentEntity): RepoResult<Unit> {
        return when (val res = apiService.createTournament(newTournament)) {
            is ApiResult.Success -> {
                val createdId = res.data
                if (createdId != null) {
                    _selectedTournamentId.value = createdId
                    sessionPrefs.setSelectedTournamentId(createdId)
                    refreshState(createdId)
                } else {
                    refreshState()
                }
                RepoResult.Success(Unit, res.messageAr.ifBlank { "تم إنشاء البطولة الجديدة بنجاح." })
            }
            is ApiResult.Error -> RepoResult.Error(res.messageAr)
        }
    }

    suspend fun deleteCurrentTournament(tournamentId: Long): RepoResult<Unit> {
        return when (val res = apiService.deleteTournament(tournamentId)) {
            is ApiResult.Success -> {
                _selectedTournamentId.value = null
                sessionPrefs.setSelectedTournamentId(null)
                refreshState(null)
                RepoResult.Success(Unit, res.messageAr.ifBlank { "تم حذف البطولة نهائياً بنجاح." })
            }
            is ApiResult.Error -> RepoResult.Error(res.messageAr)
        }
    }

    suspend fun runDraw(
        tournamentId: Long,
        manualGroupAssignments: Map<Long, Int> = emptyMap(),
        manualKnockoutOrder: List<Long> = emptyList()
    ): RepoResult<Unit> = executeAndRefresh {
        apiService.runDraw(tournamentId, manualGroupAssignments, manualKnockoutOrder)
    }

    suspend fun generateKnockoutFromStandings(tournamentId: Long): RepoResult<Unit> =
        executeAndRefresh { apiService.generateKnockoutFromStandings(tournamentId) }

    suspend fun updateMatchScore(
        match: MatchEntity,
        leg1S1: Int?,
        leg1S2: Int?,
        leg2S1: Int?,
        leg2S2: Int?,
        pen1: Int?,
        pen2: Int?
    ): RepoResult<Unit> = executeAndRefresh {
        apiService.updateMatchScore(match.id, leg1S1, leg1S2, leg2S1, leg2S2, pen1, pen2)
    }

    suspend fun updateKnockoutMatchWinner(match: MatchEntity, winnerPlayerId: Long?): RepoResult<Unit> =
        executeAndRefresh { apiService.updateKnockoutWinner(match.id, winnerPlayerId) }

    suspend fun crownChampion(tournamentId: Long, playerId: Long?): RepoResult<Unit> =
        executeAndRefresh { apiService.crownChampion(tournamentId, playerId) }

    suspend fun scheduleMatchReminder(
        match: MatchEntity,
        matchTitle: String,
        scheduledAtMillis: Long,
        leadMinutes: Int
    ): RepoResult<MatchReminderEntity> {
        return when (val res = apiService.scheduleReminder(match.id, matchTitle, scheduledAtMillis, leadMinutes)) {
            is ApiResult.Success -> {
                MatchReminderScheduler.scheduleReminder(context, res.data)
                refreshState()
                RepoResult.Success(res.data, res.messageAr.ifBlank { "تم جدولة التنبيه للمباراة على الخادم بنجاح." })
            }
            is ApiResult.Error -> RepoResult.Error(res.messageAr)
        }
    }

    suspend fun cancelMatchReminder(matchId: Long): RepoResult<Unit> {
        MatchReminderScheduler.cancelReminder(context, matchId)
        return executeAndRefresh { apiService.cancelReminder(matchId) }
    }

    fun sendTestMatchNotification(
        match: MatchEntity,
        matchTitle: String,
        scheduledAtMillis: Long,
        leadMinutes: Int
    ): RepoResult<Unit> {
        val preview = MatchReminderEntity(
            matchId = match.id,
            tournamentId = match.tournamentId,
            matchTitle = matchTitle,
            matchStageLabel = match.stage.labelAr,
            scheduledAtMillis = scheduledAtMillis,
            remindAtMillis = System.currentTimeMillis(),
            leadMinutes = leadMinutes
        )
        val shown = MatchReminderScheduler.showMatchNotification(
            context = context,
            matchId = match.id,
            title = "⏰ تذكير بمباراة قادمة: $matchTitle",
            body = MatchReminderScheduler.buildNotificationBody(preview),
            stageLabel = match.stage.labelAr
        )
        return if (shown) {
            RepoResult.Success(Unit, "تم إرسال إشعار التذكير التجريبي الآن.")
        } else {
            RepoResult.Error("يرجى تفعيل إذن الإشعارات أولاً لعرض التنبيهات.")
        }
    }

    suspend fun getCurrentSessionState(): AdminSessionState = sessionPrefs.getSessionSnapshot()

    private suspend fun <T> executeAndRefresh(block: suspend () -> ApiResult<T>): RepoResult<T> {
        return when (val res = block()) {
            is ApiResult.Success -> {
                refreshState()
                RepoResult.Success(res.data, res.messageAr)
            }
            is ApiResult.Error -> {
                if (res.statusCode == 401) {
                    sessionPrefs.clearRemoteAuthSession()
                    refreshState()
                }
                RepoResult.Error(res.messageAr)
            }
        }
    }

    private fun syncRemindersWithDeviceScheduler(reminders: List<MatchReminderEntity>) {
        val now = System.currentTimeMillis()
        reminders
            .filter { it.isEnabled && !it.isDelivered && it.remindAtMillis > now }
            .forEach { MatchReminderScheduler.scheduleReminder(context, it) }
    }

    private fun compressUriToDataUrl(uri: Uri): String? {
        return try {
            val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
            val rawBytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
            val decoded = BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size) ?: return null
            val maxDim = 900
            val largest = max(decoded.width, decoded.height)
            val scaled = if (largest > maxDim && largest > 0) {
                val ratio = maxDim.toFloat() / largest.toFloat()
                Bitmap.createScaledBitmap(
                    decoded,
                    max(1, (decoded.width * ratio).roundToInt()),
                    max(1, (decoded.height * ratio).roundToInt()),
                    true
                )
            } else {
                decoded
            }
            val out = ByteArrayOutputStream()
            val isPng = mimeType.equals("image/png", ignoreCase = true)
            val format = if (isPng) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG
            val quality = if (isPng) 100 else 86
            scaled.compress(format, quality, out)
            if (scaled !== decoded) scaled.recycle()
            decoded.recycle()
            val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
            val outMime = if (isPng) "image/png" else "image/jpeg"
            "data:$outMime;base64,$b64"
        } catch (_: Exception) {
            null
        }
    }
}
