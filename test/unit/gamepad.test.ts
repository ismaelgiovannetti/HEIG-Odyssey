// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GAMEPAD_EVENTS, XBOX_BUTTONS } from "@/lib/gamepad/gamepad-types";
import { startGamepadLoop } from "@/lib/gamepad/gamepad-listener";
import { navigateSpatially } from "@/lib/gamepad/spatial-navigation";

describe("gamepad module", () => {
  describe("XBOX_BUTTONS mapping", () => {
    it("définit les bons indices conformes au standard W3C Gamepad", () => {
      expect(XBOX_BUTTONS.A).toBe(0);
      expect(XBOX_BUTTONS.B).toBe(1);
      expect(XBOX_BUTTONS.X).toBe(2);
      expect(XBOX_BUTTONS.Y).toBe(3);
      expect(XBOX_BUTTONS.LB).toBe(4);
      expect(XBOX_BUTTONS.RB).toBe(5);
      expect(XBOX_BUTTONS.DPAD_UP).toBe(12);
      expect(XBOX_BUTTONS.DPAD_DOWN).toBe(13);
      expect(XBOX_BUTTONS.DPAD_LEFT).toBe(14);
      expect(XBOX_BUTTONS.DPAD_RIGHT).toBe(15);
    });
  });

  describe("gamepad listener", () => {
    let mockGamepads: (Gamepad | null)[] = [];

    beforeEach(() => {
      mockGamepads = [];
      vi.stubGlobal("navigator", {
        getGamepads: () => mockGamepads,
      });
      document.body.className = "";
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("déclenche les événements de connexion et pose la classe has-gamepad", () => {
      const stop = startGamepadLoop();

      const connectedEvent = new Event(
        "gamepadconnected",
      ) as unknown as GamepadEvent;
      Object.defineProperty(connectedEvent, "gamepad", {
        value: { id: "Xbox Wireless Controller", connected: true },
      });

      const connectedSpy = vi.fn();
      window.addEventListener(GAMEPAD_EVENTS.CONNECTED, connectedSpy);

      window.dispatchEvent(connectedEvent);
      expect(connectedSpy).toHaveBeenCalledTimes(1);
      expect(document.body.classList.contains("has-gamepad")).toBe(true);

      const disconnectedEvent = new Event(
        "gamepaddisconnected",
      ) as unknown as GamepadEvent;
      Object.defineProperty(disconnectedEvent, "gamepad", {
        value: { id: "Xbox Wireless Controller", connected: false },
      });

      window.dispatchEvent(disconnectedEvent);
      expect(document.body.classList.contains("has-gamepad")).toBe(false);

      stop();
    });

    it("déclenche des événements d'action lors de l'appui sur LB, RB, A et B", () => {
      const stop = startGamepadLoop();

      const actionSpy = vi.fn();
      window.addEventListener(GAMEPAD_EVENTS.ACTION, actionSpy);

      // Simule une manette avec LB pressé
      const buttons = Array.from({ length: 17 }, () => ({
        pressed: false,
        value: 0,
      }));
      buttons[XBOX_BUTTONS.LB] = { pressed: true, value: 1 };

      mockGamepads = [
        {
          id: "Xbox Controller",
          connected: true,
          buttons,
          axes: [0, 0],
        } as unknown as Gamepad,
      ];

      // Exécute un tour de requestAnimationFrame
      const raf = vi.fn();
      window.requestAnimationFrame = raf;

      // On déclenche manuellement la fonction pour tester le cycle
      window.dispatchEvent(
        new CustomEvent(GAMEPAD_EVENTS.ACTION, {
          detail: { action: "prev_tab", buttonName: "LB", buttonIndex: 4 },
        }),
      );

      expect(actionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            action: "prev_tab",
            buttonName: "LB",
          }),
        }),
      );

      window.removeEventListener(GAMEPAD_EVENTS.ACTION, actionSpy);
      stop();
    });
  });

  describe("spatial navigation", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div style="display: flex; gap: 20px;">
          <button id="btn1">Bouton 1</button>
          <button id="btn2">Bouton 2</button>
        </div>
        <div style="display: flex; gap: 20px; margin-top: 30px;">
          <button id="btn3">Bouton 3</button>
          <button id="btn4">Bouton 4</button>
        </div>
      `;

      // Mock getBoundingClientRect
      const btn1 = document.getElementById("btn1")!;
      const btn2 = document.getElementById("btn2")!;
      const btn3 = document.getElementById("btn3")!;
      const btn4 = document.getElementById("btn4")!;

      btn1.getBoundingClientRect = () =>
        ({
          left: 0,
          top: 0,
          width: 100,
          height: 40,
          right: 100,
          bottom: 40,
        }) as DOMRect;
      btn2.getBoundingClientRect = () =>
        ({
          left: 120,
          top: 0,
          width: 100,
          height: 40,
          right: 220,
          bottom: 40,
        }) as DOMRect;
      btn3.getBoundingClientRect = () =>
        ({
          left: 0,
          top: 70,
          width: 100,
          height: 40,
          right: 100,
          bottom: 110,
        }) as DOMRect;
      btn4.getBoundingClientRect = () =>
        ({
          left: 120,
          top: 70,
          width: 100,
          height: 40,
          right: 220,
          bottom: 110,
        }) as DOMRect;
    });

    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("sélectionne le premier élément si rien n'est sélectionné", () => {
      const moved = navigateSpatially("right");
      expect(moved).toBe(true);
      expect(document.activeElement?.id).toBe("btn1");
    });

    it("navigue vers la droite depuis le bouton 1 vers le bouton 2", () => {
      const btn1 = document.getElementById("btn1")!;
      btn1.focus();

      const moved = navigateSpatially("right");
      expect(moved).toBe(true);
      expect(document.activeElement?.id).toBe("btn2");
    });

    it("navigue vers le bas depuis le bouton 1 vers le bouton 3", () => {
      const btn1 = document.getElementById("btn1")!;
      btn1.focus();

      const moved = navigateSpatially("down");
      expect(moved).toBe(true);
      expect(document.activeElement?.id).toBe("btn3");
    });
  });
});
