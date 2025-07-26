-- CreateTable
CREATE TABLE "events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "secret_key" TEXT,
    "event_title" TEXT,
    "event_description" TEXT,
    "credits_per_voter" INTEGER NOT NULL DEFAULT 5,
    "start_event_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_event_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_data" JSONB
);

-- CreateTable
CREATE TABLE "voters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "voter_name" TEXT
);

-- CreateTable
CREATE TABLE "voter_on_event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event_id" INTEGER NOT NULL,
    "voter_id" INTEGER NOT NULL,
    CONSTRAINT "voter_on_event_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "voter_on_event_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "voters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "votes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event_item_id" INTEGER NOT NULL,
    "voter_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    CONSTRAINT "votes_event_item_id_fkey" FOREIGN KEY ("event_item_id") REFERENCES "event_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "voters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "event_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by_user_id" INTEGER NOT NULL,
    CONSTRAINT "event_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_EventToVoter" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_EventToVoter_A_fkey" FOREIGN KEY ("A") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_EventToVoter_B_fkey" FOREIGN KEY ("B") REFERENCES "voters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_EventToVoter_AB_unique" ON "_EventToVoter"("A", "B");

-- CreateIndex
CREATE INDEX "_EventToVoter_B_index" ON "_EventToVoter"("B");

-- CreateIndex
CREATE UNIQUE INDEX "votes_event_item_id_voter_id_key" ON "votes"("event_item_id", "voter_id");
