// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  NUCLEAR_MISSILE,
  createNuclearMissileController,
} from '../game/missile.js'

const AIRCRAFT_OFFSET = { x: 4, y: 30, z: -6 }
const ON_AIRCRAFT = {
  rideActive: true,
  onAircraft: true,
  aircraftOffset: AIRCRAFT_OFFSET,
  getGroundY: () => 0.5,
}

describe('nuclear missile controller', () => {
  it('drops a missile from the flying aircraft after two distinct on-board jumps', () => {
    const controller = createNuclearMissileController()

    const first = controller.update({ ...ON_AIRCRAFT, delta: 0, wantsJump: true })
    expect(first.jumpCount).toBe(1)
    expect(first.dropped).toBe(false)
    expect(first.missile).toBeNull()

    const held = controller.update({ ...ON_AIRCRAFT, delta: 0, wantsJump: true })
    expect(held.jumpCount).toBe(1)
    expect(held.dropped).toBe(false)

    controller.update({ ...ON_AIRCRAFT, delta: 0, wantsJump: false })
    const second = controller.update({ ...ON_AIRCRAFT, delta: 0, wantsJump: true })

    expect(second.dropped).toBe(true)
    expect(second.jumpCount).toBe(0)
    expect(second.missile.position).toEqual({
      x: NUCLEAR_MISSILE.mount.x + AIRCRAFT_OFFSET.x,
      y: NUCLEAR_MISSILE.mount.y + AIRCRAFT_OFFSET.y,
      z: NUCLEAR_MISSILE.mount.z + AIRCRAFT_OFFSET.z,
    })
  })

  it('ignores jump presses until the player is aboard the flying aircraft', () => {
    const controller = createNuclearMissileController()

    expect(controller.update({
      ...ON_AIRCRAFT,
      delta: 0,
      rideActive: false,
      wantsJump: true,
    }).jumpCount).toBe(0)

    controller.update({ ...ON_AIRCRAFT, delta: 0, wantsJump: false })
    expect(controller.update({
      ...ON_AIRCRAFT,
      delta: 0,
      onAircraft: false,
      wantsJump: true,
    }).jumpCount).toBe(0)
  })

  it('keeps falling after the aircraft ride ends and reports the terrain impact once', () => {
    const controller = createNuclearMissileController({
      ...NUCLEAR_MISSILE,
      gravity: 10,
      maxFallSpeed: 50,
    })

    controller.update({ ...ON_AIRCRAFT, delta: 0, wantsJump: true })
    controller.update({ ...ON_AIRCRAFT, delta: 0, wantsJump: false })
    const dropped = controller.update({ ...ON_AIRCRAFT, delta: 0, wantsJump: true })
    const origin = dropped.missile.position

    const falling = controller.update({
      ...ON_AIRCRAFT,
      delta: 1,
      rideActive: false,
      onAircraft: false,
      wantsJump: false,
    })
    expect(falling.missile.position.y).toBe(origin.y - 10)
    expect(falling.impacted).toBeNull()

    const impacted = controller.update({
      ...ON_AIRCRAFT,
      delta: 3,
      rideActive: false,
      onAircraft: false,
      wantsJump: false,
    })
    expect(impacted.missile).toBeNull()
    expect(impacted.impacted).toEqual({
      x: Math.round(origin.x),
      y: 1,
      z: Math.round(origin.z),
    })

    expect(controller.update({
      ...ON_AIRCRAFT,
      delta: 1,
      rideActive: false,
      onAircraft: false,
      wantsJump: false,
    }).impacted).toBeNull()
  })

  it('reset clears an armed jump and an active missile', () => {
    const controller = createNuclearMissileController()

    controller.update({ ...ON_AIRCRAFT, delta: 0, wantsJump: true })
    controller.update({ ...ON_AIRCRAFT, delta: 0, wantsJump: false })
    controller.update({ ...ON_AIRCRAFT, delta: 0, wantsJump: true })
    controller.reset()

    expect(controller.getState()).toEqual({ jumpCount: 0, missile: null })
  })
})
