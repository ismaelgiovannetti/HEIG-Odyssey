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
import type { TrainingDifficulty } from "./training-generator";

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

function cleanupOldSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.lastAccessed > SESSION_TTL_MS) {
      activeSessions.delete(id);
    }
  }
}

/** Vérifie les sessions vivantes sans prolonger leur durée de validité. */
export function isPokemonInActiveBattle(
  userId: string,
  pokemonId: string,
): boolean {
  cleanupOldSessions();
  return [...activeSessions.values()].some(
    (session) =>
      session.userId === userId &&
      session.playerPokemonIds.includes(pokemonId),
  );
}

function getLiveBattleSession(battleId: string): ActiveBattleSession | undefined {
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
  }
): void {
  cleanupOldSessions();
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

export function getBattleSession(battleId: string): ActiveBattleSession | undefined {
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
  if (
    !engine.getRawBattle().ended &&
    engine.getRawBattle().p2.requestState === "switch"
  ) {
    submitPendingAiAction(engine, aiProfile);
    turnResult = engine.executeTurn();
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
      });
    } else if (stageId) {
      rewards = await grantBattleRewards({
        userId,
        battleId,
        stageId,
        winner,
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

