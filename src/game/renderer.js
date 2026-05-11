import * as THREE from 'three'
import { generateWorld, makeBlockMesh, BlockType } from './world.js'
import { buildColMap, getGroundY as _getGroundY } from './physics.js'

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

const isSolid = (b) => b.type !== BlockType.WATER && b.type !== BlockType.AIR

export function createWorldManager(scene, initialBlocks) {
  const meshMap = new Map()
  let colMap = buildColMap(initialBlocks.filter(isSolid))

  for (const block of initialBlocks) {
    const mesh = makeBlockMesh(block)
    meshMap.set(posKey(block), mesh)
    scene.add(mesh)
  }

  function colKey(b) { return `${b.x},${b.z}` }

  function rebuildColumn(bx, bz) {
    let max = -Infinity
    for (const [, mesh] of meshMap) {
      const b = mesh.userData.block
      if (b.x === bx && b.z === bz && isSolid(b)) max = Math.max(max, b.y)
    }
    const k = `${bx},${bz}`
    if (max === -Infinity) colMap.delete(k)
    else colMap.set(k, max)
  }

  return {
    getMeshes() { return [...meshMap.values()] },

    getGroundY(px, pz) { return _getGroundY(px, pz, colMap) },

    addBlock(block) {
      const k = posKey(block)
      if (meshMap.has(k)) return
      const mesh = makeBlockMesh(block)
      meshMap.set(k, mesh)
      scene.add(mesh)
      if (isSolid(block)) {
        const cur = colMap.get(colKey(block)) ?? -Infinity
        if (block.y > cur) colMap.set(colKey(block), block.y)
      }
    },

    removeBlock(pos) {
      const k = posKey(pos)
      const mesh = meshMap.get(k)
      if (!mesh) return
      scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
      meshMap.delete(k)
      if (isSolid(pos)) rebuildColumn(pos.x, pos.z)
    },
  }
}

function posKey(b) { return `${b.x},${b.y},${b.z}` }
