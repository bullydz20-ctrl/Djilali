package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        TournamentEntity::class,
        PlayerEntity::class,
        PlayerProfileEntity::class,
        TournamentGroupEntity::class,
        MatchEntity::class,
        UserEntity::class,
        MatchReminderEntity::class,
        AppMetaEntity::class
    ],
    version = 8,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun tournamentDao(): TournamentDao
    abstract fun playerDao(): PlayerDao
    abstract fun playerProfileDao(): PlayerProfileDao
    abstract fun groupDao(): GroupDao
    abstract fun matchDao(): MatchDao
    abstract fun userDao(): UserDao
    abstract fun matchReminderDao(): MatchReminderDao
    abstract fun appMetaDao(): AppMetaDao

    fun adminDao(): UserDao = userDao()

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE tournaments ADD COLUMN gameTitle TEXT NOT NULL DEFAULT 'FIFA 22'")
                db.execSQL("ALTER TABLE tournaments ADD COLUMN gameCategory TEXT NOT NULL DEFAULT 'كرة قدم'")
                db.execSQL("ALTER TABLE tournaments ADD COLUMN scoreUnitLabel TEXT NOT NULL DEFAULT 'هدف'")
                db.execSQL("CREATE TABLE IF NOT EXISTS `app_meta` (`key` TEXT NOT NULL, `value` TEXT NOT NULL, PRIMARY KEY(`key`))")
            }
        }

        val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE tournaments ADD COLUMN playMode TEXT NOT NULL DEFAULT 'SOLO_1V1'")
                db.execSQL("ALTER TABLE tournaments ADD COLUMN teamSize INTEGER NOT NULL DEFAULT 1")
                db.execSQL("ALTER TABLE tournaments ADD COLUMN bestOf INTEGER NOT NULL DEFAULT 1")
                db.execSQL("ALTER TABLE tournaments ADD COLUMN racingPointsConfig TEXT NOT NULL DEFAULT '[25,18,15,12,10,8,6,4,2,1]'")
            }
        }

        val MIGRATION_7_8 = object : Migration(7, 8) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `player_profiles` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `cp4Id` TEXT NOT NULL, `name` TEXT NOT NULL, `avatarUri` TEXT, `elysiumNetId` TEXT NOT NULL, `xeMoNetId` TEXT NOT NULL, `discordUserId` TEXT, `createdAt` INTEGER NOT NULL, `updatedAt` INTEGER NOT NULL, `tournamentsCount` INTEGER NOT NULL)"
                )
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_player_profiles_cp4Id` ON `player_profiles` (`cp4Id`)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_player_profiles_discordUserId` ON `player_profiles` (`discordUserId`)")
                db.execSQL("ALTER TABLE `players` ADD COLUMN `profileId` INTEGER")
                db.execSQL("ALTER TABLE `players` ADD COLUMN `cp4Id` TEXT")
                db.execSQL("ALTER TABLE `players` ADD COLUMN `xeMoNetId` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `players` ADD COLUMN `discordUserId` TEXT")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_players_profileId` ON `players` (`profileId`)")
            }
        }

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "fifa22_community_tournament.db"
                )
                    .addMigrations(MIGRATION_4_5, MIGRATION_6_7, MIGRATION_7_8)
                    .fallbackToDestructiveMigration(dropAllTables = true)
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
