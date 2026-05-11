import { vi } from 'vitest'

// Minimal Three.js mock so unit tests don't need a GPU
vi.mock('three', async () => {
  const Color = vi.fn(function (c) { this.c = c })
  const Fog = vi.fn(function () {})
  const AmbientLight = vi.fn(function () { this.position = { set: vi.fn() } })
  const DirectionalLight = vi.fn(function () { this.position = { set: vi.fn() } })
  const BoxGeometry = vi.fn(function () {})
  const MeshLambertMaterial = vi.fn(function () {})

  const Mesh = vi.fn(function () {
    this.position = { set: vi.fn() }
    this.userData = {}
  })

  const Scene = vi.fn(function () {
    this.add = vi.fn()
    this.background = null
    this.fog = null
  })

  const PerspectiveCamera = vi.fn(function () {
    this.position = { set: vi.fn(), x: 0, y: 0, z: 0 }
    this.rotation = { order: '', x: 0, y: 0, z: 0 }
    this.aspect = 1
    this.updateProjectionMatrix = vi.fn()
  })

  const WebGLRenderer = vi.fn(function () {
    this.setPixelRatio = vi.fn()
    this.setSize = vi.fn()
    this.render = vi.fn()
    this.dispose = vi.fn()
    this.shadowMap = { enabled: false }
  })

  return {
    Color,
    Fog,
    AmbientLight,
    DirectionalLight,
    BoxGeometry,
    MeshLambertMaterial,
    Mesh,
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
  }
})
