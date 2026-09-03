export const PLAYER_BALANCE_EVENT = "heig-odyssey:player-balance";

interface PlayerBalanceEventDetail {
  balance: number;
}

/** Notifie le shell après que le serveur a persisté un nouveau solde. */
export function publishPlayerBalance(balance: number): void {
  if (
    typeof window === "undefined" ||
    !Number.isSafeInteger(balance) ||
    balance < 0
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<PlayerBalanceEventDetail>(PLAYER_BALANCE_EVENT, {
      detail: { balance },
    }),
  );
}

export type { PlayerBalanceEventDetail };
