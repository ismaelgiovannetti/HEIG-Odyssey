import "server-only";

import { BattleEngine } from "./battle-engine";
import { selectAIAction } from "./ai";
import type {
  AIProfile,
  BattleAction,
  BattleState,
  TurnExecutionResult,
} from "./types";
import {
  grantBattleRewards,
  grantTrainingRewards,
  type BattleRewardResult,
} from "../rewards/reward-service";
import { snapshotBattleParticipants } from "./battle-participants";
import type { TrainingDifficulty } from "../training/training-generator";

interface ActiveBattleSession {
  engine: BattleEngine;
  userId: string;
  readonly playerPokemonIds: readonly string[];
  battleType: "CAMPAIGN" | "TRAINING";
  stageId?: string;
  difficulty?: TrainingDifficulty;
  aiProfile: AIProfile;
  lastAccessed: number;
}

// Cette erreur générique ne révèle pas si le combat appartient à un autre joueur.
export class BattleSessionUnavailableError extends Error {
  constructor() {
    super("Session de combat introuvable ou expirée.");
    this.name = "BattleSessionUnavailableError";
  }
}

export class BattleActionRejectedError extends Error {
  constructor(readonly state: BattleState) {
    super("Action incompatible avec l'état courant du combat.");
    this.name = "BattleActionRejectedError";
  }
}

interface ExpectedBattleState {
  turn: number;
  phase: BattleState["phase"];
}

type BattleSessionGlobal = typeof globalThis & {
  __heigOdysseyBattleSessions?: Map<string, ActiveBattleSession>;
};

// Les routes Next.js de création et d'action peuvent charger ce module dans
// deux bundles différents. Le stockage doit donc vivre au niveau du processus,
// et non dans la portée locale d'un bundle. Cela évite aussi de perdre un
// combat lors d'un rechargement à chaud en développement.
const battleSessionGlobal = globalThis as BattleSessionGlobal;
const activeSessions =
  battleSessionGlobal.__heigOdysseyBattleSessions ??
  new Map<string, ActiveBattleSession>();

battleSessionGlobal.__heigOdysseyBattleSessions = activeSessions;

// Une session inactive expire après trente minutes.
const SESSION_TTL_MS = 30 * 60 * 1000;

// Une borne globale protège le processus d'une accumulation de moteurs lourds,
// même si de nombreux comptes démarrent simultanément des combats.
const MAX_ACTIVE_SESSIONS = 500;

// Au-delà de ce délai sans action de combat, une session ne verrouille plus
// l'édition des attaques / de l'équipe / des évolutions : le joueur a quitté
// l'arène (fermeture d'onglet, navigation) sans que le combat se conclue.
const BATTLE_LOCK_ACTIVITY_MS = 3 * 60 * 1000;

function cleanupOldSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.lastAccessed > SESSION_TTL_MS) {
      activeSessions.delete(id);
    }
  }
}

function removeExistingSessionForUser(userId: string): void {
  for (const [battleId, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(battleId);
    }
  }
}

function evictOldestSessionAtCapacity(): void {
  if (activeSessions.size < MAX_ACTIVE_SESSIONS) return;

  let oldest: [string, ActiveBattleSession] | undefined;
  for (const entry of activeSessions.entries()) {
    if (!oldest || entry[1].lastAccessed < oldest[1].lastAccessed) {
      oldest = entry;
    }
  }

  if (oldest) {
    activeSessions.delete(oldest[0]);
  }
}

/**
 * Un combat n'immobilise un Pokémon que s'il est réellement en cours : session
 * présente ET action récente. Une session laissée en plan (onglet fermé) cesse
 * de bloquer après `BATTLE_LOCK_ACTIVITY_MS`, en complément de l'abandon
 * explicite envoyé par le client quand il quitte l'arène.
 */
export function isPokemonInActiveBattle(
  userId: string,
  pokemonId: string,
): boolean {
  cleanupOldSessions();
  const now = Date.now();
  return [...activeSessions.values()].some(
    (session) =>
      session.userId === userId &&
      session.playerPokemonIds.includes(pokemonId) &&
      now - session.lastAccessed <= BATTLE_LOCK_ACTIVITY_MS,
  );
}

/**
 * Libère une session de combat que le joueur quitte volontairement (bouton
 * « Quitter », fermeture d'onglet, navigation). Idempotent et silencieux si la
 * session est absente ou appartient à un autre compte.
 */
export function abandonBattleSession(
  battleId: string,
  userId: string,
): boolean {
  const session = activeSessions.get(battleId);
  if (!session || session.userId !== userId) {
    return false;
  }
  activeSessions.delete(battleId);
  return true;
}

function getLiveBattleSession(
  battleId: string,
): ActiveBattleSession | undefined {
  const session = activeSessions.get(battleId);

  if (!session) {
    return undefined;
  }

  // L'expiration est vérifiée à chaque accès, même sans nouveau combat.
  if (Date.now() - session.lastAccessed > SESSION_TTL_MS) {
    activeSessions.delete(battleId);
    return undefined;
  }

  return session;
}

export function registerBattleSession(
  engine: BattleEngine,
  userId: string,
  playerPokemonIds: readonly string[],
  stageId?: string,
  aiProfile: AIProfile = "random",
  options?: {
    battleType?: "CAMPAIGN" | "TRAINING";
    difficulty?: TrainingDifficulty;
  },
): void {
  cleanupOldSessions();
  // Un joueur ne peut conserver qu'un seul moteur actif. Démarrer un nouveau
  // combat remplace le précédent et empêche un épuisement mémoire authentifié.
  removeExistingSessionForUser(userId);
  evictOldestSessionAtCapacity();
  const battleType = options?.battleType ?? (stageId ? "CAMPAIGN" : "TRAINING");
  activeSessions.set(engine.battleId, {
    engine,
    userId,
    playerPokemonIds: snapshotBattleParticipants(playerPokemonIds),
    battleType,
    stageId,
    difficulty: options?.difficulty,
    aiProfile,
    lastAccessed: Date.now(),
  });
}

export function getBattleSession(
  battleId: string,
): ActiveBattleSession | undefined {
  const session = getLiveBattleSession(battleId);
  if (session) {
    session.lastAccessed = Date.now();
  }
  return session;
}

function getOwnedBattleSession(
  battleId: string,
  authenticatedUserId: string,
): ActiveBattleSession {
  const session = getLiveBattleSession(battleId);

  // Absence, expiration et mauvais propriétaire produisent la même réponse.
  if (!session || session.userId !== authenticatedUserId) {
    throw new BattleSessionUnavailableError();
  }

  session.lastAccessed = Date.now();
  return session;
}

/** Soumet une décision de l'IA uniquement lorsqu'elle en attend réellement une. */
function submitPendingAiAction(
  engine: BattleEngine,
  aiProfile: AIProfile,
): void {
  const rawBattle = engine.getRawBattle();

  if (
    rawBattle.ended ||
    rawBattle.p2.requestState === "" ||
    rawBattle.p2.isChoiceDone()
  ) {
    return;
  }

  const aiAction = selectAIAction(aiProfile, engine, "p2");
  if (!engine.submitAction("p2", aiAction)) {
    // Cette situation révèle un désaccord interne entre l'IA et le moteur.
    // L'état courant permet au navigateur de se resynchroniser sans rejouer
    // aveuglément une action devenue obsolète.
    throw new BattleActionRejectedError(engine.getState());
  }
}

export async function processBattleTurn(
  battleId: string,
  authenticatedUserId: string,
  playerAction: BattleAction,
  expectedState?: ExpectedBattleState,
): Promise<{
  turnResult: TurnExecutionResult;
  rewards?: BattleRewardResult;
}> {
  const session = getOwnedBattleSession(battleId, authenticatedUserId);

  const {
    engine,
    aiProfile,
    userId,
    stageId,
    playerPokemonIds,
    battleType,
    difficulty,
  } = session;

  const currentState = engine.getState();
  if (
    expectedState &&
    (currentState.turn !== expectedState.turn ||
      currentState.phase !== expectedState.phase)
  ) {
    throw new BattleActionRejectedError(currentState);
  }
  // Le moteur reçoit l'action du joueur après le contrôle de propriété.
  const p1Valid = engine.submitAction("p1", playerAction);
  if (!p1Valid) {
    throw new BattleActionRejectedError(engine.getState());
  }

  // L'intelligence artificielle choisit ensuite sa réponse si le simulateur
  // attend encore une décision de sa part.
  submitPendingAiAction(engine, aiProfile);

  // Les deux actions sont enfin résolues dans le même tour.
  let turnResult = engine.executeTurn();

  // Après un K.O. adverse, le remplacement appartient à l'IA et ne doit pas
  // être présenté au joueur comme un changement obligatoire de son équipe.
  // Ses évènements complètent la timeline du tour : les écraser ferait
  // disparaître l'animation de mise K.O. adverse côté client.
  let switchGuard = 0;
  while (
    switchGuard++ < 6 &&
    !engine.getRawBattle().ended &&
    engine.getRawBattle().p2.requestState === "switch"
  ) {
    submitPendingAiAction(engine, aiProfile);
    const followUp = engine.executeTurn();
    turnResult = {
      turn: followUp.turn,
      events: [...turnResult.events, ...followUp.events],
      state: followUp.state,
    };
  }

  let rewards: BattleRewardResult | undefined;

  // La session est libérée après le traitement des gains, jamais avant leur écriture.
  if (turnResult.state.phase === "finished") {
    const winner = turnResult.state.winner || "p2";

    if (battleType === "TRAINING" || (!stageId && difficulty)) {
      rewards = await grantTrainingRewards({
        userId,
        battleId,
        difficulty: difficulty || "easy",
        winner,
        playerPokemonIds,
        turnsCount: turnResult.turn,
        opponentTeam: turnResult.state.p2.team,
      });
    } else if (stageId) {
      rewards = await grantBattleRewards({
        userId,
        battleId,
        stageId,
        winner,
        turnsCount: turnResult.turn,
        playerPokemonIds,
      });
    }

    activeSessions.delete(battleId);
  }

  return {
    turnResult,
    rewards,
  };
}
