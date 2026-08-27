import { BattleEngine } from "./battle-engine";
import { selectAIAction } from "./ai";
import type { BattleAction, BattleState, TurnExecutionResult, AIProfile } from "./types";
import { grantBattleRewards, type BattleRewardResult } from "../rewards/reward-service";
import { getTrainer } from "../content/loader";

interface ActiveBattleSession {
  engine: BattleEngine;
  userId: string;
  stageId?: string;
  aiProfile: AIProfile;
  lastAccessed: number;
}

// In-memory battle sessions store (per server instance / process)
const activeSessions = new Map<string, ActiveBattleSession>();

// Cleanup stale sessions after 30 minutes
const SESSION_TTL_MS = 30 * 60 * 1000;

function cleanupOldSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.lastAccessed > SESSION_TTL_MS) {
      activeSessions.delete(id);
    }
  }
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
  const session = activeSessions.get(battleId);
  if (session) {
    session.lastAccessed = Date.now();
  }
  return session;
}

export async function processBattleTurn(
  battleId: string,
  playerAction: BattleAction
): Promise<{
  turnResult: TurnExecutionResult;
  rewards?: BattleRewardResult;
}> {
  const session = getBattleSession(battleId);
  if (!session) {
    throw new Error(`Session de combat introuvable ou expirée (${battleId}).`);
  }

  const { engine, aiProfile, userId, stageId } = session;

  // 1. Submit Player action
  const p1Valid = engine.submitAction("p1", playerAction);
  if (!p1Valid) {
    throw new Error("Action du joueur invalide.");
  }

  // 2. Select and submit AI action
  if (!engine.getRawBattle().ended) {
    const aiAction = selectAIAction(aiProfile, engine, "p2");
    engine.submitAction("p2", aiAction);
  }

  // 3. Execute turn resolution
  const turnResult = engine.executeTurn();

  let rewards: BattleRewardResult | undefined;

  // 4. If battle ended and player won in a campaign stage, grant rewards
  if (turnResult.state.phase === "finished" && stageId) {
    const winner = turnResult.state.winner || "p2";
    rewards = await grantBattleRewards({
      userId,
      battleId,
      stageId,
      winner,
    });
    // Clean up session
    activeSessions.delete(battleId);
  }

  return {
    turnResult,
    rewards,
  };
}
