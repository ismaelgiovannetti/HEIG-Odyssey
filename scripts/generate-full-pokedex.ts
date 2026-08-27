import { Dex } from "@pkmn/sim";
import fs from "node:fs";
import path from "node:path";
import type { Species, StarterOption, Move } from "../src/lib/content/schemas";

const dex = Dex.forGen(4);

const legendaryAndMythicalNums = new Set([
  144, 145, 146, 150, 151, // Gen 1 (Articuno, Zapdos, Moltres, Mewtwo, Mew)
  243, 244, 245, 249, 250, 251, // Gen 2 (Raikou, Entei, Suicune, Lugia, Ho-Oh, Celebi)
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386, // Gen 3 (Regis, Lati@s, Weather Trio, Jirachi, Deoxys)
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493 // Gen 4 (Lake Guardians, Dialga/Palkia/Giratina, Heatran, Regigigas, Cresselia, Phione/Manaphy, Darkrai, Shaymin, Arceus)
]);

const mythicalNums = new Set([151, 251, 385, 386, 489, 490, 491, 492, 493]);
const specials = new Set(["unown", "ditto"]);

// French name mapping for all Gen 1-4 Pokémon
const frenchNames: Record<string, string> = {
  bulbasaur: "Bulbizarre", ivysaur: "Herbizarre", venusaur: "Florizarre",
  charmander: "Salamèche", charmeleon: "Reptincel", charizard: "Dracaufeu",
  squirtle: "Carapuce", wartortle: "Carabaffe", blastoise: "Tortank",
  caterpie: "Chenipan", metapod: "Chrysacier", butterfree: "Papilusion",
  weedle: "Aspicot", kakuna: "Coconfort", beedrill: "Dardargnan",
  pidgey: "Roucool", pidgeotto: "Roucoups", pidgeot: "Roucarnage",
  rattata: "Rattata", raticate: "Rattatac",
  spearow: "Piafabec", fearow: "Rapasdepic",
  ekans: "Abo", arbok: "Arbok",
  pikachu: "Pikachu", raichu: "Raichu",
  sandshrew: "Sabelette", sandslash: "Sablaireau",
  nidoranf: "Nidoran♀", nidorina: "Nidorina", nidoqueen: "Nidoqueen",
  nidoranm: "Nidoran♂", nidorino: "Nidorino", nidoking: "Nidoking",
  clefairy: "Mélofée", clefable: "Mélodelfe",
  vulpix: "Goupix", ninetales: "Feunard",
  jigglypuff: "Rondoudou", wigglytuff: "Grodoudou",
  zubat: "Nosferapti", golbat: "Nosferalto",
  oddish: "Mystherbe", gloom: "Ortide", vileplume: "Rafflesia",
  paras: "Paras", parasect: "Parasect",
  venonat: "Mimitoss", venomoth: "Aéromite",
  diglett: "Taupiqueur", dugtrio: "Triopikeur",
  meowth: "Miaouss", persian: "Persian",
  psyduck: "Psykokwak", golduck: "Akwakwak",
  mankey: "Férosinge", primeape: "Colossinge",
  growlithe: "Caninos", arcanine: "Arcanin",
  poliwag: "Ptitard", poliwhirl: "Têtarte", poliwrath: "Tartard",
  abra: "Abra", kadabra: "Kadabra", alakazam: "Alakazam",
  machop: "Machoc", machoke: "Machopeur", machamp: "Mackogneur",
  bellsprout: "Chétiflor", weepinbell: "Boustiflor", victreebel: "Empiflor",
  tentacool: "Tentacool", tentacruel: "Tentacruel",
  geodude: "Racaillou", graveler: "Gravalanch", golem: "Grolem",
  ponyta: "Ponyta", rapidash: "Galopa",
  slowpoke: "Ramoloss", slowbro: "Flagadoss",
  magnemite: "Magnéti", magneton: "Magnéton",
  farfetchd: "Canarticho",
  doduo: "Doduo", dodrio: "Dodrio",
  seel: "Otaria", dewgong: "Lamantine",
  grimer: "Tadmorv", muk: "Grotadmorv",
  shellder: "Kokiyas", cloyster: "Crustabri",
  gastly: "Fantominus", haunter: "Spectrum", gengar: "Ectoplasma",
  onix: "Onix",
  drowzee: "Soporifik", hypno: "Hypnomade",
  krabby: "Krabby", kingler: "Krabboss",
  voltorb: "Voltorbe", electrode: "Électrode",
  exeggcute: "Noeunoeuf", exeggutor: "Noadkoko",
  cubone: "Osselait", marowak: "Ossatueur",
  hitmonlee: "Kicklee", hitmonchan: "Tygnon",
  lickitung: "Excelangue",
  koffing: "Smogo", weezing: "Smogogo",
  rhyhorn: "Rhinocorne", rhydon: "Rhinoféros",
  chansey: "Leveinard",
  tangela: "Saquedeneu",
  kangaskhan: "Kangourex",
  horsea: "Hypotrempe", seadra: "Hypocéan",
  goldeen: "Poissirène", seaking: "Poissoroy",
  staryu: "Stari", starmie: "Staross",
  mrmime: "M. Mime",
  scyther: "Insécateur",
  jynx: "Lippoutou",
  electabuzz: "Élektek",
  magmar: "Magmar",
  pinsir: "Scarabrute",
  tauros: "Tauros",
  magikarp: "Magicarpe", gyarados: "Léviator",
  lapras: "Lokhlass",
  ditto: "Métamorph",
  eevee: "Évoli", vaporeon: "Aquali", jolteon: "Voltali", flareon: "Pyroli",
  porygon: "Porygon",
  omanyte: "Amonita", omastar: "Amonistar",
  kabuto: "Kabuto", kabutops: "Kabutops",
  aerodactyl: "Ptéra",
  snorlax: "Ronflex",
  articuno: "Artikodin", zapdos: "Électhor", moltres: "Sulfura",
  dratini: "Minidraco", dragonair: "Draco", dragonite: "Dracolosse",
  mewtwo: "Mewtwo", mew: "Mew",
  // Gen 2
  chikorita: "Germignon", bayleef: "Macronium", meganium: "Méganium",
  cyndaquil: "Héricendre", quilava: "Feurisson", typhlosion: "Typhlosion",
  totodile: "Kaiminus", croconaw: "Crocrodil", feraligatr: "Aligatueur",
  sentret: "Fouinette", furret: "Fouinar",
  hoothoot: "Hoothoot", noctowl: "Noarfang",
  ledyba: "Coxy", ledian: "Coxylaque",
  spinarak: "Mimigal", ariados: "Migalos",
  crobat: "Nostenfer",
  chinchou: "Loupio", lanturn: "Lanturn",
  pichu: "Pichu", cleffa: "Mélo", igglybuff: "Toudoudou", togepi: "Togepi", togetic: "Togetic",
  natu: "Natu", xatu: "Xatu",
  mareep: "Wattouat", flaaffy: "Lainergie", ampharos: "Pharamp",
  bellossom: "Joliflor", marill: "Marill", azumarill: "Azumarill",
  sudowoodo: "Simularbre", politoed: "Tarpaud",
  hoppip: "Granivol", skiploom: "Floravol", jumpluff: "Cotovol",
  aipom: "Capumain", sunkern: "Tournegrin", sunflora: "Héliatronc",
  yanma: "Yanma", wooper: "Axoloto", quagsire: "Maraiste",
  espeon: "Mentali", umbreon: "Noctali",
  murkrow: "Cornèbre", slowking: "Roigada",
  misdreavus: "Feuforêve", unown: "Zarbi", wobbuffet: "Qulbutoké",
  girafarig: "Girafarig", pineco: "Pomdepik", forretress: "Foretress",
  dunsparce: "Insolourdo", gligar: "Scorplane", steelix: "Steelix",
  snubbull: "Snubbull", granbull: "Granbull", qwilfish: "Qwilfish",
  scizor: "Cizayox", shuckle: "Caratroc", heracross: "Scarhino",
  sneasel: "Farfuret", teddiursa: "Teddiursa", ursaring: "Ursaring",
  slugma: "Limagma", magcargo: "Volcaropod", swinub: "Marcacrin", piloswine: "Cochignon",
  corsola: "Corayon", remoraid: "Rémoraid", octillery: "Octillery",
  delibird: "Cadoizo", mantine: "Démanta", skarmory: "Airmure",
  houndour: "Malosse", houndoom: "Démolosse", kingdra: "Hyporoi",
  phanpy: "Phanpy", donphan: "Donphan", porygon2: "Porygon2",
  stantler: "Cerfrousse", smeargle: "Queulorior", tyrogue: "Debugant",
  hitmontop: "Kapoera", smoochum: "Lippouti", elekid: "Élekid", magby: "Magby",
  miltank: "Écrémeuh", blissey: "Leuphorie",
  raikou: "Raikou", entei: "Entei", suicune: "Suicune",
  larvitar: "Embrylex", pupitar: "Ymphect", tyranitar: "Tyranocif",
  lugia: "Lugia", hooh: "Ho-Oh", celebi: "Celebi",
  // Gen 3
  treecko: "Arcko", grovyle: "Massko", sceptile: "Jungko",
  torchic: "Poussifeu", combusken: "Galifeu", blaziken: "Braségali",
  mudkip: "Gobou", marshtomp: "Flobio", swampert: "Laggron",
  poochyena: "Medhyèna", mightyena: "Grahyèna",
  zigzagoon: "Zigzaton", linoone: "Linéon",
  wurmple: "Chenipotte", silcoon: "Armulys", beautifly: "Charmillon", cascoon: "Blindalys", dustox: "Papinox",
  lotad: "Nénupiot", lombre: "Lombre", ludicolo: "Ludicolo",
  seedot: "Grainipiot", nuzleaf: "Pifeuil", shiftry: "Tengalice",
  taillow: "Nirondelle", swellow: "Hélédelle",
  wingull: "Goélise", pelipper: "Bekipan",
  ralts: "Tarsal", kirlia: "Kirlia", gardevoir: "Gardevoir",
  surskit: "Arakdo", masquerain: "Maskadra",
  shroomish: "Balignon", breloom: "Chapignon",
  slakoth: "Parecool", vigoroth: "Vigoroth", slaking: "Monaflèmit",
  nincada: "Ningale", ninjask: "Ninjask", shedinja: "Munja",
  whismur: "Chuchmur", loudred: "Ramboum", exploud: "Brouhabam",
  makuhita: "Makuhita", hariyama: "Hariyama",
  azurill: "Azurill", nosepass: "Tarinor",
  skitty: "Skitty", delcatty: "Delcatty",
  sableye: "Ténéfix", mawile: "Mysdibule",
  aron: "Galekid", lairon: "Galegon", aggron: "Galeking",
  meditite: "Méditikka", medicham: "Charmina",
  electrike: "Dynavolt", manectric: "Élecsprint",
  plusle: "Posipi", minun: "Négapi",
  volbeat: "Muciole", illumise: "Lumivole",
  roselia: "Rosélia", gulpin: "Gloupti", swalot: "Avaltout",
  carvanha: "Carvanha", sharpedo: "Sharpedo",
  wailmer: "Wailmer", wailord: "Wailord",
  numel: "Chamallot", camerupt: "Camérupt",
  torkoal: "Chartor", spoink: "Spoink", grumpig: "Groret",
  spinda: "Spinda", trapinch: "Kraknoix", vibrava: "Vibraninf", flygon: "Libégon",
  cacnea: "Cacnea", cacturne: "Cacturne",
  swablu: "Tylton", altaria: "Altaria",
  zangoose: "Mangriff", seviper: "Séviper",
  lunatone: "Séléroc", solrock: "Solaroc",
  barboach: "Barloche", whiscash: "Barbicha",
  corphish: "Écrapince", crawdaunt: "Colhomard",
  baltoy: "Balbuto", claydol: "Kaorine",
  lileep: "Lilia", cradily: "Vacillys",
  anorith: "Anorith", armaldo: "Armaldo",
  feebas: "Barpau", milotic: "Milobellus",
  castform: "Morphéo", kecleon: "Kecleon",
  shuppet: "Polichombr", banette: "Branette",
  duskull: "Skelénox", dusclops: "Téraclope",
  tropius: "Tropius", chimecho: "Éoko",
  absol: "Absol", wynaut: "Okéoké",
  snorunt: "Stalgamin", glalie: "Oniglali",
  spheal: "Obalie", sealeo: "Phogleur", walrein: "Kaimorse",
  clamperl: "Coquiperl", huntail: "Serpang", gorebyss: "Rosabyss",
  relicanth: "Relicanth", luvdisc: "Lovdisc",
  bagon: "Draby", shelgon: "Drackhaus", salamence: "Drattak",
  beldum: "Terhal", metang: "Métang", metagross: "Métalosse",
  regirock: "Regirock", regice: "Regice", registeel: "Registeel",
  latias: "Latias", latios: "Latios",
  kyogre: "Kyogre", groudon: "Groudon", rayquaza: "Rayquaza",
  jirachi: "Jirachi", deoxys: "Deoxys",
  // Gen 4
  turtwig: "Tortipouss", grotle: "Boskara", torterra: "Torterra",
  chimchar: "Ouisticram", monferno: "Chimpenfeu", infernape: "Simiabraz",
  piplup: "Tiplouf", prinplup: "Prinplouf", empoleon: "Pingoléon",
  starly: "Étourmi", staravia: "Étourvol", staraptor: "Étouraptor",
  bidoof: "Keunotor", bibarel: "Castorno",
  kricketot: "Crikzik", kricketune: "Mélokrik",
  shinx: "Lixy", luxio: "Luxio", luxray: "Luxray",
  budew: "Rozbouton", roserade: "Roserade",
  cranidos: "Kranidos", rampardos: "Charkos",
  shieldon: "Dinoclier", bastiodon: "Bastiodon",
  burmy: "Cheniti", wormadam: "Cheniselle", mothim: "Papilord",
  combee: "Apitrini", vespiquen: "Apireine",
  pachirisu: "Pachirisu", buizel: "Mustébouée", floatzel: "Mustéflott",
  cherubi: "Ceribou", cherrim: "Ceriflor",
  shellos: "Sancoki", gastrodon: "Tritosor",
  ambipom: "Capidextre", drifloon: "Baudrive", drifblim: "Grodrive",
  buneary: "Laporeille", lopunny: "Lockpin",
  mismagius: "Magirêve", honchkrow: "Corboss",
  glameow: "Chaglam", purugly: "Chaffreux",
  chingling: "Korillon", stunky: "Moufouette", skutank: "Moufflair",
  bronzor: "Archéomire", bronzong: "Archéodong",
  bonsly: "Manzaï", mimejr: "Mime Jr.",
  happiny: "Ptiravi", chatot: "Pijako",
  spiritomb: "Spiritomb", gible: "Griknot", gabite: "Carmache", garchomp: "Carchacrok",
  munchlax: "Goinfrex", riolu: "Riolu", lucario: "Lucario",
  hippopotas: "Hippopotas", hippowdon: "Hippodocus",
  skorupi: "Rapion", drapion: "Drascore",
  croagunk: "Cradopaud", toxicroak: "Coatox",
  carnivine: "Vortente", finneon: "Écayon", lumineon: "Luminéon",
  mantyke: "Babimanta", snover: "Blizzi", abomasnow: "Blizzaroi",
  weavile: "Dimoret", magnezone: "Magnézone", lickilicky: "Coudlangue",
  rhyperior: "Rhinastoc", tangrowth: "Bouldeneu", electivire: "Élekable", magmortar: "Maganon",
  togekiss: "Togekiss", yanmega: "Yanméga", leafeon: "Phyllali", glaceon: "Givrali",
  gliscor: "Scorvol", mamoswine: "Mammochon", porygonz: "Porygon-Z",
  gallade: "Gallame", probopass: "Tarinorme", dusknoir: "Noctunoir", froslass: "Momartik",
  rotom: "Motisma",
  uxie: "Créhelf", mesprit: "Créfollet", azelf: "Créfadet",
  dialga: "Dialga", palkia: "Palkia", heatran: "Heatran",
  regigigas: "Regigigas", giratina: "Giratina", cresselia: "Cresselia",
  phione: "Phione", manaphy: "Manaphy", darkrai: "Darkrai",
  shaymin: "Shaymin", arceus: "Arceus"
};

// French move name dictionary
const frenchMoveNames: Record<string, string> = {
  tackle: "Charge", scratch: "Griffe", pound: "Écras'Face",
  growl: "Rugissement", leer: "Groz'Yeux", tailwhip: "Mimi-Queue",
  ember: "Flammèche", watergun: "Pistolet à O", absorb: "Vol-Vie",
  vinewhip: "Fouet Lianes", spark: "Étincelle", quickattack: "Vive-Attaque",
  bite: "Morsure", headbutt: "Coup d'Boule", confusion: "Choc Mental",
  poisonsting: "Dard-Venin", pech: "Picpic", peck: "Picpic",
  gust: "Tornade", sandattack: "Jet de Sable", stringshot: "Sécrétion",
  bubble: "Écume", withdraw: "Repli", harden: "Armure",
  defensecurl: "Boul'Armure", supersonic: "Ultrason", astonish: "Étonnement",
  smog: "Purédpois", lick: "Léchouille", hypnosis: "Hypnose",
  screech: "Grincement", sing: "Berceuse", charm: "Charme",
  sweetkiss: "Doux Baiser", encore: "Encore", thundershock: "Éclair",
  thundewave: "Cage-Éclair", thunderwave: "Cage-Éclair", wrap: "Ligotage",
  constrict: "Étreinte", bind: "Étreinte", splash: "Trempette",
  transform: "Morphing", teleport: "Téléport", sketch: "Gribouille",
  present: "Cadeau", metronome: "Métronome", mirrorcoat: "Voile Miroir",
  counter: "Riposte", curse: "Malédiction", spite: "Dépit",
  rockthrow: "Jet-Pierres", mudslap: "Coud'Boue", mudshot: "Tir de Boue",
  furyattack: "Furie", furyswipes: "Combo-Griffe", doublehit: "Coup Double",
  karatechop: "Poing-Karaté", machpunch: "Mach Punch", forcepalm: "Forte-Paume",
  endure: "Tenacité", bide: "Patience", rage: "Frénésie",
  focusenergy: "Puissance", pursuit: "Poursuite", feintattack: "Feinte",
  faintattack: "Feinte", payback: "Représailles", assure: "Assurance",
  pursuitattack: "Poursuite", snarl: "Aboiement", fakeout: "Bluff",
  fakesears: "Croco Larme", faketears: "Croco Larme", tickle: "Chatouille",
  yawn: "Bâillement", slackoff: "Paresse", rest: "Repos",
  snore: "Ronflement", sleeptalk: "Blabla Dodo", nightshade: "Ombre Nocturne",
  shadowsneak: "Ombre Portée", shadowclaw: "Griffe Ombre", spooky: "Ombre",
  ominouswind: "Vent Mauvais", icywind: "Vent Glace", powderSnow: "Poudreuse",
  powdersnow: "Poudreuse", iceshard: "Éclats Glace", rocksmash: "Éclate-Roc",
  rockpolish: "Poliroche", stealthrock: "Piège de Roc", roll: "Roulade",
  rollout: "Roulade", gyroball: "Gyroballe", irondefense: "Mur de Fer",
  metalclaw: "Griffe Acier", bulletpunch: "Pisto-Poing", magnetbomb: "Bombaimant",
  dragonrage: "Draco-Rage", dragonbreath: "Dracosouffle", twister: "Ouragan",
  dragonpulse: "Dracochoc", dragonclaw: "Dracogriffe", roost: "Atterrissage",
  aircutter: "Tranch'Air", aircutter2: "Tranch'Air", airslash: "Lame d'Air",
  bravebird: "Rapace", wingattack: "Cru-Ailes", aerialace: "Aéropique",
  drillpeck: "Bec Vrille", fly: "Vol", bounce: "Rebond",
  roaroftime: "Hurle-Temps", spacialrend: "Spatio-Rift", shadowforce: "Revenant",
  judgment: "Jugement", magmaStorm: "Vortex Magma", magmastorm: "Vortex Magma",
  seedflare: "Fulmigraine", darkvoid: "Trou Noir", crushgrip: "Presse",
  heartswap: "Permucœur", lunarblessing: "Danse Lunaire", healingwish: "Vœu Soin",
  naturepower: "Force-Nature", secretpower: "Force Cachée", hiddenpower: "Puissance Cachée",
  ancientpower: "Pouvoir Antique", ominouswind2: "Vent Mauvais", silverwind: "Vent Argenté",
  bugbuzz: "Bourdon", signalbeam: "Rayon Signal", xscissor: "Plaie-Croix",
  megahorn: "Mégacorne", pinmissile: "Dard-Nuée", leechlife: "Vampirisme",
  leechseed: "Vampigraine", razorleaf: "Tranch'Herbe", magicalleaf: "Feuille Magik",
  energyball: "Éco-Sphère", gigadrain: "Giga-Sangsue", megadrain: "Méga-Sangsue",
  solarbeam: "Lance-Soleil", woodhammer: "Martobois", seedbomb: "Canon Graine",
  leafblade: "Lame Feuille", leafstorm: "Tempête Verte", grassknot: "Nœud Herbe",
  petalblizzard: "Tempête Florale", petaldance: "Danse-Fleur", stunspore: "Para-Spore",
  poisonpowder: "Poudre Toxik", sleeppowder: "Poudre Dodo", spore: "Spore",
  cottonspore: "Spore Coton", synthesis: "Synthèse", moonlight: "Rayon Lune",
  morningSun: "Aurore", morningsun: "Aurore", aromatherapy: "Aromathérapie",
  healbell: "Glas de Soin", wish: "Vœu", protect: "Abri",
  detect: "Détection", endure2: "Ténacité", substitute: "Clonage",
  safeguard: "Rune Protect", mist: "Brume", haze: "Buée Noire",
  smokescreen: "Brouillard", flash: "Flash", kinesis: "Télékinésie",
  tailglow: "Lumiqueue", bellydrum: "Cognobidon", swordsdance: "Danse-Lames",
  dragonDance: "Danse Draco", dragondance: "Danse Draco", agility: "Hâte",
  rockpolish2: "Poliroche", calmMind: "Plénitude", calmmind: "Plénitude",
  nastyplot: "Machination", tailwhip2: "Mimi-Queue", screech2: "Grincement",
  metalsound: "Strido-Son", faketears2: "Croco Larme", scaryface: "Grimace",
  stringshot2: "Sécrétion", sweetscent: "Doux Parfum", featherdance: "Danse-Plumes",
  captivate: "Séduction", memento: "Souvenir", destinybond: "Lien du Destin",
  grudge: "Rancune", spite2: "Dépit", taunt: "Provoc",
  torment: "Tourmente", disable: "Entrave", encore2: "Encore",
  healblock: "Anti-Soin", embargo: "Embargo", snatch: "Saisie",
  imprison: "Possessif", mirrorcoat2: "Voile Miroir", magiccoat: "Reflet Magik",
  gravity: "Gravité", miracleeye: "Œil Miracle", foresight: "Clairvoyance",
  odorsleuth: "Flair", lockon: "Verrouillage", mindreader: "Lire-Esprit",
  aquaring: "Anneau Hydro", ingrain: "Racines", roost2: "Atterrissage",
  recover: "Soin", softboiled: "E-Coque", milkdrink: "Lait à Boire",
  slackoff2: "Paresse", swallow: "Avaler", stockpile: "Stockage",
  spitup: "Relâche", acupressure: "Acupression", charge: "Chargeur",
  minimize: "Lilliput", doubleteam: "Reflet", cosmicpower: "Force Cosmique",
  irondefense2: "Mur de Fer", amnesia: "Amnésie", acidarmor: "Acidarmure",
  barrier: "Bouclier", reflect: "Protection", lightscreen: "Mur Lumière",
  reflect2: "Protection", lightscreen2: "Mur Lumière", auroraVeil: "Voile Aurore",
  hail: "Grêle", raindance: "Danse Pluie", sandstorm: "Tempête de Sable",
  sunnyday: "Zénith", trickroom: "Distorsion", wonderroom: "Zone Étrange",
  magicroom: "Zone Magique", stealthrock2: "Piège de Roc", spikes: "Picots",
  toxicspikes: "Pics Toxik", defog: "Anti-Brume", rapidspin: "Tour Rapide",
  knockoff: "Sabotage", thief: "Larcin", covet: "Implore",
  trick: "Tour de Magie", switcheroo: "Passe-Passe", fling: "Dégommage",
  naturalgift: "Don Naturel", recycle: "Recyclage", mefirst: "Moi d'Abord",
  copycat: "Photocopie", assist: "Assistance", mirrorMove: "Mimique",
  mirrormove: "Mimique", sleeptalk2: "Blabla Dodo", snore2: "Ronflement",
  naturepower2: "Force-Nature", secretpower2: "Force Cachée", camoflauge: "Camouflage",
  camouflage: "Camouflage", conversion: "Affinité", conversion2: "Affinité 2",
  transform2: "Morphing", splash2: "Trempette", celebrate: "Célébration",
  holdhands: "Mains Jointes", happyhour: "Étrennes", payDay: "Jackpot",
  payday: "Jackpot", takedown: "Bélier", doubleedge: "Damoclès",
  submission: "Sacrifice", bravebird2: "Rapace", flareblitz: "Boutefeu",
  volttackle: "Électacle", woodhammer2: "Martobois", headsmash: "Fracass'Tête"
};

function getFrenchName(id: string, defaultName: string): string {
  return frenchNames[id.toLowerCase()] || defaultName;
}

function getFrenchMoveName(id: string, defaultName: string): string {
  return frenchMoveNames[id.toLowerCase()] || defaultName;
}

async function getAccurateLevel5Moves(speciesId: string): Promise<Move[]> {
  const lData = await dex.learnsets.get(speciesId);
  const movesWithLevel: { id: string; lvl: number }[] = [];

  if (lData && lData.learnset) {
    for (const [mId, learnInfo] of Object.entries(lData.learnset)) {
      let minLvl = 999;
      for (const entry of learnInfo) {
        // Gen 1 to 4 level up format: '4L1', '3L5', etc.
        const match = entry.match(/^[1-4]L(\d+)$/);
        if (match) {
          const lvl = parseInt(match[1], 10);
          if (lvl < minLvl) minLvl = lvl;
        }
      }
      if (minLvl <= 5) {
        movesWithLevel.push({ id: mId, lvl: minLvl });
      }
    }
  }

  // Sort by level learned ascending
  movesWithLevel.sort((a, b) => a.lvl - b.lvl);

  // If a species has fewer than 2 moves at level <= 5, fetch its first available level-up moves up to 2
  if (movesWithLevel.length < 2 && lData && lData.learnset) {
    const higherMoves: { id: string; lvl: number }[] = [];
    for (const [mId, learnInfo] of Object.entries(lData.learnset)) {
      if (movesWithLevel.some((m) => m.id === mId)) continue;
      let minLvl = 999;
      for (const entry of learnInfo) {
        const match = entry.match(/^[1-4]L(\d+)$/);
        if (match) {
          const lvl = parseInt(match[1], 10);
          if (lvl < minLvl) minLvl = lvl;
        }
      }
      if (minLvl < 999) {
        higherMoves.push({ id: mId, lvl: minLvl });
      }
    }
    higherMoves.sort((a, b) => a.lvl - b.lvl);
    while (movesWithLevel.length < 2 && higherMoves.length > 0) {
      movesWithLevel.push(higherMoves.shift()!);
    }
  }

  // Fallback to Tackle if completely empty
  if (movesWithLevel.length === 0) {
    movesWithLevel.push({ id: "tackle", lvl: 1 });
  }

  // Take up to 4 moves
  const selectedMoves = movesWithLevel.slice(0, 4);

  return selectedMoves.map(({ id }) => {
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

async function generatePokedex() {
  console.log("Generating complete Gen 1-4 Pokedex (1 to 493) with accurate level 5 learnsets...");

  const allSpecies: Species[] = [];
  const starters: StarterOption[] = [];

  for (let i = 1; i <= 493; i++) {
    const s = dex.species.all().find((spec) => spec.num === i && spec.name === spec.baseSpecies);
    if (!s) {
      console.warn(`[WARN] Species #${i} not found`);
      continue;
    }

    const isLegendary = legendaryAndMythicalNums.has(s.num);
    const isMythical = mythicalNums.has(s.num);
    const isSpecial = specials.has(s.id);

    // Determine Stage
    let stage = 1;
    if (s.prevo) {
      const prev = dex.species.get(s.prevo);
      if (prev && prev.prevo) {
        stage = 3;
      } else {
        stage = 2;
      }
    }

    const isStarterEligible = stage === 1 && !isLegendary && !isMythical && !isSpecial;

    const baseStats = {
      hp: s.baseStats.hp,
      attack: s.baseStats.atk,
      defense: s.baseStats.def,
      specialAttack: s.baseStats.spa,
      specialDefense: s.baseStats.spd,
      speed: s.baseStats.spe,
    };

    const frenchName = getFrenchName(s.id, s.name);
    const level5Moves = await getAccurateLevel5Moves(s.id);

    const speciesObj: Species = {
      id: s.id,
      dexNumber: s.num,
      name: frenchName,
      generation: (s.gen as 1 | 2 | 3 | 4) || 4,
      types: s.types as any,
      baseStats,
      stage,
      isLegendary,
      isMythical,
      isStarterEligible,
      defaultMoves: level5Moves.map((m) => m.id),
      possibleAbilities: Object.values(s.abilities).filter(Boolean) as string[],
    };

    allSpecies.push(speciesObj);

    if (isStarterEligible) {
      starters.push({
        speciesId: s.id,
        name: frenchName,
        level: 5,
        description: `Pokémon de départ ${frenchName} (${s.types.join("/")}). Stade 1 - Gen ${s.gen}.`,
        moves: level5Moves,
      });
    }
  }

  // Sort starters by dexNumber
  starters.sort((a, b) => {
    const spA = dex.species.get(a.speciesId);
    const spB = dex.species.get(b.speciesId);
    return spA.num - spB.num;
  });

  console.log(`Total species generated: ${allSpecies.length} (out of 493)`);
  console.log(`Total eligible stage 1 starters: ${starters.length}`);

  // Write content/species.json
  const speciesFile = path.join(process.cwd(), "content", "species.json");
  fs.writeFileSync(
    speciesFile,
    JSON.stringify({ version: "1.0.0", species: allSpecies }, null, 2),
    "utf-8"
  );

  // Write content/starters.json
  const startersFile = path.join(process.cwd(), "content", "starters.json");
  fs.writeFileSync(
    startersFile,
    JSON.stringify(
      {
        version: "1.0.0",
        description: "Pool exhaustif de recrutement gratuit des créatures stade 1 Gen 1 à 4 avec leurs attaques officielles de niveau 5",
        starters,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log("Updated content/species.json and content/starters.json with accurate level 5 moves!");
}

generatePokedex();
