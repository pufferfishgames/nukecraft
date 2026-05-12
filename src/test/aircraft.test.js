// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  BOEING_747_RIDE,
  createAircraftRideController,
  getAircraftFlightOffset,
  isBoeing747RideBlock,
  isOnBoeing747Ride,
} from '../game/aircraft.js'
import { BlockType } from '../game/world.js'

describe('Boeing 747 ride detection', () => {
  it('starts only when the player is grounded on the raised aircraft body', () => {
    expect(isOnBoeing747Ride({
      x: 166,
      y: 11.6,
      z: 156,
      groundY: 10,
      isGrounded: true,
    })).toBe(true)

    expect(isOnBoeing747Ride({
      x: 166,
      y: 2.6,
      z: 156,
      groundY: 1,
      isGrounded: true,
    })).toBe(false)

    expect(isOnBoeing747Ride({
      x: 166,
      y: 11.6,
      z: 156,
      groundY: 10,
      isGrounded: false,
    })).toBe(false)
  })

  it('selects aircraft blocks without selecting the runway stripes', () => {
    expect(isBoeing747RideBlock({ x: 166, y: 10, z: 156, type: BlockType.CONCRETE })).toBe(true)
    expect(isBoeing747RideBlock({ x: 166, y: 2, z: 156, type: BlockType.SAND })).toBe(false)
    expect(isBoeing747RideBlock({ x: 166, y: 1, z: 156, type: BlockType.CONCRETE })).toBe(false)
  })
})

describe('Boeing 747 ride controller', () => {
  it('carries the rider around the map and returns to the launch point', () => {
    const ride = createAircraftRideController({ ...BOEING_747_RIDE, duration: 10 })

    const start = ride.update({
      delta: 0,
      position: { x: 166, y: 11.6, z: 156 },
      groundY: 10,
      isGrounded: true,
    })
    expect(start.started).toBe(true)
    expect(start.active).toBe(true)
    expect(start.offset).toEqual({ x: 0, y: 0, z: 0 })

    const cruise = ride.update({
      delta: 5,
      position: { x: 166, y: 11.6, z: 156 },
      groundY: 10,
      isGrounded: true,
    })
    expect(cruise.active).toBe(true)
    expect(cruise.offset.y).toBeGreaterThan(BOEING_747_RIDE.maxAltitude - 1)
    expect(Math.abs(cruise.offset.z)).toBeGreaterThan(20)

    const landed = ride.update({
      delta: 5,
      position: { x: 166, y: 11.6, z: 156 },
      groundY: 10,
      isGrounded: true,
    })
    expect(landed.ended).toBe(true)
    expect(landed.offset).toEqual({ x: 0, y: 0, z: 0 })
    expect(landed.deltaOffset.x).toBeCloseTo(-cruise.offset.x)
    expect(landed.deltaOffset.y).toBeCloseTo(-cruise.offset.y)
    expect(landed.deltaOffset.z).toBeCloseTo(-cruise.offset.z)
  })

  it('does not immediately restart after landing until the player leaves the aircraft', () => {
    const ride = createAircraftRideController({ ...BOEING_747_RIDE, duration: 1 })
    const onBoard = {
      position: { x: 166, y: 11.6, z: 156 },
      groundY: 10,
      isGrounded: true,
    }

    expect(ride.update({ ...onBoard, delta: 0 }).started).toBe(true)
    expect(ride.update({ ...onBoard, delta: 1 }).ended).toBe(true)
    expect(ride.update({ ...onBoard, delta: 0.1 }).started).toBe(false)

    ride.update({
      delta: 0.1,
      position: { x: 40, y: 2.6, z: 40 },
      groundY: 1,
      isGrounded: true,
    })
    expect(ride.update({ ...onBoard, delta: 0 }).started).toBe(true)
  })

  it('uses a closed flight path with the same takeoff and landing offset', () => {
    expect(getAircraftFlightOffset(0)).toEqual({ x: 0, y: 0, z: 0 })
    expect(getAircraftFlightOffset(1)).toEqual({ x: 0, y: 0, z: 0 })
    expect(getAircraftFlightOffset(0.25).y).toBeGreaterThan(0)
    expect(getAircraftFlightOffset(0.5).z).toBeGreaterThan(0)
  })
})
