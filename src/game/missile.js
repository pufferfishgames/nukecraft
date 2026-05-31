const ZERO_OFFSET = { x: 0, y: 0, z: 0 }
const NO_GROUND = () => -Infinity

export const NUCLEAR_MISSILE = {
  mount: { x: 166, y: 5.5, z: 156 },
  gravity: 30,
  maxFallSpeed: 36,
  voidFloor: -8,
}

function cloneMissile(missile) {
  if (!missile) return null
  return {
    position: { ...missile.position },
    velocityY: missile.velocityY,
  }
}

export function createNuclearMissileController(options = NUCLEAR_MISSILE) {
  const config = {
    ...NUCLEAR_MISSILE,
    ...options,
    mount: { ...NUCLEAR_MISSILE.mount, ...options.mount },
  }
  let jumpWasDown = false
  let jumpCount = 0
  let missile = null

  function getState() {
    return {
      jumpCount,
      missile: cloneMissile(missile),
    }
  }

  return {
    getState,

    reset() {
      jumpWasDown = false
      jumpCount = 0
      missile = null
    },

    update({
      delta,
      rideActive,
      onAircraft,
      wantsJump,
      aircraftOffset = ZERO_OFFSET,
      getGroundY = NO_GROUND,
    }) {
      const jumpPressed = wantsJump && !jumpWasDown
      jumpWasDown = wantsJump
      let dropped = false
      let impacted = null

      if (!rideActive) jumpCount = 0

      if (jumpPressed && rideActive && onAircraft && !missile) {
        jumpCount++
        if (jumpCount >= 2) {
          missile = {
            position: {
              x: config.mount.x + (aircraftOffset.x ?? 0),
              y: config.mount.y + (aircraftOffset.y ?? 0),
              z: config.mount.z + (aircraftOffset.z ?? 0),
            },
            velocityY: 0,
          }
          jumpCount = 0
          dropped = true
        }
      }

      if (missile && !dropped) {
        const elapsed = Math.max(0, delta)
        missile.velocityY = Math.min(config.maxFallSpeed, missile.velocityY + config.gravity * elapsed)
        missile.position.y -= missile.velocityY * elapsed

        const groundY = getGroundY(missile.position.x, missile.position.z)
        if (Number.isFinite(groundY) && missile.position.y <= groundY) {
          impacted = {
            x: Math.round(missile.position.x),
            y: Math.round(groundY),
            z: Math.round(missile.position.z),
          }
          missile = null
        } else if (missile.position.y < config.voidFloor) {
          missile = null
        }
      }

      return {
        ...getState(),
        dropped,
        impacted,
      }
    },
  }
}
