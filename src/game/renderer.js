import * as THREE from 'three'
import { generateWorld, BlockType, BLOCK_COLORS, BLOCK_SIZE } from './world.js'
import { buildColMap, getGroundY as _getGroundY } from './physics.js'

const _dummy = new THREE.Object3D()
const EXTRA_CAP = 256
const MATERIAL_TEXTURE_SIZE = 32
const SKY_STAR_COUNT = 144

export const BLOCK_MATERIAL_PROFILES = {
  [BlockType.GRASS]: {
    name: 'grass',
    color: 0x4caf50,
    pattern: 'grass',
    roughness: 0.96,
    roughnessVariance: 0.03,
    bumpScale: 0.018,
  },
  [BlockType.DIRT]: {
    name: 'dirt',
    color: 0x7a5136,
    pattern: 'dirt',
    roughness: 1,
    roughnessVariance: 0.02,
    bumpScale: 0.04,
  },
  [BlockType.STONE]: {
    name: 'stone',
    color: 0x8f9494,
    pattern: 'stone',
    roughness: 0.9,
    roughnessVariance: 0.06,
    bumpScale: 0.03,
  },
  [BlockType.SAND]: {
    name: 'sand',
    color: 0xe6cc84,
    pattern: 'sand',
    roughness: 1,
    roughnessVariance: 0.015,
    bumpScale: 0.015,
  },
  [BlockType.WATER]: {
    name: 'water',
    color: 0x2f9eea,
    pattern: 'water',
    roughness: 0.08,
    roughnessVariance: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    bumpScale: 0.012,
  },
  [BlockType.WOOD]: {
    name: 'wood',
    color: 0x7b4f2a,
    pattern: 'wood',
    roughness: 0.74,
    roughnessVariance: 0.08,
    bumpScale: 0.035,
  },
  [BlockType.LEAVES]: {
    name: 'leaves',
    color: 0x2f7d35,
    pattern: 'leaves',
    roughness: 0.86,
    roughnessVariance: 0.05,
    bumpScale: 0.02,
  },
  [BlockType.STONE_BRICK]: {
    name: 'stone brick',
    color: 0x798890,
    pattern: 'brick',
    roughness: 0.84,
    roughnessVariance: 0.05,
    bumpScale: 0.035,
  },
  [BlockType.CONCRETE]: {
    name: 'concrete',
    color: 0xb7b7b0,
    pattern: 'concrete',
    roughness: 0.93,
    roughnessVariance: 0.025,
    bumpScale: 0.015,
  },
  [BlockType.GRAVEL]: {
    name: 'gravel',
    color: 0x6f7070,
    pattern: 'gravel',
    roughness: 0.98,
    roughnessVariance: 0.02,
    bumpScale: 0.045,
  },
  [BlockType.NUKE]: {
    name: 'nuke casing',
    color: 0x0d2b0d,
    pattern: 'nuke',
    roughness: 0.34,
    roughnessVariance: 0.08,
    metalness: 0.12,
    emissive: 0x00ff44,
    emissiveIntensity: 0.7,
    bumpScale: 0.012,
  },
}

function fract(n) {
  return n - Math.floor(n)
}

function rand2(x, y, salt = 0) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + salt * 74.9) * 43758.5453)
}

function hexToRgb(hex) {
  return {
    r: (hex >> 16) & 255,
    g: (hex >> 8) & 255,
    b: hex & 255,
  }
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function shade(rgb, amount) {
  return {
    r: clampByte(rgb.r * amount),
    g: clampByte(rgb.g * amount),
    b: clampByte(rgb.b * amount),
  }
}

function mix(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

function sampleSurface(profile, x, y) {
  const base = hexToRgb(profile.color)
  const grain = rand2(x, y, profile.color)
  const soft = rand2(Math.floor(x / 4), Math.floor(y / 4), profile.color + 17)
  let color = shade(base, 0.82 + grain * 0.32)
  let height = grain

  if (profile.pattern === 'grass') {
    const blade = rand2(x, y * 3, 4)
    color = mix(shade(base, 0.72), hexToRgb(0x72c55b), blade)
    if (grain > 0.72) color = mix(color, hexToRgb(0xd8c07b), 0.28)
    height = blade
  } else if (profile.pattern === 'dirt') {
    color = mix(hexToRgb(0x4f3428), hexToRgb(0xa06a43), grain)
    if (soft > 0.78) color = mix(color, hexToRgb(0x3a261d), 0.35)
  } else if (profile.pattern === 'stone') {
    color = mix(hexToRgb(0x5f6668), hexToRgb(0xb7bbbb), soft * 0.75 + grain * 0.25)
    if (rand2(x, y, 91) > 0.88) color = mix(color, hexToRgb(0xe0e0dc), 0.32)
  } else if (profile.pattern === 'sand') {
    color = mix(hexToRgb(0xd8bd72), hexToRgb(0xf3dfa4), grain)
    if (rand2(x, y, 44) > 0.84) color = mix(color, hexToRgb(0x9f8652), 0.22)
  } else if (profile.pattern === 'water') {
    const wave = 0.5 + 0.5 * Math.sin((x + y * 0.55) * 0.75)
    color = mix(hexToRgb(0x1268b3), hexToRgb(0x74d2ff), wave * 0.42 + grain * 0.22)
    height = wave
  } else if (profile.pattern === 'wood') {
    const ring = 0.5 + 0.5 * Math.sin((x + soft * 10) * 0.8)
    color = mix(hexToRgb(0x4f2d18), hexToRgb(0xb2763e), ring * 0.7 + grain * 0.3)
    if (y % 7 === 0) color = mix(color, hexToRgb(0x2f1b0f), 0.25)
    height = ring
  } else if (profile.pattern === 'leaves') {
    color = mix(hexToRgb(0x1d5427), hexToRgb(0x5aa944), grain)
    if (rand2(x * 2, y, 73) > 0.82) color = mix(color, hexToRgb(0xb7d46a), 0.25)
  } else if (profile.pattern === 'brick') {
    const rowOffset = Math.floor(y / 8) % 2 === 0 ? 0 : 4
    const mortar = ((x + rowOffset) % 8 === 0) || (y % 8 === 0)
    color = mortar
      ? hexToRgb(0x9aa3a7)
      : mix(hexToRgb(0x5d6a70), hexToRgb(0x9ba8ae), grain)
    height = mortar ? 0.16 : 0.62 + grain * 0.38
  } else if (profile.pattern === 'concrete') {
    color = mix(hexToRgb(0x969895), hexToRgb(0xd1d1ca), grain * 0.55 + soft * 0.25)
  } else if (profile.pattern === 'gravel') {
    const pebble = rand2(Math.floor(x / 3), Math.floor(y / 3), 102)
    color = mix(hexToRgb(0x434546), hexToRgb(0xa2a4a4), pebble * 0.75 + grain * 0.25)
    height = pebble
  } else if (profile.pattern === 'nuke') {
    const stripe = x % 11 === 0 || y % 11 === 0
    color = stripe
      ? mix(hexToRgb(0x0d2b0d), hexToRgb(0x32e66a), 0.42 + grain * 0.25)
      : mix(hexToRgb(0x061206), hexToRgb(0x1d3f1d), grain)
    height = stripe ? 0.75 : grain * 0.3
  }

  const roughness = Math.max(
    0,
    Math.min(1, profile.roughness + (grain - 0.5) * (profile.roughnessVariance ?? 0)),
  )

  return { color, height, roughness }
}

function createSurfaceTexture(profile, channel) {
  const size = MATERIAL_TEXTURE_SIZE
  const data = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const sample = sampleSurface(profile, x, y)
      if (channel === 'roughness') {
        const v = clampByte(sample.roughness * 255)
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
      } else if (channel === 'height') {
        const v = clampByte(sample.height * 255)
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
      } else {
        data[i] = clampByte(sample.color.r)
        data[i + 1] = clampByte(sample.color.g)
        data[i + 2] = clampByte(sample.color.b)
      }
      data[i + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.needsUpdate = true
  if (channel === 'color') texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createBlockMaterial(type) {
  const profile = BLOCK_MATERIAL_PROFILES[type] ?? {
    name: 'unknown',
    color: BLOCK_COLORS[type] ?? 0xffffff,
    pattern: 'stone',
    roughness: 0.9,
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createSurfaceTexture(profile, 'color'),
    roughnessMap: createSurfaceTexture(profile, 'roughness'),
    bumpMap: createSurfaceTexture(profile, 'height'),
    bumpScale: profile.bumpScale ?? 0.02,
    roughness: profile.roughness,
    metalness: profile.metalness ?? 0,
    transparent: profile.transparent ?? false,
    opacity: profile.opacity ?? 1,
    depthWrite: profile.depthWrite ?? true,
    emissive: profile.emissive ?? 0x000000,
    emissiveIntensity: profile.emissiveIntensity ?? 0,
  })
  material.name = `${profile.name}-material`
  material.userData.profile = profile.name
  return material
}

function disposeMaterial(material) {
  material.map?.dispose()
  material.roughnessMap?.dispose()
  material.bumpMap?.dispose()
  material.dispose()
}

export function createSkyEnvironment(scene) {
  scene.background = new THREE.Color(0x78bde9)
  scene.fog = new THREE.Fog(0x78bde9, 32, 96)

  const ambient = new THREE.HemisphereLight(0xdaf4ff, 0x5d4a38, 0.75)
  ambient.name = 'sky-ambient'
  scene.add(ambient)

  const sunLight = new THREE.DirectionalLight(0xfff1c0, 1.15)
  sunLight.name = 'sun-light'
  sunLight.position.set(36, 52, -28)
  sunLight.castShadow = true
  scene.add(sunLight)

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 24, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd36a }),
  )
  sunDisc.name = 'sun-disc'
  sunDisc.position.set(48, 70, -38)
  scene.add(sunDisc)

  const cloudGeometry = new THREE.BoxGeometry(1, 1, 1)
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xf7fbff,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  })
  const clouds = new THREE.Group()
  clouds.name = 'clouds'
  const cloudSpecs = [
    [-18, 24, -10, 1.2],
    [6, 27, -24, 1.45],
    [28, 25, 6, 1.15],
    [-34, 29, 22, 1.35],
    [42, 31, -18, 1.3],
  ]
  for (const [cx, cy, cz, scale] of cloudSpecs) {
    const cluster = new THREE.Group()
    cluster.position.set(cx, cy, cz)
    const parts = [
      [0, 0, 0, 5.5, 1.35, 2.6],
      [2.4, 0.35, 0.2, 3.8, 1.6, 2.2],
      [-2.2, 0.2, -0.1, 3.2, 1.35, 2.0],
      [0.3, 0.7, 0.5, 3.4, 1.7, 2.4],
    ]
    for (const [x, y, z, sx, sy, sz] of parts) {
      const puff = new THREE.Mesh(cloudGeometry, cloudMaterial)
      puff.position.set(x * scale, y * scale, z * scale)
      puff.scale.set(sx * scale, sy * scale, sz * scale)
      cluster.add(puff)
    }
    clouds.add(cluster)
  }
  scene.add(clouds)

  const starPositions = new Float32Array(SKY_STAR_COUNT * 3)
  for (let i = 0; i < SKY_STAR_COUNT; i++) {
    const theta = i * 2.399963229728653
    const altitude = 0.2 + rand2(i, 9, 201) * 0.76
    const radius = 88
    const y = radius * altitude
    const ring = Math.sqrt(radius * radius - y * y)
    starPositions[i * 3] = Math.cos(theta) * ring
    starPositions[i * 3 + 1] = y
    starPositions[i * 3 + 2] = Math.sin(theta) * ring
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  const starMaterial = new THREE.PointsMaterial({
    color: 0xf6fbff,
    size: 0.32,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  })
  const stars = new THREE.Points(starGeometry, starMaterial)
  stars.name = 'stars'
  scene.add(stars)

  return {
    update(time) {
      clouds.position.x = ((time * 0.35) % 24) - 12
      clouds.position.z = Math.sin(time * 0.06) * 2
      stars.rotation.y = time * 0.006
    },
    dispose() {
      sunDisc.geometry.dispose()
      sunDisc.material.dispose()
      cloudGeometry.dispose()
      cloudMaterial.dispose()
      starGeometry.dispose()
      starMaterial.dispose()
    },
  }
}

function makeInstMesh(type, maxCount) {
  const geo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
  const mat = createBlockMaterial(type)
  const mesh = new THREE.InstancedMesh(geo, mat, maxCount)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
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

  const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 100)
  camera.position.set(16, 12, 16)
  camera.rotation.order = 'YXZ'

  const skyEnvironment = createSkyEnvironment(scene)
  const worldManager = createWorldManager(scene, generateWorld())

  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  return { renderer, scene, camera, resize, worldManager, skyEnvironment }
}

export function createRemotePlayerManager(scene) {
  const players = new Map()

  function createAvatar(pubkey) {
    const color = colorFromPubkey(pubkey)
    const group = new THREE.Group()
    group.name = `remote-player-${pubkey.slice(0, 8)}`

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.9, 0.32),
      new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.05 }),
    )
    body.position.y = -0.55
    body.castShadow = true
    group.add(body)

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xf0d0a8, roughness: 0.9 }),
    )
    head.position.y = 0.05
    head.castShadow = true
    group.add(head)

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.08, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x111111 }),
    )
    visor.position.set(0, 0.08, -0.2)
    group.add(visor)

    const name = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.05, 0.05),
      new THREE.MeshBasicMaterial({ color }),
    )
    name.position.y = 0.45
    group.add(name)

    return group
  }

  function removeAvatar(pubkey) {
    const avatar = players.get(pubkey)
    if (!avatar) return
    scene.remove(avatar)
    disposeObject(avatar)
    players.delete(pubkey)
  }

  return {
    setPlayers(remotePlayers) {
      const active = new Set()
      for (const player of remotePlayers) {
        active.add(player.pubkey)
        let avatar = players.get(player.pubkey)
        if (!avatar) {
          avatar = createAvatar(player.pubkey)
          players.set(player.pubkey, avatar)
          scene.add(avatar)
        }
        avatar.position.set(player.x, player.y - 0.35, player.z)
        avatar.rotation.y = player.yaw ?? 0
        avatar.userData.player = player
      }

      for (const pubkey of players.keys()) {
        if (!active.has(pubkey)) removeAvatar(pubkey)
      }
    },

    dispose() {
      for (const pubkey of [...players.keys()]) removeAvatar(pubkey)
    },
  }
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
    disposeMaterial(old.material)
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
      const type = hit.object.userData?.type
      if (type === undefined) return null
      const arr = blockArrays.get(type)
      return arr ? { ...arr[hit.instanceId] } : null
    },

    loadBlocks(newBlocks) {
      for (const mesh of instMeshes.values()) {
        scene.remove(mesh)
        mesh.geometry.dispose()
        disposeMaterial(mesh.material)
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

function colorFromPubkey(pubkey) {
  const seed = parseInt(pubkey.slice(0, 6), 16) || 0x00ff44
  const hue = seed % 360
  const color = new THREE.Color()
  color.setHSL(hue / 360, 0.62, 0.52)
  return color
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.()
    if (Array.isArray(child.material)) {
      for (const material of child.material) material.dispose?.()
    } else {
      child.material?.dispose?.()
    }
  })
}
