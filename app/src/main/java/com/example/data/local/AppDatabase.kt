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
        TournamentGroupEntity::class,
        MatchEntity::class,
        UserEntity::class,
        MatchReminderEntity::class,
        AppMetaEntity::class
    ],
    version = 7,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun tournamentDao(): TournamentDao
    abstract fun playerDao(): PlayerDao
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

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "fifa22_community_tournament.db"
                )
                    .addMigrations(MIGRATION_4_5, MIGRATION_6_7)
                    .fallbackToDestructiveMigration(dropAllTables = true)
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
