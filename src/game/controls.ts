/** Entrées partagées entre le DOM (clavier, tactile) et la boucle 3D. */

export const input = {
  keys: new Set<string>(),
  joy: { x: 0, y: 0 },
  camYaw: 0,
  camPitch: 0.32,
  camDist: 12,
  interact: false, // impulsion consommée par la boucle
  lookDrag: { x: 0, y: 0 },
};

export function shouldIgnoreKeyboard(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest(
      'input, textarea, select, button, a[href], [role="button"], [contenteditable="true"]',
    ) !== null
  );
}

export function pressInteract() {
  input.interact = true;
}

export function consumeInteract() {
  const v = input.interact;
  input.interact = false;
  return v;
}

export function movementVector() {
  const k = input.keys;
  let x =
    (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) -
    (k.has("KeyA") || k.has("KeyQ") || k.has("ArrowLeft") ? 1 : 0);
  let y =
    (k.has("KeyW") || k.has("KeyZ") || k.has("ArrowUp") ? 1 : 0) -
    (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
  x += input.joy.x;
  y += -input.joy.y;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y, len: Math.min(len, 1) };
}
