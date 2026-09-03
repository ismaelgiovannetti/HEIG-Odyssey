import { describe, expect, it } from "vitest";
import { readTeamResponse } from "@/lib/team/team-client";
import { teamSnapshot } from "../helpers/team-interface-fixture";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("réponses de la collection côté navigateur", () => {
  it("accepte les positions serveur et les capacités à zéro PP", async () => {
    const data = await readTeamResponse(response(teamSnapshot()));
    expect(data.revision).toBe(7);
    expect(data.pokemon[0].moves[0].pp).toBe(0);
  });

  it("accepte la dernière case des vingt boîtes de trente-cinq places", async () => {
    const snapshot = teamSnapshot();
    Object.assign(snapshot.pokemon[2], { boxNumber: 20, boxSlot: 35 });
    const data = await readTeamResponse(response(snapshot));
    expect(data.pc.rows).toBe(5);
    expect(data.pc.columns).toBe(7);
    expect(data.pc.boxes).toHaveLength(20);
    expect(data.pokemon[2]).toMatchObject({ boxNumber: 20, boxSlot: 35 });
  });

  it.each([
    { boxNumber: 21, boxSlot: 1 },
    { boxNumber: 1, boxSlot: 36 },
  ])("refuse une position hors du nouveau PC (%#)", async (position) => {
    const snapshot = teamSnapshot();
    Object.assign(snapshot.pokemon[2], position);
    await expect(readTeamResponse(response(snapshot))).rejects.toThrow(
      "incomplète",
    );
  });

  it("refuse les doublons de Pokémon et de cases avant de créer le brouillon", async () => {
    const duplicateId = teamSnapshot();
    duplicateId.pokemon[1].id = duplicateId.pokemon[0].id;
    await expect(readTeamResponse(response(duplicateId))).rejects.toThrow(
      "incomplète",
    );
    const duplicateCell = teamSnapshot();
    duplicateCell.pokemon[3].boxSlot = duplicateCell.pokemon[2].boxSlot;
    await expect(readTeamResponse(response(duplicateCell))).rejects.toThrow(
      "incomplète",
    );
  });

  it("refuse une réponse tronquée ou des dimensions inattendues", async () => {
    const data = teamSnapshot();
    await expect(
      readTeamResponse(response({ ...data, count: 500 })),
    ).rejects.toThrow("incomplète");
    await expect(
      readTeamResponse(response({ ...data, pc: { ...data.pc, columns: 6 } })),
    ).rejects.toThrow("incomplète");
    // Une réponse de l'ancien format ne doit pas masquer les cinq dernières lignes.
    await expect(
      readTeamResponse(response({ ...data, pc: { ...data.pc, rows: 10 } })),
    ).rejects.toThrow("incomplète");
  });

  it("demande une reconnexion après une session expirée", async () => {
    await expect(readTeamResponse(response({}, 401))).rejects.toMatchObject({
      needsReload: true,
      needsLogin: true,
    });
  });

  it("demande un rechargement quand la révision est périmée", async () => {
    await expect(
      readTeamResponse(response({ code: "COLLECTION_CHANGED" }, 409)),
    ).rejects.toMatchObject({ needsReload: true, needsLogin: false });
  });

  it("explique un refus fonctionnel sans exposer une erreur technique", async () => {
    await expect(
      readTeamResponse(
        response({ details: ["Gardez au moins un Pokémon."] }, 400),
      ),
    ).rejects.toThrow("Gardez au moins un Pokémon.");
    await expect(
      readTeamResponse(
        response({ error: "prisma secret internal stack" }, 500),
      ),
    ).rejects.toThrow("Impossible de confirmer l'état");
  });

  it("ne propose pas une nouvelle écriture après une réponse illisible", async () => {
    await expect(
      readTeamResponse(new Response("<html>Erreur</html>", { status: 200 })),
    ).rejects.toMatchObject({ needsReload: true });
  });
});
