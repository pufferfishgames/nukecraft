import { describe, it, expect } from 'vitest'
import { createKeyboardState, computeMovement, computeMovementAxes, KEYS } from '../game/controls.js'

describe('createKeyboardState', () => {
  it('starts with no keys pressed', () => {
    const kb = createKeyboardState()
    expect(kb.isDown(KEYS.FORWARD)).toBe(false)
  })

  it('registers keydown events', () => {
    const kb = createKeyboardState()
    kb.onKeyDown({ code: 'KeyW' })
    expect(kb.isDown(KEYS.FORWARD)).toBe(true)
  })

  it('unregisters keyup events', () => {
    const kb = createKeyboardState()
    kb.onKeyDown({ code: 'KeyW' })
    kb.onKeyUp({ code: 'KeyW' })
    expect(kb.isDown(KEYS.FORWARD)).toBe(false)
  })

  it('supports arrow key aliases for movement', () => {
    const kb = createKeyboardState()
    kb.onKeyDown({ code: 'ArrowUp' })
    expect(kb.isDown(KEYS.FORWARD)).toBe(true)
  })
})

describe('computeMovementAxes', () => {
  it('forward (dz=-1) at yaw=0 produces negative Z', () => {
    const { x, z } = computeMovementAxes(0, -1, 0, 1, 1)
    expect(z).toBeCloseTo(-1)
    expect(Math.abs(x)).toBeLessThan(1e-10)
  })

  it('right (dx=1) at yaw=0 produces positive X', () => {
    const { x, z } = computeMovementAxes(1, 0, 0, 1, 1)
    expect(x).toBeCloseTo(1)
    expect(Math.abs(z)).toBeLessThan(1e-10)
  })

  it('zero axes produce zero movement', () => {
    const { x, z } = computeMovementAxes(0, 0, 0, 1, 1)
    expect(x).toBe(0)
    expect(z).toBe(0)
  })

  it('scales with speed and delta', () => {
    const a = computeMovementAxes(0, -1, 0, 2, 1)
    const b = computeMovementAxes(0, -1, 0, 1, 2)
    expect(a.z).toBeCloseTo(b.z)
  })

  it('fractional dx/dz (joystick) gives proportional output', () => {
    const full = computeMovementAxes(1, 0, 0, 1, 1)
    const half = computeMovementAxes(0.5, 0, 0, 1, 1)
    expect(half.x).toBeCloseTo(full.x * 0.5)
  })

  it('forward at yaw=π/2 moves in -X (camera faces -X)', () => {
    const { x, z } = computeMovementAxes(0, -1, Math.PI / 2, 1, 1)
    expect(x).toBeLessThan(0)
    expect(Math.abs(z)).toBeLessThan(1e-10)
  })
})

describe('computeMovement', () => {
  const delta = 1
  const speed = 1

  it('moving forward with yaw=0 produces negative Z', () => {
    const kb = createKeyboardState()
    kb.onKeyDown({ code: 'KeyW' })
    const { x, z } = computeMovement(kb, 0, speed, delta)
    expect(z).toBeLessThan(0)
    expect(Math.abs(x)).toBeLessThan(1e-10)
  })

  it('moving right with yaw=0 produces positive X', () => {
    const kb = createKeyboardState()
    kb.onKeyDown({ code: 'KeyD' })
    const { x, z } = computeMovement(kb, 0, speed, delta)
    expect(x).toBeGreaterThan(0)
  })

  it('returns zero movement when no keys are pressed', () => {
    const kb = createKeyboardState()
    const { x, z } = computeMovement(kb, 0, speed, delta)
    expect(x).toBe(0)
    expect(z).toBe(0)
  })

  it('speed and delta scale the output linearly', () => {
    const kb = createKeyboardState()
    kb.onKeyDown({ code: 'KeyW' })
    const a = computeMovement(kb, 0, 2, 1)
    const b = computeMovement(kb, 0, 1, 2)
    expect(a.z).toBeCloseTo(b.z)
  })

  it('yaw rotates movement direction', () => {
    const kb = createKeyboardState()
    kb.onKeyDown({ code: 'KeyW' })
    const straight = computeMovement(kb, 0, speed, delta)
    const rotated = computeMovement(kb, Math.PI / 2, speed, delta)
    expect(Math.abs(rotated.x)).toBeGreaterThan(Math.abs(straight.x))
  })

  it('forward aligns with camera look direction at yaw=π/2', () => {
    const kb = createKeyboardState()
    kb.onKeyDown({ code: 'KeyW' })
    const { x, z } = computeMovement(kb, Math.PI / 2, speed, delta)
    expect(x).toBeLessThan(0)
    expect(Math.abs(z)).toBeLessThan(1e-10)
  })

  it('left strafe is perpendicular to forward and correct at yaw=π/2', () => {
    const kb = createKeyboardState()
    kb.onKeyDown({ code: 'KeyA' })
    const { x, z } = computeMovement(kb, Math.PI / 2, speed, delta)
    expect(z).toBeGreaterThan(0)
    expect(Math.abs(x)).toBeLessThan(1e-10)
  })
})
