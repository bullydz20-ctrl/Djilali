package com.example.ui.viewmodel

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.api.ApiService
import com.example.api.AuditLogEntry
import com.example.api.DiscordGuildMemberDto
import com.example.api.DiscordStatusDto
import com.example.api.HallOfFameEntry
import com.example.api.PersistenceInfo
import com.example.api.PlayerProfileDto
import com.example.api.RaceEntry
import com.example.api.RaceResultDraft
import com.example.api.RacingStandingRow
import com.example.api.RemoteArenaState
import com.example.api.SeasonLeaderboardEntry
import com.example.data.local.AdminAccountEntity
import com.example.data.local.AdminSessionState
import com.example.data.local.LockoutState
import com.example.data.local.MatchEntity
import com.example.data.local.MatchReminderEntity
import com.example.data.local.PlayerEntity
import com.example.data.local.SessionPreferences
import com.example.data.local.TournamentEntity
import com.example.data.model.AdminRole
import com.example.data.model.PlayerLevel
import com.example.data.model.PlayerStatus
import com.example.data.model.RaceStage
import com.example.data.repository.RemoteArenaRepository
import com.example.data.repository.RepoResult
import com.example.domain.GroupStandingRow
import com.example.domain.PlayerStats
import com.example.domain.TournamentOverviewStats
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class GroupWithStandings(
    val group: com.example.data.local.TournamentGroupEntity,
    val standings: List<GroupStandingRow>,
    val matches: List<MatchEntity>
)

data class TournamentUiState(
    val isLoaded: Boolean = false,
    val hasServerState: Boolean = false,
    val tournaments: List<TournamentEntity> = emptyList(),
    val tournament: TournamentEntity? = null,
    val players: List<PlayerEntity> = emptyList(),
    val approvedPlayers: List<PlayerEntity> = emptyList(),
    val pendingPlayers: List<PlayerEntity> = emptyList(),
    val rejectedPlayers: List<PlayerEntity> = emptyList(),
    val groupsWithStandings: List<GroupWithStandings> = emptyList(),
    val leagueStandings: List<GroupStandingRow> = emptyList(),
    val leagueMatches: List<MatchEntity> = emptyList(),
    val knockoutMatches: List<MatchEntity> = emptyList(),
    val allMatches: List<MatchEntity> = emptyList(),
    val races: List<RaceEntry> = emptyList(),
    val racingStandings: List<RacingStandingRow> = emptyList(),
    val matchReminders: List<MatchReminderEntity> = emptyList(),
    val playerStats: List<PlayerStats> = emptyList(),
    val overviewStats: TournamentOverviewStats = TournamentOverviewStats(0, 0, 0, null, null, null),
    val championPlayer: PlayerEntity? = null,
    val seasonLeaderboard: List<SeasonLeaderboardEntry> = emptyList(),
    val hallOfFame: List<HallOfFameEntry> = emptyList(),
    val auditLogs: List<AuditLogEntry> = emptyList(),
    val admins: List<AdminAccountEntity> = emptyList(),
    val hasHeadAdmin: Boolean = false,
    val currentAdmin: AdminAccountEntity? = null,
    val sessionState: AdminSessionState = AdminSessionState(),
    val lockoutState: LockoutState = LockoutState(),
    val isRegistrationOpenNow: Boolean = false,
    val serverBaseUrl: String = ApiService.DEFAULT_BASE_URL,
    val isSyncing: Boolean = false,
    val isRealtimeConnected: Boolean = false,
    val isServerReachable: Boolean = true,
    val connectionError: String? = null,
    val persistence: PersistenceInfo? = null,
    val playerProfiles: List<PlayerProfileDto> = emptyList(),
    val discordStatus: DiscordStatusDto = DiscordStatusDto(),
    val discordGuildMembers: List<DiscordGuildMemberDto> = emptyList(),
    val guildMembersLoading: Boolean = false,
    val guildMembersError: String? = null
)

class TournamentViewModel(application: Application) : AndroidViewModel(application) {

    private val sessionPrefs = SessionPreferences(application)
    private val apiService = ApiService(
        onUnauthorized = {
            viewModelScope.launch {
                sessionPrefs.clearRemoteAuthSession()
            }
        }
    )
    private val repository = RemoteArenaRepository(
        context = application,
        sessionPrefs = sessionPrefs,
        apiService = apiService
    )

    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val messages = _messages.asSharedFlow()

    init {
        viewModelScope.launch {
            val initRes = repository.initialize(viewModelScope)
            if (initRes is RepoResult.Error) {
                _messages.tryEmit(initRes.messageAr)
            }
        }
    }

    private data class SyncMeta(
        val baseUrl: String,
        val isSyncing: Boolean,
        val isRealtimeConnected: Boolean,
        val isServerReachable: Boolean,
        val connectionError: String?
    )

    private val syncMetaFlow = combine(
        repository.serverBaseUrl,
        repository.isSyncing,
        repository.isRealtimeConnected,
        repository.isServerReachable,
        repository.connectionError
    ) { baseUrl, syncing, sseConnected, reachable, connErr ->
        SyncMeta(baseUrl, syncing, sseConnected, reachable, connErr)
    }

    private val _discordGuildMembers = MutableStateFlow<List<DiscordGuildMemberDto>>(emptyList())
    private val _guildMembersLoading = MutableStateFlow(false)
    private val _guildMembersError = MutableStateFlow<String?>(null)

    private data class DiscordMembersUiState(
        val members: List<DiscordGuildMemberDto>,
        val loading: Boolean,
        val error: String?
    )

    private val discordMembersFlow = combine(
        _discordGuildMembers,
        _guildMembersLoading,
        _guildMembersError
    ) { members, loading, error ->
        DiscordMembersUiState(members, loading, error)
    }

    val uiState: StateFlow<TournamentUiState> = combine(
        repository.remoteState,
        sessionPrefs.sessionState,
        syncMetaFlow,
        discordMembersFlow
    ) { remote: RemoteArenaState?, session: AdminSessionState, meta: SyncMeta, discordMembers: DiscordMembersUiState ->
        if (remote == null) {
            TournamentUiState(
                isLoaded = !meta.isSyncing && meta.connectionError != null,
                hasServerState = false,
                sessionState = session,
                serverBaseUrl = meta.baseUrl,
                isSyncing = meta.isSyncing,
                isRealtimeConnected = meta.isRealtimeConnected,
                isServerReachable = meta.isServerReachable,
                connectionError = meta.connectionError,
                discordGuildMembers = discordMembers.members,
                guildMembersLoading = discordMembers.loading,
                guildMembersError = discordMembers.error
            )
        } else {
            val adminList = if (remote.currentAdmin?.role == AdminRole.HEAD_ADMIN && remote.adminAccounts.isNotEmpty()) {
                remote.adminAccounts
            } else {
                remote.adminDirectory
            }
            TournamentUiState(
                isLoaded = true,
                hasServerState = true,
                tournaments = remote.tournaments,
                tournament = remote.tournament,
                players = remote.players,
                approvedPlayers = remote.approvedPlayers,
                pendingPlayers = remote.pendingPlayers,
                rejectedPlayers = remote.rejectedPlayers,
                groupsWithStandings = remote.groupsWithStandings,
                leagueStandings = remote.leagueStandings,
                leagueMatches = remote.leagueMatches,
                knockoutMatches = remote.knockoutMatches,
                allMatches = remote.allMatches,
                races = remote.races,
                racingStandings = remote.racingStandings,
                matchReminders = remote.matchReminders,
                playerStats = remote.playerStats,
                overviewStats = remote.overviewStats,
                championPlayer = remote.championPlayer,
                seasonLeaderboard = remote.seasonLeaderboard,
                hallOfFame = remote.hallOfFame,
                auditLogs = remote.auditLogs,
                admins = adminList,
                hasHeadAdmin = remote.hasHeadAdmin,
                currentAdmin = remote.currentAdmin,
                sessionState = session.copy(
                    loggedInAdminId = remote.currentAdmin?.id,
                    loggedInUsername = remote.currentAdmin?.username,
                    loggedInRole = remote.currentAdmin?.role?.name,
                    keepSignedIn = remote.keepSignedIn
                ),
                lockoutState = remote.lockoutState,
                isRegistrationOpenNow = remote.isRegistrationOpenNow,
                serverBaseUrl = meta.baseUrl,
                isSyncing = meta.isSyncing,
                isRealtimeConnected = meta.isRealtimeConnected,
                isServerReachable = meta.isServerReachable,
                connectionError = meta.connectionError,
                persistence = remote.persistence,
                playerProfiles = remote.playerProfiles,
                discordStatus = remote.discordStatus,
                discordGuildMembers = discordMembers.members,
                guildMembersLoading = discordMembers.loading,
                guildMembersError = discordMembers.error
            )
        }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = TournamentUiState()
    )

    override fun onCleared() {
        repository.stopRealtimeSync()
        super.onCleared()
    }

    private fun <T> handleResult(res: RepoResult<T>) {
        when (res) {
            is RepoResult.Success -> if (res.messageAr.isNotEmpty()) _messages.tryEmit(res.messageAr)
            is RepoResult.Error -> _messages.tryEmit(res.messageAr)
        }
    }

    fun refreshFromServer() {
        viewModelScope.launch {
            val res = repository.refreshState()
            if (res is RepoResult.Error) {
                _messages.tryEmit(res.messageAr)
            }
        }
    }

    fun testServerConnection(url: String, onDone: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            when (val res = repository.testServerConnection(url)) {
                is RepoResult.Success -> onDone(true, res.messageAr)
                is RepoResult.Error -> onDone(false, res.messageAr)
            }
        }
    }

    fun updateServerBaseUrl(url: String, verifyHealthFirst: Boolean = true, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            val res = repository.updateServerBaseUrl(url, viewModelScope, verifyHealthFirst)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun importImageFromPicker(uri: Uri, @Suppress("UNUSED_PARAMETER") prefix: String, onSaved: (String) -> Unit) {
        viewModelScope.launch {
            when (val res = repository.uploadPickedImage(uri)) {
                is RepoResult.Success -> onSaved(res.data)
                is RepoResult.Error -> _messages.tryEmit(res.messageAr)
            }
        }
    }

    fun setupHeadAdmin(username: String, displayName: String, pin: String, keepSignedIn: Boolean = true) {
        viewModelScope.launch {
            handleResult(repository.setupHeadAdmin(username, displayName, pin, keepSignedIn))
        }
    }

    fun loginAdmin(username: String, pin: String, keepSignedIn: Boolean = true) {
        viewModelScope.launch {
            handleResult(repository.loginAdmin(username, pin, keepSignedIn))
        }
    }

    fun logoutAdmin() {
        viewModelScope.launch {
            repository.logoutAdmin()
            _messages.tryEmit("تم تسجيل الخروج من لوحة المشرف.")
        }
    }

    fun createSubAdmin(
        username: String,
        displayName: String,
        pin: String,
        canManageTournament: Boolean,
        canManagePlayers: Boolean,
        canRunDraw: Boolean,
        canEditScores: Boolean,
        canCrownChampion: Boolean
    ) {
        viewModelScope.launch {
            handleResult(
                repository.createSubAdmin(
                    username, displayName, pin,
                    canManageTournament, canManagePlayers, canRunDraw, canEditScores, canCrownChampion
                )
            )
        }
    }

    fun changeOwnPin(currentPin: String, newPin: String) {
        viewModelScope.launch {
            handleResult(repository.changeOwnPin(currentPin, newPin))
        }
    }

    fun updateOwnProfile(displayName: String, username: String?, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            val res = repository.updateOwnProfile(displayName, username)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun updateSubAdmin(
        target: AdminAccountEntity,
        displayName: String = target.displayName,
        newPin: String?,
        isActive: Boolean,
        canManageTournament: Boolean,
        canManagePlayers: Boolean,
        canRunDraw: Boolean,
        canEditScores: Boolean,
        canCrownChampion: Boolean
    ) {
        viewModelScope.launch {
            handleResult(
                repository.updateSubAdminPermissions(
                    target, displayName, newPin, isActive,
                    canManageTournament, canManagePlayers, canRunDraw, canEditScores, canCrownChampion
                )
            )
        }
    }

    fun deleteSubAdmin(target: AdminAccountEntity) {
        viewModelScope.launch {
            handleResult(repository.deleteSubAdmin(target))
        }
    }

    fun registerPlayer(
        name: String,
        elysiumNetId: String,
        avatarUri: String?,
        level: PlayerLevel,
        clubName: String,
        onSuccess: () -> Unit = {}
    ) {
        val tId = uiState.value.tournament?.id ?: return
        viewModelScope.launch {
            val res = repository.registerPlayer(tId, name, elysiumNetId, avatarUri, level, clubName)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun adminAddPlayer(
        name: String,
        elysiumNetId: String,
        avatarUri: String?,
        level: PlayerLevel,
        ovrRating: Int,
        clubName: String,
        autoApprove: Boolean,
        profileId: Long? = null,
        xeMoNetId: String = "",
        discordUserId: String? = null,
        onSuccess: () -> Unit = {}
    ) {
        val tId = uiState.value.tournament?.id ?: return
        viewModelScope.launch {
            val res = repository.adminAddPlayer(
                tournamentId = tId,
                name = name,
                elysiumNetId = elysiumNetId,
                avatarUri = avatarUri,
                level = level,
                ovrRating = ovrRating,
                clubName = clubName,
                autoApprove = autoApprove,
                profileId = profileId,
                xeMoNetId = xeMoNetId,
                discordUserId = discordUserId
            )
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun startDiscordOAuth(onUrlReady: (String) -> Unit) {
        viewModelScope.launch {
            when (val res = repository.fetchDiscordOAuthStartUrl()) {
                is RepoResult.Success -> onUrlReady(res.data)
                is RepoResult.Error -> _messages.tryEmit(res.messageAr)
            }
        }
    }

    fun loadDiscordGuildMembers() {
        viewModelScope.launch {
            _guildMembersLoading.value = true
            _guildMembersError.value = null
            when (val res = repository.fetchDiscordGuildMembers()) {
                is RepoResult.Success -> {
                    _discordGuildMembers.value = res.data
                    _guildMembersError.value = null
                }
                is RepoResult.Error -> {
                    _guildMembersError.value = res.messageAr
                }
            }
            _guildMembersLoading.value = false
        }
    }

    fun createPlayerProfile(
        name: String,
        avatarUri: String?,
        elysiumNetId: String,
        xeMoNetId: String,
        discordUserId: String?,
        onSuccess: (PlayerProfileDto) -> Unit = {},
        onDuplicateDiscordId: (PlayerProfileDto) -> Unit = {},
        onError: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            when (val res = repository.createPlayerProfile(name, avatarUri, elysiumNetId, xeMoNetId, discordUserId)) {
                is RepoResult.Success -> {
                    if (res.messageAr.isNotEmpty()) _messages.tryEmit(res.messageAr)
                    onSuccess(res.data)
                }
                is RepoResult.Error -> {
                    val existing = res.existingProfile
                    if (res.code == "DUPLICATE_DISCORD_ID" && existing != null) {
                        onDuplicateDiscordId(existing)
                    } else {
                        onError(res.messageAr)
                        _messages.tryEmit(res.messageAr)
                    }
                }
            }
        }
    }

    fun updatePlayerProfile(
        id: Long,
        name: String,
        avatarUri: String?,
        elysiumNetId: String,
        xeMoNetId: String,
        discordUserId: String?,
        onSuccess: (PlayerProfileDto) -> Unit = {},
        onDuplicateDiscordId: (PlayerProfileDto) -> Unit = {},
        onError: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            when (val res = repository.updatePlayerProfile(id, name, avatarUri, elysiumNetId, xeMoNetId, discordUserId)) {
                is RepoResult.Success -> {
                    if (res.messageAr.isNotEmpty()) _messages.tryEmit(res.messageAr)
                    onSuccess(res.data)
                }
                is RepoResult.Error -> {
                    val existing = res.existingProfile
                    if (res.code == "DUPLICATE_DISCORD_ID" && existing != null) {
                        onDuplicateDiscordId(existing)
                    } else {
                        onError(res.messageAr)
                        _messages.tryEmit(res.messageAr)
                    }
                }
            }
        }
    }

    fun mergePlayerProfiles(
        sourceProfileId: Long,
        targetProfileId: Long,
        confirmIdentity: Boolean,
        onSuccess: (PlayerProfileDto) -> Unit = {},
        onError: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            when (val res = repository.mergePlayerProfiles(sourceProfileId, targetProfileId, confirmIdentity)) {
                is RepoResult.Success -> {
                    if (res.messageAr.isNotEmpty()) _messages.tryEmit(res.messageAr)
                    onSuccess(res.data)
                }
                is RepoResult.Error -> {
                    onError(res.messageAr)
                    _messages.tryEmit(res.messageAr)
                }
            }
        }
    }

    fun updatePlayerStatus(player: PlayerEntity, status: PlayerStatus) {
        viewModelScope.launch {
            handleResult(repository.updatePlayerStatus(player, status))
        }
    }

    fun updatePlayerDetails(player: PlayerEntity) {
        viewModelScope.launch {
            handleResult(repository.updatePlayerDetails(player))
        }
    }

    fun deletePlayer(player: PlayerEntity) {
        viewModelScope.launch {
            handleResult(repository.deletePlayer(player))
        }
    }

    fun saveTournamentSettings(updated: TournamentEntity) {
        viewModelScope.launch {
            handleResult(repository.saveTournamentSettings(updated))
        }
    }

    fun createFreshTournament(newTournament: TournamentEntity) {
        viewModelScope.launch {
            handleResult(repository.createFreshTournament(newTournament))
        }
    }

    fun selectTournament(tournamentId: Long) {
        viewModelScope.launch {
            repository.selectTournament(tournamentId)
        }
    }

    fun deleteCurrentTournament() {
        val id = uiState.value.tournament?.id ?: return
        viewModelScope.launch {
            handleResult(repository.deleteCurrentTournament(id))
        }
    }

    fun runDraw(
        manualGroupAssignments: Map<Long, Int> = emptyMap(),
        manualKnockoutOrder: List<Long> = emptyList()
    ) {
        val id = uiState.value.tournament?.id ?: return
        viewModelScope.launch {
            handleResult(repository.runDraw(id, manualGroupAssignments, manualKnockoutOrder))
        }
    }

    fun generateKnockoutFromStandings() {
        val id = uiState.value.tournament?.id ?: return
        viewModelScope.launch {
            handleResult(repository.generateKnockoutFromStandings(id))
        }
    }

    fun updateMatchScore(
        match: MatchEntity,
        leg1S1: Int?,
        leg1S2: Int?,
        leg2S1: Int?,
        leg2S2: Int?,
        pen1: Int?,
        pen2: Int?,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            val res = repository.updateMatchScore(match, leg1S1, leg1S2, leg2S1, leg2S2, pen1, pen2)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun updateKnockoutMatchWinner(
        match: MatchEntity,
        winnerPlayerId: Long?,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            val res = repository.updateKnockoutMatchWinner(match, winnerPlayerId)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun crownChampion(playerId: Long?) {
        val id = uiState.value.tournament?.id ?: return
        viewModelScope.launch {
            handleResult(repository.crownChampion(id, playerId))
        }
    }

    fun createRace(
        title: String = "",
        stage: RaceStage = RaceStage.REGULAR,
        trackName: String = "",
        onSuccess: () -> Unit = {}
    ) {
        val id = uiState.value.tournament?.id ?: return
        viewModelScope.launch {
            val res = repository.createRace(
                tournamentId = id,
                title = title.ifBlank { null },
                stage = stage,
                trackName = trackName.ifBlank { null }
            )
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun saveRaceResults(
        raceId: Long,
        entries: List<RaceResultDraft>,
        title: String? = null,
        trackName: String? = null,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            val res = repository.saveRaceResults(raceId, entries, title, trackName)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun generateFinalRaceFromStandings(
        qualifiersCount: Int? = null,
        title: String? = null,
        trackName: String? = null,
        onSuccess: () -> Unit = {}
    ) {
        val id = uiState.value.tournament?.id ?: return
        viewModelScope.launch {
            val res = repository.generateFinalRaceFromStandings(id, qualifiersCount, title, trackName)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun deleteRace(raceId: Long) {
        viewModelScope.launch {
            handleResult(repository.deleteRace(raceId))
        }
    }

    fun scheduleMatchReminder(
        match: MatchEntity,
        matchTitle: String,
        scheduledAtMillis: Long,
        leadMinutes: Int,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            val res = repository.scheduleMatchReminder(match, matchTitle, scheduledAtMillis, leadMinutes)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun cancelMatchReminder(matchId: Long) {
        viewModelScope.launch {
            handleResult(repository.cancelMatchReminder(matchId))
        }
    }

    fun sendTestMatchNotification(
        match: MatchEntity,
        matchTitle: String,
        scheduledAtMillis: Long,
        leadMinutes: Int
    ) {
        handleResult(repository.sendTestMatchNotification(match, matchTitle, scheduledAtMillis, leadMinutes))
    }

    fun notifyNotificationPermissionDenied() {
        _messages.tryEmit("يرجى السماح بإذن الإشعارات لتفعيل تنبيهات المباريات القادمة.")
    }

    fun toggleMatchCheckIn(matchId: Long, playerSlot: Int, checkedIn: Boolean? = null) {
        viewModelScope.launch {
            handleResult(repository.toggleMatchCheckIn(matchId, playerSlot, checkedIn))
        }
    }

    fun voteMatchPrediction(matchId: Long, pickedSlot: Int) {
        viewModelScope.launch {
            handleResult(repository.voteMatchPrediction(matchId, pickedSlot))
        }
    }

    fun submitMatchDispute(
        matchId: Long,
        submittedBy: String,
        note: String,
        screenshotUrl: String?,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            val res = repository.submitMatchDispute(matchId, submittedBy, note, screenshotUrl)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun resolveMatchDispute(
        matchId: Long,
        resolutionNote: String? = null,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            val res = repository.resolveMatchDispute(matchId, resolutionNote)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun adminWalkoverMatch(
        matchId: Long,
        winnerSlot: Int,
        reason: String? = null,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            val res = repository.adminWalkoverMatch(matchId, winnerSlot, reason)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun bulkImportPlayers(
        linesText: String,
        status: PlayerStatus = PlayerStatus.APPROVED,
        onSuccess: () -> Unit = {}
    ) {
        val tId = uiState.value.tournament?.id ?: return
        viewModelScope.launch {
            val res = repository.bulkImportPlayers(tId, linesText, status)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }

    fun autoScheduleMatches(
        startAtMillis: Long,
        intervalMinutes: Int,
        onlyUnscheduled: Boolean = true,
        onSuccess: () -> Unit = {}
    ) {
        val tId = uiState.value.tournament?.id ?: return
        viewModelScope.launch {
            val res = repository.autoScheduleMatches(tId, startAtMillis, intervalMinutes, onlyUnscheduled)
            handleResult(res)
            if (res is RepoResult.Success) onSuccess()
        }
    }
}
