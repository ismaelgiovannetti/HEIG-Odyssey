// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BattleArena } from "@/components/battle/battle-arena";
import { TrainingHub } from "@/components/training/training-hub";
import type {
  BattleActionPayload,
  BattlePokemonPayload,
  BattleStartPayload,
} from "@/lib/combat/battle-client";
import { teamSnapshot } from "../helpers/team-interface-fixture";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

// Les tests portent sur le parcours et les requêtes, pas sur next/image.
vi.mock("@/components/SpriteProvider", () => ({
  SpriteProvider: ({ speciesId, alt }: { speciesId?: string; alt: string }) => (
    <span role={alt ? "img" : undefined} aria-label={alt || undefined}>
      {speciesId}
    </span>
  ),
}));

function pokemon(
  side: "p1" | "p2",
  overrides: Partial<BattlePokemonPayload> = {},
): BattlePokemonPayload {
  return {
    id: `${side}-bulbasaur`,
    speciesId: "bulbasaur",
    name: "Bulbizarre",
    level: 12,
    types: ["Grass", "Poison"],
    currentHp: 35,
    maxHp: 35,
    hpPercent: 100,
    status: null,
    moves: [
      {
        id: "tackle",
        name: "Charge",
        type: "Normal",
        category: "physical",
        power: 40,
        accuracy: 100,
        pp: 35,
        maxPp: 35,
      },
    ],
    isShiny: false,
    isActive: true,
    isFainted: false,
    baseStats: {
      hp: 45,
      attack: 49,
      defense: 49,
      specialAttack: 65,
      specialDefense: 65,
      speed: 45,
    },
    ...overrides,
  };
}

function startedBattle(): BattleStartPayload {
  return {
    success: true,
    battleId: "battle-training-42",
    trainer: {
      id: "training-hard",
      name: "IA d'Entraînement",
      title: "Niveau Difficile (Expectiminimax)",
      introCatchline: "Début de la simulation.",
      victoryCatchline: "Votre stratégie a triomphé.",
      defeatCatchline: "Vous pouvez encore progresser.",
      musicTrack: "battle-theme-1",
    },
    state: {
      battleId: "battle-training-42",
      turn: 0,
      phase: "action_selection",
      winner: null,
      logs: ["Début de la simulation."],
      p1: {
        sideId: "p1",
        name: "Joueur",
        activePokemonIndex: 0,
        team: [
          pokemon("p1"),
          pokemon("p1", {
            id: "p1-charmander",
            speciesId: "charmander",
            name: "Salamèche",
            types: ["Fire"],
            isActive: false,
          }),
        ],
      },
      p2: {
        sideId: "p2",
        name: "IA d'Entraînement",
        activePokemonIndex: 0,
        team: [pokemon("p2", { id: "p2-squirtle", speciesId: "squirtle", name: "Carapuce", types: ["Water"] })],
      },
    },
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("interface d'entraînement et de combat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("charge l'équipe puis transmet uniquement la difficulté choisie au serveur", async () => {
    const user = userEvent.setup();
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(response(teamSnapshot()))
      .mockResolvedValueOnce(response(startedBattle()));

    render(<TrainingHub />);

    expect(
      await screen.findByRole("heading", { name: "Votre équipe en lice" }),
    ).toBeDefined();
    const hard = screen.getByRole("radio", { name: /Difficile/i });
    await user.click(hard);
    await user.click(
      screen.getByRole("button", { name: /Générer l’adversaire/i }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/battle/start",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ mode: "training", difficulty: "hard" }),
        }),
      );
    });
    expect(
      await screen.findByText(/Que doit faire Bulbizarre/i),
    ).toBeDefined();
    expect(screen.queryByText("Simulation prête")).toBeNull();
    expect(screen.getByRole("region", { name: /Réplique de IA d'Entraînement/i })).toBeDefined();
    const audio = document.querySelector("audio");
    expect(audio?.src).toContain("battle-theme-1.mp3");
    expect(audio?.loop).toBe(true);
  });

  it("affiche une erreur compréhensible et permet de relancer le chargement", async () => {
    const user = userEvent.setup();
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(response({ success: false }, 500))
      .mockResolvedValueOnce(response(teamSnapshot()));

    render(<TrainingHub />);

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Impossible de confirmer l'état de la collection/i,
    );
    await user.click(screen.getByRole("button", { name: /Réessayer/i }));
    expect(
      await screen.findByRole("heading", { name: "Votre équipe en lice" }),
    ).toBeDefined();
  });

  it("envoie une attaque puis affiche exclusivement les gains confirmés", async () => {
    const user = userEvent.setup();
    const onReturn = vi.fn();
    const initial = startedBattle();
    const finished: BattleActionPayload = {
      success: true,
      turn: 3,
      events: [
        { type: "battle_end", turn: 3, message: "Joueur remporte la victoire !" },
      ],
      state: {
        ...initial.state,
        turn: 3,
        phase: "finished",
        winner: "p1",
      },
      rewards: {
        isAlreadyClaimed: false,
        moneyEarned: 130,
        xpEarned: 320,
        newBalance: 780,
        stageCompleted: false,
        unlockedNextStageId: null,
        teamLeveledUp: [
          {
            pokemonId: "alpha",
            speciesId: "bulbasaur",
            name: "Bulbizarre",
            oldLevel: 12,
            newLevel: 13,
            newCurrentHp: 38,
            newMaxHp: 38,
          },
        ],
      },
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      response(finished),
    );

    render(
      <BattleArena
        initialBattle={initial}
        mode="training"
        onReturn={onReturn}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Charge/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/battle/action",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            battleId: "battle-training-42",
            expectedTurn: 0,
            expectedPhase: "action_selection",
            action: { type: "move", moveIndex: 0 },
          }),
        }),
      );
    });
    expect(
      await screen.findByRole("heading", { name: "Victoire confirmée !" }),
    ).toBeDefined();
    expect(screen.getByText("+130 ₽")).toBeDefined();
    expect(screen.getByText("+320 XP")).toBeDefined();
    expect(screen.getByText("780 ₽")).toBeDefined();
    expect(screen.getByText(/Bulbizarre : niv. 12 → 13/i)).toBeDefined();
    expect(screen.getByText(/Votre stratégie a triomphé/i)).toBeDefined();
    // La bascule de piste est pilotée par un effet du SoundtrackPlayer qui
    // réagit au passage en phase "victory" : on l'attend explicitement.
    await waitFor(() => {
      const audio = document.querySelector("audio");
      expect(audio?.src).toContain("victory-theme.mp3");
      expect(audio?.loop).toBe(false);
    });
    expect(
      screen.queryByText(/Valeurs confirmées par le serveur/i),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /Retour à l’entraînement/i }),
    );
    expect(onReturn).toHaveBeenCalledOnce();
  });

  it("permet de sélectionner un remplacement sans transmettre d'identité", async () => {
    const user = userEvent.setup();
    const initial = startedBattle();
    const switched = {
      success: true,
      turn: 1,
      events: [{ type: "switch", turn: 1, message: "Salamèche entre au combat !" }],
      state: {
        ...initial.state,
        turn: 1,
        p1: {
          ...initial.state.p1,
          activePokemonIndex: 1,
          team: [
            { ...initial.state.p1.team[0], isActive: false },
            { ...initial.state.p1.team[1], isActive: true },
          ],
        },
      },
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      response(switched),
    );

    render(
      <BattleArena initialBattle={initial} mode="campaign" onReturn={vi.fn()} />,
    );
    await user.click(
      screen.getByRole("button", { name: /Changer de Pokémon/i }),
    );
    await user.click(screen.getByRole("button", { name: /Salamèche/i }));

    await waitFor(() => {
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body).toEqual({
        battleId: "battle-training-42",
        expectedTurn: 0,
        expectedPhase: "action_selection",
        action: { type: "switch", targetPokemonIndex: 1 },
      });
      expect(body).not.toHaveProperty("userId");
    });
    expect(await screen.findByText(/Salamèche entre au combat/i)).toBeDefined();
  });

  it("resynchronise l'interface lorsqu'une action rapide devient obsolète", async () => {
    const user = userEvent.setup();
    const initial = startedBattle();
    const currentState = {
      ...initial.state,
      turn: 1,
      phase: "switch_required" as const,
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      response(
        {
          success: false,
          error: "Le combat a déjà avancé. L'état affiché a été actualisé.",
          state: currentState,
        },
        409,
      ),
    );

    render(
      <BattleArena initialBattle={initial} mode="training" onReturn={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: /Charge/i }));

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /combat a déjà avancé/i,
    );
    expect(
      screen.getByRole("button", { name: /Salamèche/i }),
    ).toBeDefined();
  });
});
