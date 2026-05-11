export const NUKE_CHAIN_LIMIT = 10
export const EXPLOSION_RADIUS = 3

const FACES = [
  [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
]

// BFS flood fill — counts connected nuke blocks (6-face adjacency).
// Stops counting once NUKE_CHAIN_LIMIT is exceeded (early exit for performance).
export function countConnectedNuke(startPos, hasNukeAt) {
  const visited = new Set()
  const queue = [startPos]
  const key = p => `${p.x},${p.y},${p.z}`
  visited.add(key(startPos))
  while (queue.length && visited.size <= NUKE_CHAIN_LIMIT + 1) {
    const { x, y, z } = queue.shift()
    for (const [dx, dy, dz] of FACES) {
      const n = { x: x+dx, y: y+dy, z: z+dz }
      const k = key(n)
      if (!visited.has(k) && hasNukeAt(n.x, n.y, n.z)) {
        visited.add(k)
        queue.push(n)
      }
    }
  }
  return visited.size
}

// All integer positions within sphere of given radius centred at (cx, cy, cz).
export function explosionPositions(cx, cy, cz, radius) {
  const out = []
  const r2 = radius * radius
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++)
      for (let dz = -radius; dz <= radius; dz++)
        if (dx*dx + dy*dy + dz*dz <= r2)
          out.push({ x: cx+dx, y: cy+dy, z: cz+dz })
  return out
}

// Emissive intensity for blocks adjacent to nuke blocks.
export function nukeGlowIntensity(adjacentNukeCount) {
  return Math.min(adjacentNukeCount * 0.18, 0.9)
}
