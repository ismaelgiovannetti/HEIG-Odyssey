"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  readTeamResponse,
  TeamRequestError,
  type CollectionSnapshot,
} from "@/lib/team/team-client";
import {
  draftFromCollection,
  draftSignature,
  saveDraft,
  type TeamDraft,
} from "@/lib/team/team-draft";

/** Chaque rangement accepté est envoyé immédiatement, sans sauvegardes concurrentes. */
export function useTeamCollection() {
  const [snapshot, setSnapshot] = useState<CollectionSnapshot | null>(null);
  const [draft, setDraft] = useState<TeamDraft>({ team: [], pc: [] });
  const [pending, setPending] = useState<"load" | "save" | "release" | null>(
    "load",
  );
  const [error, setError] = useState<TeamRequestError | null>(null);
  const [notice, setNotice] = useState("");
  const request = useRef<{ id: number; controller: AbortController } | null>(
    null,
  );
  const sequence = useRef(0);

  const exchange = useCallback(
    async (
      method: "GET" | "PUT" | "DELETE",
      body?: string,
      previousDraft?: TeamDraft,
      onSuccess?: () => void,
      successNotice?: string,
    ) => {
      // Ce verrou synchrone empêche aussi un double clic avant le rendu suivant.
      if (request.current) return false;
      const id = ++sequence.current;
      const controller = new AbortController();
      request.current = { id, controller };
      setPending(
        method === "GET" ? "load" : method === "DELETE" ? "release" : "save",
      );
      setError(null);
      setNotice("");
      const timeout = window.setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch("/api/team", {
          method,
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          ...(body
            ? { headers: { "Content-Type": "application/json" }, body }
            : {}),
        });
        const data = await readTeamResponse(response);
        if (id !== sequence.current) return false;
        // La réponse complète devient la nouvelle référence, jamais le brouillon
        // envoyé : le serveur reste l'autorité sur la collection et sa version.
        setSnapshot(data);
        setDraft(draftFromCollection(data.pokemon));
        setNotice(
          successNotice ??
            (method === "PUT"
              ? "Équipe et rangement du PC enregistrés."
              : "Collection à jour."),
        );
        // Appelé dans le même tick que les mises à jour d'état ci-dessus :
        // un aller-retour await supplémentaire côté appelant laisserait une
        // fenêtre où l'ordre de traitement React n'est pas garanti (l'appelant
        // pourrait agir avant que l'effet dépendant de dirty/pending ait tourné).
        onSuccess?.();
        return true;
      } catch (cause) {
        if (id !== sequence.current) return false;
        const failure =
          cause instanceof TeamRequestError
            ? cause
            : new TeamRequestError(
                method === "PUT"
                  ? "La connexion a été interrompue. La sauvegarde a peut-être abouti : rechargez la collection pour vérifier."
                  : method === "DELETE"
                    ? "La connexion a été interrompue. Le relâchement a peut-être abouti : rechargez la collection pour vérifier."
                    : "Impossible de charger la collection. Vérifiez votre connexion puis réessayez.",
                true,
              );
        setError(failure);
        if (method === "PUT") {
          // Un refus explicite n'a rien enregistré : on remet le rangement connu.
          // Après une coupure ou un conflit, seule une relecture peut trancher :
          // on bloque les déplacements sans rejouer automatiquement la requête.
          if (!failure.needsReload && previousDraft) {
            setDraft(previousDraft);
            setNotice(
              "Déplacement refusé. Le dernier rangement enregistré est rétabli.",
            );
          } else {
            setNotice(
              "Sauvegarde non confirmée. Rechargez la collection pour vérifier.",
            );
          }
        }
        return false;
      } finally {
        window.clearTimeout(timeout);
        if (id === sequence.current) {
          request.current = null;
          setPending(null);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void exchange("GET");
    return () => {
      // Ignore une ancienne réponse après navigation ou remontage en mode strict.
      sequence.current += 1;
      request.current?.controller.abort();
      request.current = null;
    };
  }, [exchange]);

  const dirty =
    snapshot !== null &&
    draftSignature(draft) !==
      draftSignature(draftFromCollection(snapshot.pokemon));

  function saveChange(nextDraft: TeamDraft, onSuccess?: () => void) {
    if (!snapshot || request.current || error?.needsReload)
      return Promise.resolve(false);
    const previousDraft = draftFromCollection(snapshot.pokemon);
    // Prendre un Pokémon, le reposer sur sa case ou parcourir le PC n'écrit rien.
    if (draftSignature(nextDraft) === draftSignature(previousDraft))
      return Promise.resolve(false);
    // On transmet directement le nouveau rangement, sans attendre setState :
    // la requête ne peut ainsi pas contenir le déplacement précédent.
    setDraft(nextDraft);
    return exchange(
      "PUT",
      JSON.stringify(saveDraft(nextDraft, snapshot.revision)),
      previousDraft,
      onSuccess,
    );
  }

  function releasePokemon(
    pokemonId: string,
    pokemonName: string,
    onSuccess?: () => void,
  ) {
    if (!snapshot || request.current || error?.needsReload) {
      return Promise.resolve(false);
    }
    return exchange(
      "DELETE",
      JSON.stringify({
        expectedRevision: snapshot.revision,
        pokemonId,
      }),
      undefined,
      onSuccess,
      `${pokemonName} a été relâché dans la nature.`,
    );
  }

  return {
    snapshot,
    draft,
    dirty,
    pending,
    error,
    notice,
    isBusy: () => request.current !== null,
    clearFeedback: () => {
      if (!error?.needsReload) setError(null);
      setNotice("");
    },
    reload: () => exchange("GET"),
    saveChange,
    releasePokemon,
  };
}
