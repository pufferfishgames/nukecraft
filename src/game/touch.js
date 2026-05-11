export const JOYSTICK_RADIUS = 60
export const TOUCH_SENSITIVITY = 0.004

export function joystickAxes(touchX, touchY, centerX, centerY, radius) {
  const dx = (touchX - centerX) / radius
  const dz = (touchY - centerY) / radius
  const len = Math.sqrt(dx * dx + dz * dz)
  if (len > 1) return { dx: dx / len, dz: dz / len }
  return { dx, dz }
}

// movementX/Y are pixel deltas; returns yaw/pitch deltas to apply
export function touchLookDelta(movementX, movementY, sensitivity) {
  return {
    dyaw: -movementX * sensitivity,
    dpitch: -movementY * sensitivity,
  }
}
