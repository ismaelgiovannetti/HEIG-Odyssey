import { Dex } from "@pkmn/sim";
import fs from "node:fs";
import path from "node:path";
import type {
  CampaignWorld,
  CampaignStage,
  Trainer,
  TrainerPokemon,
  Move,
} from "../src/lib/content/schemas";

const dex = Dex.forGen(4);

// French move name dictionary
const frenchMoveNames: Record<string, string> = {
  tackle: "Charge", scratch: "Griffe", pound: "Écras'Face",
  growl: "Rugissement", leer: "Groz'Yeux", tailwhip: "Mimi-Queue",
  ember: "Flammèche", watergun: "Pistolet à O", absorb: "Vol-Vie",
  vinewhip: "Fouet Lianes", spark: "Étincelle", quickattack: "Vive-Attaque",
  bite: "Morsure", headbutt: "Coup d'Boule", confusion: "Choc Mental",
  poisonsting: "Dard-Venin", peck: "Picpic", gust: "Tornade",
  sandattack: "Jet de Sable", stringshot: "Sécrétion", bubble: "Écume",
  withdraw: "Repli", harden: "Armure", defensecurl: "Boul'Armure",
  supersonic: "Ultrason", astonish: "Étonnement", smog: "Purédpois",
  lick: "Léchouille", hypnosis: "Hypnose", screech: "Grincement",
  sing: "Berceuse", charm: "Charme", thundershock: "Éclair",
  thunderwave: "Cage-Éclair", wrap: "Ligotage", splash: "Trempette",
  teleport: "Téléport", sketch: "Gribouille", present: "Cadeau",
  rockthrow: "Jet-Pierres", mudslap: "Coud'Boue", mudshot: "Tir de Boue",
  furyattack: "Furie", furyswipes: "Combo-Griffe", karatechop: "Poing-Karaté",
  machpunch: "Mach Punch", forcepalm: "Forte-Paume", closecombat: "Close Combat",
  endure: "Ténacité", feintattack: "Feinte", payback: "Représailles",
  snarl: "Aboiement", fakeout: "Bluff", faketears: "Croco Larme",
  rest: "Repos", snore: "Ronflement", sleeptalk: "Blabla Dodo",
  nightshade: "Ombre Nocturne", shadowsneak: "Ombre Portée", shadowclaw: "Griffe Ombre",
  shadowball: "Ball'Ombre", icywind: "Vent Glace", powdersnow: "Poudreuse",
  iceshard: "Éclats Glace", icebeam: "Laser Glace", blizzard: "Blizzard",
  rocksmash: "Éclate-Roc", stealthrock: "Piège de Roc", rollout: "Roulade",
  gyroball: "Gyroballe", irondefense: "Mur de Fer", metalclaw: "Griffe Acier",
  ironhead: "Tête de Fer", flashcannon: "Luminocanon", bulletpunch: "Pisto-Poing",
  dragonrage: "Draco-Rage", dragonbreath: "Dracosouffle", dragonpulse: "Dracochoc",
  dragonclaw: "Dracogriffe", roost: "Atterrissage", aircutter: "Tranch'Air",
  airslash: "Lame d'Air", bravebird: "Rapace", wingattack: "Cru-Ailes",
  aerialace: "Aéropique", drillpeck: "Bec Vrille", fly: "Vol",
  ancientpower: "Pouvoir Antique", bugbuzz: "Bourdon", signalbeam: "Rayon Signal",
  xscissor: "Plaie-Croix", megahorn: "Mégacorne", razorleaf: "Tranch'Herbe",
  magicalleaf: "Feuille Magik", energyball: "Éco-Sphère", gigadrain: "Giga-Sangsue",
  megadrain: "Méga-Sangsue", solarbeam: "Lance-Soleil", woodhammer: "Martobois",
  seedbomb: "Canon Graine", leafblade: "Lame Feuille", leafstorm: "Tempête Verte",
  grassknot: "Nœud Herbe", petaldance: "Danse-Fleur", stunspore: "Para-Spore",
  poisonpowder: "Poudre Toxik", sleeppowder: "Poudre Dodo", spore: "Spore",
  synthesis: "Synthèse", protect: "Abri", swordsdance: "Danse-Lames",
  dragondance: "Danse Draco", agility: "Hâte", calmmind: "Plénitude",
  nastyplot: "Machination", toxic: "Toxik", sludge: "Détritus",
  sludgebomb: "Bomb-Beurk", crosschop: "Coup-Croix", earthquake: "Séisme",
  earthpower: "Telluriforce", flamethrower: "Lance-Flammes", fireblast: "Déflagration",
  firepunch: "Poing Feu", thunderpunch: "Poing Éclair", icepunch: "Poing Glace",
  thunderbolt: "Tonnerre", thunder: "Fatal-Foudre", discharge: "Coup d'Jus",
  surf: "Surf", hydropump: "Hydrocanon", waterfall: "Cascade",
  psychic: "Psyko", psyshock: "Choc Psy", zenheadbutt: "Psykoud'Boul",
  aurasphere: "Aurasphère", focusblast: "Exploforce", darkpulse: "Vibrobscur",
  crunch: "Mâchouille", nightslash: "Tranche-Nuit", stoneedge: "Lame de Roc",
  rockslide: "Éboulement", sacredfire: "Feu Sacré", roaroftime: "Hurle-Temps",
  spacialrend: "Spatio-Rift", shadowforce: "Revenant", judgment: "Jugement"
};

function getFrenchMoveName(id: string, defaultName: string): string {
  return frenchMoveNames[id.toLowerCase()] || defaultName;
}

async function getMovesForPokemon(speciesId: string, level: number): Promise<Move[]> {
  const lData = await dex.learnsets.get(speciesId);
  const movesWithLevel: { id: string; lvl: number }[] = [];

  if (lData && lData.learnset) {
    for (const [mId, learnInfo] of Object.entries(lData.learnset)) {
      let minLvl = 999;
      for (const entry of learnInfo) {
        const match = entry.match(/^[1-4]L(\d+)$/);
        if (match) {
          const lvl = parseInt(match[1], 10);
          if (lvl <= level && lvl < minLvl) minLvl = lvl;
        }
      }
      if (minLvl <= level) {
        movesWithLevel.push({ id: mId, lvl: minLvl });
      }
    }
  }

  // Sort descending to get the strongest / latest learned moves for this level
  movesWithLevel.sort((a, b) => b.lvl - a.lvl);

  let selected = movesWithLevel.slice(0, 4);

  // Fallback if empty
  if (selected.length === 0) {
    selected = [{ id: "tackle", lvl: 1 }];
  }

  return selected.map(({ id }) => {
    const moveData = dex.moves.get(id);
    const frenchMove = getFrenchMoveName(id, moveData.name);
    const moveType = (moveData.type === "???" ? "Ghost" : moveData.type) as any;
    return {
      id: moveData.id,
      name: frenchMove,
      type: moveType,
      category: (moveData.category.toLowerCase() as "physical" | "special" | "status") || "physical",
      power: moveData.basePower || 0,
      accuracy: moveData.accuracy === true ? 100 : (moveData.accuracy as number) || 100,
      pp: moveData.pp,
      maxPp: moveData.pp,
      priority: moveData.priority || 0,
    };
  });
}

async function createTrainerPokemon(
  speciesId: string,
  level: number,
  isShiny = false,
  nickname?: string
): Promise<TrainerPokemon> {
  const moves = await getMovesForPokemon(speciesId, level);
  return {
    speciesId,
    nickname,
    level,
    isShiny,
    moves,
    ivs: {
      hp: Math.min(31, Math.floor(level / 3) + 10),
      atk: Math.min(31, Math.floor(level / 3) + 10),
      def: Math.min(31, Math.floor(level / 3) + 10),
      spa: Math.min(31, Math.floor(level / 3) + 10),
      spd: Math.min(31, Math.floor(level / 3) + 10),
      spe: Math.min(31, Math.floor(level / 3) + 10),
    },
    nature: "Hardy",
  };
}

async function generateCampaignAndTrainers() {
  console.log("Generating campaign and trainers according to HEIG specifications...");

  const trainers: Trainer[] = [];
  const worlds: CampaignWorld[] = [];

  // ==========================================
  // 1. BACHELOR 1 - TYPE NORMAL (Boss: Fouad, 6 stages)
  // ==========================================
  const b1Stages: CampaignStage[] = [];
  const b1Pool = ["bidoof", "rattata", "sentret", "zigzagoon", "starly", "meowth", "aipom", "buneary"];
  
  for (let i = 1; i <= 5; i++) {
    const tId = `trainer-b1-stage-${i}`;
    const lvl = 4 + i * 2; // lvl 6, 8, 10, 12, 14
    const pkmn1 = await createTrainerPokemon(b1Pool[i - 1], lvl);
    const pkmn2 = i >= 3 ? await createTrainerPokemon(b1Pool[i % b1Pool.length], lvl - 1) : undefined;
    
    trainers.push({
      id: tId,
      name: `Étudiant Normal ${i}`,
      title: `Étudiant Bachelor - Semestre 1`,
      aiProfile: "random",
      sprite: "/sprites/trainer-player-back.png",
      introCatchline: `Bienvenue en Bachelor ! Découvrons la puissance du Type Normal.`,
      victoryCatchline: `Bien joué, ton équipe a du potentiel !`,
      defeatCatchline: `Reviens quand tu seras mieux préparé !`,
      musicTrack: "battle-theme-1",
      team: pkmn2 ? [pkmn1, pkmn2] : [pkmn1],
    });

    b1Stages.push({
      id: `bachelor-1-stage-${i}`,
      stageNumber: i,
      name: `Laboratoire Normal - Étape ${i}`,
      description: `Affrontez un étudiant de première année spécialisé dans les créatures de type Normal.`,
      recommendedLevel: lvl,
      trainerId: tId,
      prerequisiteStageId: i === 1 ? null : `bachelor-1-stage-${i - 1}`,
      rewardMoney: 30 + i * 10,
      rewardXp: 50 + i * 20,
    });
  }

  // Boss Fouad (Stage 6)
  const bossFouadPokemon = [
    await createTrainerPokemon("vigoroth", 15),
    await createTrainerPokemon("aipom", 14),
    await createTrainerPokemon("vigoroth", 16),
  ];
  trainers.push({
    id: "boss-fouad",
    name: "Fouad",
    title: "Professeur & Maître du Type Normal",
    aiProfile: "heuristic",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Je suis Fouad ! Montrez-moi si vous avez bien assimilé la structure des données et du type Normal !",
    victoryCatchline: "Excellent travail ! Vous validez officiellement le premier module Bachelor.",
    defeatCatchline: "Il va falloir réviser vos fondamentaux avant le rattrapage !",
    musicTrack: "battle-theme-1",
    team: bossFouadPokemon,
  });
  b1Stages.push({
    id: "bachelor-1-stage-6",
    stageNumber: 6,
    name: "Examen Final Normal - Prof. Fouad",
    description: "Affrontez Fouad et son équipe énergique composée de Vigoroth et Capumain.",
    recommendedLevel: 16,
    trainerId: "boss-fouad",
    prerequisiteStageId: "bachelor-1-stage-5",
    rewardMoney: 150,
    rewardXp: 300,
  });

  worlds.push({
    id: "bachelor-1",
    name: "Bachelor 1 - Type Normal",
    degree: "BACHELOR",
    description: "Apprenez les bases tactiques face au type Normal.",
    stages: b1Stages,
  });

  // ==========================================
  // 2. BACHELOR 2 - TYPE PLANTE (Boss: Nastaran, 7 stages)
  // ==========================================
  const b2Stages: CampaignStage[] = [];
  const b2Pool = ["oddish", "bellsprout", "chikorita", "treecko", "cherubi", "budew", "shroomish", "seedot"];
  
  for (let i = 1; i <= 6; i++) {
    const tId = `trainer-b2-stage-${i}`;
    const lvl = 16 + i; // lvl 17 to 22
    const pkmn1 = await createTrainerPokemon(b2Pool[i - 1], lvl);
    const pkmn2 = await createTrainerPokemon(b2Pool[(i + 2) % b2Pool.length], lvl - 1);

    trainers.push({
      id: tId,
      name: `Herboriste HEIG ${i}`,
      title: `Étudiant Bachelor - Semestre 2`,
      aiProfile: "random",
      sprite: "/sprites/trainer-player-back.png",
      introCatchline: `Les plantes de la HEIG puisent leur force dans la photosynthèse et la stratégie !`,
      victoryCatchline: `Tes flammes ou tes attaques volantes ont eu raison de mes feuilles...`,
      defeatCatchline: `La nature triomphe toujours !`,
      musicTrack: "battle-theme-1",
      team: [pkmn1, pkmn2],
    });

    b2Stages.push({
      id: `bachelor-2-stage-${i}`,
      stageNumber: i,
      name: `Serre Botanique - Étape ${i}`,
      description: `Affrontez les dresseurs de la serre expérimentale.`,
      recommendedLevel: lvl,
      trainerId: tId,
      prerequisiteStageId: i === 1 ? "bachelor-1-stage-6" : `bachelor-2-stage-${i - 1}`,
      rewardMoney: 50 + i * 10,
      rewardXp: 100 + i * 20,
    });
  }

  // Boss Nastaran (Stage 7)
  const bossNastaranPokemon = [
    await createTrainerPokemon("carnivine", 24),
    await createTrainerPokemon("roselia", 25),
    await createTrainerPokemon("weepinbell", 26),
  ];
  trainers.push({
    id: "boss-nastaran",
    name: "Nastaran",
    title: "Professeure & Maîtresse du Type Plante",
    aiProfile: "heuristic",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Bienvenue dans mon laboratoire végétal. Mes plantes sont prêtes pour l'évaluation !",
    victoryCatchline: "Magnifique floraison tactique ! Vous méritez amplement ce certificat.",
    defeatCatchline: "Prenez racine et recommencez avec une stratégie plus affûtée !",
    musicTrack: "battle-theme-1",
    team: bossNastaranPokemon,
  });
  b2Stages.push({
    id: "bachelor-2-stage-7",
    stageNumber: 7,
    name: "Examen Final Plante - Prof. Nastaran",
    description: "Affrontez Nastaran avec Vortente, Rosélia et Boustiflor.",
    recommendedLevel: 26,
    trainerId: "boss-nastaran",
    prerequisiteStageId: "bachelor-2-stage-6",
    rewardMoney: 250,
    rewardXp: 500,
  });

  worlds.push({
    id: "bachelor-2",
    name: "Bachelor 2 - Type Plante",
    degree: "BACHELOR",
    description: "Maîtrisez les statuts, les soins et le type Plante.",
    stages: b2Stages,
  });

  // ==========================================
  // 3. BACHELOR 3 - TYPE ÉLECTRIK (Boss: Mosqueron, 8 stages)
  // ==========================================
  const b3Stages: CampaignStage[] = [];
  const b3Pool = ["voltorb", "magnemite", "pichu", "shinx", "electrike", "plusle", "minun", "pachirisu"];

  for (let i = 1; i <= 7; i++) {
    const tId = `trainer-b3-stage-${i}`;
    const lvl = 26 + i; // lvl 27 to 33
    const pkmn1 = await createTrainerPokemon(b3Pool[i - 1], lvl);
    const pkmn2 = await createTrainerPokemon(b3Pool[(i + 1) % b3Pool.length], lvl);

    trainers.push({
      id: tId,
      name: `Électricien TIC ${i}`,
      title: `Étudiant Bachelor - Semestre 3`,
      aiProfile: "random",
      sprite: "/sprites/trainer-player-back.png",
      introCatchline: `Attention haute tension ! Nos circuits ne laissent rien au hasard.`,
      victoryCatchline: `Court-circuit dans ma stratégie... Bien joué !`,
      defeatCatchline: `Tu as été paralysé par notre vitesse !`,
      musicTrack: "battle-theme-1",
      team: [pkmn1, pkmn2],
    });

    b3Stages.push({
      id: `bachelor-3-stage-${i}`,
      stageNumber: i,
      name: `Centrale Haute Tension - Étape ${i}`,
      description: `Défiez les ingénieurs en génie électrique et télécoms.`,
      recommendedLevel: lvl,
      trainerId: tId,
      prerequisiteStageId: i === 1 ? "bachelor-2-stage-7" : `bachelor-3-stage-${i - 1}`,
      rewardMoney: 80 + i * 15,
      rewardXp: 160 + i * 25,
    });
  }

  // Boss Mosqueron (Stage 8)
  const bossMosqueronPokemon = [
    await createTrainerPokemon("luxio", 34),
    await createTrainerPokemon("magnezone", 36),
    await createTrainerPokemon("electabuzz", 35),
  ];
  trainers.push({
    id: "boss-mosqueron",
    name: "Mosqueron",
    title: "Professeur & Maître du Type Électrik",
    aiProfile: "heuristic",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Le courant alternatif n'a aucun secret pour moi. Préparez-vous à recevoir 100 000 Volts !",
    victoryCatchline: "Votre résistance électrique est remarquable. Vous êtes un ingénieur de haut calibre !",
    defeatCatchline: "Surcharge de puissance ! Revenez après avoir isolé vos faiblesses.",
    musicTrack: "battle-theme-1",
    team: bossMosqueronPokemon,
  });
  b3Stages.push({
    id: "bachelor-3-stage-8",
    stageNumber: 8,
    name: "Examen Final Électrik - Prof. Mosqueron",
    description: "Affrontez Mosqueron avec Luxio, Magnézone et Élektek.",
    recommendedLevel: 36,
    trainerId: "boss-mosqueron",
    prerequisiteStageId: "bachelor-3-stage-7",
    rewardMoney: 400,
    rewardXp: 800,
  });

  worlds.push({
    id: "bachelor-3",
    name: "Bachelor 3 - Type Électrik",
    degree: "BACHELOR",
    description: "Surmontez vitesse, attaques spéciales et paralysie.",
    stages: b3Stages,
  });

  // ==========================================
  // 4. BACHELOR 4 - TYPE ACIER (Boss: Augier, 9 stages)
  // ==========================================
  const b4Stages: CampaignStage[] = [];
  const b4Pool = ["aron", "shieldon", "bronzor", "magnemite", "beldum", "steelix", "lairon", "mawile"];

  for (let i = 1; i <= 8; i++) {
    const tId = `trainer-b4-stage-${i}`;
    const lvl = 36 + i; // lvl 37 to 44
    const pkmn1 = await createTrainerPokemon(b4Pool[i - 1], lvl);
    const pkmn2 = await createTrainerPokemon(b4Pool[(i + 2) % b4Pool.length], lvl - 1);
    const pkmn3 = i >= 5 ? await createTrainerPokemon(b4Pool[(i + 4) % b4Pool.length], lvl - 2) : undefined;

    trainers.push({
      id: tId,
      name: `Métallurgiste HEIG ${i}`,
      title: `Étudiant Bachelor - Semestre 4`,
      aiProfile: "heuristic",
      sprite: "/sprites/trainer-player-back.png",
      introCatchline: `L'acier est l'alliage le plus résistant de l'institut. Peux-tu percer notre blindage ?`,
      victoryCatchline: `Une faille thermique dans mon armure... Belle frappe !`,
      defeatCatchline: `Solide comme le titane, impénétrable comme le diamant !`,
      musicTrack: "battle-theme-1",
      team: pkmn3 ? [pkmn1, pkmn2, pkmn3] : [pkmn1, pkmn2],
    });

    b4Stages.push({
      id: `bachelor-4-stage-${i}`,
      stageNumber: i,
      name: `Fonderie de Précision - Étape ${i}`,
      description: `Affrontez les spécialistes des matériaux lourds et résistances blindées.`,
      recommendedLevel: lvl,
      trainerId: tId,
      prerequisiteStageId: i === 1 ? "bachelor-3-stage-8" : `bachelor-4-stage-${i - 1}`,
      rewardMoney: 120 + i * 20,
      rewardXp: 250 + i * 35,
    });
  }

  // Boss Augier (Stage 9)
  const bossAugierPokemon = [
    await createTrainerPokemon("bastiodon", 45),
    await createTrainerPokemon("scizor", 46),
    await createTrainerPokemon("skarmory", 45),
  ];
  trainers.push({
    id: "boss-augier",
    name: "Augier",
    title: "Professeur & Maître du Type Acier",
    aiProfile: "heuristic",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "La rigueur scientifique est dure comme l'acier trempé. Prouvez votre solidité conceptuelle !",
    victoryCatchline: "Votre analyse est tranchante comme une lame de Cizayox. Validation accordée !",
    defeatCatchline: "Votre approche manque de trempe. Recommencez la modélisation !",
    musicTrack: "battle-theme-1",
    team: bossAugierPokemon,
  });
  b4Stages.push({
    id: "bachelor-4-stage-9",
    stageNumber: 9,
    name: "Examen Final Acier - Prof. Augier",
    description: "Affrontez Augier avec Bastiodon, Cizayox et Airmure.",
    recommendedLevel: 46,
    trainerId: "boss-augier",
    prerequisiteStageId: "bachelor-4-stage-8",
    rewardMoney: 600,
    rewardXp: 1200,
  });

  worlds.push({
    id: "bachelor-4",
    name: "Bachelor 4 - Type Acier",
    degree: "BACHELOR",
    description: "Brisez défenses, immunités et résistances.",
    stages: b4Stages,
  });

  // ==========================================
  // 5. BACHELOR 5 - TYPE PSY (Boss: Tori, 10 stages)
  // ==========================================
  const b5Stages: CampaignStage[] = [];
  const b5Pool = ["abra", "kadabra", "ralts", "kirlia", "drowzee", "hypno", "slowpoke", "spoink", "meditite", "baltoy"];

  for (let i = 1; i <= 9; i++) {
    const tId = `trainer-b5-stage-${i}`;
    const lvl = 46 + i; // lvl 47 to 55
    const pkmn1 = await createTrainerPokemon(b5Pool[i - 1], lvl);
    const pkmn2 = await createTrainerPokemon(b5Pool[(i + 2) % b5Pool.length], lvl);
    const pkmn3 = await createTrainerPokemon(b5Pool[(i + 4) % b5Pool.length], lvl - 1);

    trainers.push({
      id: tId,
      name: `Psychologue Cognitif ${i}`,
      title: `Étudiant Bachelor - Semestre 5 & 6`,
      aiProfile: "heuristic",
      sprite: "/sprites/trainer-player-back.png",
      introCatchline: `J'ai déjà lu dans tes pensées. Ton prochain coup est voué à l'échec !`,
      victoryCatchline: `Ton esprit tactique est trop complexe à anticiper...`,
      defeatCatchline: `La télékinésie et les ondes mentales ont eu raison de toi.`,
      musicTrack: "battle-theme-1",
      team: [pkmn1, pkmn2, pkmn3],
    });

    b5Stages.push({
      id: `bachelor-5-stage-${i}`,
      stageNumber: i,
      name: `Laboratoire d'IA & Cognition - Étape ${i}`,
      description: `Testez votre anticipation contre les maîtres des pouvoirs psychiques.`,
      recommendedLevel: lvl,
      trainerId: tId,
      prerequisiteStageId: i === 1 ? "bachelor-4-stage-9" : `bachelor-5-stage-${i - 1}`,
      rewardMoney: 180 + i * 25,
      rewardXp: 350 + i * 50,
    });
  }

  // Boss Tori (Stage 10)
  const bossToriPokemon = [
    await createTrainerPokemon("slowbro", 54),
    await createTrainerPokemon("gallade", 56),
    await createTrainerPokemon("gardevoir", 56),
    await createTrainerPokemon("kirlia", 53),
    await createTrainerPokemon("exeggutor", 55),
  ];
  trainers.push({
    id: "boss-tori",
    name: "Tori",
    title: "Professeur & Maître du Type Psy (Doyen Bachelor)",
    aiProfile: "heuristic",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Le Bachelor touche à sa fin. Affrontez la puissance pure de la cognition et de la télépathie !",
    victoryCatchline: "Brillantissime ! Vous obtenez votre Diplôme de Bachelor en Ingénierie Pokémon !",
    defeatCatchline: "Votre esprit vacille sous la pression. Méditez et revenez plus fort !",
    musicTrack: "battle-theme-1",
    team: bossToriPokemon,
  });
  b5Stages.push({
    id: "bachelor-5-stage-10",
    stageNumber: 10,
    name: "Examen de Diplôme Bachelor - Prof. Tori",
    description: "Affrontez Tori et son équipe psychique : Flagadoss, Gallame, Gardevoir, Kirlia et Noadkoko.",
    recommendedLevel: 56,
    trainerId: "boss-tori",
    prerequisiteStageId: "bachelor-5-stage-9",
    rewardMoney: 1000,
    rewardXp: 2500,
  });

  worlds.push({
    id: "bachelor-5",
    name: "Bachelor 5 - Type Psy",
    degree: "BACHELOR",
    description: "Dominez le type Psy pour décrocher votre Bachelor.",
    stages: b5Stages,
  });

  // ==========================================
  // 6. MASTER 1 - DOUBLE TYPE POISON / TÉNÈBRES (Boss: Gamba, 11 stages)
  // ==========================================
  const m1Stages: CampaignStage[] = [];
  const m1Pool = ["gastly", "haunter", "gengar", "zubat", "crobat", "houndour", "houndoom", "murkrow", "sneasel", "weavile", "skorupi", "drapion", "cacturne", "crawdaunt"];

  for (let i = 1; i <= 10; i++) {
    const tId = `trainer-m1-stage-${i}`;
    const lvl = 56 + i; // lvl 57 to 66
    const pkmn1 = await createTrainerPokemon(m1Pool[i - 1], lvl);
    const pkmn2 = await createTrainerPokemon(m1Pool[(i + 2) % m1Pool.length], lvl);
    const pkmn3 = await createTrainerPokemon(m1Pool[(i + 4) % m1Pool.length], lvl - 1);
    const pkmn4 = i >= 6 ? await createTrainerPokemon(m1Pool[(i + 6) % m1Pool.length], lvl - 2) : undefined;

    trainers.push({
      id: tId,
      name: `Chercheur en Toxicologie & Ombre ${i}`,
      title: `Étudiant Master - Sécurité & Dark Systems`,
      aiProfile: "heuristic",
      sprite: "/sprites/trainer-player-back.png",
      introCatchline: `Le Master ne tolère aucune vulnérabilité. Le poison et les ombres vont tester tes défenses !`,
      victoryCatchline: `Tu as su dissiper les ténèbres... Chapeau !`,
      defeatCatchline: `Tu as succombé au poison et aux coups sournois.`,
      musicTrack: "battle-theme-1",
      team: pkmn4 ? [pkmn1, pkmn2, pkmn3, pkmn4] : [pkmn1, pkmn2, pkmn3],
    });

    m1Stages.push({
      id: `master-1-stage-${i}`,
      stageNumber: i,
      name: `Laboratoire Toxique & Sécurité - Étape ${i}`,
      description: `Naviguez à travers les pièges des doubles types Poison et Ténèbres.`,
      recommendedLevel: lvl,
      trainerId: tId,
      prerequisiteStageId: i === 1 ? "bachelor-5-stage-10" : `master-1-stage-${i - 1}`,
      rewardMoney: 300 + i * 35,
      rewardXp: 600 + i * 70,
    });
  }

  // Boss Gamba (Stage 11)
  const bossGambaPokemon = [
    await createTrainerPokemon("drapion", 68),
    await createTrainerPokemon("gengar", 69),
    await createTrainerPokemon("haunter", 66),
    await createTrainerPokemon("weavile", 70),
    await createTrainerPokemon("crawdaunt", 67),
    await createTrainerPokemon("cacturne", 68),
  ];
  trainers.push({
    id: "boss-gamba",
    name: "Gamba",
    title: "Doyen Master - Maître Poison / Ténèbres",
    aiProfile: "heuristic",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Le monde réel est impitoyable, empli de poisons subtils et d'embuscades dans l'ombre. Survivrez-vous à mon escouade ?",
    victoryCatchline: "Une résilience hors norme ! Vous purifiez le venin et maîtrisez les ombres.",
    defeatCatchline: "L'ombre vous a englouti. Préparez un antidote et revenez !",
    musicTrack: "battle-theme-1",
    team: bossGambaPokemon,
  });
  m1Stages.push({
    id: "master-1-stage-11",
    stageNumber: 11,
    name: "Épreuve Majeure Poison/Ténèbres - Doyen Gamba",
    description: "Affrontez Gamba et ses 6 créatures d'élite : Drascore, Ectoplasma, Spectrum, Dimoret, Colhomard et Cacturne.",
    recommendedLevel: 70,
    trainerId: "boss-gamba",
    prerequisiteStageId: "master-1-stage-10",
    rewardMoney: 1800,
    rewardXp: 4500,
  });

  worlds.push({
    id: "master-1",
    name: "Master 1 - Double Type Poison / Ténèbres",
    degree: "MASTER",
    description: "Déjouez les tactiques Poison et Ténèbres.",
    stages: m1Stages,
  });

  // ==========================================
  // 7. MASTER 2 - DOUBLE TYPE DRAGON / GLACE (Boss: Auberson, 12 stages)
  // ==========================================
  const m2Stages: CampaignStage[] = [];
  const m2Pool = ["dratini", "dragonair", "dragonite", "bagon", "shelgon", "salamence", "gible", "gabite", "garchomp", "swinub", "piloswine", "mamoswine", "snorunt", "glalie", "spheal", "sealeo", "walrein", "lapras"];

  for (let i = 1; i <= 11; i++) {
    const tId = `trainer-m2-stage-${i}`;
    const lvl = 70 + i; // lvl 71 to 81
    const pkmn1 = await createTrainerPokemon(m2Pool[i - 1], lvl);
    const pkmn2 = await createTrainerPokemon(m2Pool[(i + 3) % m2Pool.length], lvl);
    const pkmn3 = await createTrainerPokemon(m2Pool[(i + 6) % m2Pool.length], lvl - 1);
    const pkmn4 = await createTrainerPokemon(m2Pool[(i + 9) % m2Pool.length], lvl - 1);

    trainers.push({
      id: tId,
      name: `Chercheur Cryo-Draconique ${i}`,
      title: `Étudiant Master 2 - Recherche de Pointe`,
      aiProfile: "heuristic",
      sprite: "/sprites/trainer-player-back.png",
      introCatchline: `Le zéro absolu rencontre le feu des dragons ancestraux. Es-tu prêt pour l'impact ?`,
      victoryCatchline: `Une chaleur et une détermination qui brisent la glace... Impressionnant !`,
      defeatCatchline: `Tu as gelé sur place face à nos écailles draconiques !`,
      musicTrack: "battle-theme-1",
      team: [pkmn1, pkmn2, pkmn3, pkmn4],
    });

    m2Stages.push({
      id: `master-2-stage-${i}`,
      stageNumber: i,
      name: `Pic Glaciaire des Dragons - Étape ${i}`,
      description: `Affrontez l'élite des dresseurs de dragons et créatures glaciaires.`,
      recommendedLevel: lvl,
      trainerId: tId,
      prerequisiteStageId: i === 1 ? "master-1-stage-11" : `master-2-stage-${i - 1}`,
      rewardMoney: 500 + i * 50,
      rewardXp: 1000 + i * 100,
    });
  }

  // Boss Auberson (Stage 12)
  const bossAubersonPokemon = [
    await createTrainerPokemon("mamoswine", 82),
    await createTrainerPokemon("garchomp", 84),
    await createTrainerPokemon("salamence", 83),
    await createTrainerPokemon("glalie", 81),
    await createTrainerPokemon("delibird", 80),
    await createTrainerPokemon("lapras", 83),
  ];
  trainers.push({
    id: "boss-auberson",
    name: "Auberson",
    title: "Doyen Master - Maître Dragon / Glace",
    aiProfile: "heuristic",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Le blizzard et la fureur draconique forgent les plus grands scientifiques. Prouvez votre maîtrise finale du Master !",
    victoryCatchline: "Magistral ! Vous obtenez votre Diplôme de Master of Science avec les félicitations du jury !",
    defeatCatchline: "La tempête polaire a éteint votre élan. Rallumez votre flamme !",
    musicTrack: "battle-theme-1",
    team: bossAubersonPokemon,
  });
  m2Stages.push({
    id: "master-2-stage-12",
    stageNumber: 12,
    name: "Examen de Diplôme Master - Doyen Auberson",
    description: "Affrontez Auberson et son équipe colossale : Mammochon, Carchacrok, Drattak, Oniglali, Cadoizo et Lokhlass.",
    recommendedLevel: 84,
    trainerId: "boss-auberson",
    prerequisiteStageId: "master-2-stage-11",
    rewardMoney: 3000,
    rewardXp: 8000,
  });

  worlds.push({
    id: "master-2",
    name: "Master 2 - Double Type Dragon / Glace",
    degree: "MASTER",
    description: "Affrontez la puissance des Dragons et de la Glace.",
    stages: m2Stages,
  });

  // ==========================================
  // 8. DOCTORAT - END-GAME (6 Bosses finaux : Équipe HEIG & Professeurs)
  // ==========================================
  const docStages: CampaignStage[] = [];

  // 1. Tiago (lvl 88-90)
  const tiagoTeam = [
    await createTrainerPokemon("hooh", 90),
    await createTrainerPokemon("xatu", 88),
    await createTrainerPokemon("pelipper", 89, true), // Shiny
    await createTrainerPokemon("staraptor", 90),
    await createTrainerPokemon("chatot", 88),
    await createTrainerPokemon("pidgeot", 89),
  ];
  trainers.push({
    id: "boss-doc-tiago",
    name: "Tiago",
    title: "Doctorant en Architectures Avancées",
    aiProfile: "heuristic",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Mon escouade aérienne domine les cieux avec Ho-Oh et mon Bekipan chromatique. Prépare-toi au décollage !",
    victoryCatchline: "Tu as su percer mes rafales de vent ! Quel combat époustouflant !",
    defeatCatchline: "Reprends de la hauteur et réessaye !",
    musicTrack: "battle-theme-1",
    team: tiagoTeam,
  });
  docStages.push({
    id: "doctorat-stage-1",
    stageNumber: 1,
    name: "Doctorat - Épreuve 1 : Tiago",
    description: "Affrontez Tiago avec son escouade aérienne légendaire (Ho-Oh, Xatu, Bekipan shiny, Étouraptor, Pijako, Roucarnage).",
    recommendedLevel: 90,
    trainerId: "boss-doc-tiago",
    prerequisiteStageId: "master-2-stage-12",
    rewardMoney: 5000,
    rewardXp: 12000,
  });

  // 2. Mo (lvl 90-92)
  const moTeam = [
    await createTrainerPokemon("infernape", 92),
    await createTrainerPokemon("luxray", 91, true), // Shiny
    await createTrainerPokemon("staraptor", 91),
    await createTrainerPokemon("garchomp", 92),
    await createTrainerPokemon("gyarados", 91),
    await createTrainerPokemon("dialga", 93),
  ];
  trainers.push({
    id: "boss-doc-mo",
    name: "Mo",
    title: "Doctorant en Intelligence Artificielle",
    aiProfile: "heuristic",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Mon IA prédit tous vos mouvements dans l'espace-temps avec Dialga et Simiabraz. L'algorithme parfait existe !",
    victoryCatchline: "Impressionnant, vous avez dépassé les calculs de mes réseaux de neurones !",
    defeatCatchline: "La puissance temporelle de Dialga était inarrêtable !",
    musicTrack: "battle-theme-1",
    team: moTeam,
  });
  docStages.push({
    id: "doctorat-stage-2",
    stageNumber: 2,
    name: "Doctorat - Épreuve 2 : Mo",
    description: "Affrontez Mo et sa composition dévastatrice (Simiabraz, Luxray shiny, Étouraptor, Carchacrok, Léviator, Dialga).",
    recommendedLevel: 93,
    trainerId: "boss-doc-mo",
    prerequisiteStageId: "doctorat-stage-1",
    rewardMoney: 6000,
    rewardXp: 15000,
  });

  // 3. Ismael (lvl 92-94)
  const ismaelTeam = [
    await createTrainerPokemon("breloom", 93, true), // Shiny
    await createTrainerPokemon("wailord", 92),
    await createTrainerPokemon("palkia", 94),
    await createTrainerPokemon("sableye", 92),
    await createTrainerPokemon("flygon", 93),
    await createTrainerPokemon("claydol", 93),
  ];
  trainers.push({
    id: "boss-doc-ismael",
    name: "Ismael",
    title: "Doctorant en Systèmes Distribués & Résilience",
    aiProfile: "heuristic",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Mon infrastructure est bâtie pour encaisser n'importe quelle charge, avec Palkia pour distordre les dimensions !",
    victoryCatchline: "Tu as trouvé la faille dans mon architecture haute disponibilité ! Chapeau bas !",
    defeatCatchline: "Le système est resté 100% résilient face à tes attaques !",
    musicTrack: "battle-theme-1",
    team: ismaelTeam,
  });
  docStages.push({
    id: "doctorat-stage-3",
    stageNumber: 3,
    name: "Doctorat - Épreuve 3 : Ismael",
    description: "Affrontez Ismael et son escouade dimensionnelle (Chapignon shiny, Wailord, Palkia, Ténéfix, Libégon, Kaorine).",
    recommendedLevel: 94,
    trainerId: "boss-doc-ismael",
    prerequisiteStageId: "doctorat-stage-2",
    rewardMoney: 7000,
    rewardXp: 18000,
  });

  // 4. Evan (lvl 94-96)
  const evanTeam = [
    await createTrainerPokemon("mismagius", 95),
    await createTrainerPokemon("metagross", 96, true), // Shiny
    await createTrainerPokemon("blaziken", 95),
    await createTrainerPokemon("glaceon", 94),
    await createTrainerPokemon("torterra", 95),
    await createTrainerPokemon("lugia", 96),
  ];
  trainers.push({
    id: "boss-doc-evan",
    name: "Evan",
    title: "Doctorant en Sécurité & Cryptographie",
    aiProfile: "heuristic",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Mon blindage cryptographique est impénétrable avec Métalosse chromatique et Lugia le gardien des abysses !",
    victoryCatchline: "Tu as déchiffré mes défenses les plus inviolables. Respect !",
    defeatCatchline: "Chiffrement intact. Tes attaques ont été rejetées !",
    musicTrack: "battle-theme-1",
    team: evanTeam,
  });
  docStages.push({
    id: "doctorat-stage-4",
    stageNumber: 4,
    name: "Doctorat - Épreuve 4 : Evan",
    description: "Affrontez Evan et ses créatures titanesques (Magirêve, Métalosse shiny, Braségali, Givrali, Torterra, Lugia).",
    recommendedLevel: 96,
    trainerId: "boss-doc-evan",
    prerequisiteStageId: "doctorat-stage-3",
    rewardMoney: 8000,
    rewardXp: 22000,
  });

  // 5. Hêche (lvl 96-98)
  const hecheTeam = [
    await createTrainerPokemon("giratina", 98, true), // Shiny
    await createTrainerPokemon("tyranitar", 97),
    await createTrainerPokemon("dragonite", 98),
    await createTrainerPokemon("drifblim", 96),
    await createTrainerPokemon("spiritomb", 97),
    await createTrainerPokemon("rhyperior", 97),
  ];
  trainers.push({
    id: "boss-doc-heche",
    name: "Professeur Hêche",
    title: "Doyen de l'École Doctorale",
    aiProfile: "expectiminimax",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Vous entrez dans le Monde Distorsion. Giratina et mes titans antiques vont juger votre thèse finale !",
    victoryCatchline: "Une soutenance héroïque et magistrale ! Votre thèse est acceptée avec la plus haute mention !",
    defeatCatchline: "La distorsion temporelle a anéanti votre équipe. Préparez une nouvelle soutenance !",
    musicTrack: "battle-theme-1",
    team: hecheTeam,
  });
  docStages.push({
    id: "doctorat-stage-5",
    stageNumber: 5,
    name: "Doctorat - Épreuve 5 : Prof. Hêche",
    description: "Affrontez le Professeur Hêche (Giratina shiny, Tyranocif, Dracolosse, Grodrive, Spiritomb, Rhinastoc).",
    recommendedLevel: 98,
    trainerId: "boss-doc-heche",
    prerequisiteStageId: "doctorat-stage-4",
    rewardMoney: 12000,
    rewardXp: 30000,
  });

  // 6. Donini (lvl 100 - ULTIMATE BOSS)
  const doniniTeam = [
    await createTrainerPokemon("pikachu", 100),
    await createTrainerPokemon("snorlax", 100),
    await createTrainerPokemon("venusaur", 100),
    await createTrainerPokemon("blastoise", 100),
    await createTrainerPokemon("charizard", 100, true), // Shiny
    await createTrainerPokemon("arceus", 100),
  ];
  trainers.push({
    id: "boss-doc-donini",
    name: "Directeur Donini",
    title: "Directeur Général de la HEIG-VD & Maître Suprême",
    aiProfile: "expectiminimax",
    sprite: "/sprites/trainer-champion-front.png",
    introCatchline: "Bienvenue à l'ultime frontière du savoir. Arceus le créateur et les légendes de la HEIG vous défient au sommet !",
    victoryCatchline: "LÉGENDAIRE ! Vous devenez le Grand Maître et Docteur Suprême de HEIG Odyssey !",
    defeatCatchline: "La puissance créatrice d'Arceus est infinie. Continuez d'apprendre et de vous surpasser !",
    musicTrack: "battle-theme-1",
    team: doniniTeam,
  });
  docStages.push({
    id: "doctorat-stage-6",
    stageNumber: 6,
    name: "Doctorat - Combat Ultime : Directeur Donini",
    description: "Le combat final du jeu contre le Directeur Donini (Pikachu, Ronflex, Florizarre, Tortank, Dracaufeu shiny, Arceus).",
    recommendedLevel: 100,
    trainerId: "boss-doc-donini",
    prerequisiteStageId: "doctorat-stage-5",
    rewardMoney: 25000,
    rewardXp: 50000,
  });

  worlds.push({
    id: "doctorat",
    name: "Doctorat - La Thèse Finale",
    degree: "DOCTORAT",
    description: "Affrontez les créateurs de HEIG Odyssey.",
    stages: docStages,
  });

  // Musique de combat propre à chaque boss (fichiers dans public/audio/tracks).
  // Les dresseurs ordinaires gardent battle-theme-1.
  const BOSS_MUSIC_TRACKS: Record<string, string> = {
    "boss-fouad": "gym-leader-hgss",
    "boss-nastaran": "gym-leader-rse",
    "boss-mosqueron": "gym-leader-dpp",
    "boss-augier": "zinnia-battle-oras",
    "boss-tori": "boss-lysandre-xy",
    "boss-gamba": "boss-giovanni-usum",
    "boss-auberson": "giratina-battle-pla",
    "boss-doc-tiago": "champion-diantha-xy",
    "boss-doc-mo": "champion-alder-bw",
    "boss-doc-ismael": "champion-cynthia-dpp",
    "boss-doc-evan": "chairman-rose-swsh",
    "boss-doc-donini": "hooh-battle-hgss",
    "boss-doc-heche": "n-final-battle-bw",
  };
  for (const trainer of trainers) {
    const bossTrack = BOSS_MUSIC_TRACKS[trainer.id];
    if (bossTrack) trainer.musicTrack = bossTrack;
  }

  // Write content/trainers.json
  const trainersFile = path.join(process.cwd(), "content", "trainers.json");
  fs.writeFileSync(
    trainersFile,
    JSON.stringify({ version: "1.0.0", trainers }, null, 2),
    "utf-8"
  );

  // Write content/campaign.json
  const campaignFile = path.join(process.cwd(), "content", "campaign.json");
  fs.writeFileSync(
    campaignFile,
    JSON.stringify({ version: "1.0.0", worlds }, null, 2),
    "utf-8"
  );

  console.log(`Campaign successfully generated!`);
  console.log(`- Total worlds: ${worlds.length}`);
  console.log(`- Total trainers: ${trainers.length}`);
}

generateCampaignAndTrainers().catch((err) => {
  console.error("Error generating campaign and trainers:", err);
  process.exit(1);
});
