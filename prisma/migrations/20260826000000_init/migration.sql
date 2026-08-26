-- CreateEnum
CREATE TYPE "BattleType" AS ENUM ('CAMPAIGN', 'TRAINING');

-- CreateEnum
CREATE TYPE "BattleResult" AS ENUM ('IN_PROGRESS', 'VICTORY', 'DEFEAT', 'ESCAPED');

-- CreateEnum
CREATE TYPE "QuestType" AS ENUM ('DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pokedollars" INTEGER NOT NULL DEFAULT 0,
    "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_pokemon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "nickname" TEXT,
    "level" INTEGER NOT NULL DEFAULT 5,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "currentHp" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "ivs" JSONB NOT NULL,
    "evs" JSONB NOT NULL,
    "moves" JSONB NOT NULL,
    "ability" TEXT,
    "nature" TEXT,
    "gender" TEXT DEFAULT 'GENDERLESS',
    "isShiny" BOOLEAN NOT NULL DEFAULT false,
    "teamPosition" INTEGER,
    "caughtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pokemon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "firstClearedAt" TIMESTAMP(3),
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "battleType" "BattleType" NOT NULL,
    "opponentId" TEXT NOT NULL,
    "opponentTeamSnapshot" JSONB NOT NULL,
    "playerTeamSnapshot" JSONB NOT NULL,
    "result" "BattleResult" NOT NULL DEFAULT 'IN_PROGRESS',
    "turnsCount" INTEGER NOT NULL DEFAULT 0,
    "rewardsClaimed" BOOLEAN NOT NULL DEFAULT false,
    "xpGained" INTEGER NOT NULL DEFAULT 0,
    "moneyGained" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "battle_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gacha_banner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "costPokedollars" INTEGER NOT NULL DEFAULT 100,
    "rates" JSONB NOT NULL,
    "poolSpecies" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "gacha_banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gacha_pull" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "isShiny" BOOLEAN NOT NULL DEFAULT false,
    "costPaid" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gacha_pull_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_definition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "QuestType" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "rewardPokedollars" INTEGER NOT NULL DEFAULT 50,
    "rewardXp" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "quest_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_rotation" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "type" "QuestType" NOT NULL,
    "questId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quest_rotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quest_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "rewardClaimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_quest_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_userId_key" ON "user_profile"("userId");

-- CreateIndex
CREATE INDEX "user_pokemon_userId_teamPosition_idx" ON "user_pokemon"("userId", "teamPosition");

-- CreateIndex
CREATE INDEX "campaign_progress_userId_worldId_idx" ON "campaign_progress"("userId", "worldId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_progress_userId_stageId_key" ON "campaign_progress"("userId", "stageId");

-- CreateIndex
CREATE UNIQUE INDEX "battle_record_idempotencyKey_key" ON "battle_record"("idempotencyKey");

-- CreateIndex
CREATE INDEX "battle_record_userId_createdAt_idx" ON "battle_record"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "gacha_pull_idempotencyKey_key" ON "gacha_pull"("idempotencyKey");

-- CreateIndex
CREATE INDEX "gacha_pull_userId_pulledAt_idx" ON "gacha_pull"("userId", "pulledAt");

-- CreateIndex
CREATE UNIQUE INDEX "quest_rotation_periodKey_questId_key" ON "quest_rotation"("periodKey", "questId");

-- CreateIndex
CREATE INDEX "user_quest_progress_userId_isCompleted_idx" ON "user_quest_progress"("userId", "isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "user_quest_progress_userId_rotationId_key" ON "user_quest_progress"("userId", "rotationId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_pokemon" ADD CONSTRAINT "user_pokemon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_progress" ADD CONSTRAINT "campaign_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_record" ADD CONSTRAINT "battle_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gacha_pull" ADD CONSTRAINT "gacha_pull_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gacha_pull" ADD CONSTRAINT "gacha_pull_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "gacha_banner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_rotation" ADD CONSTRAINT "quest_rotation_questId_fkey" FOREIGN KEY ("questId") REFERENCES "quest_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "quest_rotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
