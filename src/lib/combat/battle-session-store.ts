import { BattleEngine } from "./battle-engine";
import { selectAIAction } from "./ai";
import type { BattleAction, TurnExecutionResult, AIProfile } from "./types";
import { grantBattleRewards, type BattleRewardResult } from "../rewards/reward-service";

interface ActiveBattleSession {
  engine: BattleEngine;
  userId: string;
  stageId?: string;
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
  constructor() {
    super("Action du joueur invalide.");
    this.name = "BattleActionRejectedError";
  }
}

// Les combats actifs restent en mémoire dans l'unique instance du serveur.
const activeSessions = new Map<string, ActiveBattleSession>();

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
  stageId?: string,
  aiProfile: AIProfile = "random"
): void {
  cleanupOldSessions();
  activeSessions.set(engine.battleId, {
    engine,
    userId,
    stageId,
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

export async function processBattleTurn(
  battleId: string,
  authenticatedUserId: string,
  playerAction: BattleAction,
): Promise<{
  turnResult: TurnExecutionResult;
  rewards?: BattleRewardResult;
}> {
  const session = getOwnedBattleSession(battleId, authenticatedUserId);

  const { engine, aiProfile, userId, stageId } = session;

  // Le moteur reçoit l'action du joueur après le contrôle de propriété.
  const p1Valid = engine.submitAction("p1", playerAction);
  if (!p1Valid) {
    throw new BattleActionRejectedError();
  }

  // L'intelligence artificielle choisit ensuite sa réponse.
  if (!engine.getRawBattle().ended) {
    const aiAction = selectAIAction(aiProfile, engine, "p2");
    engine.submitAction("p2", aiAction);
  }

  // Les deux actions sont enfin résolues dans le même tour.
  const turnResult = engine.executeTurn();

  let rewards: BattleRewardResult | undefined;

  // Une fin de combat libère toujours la session. Les récompenses ne sont
  // calculées que pour une étape de campagne et restent idempotentes.
  if (turnResult.state.phase === "finished") {
    if (stageId) {
      const winner = turnResult.state.winner || "p2";
      rewards = await grantBattleRewards({
        userId,
        battleId,
        stageId,
        winner,
      });
    }

    activeSessions.delete(battleId);
  }

  return {
    turnResult,
    rewards,
  };
}
