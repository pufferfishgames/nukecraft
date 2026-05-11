export const GRAVITY          = 25   // blocks / s²
export const JUMP_VELOCITY    = 9    // blocks / s  (initial upward velocity)
export const PLAYER_EYE_HEIGHT = 1.6 // camera sits 1.6 blocks above feet
export const FALL_SPEED_MAX   = 40   // terminal velocity (blocks / s downward)
export const DESCEND_SPEED    = 8    // speed when holding the down button

export function applyGravity(velocityY, delta) {
  return Math.max(velocityY - GRAVITY * delta, -FALL_SPEED_MAX)
}

// Jump only fires when the player is standing on the ground.
export function applyJump(velocityY, isGrounded) {
  return isGrounded ? JUMP_VELOCITY : velocityY
}

// Pressing the down button kills upward momentum and applies a downward speed.
export function applyDescend(velocityY) {
  return Math.min(velocityY, -DESCEND_SPEED)
}

// Resolve camera Y against the terrain surface.
// Returns { posY, velocityY, isGrounded }.
export function resolveGround(posY, velocityY, groundY) {
  const feetY = posY - PLAYER_EYE_HEIGHT
  if (feetY <= groundY) {
    return {
      posY: groundY + PLAYER_EYE_HEIGHT,
      velocityY: Math.max(0, velocityY), // kill downward velocity; preserve upward
      isGrounded: true,
    }
  }
  return { posY, velocityY, isGrounded: false }
}

// Build a column-height map from an array of solid (non-passable) blocks.
// Key: "${x},${z}" → highest block Y in that column.
export function buildColMap(solidBlocks) {
  const map = new Map()
  for (const b of solidBlocks) {
    const k = `${b.x},${b.z}`
    const cur = map.get(k)
    if (cur === undefined || b.y > cur) map.set(k, b.y)
  }
  return map
}

// Return the Y coordinate of the top surface of the highest solid block
// directly under world position (px, pz).  Returns -Infinity if no block.
export function getGroundY(px, pz, colMap) {
  const y = colMap.get(`${Math.round(px)},${Math.round(pz)}`)
  return y !== undefined ? y + 0.5 : -Infinity
}
