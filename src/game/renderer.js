import * as THREE from 'three'
import { generateTerrain, buildChunkMesh } from './world.js'

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb)
  scene.fog = new THREE.Fog(0x87ceeb, 20, 60)

  const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 100)
  camera.position.set(8, 6, 8)
  camera.rotation.order = 'YXZ'

  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)

  const sun = new THREE.DirectionalLight(0xffffff, 0.8)
  sun.position.set(10, 20, 10)
  scene.add(sun)

  const blocks = generateTerrain(0, 0)
  const meshes = buildChunkMesh(blocks)
  meshes.forEach((m) => scene.add(m))

  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  return { renderer, scene, camera, resize }
}
