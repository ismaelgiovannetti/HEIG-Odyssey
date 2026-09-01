BEGIN;

-- Même ordre de verrouillage que les sauvegardes d'équipe : profil, puis collection.
-- Aucun dépôt concurrent ne peut occuper une case pendant le réaménagement.
LOCK TABLE "user_profile", "user_pokemon" IN ACCESS EXCLUSIVE MODE;

-- Le PC passe de 1 050 à 700 places. Au-delà, on annule TOUTE la migration :
-- il faudra résoudre le dépassement avant de déployer, jamais supprimer un Pokémon.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "user_pokemon"
    WHERE "teamPosition" IS NULL
    GROUP BY "userId" HAVING count(*) > 700
  ) THEN
    RAISE EXCEPTION 'PC_RESIZE_CAPACITY_EXCEEDED: un compte depasse les 700 places du PC';
  END IF;
END;
$$;

ALTER TABLE "user_pokemon" DROP CONSTRAINT "user_pokemon_location_check";

-- Les cases 1 à 35 conservent leurs occupants. Seuls les Pokémon hors du nouveau
-- format rejoignent les premières cases libres, dans leur ancien ordre de rangement.
-- L'équipe active et toutes les autres données des Pokémon restent inchangées.
WITH overflow AS (
  SELECT "id", "userId", row_number() OVER (
    PARTITION BY "userId" ORDER BY "boxNumber", "boxSlot", "id"
  ) AS position
  FROM "user_pokemon"
  WHERE "teamPosition" IS NULL AND ("boxNumber" > 20 OR "boxSlot" > 35)
), affected_users AS (
  SELECT DISTINCT "userId" FROM overflow
), free_cells AS (
  SELECT users."userId", boxes."boxNumber", slots."boxSlot", row_number() OVER (
    PARTITION BY users."userId" ORDER BY boxes."boxNumber", slots."boxSlot"
  ) AS position
  FROM affected_users AS users
  CROSS JOIN generate_series(1, 20) AS boxes("boxNumber")
  CROSS JOIN generate_series(1, 35) AS slots("boxSlot")
  WHERE NOT EXISTS (
    SELECT 1 FROM "user_pokemon" AS occupied
    WHERE occupied."userId" = users."userId" AND occupied."teamPosition" IS NULL
      AND occupied."boxNumber" = boxes."boxNumber" AND occupied."boxSlot" = slots."boxSlot"
  )
)
UPDATE "user_pokemon" AS pokemon
SET "boxNumber" = free_cells."boxNumber", "boxSlot" = free_cells."boxSlot"
FROM overflow
JOIN free_cells ON free_cells."userId" = overflow."userId"
  AND free_cells.position = overflow.position
WHERE pokemon."id" = overflow."id";

-- La base protège elle-même les nouvelles limites, même sans passer par l'API.
ALTER TABLE "user_pokemon" ADD CONSTRAINT "user_pokemon_location_check" CHECK (
  ("teamPosition" IS NOT NULL AND "teamPosition" BETWEEN 1 AND 6
    AND "boxNumber" IS NULL AND "boxSlot" IS NULL)
  OR
  ("teamPosition" IS NULL AND "boxNumber" IS NOT NULL AND "boxSlot" IS NOT NULL
    AND "boxNumber" BETWEEN 1 AND 20 AND "boxSlot" BETWEEN 1 AND 35)
);

-- Les onglets ouverts sur l'ancien format ne doivent pas réécrire un rangement périmé.
UPDATE "user_profile"
SET "collectionRevision" = "collectionRevision" + 1, "updatedAt" = CURRENT_TIMESTAMP;

COMMIT;
