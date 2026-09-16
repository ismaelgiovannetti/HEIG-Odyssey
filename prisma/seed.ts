import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

import { MVP_QUEST_DEFINITIONS } from "../src/lib/quests/definitions";

async function main() {
  console.log("Seeding HEIG Odyssey initial database...");

  // 1. Gacha Banner de base
  const defaultBanner = await prisma.gachaBanner.upsert({
    where: { id: "banner-standard-gen4" },
    update: {},
    create: {
      id: "banner-standard-gen4",
      name: "Portail de Recrutement Standard",
      description:
        "Recrutez des créatures de la région de Sinnoh avec vos Pokédollars gagnés en jeu.",
      costPokedollars: 300,
      rates: {
        common: 0.7,
        rare: 0.25,
        epic: 0.05,
        shinyRate: 0.01,
      },
      poolSpecies: [
        "starly",
        "shinx",
        "bidoof",
        "buizel",
        "cherubi",
        "cranidos",
        "shieldon",
        "gible",
        "riolu",
        "togepi",
        "ralts",
        "lucario",
        "garchomp",
      ],
      isActive: true,
      startDate: new Date(),
    },
  });

  console.log(`Gacha banner created/updated: ${defaultBanner.name}`);

  // 2. Définition des quêtes du MVP (T-US13-06)
  for (const quest of MVP_QUEST_DEFINITIONS) {
    await prisma.questDefinition.upsert({
      where: { id: quest.id },
      update: {
        title: quest.title,
        description: quest.description,
        targetType: quest.targetType,
        targetCount: quest.targetCount,
        rewardPokedollars: quest.rewardPokedollars,
        rewardXp: quest.rewardXp,
      },
      create: quest,
    });
  }

  console.log(
    `MVP quest definitions seeded (${MVP_QUEST_DEFINITIONS.length} quests).`,
  );

  // 3. Compte Administrateur
  const adminEmail = process.env.ADMIN_EMAIL || "admin@heig-odyssey.ch";
  const adminUsername = "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "Gorgonzola123$";
  const hashedPassword = await hashPassword(adminPassword);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: "admin",
      emailVerified: true,
    },
    create: {
      name: "Administrateur",
      username: adminUsername,
      email: adminEmail,
      emailVerified: true,
      role: "admin",
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: adminUser.id },
    update: {
      hasCompletedOnboarding: true,
    },
    create: {
      userId: adminUser.id,
      pokedollars: 999999,
      hasCompletedOnboarding: true,
      onboardingCompletedAt: new Date(),
    },
  });

  await prisma.account.upsert({
    where: {
      issuer_accountId: {
        issuer: "local:credential",
        accountId: adminUser.id,
      },
    },
    update: {
      password: hashedPassword,
    },
    create: {
      userId: adminUser.id,
      accountId: adminUser.id,
      providerId: "credential",
      issuer: "local:credential",
      password: hashedPassword,
    },
  });

  console.log(`Admin user seeded: ${adminEmail} (role: admin)`);
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
