// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { JUMP_VELOCITY, PLAYER_EYE_HEIGHT } from '../game/physics.js'
import { stepPlayerMotion } from '../game/player.js'

describe('stepPlayerMotion moving platform support', () => {
  it('applies platform carry and regular walking in the same frame', () => {
    const platformGroundY = 12
    const result = stepPlayerMotion({
      position: { x: 10, y: 10 + PLAYER_EYE_HEIGHT, z: 10 },
      velocityY: 0,
      isGrounded: true,
      isGroundedOnPlatform: true,
      platformDelta: { x: 5, y: 2, z: 0 },
      move: { x: 1, z: -0.5 },
      delta: 0.1,
      getStaticGroundY: () => -Infinity,
      getPlatformGroundY: () => platformGroundY,
    })

    expect(result.position.x).toBeCloseTo(16)
    expect(result.position.z).toBeCloseTo(9.5)
    expect(result.position.y).toBeCloseTo(platformGroundY + PLAYER_EYE_HEIGHT)
    expect(result.isGrounded).toBe(true)
    expect(result.isGroundedOnPlatform).toBe(true)
  })

  it('jumps from a moving platform into ordinary airborne physics', () => {
    const platformGroundY = 10
    const result = stepPlayerMotion({
      position: { x: 10, y: platformGroundY + PLAYER_EYE_HEIGHT, z: 10 },
      velocityY: 0,
      isGrounded: true,
      isGroundedOnPlatform: true,
      platformDelta: { x: 0, y: 0, z: 0 },
      move: { x: 0, z: 0 },
      delta: 0.1,
      wantsJump: true,
      getStaticGroundY: () => -Infinity,
      getPlatformGroundY: () => platformGroundY,
    })

    expect(result.velocityY).toBe(JUMP_VELOCITY)
    expect(result.position.y).toBeGreaterThan(platformGroundY + PLAYER_EYE_HEIGHT)
    expect(result.isGrounded).toBe(false)
    expect(result.isGroundedOnPlatform).toBe(false)
  })

  it('does not keep carrying the player after leaving the platform', () => {
    const result = stepPlayerMotion({
      position: { x: 10, y: 20, z: 10 },
      velocityY: 0,
      isGrounded: false,
      isGroundedOnPlatform: false,
      platformDelta: { x: 5, y: 0, z: 0 },
      move: { x: 0, z: 0 },
      delta: 0.1,
      getStaticGroundY: () => -Infinity,
      getPlatformGroundY: () => -Infinity,
    })

    expect(result.position.x).toBeCloseTo(10)
    expect(result.isGroundedOnPlatform).toBe(false)
  })
})
