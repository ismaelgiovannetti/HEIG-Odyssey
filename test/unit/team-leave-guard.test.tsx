// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTeamLeaveGuard } from "@/components/team/use-team-leave-guard";

function GuardHarness({
  active,
  saving,
}: {
  active: boolean;
  saving: boolean;
}) {
  useTeamLeaveGuard({ active, saving });
  return (
    <a href="/dashboard" onClick={(event) => event.preventDefault()}>
      Quitter
    </a>
  );
}

describe("protection de navigation de l'équipe", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("bloque une navigation et un déchargement tant qu'un changement reste non confirmé", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { rerender } = render(<GuardHarness active saving={false} />);
    const link = screen.getByRole("link", { name: "Quitter" });
    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("modifications non enregistrées"),
    );

    const guardedUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(guardedUnload);
    expect(guardedUnload.defaultPrevented).toBe(true);

    rerender(<GuardHarness active={false} saving={false} />);
    const freeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(freeUnload);
    expect(freeUnload.defaultPrevented).toBe(false);
  });

  it("annonce explicitement une sauvegarde en cours", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<GuardHarness active saving />);
    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    screen.getByRole("link", { name: "Quitter" }).dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("modification de la collection est en cours"),
    );
  });

  it("laisse les raccourcis navigateur et les téléchargements tranquilles", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<GuardHarness active saving={false} />);
    const link = screen.getByRole("link", { name: "Quitter" });

    const modifiedClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    link.dispatchEvent(modifiedClick);

    link.setAttribute("download", "");
    const downloadClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(downloadClick);
    expect(confirm).not.toHaveBeenCalled();
  });
});
