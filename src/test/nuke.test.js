// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { countConnectedNuke, explosionPositions, nukeGlowIntensity, NUKE_CHAIN_LIMIT, EXPLOSION_RADIUS } from '../game/nuke.js'

describe('countConnectedNuke', () => {
  it('single isolated block counts as 1', () => {
    const hasNuke = (x, y, z) => x === 0 && y === 0 && z === 0
    expect(countConnectedNuke({ x: 0, y: 0, z: 0 }, hasNuke)).toBe(1)
  })

  it('two face-adjacent blocks count as 2', () => {
    const nukes = new Set(['0,0,0', '1,0,0'])
    const hasNuke = (x, y, z) => nukes.has(`${x},${y},${z}`)
    expect(countConnectedNuke({ x: 0, y: 0, z: 0 }, hasNuke)).toBe(2)
  })

  it('diagonal neighbor is not connected', () => {
    const nukes = new Set(['0,0,0', '1,1,0'])
    const hasNuke = (x, y, z) => nukes.has(`${x},${y},${z}`)
    expect(countConnectedNuke({ x: 0, y: 0, z: 0 }, hasNuke)).toBe(1)
  })

  it('counts a chain of 3 in a line', () => {
    const nukes = new Set(['0,0,0', '1,0,0', '2,0,0'])
    const hasNuke = (x, y, z) => nukes.has(`${x},${y},${z}`)
    expect(countConnectedNuke({ x: 0, y: 0, z: 0 }, hasNuke)).toBe(3)
  })

  it('counts L-shaped cluster of 4', () => {
    const nukes = new Set(['0,0,0', '1,0,0', '2,0,0', '2,1,0'])
    const hasNuke = (x, y, z) => nukes.has(`${x},${y},${z}`)
    expect(countConnectedNuke({ x: 0, y: 0, z: 0 }, hasNuke)).toBe(4)
  })

  it('returns at least NUKE_CHAIN_LIMIT for large cluster', () => {
    const nukes = new Set()
    for (let i = 0; i < 15; i++) nukes.add(`${i},0,0`)
    const hasNuke = (x, y, z) => nukes.has(`${x},${y},${z}`)
    expect(countConnectedNuke({ x: 0, y: 0, z: 0 }, hasNuke)).toBeGreaterThanOrEqual(NUKE_CHAIN_LIMIT)
  })
})

describe('explosionPositions', () => {
  it('includes the center', () => {
    const pos = explosionPositions(5, 5, 5, EXPLOSION_RADIUS)
    expect(pos.some(p => p.x === 5 && p.y === 5 && p.z === 5)).toBe(true)
  })

  it('includes block exactly at radius on one axis', () => {
    const pos = explosionPositions(0, 0, 0, 3)
    expect(pos.some(p => p.x === 3 && p.y === 0 && p.z === 0)).toBe(true)
  })

  it('excludes block just beyond radius', () => {
    const pos = explosionPositions(0, 0, 0, 3)
    expect(pos.some(p => p.x === 4 && p.y === 0 && p.z === 0)).toBe(false)
  })

  it('returns ~113 positions for radius 3', () => {
    const pos = explosionPositions(0, 0, 0, 3)
    expect(pos.length).toBeGreaterThanOrEqual(100)
    expect(pos.length).toBeLessThanOrEqual(130)
  })

  it('all positions are within the given radius', () => {
    const pos = explosionPositions(2, 3, 4, 3)
    for (const p of pos) {
      const d2 = (p.x-2)**2 + (p.y-3)**2 + (p.z-4)**2
      expect(d2).toBeLessThanOrEqual(9)
    }
  })
})

describe('nukeGlowIntensity', () => {
  it('returns 0 for no adjacent nukes', () => {
    expect(nukeGlowIntensity(0)).toBe(0)
  })

  it('returns positive for 1 adjacent nuke', () => {
    expect(nukeGlowIntensity(1)).toBeGreaterThan(0)
  })

  it('more adjacent nukes = more intensity', () => {
    expect(nukeGlowIntensity(3)).toBeGreaterThan(nukeGlowIntensity(1))
  })

  it('caps below 1.0', () => {
    expect(nukeGlowIntensity(100)).toBeLessThan(1.0)
  })
})
