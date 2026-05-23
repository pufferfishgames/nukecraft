import {
  applyDescend,
  applyGravity,
  applyJump,
  PLAYER_EYE_HEIGHT,
  resolveGround,
} from './physics.js'

const ZERO_DELTA = { x: 0, y: 0, z: 0 }
const ZERO_MOVE = { x: 0, z: 0 }
const NO_GROUND = () => -Infinity

export function stepPlayerMotion({
  position,
  velocityY,
  isGrounded,
  isGroundedOnPlatform = false,
  platformDelta = ZERO_DELTA,
  move = ZERO_MOVE,
  delta,
  wantsJump = false,
  wantsDescend = false,
  getStaticGroundY = NO_GROUND,
  getPlatformGroundY = NO_GROUND,
  voidFloor = -5,
}) {
  const nextPosition = { ...position }

  if (isGroundedOnPlatform) {
    nextPosition.x += platformDelta.x ?? 0
    nextPosition.y += platformDelta.y ?? 0
    nextPosition.z += platformDelta.z ?? 0
  }

  nextPosition.x += move.x ?? 0
  nextPosition.z += move.z ?? 0

  let nextVelocityY = applyGravity(velocityY, delta)
  if (wantsJump) nextVelocityY = applyJump(nextVelocityY, isGrounded)
  if (wantsDescend) nextVelocityY = applyDescend(nextVelocityY)

  nextPosition.y += nextVelocityY * delta
  nextPosition.y = Math.max(nextPosition.y, voidFloor)

  const staticGroundY = getStaticGroundY(nextPosition.x, nextPosition.z)
  const platformGroundY = getPlatformGroundY(nextPosition.x, nextPosition.z)
  const groundY = Math.max(staticGroundY, platformGroundY)
  const resolved = resolveGround(nextPosition.y, nextVelocityY, groundY)

  nextPosition.y = resolved.posY

  const groundedOnPlatform = (
    resolved.isGrounded &&
    Number.isFinite(platformGroundY) &&
    platformGroundY >= staticGroundY &&
    Math.abs(nextPosition.y - (platformGroundY + PLAYER_EYE_HEIGHT)) < 1e-6
  )

  return {
    position: nextPosition,
    velocityY: resolved.velocityY,
    isGrounded: resolved.isGrounded,
    isGroundedOnPlatform: groundedOnPlatform,
  }
}
