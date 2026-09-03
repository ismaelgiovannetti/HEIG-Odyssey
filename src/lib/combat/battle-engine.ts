import { randomUUID } from "node:crypto";
import { Battle, Dex, toID } from "@pkmn/sim";
import type { PRNGSeed } from "@pkmn/sim";
import type {
  BattleState,
  BattleSideState,
  BattlePokemonState,
  BattleMoveInfo,
  BattleAction,
  BattleEvent,
  TurnExecutionResult,
  BattleSideId,
  BattlePhase,
  BattleStatus,
} from "./types";
import type { TrainerPokemon, TrainerPokemonInput, Move, PokemonType } from "../content/schemas";
import { getSpecies } from "../content/loader";
import { getMoveFrenchName } from "../pokemon/move-names-fr";
import { getSpeciesFrenchName } from "../pokemon/species-names-fr";

const dex = Dex.forGen(4);

const DISPLAYABLE_STATUSES: readonly BattleStatus[] = ["brn", "par", "slp", "psn", "tox", "frz"];

/** Ne garde qu'une altération d'état réelle ; « fnt » et l'inconnu deviennent `null`. */
function normalizeBattleStatus(raw: unknown): BattleStatus {
  return DISPLAYABLE_STATUSES.includes(raw as BattleStatus) ? (raw as BattleStatus) : null;
}

interface BattleSideInfo {
  name: string;
  avatar?: string;
  team: (TrainerPokemon | TrainerPokemonInput)[];
}

export interface BattleInitOptions {
  battleId?: string;
  p1: BattleSideInfo;
  p2: BattleSideInfo;
  seed?: PRNGSeed;
}

export class BattleEngine {
  public readonly battleId: string;
  private battle: Battle;
  private p1Info: BattleSideInfo;
  private p2Info: BattleSideInfo;
  private logCursor = 0;
  private accumulatedEvents: BattleEvent[] = [];

  // `@pkmn/sim` réordonne `side.pokemon` (l'actif passe en tête) à chaque
  // changement. On lie donc chaque instance de combattant à sa fiche d'origine
  // et à son emplacement initial, pour ne jamais rattacher un surnom — ni un
  // identifiant — au mauvais Pokémon après un switch.
  private readonly originBySide: Record<
    BattleSideId,
    WeakMap<object, { member: TrainerPokemon | TrainerPokemonInput; slot: number }>
  > = { p1: new WeakMap(), p2: new WeakMap() };

  constructor(options: BattleInitOptions) {
    // Un identifiant imprévisible évite qu'un autre joueur puisse deviner une
    // session de combat active. L'autorisation reste néanmoins vérifiée côté API.
    this.battleId = options.battleId ?? `battle-${randomUUID()}`;
    this.p1Info = options.p1;
    this.p2Info = options.p2;

    const p1ShowdownTeam = this.convertToPokemonSet(options.p1.team);
    const p2ShowdownTeam = this.convertToPokemonSet(options.p2.team);

    this.battle = new Battle({
      formatid: toID("gen4customgame"),
      seed: options.seed,
    });

    this.battle.setPlayer("p1", { name: options.p1.name, team: p1ShowdownTeam });
    this.battle.setPlayer("p2", { name: options.p2.name, team: p2ShowdownTeam });

    // Juste après `setPlayer`, `side.pokemon` est encore dans l'ordre d'entrée.
    this.linkOrigins("p1", options.p1.team);
    this.linkOrigins("p2", options.p2.team);

    // Process initial intro logs
    this.parseNewLogs();
  }

  private linkOrigins(
    sideId: BattleSideId,
    team: (TrainerPokemon | TrainerPokemonInput)[],
  ): void {
    const simSide = sideId === "p1" ? this.battle.p1 : this.battle.p2;
    const map = this.originBySide[sideId];
    simSide.pokemon.forEach((pkmn, index) => {
      if (team[index]) map.set(pkmn, { member: team[index], slot: index });
    });
  }

  private convertToPokemonSet(team: (TrainerPokemon | TrainerPokemonInput)[]) {
    return team.map((member) => {
      const spec = dex.species.get(member.speciesId);
      const moves = member.moves.map((m) => m.id);

      return {
        name: member.nickname || spec.name,
        species: spec.name,
        level: member.level,
        moves: moves.length > 0 ? moves : ["tackle"],
        ability: spec.abilities["0"] || "Overgrow",
        item: "",
        gender: "",
        shiny: member.isShiny ?? false,
        ivs: {
          hp: member.ivs?.hp ?? 31,
          atk: member.ivs?.atk ?? 31,
          def: member.ivs?.def ?? 31,
          spa: member.ivs?.spa ?? 31,
          spd: member.ivs?.spd ?? 31,
          spe: member.ivs?.spe ?? 31,
        },
        evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        nature: member.nature || "Hardy",
      };
    });
  }

  /** Escape hatch to the underlying @pkmn/sim Battle instance. */
  public getRawBattle(): Battle {
    return this.battle;
  }

  /** True once both sides have submitted their choice for the current turn. */
  public isTurnReady(): boolean {
    const p1Done = this.battle.p1.isChoiceDone() || this.battle.p1.requestState === "";
    const p2Done = this.battle.p2.isChoiceDone() || this.battle.p2.requestState === "";
    return p1Done && p2Done;
  }

  /** Lists the moves/switches a side may currently choose from. */
  public getValidActions(side: BattleSideId): BattleAction[] {
    if (this.battle.ended) return [];

    const simSide = side === "p1" ? this.battle.p1 : this.battle.p2;
    const reqState = simSide.requestState;

    const actions: BattleAction[] = [];

    // Forced switch (e.g. after a faint)
    if (reqState === "switch") {
      simSide.pokemon.forEach((pkmn, idx) => {
        if (!pkmn.isActive && !pkmn.fainted) {
          actions.push({ type: "switch", targetPokemonIndex: idx });
        }
      });
      return actions;
    }

    // Normal move selection
    if (reqState === "move" || reqState === "teampreview" || reqState === "") {
      const active = simSide.active[0];
      if (active && !active.fainted) {
        // Le simulateur impose parfois la liste exacte des coups jouables ce
        // tour (verrou Uproar / Bide / Danse-Fleur, Entrave, Provoc, objet
        // Choix, Encore...). S'y fier évite de proposer un coup que
        // `battle.choose` refusera ensuite, ce qui bloquerait tout le combat.
        const requestMoves = this.getRequestMoveIds(simSide);

        if (requestMoves) {
          requestMoves.forEach((moveId) => {
            const idx = active.moveSlots.findIndex((slot) => slot.id === moveId);
            if (idx >= 0) actions.push({ type: "move", moveIndex: idx });
          });
        } else {
          active.moveSlots.forEach((slot, idx) => {
            if (!slot.disabled && slot.pp > 0) {
              actions.push({ type: "move", moveIndex: idx });
            }
          });
        }

        // Repli sur « move 1 » (Lutte / coup forcé) si rien n'a été retenu.
        if (actions.length === 0) {
          actions.push({ type: "move", moveIndex: 0 });
        }

        // Add switches if not trapped
        if (!active.trapped) {
          simSide.pokemon.forEach((pkmn, idx) => {
            if (!pkmn.isActive && !pkmn.fainted) {
              actions.push({ type: "switch", targetPokemonIndex: idx });
            }
          });
        }
      }
    }

    return actions;
  }

  /**
   * Identifiants des coups réellement jouables ce tour d'après la requête du
   * simulateur, ou `null` si les quatre emplacements restent disponibles.
   */
  private getRequestMoveIds(simSide: Battle["p1"]): string[] | null {
    const request = (simSide as { activeRequest?: unknown }).activeRequest as
      | { active?: Array<{ moves?: Array<{ id?: string; move?: string; disabled?: boolean | string }> }> }
      | null
      | undefined;

    const requestMoves = request?.active?.[0]?.moves;
    if (!Array.isArray(requestMoves) || requestMoves.length === 0) return null;

    const ids = requestMoves
      .filter((entry) => !entry.disabled)
      .map((entry) => entry.id ?? (entry.move ? toID(entry.move) : ""))
      .filter((id): id is string => id.length > 0);

    // Une requête à quatre coups non contraints équivaut à « pas de verrou ».
    if (ids.length >= 4) return null;
    return ids.length > 0 ? ids : null;
  }

  /** Submits a side's chosen action for the current turn. */
  public submitAction(side: BattleSideId, action: BattleAction): boolean {
    if (this.battle.ended) return false;

    const simSide = side === "p1" ? this.battle.p1 : this.battle.p2;
    let choiceStr = "";

    if (action.type === "switch") {
      choiceStr = `switch ${action.targetPokemonIndex + 1}`;
    } else {
      // Quand le simulateur restreint les coups jouables ce tour (verrou Uproar
      // / Bide / Danse-Fleur, Encore, Entrave, Provoc, objet Choix...), la
      // requête `move N` s'indexe sur cette liste réduite et non sur les quatre
      // emplacements. On convertit donc l'index d'emplacement en position réelle.
      const requestIds = this.getRequestMoveIds(simSide);
      if (requestIds) {
        const wantedId = simSide.active?.[0]?.moveSlots?.[action.moveIndex]?.id;
        const pos = wantedId ? requestIds.indexOf(wantedId) : -1;
        choiceStr = `move ${(pos >= 0 ? pos : 0) + 1}`;
      } else {
        choiceStr = `move ${action.moveIndex + 1}`;
      }
    }

    if (this.battle.choose(side, choiceStr)) {
      return true;
    }

    // Dernier recours : le choix reste refusé (cible piégée, état incohérent...).
    // On applique le choix forcé du simulateur pour ne jamais figer le combat.
    simSide.clearChoice();
    return this.battle.choose(side, "default");
  }

  /** Parses raw @pkmn/sim protocol lines emitted since the last call into BattleEvents. */
  public parseNewLogs(): BattleEvent[] {
    const rawLogs = this.battle.log.slice(this.logCursor);
    this.logCursor = this.battle.log.length;

    // Showdown émet chaque changement de PV / soin / entrée en jeu en double :
    // une ligne « détaillée » destinée au joueur concerné, précédée de
    // `|split|<camp>`, puis une ligne « publique » redactée pour les
    // spectateurs. Sans ce filtrage, chaque coup déclencherait deux fois son
    // animation et ferait chuter la jauge de PV en deux paliers identiques.
    const newLogs: string[] = [];
    for (let i = 0; i < rawLogs.length; i++) {
      if (rawLogs[i].startsWith("|split|")) {
        const detailed = rawLogs[i + 1];
        if (detailed !== undefined) newLogs.push(detailed);
        i += 2; // saute la version détaillée (conservée) et son doublon public
        continue;
      }
      newLogs.push(rawLogs[i]);
    }

    const events: BattleEvent[] = [];
    const turn = this.battle.turn;

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
            message: `${this.formatName(userStr)} utilise ${frenchMove} !`,
          });
          break;
        }

        case "-damage": {
          // |-damage|p2a: Chimchar|19/31  ou  |-damage|p1a: X|12/40|[from] psn
          const targetStr = parts[1] || "";
          const hpStr = parts[2] || "";
          const side: BattleSideId = targetStr.startsWith("p1") ? "p1" : "p2";

          let [currHp, maxHp] = this.parseHp(hpStr);
          if (maxHp <= 0) {
            // Une cible K.O. (`0 fnt`) n'expose pas son total : on le retrouve
            // sur le combattant réel pour ne jamais afficher « 0/0 ».
            maxHp = this.resolveMaxHp(targetStr) || maxHp;
          }
          const percent = maxHp > 0 ? Math.round((currHp / maxHp) * 100) : 0;

          const fromEffect = this.parseFromClause(parts);
          const residual = Boolean(fromEffect);

          events.push({
            type: "damage",
            turn,
            side,
            currentHp: currHp,
            maxHp: maxHp,
            hpPercent: percent,
            residual,
            fromEffect: fromEffect || undefined,
            message: residual
              ? this.residualDamageMessage(targetStr, fromEffect)
              : `${this.formatName(targetStr)} subit des dégâts !`,
          });
          break;
        }

        case "-sethp": {
          // Ajustement direct des PV (Balance, Douleur...) traité comme un dégât.
          const targetStr = parts[1] || "";
          const hpStr = parts[2] || "";
          const side: BattleSideId = targetStr.startsWith("p1") ? "p1" : "p2";
          let [currHp, maxHp] = this.parseHp(hpStr);
          if (maxHp <= 0) maxHp = this.resolveMaxHp(targetStr) || maxHp;
          const percent = maxHp > 0 ? Math.round((currHp / maxHp) * 100) : 0;
          events.push({
            type: "damage",
            turn,
            side,
            currentHp: currHp,
            maxHp,
            hpPercent: percent,
            residual: true,
            message: `Les PV de ${this.formatName(targetStr)} changent !`,
          });
          break;
        }

        case "-heal": {
          // |-heal|p1a: Turtwig|30/34  ou  |-heal|p1a: X|30/34|[from] move: Leech Seed
          const targetStr = parts[1] || "";
          const hpStr = parts[2] || "";
          const side: BattleSideId = targetStr.startsWith("p1") ? "p1" : "p2";

          let [currHp, maxHp] = this.parseHp(hpStr);
          if (maxHp <= 0) maxHp = this.resolveMaxHp(targetStr) || maxHp;
          const percent = maxHp > 0 ? Math.round((currHp / maxHp) * 100) : 0;

          const fromEffect = this.parseFromClause(parts);

          events.push({
            type: "heal",
            turn,
            side,
            currentHp: currHp,
            maxHp: maxHp,
            hpPercent: percent,
            fromEffect: fromEffect || undefined,
            message: this.healMessage(targetStr, fromEffect),
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
            message: `Cela n'affecte pas ${this.formatName(targetStr)}...`,
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
          const upkeep = parts.slice(2).some((p) => p.startsWith("[upkeep]"));
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
            message: this.weatherMessage(weather, upkeep),
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
            message: this.boostMessage(targetStr, stat, amount, cmd === "-boost"),
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
            message: this.cantMessage(targetStr, reason),
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
          const message = this.volatileStartMessage(targetStr, effect);
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
            message: `${this.formatName(targetStr)} est maintenant ${this.formatStatus(status)} !`,
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
            message: this.cureStatusMessage(targetStr, status),
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
            message: `${this.formatName(targetStr)} est K.O. !`,
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
          let [switchInHp, switchInMax] = this.parseHp(hpStr);
          if (switchInMax <= 0) switchInMax = this.resolveMaxHp(userStr) || switchInMax;
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
                : `${this.p2Info.name} envoie ${frenchPkmnName} au combat !`,
          });
          break;
        }

        case "win": {
          const winnerName = parts[1] || "";
          const winner: BattleSideId = winnerName === this.p1Info.name ? "p1" : "p2";
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
            message: `L'attaque a manqué sa cible !`,
          });
          break;
        }
      }
    }

    this.accumulatedEvents.push(...events);
    return events;
  }

  /** Resolves the turn once both sides have submitted an action, returning the resulting events and state. */
  public executeTurn(): TurnExecutionResult {
    const events = this.parseNewLogs();
    const state = this.getState();

    return {
      turn: state.turn,
      events,
      state,
    };
  }

  /** Builds a serializable snapshot of the current battle state. */
  public getState(): BattleState {
    const p1State = this.buildSideState("p1", this.p1Info);
    const p2State = this.buildSideState("p2", this.p2Info);

    let phase: BattlePhase = "action_selection";
    if (this.battle.ended) {
      phase = "finished";
    } else if (this.battle.p1.requestState === "switch") {
      // La phase exposée à l'interface décrit uniquement l'action attendue
      // du joueur. Les remplacements adverses sont résolus côté serveur.
      phase = "switch_required";
    }

    let winner: BattleSideId | null = null;
    if (this.battle.winner) {
      winner = this.battle.winner === this.p1Info.name ? "p1" : "p2";
    } else if (this.battle.ended) {
      // Determine winner by alive count
      const p1Alive = p1State.team.some((p) => !p.isFainted);
      const p2Alive = p2State.team.some((p) => !p.isFainted);
      if (p1Alive && !p2Alive) winner = "p1";
      else if (!p1Alive && p2Alive) winner = "p2";
    }

    return {
      battleId: this.battleId,
      turn: this.battle.turn,
      phase,
      p1: p1State,
      p2: p2State,
      winner,
      logs: this.battle.log,
    };
  }

  private buildSideState(sideId: BattleSideId, sideInfo: BattleSideInfo): BattleSideState {
    const simSide = sideId === "p1" ? this.battle.p1 : this.battle.p2;
    const originMap = this.originBySide[sideId];

    const teamState: BattlePokemonState[] = simSide.pokemon.map((pkmn, index) => {
      // Identité liée à l'instance : robuste au réordonnancement post-switch.
      const origin = originMap.get(pkmn);
      const original = origin?.member ?? sideInfo.team[index];
      const stableSlot = origin?.slot ?? index;
      const spec = dex.species.get(pkmn.species.name);
      const isActive = Boolean(pkmn.isActive) || simSide.active.includes(pkmn);

      // Coups verrouillés ce tour (Uproar, Bide, Encore, Entrave, Provoc...) :
      // l'interface doit les griser, sinon un clic déclenche un rejet serveur.
      const allowedMoveIds =
        isActive && simSide.requestState === "move"
          ? this.getRequestMoveIds(simSide)
          : null;

      const moveInfos: BattleMoveInfo[] = pkmn.moveSlots.map((slot) => {
        const moveData = dex.moves.get(slot.id);
        const frenchName = getMoveFrenchName(slot.id, moveData.name || slot.id);
        const lockedOut = allowedMoveIds !== null && !allowedMoveIds.includes(slot.id);
        return {
          id: slot.id,
          name: frenchName,
          type: (moveData.type === "???" ? "Ghost" : moveData.type) as PokemonType,
          category: (moveData.category.toLowerCase() as "physical" | "special" | "status") || "physical",
          power: moveData.basePower || 0,
          accuracy: moveData.accuracy === true ? 100 : (moveData.accuracy as number) || 100,
          pp: slot.pp,
          maxPp: slot.maxpp,
          disabled: !!slot.disabled || lockedOut,
        };
      });

      const currentHp = Math.max(0, pkmn.hp);
      const maxHp = pkmn.maxhp || 1;
      const hpPercent = Math.round((currentHp / maxHp) * 100);
      const frenchSpeciesName = getSpeciesFrenchName(pkmn.species.id, pkmn.name);

      return {
        id: `${sideId}-${stableSlot}-${pkmn.species.id}`,
        speciesId: pkmn.species.id,
        name: frenchSpeciesName,
        nickname: original?.nickname,
        level: pkmn.level,
        types: (pkmn.types as PokemonType[]) || ["Normal"],
        currentHp,
        maxHp,
        hpPercent,
        // `@pkmn/sim` marque un combattant K.O. avec le statut « fnt », qui
        // n'est pas une altération d'état affichable. On ne conserve que les
        // six altérations réelles ; l'état K.O. est porté par `isFainted`.
        status: normalizeBattleStatus(pkmn.status),
        moves: moveInfos,
        isShiny: pkmn.set.shiny ?? false,
        isActive,
        isFainted: pkmn.fainted || currentHp === 0,
        baseStats: {
          hp: spec.baseStats.hp,
          attack: spec.baseStats.atk,
          defense: spec.baseStats.def,
          specialAttack: spec.baseStats.spa,
          specialDefense: spec.baseStats.spd,
          speed: spec.baseStats.spe,
        },
        boosts: pkmn.boosts,
      };
    });

    const activeIndex = teamState.findIndex((p) => p.isActive);

    return {
      sideId,
      name: sideInfo.name,
      avatar: sideInfo.avatar,
      team: teamState,
      activePokemonIndex: activeIndex >= 0 ? activeIndex : 0,
    };
  }

  private formatName(str: string): string {
    if (!str) return "Pokémon";
    const parts = str.split(": ");
    const raw = parts.length > 1 ? parts[1] : str;
    const cleanId = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    return getSpeciesFrenchName(cleanId, raw);
  }

  private parseHp(str: string): [number, number] {
    if (!str) return [0, 0];
    const clean = str.replace(" fnt", "").replace("fnt", "").trim();
    const parts = clean.split("/");
    if (parts.length === 2) {
      return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0];
    }
    // « 0 fnt » n'expose que les PV courants (0) : le total est résolu ailleurs.
    return [parseInt(parts[0], 10) || 0, 0];
  }

  /** Retrouve le total de PV du combattant désigné par une étiquette protocole. */
  private resolveMaxHp(tag: string): number {
    const simSide = tag.startsWith("p1") ? this.battle.p1 : this.battle.p2;
    const active = simSide.active?.[0];
    if (active && active.maxhp) return active.maxhp;
    const namePart = tag.split(": ")[1];
    const match = simSide.pokemon.find((p) => p.name === namePart);
    return match?.maxhp ?? 0;
  }

  /** Extrait le contenu d'une clause `[from] ...` d'une ligne de protocole. */
  private parseFromClause(parts: string[]): string {
    const clause = parts.slice(2).find((p) => p.startsWith("[from]"));
    return clause ? clause.replace("[from]", "").replace("move:", "").replace("item:", "").replace("ability:", "").trim() : "";
  }

  private residualDamageMessage(tag: string, effect: string): string {
    const name = this.formatName(tag);
    const key = effect.toLowerCase();
    if (key === "psn" || key === "tox" || key.includes("poison")) return `Le poison inflige des dégâts à ${name} !`;
    if (key === "brn" || key.includes("burn")) return `La brûlure inflige des dégâts à ${name} !`;
    if (key.includes("sandstorm")) return `La tempête de sable inflige des dégâts à ${name} !`;
    if (key.includes("hail")) return `La grêle inflige des dégâts à ${name} !`;
    if (key.includes("leech seed")) return `Vampigraine draine l'énergie de ${name} !`;
    if (key.includes("curse")) return `${name} souffre du Maléfice !`;
    if (key.includes("nightmare")) return `${name} est prisonnier de son Cauchemar !`;
    if (
      key.includes("bind") || key.includes("wrap") || key.includes("clamp") ||
      key.includes("fire spin") || key.includes("whirlpool") || key.includes("sand tomb") ||
      key.includes("magma storm")
    ) return `${name} est blessé par l'étreinte !`;
    if (key.includes("spikes") || key.includes("stealth rock")) return `${name} est blessé par les pièges !`;
    if (key.includes("recoil")) return `${name} est blessé par le contrecoup !`;
    return `${name} subit des dégâts !`;
  }

  private healMessage(tag: string, effect: string): string {
    const name = this.formatName(tag);
    const key = effect.toLowerCase();
    if (key.includes("leech seed")) return `${name} récupère des PV grâce à Vampigraine !`;
    if (key.includes("drain")) return `${name} draine l'énergie de sa cible !`;
    if (key.includes("ingrain")) return `${name} puise sa force dans ses racines !`;
    if (key.includes("aqua ring")) return `Un voile d'eau restaure les PV de ${name} !`;
    if (key.includes("rain dish") || key.includes("raindish")) return `La pluie restaure les PV de ${name} !`;
    if (key.includes("leftovers")) return `Les Restes restaurent les PV de ${name} !`;
    if (key.includes("wish")) return `Le Vœu de ${name} se réalise !`;
    return `${name} récupère des PV !`;
  }

  private weatherMessage(weather: string, upkeep: boolean): string {
    const key = weather.toLowerCase();
    if (key.includes("sandstorm")) return upkeep ? "La tempête de sable fait rage !" : "Une tempête de sable se lève !";
    if (key.includes("hail")) return upkeep ? "La grêle tombe dru !" : "Il se met à grêler !";
    if (key.includes("rain")) return upkeep ? "La pluie continue de tomber." : "Il se met à pleuvoir !";
    if (key.includes("sun") || key.includes("harsh") || key.includes("desolate")) {
      return upkeep ? "Les rayons du soleil brûlent." : "Les rayons du soleil deviennent ardents !";
    }
    return upkeep ? "Le climat fait rage !" : "Le climat change !";
  }

  private boostMessage(tag: string, stat: string, amount: number, up: boolean): string {
    const name = this.formatName(tag);
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
    if (up) return amount >= 2 ? `${name} : ${label} augmente beaucoup !` : `${name} : ${label} augmente !`;
    return amount >= 2 ? `${name} : ${label} baisse beaucoup !` : `${name} : ${label} baisse !`;
  }

  private cantMessage(tag: string, reason: string): string {
    const name = this.formatName(tag);
    switch (reason) {
      case "par": return `${name} est paralysé ! Il ne peut plus attaquer !`;
      case "slp": return `${name} dort à poings fermés !`;
      case "frz": return `${name} est gelé !`;
      case "flinch": return `${name} a peur et ne peut plus bouger !`;
      case "recharge": return `${name} doit se reposer !`;
      case "nopp": return `${name} n'a plus de PP pour cette capacité !`;
      default: return `${name} ne peut pas attaquer !`;
    }
  }

  private formatStatus(status: string): string {
    switch (status) {
      case "brn": return "brûlé";
      case "par": return "paralysé";
      case "slp": return "endormi";
      case "psn":
      case "tox": return "empoisonné";
      case "frz": return "gelé";
      default: return status;
    }
  }

  private cureStatusMessage(tag: string, status: string): string {
    const name = this.formatName(tag);
    switch (status) {
      case "slp": return `${name} se réveille !`;
      case "frz": return `${name} n'est plus gelé !`;
      case "par": return `${name} n'est plus paralysé !`;
      case "brn": return `${name} n'est plus brûlé !`;
      case "psn":
      case "tox": return `${name} n'est plus empoisonné !`;
      default: return `${name} retrouve la forme !`;
    }
  }

  private volatileStartMessage(tag: string, effect: string): string {
    const name = this.formatName(tag);
    const key = effect.toLowerCase();
    if (key.includes("leech seed")) return `${name} est infecté par Vampigraine !`;
    if (key.includes("confusion")) return `${name} est confus !`;
    if (key.includes("substitute")) return `${name} crée un clone !`;
    if (key.includes("nightmare")) return `${name} sombre dans un cauchemar !`;
    if (key.includes("curse")) return `Un maléfice frappe ${name} !`;
    if (key.includes("taunt")) return `${name} tombe dans la provocation !`;
    if (key.includes("encore")) return `${name} doit faire un rappel !`;
    return "";
  }
}
