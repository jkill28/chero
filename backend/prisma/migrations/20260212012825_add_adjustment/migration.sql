-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "recurrence" TEXT NOT NULL,
    "isAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
    "recurrenceEndDate" DATETIME,
    "excludedDates" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Transaction" ("amount", "createdAt", "date", "description", "excludedDates", "id", "recurrence", "recurrenceEndDate", "recurrenceInterval", "updatedAt") SELECT "amount", "createdAt", "date", "description", "excludedDates", "id", "recurrence", "recurrenceEndDate", "recurrenceInterval", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
