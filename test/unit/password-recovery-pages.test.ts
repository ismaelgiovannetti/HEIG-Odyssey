import { describe, expect, it } from "vitest";

import { metadata as forgotPasswordMetadata } from "@/app/(auth)/forgot-password/page";
import { metadata as resetPasswordMetadata } from "@/app/(account-recovery)/reset-password/page";

describe("métadonnées des pages de récupération", () => {
  // Les pages liées à un compte ne doivent pas apparaître dans les moteurs de
  // recherche, même si elles restent accessibles sans session.
  it("interdit l'indexation du parcours de récupération", () => {
    expect(forgotPasswordMetadata.robots).toEqual({ index: false, follow: false });
    expect(resetPasswordMetadata.robots).toEqual({ index: false, follow: false });
  });

  // Le navigateur ne transmet pas l'URL contenant le jeton lorsqu'une ressource
  // externe ou une navigation est déclenchée depuis le formulaire.
  it("ne transmet pas le jeton de réinitialisation dans le Referer", () => {
    expect(resetPasswordMetadata.referrer).toBe("no-referrer");
  });
});
