/**
 * Utilitaire de dev : marque toutes les étapes de campagne comme terminées
 * pour un compte, ce qui déverrouille l'accès à tout le contenu (et permet de
 * rejouer n'importe quelle étape).
 *
 *   npx tsx scripts/unlock-campaign.ts                 # compte unique ou le plus récent
 *   TARGET_EMAIL=toi@exemple.ch npx tsx scripts/unlock-campaign.ts
 *   npx tsx scripts/unlock-campaign.ts --reset         # remet tout à verrouillé
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const reset = process.argv.includes("--reset");

type CampaignFile = {
  worlds: { id: string; stages: { id: string }[] }[];
};

async function resolveUserId(): Promise<{ id: string; email: string; name: string }> {
  const email = process.env.TARGET_EMAIL?.trim();
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`Aucun compte avec l'email « ${email} ».`);
    return user;
  }
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  if (users.length === 0) throw new Error("Aucun compte en base.");
  if (users.length > 1) {
    console.warn(
      `${users.length} comptes trouvés, utilisation du plus récent (${users[0].email}). ` +
        `Précise TARGET_EMAIL=... pour en choisir un autre.`,
    );
  }
  return users[0];
}

async function main() {
  const campaign = JSON.parse(
    fs.readFileSync(path.resolve("content/campaign.json"), "utf8"),
  ) as CampaignFile;

  const stages = campaign.worlds.flatMap((world) =>
    world.stages.map((stage) => ({ worldId: world.id, stageId: stage.id })),
  );

  const user = await resolveUserId();
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
  let created = 0;
  let updated = 0;
  for (const { worldId, stageId } of stages) {
    const before = await prisma.campaignProgress.findUnique({
      where: { userId_stageId: { userId: user.id, stageId } },
      select: { id: true },
    });
    await prisma.campaignProgress.upsert({
      where: { userId_stageId: { userId: user.id, stageId } },
      create: {
        userId: user.id,
        worldId,
        stageId,
        isCompleted: true,
        firstClearedAt: now,
        unlockedAt: now,
      },
      update: { isCompleted: true, firstClearedAt: now },
    });
    if (before) updated += 1;
    else created += 1;
  }

  console.log(
    `Campagne déverrouillée : ${created} créées, ${updated} mises à jour. ` +
      `Toutes les étapes sont jouables (et rejouables).`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
