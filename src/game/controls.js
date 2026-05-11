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

// Core movement math — accepts continuous axes (-1..1) from keyboard or joystick.
// dx: right=+1, left=-1  |  dz: backward=+1, forward=-1
// camera forward = (-sinY, 0, -cosY), camera right = (cosY, 0, -sinY)
export function computeMovementAxes(dx, dz, yaw, speed, delta) {
  const sinY = Math.sin(yaw)
  const cosY = Math.cos(yaw)
  return {
    x: (dx * cosY + dz * sinY) * speed * delta,
    z: (-dx * sinY + dz * cosY) * speed * delta,
  }
}

export function computeMovement(keyboard, yaw, speed, delta) {
  const dx = (keyboard.isDown(KEYS.RIGHT) ? 1 : 0) - (keyboard.isDown(KEYS.LEFT) ? 1 : 0)
  const dz = (keyboard.isDown(KEYS.BACKWARD) ? 1 : 0) - (keyboard.isDown(KEYS.FORWARD) ? 1 : 0)
  return computeMovementAxes(dx, dz, yaw, speed, delta)
}
