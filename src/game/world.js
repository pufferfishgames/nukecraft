import * as THREE from 'three'

export const BLOCK_SIZE = 1
export const CHUNK_SIZE = 16
export const WORLD_HEIGHT = 8

export const BlockType = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  WOOD: 6,
  LEAVES: 7,
  STONE_BRICK: 8,
  CONCRETE: 9,
  GRAVEL: 10,
}

export const BLOCK_COLORS = {
  [BlockType.GRASS]: 0x4caf50,
  [BlockType.DIRT]: 0x8d6e63,
  [BlockType.STONE]: 0x9e9e9e,
  [BlockType.SAND]: 0xf4d03f,
  [BlockType.WATER]: 0x1e88e5,
  [BlockType.WOOD]: 0x6d4c41,
  [BlockType.LEAVES]: 0x2e7d32,
  [BlockType.STONE_BRICK]: 0x78909c,
  [BlockType.CONCRETE]: 0xbdbdbd,
  [BlockType.GRAVEL]: 0x757575,
}

// Deterministic pseudo-random based on position + salt
function rand(x, z, salt = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.9) * 43758.5453
  return n - Math.floor(n)
}

// ─── Plains (legacy, kept for existing tests) ───────────────────────────────

export function generateTerrain(chunkX = 0, chunkZ = 0) {
  const blocks = []
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const height = 4
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        let type = BlockType.AIR
        if (y < height - 1) type = BlockType.STONE
        else if (y < height) type = BlockType.DIRT
        else if (y === height) type = BlockType.GRASS
        if (type !== BlockType.AIR) {
          blocks.push({ x: chunkX * CHUNK_SIZE + x, y, z: chunkZ * CHUNK_SIZE + z, type })
        }
      }
    }
  }
  return blocks
}

// ─── Biome generators ────────────────────────────────────────────────────────

function generateDesertChunk(cx, cz) {
  const blocks = []
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = cx * CHUNK_SIZE + x
      const wz = cz * CHUNK_SIZE + z
      for (let y = 0; y <= 4; y++) {
        blocks.push({ x: wx, y, z: wz, type: BlockType.SAND })
      }
    }
  }
  return blocks
}

function addTree(blocks, x, groundY, z) {
  for (let i = 1; i <= 4; i++) {
    blocks.push({ x, y: groundY + i, z, type: BlockType.WOOD })
  }
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      blocks.push({ x: x + dx, y: groundY + 4, z: z + dz, type: BlockType.LEAVES })
      blocks.push({ x: x + dx, y: groundY + 5, z: z + dz, type: BlockType.LEAVES })
    }
  }
  blocks.push({ x, y: groundY + 6, z, type: BlockType.LEAVES })
}

function generateForestChunk(cx, cz) {
  const blocks = []
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = cx * CHUNK_SIZE + x
      const wz = cz * CHUNK_SIZE + z
      const h = 3 + Math.floor(rand(wx, wz) * 3)
      for (let y = 0; y < h; y++) {
        let type = BlockType.STONE
        if (y === h - 1) type = BlockType.GRASS
        else if (y === h - 2) type = BlockType.DIRT
        blocks.push({ x: wx, y, z: wz, type })
      }
      if (rand(wx, wz, 1) < 0.08) addTree(blocks, wx, h - 1, wz)
    }
  }
  return blocks
}

function generateOceanChunk(cx, cz) {
  const blocks = []
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = cx * CHUNK_SIZE + x
      const wz = cz * CHUNK_SIZE + z
      blocks.push({ x: wx, y: 0, z: wz, type: BlockType.GRAVEL })
      blocks.push({ x: wx, y: 1, z: wz, type: BlockType.GRAVEL })
      for (let y = 2; y <= 5; y++) {
        blocks.push({ x: wx, y, z: wz, type: BlockType.WATER })
      }
    }
  }
  return blocks
}

function generateCityChunk(cx, cz) {
  const blocks = []
  // Flat base: stone y=0-2, concrete road at y=3
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = cx * CHUNK_SIZE + x
      const wz = cz * CHUNK_SIZE + z
      for (let y = 0; y <= 2; y++) blocks.push({ x: wx, y, z: wz, type: BlockType.STONE })
      blocks.push({ x: wx, y: 3, z: wz, type: BlockType.CONCRETE })
    }
  }
  // Buildings: 4×4 cell grid, checkerboard placement
  for (let bx = 0; bx < 4; bx++) {
    for (let bz = 0; bz < 4; bz++) {
      if ((bx + bz) % 2 !== 0) continue
      const wx = cx * CHUNK_SIZE + bx * 4 + 1
      const wz = cz * CHUNK_SIZE + bz * 4 + 1
      const h = 3 + Math.floor(rand(bx, bz, 99) * 5)
      // Walls (hollow 3×3 per floor)
      for (let dy = 1; dy <= h; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          for (let dz = 0; dz < 3; dz++) {
            if (dx === 0 || dx === 2 || dz === 0 || dz === 2) {
              blocks.push({ x: wx + dx, y: 3 + dy, z: wz + dz, type: BlockType.STONE_BRICK })
            }
          }
        }
      }
      // Roof
      for (let dx = 0; dx < 3; dx++) {
        for (let dz = 0; dz < 3; dz++) {
          blocks.push({ x: wx + dx, y: 3 + h + 1, z: wz + dz, type: BlockType.CONCRETE })
        }
      }
    }
  }
  return blocks
}

// ─── World ───────────────────────────────────────────────────────────────────

export function generateWorld() {
  const all = [
    ...generateDesertChunk(0, 0),
    ...generateForestChunk(1, 0),
    ...generateOceanChunk(0, 1),
    ...generateCityChunk(1, 1),
  ]
  const seen = new Set()
  return all.filter((b) => {
    const k = `${b.x},${b.y},${b.z}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ─── Mesh utilities ──────────────────────────────────────────────────────────

export function makeBlockMesh(block) {
  const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
  const material = new THREE.MeshLambertMaterial({
    color: BLOCK_COLORS[block.type] ?? 0xffffff,
    ...(block.type === BlockType.WATER ? { transparent: true, opacity: 0.65 } : {}),
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(block.x, block.y, block.z)
  mesh.userData.block = block
  return mesh
}

// kept for backward compat
export function buildChunkMesh(blocks) {
  return blocks.map(makeBlockMesh)
}
