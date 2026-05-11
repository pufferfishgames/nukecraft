import * as THREE from 'three'
import { generateWorld, makeBlockMesh, BlockType } from './world.js'

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb)
  scene.fog = new THREE.Fog(0x87ceeb, 30, 80)

  const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 100)
  camera.position.set(16, 12, 16)
  camera.rotation.order = 'YXZ'

  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(0xffffff, 0.8)
  sun.position.set(20, 40, 20)
  scene.add(sun)

  const worldManager = createWorldManager(scene, generateWorld())

  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  return { renderer, scene, camera, resize, worldManager }
}

export function createWorldManager(scene, initialBlocks) {
  const meshMap = new Map()

  for (const block of initialBlocks) {
    const mesh = makeBlockMesh(block)
    meshMap.set(posKey(block), mesh)
    scene.add(mesh)
  }

  return {
    getMeshes() { return [...meshMap.values()] },

    addBlock(block) {
      const k = posKey(block)
      if (meshMap.has(k)) return
      const mesh = makeBlockMesh(block)
      meshMap.set(k, mesh)
      scene.add(mesh)
    },

    removeBlock(pos) {
      const k = posKey(pos)
      const mesh = meshMap.get(k)
      if (!mesh) return
      scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
      meshMap.delete(k)
    },
  }
}

function posKey(b) { return `${b.x},${b.y},${b.z}` }
