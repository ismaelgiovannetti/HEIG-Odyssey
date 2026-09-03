// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestPanel } from "@/components/quests/quest-panel";
import {
  PLAYER_BALANCE_EVENT,
  type PlayerBalanceEventDetail,
} from "@/lib/player/player-balance-events";
import { publishQuestProgressInvalidated } from "@/lib/quests/quest-progress-events";

function questState(currentCount = 0) {
  const isCompleted = currentCount >= 1;
  const dailyQuest = {
    rotationId: "daily-rotation",
    questId: "daily-win",
    title: "Première victoire",
    description: "Remportez un combat.",
    type: "DAILY" as const,
    targetType: "WIN_BATTLES_ANY",
    targetCount: 1,
    currentCount,
    isCompleted,
    rewardClaimed: false,
    claimedAt: null,
    rewardPokedollars: 50,
    rewardXp: 100,
    startDate: "2099-09-03T00:00:00.000Z",
    endDate: "2099-09-04T00:00:00.000Z",
  };

  return {
    dailyPeriodKey: "2099-09-03",
    weeklyPeriodKey: "2099-W36",
    dailyQuests: [dailyQuest],
    weeklyQuests: [],
    allQuests: [dailyQuest],
  };
}

function response(currentCount: number, syncPending: boolean) {
  return new Response(
    JSON.stringify({
      success: true,
      data: questState(currentCount),
      syncPending,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("QuestPanel live progress", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("recharge les quêtes à chaque ouverture, même si le cache est récent", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(() => Promise.resolve(response(0, false)));

    render(<QuestPanel />);
    const trigger = await screen.findByRole("button", {
      name: "Missions : 0/1 terminées",
    });
    const menu = trigger.parentElement;
    expect(menu).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.mouseEnter(menu!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("region", {
        name: "Missions quotidiennes et hebdomadaires",
      }),
    ).toBeDefined();

    fireEvent.mouseLeave(menu!);
    await waitFor(() =>
      expect(
        screen.queryByRole("region", {
          name: "Missions quotidiennes et hebdomadaires",
        }),
      ).toBeNull(),
    );

    fireEvent.mouseEnter(menu!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("garde le panneau ouvert lorsque la récompense réclamée retire le bouton", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const balanceEvents: number[] = [];
    const handleBalance = (event: Event) => {
      balanceEvents.push(
        (event as CustomEvent<PlayerBalanceEventDetail>).detail.balance,
      );
    };
    window.addEventListener(PLAYER_BALANCE_EVENT, handleBalance, {
      once: true,
    });
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === "/api/quests/claim" && init?.method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: {
                  success: true,
                  rotationId: "daily-rotation",
                  rewardPokedollars: 50,
                  rewardXp: 100,
                  newBalance: 1_275,
                },
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }
        return Promise.resolve(response(1, false));
      },
    );

    render(<QuestPanel />);
    const trigger = await screen.findByRole("button", {
      name: "Missions : 1/1 terminées",
    });
    const menu = trigger.parentElement;
    expect(menu).not.toBeNull();

    fireEvent.mouseEnter(menu!);
    const claimButton = await screen.findByRole("button", {
      name: "Récupérer",
    });
    act(() => claimButton.focus());
    fireEvent.blur(claimButton, { relatedTarget: null });
    expect(
      screen.getByRole("region", {
        name: "Missions quotidiennes et hebdomadaires",
      }),
    ).toBeDefined();

    fireEvent.click(claimButton);
    await screen.findByText(
      "Récompense récupérée. Votre solde a été mis à jour.",
    );
    expect(
      screen.getByRole("region", {
        name: "Missions quotidiennes et hebdomadaires",
      }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Récupérer" })).toBeNull();
    expect(balanceEvents).toEqual([1_275]);
  });

  it("réessaie jusqu'au reçu du worker puis actualise le compteur fermé", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(response(0, false))
      .mockResolvedValueOnce(response(0, true))
      .mockResolvedValueOnce(response(1, false));

    render(<QuestPanel />);
    await screen.findByRole("button", { name: "Missions : 0/1 terminées" });
    vi.useFakeTimers();

    await act(async () => {
      publishQuestProgressInvalidated("battle-training-42");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/quests?afterBattleId=battle-training-42",
      expect.objectContaining({ cache: "no-store" }),
    );

    await act(async () => vi.advanceTimersByTimeAsync(249));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      screen.getByRole("button", {
        name: "Missions : 1/1 terminées",
      }),
    ).toBeDefined();
    expect(
      screen.getByText("Progression des missions actualisée."),
    ).toBeDefined();

    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("borne le polling lorsque le worker reste indisponible", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(response(0, false))
      .mockImplementation(() => Promise.resolve(response(0, true)));

    render(<QuestPanel />);
    await screen.findByRole("button", { name: "Missions : 0/1 terminées" });
    vi.useFakeTimers();

    await act(async () => {
      publishQuestProgressInvalidated("battle-training-42");
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => vi.runAllTimersAsync());

    // Un chargement initial, puis huit tentatives corrélées au combat.
    expect(fetchMock).toHaveBeenCalledTimes(9);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchMock).toHaveBeenCalledTimes(9);

    // L'identifiant reste mémorisé : une ouverture ultérieure reprend la
    // synchronisation et récupère la progression après le retour du worker.
    fetchMock.mockImplementation(() => Promise.resolve(response(1, false)));
    const trigger = screen.getByRole("button", {
      name: "Missions : 0/1 terminées",
    });
    fireEvent.mouseEnter(trigger.parentElement!);
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(
      screen.getByRole("button", {
        name: "Missions : 1/1 terminées",
      }),
    ).toBeDefined();
  });

  it("annule les nouvelles tentatives au démontage", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(response(0, false))
      .mockImplementation(() => Promise.resolve(response(0, true)));

    const view = render(<QuestPanel />);
    await screen.findByRole("button", { name: "Missions : 0/1 terminées" });
    vi.useFakeTimers();

    await act(async () => {
      publishQuestProgressInvalidated("battle-training-42");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    view.unmount();
    await act(async () => vi.runAllTimersAsync());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
