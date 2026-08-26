import { PrismaClient, QuestType } from '@prisma/client';

const prisma = new PrismaClient();

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
      costPokedollars: 100,
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

  // 2. Définition des quêtes initiales (Quotidiennes & Hebdomadaires)
  const quests = [
    {
      id: 'quest-daily-battles-1',
      title: 'Premier combat du jour',
      description: 'Terminer 1 combat en campagne ou en entraînement.',
      type: QuestType.DAILY,
      targetType: 'COMPLETE_BATTLES',
      targetCount: 1,
      rewardPokedollars: 50,
      rewardXp: 100,
    },
    {
      id: 'quest-daily-win-training',
      title: 'Entraînement tactique',
      description: 'Remporter 1 combat en mode entraînement.',
      type: QuestType.DAILY,
      targetType: 'WIN_TRAINING',
      targetCount: 1,
      rewardPokedollars: 80,
      rewardXp: 150,
    },
    {
      id: 'quest-weekly-master-5',
      title: 'Défis de la semaine',
      description: 'Remporter 5 combats au total cette semaine.',
      type: QuestType.WEEKLY,
      targetType: 'WIN_BATTLES',
      targetCount: 5,
      rewardPokedollars: 300,
      rewardXp: 500,
    },
  ];

  for (const quest of quests) {
    await prisma.questDefinition.upsert({
      where: { id: quest.id },
      update: {},
      create: quest,
    });
  }

  console.log(`Initial quest definitions seeded (${quests.length} quests).`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
