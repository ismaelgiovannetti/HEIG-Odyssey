BEGIN;

ALTER TABLE "user_profile" ADD COLUMN "collectionRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_pokemon" ADD COLUMN "boxNumber" INTEGER;
ALTER TABLE "user_pokemon" ADD COLUMN "boxSlot" INTEGER;

-- Les créatures déjà stockées gardent un ordre stable ; aucune n'est supprimée.
-- Si un compte dépasse 1 050 places, la contrainte ci-dessous arrête la migration
-- entière : il faut alors augmenter la capacité avant de relancer le déploiement.
WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "userId" ORDER BY "caughtAt", "id"
  ) AS position
  FROM "user_pokemon" WHERE "teamPosition" IS NULL
)
UPDATE "user_pokemon" AS pokemon
SET "boxNumber" = ((ranked.position - 1) / 70 + 1)::INTEGER,
    "boxSlot" = ((ranked.position - 1) % 70 + 1)::INTEGER
FROM ranked WHERE pokemon."id" = ranked."id";

-- Une créature occupe exactement une place : équipe OU PC, jamais les deux.
ALTER TABLE "user_pokemon" ADD CONSTRAINT "user_pokemon_location_check" CHECK (
  ("teamPosition" IS NOT NULL AND "teamPosition" BETWEEN 1 AND 6
    AND "boxNumber" IS NULL AND "boxSlot" IS NULL)
  OR
  ("teamPosition" IS NULL AND "boxNumber" IS NOT NULL AND "boxSlot" IS NOT NULL
    AND "boxNumber" BETWEEN 1 AND 15 AND "boxSlot" BETWEEN 1 AND 70)
);

DROP INDEX "user_pokemon_userId_teamPosition_idx";

-- Un échange peut occuper provisoirement la même case dans la transaction.
-- Seul l'état final est accepté ; deux créatures ne peuvent jamais y rester.
ALTER TABLE "user_pokemon" ADD CONSTRAINT "user_pokemon_userId_teamPosition_key"
  UNIQUE ("userId", "teamPosition") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "user_pokemon" ADD CONSTRAINT "user_pokemon_userId_boxNumber_boxSlot_key"
  UNIQUE ("userId", "boxNumber", "boxSlot") DEFERRABLE INITIALLY DEFERRED;

COMMIT;
