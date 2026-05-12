import { PLAYER_EYE_HEIGHT } from './physics.js'
import { BlockType } from './world.js'

const ZERO_OFFSET = { x: 0, y: 0, z: 0 }

export const BOEING_747_RIDE = {
  bounds: { x0: 116, x1: 216, z0: 113, z1: 199 },
  minBoardGroundY: 8.5,
  minRenderY: 2,
  duration: 24,
  maxAltitude: 42,
  radiusX: 96,
  radiusZ: 64,
}

function inBounds(x, z, bounds) {
  return x >= bounds.x0 && x <= bounds.x1 && z >= bounds.z0 && z <= bounds.z1
}

function roundOffset(value) {
  return Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(6))
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function subtractOffset(next, previous) {
  return {
    x: roundOffset(next.x - previous.x),
    y: roundOffset(next.y - previous.y),
    z: roundOffset(next.z - previous.z),
  }
}

export function getAircraftFlightOffset(progress, config = BOEING_747_RIDE) {
  const t = clamp01(progress)
  if (t === 0 || t === 1) return { ...ZERO_OFFSET }

  const angle = Math.PI * 2 * t
  return {
    x: roundOffset(config.radiusX * Math.sin(angle)),
    y: roundOffset(config.maxAltitude * Math.sin(Math.PI * t)),
    z: roundOffset(config.radiusZ * (1 - Math.cos(angle))),
  }
}

export function isBoeing747RideBlock(block, config = BOEING_747_RIDE) {
  return (
    block.y >= config.minRenderY &&
    block.type !== BlockType.SAND &&
    inBounds(block.x, block.z, config.bounds)
  )
}

export function isOnBoeing747Ride({ x, y, z, groundY, isGrounded }, config = BOEING_747_RIDE) {
  if (!isGrounded || !Number.isFinite(groundY)) return false
  if (!inBounds(x, z, config.bounds)) return false
  if (groundY < config.minBoardGroundY) return false
  return Math.abs(y - (groundY + PLAYER_EYE_HEIGHT)) < 1.2
}

export function createAircraftRideController(config = BOEING_747_RIDE) {
  let active = false
  let ready = true
  let elapsed = 0
  let offset = { ...ZERO_OFFSET }

  function idleFrame(onBoard) {
    return {
      active: false,
      started: false,
      ended: false,
      onBoard,
      offset: { ...offset },
      deltaOffset: { ...ZERO_OFFSET },
    }
  }

  return {
    isActive() {
      return active
    },

    reset() {
      active = false
      ready = true
      elapsed = 0
      offset = { ...ZERO_OFFSET }
    },

    update({ delta, position, groundY, isGrounded }) {
      const onBoard = isOnBoeing747Ride({ ...position, groundY, isGrounded }, config)

      if (!active) {
        if (!onBoard) ready = true
        if (!onBoard || !ready) return idleFrame(onBoard)

        active = true
        ready = false
        elapsed = 0
        offset = { ...ZERO_OFFSET }
        return {
          active: true,
          started: true,
          ended: false,
          onBoard,
          offset: { ...offset },
          deltaOffset: { ...ZERO_OFFSET },
        }
      }

      const previousOffset = offset
      elapsed = Math.min(config.duration, elapsed + Math.max(0, delta))
      offset = getAircraftFlightOffset(elapsed / config.duration, config)

      const frame = {
        active: elapsed < config.duration,
        started: false,
        ended: elapsed >= config.duration,
        onBoard,
        offset: { ...offset },
        deltaOffset: subtractOffset(offset, previousOffset),
      }

      if (frame.ended) {
        active = false
        ready = false
        elapsed = 0
      }

      return frame
    },
  }
}
