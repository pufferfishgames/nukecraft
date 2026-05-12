// @vitest-environment node
import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import {
  BLOCK_MATERIAL_PROFILES,
  createBlockMaterial,
  createSkyEnvironment,
} from '../game/renderer.js'
import { BlockType } from '../game/world.js'

const blockTypes = Object.values(BlockType).filter((type) => type !== BlockType.AIR)

function disposeMaterial(material) {
  material.map?.dispose()
  material.bumpMap?.dispose()
  material.roughnessMap?.dispose()
  material.dispose()
}

describe('block material realism', () => {
  it('gives every visible block type a textured standard material profile', () => {
    for (const type of blockTypes) {
      expect(BLOCK_MATERIAL_PROFILES[type]).toBeDefined()

      const material = createBlockMaterial(type)
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
      expect(material.map?.isDataTexture).toBe(true)
      expect(material.roughnessMap?.isDataTexture).toBe(true)
      expect(material.metalness).toBeGreaterThanOrEqual(0)
      expect(material.roughness).toBeGreaterThanOrEqual(0)
      expect(material.roughness).toBeLessThanOrEqual(1)

      disposeMaterial(material)
    }
  })

  it('uses matte or glossy surface settings that match the material family', () => {
    const sand = createBlockMaterial(BlockType.SAND)
    const stone = createBlockMaterial(BlockType.STONE)
    const wood = createBlockMaterial(BlockType.WOOD)
    const water = createBlockMaterial(BlockType.WATER)
    const nuke = createBlockMaterial(BlockType.NUKE)

    expect(sand.roughness).toBeGreaterThanOrEqual(0.9)
    expect(stone.roughness).toBeGreaterThanOrEqual(0.8)
    expect(wood.roughness).toBeGreaterThanOrEqual(0.65)
    expect(water.transparent).toBe(true)
    expect(water.opacity).toBeLessThan(1)
    expect(water.roughness).toBeLessThan(stone.roughness)
    expect(water.roughness).toBeLessThan(0.25)
    expect(nuke.emissiveIntensity).toBeGreaterThan(0)

    for (const material of [sand, stone, wood, water, nuke]) disposeMaterial(material)
  })
})

describe('sky environment', () => {
  it('adds a visible sun, cloud layer, and star field to the scene', () => {
    const scene = new THREE.Scene()

    createSkyEnvironment(scene)

    const sunLight = scene.getObjectByName('sun-light')
    const sunDisc = scene.getObjectByName('sun-disc')
    const clouds = scene.getObjectByName('clouds')
    const stars = scene.getObjectByName('stars')

    expect(sunLight).toBeInstanceOf(THREE.DirectionalLight)
    expect(sunDisc).toBeInstanceOf(THREE.Mesh)
    expect(clouds).toBeInstanceOf(THREE.Group)
    expect(clouds.children.length).toBeGreaterThan(0)
    expect(stars).toBeInstanceOf(THREE.Points)
    expect(stars.geometry.getAttribute('position').count).toBeGreaterThanOrEqual(96)
  })

  it('animates sky details without moving the sun anchor', () => {
    const scene = new THREE.Scene()
    const sky = createSkyEnvironment(scene)
    const sunDisc = scene.getObjectByName('sun-disc')
    const clouds = scene.getObjectByName('clouds')
    const initialSun = sunDisc.position.clone()

    sky.update(12)

    expect(clouds.position.x).not.toBe(0)
    expect(sunDisc.position.equals(initialSun)).toBe(true)
  })
})
