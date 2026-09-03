/** Copie la liste serveur : un changement d'équipe ultérieur ne change pas les participants. */
export function snapshotBattleParticipants(
  ids: readonly string[],
): readonly string[] {
  if (
    ids.length < 1 ||
    ids.length > 6 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !id.trim())
  ) {
    throw new Error("BATTLE_PARTICIPANTS_INVALID");
  }
  return Object.freeze([...ids]);
}
