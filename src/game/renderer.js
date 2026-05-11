import * as THREE from 'three'
import { generateWorld, BlockType, BLOCK_COLORS, BLOCK_SIZE } from './world.js'
import { buildColMap, getGroundY as _getGroundY } from './physics.js'

const _dummy = new THREE.Object3D()
const EXTRA_CAP = 256

function makeInstMesh(type, maxCount) {
  const geo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
  const mat = new THREE.MeshLambertMaterial({
    color: BLOCK_COLORS[type] ?? 0xffffff,
    ...(type === BlockType.WATER ? { transparent: true, opacity: 0.65 } : {}),
    ...(type === BlockType.NUKE  ? { emissive: 0x00ff44, emissiveIntensity: 0.7 } : {}),
  })
  const mesh = new THREE.InstancedMesh(geo, mat, maxCount)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.count = 0
  mesh.userData.type = type
  mesh.userData.maxCount = maxCount
  return mesh
}

function setInstPos(mesh, i, x, y, z) {
  _dummy.position.set(x, y, z)
  _dummy.updateMatrix()
  mesh.setMatrixAt(i, _dummy.matrix)
}

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
  const instMeshes = new Map()   // type → InstancedMesh
  const blockArrays = new Map()  // type → Array<block>
  const indexMap = new Map()     // posKey → {type, idx}
  let colMap = buildColMap(initialBlocks.filter(isSolid))

  function _initType(type, blocks) {
    const maxCount = blocks.length + EXTRA_CAP
    const mesh = makeInstMesh(type, maxCount)
    const arr = [...blocks]
    for (let i = 0; i < arr.length; i++) {
      setInstPos(mesh, i, arr[i].x, arr[i].y, arr[i].z)
      indexMap.set(posKey(arr[i]), { type, idx: i })
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.count = arr.length
    instMeshes.set(type, mesh)
    blockArrays.set(type, arr)
    scene.add(mesh)
  }

  const byType = new Map()
  for (const b of initialBlocks) {
    if (!byType.has(b.type)) byType.set(b.type, [])
    byType.get(b.type).push(b)
  }
  for (const [type, blocks] of byType) _initType(type, blocks)

  function _ensureType(type) {
    if (!instMeshes.has(type)) {
      const mesh = makeInstMesh(type, EXTRA_CAP)
      instMeshes.set(type, mesh)
      blockArrays.set(type, [])
      scene.add(mesh)
    }
  }

  function _growMesh(type) {
    const old = instMeshes.get(type)
    const newMax = old.userData.maxCount * 2
    const grown = makeInstMesh(type, newMax)
    grown.count = old.count
    grown.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, old.count * 16))
    grown.instanceMatrix.needsUpdate = true
    scene.remove(old)
    old.geometry.dispose()
    old.material.dispose()
    instMeshes.set(type, grown)
    scene.add(grown)
  }

  function colKey(b) { return `${b.x},${b.z}` }

  function rebuildColumn(bx, bz) {
    let max = -Infinity
    for (const [type, arr] of blockArrays) {
      if (type === BlockType.WATER) continue
      for (const b of arr) {
        if (b.x === bx && b.z === bz) max = Math.max(max, b.y)
      }
    }
    const k = `${bx},${bz}`
    if (max === -Infinity) colMap.delete(k)
    else colMap.set(k, max)
  }

  return {
    getMeshes() { return [...instMeshes.values()] },

    getBlocks() {
      const result = []
      for (const arr of blockArrays.values()) result.push(...arr)
      return result
    },

    getBlockFromHit(hit) {
      const type = hit.object.userData.type
      if (type === undefined) return null
      const arr = blockArrays.get(type)
      return arr ? { ...arr[hit.instanceId] } : null
    },

    loadBlocks(newBlocks) {
      for (const mesh of instMeshes.values()) {
        scene.remove(mesh)
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      instMeshes.clear()
      blockArrays.clear()
      indexMap.clear()
      colMap = buildColMap(newBlocks.filter(isSolid))
      const bt = new Map()
      for (const b of newBlocks) {
        if (!bt.has(b.type)) bt.set(b.type, [])
        bt.get(b.type).push(b)
      }
      for (const [type, blocks] of bt) _initType(type, blocks)
    },

    getGroundY(px, pz) { return _getGroundY(px, pz, colMap) },

    hasNukeAt(x, y, z) {
      const entry = indexMap.get(posKey({ x, y, z }))
      return entry?.type === BlockType.NUKE
    },

    animateNukeBlocks(time) {
      const mesh = instMeshes.get(BlockType.NUKE)
      if (!mesh || mesh.count === 0) return
      const pulse = 0.5 + 0.5 * Math.sin(time * 3)
      mesh.material.emissiveIntensity = 0.3 + pulse * 0.7
    },

    addBlock(block) {
      const k = posKey(block)
      if (indexMap.has(k)) return
      _ensureType(block.type)
      const arr = blockArrays.get(block.type)
      if (arr.length >= instMeshes.get(block.type).userData.maxCount) _growMesh(block.type)
      const mesh = instMeshes.get(block.type)
      const idx = arr.length
      arr.push(block)
      indexMap.set(k, { type: block.type, idx })
      setInstPos(mesh, idx, block.x, block.y, block.z)
      mesh.instanceMatrix.needsUpdate = true
      mesh.count = arr.length
      if (isSolid(block)) {
        const cur = colMap.get(colKey(block)) ?? -Infinity
        if (block.y > cur) colMap.set(colKey(block), block.y)
      }
    },

    removeBlock(pos) {
      const k = posKey(pos)
      const entry = indexMap.get(k)
      if (!entry) return
      const { type, idx } = entry
      const arr = blockArrays.get(type)
      const mesh = instMeshes.get(type)
      const lastIdx = arr.length - 1
      if (idx !== lastIdx) {
        const lastBlock = arr[lastIdx]
        arr[idx] = lastBlock
        indexMap.set(posKey(lastBlock), { type, idx })
        setInstPos(mesh, idx, lastBlock.x, lastBlock.y, lastBlock.z)
      }
      arr.pop()
      indexMap.delete(k)
      mesh.count = arr.length
      mesh.instanceMatrix.needsUpdate = true
      if (isSolid(pos)) rebuildColumn(pos.x, pos.z)
    },
  }
}

function posKey(b) { return `${b.x},${b.y},${b.z}` }
