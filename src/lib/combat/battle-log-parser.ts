import "server-only";

import type { Battle } from "@pkmn/sim";
import { getMoveFrenchName } from "../pokemon/move-names-fr";
import { getSpeciesFrenchName } from "../pokemon/species-names-fr";
import type { BattleEvent, BattleSideId } from "./types";

export interface BattleLogParserContext {
  battle: Battle;
  playerNames: Record<BattleSideId, string>;
}

/**
 * Convertit les nouvelles lignes du protocole Showdown en événements destinés
 * à l'interface. Le curseur reste géré par `BattleEngine` : ce parseur ne
 * conserve aucun état entre deux appels.
 */
export function parseBattleLogs(
  rawLogs: readonly string[],
  context: BattleLogParserContext,
): BattleEvent[] {
  const newLogs = removePublicSplitDuplicates(rawLogs);
  const events: BattleEvent[] = [];
  const turn = context.battle.turn;

  for (const rawLine of newLogs) {
    if (!rawLine.startsWith("|")) continue;
    const parts = rawLine.slice(1).split("|");
    const cmd = parts[0];

    switch (cmd) {
      case "turn": {
        events.push({
          type: "turn_start",
          turn: parseInt(parts[1], 10) || turn,
          message: `--- Tour ${parts[1]} ---`,
        });
        break;
      }

      case "move": {
        // |move|p1a: Turtwig|Tackle|p2a: Chimchar
        const userStr = parts[1] || "";
        const rawMoveName = parts[2] || "";
        const targetStr = parts[3] || "";

        const side: BattleSideId = userStr.startsWith("p1") ? "p1" : "p2";
        const targetSide: BattleSideId | undefined = targetStr.startsWith("p1")
          ? "p1"
          : targetStr.startsWith("p2")
            ? "p2"
            : undefined;

        const frenchMove = getMoveFrenchName(rawMoveName, rawMoveName);

        events.push({
          type: "move",
          turn,
          side,
          moveName: frenchMove,
          targetSide,
          message: `${formatName(userStr)} utilise ${frenchMove} !`,
        });
        break;
      }

      case "-damage": {
        // |-damage|p2a: Chimchar|19/31  ou  |-damage|p1a: X|12/40|[from] psn
        const targetStr = parts[1] || "";
        const hpStr = parts[2] || "";
        const side: BattleSideId = targetStr.startsWith("p1") ? "p1" : "p2";

        let [currHp, maxHp] = parseHp(hpStr);
        if (maxHp <= 0) {
          // Une cible K.O. (`0 fnt`) n'expose pas son total : on le retrouve
          // sur le combattant réel pour ne jamais afficher « 0/0 ».
          maxHp = resolveMaxHp(context.battle, targetStr) || maxHp;
        }
        const percent = maxHp > 0 ? Math.round((currHp / maxHp) * 100) : 0;

        const fromEffect = parseFromClause(parts);
        const residual = Boolean(fromEffect);

        events.push({
          type: "damage",
          turn,
          side,
          currentHp: currHp,
          maxHp,
          hpPercent: percent,
          residual,
          fromEffect: fromEffect || undefined,
          message: residual
            ? residualDamageMessage(targetStr, fromEffect)
            : `${formatName(targetStr)} subit des dégâts !`,
        });
        break;
      }

      case "-sethp": {
        // Ajustement direct des PV (Balance, Douleur...) traité comme un dégât.
        const targetStr = parts[1] || "";
        const hpStr = parts[2] || "";
        const side: BattleSideId = targetStr.startsWith("p1") ? "p1" : "p2";
        let [currHp, maxHp] = parseHp(hpStr);
        if (maxHp <= 0)
          maxHp = resolveMaxHp(context.battle, targetStr) || maxHp;
        const percent = maxHp > 0 ? Math.round((currHp / maxHp) * 100) : 0;
        events.push({
          type: "damage",
          turn,
          side,
          currentHp: currHp,
          maxHp,
          hpPercent: percent,
          residual: true,
          message: `Les PV de ${formatName(targetStr)} changent !`,
        });
        break;
      }

      case "-heal": {
        // |-heal|p1a: Turtwig|30/34  ou  |-heal|p1a: X|30/34|[from] move: Leech Seed
        const targetStr = parts[1] || "";
        const hpStr = parts[2] || "";
        const side: BattleSideId = targetStr.startsWith("p1") ? "p1" : "p2";

        let [currHp, maxHp] = parseHp(hpStr);
        if (maxHp <= 0)
          maxHp = resolveMaxHp(context.battle, targetStr) || maxHp;
        const percent = maxHp > 0 ? Math.round((currHp / maxHp) * 100) : 0;

        const fromEffect = parseFromClause(parts);

        events.push({
          type: "heal",
          turn,
          side,
          currentHp: currHp,
          maxHp,
          hpPercent: percent,
          fromEffect: fromEffect || undefined,
          message: healMessage(targetStr, fromEffect),
        });
        break;
      }

      case "-supereffective": {
        events.push({
          type: "effectiveness",
          turn,
          multiplier: 2,
          message: "C'est super efficace !",
        });
        break;
      }

      case "-resisted": {
        events.push({
          type: "effectiveness",
          turn,
          multiplier: 0.5,
          message: "Ce n'est pas très efficace...",
        });
        break;
      }

      case "-immune": {
        const targetStr = parts[1] || "";
        events.push({
          type: "effectiveness",
          turn,
          side: targetStr.startsWith("p1") ? "p1" : "p2",
          multiplier: 0,
          message: `Cela n'affecte pas ${formatName(targetStr)}...`,
        });
        break;
      }

      case "-crit": {
        const targetStr = parts[1] || "";
        events.push({
          type: "critical_hit",
          turn,
          side: targetStr.startsWith("p1") ? "p1" : "p2",
          message: "Coup critique !",
        });
        break;
      }

      case "-hitcount": {
        // |-hitcount|p2a: Chimchar|3
        const count = parseInt(parts[2] || "0", 10) || 0;
        events.push({
          type: "hit_count",
          turn,
          hitCount: count,
          message: count > 1 ? `Touché ${count} fois !` : "Touché !",
        });
        break;
      }

      case "-weather": {
        // |-weather|Sandstorm  |  |-weather|Sandstorm|[upkeep]  |  |-weather|none
        const weather = parts[1] || "";
        const upkeep = parts
          .slice(2)
          .some((part) => part.startsWith("[upkeep]"));
        if (!weather || weather.toLowerCase() === "none") {
          events.push({
            type: "weather",
            turn,
            message: "Le climat est revenu à la normale.",
          });
          break;
        }
        events.push({
          type: "weather",
          turn,
          message: weatherMessage(weather, upkeep),
        });
        break;
      }

      case "-boost":
      case "-unboost": {
        // |-boost|p1a: Turtwig|atk|2
        const targetStr = parts[1] || "";
        const stat = parts[2] || "";
        const amount = parseInt(parts[3] || "0", 10) || 0;
        events.push({
          type: "stat_boost",
          turn,
          side: targetStr.startsWith("p1") ? "p1" : "p2",
          message: boostMessage(targetStr, stat, amount, cmd === "-boost"),
        });
        break;
      }

      case "cant": {
        // |cant|p1a: Turtwig|par
        const targetStr = parts[1] || "";
        const reason = parts[2] || "";
        events.push({
          type: "cant",
          turn,
          side: targetStr.startsWith("p1") ? "p1" : "p2",
          message: cantMessage(targetStr, reason),
        });
        break;
      }

      case "-fail": {
        const targetStr = parts[1] || "";
        events.push({
          type: "fail",
          turn,
          side: targetStr.startsWith("p1") ? "p1" : "p2",
          message: "Mais cela échoue !",
        });
        break;
      }

      case "-start": {
        // |-start|p2a: X|move: Leech Seed  |  |-start|p1a: X|confusion
        const targetStr = parts[1] || "";
        const effect = (parts[2] || "").replace("move: ", "");
        const message = volatileStartMessage(targetStr, effect);
        if (message) {
          events.push({
            type: "message",
            turn,
            side: targetStr.startsWith("p1") ? "p1" : "p2",
            message,
          });
        }
        break;
      }

      case "-status": {
        // |-status|p2a: Chimchar|par
        const targetStr = parts[1] || "";
        const status = parts[2] || "";
        const side: BattleSideId = targetStr.startsWith("p1") ? "p1" : "p2";

        events.push({
          type: "status_inflicted",
          turn,
          side,
          status,
          message: `${formatName(targetStr)} est maintenant ${formatStatus(status)} !`,
        });
        break;
      }

      case "-curestatus": {
        const targetStr = parts[1] || "";
        const status = parts[2] || "";
        events.push({
          type: "status_cleared",
          turn,
          side: targetStr.startsWith("p1") ? "p1" : "p2",
          status,
          message: cureStatusMessage(targetStr, status),
        });
        break;
      }

      case "faint": {
        // |faint|p2a: Chimchar
        const targetStr = parts[1] || "";
        const side: BattleSideId = targetStr.startsWith("p1") ? "p1" : "p2";

        events.push({
          type: "faint",
          turn,
          side,
          message: `${formatName(targetStr)} est K.O. !`,
        });
        break;
      }

      case "switch": {
        // |switch|p2a: Luxio|Luxio, L34|100/100
        const userStr = parts[1] || "";
        const details = parts[2] || "";
        const hpStr = parts[3] || "";
        const side: BattleSideId = userStr.startsWith("p1") ? "p1" : "p2";
        const rawPkmnName = (details.split(",")[0] || userStr).trim();
        const cleanId = rawPkmnName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const frenchPkmnName = getSpeciesFrenchName(cleanId, rawPkmnName);

        // PV du combattant à son entrée en jeu (avant les dégâts éventuels du
        // tour). La jauge du client part de cette valeur puis descend lors du
        // coup adverse, au lieu d'apparaître déjà entamée.
        let [switchInHp, switchInMax] = parseHp(hpStr);
        if (switchInMax <= 0) {
          switchInMax = resolveMaxHp(context.battle, userStr) || switchInMax;
        }
        const switchInPercent =
          switchInMax > 0 ? Math.round((switchInHp / switchInMax) * 100) : 0;

        events.push({
          type: "switch",
          turn,
          side,
          currentHp: switchInHp,
          maxHp: switchInMax,
          hpPercent: switchInPercent,
          message:
            side === "p1"
              ? `Vous envoyez ${frenchPkmnName} au combat !`
              : `${context.playerNames.p2} envoie ${frenchPkmnName} au combat !`,
        });
        break;
      }

      case "win": {
        const winnerName = parts[1] || "";
        const winner: BattleSideId =
          winnerName === context.playerNames.p1 ? "p1" : "p2";
        events.push({
          type: "battle_end",
          turn,
          side: winner,
          message: `${winnerName} remporte la victoire !`,
        });
        break;
      }

      case "-miss": {
        events.push({
          type: "miss",
          turn,
          message: "L'attaque a manqué sa cible !",
        });
        break;
      }
    }
  }

  return events;
}

/**
 * Showdown émet chaque changement de PV / soin / entrée en jeu en double :
 * une ligne détaillée après `|split|<camp>`, puis une ligne publique redactée.
 */
function removePublicSplitDuplicates(rawLogs: readonly string[]): string[] {
  const logs: string[] = [];
  for (let index = 0; index < rawLogs.length; index++) {
    if (rawLogs[index].startsWith("|split|")) {
      const detailed = rawLogs[index + 1];
      if (detailed !== undefined) logs.push(detailed);
      index += 2;
      continue;
    }
    logs.push(rawLogs[index]);
  }
  return logs;
}

function formatName(value: string): string {
  if (!value) return "Pokémon";
  const parts = value.split(": ");
  const raw = parts.length > 1 ? parts[1] : value;
  const cleanId = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return getSpeciesFrenchName(cleanId, raw);
}

function parseHp(value: string): [number, number] {
  if (!value) return [0, 0];
  const clean = value.replace(" fnt", "").replace("fnt", "").trim();
  const parts = clean.split("/");
  if (parts.length === 2) {
    return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0];
  }
  // « 0 fnt » n'expose que les PV courants (0) : le total est résolu ailleurs.
  return [parseInt(parts[0], 10) || 0, 0];
}

/** Retrouve le total de PV du combattant désigné par une étiquette protocole. */
function resolveMaxHp(battle: Battle, tag: string): number {
  const simSide = tag.startsWith("p1") ? battle.p1 : battle.p2;
  const active = simSide.active?.[0];
  if (active && active.maxhp) return active.maxhp;
  const namePart = tag.split(": ")[1];
  const match = simSide.pokemon.find((pokemon) => pokemon.name === namePart);
  return match?.maxhp ?? 0;
}

/** Extrait le contenu d'une clause `[from] ...` d'une ligne de protocole. */
function parseFromClause(parts: string[]): string {
  const clause = parts.slice(2).find((part) => part.startsWith("[from]"));
  return clause
    ? clause
        .replace("[from]", "")
        .replace("move:", "")
        .replace("item:", "")
        .replace("ability:", "")
        .trim()
    : "";
}

function residualDamageMessage(tag: string, effect: string): string {
  const name = formatName(tag);
  const key = effect.toLowerCase();
  if (key === "psn" || key === "tox" || key.includes("poison")) {
    return `Le poison inflige des dégâts à ${name} !`;
  }
  if (key === "brn" || key.includes("burn")) {
    return `La brûlure inflige des dégâts à ${name} !`;
  }
  if (key.includes("sandstorm"))
    return `La tempête de sable inflige des dégâts à ${name} !`;
  if (key.includes("hail")) return `La grêle inflige des dégâts à ${name} !`;
  if (key.includes("leech seed"))
    return `Vampigraine draine l'énergie de ${name} !`;
  if (key.includes("curse")) return `${name} souffre du Maléfice !`;
  if (key.includes("nightmare"))
    return `${name} est prisonnier de son Cauchemar !`;
  if (
    key.includes("bind") ||
    key.includes("wrap") ||
    key.includes("clamp") ||
    key.includes("fire spin") ||
    key.includes("whirlpool") ||
    key.includes("sand tomb") ||
    key.includes("magma storm")
  ) {
    return `${name} est blessé par l'étreinte !`;
  }
  if (key.includes("spikes") || key.includes("stealth rock")) {
    return `${name} est blessé par les pièges !`;
  }
  if (key.includes("recoil")) return `${name} est blessé par le contrecoup !`;
  return `${name} subit des dégâts !`;
}

function healMessage(tag: string, effect: string): string {
  const name = formatName(tag);
  const key = effect.toLowerCase();

  if (key.includes("leech seed"))
    return `${name} récupère des PV grâce à Vampigraine !`;
  if (key.includes("drain")) return `${name} draine l'énergie de sa cible !`;
  if (key.includes("ingrain"))
    return `${name} puise sa force dans ses racines !`;
  if (key.includes("aqua ring"))
    return `Un voile d'eau restaure les PV de ${name} !`;
  if (key.includes("rain dish") || key.includes("raindish")) {
    return `La pluie restaure les PV de ${name} !`;
  }
  if (key.includes("leftovers"))
    return `Les Restes restaurent les PV de ${name} !`;
  if (key.includes("wish")) return `Le Vœu de ${name} se réalise !`;
  return `${name} récupère des PV !`;
}

function weatherMessage(weather: string, upkeep: boolean): string {
  const key = weather.toLowerCase();
  if (key.includes("sandstorm")) {
    return upkeep
      ? "La tempête de sable fait rage !"
      : "Une tempête de sable se lève !";
  }
  if (key.includes("hail"))
    return upkeep ? "La grêle tombe dru !" : "Il se met à grêler !";
  if (key.includes("rain")) {
    return upkeep ? "La pluie continue de tomber." : "Il se met à pleuvoir !";
  }
  if (
    key.includes("sun") ||
    key.includes("harsh") ||
    key.includes("desolate")
  ) {
    return upkeep
      ? "Les rayons du soleil brûlent."
      : "Les rayons du soleil deviennent ardents !";
  }
  return upkeep ? "Le climat fait rage !" : "Le climat change !";
}

function boostMessage(
  tag: string,
  stat: string,
  amount: number,
  up: boolean,
): string {
  const name = formatName(tag);
  const statFr: Record<string, string> = {
    atk: "l'Attaque",
    def: "la Défense",
    spa: "l'Attaque Spéciale",
    spd: "la Défense Spéciale",
    spe: "la Vitesse",
    accuracy: "la Précision",
    evasion: "l'Esquive",
  };
  const label = statFr[stat] ?? stat;
  if (up) {
    return amount >= 2
      ? `${name} : ${label} augmente beaucoup !`
      : `${name} : ${label} augmente !`;
  }
  return amount >= 2
    ? `${name} : ${label} baisse beaucoup !`
    : `${name} : ${label} baisse !`;
}

function cantMessage(tag: string, reason: string): string {
  const name = formatName(tag);
  switch (reason) {
    case "par":
      return `${name} est paralysé ! Il ne peut plus attaquer !`;
    case "slp":
      return `${name} dort à poings fermés !`;
    case "frz":
      return `${name} est gelé !`;
    case "flinch":
      return `${name} a peur et ne peut plus bouger !`;
    case "recharge":
      return `${name} doit se reposer !`;
    case "nopp":
      return `${name} n'a plus de PP pour cette capacité !`;
    default:
      return `${name} ne peut pas attaquer !`;
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case "brn":
      return "brûlé";
    case "par":
      return "paralysé";
    case "slp":
      return "endormi";
    case "psn":
    case "tox":
      return "empoisonné";
    case "frz":
      return "gelé";
    default:
      return status;
  }
}

function cureStatusMessage(tag: string, status: string): string {
  const name = formatName(tag);
  switch (status) {
    case "slp":
      return `${name} se réveille !`;
    case "frz":
      return `${name} n'est plus gelé !`;
    case "par":
      return `${name} n'est plus paralysé !`;
    case "brn":
      return `${name} n'est plus brûlé !`;
    case "psn":
    case "tox":
      return `${name} n'est plus empoisonné !`;
    default:
      return `${name} retrouve la forme !`;
  }
}

function volatileStartMessage(tag: string, effect: string): string {
  const name = formatName(tag);
  const key = effect.toLowerCase();
  if (key.includes("leech seed"))
    return `${name} est infecté par Vampigraine !`;
  if (key.includes("confusion")) return `${name} est confus !`;
  if (key.includes("substitute")) return `${name} crée un clone !`;
  if (key.includes("nightmare")) return `${name} sombre dans un cauchemar !`;
  if (key.includes("curse")) return `Un maléfice frappe ${name} !`;
  if (key.includes("taunt")) return `${name} tombe dans la provocation !`;
  if (key.includes("encore")) return `${name} doit faire un rappel !`;
  return "";
}
