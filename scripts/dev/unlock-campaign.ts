/**
 * Utilitaire de dev : marque toutes les étapes de campagne comme terminées
 * pour un compte, ce qui déverrouille l'accès à tout le contenu (et permet de
 * rejouer n'importe quelle étape).
 *
 * L'adresse du compte et l'action sont obligatoires afin d'éviter toute
 * modification accidentelle d'un autre environnement.
 *
 *   TARGET_EMAIL=toi@exemple.ch npx tsx scripts/dev/unlock-campaign.ts --unlock
 *   TARGET_EMAIL=toi@exemple.ch npx tsx scripts/dev/unlock-campaign.ts --reset
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const unlock = process.argv.includes("--unlock");
const reset = process.argv.includes("--reset");

type CampaignFile = {
  worlds: { id: string; stages: { id: string }[] }[];
};

function validateArguments(): string {
  if (unlock === reset) {
    throw new Error("Indique exactement une action : --unlock ou --reset.");
  }

  const email = process.env.TARGET_EMAIL?.trim();
  if (!email) {
    throw new Error("TARGET_EMAIL est obligatoire.");
  }

  return email;
}

async function main() {
  const email = validateArguments();
  const campaign = JSON.parse(
    fs.readFileSync(path.resolve("content/campaign.json"), "utf8"),
  ) as CampaignFile;

  const stages = campaign.worlds.flatMap((world) =>
    world.stages.map((stage) => ({ worldId: world.id, stageId: stage.id })),
  );

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`Aucun compte avec l'email « ${email} ».`);
  }

  console.log(`Compte cible : ${user.name} <${user.email}> (${user.id})`);
  console.log(`${stages.length} étapes de campagne.`);

  if (reset) {
    const { count } = await prisma.campaignProgress.deleteMany({
      where: { userId: user.id },
    });
    console.log(`Réinitialisé : ${count} lignes supprimées.`);
    return;
  }

  const now = new Date();
  const existingProgress = await prisma.campaignProgress.findMany({
    where: {
      userId: user.id,
      stageId: { in: stages.map(({ stageId }) => stageId) },
    },
    select: { stageId: true, firstClearedAt: true },
  });
  const existingByStage = new Map(
    existingProgress.map((progress) => [progress.stageId, progress]),
  );

  await prisma.$transaction(
    stages.map(({ worldId, stageId }) => {
      const existing = existingByStage.get(stageId);
      return prisma.campaignProgress.upsert({
        where: { userId_stageId: { userId: user.id, stageId } },
        create: {
          userId: user.id,
          worldId,
          stageId,
          isCompleted: true,
          firstClearedAt: now,
          unlockedAt: now,
        },
        update: {
          worldId,
          isCompleted: true,
          firstClearedAt: existing?.firstClearedAt ?? now,
          unlockedAt: now,
        },
      });
    }),
  );

  console.log(
    `Campagne déverrouillée : ${stages.length - existingProgress.length} créées, ` +
      `${existingProgress.length} mises à jour. ` +
      `Toutes les étapes sont jouables (et rejouables).`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
