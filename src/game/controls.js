export const KEYS = {
  FORWARD: ['KeyW', 'ArrowUp'],
  BACKWARD: ['KeyS', 'ArrowDown'],
  LEFT: ['KeyA', 'ArrowLeft'],
  RIGHT: ['KeyD', 'ArrowRight'],
  JUMP: ['Space'],
}

export function createKeyboardState() {
  const pressed = new Set()
  return {
    pressed,
    isDown: (keys) => keys.some((k) => pressed.has(k)),
    onKeyDown: (e) => pressed.add(e.code),
    onKeyUp: (e) => pressed.delete(e.code),
  }
}

export function computeMovement(keyboard, yaw, speed, delta) {
  const forward = keyboard.isDown(KEYS.FORWARD)
  const backward = keyboard.isDown(KEYS.BACKWARD)
  const left = keyboard.isDown(KEYS.LEFT)
  const right = keyboard.isDown(KEYS.RIGHT)

  const dx =
    (right ? 1 : 0) - (left ? 1 : 0)
  const dz =
    (backward ? 1 : 0) - (forward ? 1 : 0)

  const sinY = Math.sin(yaw)
  const cosY = Math.cos(yaw)

  return {
    x: (dx * cosY - dz * sinY) * speed * delta,
    z: (dx * sinY + dz * cosY) * speed * delta,
  }
}
