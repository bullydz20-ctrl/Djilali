package com.example

import android.Manifest
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material.icons.outlined.AccountTree
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.TableChart
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.api.ApiService
import com.example.api.RaceEntry
import com.example.data.local.MatchEntity
import com.example.data.local.PlayerEntity
import com.example.export.TournamentShareHelper
import com.example.notifications.MatchReminderScheduler
import com.example.security.AdminPermission
import com.example.security.hasPermission
import com.example.ui.components.CommunityTopHeader
import com.example.ui.components.ConfettiOverlay
import com.example.ui.components.DisputeMatchDialog
import com.example.ui.components.ExportShareDialog
import com.example.ui.components.MatchReminderDialog
import com.example.ui.components.PlayerProfileDialog
import com.example.ui.components.RaceResultsDialog
import com.example.ui.components.ScoreEntryDialog
import com.example.ui.components.ServerBaseUrlDialog
import kotlinx.coroutines.launch
import com.example.ui.screens.AdminScreen
import com.example.ui.screens.BracketScreen
import com.example.ui.screens.GroupsScreen
import com.example.ui.screens.HomeScreen
import com.example.ui.screens.PlayersScreen
import com.example.ui.screens.RegisterPlayerDialog
import com.example.ui.theme.ChampionshipGold
import com.example.ui.theme.ElectricCobalt
import com.example.ui.theme.FifaTournamentTheme
import com.example.ui.theme.MidnightSurface
import com.example.ui.theme.ObsidianVoid
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary
import com.example.ui.viewmodel.TournamentViewModel

private data class TopNavItem(
    val route: String,
    val labelRes: Int,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val tag: String
)

private const val ROUTE_HOME = "home"
private const val ROUTE_PLAYERS = "players"
private const val ROUTE_GROUPS = "groups"
private const val ROUTE_BRACKET = "bracket"
private const val ROUTE_ADMIN = "admin"

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT)
        )
        setContent {
            FifaTournamentTheme {
                FifaTournamentApp()
            }
        }
    }
}

@Composable
fun FifaTournamentApp(
    viewModel: TournamentViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    var showRegisterDialog by remember { mutableStateOf(false) }
    var editingMatch by remember { mutableStateOf<MatchEntity?>(null) }
    var editingRace by remember { mutableStateOf<RaceEntry?>(null) }
    var reminderTargetMatch by remember { mutableStateOf<MatchEntity?>(null) }
    var disputeTargetMatch by remember { mutableStateOf<MatchEntity?>(null) }
    var profileTargetPlayer by remember { mutableStateOf<PlayerEntity?>(null) }
    var confettiBurst by remember { mutableIntStateOf(0) }
    var lastSeenChampionId by remember { mutableStateOf<Long?>(null) }
    var hasInitializedChampion by remember { mutableStateOf(false) }
    var pendingNotificationAction by remember { mutableStateOf<(() -> Unit)?>(null) }
    var showExportShareDialog by remember { mutableStateOf(false) }
    var pendingExportText by remember { mutableStateOf("") }
    var showServerUrlDialog by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.hasServerState, uiState.championPlayer?.id) {
        if (!uiState.hasServerState) return@LaunchedEffect
        val currentChampId = uiState.championPlayer?.id
        if (!hasInitializedChampion) {
            hasInitializedChampion = true
            lastSeenChampionId = currentChampId
        } else if (currentChampId != null && currentChampId != lastSeenChampionId) {
            lastSeenChampionId = currentChampId
            confettiBurst++
        } else if (currentChampId == null) {
            lastSeenChampionId = null
        }
    }

    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val clipboardManager = LocalClipboardManager.current
    val coroutineScope = rememberCoroutineScope()
    var hasResumedOnce by remember { mutableStateOf(false) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                if (hasResumedOnce) {
                    viewModel.refreshFromServer()
                } else {
                    hasResumedOnce = true
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        val action = pendingNotificationAction
        pendingNotificationAction = null
        if (granted) {
            action?.invoke()
        } else {
            viewModel.notifyNotificationPermissionDenied()
        }
    }

    fun runWithNotificationPermission(action: () -> Unit) {
        if (MatchReminderScheduler.hasNotificationPermission(context) ||
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
        ) {
            action()
        } else {
            pendingNotificationAction = action
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    val createTxtLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/plain")
    ) { uri ->
        if (uri != null && pendingExportText.isNotEmpty()) {
            val ok = TournamentShareHelper.writeSummaryToUri(context, uri, pendingExportText)
            coroutineScope.launch {
                snackbarHostState.showSnackbar(
                    if (ok) "تم تصدير ملخص نتائج البطولة إلى الملف النصي بنجاح."
                    else "تعذر حفظ الملف النصي، يرجى المحاولة مجدداً."
                )
            }
        }
    }

    val fallbackWebUrl = stringResource(R.string.official_web_url)
    val activeWebUrl = uiState.serverBaseUrl.ifBlank { fallbackWebUrl }

    fun copyOfficialWebUrl() {
        clipboardManager.setText(AnnotatedString(activeWebUrl))
        coroutineScope.launch {
            snackbarHostState.showSnackbar("تم نسخ رابط صفحة الويب الرسمية إلى الحافظة.")
        }
    }

    fun openOfficialWebPage() {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(activeWebUrl))
            context.startActivity(intent)
        } catch (_: Exception) {
            clipboardManager.setText(AnnotatedString(activeWebUrl))
            coroutineScope.launch {
                snackbarHostState.showSnackbar("تعذر فتح المتصفح، تم نسخ رابط صفحة الويب إلى الحافظة.")
            }
        }
    }

    LaunchedEffect(Unit) {
        viewModel.messages.collect { msg ->
            snackbarHostState.showSnackbar(msg)
        }
    }

    val navItems = remember {
        listOf(
            TopNavItem(ROUTE_HOME, R.string.nav_home, Icons.Filled.Home, Icons.Outlined.Home, "nav_home"),
            TopNavItem(ROUTE_PLAYERS, R.string.nav_players, Icons.Filled.Groups, Icons.Outlined.Groups, "nav_players"),
            TopNavItem(ROUTE_GROUPS, R.string.nav_groups, Icons.Filled.TableChart, Icons.Outlined.TableChart, "nav_groups"),
            TopNavItem(ROUTE_BRACKET, R.string.nav_bracket, Icons.Filled.AccountTree, Icons.Outlined.AccountTree, "nav_bracket"),
            TopNavItem(ROUTE_ADMIN, R.string.nav_admin, Icons.Filled.AdminPanelSettings, Icons.Outlined.AdminPanelSettings, "nav_admin")
        )
    }

    fun navigateTopLevel(route: String) {
        navController.navigate(route) {
            popUpTo(navController.graph.findStartDestination().id) {
                saveState = true
            }
            launchSingleTop = true
            restoreState = true
        }
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(ObsidianVoid, MidnightSurface, ObsidianVoid)
                )
            )
    ) {
        val isExpandedWidth = maxWidth >= 680.dp

        Scaffold(
            containerColor = ObsidianVoid.copy(alpha = 0f),
            contentWindowInsets = WindowInsets.safeDrawing,
            snackbarHost = { SnackbarHost(snackbarHostState) },
            topBar = {
                CommunityTopHeader(
                    currentAdmin = uiState.currentAdmin,
                    tournaments = uiState.tournaments,
                    activeTournamentId = uiState.tournament?.id,
                    onSelectTournament = viewModel::selectTournament,
                    onOpenAdmin = { navigateTopLevel(ROUTE_ADMIN) },
                    onOpenExportShare = {
                        if (uiState.tournament != null) {
                            showExportShareDialog = true
                        } else {
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("لا توجد بطولة نشطة للتصدير حالياً.")
                            }
                        }
                    },
                    onOpenWebPortal = { openOfficialWebPage() }
                )
            },
            bottomBar = {
                if (!isExpandedWidth) {
                    NavigationBar(
                        containerColor = MidnightSurface,
                        windowInsets = WindowInsets.systemBars
                            .union(WindowInsets.displayCutout)
                            .only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal)
                    ) {
                        navItems.forEach { item ->
                            val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
                            NavigationBarItem(
                                selected = selected,
                                onClick = { navigateTopLevel(item.route) },
                                icon = {
                                    Icon(
                                        imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                                        contentDescription = stringResource(item.labelRes)
                                    )
                                },
                                label = { Text(stringResource(item.labelRes), maxLines = 1) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = ChampionshipGold,
                                    selectedTextColor = ChampionshipGold,
                                    indicatorColor = ElectricCobalt.copy(alpha = 0.28f),
                                    unselectedIconColor = TextSecondary,
                                    unselectedTextColor = TextSecondary
                                ),
                                modifier = Modifier.testTag(item.tag)
                            )
                        }
                    }
                }
            }
        ) { innerPadding ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .consumeWindowInsets(innerPadding)
            ) {
                if (isExpandedWidth) {
                    NavigationRail(
                        containerColor = MidnightSurface,
                        windowInsets = WindowInsets(0, 0, 0, 0),
                        modifier = Modifier.fillMaxHeight()
                    ) {
                        navItems.forEach { item ->
                            val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
                            NavigationRailItem(
                                selected = selected,
                                onClick = { navigateTopLevel(item.route) },
                                icon = {
                                    Icon(
                                        imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                                        contentDescription = stringResource(item.labelRes)
                                    )
                                },
                                label = { Text(stringResource(item.labelRes)) },
                                colors = NavigationRailItemDefaults.colors(
                                    selectedIconColor = ChampionshipGold,
                                    selectedTextColor = ChampionshipGold,
                                    indicatorColor = ElectricCobalt.copy(alpha = 0.28f),
                                    unselectedIconColor = TextSecondary,
                                    unselectedTextColor = TextSecondary
                                ),
                                modifier = Modifier.testTag(item.tag)
                            )
                        }
                    }
                }

                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.TopCenter
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .widthIn(max = 960.dp)
                    ) {
                        NavHost(
                            navController = navController,
                            startDestination = ROUTE_HOME,
                            modifier = Modifier.fillMaxSize()
                        ) {
                            composable(ROUTE_HOME) {
                                HomeScreen(
                                    uiState = uiState,
                                    onOpenRegister = { showRegisterDialog = true },
                                    onEditMatch = { editingMatch = it },
                                    onQuickUpdateGoals = { match, g1, g2 ->
                                        viewModel.updateMatchScore(
                                            match = match,
                                            leg1S1 = g1,
                                            leg1S2 = g2,
                                            leg2S1 = match.leg2Score1,
                                            leg2S2 = match.leg2Score2,
                                            pen1 = match.penaltyScore1,
                                            pen2 = match.penaltyScore2
                                        )
                                    },
                                    onOpenExportShare = {
                                        if (uiState.tournament != null) {
                                            showExportShareDialog = true
                                        }
                                    },
                                    onOpenReminder = { reminderTargetMatch = it },
                                    onCancelReminder = { matchId -> viewModel.cancelMatchReminder(matchId) },
                                    onOpenAdmin = { navigateTopLevel(ROUTE_ADMIN) },
                                    officialWebUrl = activeWebUrl,
                                    onOpenWebPortal = { openOfficialWebPage() },
                                    onCopyWebUrl = { copyOfficialWebUrl() },
                                    onRetryConnection = { viewModel.refreshFromServer() },
                                    onConfigureServerUrl = { showServerUrlDialog = true },
                                    onToggleCheckIn = { match, slot -> viewModel.toggleMatchCheckIn(match.id, slot) },
                                    onVotePrediction = { match, slot -> viewModel.voteMatchPrediction(match.id, slot) },
                                    onOpenDispute = { disputeTargetMatch = it },
                                    onPlayerClick = { profileTargetPlayer = it },
                                    onCelebrateChampion = { confettiBurst++ },
                                    onCreateRace = { title, stage, track ->
                                        viewModel.createRace(title = title, stage = stage, trackName = track)
                                    },
                                    onEditRaceResults = { editingRace = it },
                                    onGenerateFinalRace = { viewModel.generateFinalRaceFromStandings() },
                                    onDeleteRace = viewModel::deleteRace
                                )
                            }
                            composable(ROUTE_PLAYERS) {
                                PlayersScreen(
                                    uiState = uiState,
                                    onOpenRegister = { showRegisterDialog = true },
                                    onPlayerClick = { profileTargetPlayer = it }
                                )
                            }
                            composable(ROUTE_GROUPS) {
                                GroupsScreen(
                                    uiState = uiState,
                                    onEditMatch = { editingMatch = it },
                                    onToggleCheckIn = { match, slot -> viewModel.toggleMatchCheckIn(match.id, slot) },
                                    onVotePrediction = { match, slot -> viewModel.voteMatchPrediction(match.id, slot) },
                                    onOpenDispute = { disputeTargetMatch = it },
                                    onPlayerClick = { profileTargetPlayer = it },
                                    onCreateRace = { title, stage, track ->
                                        viewModel.createRace(title = title, stage = stage, trackName = track)
                                    },
                                    onEditRaceResults = { editingRace = it },
                                    onGenerateFinalRace = { viewModel.generateFinalRaceFromStandings() },
                                    onDeleteRace = viewModel::deleteRace
                                )
                            }
                            composable(ROUTE_BRACKET) {
                                BracketScreen(
                                    uiState = uiState,
                                    onEditMatch = { editingMatch = it },
                                    onSelectWinner = { match, winnerId ->
                                        viewModel.updateKnockoutMatchWinner(match, winnerId)
                                    }
                                )
                            }
                            composable(ROUTE_ADMIN) {
                                AdminScreen(
                                    uiState = uiState,
                                    onSetupHeadAdmin = viewModel::setupHeadAdmin,
                                    onLogin = viewModel::loginAdmin,
                                    onLogout = viewModel::logoutAdmin,
                                    onImportBanner = { uri, cb -> viewModel.importImageFromPicker(uri, "banner", cb) },
                                    onImportAvatar = { uri, cb -> viewModel.importImageFromPicker(uri, "avatar", cb) },
                                    onSaveTournament = viewModel::saveTournamentSettings,
                                    onCreateFreshTournament = viewModel::createFreshTournament,
                                    onDeleteTournament = viewModel::deleteCurrentTournament,
                                    onAdminAddPlayer = { name, elysium, avatar, level, ovr, club, autoApprove, onSuccess ->
                                        viewModel.adminAddPlayer(
                                            name = name,
                                            elysiumNetId = elysium,
                                            avatarUri = avatar,
                                            level = level,
                                            ovrRating = ovr,
                                            clubName = club,
                                            autoApprove = autoApprove,
                                            onSuccess = onSuccess
                                        )
                                    },
                                    onAdminAddPlayerWithProfile = { name, elysium, avatar, level, ovr, club, autoApprove, profileId, xeMoNetId, discordUserId, onSuccess ->
                                        viewModel.adminAddPlayer(
                                            name = name,
                                            elysiumNetId = elysium,
                                            avatarUri = avatar,
                                            level = level,
                                            ovrRating = ovr,
                                            clubName = club,
                                            autoApprove = autoApprove,
                                            profileId = profileId,
                                            xeMoNetId = xeMoNetId,
                                            discordUserId = discordUserId,
                                            onSuccess = onSuccess
                                        )
                                    },
                                    onBulkImport = viewModel::bulkImportPlayers,
                                    onUpdatePlayerStatus = viewModel::updatePlayerStatus,
                                    onUpdatePlayerDetails = viewModel::updatePlayerDetails,
                                    onDeletePlayer = viewModel::deletePlayer,
                                    onStartDiscordOAuth = {
                                        viewModel.startDiscordOAuth { authUrl ->
                                            try {
                                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(authUrl)))
                                            } catch (_: Exception) {
                                                clipboardManager.setText(AnnotatedString(authUrl))
                                                coroutineScope.launch {
                                                    snackbarHostState.showSnackbar("تعذر فتح المتصفح، تم نسخ رابط Discord OAuth للحافظة.")
                                                }
                                            }
                                        }
                                    },
                                    onLoadDiscordGuildMembers = viewModel::loadDiscordGuildMembers,
                                    onCreatePlayerProfile = viewModel::createPlayerProfile,
                                    onUpdatePlayerProfile = viewModel::updatePlayerProfile,
                                    onMergePlayerProfiles = viewModel::mergePlayerProfiles,
                                    onRunDraw = viewModel::runDraw,
                                    onGenerateKnockoutFromStandings = viewModel::generateKnockoutFromStandings,
                                    onEditMatch = { editingMatch = it },
                                    onQuickUpdateGoals = { match, g1, g2 ->
                                        viewModel.updateMatchScore(
                                            match = match,
                                            leg1S1 = g1,
                                            leg1S2 = g2,
                                            leg2S1 = match.leg2Score1,
                                            leg2S2 = match.leg2Score2,
                                            pen1 = match.penaltyScore1,
                                            pen2 = match.penaltyScore2
                                        )
                                    },
                                    onAutoSchedule = viewModel::autoScheduleMatches,
                                    onToggleCheckIn = { match, slot -> viewModel.toggleMatchCheckIn(match.id, slot) },
                                    onOpenDispute = { disputeTargetMatch = it },
                                    onOpenReminder = { reminderTargetMatch = it },
                                    onPlayerClick = { profileTargetPlayer = it },
                                    onUpdateOwnProfile = viewModel::updateOwnProfile,
                                    onChangeOwnPin = viewModel::changeOwnPin,
                                    onCreateSubAdmin = viewModel::createSubAdmin,
                                    onUpdateSubAdmin = viewModel::updateSubAdmin,
                                    onDeleteSubAdmin = viewModel::deleteSubAdmin,
                                    onCrownChampion = viewModel::crownChampion,
                                    onOpenExportShare = { showExportShareDialog = true },
                                    onRetryConnection = { viewModel.refreshFromServer() },
                                    onConfigureServerUrl = { showServerUrlDialog = true },
                                    onCreateRace = { title, stage, track ->
                                        viewModel.createRace(title = title, stage = stage, trackName = track)
                                    },
                                    onEditRaceResults = { editingRace = it },
                                    onGenerateFinalRace = { viewModel.generateFinalRaceFromStandings() },
                                    onDeleteRace = viewModel::deleteRace
                                )
                            }
                        }
                    }
                }
            }
        }

        ConfettiOverlay(burstTrigger = confettiBurst)
    }

    if (showRegisterDialog) {
        RegisterPlayerDialog(
            gameTitle = uiState.tournament?.gameTitle ?: "FIFA 22",
            tournamentName = uiState.tournament?.name ?: "",
            onDismiss = { showRegisterDialog = false },
            onImportAvatar = { uri, cb -> viewModel.importImageFromPicker(uri, "avatar", cb) },
            onSubmit = { name, elysiumId, avatarUri, level, club ->
                viewModel.registerPlayer(
                    name = name,
                    elysiumNetId = elysiumId,
                    avatarUri = avatarUri,
                    level = level,
                    clubName = club,
                    onSuccess = { showRegisterDialog = false }
                )
            }
        )
    }

    editingMatch?.let { match ->
        val p1 = match.player1Id?.let { id -> uiState.players.find { it.id == id } }
        val p2 = match.player2Id?.let { id -> uiState.players.find { it.id == id } }
        if (p1 != null && p2 != null) {
            ScoreEntryDialog(
                match = match,
                player1 = p1,
                player2 = p2,
                bestOf = uiState.tournament?.bestOf ?: 1,
                onDismiss = { editingMatch = null },
                onSave = { l1s1, l1s2, l2s1, l2s2, pen1, pen2 ->
                    viewModel.updateMatchScore(
                        match = match,
                        leg1S1 = l1s1,
                        leg1S2 = l1s2,
                        leg2S1 = l2s1,
                        leg2S2 = l2s2,
                        pen1 = pen1,
                        pen2 = pen2,
                        onSuccess = { editingMatch = null }
                    )
                },
                onWalkover = { winnerSlot, reason ->
                    viewModel.adminWalkoverMatch(
                        matchId = match.id,
                        winnerSlot = winnerSlot,
                        reason = reason.ifBlank { null },
                        onSuccess = { editingMatch = null }
                    )
                },
                onResolveDispute = { resolutionNote ->
                    viewModel.resolveMatchDispute(
                        matchId = match.id,
                        resolutionNote = resolutionNote,
                        onSuccess = { editingMatch = null }
                    )
                }
            )
        }
    }

    editingRace?.let { targetRace ->
        val activeTournament = uiState.tournament
        if (activeTournament != null) {
            RaceResultsDialog(
                race = targetRace,
                tournament = activeTournament,
                approvedPlayers = uiState.approvedPlayers,
                onDismiss = { editingRace = null },
                onSave = { title, trackName, entries ->
                    viewModel.saveRaceResults(
                        raceId = targetRace.id,
                        entries = entries,
                        title = title,
                        trackName = trackName,
                        onSuccess = { editingRace = null }
                    )
                }
            )
        }
    }

    if (showExportShareDialog) {
        ExportShareDialog(
            uiState = uiState,
            onDismiss = { showExportShareDialog = false },
            onExportTxtFile = { suggestedName, content ->
                pendingExportText = content
                createTxtLauncher.launch(suggestedName)
            },
            onShareSocialText = { title, content ->
                val chooser = TournamentShareHelper.createShareTextIntent(title, content)
                try {
                    context.startActivity(chooser)
                } catch (_: Exception) {
                    coroutineScope.launch {
                        snackbarHostState.showSnackbar("لا يوجد تطبيق متاح لمشاركة النص حالياً.")
                    }
                }
            },
            onShareTxtAttachment = { fileName, title, content ->
                val uri = TournamentShareHelper.writeCacheSummaryFileUri(context, fileName, content)
                if (uri != null) {
                    val chooser = TournamentShareHelper.createShareFileIntent(uri, title, content)
                    try {
                        context.startActivity(chooser)
                    } catch (_: Exception) {
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("لا يوجد تطبيق متاح لمشاركة الملف حالياً.")
                        }
                    }
                } else {
                    coroutineScope.launch {
                        snackbarHostState.showSnackbar("تعذر تجهيز الملف للمشاركة.")
                    }
                }
            },
            onCopySummary = { content ->
                clipboardManager.setText(AnnotatedString(content))
                showExportShareDialog = false
                coroutineScope.launch {
                    snackbarHostState.showSnackbar("تم نسخ ملخص النتائج إلى الحافظة بنجاح.")
                }
            }
        )
    }

    reminderTargetMatch?.let { targetMatch ->
        val p1 = targetMatch.player1Id?.let { id -> uiState.players.find { it.id == id } }
        val p2 = targetMatch.player2Id?.let { id -> uiState.players.find { it.id == id } }
        val existingReminder = uiState.matchReminders.find { it.matchId == targetMatch.id }
        if (p1 != null && p2 != null) {
            val matchTitle = "${p1.name} ضد ${p2.name}"
            MatchReminderDialog(
                match = targetMatch,
                player1 = p1,
                player2 = p2,
                existingReminder = existingReminder,
                onDismiss = { reminderTargetMatch = null },
                onScheduleReminder = { scheduledAtMillis, leadMinutes ->
                    runWithNotificationPermission {
                        viewModel.scheduleMatchReminder(
                            match = targetMatch,
                            matchTitle = matchTitle,
                            scheduledAtMillis = scheduledAtMillis,
                            leadMinutes = leadMinutes,
                            onSuccess = { reminderTargetMatch = null }
                        )
                    }
                },
                onTestNotification = { scheduledAtMillis, leadMinutes ->
                    runWithNotificationPermission {
                        viewModel.sendTestMatchNotification(
                            match = targetMatch,
                            matchTitle = matchTitle,
                            scheduledAtMillis = scheduledAtMillis,
                            leadMinutes = leadMinutes
                        )
                    }
                },
                onCancelReminder = {
                    viewModel.cancelMatchReminder(targetMatch.id)
                    reminderTargetMatch = null
                }
            )
        }
    }

    if (showServerUrlDialog) {
        ServerBaseUrlDialog(
            currentUrl = activeWebUrl,
            defaultUrl = ApiService.DEFAULT_BASE_URL,
            onDismiss = { showServerUrlDialog = false },
            onTestConnection = { candidateUrl, cb ->
                viewModel.testServerConnection(candidateUrl, cb)
            },
            onSaveUrl = { newUrl, verifyHealth ->
                viewModel.updateServerBaseUrl(newUrl, verifyHealthFirst = verifyHealth) {
                    showServerUrlDialog = false
                }
            }
        )
    }

    profileTargetPlayer?.let { targetPlayer ->
        val latestPlayer = uiState.players.find { it.id == targetPlayer.id } ?: targetPlayer
        val playersById = uiState.players.associateBy { it.id }
        val currentStats = uiState.playerStats.find { it.player.id == latestPlayer.id }
        val seasonEntry = uiState.seasonLeaderboard.find {
            it.elysiumNetId.equals(latestPlayer.elysiumNetId, ignoreCase = true)
        }
        val playerMatches = uiState.allMatches.filter {
            it.player1Id == latestPlayer.id || it.player2Id == latestPlayer.id
        }
        val scoreUnitLabel = uiState.tournament?.scoreUnitLabel?.ifBlank { "هدف" } ?: "هدف"

        PlayerProfileDialog(
            player = latestPlayer,
            currentStats = currentStats,
            seasonEntry = seasonEntry,
            playerMatches = playerMatches,
            playersById = playersById,
            scoreUnitLabel = scoreUnitLabel,
            isChampion = uiState.championPlayer?.id == latestPlayer.id,
            onDismiss = { profileTargetPlayer = null }
        )
    }

    disputeTargetMatch?.let { targetMatch ->
        val latestMatch = uiState.allMatches.find { it.id == targetMatch.id } ?: targetMatch
        val p1 = latestMatch.player1Id?.let { id -> uiState.players.find { it.id == id } }
        val p2 = latestMatch.player2Id?.let { id -> uiState.players.find { it.id == id } }
        if (p1 != null && p2 != null) {
            DisputeMatchDialog(
                match = latestMatch,
                player1 = p1,
                player2 = p2,
                canResolveDispute = uiState.currentAdmin?.hasPermission(AdminPermission.EDIT_SCORES) == true,
                onDismiss = { disputeTargetMatch = null },
                onImportProofImage = { uri, cb -> viewModel.importImageFromPicker(uri, "dispute", cb) },
                onSubmitDispute = { submittedBy, note, screenshotUrl ->
                    viewModel.submitMatchDispute(
                        matchId = latestMatch.id,
                        submittedBy = submittedBy,
                        note = note,
                        screenshotUrl = screenshotUrl,
                        onSuccess = { disputeTargetMatch = null }
                    )
                },
                onResolveDispute = { resolutionNote ->
                    viewModel.resolveMatchDispute(
                        matchId = latestMatch.id,
                        resolutionNote = resolutionNote,
                        onSuccess = { disputeTargetMatch = null }
                    )
                }
            )
        }
    }
}
