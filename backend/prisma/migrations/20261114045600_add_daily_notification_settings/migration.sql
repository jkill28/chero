-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "initialBalance" REAL NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "dailyNotificationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyNotificationTime" TEXT NOT NULL DEFAULT '20:00'
);
INSERT INTO "new_Settings" ("currency", "id", "initialBalance", "language") SELECT "currency", "id", "initialBalance", "language" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
