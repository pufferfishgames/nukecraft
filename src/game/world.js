import * as THREE from 'three'

export const BLOCK_SIZE = 1
export const CHUNK_SIZE = 16
export const WORLD_HEIGHT = 8

export const BlockType = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
}

const BLOCK_COLORS = {
  [BlockType.GRASS]: 0x4caf50,
  [BlockType.DIRT]: 0x8d6e63,
  [BlockType.STONE]: 0x9e9e9e,
}

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
          blocks.push({
            x: chunkX * CHUNK_SIZE + x,
            y,
            z: chunkZ * CHUNK_SIZE + z,
            type,
          })
        }
      }
    }
  }
  return blocks
}

export function buildChunkMesh(blocks) {
  const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
  const meshes = []

  for (const block of blocks) {
    const material = new THREE.MeshLambertMaterial({
      color: BLOCK_COLORS[block.type] ?? 0xffffff,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(block.x, block.y, block.z)
    mesh.userData = { block }
    meshes.push(mesh)
  }

  return meshes
}
