import { Battle, Dex, toID } from "@pkmn/sim";
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

const dex = Dex.forGen(4);

export interface BattleInitOptions {
  battleId?: string;
  p1: {
    name: string;
    avatar?: string;
    team: (TrainerPokemon | TrainerPokemonInput)[];
  };
  p2: {
    name: string;
    avatar?: string;
    team: (TrainerPokemon | TrainerPokemonInput)[];
  };
  seed?: any;
}

export class BattleEngine {
  public readonly battleId: string;
  private battle: Battle;
  private p1Info: { name: string; avatar?: string; team: (TrainerPokemon | TrainerPokemonInput)[] };
  private p2Info: { name: string; avatar?: string; team: (TrainerPokemon | TrainerPokemonInput)[] };
  private logCursor = 0;
  private accumulatedEvents: BattleEvent[] = [];

  constructor(options: BattleInitOptions) {
    this.battleId = options.battleId || `battle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

    // Process initial intro logs
    this.parseNewLogs();
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

  public getRawBattle(): Battle {
    return this.battle;
  }

  public isTurnReady(): boolean {
    const p1Done = this.battle.p1.isChoiceDone() || this.battle.p1.requestState === "";
    const p2Done = this.battle.p2.isChoiceDone() || this.battle.p2.requestState === "";
    return p1Done && p2Done;
  }

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
        active.moveSlots.forEach((slot, idx) => {
          if (!slot.disabled && slot.pp > 0) {
            actions.push({ type: "move", moveIndex: idx });
          }
        });

        // Fallback to Struggle if all moves are 0 PP
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

  public submitAction(side: BattleSideId, action: BattleAction): boolean {
    if (this.battle.ended) return false;

    let choiceStr = "";
    if (action.type === "move") {
      choiceStr = `move ${action.moveIndex + 1}`;
    } else if (action.type === "switch") {
      choiceStr = `switch ${action.targetPokemonIndex + 1}`;
    }

    return this.battle.choose(side, choiceStr);
  }

  public parseNewLogs(): BattleEvent[] {
    const newLogs = this.battle.log.slice(this.logCursor);
    this.logCursor = this.battle.log.length;

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
          const moveName = parts[2] || "";
          const targetStr = parts[3] || "";

          const side: BattleSideId = userStr.startsWith("p1") ? "p1" : "p2";
          const targetSide: BattleSideId | undefined = targetStr.startsWith("p1")
            ? "p1"
            : targetStr.startsWith("p2")
            ? "p2"
            : undefined;

          events.push({
            type: "move",
            turn,
            side,
            moveName,
            targetSide,
            message: `${this.formatName(userStr)} utilise ${moveName} !`,
          });
          break;
        }

        case "-damage": {
          // |-damage|p2a: Chimchar|19/31
          const targetStr = parts[1] || "";
          const hpStr = parts[2] || "";
          const side: BattleSideId = targetStr.startsWith("p1") ? "p1" : "p2";

          const [currHp, maxHp] = this.parseHp(hpStr);
          const percent = maxHp > 0 ? Math.round((currHp / maxHp) * 100) : 0;

          events.push({
            type: "damage",
            turn,
            side,
            currentHp: currHp,
            maxHp: maxHp,
            hpPercent: percent,
            message: `${this.formatName(targetStr)} subit des dégâts (${percent}% PV restants).`,
          });
          break;
        }

        case "-heal": {
          // |-heal|p1a: Turtwig|30/34
          const targetStr = parts[1] || "";
          const hpStr = parts[2] || "";
          const side: BattleSideId = targetStr.startsWith("p1") ? "p1" : "p2";

          const [currHp, maxHp] = this.parseHp(hpStr);
          const percent = maxHp > 0 ? Math.round((currHp / maxHp) * 100) : 0;

          events.push({
            type: "heal",
            turn,
            side,
            currentHp: currHp,
            maxHp: maxHp,
            hpPercent: percent,
            message: `${this.formatName(targetStr)} récupère des PV !`,
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
            multiplier: 0,
            message: `Cela n'affecte pas ${this.formatName(targetStr)} !`,
          });
          break;
        }

        case "-crit": {
          const targetStr = parts[1] || "";
          events.push({
            type: "critical_hit",
            turn,
            message: `Coup critique porté à ${this.formatName(targetStr)} !`,
          });
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
          events.push({
            type: "status_cleared",
            turn,
            message: `${this.formatName(targetStr)} n'a plus de problème de statut !`,
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
          const side: BattleSideId = userStr.startsWith("p1") ? "p1" : "p2";
          const pkmnName = details.split(",")[0] || userStr;

          events.push({
            type: "switch",
            turn,
            side,
            message: `${side === "p1" ? this.p1Info.name : this.p2Info.name} envoie ${pkmnName} au combat !`,
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

  public executeTurn(): TurnExecutionResult {
    const events = this.parseNewLogs();
    const state = this.getState();

    return {
      turn: state.turn,
      events,
      state,
    };
  }

  public getState(): BattleState {
    const p1State = this.buildSideState("p1", this.p1Info);
    const p2State = this.buildSideState("p2", this.p2Info);

    let phase: BattlePhase = "action_selection";
    if (this.battle.ended) {
      phase = "finished";
    } else if (
      this.battle.p1.requestState === "switch" ||
      this.battle.p2.requestState === "switch"
    ) {
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

  private buildSideState(
    sideId: BattleSideId,
    sideInfo: { name: string; avatar?: string; team: (TrainerPokemon | TrainerPokemonInput)[] }
  ): BattleSideState {
    const simSide = sideId === "p1" ? this.battle.p1 : this.battle.p2;

    const teamState: BattlePokemonState[] = simSide.pokemon.map((pkmn, index) => {
      const original = sideInfo.team[index];
      const spec = dex.species.get(pkmn.species.name);

      const moveInfos: BattleMoveInfo[] = pkmn.moveSlots.map((slot) => {
        const moveData = dex.moves.get(slot.id);
        return {
          id: slot.id,
          name: moveData.name,
          type: (moveData.type === "???" ? "Ghost" : moveData.type) as PokemonType,
          category: (moveData.category.toLowerCase() as "physical" | "special" | "status") || "physical",
          power: moveData.basePower || 0,
          accuracy: moveData.accuracy === true ? 100 : (moveData.accuracy as number) || 100,
          pp: slot.pp,
          maxPp: slot.maxpp,
          disabled: !!slot.disabled,
        };
      });

      const currentHp = Math.max(0, pkmn.hp);
      const maxHp = pkmn.maxhp || 1;
      const hpPercent = Math.round((currentHp / maxHp) * 100);
      const isActive = Boolean(pkmn.isActive) || simSide.active.includes(pkmn);

      return {
        id: `${sideId}-${index}-${pkmn.species.id}`,
        speciesId: pkmn.species.id,
        name: pkmn.name,
        nickname: original?.nickname,
        level: pkmn.level,
        types: (pkmn.types as PokemonType[]) || ["Normal"],
        currentHp,
        maxHp,
        hpPercent,
        status: (pkmn.status || null) as BattleStatus,
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
    return parts.length > 1 ? parts[1] : str;
  }

  private parseHp(str: string): [number, number] {
    if (!str) return [0, 0];
    if (str.includes("fnt")) return [0, 0];
    const parts = str.split("/");
    if (parts.length === 2) {
      return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0];
    }
    return [0, 0];
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
}
