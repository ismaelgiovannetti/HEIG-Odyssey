import { describe, it, expect, vi, beforeEach } from "vitest";
import { playBattleSfx, type BattleSfxType } from "@/lib/audio/battle-sfx";

describe("battle-sfx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("plays various battle sound effects without throwing", () => {
    const sfxTypes: BattleSfxType[] = [
      "hit",
      "super_effective",
      "resisted",
      "critical",
      "status_par",
      "status_slp",
      "status_psn",
      "status_brn",
      "status_frz",
      "faint",
      "switch",
      "miss",
    ];

    for (const type of sfxTypes) {
      expect(() => playBattleSfx(type)).not.toThrow();
    }
  });
});
