import "server-only";

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
import type {
  TrainerPokemon,
  TrainerPokemonInput,
  PokemonType,
} from "../content/schemas";
import { parseBattleLogs } from "./battle-log-parser";
import { getMoveFrenchName } from "../pokemon/move-names-fr";
import { getSpeciesFrenchName } from "../pokemon/species-names-fr";

const dex = Dex.forGen(4);

const DISPLAYABLE_STATUSES: readonly BattleStatus[] = [
  "brn",
  "par",
  "slp",
  "psn",
  "tox",
  "frz",
];

/** Ne garde qu'une altération d'état réelle ; « fnt » et l'inconnu deviennent `null`. */
function normalizeBattleStatus(raw: unknown): BattleStatus {
  return DISPLAYABLE_STATUSES.includes(raw as BattleStatus)
    ? (raw as BattleStatus)
    : null;
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
    WeakMap<
      object,
      { member: TrainerPokemon | TrainerPokemonInput; slot: number }
    >
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

    this.battle.setPlayer("p1", {
      name: options.p1.name,
      team: p1ShowdownTeam,
    });
    this.battle.setPlayer("p2", {
      name: options.p2.name,
      team: p2ShowdownTeam,
    });

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
    const p1Done =
      this.battle.p1.isChoiceDone() || this.battle.p1.requestState === "";
    const p2Done =
      this.battle.p2.isChoiceDone() || this.battle.p2.requestState === "";
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
            const idx = active.moveSlots.findIndex(
              (slot) => slot.id === moveId,
            );
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
      | {
          active?: Array<{
            moves?: Array<{
              id?: string;
              move?: string;
              disabled?: boolean | string;
            }>;
          }>;
        }
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

    const events = parseBattleLogs(rawLogs, {
      battle: this.battle,
      playerNames: { p1: this.p1Info.name, p2: this.p2Info.name },
    });

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

  private buildSideState(
    sideId: BattleSideId,
    sideInfo: BattleSideInfo,
  ): BattleSideState {
    const simSide = sideId === "p1" ? this.battle.p1 : this.battle.p2;
    const originMap = this.originBySide[sideId];

    const teamState: BattlePokemonState[] = simSide.pokemon.map(
      (pkmn, index) => {
        // Identité liée à l'instance : robuste au réordonnancement post-switch.
        const origin = originMap.get(pkmn);
        const original = origin?.member ?? sideInfo.team[index];
        const stableSlot = origin?.slot ?? index;
        const spec = dex.species.get(pkmn.species.name);
        const isActive =
          Boolean(pkmn.isActive) || simSide.active.includes(pkmn);

        // Coups verrouillés ce tour (Uproar, Bide, Encore, Entrave, Provoc...) :
        // l'interface doit les griser, sinon un clic déclenche un rejet serveur.
        const allowedMoveIds =
          isActive && simSide.requestState === "move"
            ? this.getRequestMoveIds(simSide)
            : null;

        const moveInfos: BattleMoveInfo[] = pkmn.moveSlots.map((slot) => {
          const moveData = dex.moves.get(slot.id);
          const frenchName = getMoveFrenchName(
            slot.id,
            moveData.name || slot.id,
          );
          const lockedOut =
            allowedMoveIds !== null && !allowedMoveIds.includes(slot.id);
          return {
            id: slot.id,
            name: frenchName,
            type: (moveData.type === "???"
              ? "Ghost"
              : moveData.type) as PokemonType,
            category:
              (moveData.category.toLowerCase() as
                "physical" | "special" | "status") || "physical",
            power: moveData.basePower || 0,
            accuracy:
              moveData.accuracy === true
                ? 100
                : (moveData.accuracy as number) || 100,
            pp: slot.pp,
            maxPp: slot.maxpp,
            disabled: !!slot.disabled || lockedOut,
          };
        });

        const currentHp = Math.max(0, pkmn.hp);
        const maxHp = pkmn.maxhp || 1;
        const hpPercent = Math.round((currentHp / maxHp) * 100);
        const frenchSpeciesName = getSpeciesFrenchName(
          pkmn.species.id,
          pkmn.name,
        );

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
      },
    );

    const activeIndex = teamState.findIndex((p) => p.isActive);

    return {
      sideId,
      name: sideInfo.name,
      avatar: sideInfo.avatar,
      team: teamState,
      activePokemonIndex: activeIndex >= 0 ? activeIndex : 0,
    };
  }
}
