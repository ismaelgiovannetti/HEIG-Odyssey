/**
 * Identifiants et mappings standards pour manettes (notamment manette Xbox).
 * Conforme au mapping "standard" du W3C Gamepad API.
 */

export const XBOX_BUTTONS = {
  A: 0, // Croix / Sud (Validation)
  B: 1, // Rond / Est (Annulation / Retour)
  X: 2, // Carré / Ouest (Action contextuelle)
  Y: 3, // Triangle / Nord (Action secondaire)
  LB: 4, // L1 (Gâchette haute gauche)
  RB: 5, // R1 (Gâchette haute droite)
  LT: 6, // L2 (Gâchette basse gauche)
  RT: 7, // R2 (Gâchette basse droite)
  BACK: 8, // View / Select
  START: 9, // Menu / Start
  L3: 10, // Clic stick gauche
  R3: 11, // Clic stick droit
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

export type XboxButtonName = keyof typeof XBOX_BUTTONS;

export type GamepadDirection = "up" | "down" | "left" | "right";

export type GamepadActionType =
  | "confirm"
  | "cancel"
  | "context"
  | "secondary"
  | "prev_tab"
  | "next_tab"
  | "menu";

export interface GamepadActionEventDetail {
  action: GamepadActionType;
  buttonName: XboxButtonName;
  buttonIndex: number;
}

export interface GamepadNavEventDetail {
  direction: GamepadDirection;
}

export const GAMEPAD_EVENTS = {
  NAV: "odyssey:gamepad-nav",
  ACTION: "odyssey:gamepad-action",
  CONNECTED: "odyssey:gamepad-connected",
  DISCONNECTED: "odyssey:gamepad-disconnected",
} as const;
