// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { joystickAxes, touchLookDelta } from '../game/touch.js'

describe('joystickAxes', () => {
  it('center touch returns zero movement', () => {
    const { dx, dz } = joystickAxes(100, 100, 100, 100, 50)
    expect(dx).toBe(0)
    expect(dz).toBe(0)
  })

  it('full right deflection returns dx=1 dz=0', () => {
    const { dx, dz } = joystickAxes(150, 100, 100, 100, 50)
    expect(dx).toBeCloseTo(1)
    expect(dz).toBeCloseTo(0)
  })

  it('full down deflection returns dx=0 dz=1', () => {
    const { dx, dz } = joystickAxes(100, 150, 100, 100, 50)
    expect(dx).toBeCloseTo(0)
    expect(dz).toBeCloseTo(1)
  })

  it('full up deflection returns dz=-1 (forward)', () => {
    const { dx, dz } = joystickAxes(100, 50, 100, 100, 50)
    expect(dx).toBeCloseTo(0)
    expect(dz).toBeCloseTo(-1)
  })

  it('clamps magnitude to 1 when touch exceeds radius', () => {
    const { dx, dz } = joystickAxes(300, 100, 100, 100, 50) // way past radius
    expect(Math.sqrt(dx * dx + dz * dz)).toBeCloseTo(1)
    expect(dx).toBeCloseTo(1)
  })

  it('diagonal at rim is clamped to unit circle', () => {
    // 45° diagonal at exactly √2 * radius → should clamp to (√2/2, √2/2)
    const r = 50
    const off = r * Math.SQRT2 + 1 // just past rim
    const { dx, dz } = joystickAxes(100 + off / Math.SQRT2, 100 + off / Math.SQRT2, 100, 100, r)
    expect(Math.sqrt(dx * dx + dz * dz)).toBeCloseTo(1, 5)
    expect(dx).toBeCloseTo(Math.SQRT2 / 2, 5)
    expect(dz).toBeCloseTo(Math.SQRT2 / 2, 5)
  })

  it('partial deflection scales proportionally', () => {
    const { dx } = joystickAxes(125, 100, 100, 100, 50) // 25px right of center out of 50px radius = 0.5
    expect(dx).toBeCloseTo(0.5)
  })
})

describe('touchLookDelta', () => {
  it('dragging right produces negative dyaw (turns right)', () => {
    const { dyaw } = touchLookDelta(10, 0, 0.002)
    expect(dyaw).toBeLessThan(0)
  })

  it('dragging left produces positive dyaw (turns left)', () => {
    const { dyaw } = touchLookDelta(-10, 0, 0.002)
    expect(dyaw).toBeGreaterThan(0)
  })

  it('dragging down produces negative dpitch (looks down)', () => {
    const { dpitch } = touchLookDelta(0, 10, 0.002)
    expect(dpitch).toBeLessThan(0)
  })

  it('dragging up produces positive dpitch (looks up)', () => {
    const { dpitch } = touchLookDelta(0, -10, 0.002)
    expect(dpitch).toBeGreaterThan(0)
  })

  it('scales linearly with sensitivity', () => {
    const a = touchLookDelta(100, 0, 0.001)
    const b = touchLookDelta(100, 0, 0.002)
    expect(b.dyaw).toBeCloseTo(a.dyaw * 2)
  })

  it('scales linearly with movement distance', () => {
    const a = touchLookDelta(10, 0, 0.002)
    const b = touchLookDelta(20, 0, 0.002)
    expect(b.dyaw).toBeCloseTo(a.dyaw * 2)
  })
})
