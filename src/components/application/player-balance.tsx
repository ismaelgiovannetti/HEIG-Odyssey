"use client";

import { useEffect, useState } from "react";
import {
  PLAYER_BALANCE_EVENT,
  type PlayerBalanceEventDetail,
} from "@/lib/player/player-balance-events";
import { formatGameInteger } from "@/lib/format-number";

interface PlayerBalanceProps {
  initialBalance: number;
}

/**
 * Affiche le solde chargé par le serveur puis écoute les gains persistés sans
 * attendre un rechargement complet de la page.
 */
export function PlayerBalance({
  initialBalance,
}: Readonly<PlayerBalanceProps>) {
  const [balance, setBalance] = useState(initialBalance);

  useEffect(() => {
    setBalance(initialBalance);
  }, [initialBalance]);

  useEffect(() => {
    function updateBalance(event: Event) {
      const detail = (event as CustomEvent<PlayerBalanceEventDetail>).detail;
      if (
        detail &&
        Number.isSafeInteger(detail.balance) &&
        detail.balance >= 0
      ) {
        setBalance(detail.balance);
      }
    }

    window.addEventListener(PLAYER_BALANCE_EVENT, updateBalance);
    return () => window.removeEventListener(PLAYER_BALANCE_EVENT, updateBalance);
  }, []);

  // Format déterministe : le premier rendu client doit être identique au SSR.
  const formattedBalance = formatGameInteger(balance);

  return (
    <span
      className="application-player__balance"
      title="Solde de Pokédollars"
      aria-label={`${formattedBalance} Pokédollars`}
      aria-live="polite"
    >
      <strong>{formattedBalance}</strong>
      <span aria-hidden="true">₽</span>
    </span>
  );
}
