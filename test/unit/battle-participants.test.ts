import { describe, expect, it } from "vitest";
import { snapshotBattleParticipants } from "@/lib/combat/battle-participants";

describe("participants figés du combat", () => {
  it("conserve une copie immuable de l'équipe de départ", () => {
    const ids = ["p1", "p2"];
    const snapshot = snapshotBattleParticipants(ids);
    ids[0] = "replacement";
    expect(snapshot).toEqual(["p1", "p2"]);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it.each([[], ["p1", "p1"], [" "], ["1", "2", "3", "4", "5", "6", "7"]].map((ids) => ({ ids })))(
    "refuse une liste invalide (%#)", ({ ids }) => {
      expect(() => snapshotBattleParticipants(ids)).toThrow("BATTLE_PARTICIPANTS_INVALID");
    },
  );
});
