// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { createWorldManager } from '../game/renderer.js'
import { BlockType } from '../game/world.js'

function makeScene() {
  const meshes = []
  return {
    meshes,
    add(m)    { meshes.push(m) },
    remove(m) { const i = meshes.indexOf(m); if (i >= 0) meshes.splice(i, 1) },
  }
}

const b = (x, y, z, type) => ({ x, y, z, type })

describe('createWorldManager frustum culling', () => {
  it('instanced meshes disable frustum culling so blocks far from origin stay visible', () => {
    // Bug: InstancedMesh default frustumCulled=true uses geometry bounding sphere
    // (radius≈0.87 at origin). When camera turns away from origin the entire mesh
    // disappears, making newly placed blocks invisible.
    const scene = makeScene()
    createWorldManager(scene, [b(10, 0, 10, BlockType.GRASS)])
    expect(scene.meshes.every(m => m.frustumCulled === false)).toBe(true)
  })

  it('mesh added for a new block type also has frustum culling disabled', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [])
    wm.addBlock(b(50, 5, 50, BlockType.STONE))
    expect(scene.meshes.every(m => m.frustumCulled === false)).toBe(true)
  })
})

describe('createWorldManager addBlock', () => {
  it('block appears in getBlocks after addBlock', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [])
    wm.addBlock(b(1, 0, 1, BlockType.STONE))
    expect(wm.getBlocks()).toContainEqual(b(1, 0, 1, BlockType.STONE))
  })

  it('addBlock on occupied position is a no-op', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [b(0, 0, 0, BlockType.GRASS)])
    wm.addBlock(b(0, 0, 0, BlockType.DIRT))
    const at = wm.getBlocks().filter(bl => bl.x === 0 && bl.y === 0 && bl.z === 0)
    expect(at).toHaveLength(1)
    expect(at[0].type).toBe(BlockType.GRASS)
  })

  it('multiple blocks of same type are all returned', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [])
    wm.addBlock(b(0, 0, 0, BlockType.DIRT))
    wm.addBlock(b(1, 0, 0, BlockType.DIRT))
    wm.addBlock(b(2, 0, 0, BlockType.DIRT))
    expect(wm.getBlocks()).toHaveLength(3)
  })
})

describe('createWorldManager removeBlock', () => {
  it('block disappears from getBlocks after removeBlock', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [b(0, 0, 0, BlockType.GRASS), b(1, 0, 0, BlockType.STONE)])
    wm.removeBlock({ x: 0, y: 0, z: 0 })
    expect(wm.getBlocks().some(bl => bl.x === 0)).toBe(false)
    expect(wm.getBlocks().some(bl => bl.x === 1)).toBe(true)
  })

  it('removeBlock on missing position is a no-op', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [b(0, 0, 0, BlockType.GRASS)])
    expect(() => wm.removeBlock({ x: 9, y: 9, z: 9 })).not.toThrow()
    expect(wm.getBlocks()).toHaveLength(1)
  })

  it('swap-last keeps all other blocks intact when removing from middle', () => {
    const scene = makeScene()
    const initial = [b(0, 0, 0, BlockType.GRASS), b(1, 0, 0, BlockType.GRASS), b(2, 0, 0, BlockType.GRASS)]
    const wm = createWorldManager(scene, initial)
    wm.removeBlock({ x: 0, y: 0, z: 0 })
    const remaining = wm.getBlocks()
    expect(remaining).toHaveLength(2)
    expect(remaining.some(bl => bl.x === 1)).toBe(true)
    expect(remaining.some(bl => bl.x === 2)).toBe(true)
  })

  it('can re-add a block after it was removed', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [b(0, 0, 0, BlockType.GRASS)])
    wm.removeBlock({ x: 0, y: 0, z: 0 })
    wm.addBlock(b(0, 0, 0, BlockType.STONE))
    expect(wm.getBlocks()).toContainEqual(b(0, 0, 0, BlockType.STONE))
  })
})

describe('createWorldManager getBlockFromHit', () => {
  it('returns the block at the given instance index', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [b(3, 2, 1, BlockType.STONE)])
    const mesh = scene.meshes[0]
    const result = wm.getBlockFromHit({ object: mesh, instanceId: 0 })
    expect(result).toMatchObject({ x: 3, y: 2, z: 1, type: BlockType.STONE })
  })

  it('returns null for unknown mesh', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [b(0, 0, 0, BlockType.GRASS)])
    expect(wm.getBlockFromHit({ object: {}, instanceId: 0 })).toBeNull()
  })

  it('block returned is still correct after a swap-last removal', () => {
    // After removing block at index 0, block from index 1 slides into index 0.
    // getBlockFromHit(instanceId=0) must return the moved block, not the removed one.
    const scene = makeScene()
    const wm = createWorldManager(scene, [b(0, 0, 0, BlockType.GRASS), b(5, 0, 0, BlockType.GRASS)])
    wm.removeBlock({ x: 0, y: 0, z: 0 })
    const mesh = scene.meshes[0]
    const result = wm.getBlockFromHit({ object: mesh, instanceId: 0 })
    expect(result).toMatchObject({ x: 5, y: 0, z: 0 })
  })
})

describe('createWorldManager hasNukeAt', () => {
  it('returns true for a nuke block', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [b(5, 0, 5, BlockType.NUKE)])
    expect(wm.hasNukeAt(5, 0, 5)).toBe(true)
  })

  it('returns false for a non-nuke block', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [b(5, 0, 5, BlockType.GRASS)])
    expect(wm.hasNukeAt(5, 0, 5)).toBe(false)
  })

  it('returns false for empty position', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [])
    expect(wm.hasNukeAt(0, 0, 0)).toBe(false)
  })
})

describe('createWorldManager loadBlocks', () => {
  it('replaces all blocks', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [b(0, 0, 0, BlockType.DIRT)])
    wm.loadBlocks([b(5, 5, 5, BlockType.STONE), b(6, 5, 5, BlockType.STONE)])
    const blocks = wm.getBlocks()
    expect(blocks).toHaveLength(2)
    expect(blocks.some(bl => bl.x === 0)).toBe(false)
    expect(blocks.every(bl => bl.x >= 5)).toBe(true)
  })

  it('loaded meshes also have frustum culling disabled', () => {
    const scene = makeScene()
    const wm = createWorldManager(scene, [])
    wm.loadBlocks([b(100, 0, 100, BlockType.SAND)])
    expect(scene.meshes.every(m => m.frustumCulled === false)).toBe(true)
  })
})
