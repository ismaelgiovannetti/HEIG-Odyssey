/**
 * Dictionnaire français exhaustif des capacités Pokémon (Générations 1 à 4).
 */
export const FRENCH_MOVE_NAMES: Record<string, string> = {
  // Normal
  tackle: "Charge", scratch: "Griffe", pound: "Écras'Face", bodyslam: "Plaquage",
  doubleedge: "Damoclès", takedown: "Bélier", headbutt: "Coup d'Boule",
  hyperbeam: "Ultralaser", gigaimpact: "Giga Impact", slash: "Tranche",
  triattack: "Triplattaque", extremespeed: "Vitesse Extrême", quickattack: "Vive-Attaque",
  fakeout: "Bluff", feint: "Ruse", facade: "Façade", return: "Retour",
  frustration: "Frustration", swift: "Météores", hypervoice: "Mégaphone",
  uproar: "Brouhaha", snore: "Ronflement", naturepower: "Force-Nature",
  secretpower: "Force Cachée", hiddenpower: "Puissance Cachée", struggle: "Lutte",
  substitute: "Clonage", protect: "Abri", detect: "Détection", endure: "Ténacité",
  bellydrum: "Cognobidon", swordsdance: "Danse-Lames", growth: "Croissance",
  sharpen: "Affilage", minimize: "Lilliput", doubleteam: "Reflet", flash: "Flash",
  sandattack: "Jet de Sable", smokescreen: "Brouillard", sweetscent: "Doux Parfum",
  screech: "Grincement", growl: "Rugissement", leer: "Groz'Yeux", tailwhip: "Mimi-Queue",
  charm: "Charme", captivate: "Séduction", attract: "Attraction", sing: "Berceuse",
  supersonic: "Ultrason", teeterdance: "Danse Folle", swagger: "Vantardise",
  encore: "Encore", disable: "Entrave", yawn: "Bâillement", roar: "Hurlement",
  whirlwind: "Cyclone", perishsong: "Requiem", painsplit: "Balance", endeavor: "Effort",
  superfang: "Croc Fatal", hyperfang: "Croc de Mort", crushclaw: "Éclate-Griffe",
  dizzypunch: "Uppercut", megapunch: "Ultimapoing", megakick: "Ultimawashi",
  slam: "Souplesse", wrap: "Ligotage", bind: "Étreinte", constrict: "Constriction",
  splash: "Trempette", transform: "Morphing", metronome: "Métronome", mimic: "Copie",
  sketch: "Gribouille", copycat: "Photocopie", mefirst: "Moi d'Abord", assist: "Assistance",
  sleeptalk: "Blabla Dodo", snatch: "Saisie", recycle: "Recyclage", covet: "Implore",
  present: "Cadeau", fling: "Dégommage", naturalgift: "Don Naturel", psychup: "Boost",
  acupressure: "Acupression", batonpass: "Relais", tailwind: "Vent Arrière",
  luckychant: "Air Veinard", safeguard: "Rune Protect", mist: "Brume",
  healbell: "Glas de Soin", wish: "Vœu", milkdrink: "Lait à Boire", softboiled: "E-Coque",
  slackoff: "Paresse", recover: "Soin", judgment: "Jugement", crushgrip: "Presse",
  wringout: "Essorage", chatter: "Babil", cut: "Coupe", strength: "Force",
  rockclimb: "Escalade", weatherball: "Ball'Météo", lockon: "Verrouillage",
  mindreader: "Lire-Esprit", bide: "Patience", rage: "Frénésie", skullbash: "Coud'Krâne",
  doodle: "Gribouille",

  // Plante
  absorb: "Vol-Vie", megadrain: "Méga-Sangsue", gigadrain: "Giga-Sangsue",
  energyball: "Éco-Sphère", grassknot: "Nœud Herbe", seedbomb: "Canon Graine",
  leafblade: "Lame Feuille", leafstorm: "Tempête Verte", woodhammer: "Martobois",
  solarbeam: "Lance-Soleil", petaldance: "Danse-Fleur", magicalleaf: "Feuille Magik",
  razorleaf: "Tranch'Herbe", vinewhip: "Fouet Lianes", bulletseed: "Balle Graine",
  leechseed: "Vampigraine", spore: "Spore", sleeppowder: "Poudre Dodo",
  stunspore: "Para-Spore", poisonpowder: "Poudre Toxik", synthesis: "Synthèse",
  aromatherapy: "Aromathérapie", worryseed: "Soucigraine", seedflare: "Fulmigraine",
  ingrain: "Racines", cottonspore: "Spore Coton",

  // Feu
  ember: "Flammèche", flamethrower: "Lance-Flammes", fireblast: "Déflagration",
  heatwave: "Canicule", overheat: "Surchauffe", eruption: "Éruption",
  lavaplume: "Ébullilave", firepunch: "Poing Feu", firefang: "Crocs Feu",
  flareblitz: "Boutefeu", sacredfire: "Feu Sacré", magmastorm: "Vortex Magma",
  firespin: "Danseflamme", flamecharge: "Nitrocharge", willowisp: "Feu Follet",
  sunnyday: "Zénith", blastburn: "Rafale Feu",

  // Eau
  watergun: "Pistolet à O", bubble: "Écume", bubblebeam: "Bulles d'O",
  surf: "Surf", hydropump: "Hydrocanon", waterpulse: "Vibraqua",
  muddywater: "Ocroupi", waterfall: "Cascade", aquatail: "Hydroqueue",
  aquajet: "Aqua-Jet", whirlpool: "Siphon", waterspout: "Giclédo",
  scald: "Ébullition", raindance: "Danse Pluie", hydrocannon: "Hydro Canon",
  aquaring: "Anneau Hydro", waterring: "Anneau Hydro",

  // Électrik
  thundershock: "Éclair", spark: "Étincelle", thunderbolt: "Tonnerre",
  thunder: "Fatal-Foudre", discharge: "Coup d'Jus", shockwave: "Onde de Choc",
  chargebeam: "Rayon Chargé", zapcannon: "Élecanon", thunderpunch: "Poing Éclair",
  thunderfang: "Crocs Éclair", volttackle: "Électacle", thunderwave: "Cage-Éclair",
  voltswitch: "Change Éclair", magnetrise: "Vol Magnétique", charge: "Chargeur",

  // Glace
  powdersnow: "Poudreuse", iceshard: "Éclats Glace", icebeam: "Laser Glace",
  blizzard: "Blizzard", icywind: "Vent Glace", icepunch: "Poing Glace",
  icefang: "Crocs Givre", avalanche: "Avalanche", aurorabeam: "Onde Boréale",
  sheercold: "Glaciation", hail: "Grêle", mistball: "Boule Brume",
  haze: "Buée Noire",

  // Combat
  machpunch: "Mach Punch", forcepalm: "Forte-Paume", closecombat: "Close Combat",
  crosschop: "Coup-Croix", superpower: "Surpuissance", focusblast: "Exploforce",
  aurasphere: "Aurasphère", hammerarm: "Marto-Poing", brickbreak: "Casse-Brique",
  drainpunch: "Vampipoing", lowkick: "Balayage", dynamicpunch: "Dynamopoing",
  focuspunch: "Mitra-Poing", submission: "Sacrifice", vitalthrow: "Corps Perdu",
  reversal: "Contre", counter: "Riposte", vacuumwave: "Onde Vide",
  rocksmash: "Éclate-Roc", karatechop: "Poing-Karaté", armthrust: "Cogne",
  skyuppercut: "Stratopercut", highjumpkick: "Pied Voltige", jumpkick: "Pied Sauté",
  doublekick: "Double Pied", triplekick: "Triple Pied", bulkup: "Gonflette",
  wakeupslap: "Réveil Forcé", rollingkick: "Mawashi Geri",

  // Poison
  poisonsting: "Dard-Venin", acid: "Acide", acidarmor: "Acidarmure",
  acidspray: "Bombe Acide", sludge: "Détritus", sludgebomb: "Bomb-Beurk",
  sludgewave: "Cradovague", poisonjab: "Direct Toxik", gunkshot: "Détricanon",
  crosspoison: "Poison-Croix", poisonfang: "Crochet Venin", poisontail: "Queue-Poison",
  toxic: "Toxik", toxicspikes: "Pics Toxik", gastroacid: "Suc Digestif",
  smog: "Purédpois",

  // Sol
  mudslap: "Coud'Boue", mudshot: "Tir de Boue", mudbomb: "Boue-Bombe",
  dig: "Tunnel", earthquake: "Séisme", earthpower: "Telluriforce",
  bonemerang: "Osmerang", boneclub: "Masse d'Os", bonerush: "Charge Os",
  fissure: "Abîme", magnitude: "Ampleur", sandtomb: "Tourbi-Sable",
  spikes: "Picots", sandstorm: "Tempête de Sable",

  // Vol
  peck: "Picpic", drillpeck: "Bec Vrille", gust: "Tornade",
  wingattack: "Cru-Ailes", aerialace: "Aéropique", fly: "Vol",
  bounce: "Rebond", skyattack: "Piqué", airslash: "Lame d'Air",
  aircutter: "Tranch'Air", bravebird: "Rapace", roost: "Atterrissage",
  defog: "Anti-Brume", featherdance: "Danse-Plume",

  // Psy
  confusion: "Choc Mental", psybeam: "Rafale Psy", psychic: "Psyko",
  psyshock: "Choc Psy", extrasensory: "Extrasenseur", zenheadbutt: "Psykoud'Boul",
  dreameater: "Dévorêve", hypnosis: "Hypnose", calmmind: "Plénitude",
  agility: "Hâte", teleport: "Téléport", rest: "Repos",
  trick: "Tourmagik", reflect: "Protection", lightscreen: "Mur Lumière",
  barrier: "Bouclier", amnesia: "Amnésie", cosmicpower: "Puissance Cosmique",
  trickroom: "Distorsion", gravity: "Gravité", healblock: "Anti-Soin",
  psychocut: "Coupe Psycho", miracleeye: "Œil Miracle",
  roleplay: "Imitation",

  // Insecte
  stringshot: "Sécrétion", bugbite: "Piqûre", leechlife: "Vampirisme",
  furycutter: "Taillade", pinmissile: "Dard-Nuée", twineedle: "Double-Dard",
  signalbeam: "Rayon Signal", xscissor: "Plaie-Croix", megahorn: "Mégacorne",
  bugbuzz: "Bourdon", uturn: "Demi-Tour", silverwind: "Vent Argenté",
  spiderweb: "Toile", tailglow: "Lumi-Queue",

  // Roche
  rockthrow: "Jet-Pierres", rocktomb: "Tomberoche", rockslide: "Éboulement",
  stoneedge: "Lame de Roc", rockblast: "Boule Roc", powergem: "Rayon Gemme",
  ancientpower: "Pouvoir Antique", headsmash: "Fracass'Tête", rollout: "Roulade",
  stealthrock: "Piège de Roc", rockpolish: "Poliroche",

  // Spectre
  astonish: "Étonnement", lick: "Léchouille", nightshade: "Ombre Nocturne",
  confuseray: "Onde Folie", shadowpunch: "Poing Ombre", shadowball: "Ball'Ombre",
  shadowclaw: "Griffe Ombre", shadowsneak: "Ombre Portée", shadowforce: "Revenant",
  ominouswind: "Vent Mauvais", destinybond: "Lien du Destin", grudge: "Rancune",
  spite: "Dépit", curse: "Malédiction",

  // Dragon
  dragonrage: "Draco-Rage", dragonbreath: "Dracosouffle", dragonpulse: "Dracochoc",
  dragonclaw: "Dracogriffe", outrage: "Colère", dragonrush: "Dracocharge",
  dracometeor: "Draco-Météore", dragondance: "Danse Draco", twister: "Ouragan",
  roaroftime: "Hurle-Temps", spacialrend: "Spatio-Rift",

  // Ténèbres
  bite: "Morsure", crunch: "Mâchouille", feintattack: "Feinte",
  faintattack: "Feinte", pursuit: "Poursuite", thief: "Larcin",
  knockoff: "Sabotage", payback: "Représailles", assurance: "Assurance",
  suckerpunch: "Coup Bas", nightslash: "Tranche-Nuit", darkpulse: "Vibrobscur",
  snarl: "Aboiement", foulplay: "Tricherie", beatup: "Baston",
  taunt: "Provoc", torment: "Tourmente", embargo: "Embargo",
  faketears: "Croco Larme", flatter: "Flatterie", memento: "Souvenir",
  nastyplot: "Machination", switcheroo: "Passe-Passe",

  // Acier
  metalclaw: "Griffe Acier", steelwing: "Aile d'Acier", ironhead: "Tête de Fer",
  irondefense: "Mur de Fer", flashcannon: "Luminocanon", gyroball: "Gyroballe",
  bulletpunch: "Pisto-Poing", meteormash: "Poing Météore", doomdesire: "Carnareket",
  magnetbomb: "Bombaimant", mirrorshot: "Miroi-Tir", metalsound: "Strido-Son",
  irontail: "Queue de Fer",

  // Compléments Gen 1 à 4
  aeroblast: "Aéroblast", attackorder: "Appel Attaque", defendorder: "Appel Défense",
  healorder: "Appel Soin", barrage: "Barrage", block: "Barrage",
  blazekick: "Pied Brûlure", brine: "Saumure", camouflage: "Camouflage",
  clamp: "Claquoir", cometpunch: "Poing Comète", conversion: "Conversion",
  conversion2: "Conversion 2", crabhammer: "Pince-Masse", darkvoid: "Trou Noir",
  defensecurl: "Boul'Armure", dive: "Plongée", doublehit: "Coup Double",
  doubleslap: "Torgnoles", eggbomb: "Bomb'Œuf", explosion: "Explosion",
  selfdestruct: "Destruction", falseswipe: "Faux-Chage", flail: "Fléau",
  flamewheel: "Roue de Feu", focusenergy: "Puissance", followme: "Par Ici",
  foresight: "Clairvoyance", frenzyplant: "Végé-Attaque", furyattack: "Furie",
  furyswipes: "Combo-Griffe", futuresight: "Prescience", glare: "Regard Médusant",
  grasswhistle: "Siffl'Herbe", guardswap: "Échange Garde", powerswap: "Échange Force",
  guillotine: "Guillotine", harden: "Armure", healingwish: "Vœu Soin",
  heartswap: "Permucœur", helpinghand: "Coup d'Main", hornattack: "Koud'Korne",
  horndrill: "Empal'Korne", howl: "Grondement", iceball: "Ball'Glace",
  iciclespear: "Stalagtite", imprison: "Possessif", kinesis: "Télékinésie",
  lastresort: "Dernier Recours", lovelykiss: "Grobisou", sweetkiss: "Bisou Malin",
  lunardance: "Danse Lune", lusterpurge: "Lumi-Éclat", magiccoat: "Voile Magik",
  mirrorcoat: "Voile Miroir", meanlook: "Regard Noir", meditate: "Yoga",
  metalburst: "Fulmétal", mirrormove: "Mimique", moonlight: "Rayon Lune",
  morningsun: "Aurore", mudsport: "Lance-Boue", watersport: "Tourniquet",
  needlearm: "Poing Dard", nightmare: "Cauchemar", octazooka: "Octazooka",
  odorsleuth: "Flair", payday: "Jackpot", pluck: "Picore",
  poisongas: "Gaz Toxik", powertrick: "Force-Ruse", powerwhip: "Mégafouet",
  psychoboost: "Psycho Boost", psychoshift: "Transfert", psywave: "Vague Psy",
  punishment: "Punition", rapidspin: "Tour Rapide", razorwind: "Coupe-Vent",
  refresh: "Régénération", revenge: "Vendetta", rockwrecker: "Fracas Rocher",
  scaryface: "Grimace", seismictoss: "Frappe Atlas",
  skillswap: "Échange", smellingsalts: "Stimulant", sonicboom: "Sonicboom",
  spikecannon: "Épine", spitup: "Relâche", swallow: "Avale",
  stockpile: "Stockage", stomp: "Écrasement", thrash: "Mania",
  tickle: "Chatouille", trumpcard: "Atout", visegrip: "Force Poigne",
  withdraw: "Repli",
};

export function getMoveFrenchName(id: string, fallbackName?: string): string {
  const normalized = id.toLowerCase().replace(/[^a-z0-9]/g, "");
  return FRENCH_MOVE_NAMES[normalized] || fallbackName || id;
}
