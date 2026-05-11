import { describe, it, expect } from 'vitest'
import {
  applyGravity, applyJump, applyDescend, resolveGround,
  buildColMap, getGroundY,
  GRAVITY, JUMP_VELOCITY, PLAYER_EYE_HEIGHT, FALL_SPEED_MAX,
} from '../game/physics.js'

describe('applyGravity', () => {
  it('reduces velocity each frame', () => {
    expect(applyGravity(0, 0.1)).toBeLessThan(0)
  })

  it('applies GRAVITY * delta exactly', () => {
    expect(applyGravity(0, 1)).toBeCloseTo(-GRAVITY)
  })

  it('accumulates across frames', () => {
    const v1 = applyGravity(0, 0.1)
    const v2 = applyGravity(v1, 0.1)
    expect(v2).toBeLessThan(v1)
  })

  it('clamps at terminal velocity', () => {
    expect(applyGravity(-FALL_SPEED_MAX - 100, 1)).toBe(-FALL_SPEED_MAX)
  })

  it('preserves upward velocity minus gravity', () => {
    expect(applyGravity(10, 1)).toBeCloseTo(10 - GRAVITY)
  })
})

describe('applyJump', () => {
  it('sets velocity to JUMP_VELOCITY when grounded', () => {
    expect(applyJump(0, true)).toBe(JUMP_VELOCITY)
  })

  it('overrides downward velocity when grounded', () => {
    expect(applyJump(-5, true)).toBe(JUMP_VELOCITY)
  })

  it('does nothing when airborne', () => {
    expect(applyJump(-3, false)).toBe(-3)
  })

  it('does nothing when already moving up and airborne', () => {
    expect(applyJump(5, false)).toBe(5)
  })
})

describe('applyDescend', () => {
  it('forces velocity downward', () => {
    expect(applyDescend(0)).toBeLessThan(0)
  })

  it('does not change already fast descent', () => {
    const fast = applyDescend(0)
    expect(applyDescend(fast - 1)).toBe(fast - 1)
  })

  it('cancels upward velocity (pressing down while jumping)', () => {
    const result = applyDescend(5)
    expect(result).toBeLessThanOrEqual(0)
  })
})

describe('resolveGround', () => {
  // posY is camera Y; feetY = posY - PLAYER_EYE_HEIGHT

  it('detects ground when feet are at or below surface', () => {
    // feetY = (groundY + PLAYER_EYE_HEIGHT) - PLAYER_EYE_HEIGHT = groundY → exactly on surface
    const groundY = 4.5
    const { isGrounded } = resolveGround(groundY + PLAYER_EYE_HEIGHT, -5, groundY)
    expect(isGrounded).toBe(true)
  })

  it('not grounded when feet are above surface', () => {
    const { isGrounded } = resolveGround(20, -5, 4.5)
    expect(isGrounded).toBe(false)
  })

  it('snaps posY to groundY + PLAYER_EYE_HEIGHT', () => {
    const groundY = 4.5
    const { posY } = resolveGround(5.0, -5, groundY)  // feet below ground
    expect(posY).toBeCloseTo(groundY + PLAYER_EYE_HEIGHT)
  })

  it('zeroes downward velocity on landing', () => {
    const groundY = 4.5
    const { velocityY } = resolveGround(groundY + PLAYER_EYE_HEIGHT, -8, groundY)
    expect(velocityY).toBe(0)
  })

  it('preserves upward velocity when grounded (jump takeoff)', () => {
    const groundY = 4.5
    const { velocityY } = resolveGround(groundY + PLAYER_EYE_HEIGHT, JUMP_VELOCITY, groundY)
    expect(velocityY).toBe(JUMP_VELOCITY)
  })

  it('posY unchanged when airborne', () => {
    const { posY } = resolveGround(20, -5, 4.5)
    expect(posY).toBe(20)
  })
})

describe('buildColMap', () => {
  it('records the highest Y per column', () => {
    const map = buildColMap([
      { x: 0, y: 2, z: 0 },
      { x: 0, y: 5, z: 0 },
      { x: 0, y: 1, z: 0 },
    ])
    expect(map.get('0,0')).toBe(5)
  })

  it('handles multiple distinct columns', () => {
    const map = buildColMap([
      { x: 3, y: 4, z: 7 },
      { x: 5, y: 2, z: 1 },
    ])
    expect(map.get('3,7')).toBe(4)
    expect(map.get('5,1')).toBe(2)
  })

  it('returns undefined for columns not in the map', () => {
    const map = buildColMap([{ x: 0, y: 3, z: 0 }])
    expect(map.get('99,99')).toBeUndefined()
  })

  it('empty input produces empty map', () => {
    expect(buildColMap([]).size).toBe(0)
  })
})

describe('getGroundY', () => {
  it('returns block top surface (block y + 0.5)', () => {
    const map = new Map([['3,7', 4]])
    expect(getGroundY(3, 7, map)).toBe(4.5)
  })

  it('uses Math.round for block column lookup', () => {
    const map = new Map([['3,7', 4]])
    // player at x=3.3 should round to column 3
    expect(getGroundY(3.3, 7.1, map)).toBe(4.5)
  })

  it('returns -Infinity for empty column', () => {
    expect(getGroundY(99, 99, new Map())).toBe(-Infinity)
  })
})
