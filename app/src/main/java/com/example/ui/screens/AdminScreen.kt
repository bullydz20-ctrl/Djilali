package com.example.ui.screens

import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.ManageAccounts
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.SportsScore
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.example.api.PlayerProfileDto
import com.example.api.RaceEntry
import com.example.data.local.AdminAccountEntity
import com.example.data.local.MatchEntity
import com.example.data.local.PlayerEntity
import com.example.data.local.TournamentEntity
import com.example.data.model.AdminRole
import com.example.data.model.PlayerLevel
import com.example.data.model.PlayerStatus
import com.example.data.model.RaceStage
import com.example.security.AdminPermission
import com.example.security.PinSecurityManager
import com.example.security.hasPermission
import com.example.ui.components.EmptyStatePanel
import com.example.ui.components.SixDigitPinInputField
import com.example.ui.theme.AmberDraw
import com.example.ui.theme.CardBorder
import com.example.ui.theme.ChampionshipGold
import com.example.ui.theme.CrimsonLoss
import com.example.ui.theme.CyberSky
import com.example.ui.theme.ElectricCobalt
import com.example.ui.theme.EmeraldWin
import com.example.ui.theme.MidnightSurface
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary
import com.example.ui.viewmodel.TournamentUiState

private enum class AdminSection(val titleAr: String, val icon: ImageVector) {
    TOURNAMENT("البطولة", Icons.Default.Settings),
    PLAYERS("المشاركون", Icons.Default.Groups),
    DRAW("القرعة", Icons.Default.Casino),
    MATCHES("المباريات", Icons.Default.SportsScore),
    SUB_ADMINS("المشرفون", Icons.Default.ManageAccounts),
    CHAMPION("التتويج", Icons.Default.EmojiEvents),
    AUDIT("السجل", Icons.Default.History)
}

@Composable
fun AdminScreen(
    uiState: TournamentUiState,
    onSetupHeadAdmin: (String, String, String, Boolean) -> Unit,
    onLogin: (String, String, Boolean) -> Unit,
    onLogout: () -> Unit,
    onImportBanner: (Uri, (String) -> Unit) -> Unit,
    onImportAvatar: (Uri, (String) -> Unit) -> Unit = { _, _ -> },
    onSaveTournament: (TournamentEntity) -> Unit,
    onCreateFreshTournament: (TournamentEntity) -> Unit,
    onDeleteTournament: () -> Unit,
    onAdminAddPlayer: (String, String, String?, PlayerLevel, Int, String, Boolean, () -> Unit) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onAdminAddPlayerWithProfile: (String, String, String?, PlayerLevel, Int, String, Boolean, Long?, String, String?, () -> Unit) -> Unit = { name, elysium, avatar, level, ovr, club, autoApprove, _, _, _, cb ->
        onAdminAddPlayer(name, elysium, avatar, level, ovr, club, autoApprove, cb)
    },
    onBulkImport: (String, PlayerStatus, () -> Unit) -> Unit = { _, _, _ -> },
    onUpdatePlayerStatus: (PlayerEntity, PlayerStatus) -> Unit,
    onUpdatePlayerDetails: (PlayerEntity) -> Unit,
    onDeletePlayer: (PlayerEntity) -> Unit,
    onStartDiscordOAuth: () -> Unit = {},
    onLoadDiscordGuildMembers: () -> Unit = {},
    onCreatePlayerProfile: (
        name: String,
        avatarUri: String?,
        elysiumNetId: String,
        xeMoNetId: String,
        discordUserId: String?,
        onSuccess: (PlayerProfileDto) -> Unit,
        onDuplicate: (PlayerProfileDto) -> Unit,
        onError: (String) -> Unit
    ) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onUpdatePlayerProfile: (
        id: Long,
        name: String,
        avatarUri: String?,
        elysiumNetId: String,
        xeMoNetId: String,
        discordUserId: String?,
        onSuccess: (PlayerProfileDto) -> Unit,
        onDuplicate: (PlayerProfileDto) -> Unit,
        onError: (String) -> Unit
    ) -> Unit = { _, _, _, _, _, _, _, _, _ -> },
    onMergePlayerProfiles: (
        sourceId: Long,
        targetId: Long,
        confirmIdentity: Boolean,
        onSuccess: (PlayerProfileDto) -> Unit,
        onError: (String) -> Unit
    ) -> Unit = { _, _, _, _, _ -> },
    onRunDraw: (Map<Long, Int>, List<Long>) -> Unit,
    onGenerateKnockoutFromStandings: () -> Unit,
    onEditMatch: (MatchEntity) -> Unit,
    onQuickUpdateGoals: (MatchEntity, Int, Int) -> Unit = { _, _, _ -> },
    onAutoSchedule: (Long, Int, Boolean, () -> Unit) -> Unit = { _, _, _, _ -> },
    onToggleCheckIn: (MatchEntity, Int) -> Unit = { _, _ -> },
    onOpenDispute: ((MatchEntity) -> Unit)? = null,
    onOpenReminder: ((MatchEntity) -> Unit)? = null,
    onPlayerClick: ((PlayerEntity) -> Unit)? = null,
    onUpdateOwnProfile: (String, String?, () -> Unit) -> Unit = { _, _, _ -> },
    onChangeOwnPin: (String, String) -> Unit,
    onCreateSubAdmin: (String, String, String, Boolean, Boolean, Boolean, Boolean, Boolean) -> Unit,
    onUpdateSubAdmin: (AdminAccountEntity, String, String?, Boolean, Boolean, Boolean, Boolean, Boolean, Boolean) -> Unit,
    onDeleteSubAdmin: (AdminAccountEntity) -> Unit,
    onCrownChampion: (Long?) -> Unit,
    onOpenExportShare: () -> Unit = {},
    onRetryConnection: () -> Unit = {},
    onConfigureServerUrl: () -> Unit = {},
    onCreateRace: (String, RaceStage, String) -> Unit = { _, _, _ -> },
    onEditRaceResults: (RaceEntry) -> Unit = {},
    onGenerateFinalRace: () -> Unit = {},
    onDeleteRace: (Long) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val currentAdmin = uiState.currentAdmin
    if (currentAdmin == null) {
        if (!uiState.hasServerState) {
            AdminServerSyncPendingPanel(
                isSyncing = uiState.isSyncing || !uiState.isLoaded,
                isServerReachable = uiState.isServerReachable,
                connectionError = uiState.connectionError,
                serverBaseUrl = uiState.serverBaseUrl,
                onRetryConnection = onRetryConnection,
                onConfigureServerUrl = onConfigureServerUrl,
                modifier = modifier
            )
            return
        }
        AdminAuthGate(
            hasHeadAdmin = uiState.hasHeadAdmin,
            admins = uiState.admins,
            lockoutState = uiState.lockoutState,
            onSetupHeadAdmin = onSetupHeadAdmin,
            onLogin = onLogin,
            defaultUsername = uiState.sessionState.lastUsername,
            defaultKeepSignedIn = uiState.sessionState.keepSignedIn,
            persistence = uiState.persistence,
            modifier = modifier
        )
        return
    }

    val allowedSections = remember(currentAdmin) {
        buildList {
            if (currentAdmin.hasPermission(AdminPermission.MANAGE_TOURNAMENT)) add(AdminSection.TOURNAMENT)
            if (currentAdmin.hasPermission(AdminPermission.MANAGE_PLAYERS)) add(AdminSection.PLAYERS)
            if (currentAdmin.hasPermission(AdminPermission.RUN_DRAW)) add(AdminSection.DRAW)
            if (currentAdmin.hasPermission(AdminPermission.EDIT_SCORES)) add(AdminSection.MATCHES)
            if (currentAdmin.role == AdminRole.HEAD_ADMIN) add(AdminSection.SUB_ADMINS)
            if (currentAdmin.hasPermission(AdminPermission.CROWN_CHAMPION)) add(AdminSection.CHAMPION)
            if (currentAdmin.role == AdminRole.HEAD_ADMIN) add(AdminSection.AUDIT)
        }
    }

    var selectedSection by remember(currentAdmin.id) {
        mutableStateOf(allowedSections.firstOrNull())
    }
    LaunchedEffect(currentAdmin.id, allowedSections) {
        if (allowedSections.isEmpty()) {
            selectedSection = null
        } else if (selectedSection == null || selectedSection !in allowedSections) {
            selectedSection = allowedSections.firstOrNull()
        }
    }
    var showOwnAccountDialog by remember { mutableStateOf(false) }

    Column(modifier = modifier.fillMaxSize()) {
        // Logged-in admin bar
        Surface(
            color = MidnightSurface,
            border = BorderStroke(1.dp, CardBorder),
            shape = RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "لوحة تحكم: ${currentAdmin.displayName} (@${currentAdmin.username})",
                        style = MaterialTheme.typography.titleSmall,
                        color = ChampionshipGold
                    )
                    val sessionBadge = if (uiState.sessionState.keepSignedIn) {
                        "جلسة محفوظة تلقائياً (الخادم المركزي)"
                    } else {
                        "جلسة مؤقتة"
                    }
                    Text(
                        text = "${currentAdmin.role.labelAr} • $sessionBadge",
                        style = MaterialTheme.typography.labelSmall,
                        color = CyberSky
                    )
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    OutlinedButton(
                        onClick = { showOwnAccountDialog = true },
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                        modifier = Modifier.testTag("admin_edit_profile_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Key,
                            contentDescription = "إدارة حسابي",
                            modifier = Modifier.size(16.dp),
                            tint = CyberSky
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("حسابي", style = MaterialTheme.typography.labelMedium, color = CyberSky)
                    }
                    IconButton(
                        onClick = onLogout,
                        modifier = Modifier.testTag("admin_logout_button")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Logout,
                            contentDescription = "تسجيل الخروج",
                            tint = CrimsonLoss
                        )
                    }
                }
            }
        }

        if (allowedSections.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                EmptyStatePanel(
                    icon = Icons.Default.ManageAccounts,
                    title = "لا توجد صلاحيات مفعلة",
                    subtitle = "اطلب من المشرف الرئيسي تفعيل الصلاحيات المناسبة لحسابك."
                )
            }
        } else {
            // Section Chips
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(allowedSections) { sec ->
                    FilterChip(
                        selected = selectedSection == sec,
                        onClick = { selectedSection = sec },
                        leadingIcon = {
                            Icon(sec.icon, contentDescription = null, modifier = Modifier.size(16.dp))
                        },
                        label = {
                            val isRacing = uiState.tournament?.format?.isRacing == true
                            val baseTitle = when (sec) {
                                AdminSection.DRAW -> if (isRacing) "التأهل والسباقات" else sec.titleAr
                                AdminSection.MATCHES -> if (isRacing) "السباقات" else sec.titleAr
                                else -> sec.titleAr
                            }
                            val badge = when (sec) {
                                AdminSection.PLAYERS -> if (uiState.pendingPlayers.isNotEmpty()) " (${uiState.pendingPlayers.size})" else ""
                                AdminSection.SUB_ADMINS -> {
                                    val count = uiState.admins.count { it.role == AdminRole.SUB_ADMIN }
                                    " ($count/5)"
                                }
                                else -> ""
                            }
                            Text("$baseTitle$badge")
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ElectricCobalt,
                            selectedLabelColor = TextPrimary,
                            selectedLeadingIconColor = ChampionshipGold
                        ),
                        modifier = Modifier.testTag("admin_tab_${sec.name.lowercase()}")
                    )
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                val persistence = uiState.persistence
                if (currentAdmin.role == AdminRole.HEAD_ADMIN && persistence != null) {
                    item {
                        val accent = when (persistence.mode) {
                            "ephemeral" -> AmberDraw
                            "postgres" -> EmeraldWin
                            else -> CyberSky
                        }
                        Surface(
                            color = accent.copy(alpha = 0.12f),
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, accent.copy(alpha = 0.55f)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("admin_persistence_banner")
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(
                                    imageVector = if (persistence.mode == "ephemeral") Icons.Default.Warning else Icons.Default.CloudDone,
                                    contentDescription = null,
                                    tint = accent,
                                    modifier = Modifier.size(20.dp)
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = persistence.labelAr.ifBlank {
                                            if (persistence.isDurable) "تخزين سحابي دائم" else "تخزين مؤقت"
                                        },
                                        style = MaterialTheme.typography.labelLarge,
                                        color = accent
                                    )
                                    val detail = buildString {
                                        if (persistence.detailAr.isNotBlank()) append(persistence.detailAr)
                                        if (!persistence.cloudError.isNullOrBlank()) {
                                            if (isNotEmpty()) append(" • ")
                                            append(persistence.cloudError)
                                        }
                                    }
                                    if (detail.isNotBlank()) {
                                        Text(
                                            text = detail,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextSecondary
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                item {
                    when (selectedSection) {
                        AdminSection.TOURNAMENT -> AdminTournamentSettingsTab(
                            tournament = uiState.tournament,
                            onImportBanner = onImportBanner,
                            onSaveSettings = onSaveTournament,
                            onCreateFresh = onCreateFreshTournament,
                            onDeleteTournament = onDeleteTournament
                        )
                        AdminSection.PLAYERS -> AdminPlayersTab(
                            uiState = uiState,
                            onImportAvatar = onImportAvatar,
                            onAdminAddPlayer = onAdminAddPlayerWithProfile,
                            onBulkImport = onBulkImport,
                            onStatusChange = onUpdatePlayerStatus,
                            onUpdateDetails = onUpdatePlayerDetails,
                            onDeletePlayer = onDeletePlayer,
                            onStartDiscordOAuth = onStartDiscordOAuth,
                            onLoadDiscordGuildMembers = onLoadDiscordGuildMembers,
                            onCreatePlayerProfile = onCreatePlayerProfile,
                            onUpdatePlayerProfile = onUpdatePlayerProfile,
                            onMergePlayerProfiles = onMergePlayerProfiles,
                            onNavigateToTournamentTab = if (AdminSection.TOURNAMENT in allowedSections) {
                                { selectedSection = AdminSection.TOURNAMENT }
                            } else null
                        )
                        AdminSection.DRAW -> if (uiState.tournament == null) {
                            EmptyStatePanel(
                                icon = Icons.Default.SportsEsports,
                                title = "لا توجد بطولة نشطة حالياً",
                                subtitle = "أنشئ بطولة جديدة من تبويب «البطولة» أولاً لإجراء القرعة.",
                                actionLabel = if (AdminSection.TOURNAMENT in allowedSections) "الانتقال لإنشاء بطولة" else null,
                                onAction = if (AdminSection.TOURNAMENT in allowedSections) {
                                    { selectedSection = AdminSection.TOURNAMENT }
                                } else null
                            )
                        } else {
                            AdminDrawTab(
                                uiState = uiState,
                                onRunDraw = onRunDraw,
                                onGenerateKnockoutFromStandings = onGenerateKnockoutFromStandings,
                                onGenerateFinalRace = onGenerateFinalRace
                            )
                        }
                        AdminSection.MATCHES -> if (uiState.tournament == null) {
                            EmptyStatePanel(
                                icon = Icons.Default.SportsEsports,
                                title = "لا توجد بطولة نشطة حالياً",
                                subtitle = "أنشئ بطولة جديدة من تبويب «البطولة» لإدارة المباريات.",
                                actionLabel = if (AdminSection.TOURNAMENT in allowedSections) "الانتقال لإنشاء بطولة" else null,
                                onAction = if (AdminSection.TOURNAMENT in allowedSections) {
                                    { selectedSection = AdminSection.TOURNAMENT }
                                } else null
                            )
                        } else {
                            AdminMatchesTab(
                                uiState = uiState,
                                onEditMatch = onEditMatch,
                                onQuickUpdateGoals = onQuickUpdateGoals,
                                onAutoSchedule = onAutoSchedule,
                                onToggleCheckIn = onToggleCheckIn,
                                onOpenDispute = onOpenDispute,
                                onOpenReminder = onOpenReminder,
                                onPlayerClick = onPlayerClick,
                                onCreateRace = onCreateRace,
                                onEditRaceResults = onEditRaceResults,
                                onGenerateFinalRace = onGenerateFinalRace,
                                onDeleteRace = onDeleteRace
                            )
                        }
                        AdminSection.SUB_ADMINS -> AdminSubAdminsTab(
                            uiState = uiState,
                            onChangeOwnPin = onChangeOwnPin,
                            onCreateSubAdmin = onCreateSubAdmin,
                            onUpdateSubAdmin = onUpdateSubAdmin,
                            onDeleteSubAdmin = onDeleteSubAdmin
                        )
                        AdminSection.CHAMPION -> if (uiState.tournament == null) {
                            EmptyStatePanel(
                                icon = Icons.Default.SportsEsports,
                                title = "لا توجد بطولة نشطة حالياً",
                                subtitle = "أنشئ بطولة جديدة من تبويب «البطولة» أولاً لمتابعة التتويج.",
                                actionLabel = if (AdminSection.TOURNAMENT in allowedSections) "الانتقال لإنشاء بطولة" else null,
                                onAction = if (AdminSection.TOURNAMENT in allowedSections) {
                                    { selectedSection = AdminSection.TOURNAMENT }
                                } else null
                            )
                        } else {
                            AdminProgressAndChampionTab(
                                uiState = uiState,
                                onCrownChampion = onCrownChampion,
                                onOpenExportShare = onOpenExportShare
                            )
                        }
                        AdminSection.AUDIT -> AdminAuditLogTab(uiState = uiState)
                        null -> Spacer(modifier = Modifier)
                    }
                }
            }
        }
    }

    if (showOwnAccountDialog) {
        AdminOwnAccountDialog(
            currentAdmin = currentAdmin,
            onDismiss = { showOwnAccountDialog = false },
            onSaveProfile = { displayName, username ->
                onUpdateOwnProfile(displayName, username) {
                    showOwnAccountDialog = false
                }
            },
            onChangePin = { currPin, newPin ->
                onChangeOwnPin(currPin, newPin)
                showOwnAccountDialog = false
            }
        )
    }
}

@Composable
private fun AdminOwnAccountDialog(
    currentAdmin: AdminAccountEntity,
    onDismiss: () -> Unit,
    onSaveProfile: (displayName: String, username: String?) -> Unit,
    onChangePin: (currentPin: String, newPin: String) -> Unit
) {
    var displayName by remember(currentAdmin.id) { mutableStateOf(currentAdmin.displayName) }
    var username by remember(currentAdmin.id) { mutableStateOf(currentAdmin.username) }
    var currentPin by remember { mutableStateOf("") }
    var newPin by remember { mutableStateOf("") }
    var confirmPin by remember { mutableStateOf("") }
    val strength = PinSecurityManager.evaluateStrength(newPin)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MidnightSurface,
        title = { Text("إدارة حساب المشرف والأمان", color = ChampionshipGold) },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "الصلاحية: ${currentAdmin.role.labelAr}",
                    style = MaterialTheme.typography.labelMedium,
                    color = CyberSky
                )
                OutlinedTextField(
                    value = displayName,
                    onValueChange = { displayName = it },
                    label = { Text("الاسم الظاهر في اللوحة") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("admin_profile_display_input")
                )
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("اسم المستخدم للدخول (3 أحرف+)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("admin_profile_username_input")
                )
                Button(
                    onClick = { onSaveProfile(displayName.trim(), username.trim()) },
                    enabled = displayName.isNotBlank() && username.trim().length >= 3,
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                    modifier = Modifier.fillMaxWidth().testTag("admin_profile_save_button")
                ) {
                    Text("حفظ الاسم واسم المستخدم")
                }

                HorizontalDivider(color = CardBorder)

                Text(
                    text = "تغيير رمز الأمان (PIN)",
                    style = MaterialTheme.typography.titleSmall,
                    color = CyberSky
                )
                SixDigitPinInputField(
                    value = currentPin,
                    onValueChange = { currentPin = it },
                    label = "رمز PIN الحالي (6 أرقام)",
                    testTag = "admin_account_pin_current"
                )
                SixDigitPinInputField(
                    value = newPin,
                    onValueChange = { newPin = it },
                    label = "رمز PIN الجديد (6 أرقام)",
                    testTag = "admin_account_pin_new",
                    supportingText = if (newPin.isNotEmpty()) "قوة الرمز: ${strength.labelAr}" else null
                )
                SixDigitPinInputField(
                    value = confirmPin,
                    onValueChange = { confirmPin = it },
                    label = "تأكيد رمز PIN الجديد",
                    testTag = "admin_account_pin_confirm",
                    isError = confirmPin.isNotEmpty() && confirmPin != newPin,
                    supportingText = if (confirmPin.isNotEmpty() && confirmPin != newPin) "رمز التأكيد غير مطابق" else null
                )
                OutlinedButton(
                    onClick = { onChangePin(currentPin, newPin) },
                    enabled = PinSecurityManager.isValidPinFormat(currentPin) &&
                        PinSecurityManager.isValidPinFormat(newPin) &&
                        newPin == confirmPin,
                    modifier = Modifier.fillMaxWidth().testTag("admin_account_pin_save")
                ) {
                    Text("تحديث رمز PIN وإنهاء الجلسات الأخرى")
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إغلاق") }
        }
    )
}

@Composable
private fun AdminServerSyncPendingPanel(
    isSyncing: Boolean,
    isServerReachable: Boolean,
    connectionError: String?,
    serverBaseUrl: String,
    onRetryConnection: () -> Unit,
    onConfigureServerUrl: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 500.dp)
                .testTag(if (!isServerReachable && !isSyncing) "admin_server_error_card" else "admin_server_loading_card"),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = MidnightSurface),
            border = BorderStroke(1.dp, CardBorder)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (isSyncing && isServerReachable) {
                    CircularProgressIndicator(color = ChampionshipGold)
                    Text(
                        text = "جاري التحقق من الخادم المركزي واستعادة الجلسة المحفوظة...",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimary
                    )
                    Text(
                        text = "يتم التحقق من حساب المشرف والبطولات من الخادم ($serverBaseUrl) قبل عرض لوحة الإدارة.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.CloudOff,
                        contentDescription = null,
                        tint = CrimsonLoss,
                        modifier = Modifier.size(44.dp)
                    )
                    Text(
                        text = "تعذر التحقق من حساب المشرف على الخادم",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimary
                    )
                    Text(
                        text = connectionError ?: "الخادم المركزي غير متاح أو قيد الاستيقاظ الآن ($serverBaseUrl). أعد المحاولة لاستعادة حسابك المحفوظ.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                    Button(
                        onClick = onRetryConnection,
                        colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("admin_retry_server_button")
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("إعادة الاتصال بالخادم")
                    }
                    OutlinedButton(
                        onClick = onConfigureServerUrl,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("admin_change_server_url_button")
                    ) {
                        Text("تغيير رابط خادم Render", color = CyberSky)
                    }
                }
            }
        }
    }
}

