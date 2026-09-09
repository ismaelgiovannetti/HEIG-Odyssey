import {
  GAMEPAD_EVENTS,
  XBOX_BUTTONS,
  type GamepadActionEventDetail,
  type GamepadActionType,
  type GamepadDirection,
  type GamepadNavEventDetail,
  type XboxButtonName,
} from "./gamepad-types";

interface ButtonState {
  pressed: boolean;
  repeatAt?: number;
}

const STICK_DEADZONE = 0.45;
const REPEAT_INITIAL_DELAY_MS = 280;
const REPEAT_INTERVAL_MS = 140;

const ACTION_MAPPING: Readonly<
  Record<number, { action: GamepadActionType; name: XboxButtonName }>
> = {
  [XBOX_BUTTONS.A]: { action: "confirm", name: "A" },
  [XBOX_BUTTONS.B]: { action: "cancel", name: "B" },
  [XBOX_BUTTONS.X]: { action: "context", name: "X" },
  [XBOX_BUTTONS.Y]: { action: "secondary", name: "Y" },
  [XBOX_BUTTONS.LB]: { action: "prev_tab", name: "LB" },
  [XBOX_BUTTONS.RB]: { action: "next_tab", name: "RB" },
  [XBOX_BUTTONS.START]: { action: "menu", name: "START" },
  [XBOX_BUTTONS.BACK]: { action: "cancel", name: "BACK" },
};

let activeRafId: number | null = null;
let buttonStates: Record<number, ButtonState> = {};
let navStates: Record<GamepadDirection, { active: boolean; repeatAt: number }> =
  {
    up: { active: false, repeatAt: 0 },
    down: { active: false, repeatAt: 0 },
    left: { active: false, repeatAt: 0 },
    right: { active: false, repeatAt: 0 },
  };
let connectedGamepadCount = 0;

function dispatchAction(detail: GamepadActionEventDetail) {
  if (typeof window === "undefined") return;
  const event = new CustomEvent<GamepadActionEventDetail>(
    GAMEPAD_EVENTS.ACTION,
    {
      bubbles: true,
      cancelable: true,
      detail,
    },
  );
  window.dispatchEvent(event);
}

function dispatchNav(direction: GamepadDirection) {
  if (typeof window === "undefined") return;
  const event = new CustomEvent<GamepadNavEventDetail>(GAMEPAD_EVENTS.NAV, {
    bubbles: true,
    cancelable: true,
    detail: { direction },
  });
  window.dispatchEvent(event);
}

function checkDirection(
  direction: GamepadDirection,
  isPressed: boolean,
  now: number,
) {
  const state = navStates[direction];
  if (isPressed) {
    if (!state.active) {
      state.active = true;
      state.repeatAt = now + REPEAT_INITIAL_DELAY_MS;
      dispatchNav(direction);
    } else if (now >= state.repeatAt) {
      state.repeatAt = now + REPEAT_INTERVAL_MS;
      dispatchNav(direction);
    }
  } else {
    state.active = false;
    state.repeatAt = 0;
  }
}

function pollGamepads() {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return;

  const gamepads = navigator.getGamepads();
  let firstActive: Gamepad | null = null;
  let totalConnected = 0;

  for (let i = 0; i < gamepads.length; i++) {
    const pad = gamepads[i];
    if (pad && pad.connected) {
      totalConnected++;
      if (!firstActive) firstActive = pad;
    }
  }

  if (totalConnected !== connectedGamepadCount) {
    connectedGamepadCount = totalConnected;
    if (typeof document !== "undefined") {
      document.body.classList.toggle("has-gamepad", connectedGamepadCount > 0);
    }
  }

  if (firstActive) {
    const now = performance.now();

    // 1. Boutons d'action
    for (const [indexStr, mapping] of Object.entries(ACTION_MAPPING)) {
      const idx = Number(indexStr);
      const btn = firstActive.buttons[idx];
      const isPressed = btn ? btn.pressed || btn.value > 0.5 : false;
      const prev = buttonStates[idx]?.pressed ?? false;

      if (isPressed && !prev) {
        dispatchAction({
          action: mapping.action,
          buttonName: mapping.name,
          buttonIndex: idx,
        });
      }

      buttonStates[idx] = { pressed: isPressed };
    }

    // 2. Croix directionnelle & sticks
    const dpadUp = firstActive.buttons[XBOX_BUTTONS.DPAD_UP]?.pressed ?? false;
    const dpadDown =
      firstActive.buttons[XBOX_BUTTONS.DPAD_DOWN]?.pressed ?? false;
    const dpadLeft =
      firstActive.buttons[XBOX_BUTTONS.DPAD_LEFT]?.pressed ?? false;
    const dpadRight =
      firstActive.buttons[XBOX_BUTTONS.DPAD_RIGHT]?.pressed ?? false;

    const stickX = firstActive.axes[0] ?? 0;
    const stickY = firstActive.axes[1] ?? 0;

    const isUp = dpadUp || stickY < -STICK_DEADZONE;
    const isDown = dpadDown || stickY > STICK_DEADZONE;
    const isLeft = dpadLeft || stickX < -STICK_DEADZONE;
    const isRight = dpadRight || stickX > STICK_DEADZONE;

    checkDirection("up", isUp, now);
    checkDirection("down", isDown, now);
    checkDirection("left", isLeft, now);
    checkDirection("right", isRight, now);
  }

  activeRafId = requestAnimationFrame(pollGamepads);
}

/**
 * Démarre la boucle d'écoute de manette globale.
 */
export function startGamepadLoop(): () => void {
  if (typeof window === "undefined") return () => {};

  const onConnect = (e: GamepadEvent) => {
    connectedGamepadCount++;
    document.body.classList.add("has-gamepad");
    window.dispatchEvent(
      new CustomEvent(GAMEPAD_EVENTS.CONNECTED, {
        detail: { id: e.gamepad.id },
      }),
    );
  };

  const onDisconnect = (e: GamepadEvent) => {
    connectedGamepadCount = Math.max(0, connectedGamepadCount - 1);
    if (connectedGamepadCount === 0) {
      document.body.classList.remove("has-gamepad");
    }
    window.dispatchEvent(
      new CustomEvent(GAMEPAD_EVENTS.DISCONNECTED, {
        detail: { id: e.gamepad.id },
      }),
    );
  };

  window.addEventListener("gamepadconnected", onConnect);
  window.addEventListener("gamepaddisconnected", onDisconnect);

  if (!activeRafId) {
    activeRafId = requestAnimationFrame(pollGamepads);
  }

  return () => {
    window.removeEventListener("gamepadconnected", onConnect);
    window.removeEventListener("gamepaddisconnected", onDisconnect);
    if (activeRafId) {
      cancelAnimationFrame(activeRafId);
      activeRafId = null;
    }
    buttonStates = {};
    navStates = {
      up: { active: false, repeatAt: 0 },
      down: { active: false, repeatAt: 0 },
      left: { active: false, repeatAt: 0 },
      right: { active: false, repeatAt: 0 },
    };
  };
}
