import { PrismaClient, QuestType } from '@prisma/client';

const prisma = new PrismaClient();

import { MVP_QUEST_DEFINITIONS } from '../src/lib/quests/definitions';

async function main() {
  console.log('Seeding HEIG Odyssey initial database...');

  // 1. Gacha Banner de base
  const defaultBanner = await prisma.gachaBanner.upsert({
    where: { id: 'banner-standard-gen4' },
    update: {},
    create: {
      id: 'banner-standard-gen4',
      name: 'Portail de Recrutement Standard',
      description: 'Recrutez des créatures de la région de Sinnoh avec vos Pokédollars gagnés en jeu.',
      costPokedollars: 300,
      rates: {
        common: 0.70,
        rare: 0.25,
        epic: 0.05,
        shinyRate: 0.01,
      },
      poolSpecies: [
        'starly', 'shinx', 'bidoof', 'buizel', 'cherubi',
        'cranidos', 'shieldon', 'gible', 'riolu', 'togepi',
        'ralts', 'lucario', 'garchomp'
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

  console.log(`MVP quest definitions seeded (${MVP_QUEST_DEFINITIONS.length} quests).`);
}


main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
