#!/usr/bin/env node
// Generates a Machu Picchu adventure map and publishes it to Nostr.
// Run: node scripts/generate-machu-picchu-map.js
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BlockType } from '../src/game/world.js'
import { passphraseToPrivkey, privkeyToPubkey } from '../src/nostr/identity.js'
import { createMapEvent, signEvent } from '../src/nostr/events.js'
import { mineEvent, MIN_POW_DIFFICULTY, meetsPoW, countLeadingZeroBits } from '../src/nostr/pow.js'
import { buildPublishMessage, parseRelayMessage } from '../src/nostr/relay.js'
import { encodeBlocks } from '../src/nostr/codec.js'

export const PASSPHRASE = 'machu-picchu'
export const MAP_FILE = 'maps/machu-picchu-adventure.json'
export const RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
]

export const FEATURE_AREAS = {
  machuPicchu: { x0: 28, x1: 152, z0: 30, z1: 126 },
  river: { x0: 0, x1: 420, z0: 126, z1: 198 },
  village: { x0: 14, x1: 98, z0: 226, z1: 334 },
  lake: { x0: 78, x1: 184, z0: 246, z1: 338 },
  bigCity: { x0: 258, x1: 414, z0: 18, z1: 148 },
  goldMine: { x0: 204, x1: 266, z0: 220, z1: 294 },
  nukeMine: { x0: 296, x1: 366, z0: 226, z1: 304 },
  forest: { x0: 158, x1: 250, z0: 22, z1: 138 },
  labyrinth: { x0: 164, x1: 252, z0: 248, z1: 342 },
}

const WORLD_MAX_X = 420
const WORLD_MAX_Z = 360
const B = BlockType

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')

function rand(x, z, salt = 0) {
  let n = Math.imul(x + 1013 + salt * 17, 374761393)
  n ^= Math.imul(z + 6689 + salt * 31, 668265263)
  n = (n ^ (n >>> 13)) >>> 0
  return ((n * 1274126177) >>> 0) / 0xffffffff
}

function riverCenter(x) {
  return Math.round(162 + Math.sin(x / 31) * 18 + Math.sin(x / 13) * 5)
}

function ellipse(x, z, cx, cz, rx, rz) {
  const nx = (x - cx) / rx
  const nz = (z - cz) / rz
  return nx * nx + nz * nz
}

function makeBuilder() {
  const byKey = new Map()

  function set(x, y, z, type) {
    if (x < 0 || y < 0 || z < 0) return
    if (x > 65_535 || y > 255 || z > 65_535) return
    const block = { x: Math.round(x), y: Math.round(y), z: Math.round(z), type }
    byKey.set(`${block.x},${block.y},${block.z}`, block)
  }

  function fillBox(x0, x1, y0, y1, z0, z1, type) {
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) set(x, y, z, type)
      }
    }
  }

  function fillWall(x0, x1, y0, y1, z0, z1, type) {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue
        for (let y = y0; y <= y1; y++) set(x, y, z, type)
      }
    }
  }

  return { set, fillBox, fillWall, blocks: () => Array.from(byKey.values()) }
}

function addTerrain(builder) {
  const { set } = builder
  for (let x = 0; x <= WORLD_MAX_X; x++) {
    for (let z = 0; z <= WORLD_MAX_Z; z++) {
      let type = B.GRASS
      if (z > 215 && x < 210) type = B.GRASS
      if (x > 255 && z < 155) type = B.STONE
      if (x > 195 && z > 210) type = B.STONE
      set(x, 0, z, type)
    }
  }
}

function addRiver(builder) {
  const { set } = builder
  for (let x = 0; x <= WORLD_MAX_X; x++) {
    const cz = riverCenter(x)
    for (let dz = -7; dz <= 7; dz++) {
      const z = cz + dz
      if (z < 0 || z > WORLD_MAX_Z) continue
      if (Math.abs(dz) <= 4) {
        set(x, 0, z, B.GRAVEL)
        set(x, 1, z, B.WATER)
        set(x, 2, z, B.WATER)
      } else {
        set(x, 0, z, B.SAND)
      }
    }
  }
}

function addLake(builder) {
  const { set } = builder
  const cx = 132
  const cz = 292
  for (let x = 70; x <= 190; x++) {
    for (let z = 236; z <= 346; z++) {
      const e = ellipse(x, z, cx, cz, 48, 36)
      if (e <= 1) {
        set(x, 0, z, B.GRAVEL)
        set(x, 1, z, B.WATER)
        set(x, 2, z, B.WATER)
      } else if (e <= 1.24) {
        set(x, 0, z, B.SAND)
      }
    }
  }
}

function addMachuPicchu(builder) {
  const { set, fillBox, fillWall } = builder
  const cx = 90
  const cz = 76

  for (let level = 0; level < 12; level++) {
    const halfX = 58 - level * 4
    const halfZ = 40 - level * 3
    const y0 = 1 + level * 2
    fillBox(cx - halfX, cx + halfX, y0, y0 + 1, cz - halfZ, cz + halfZ, B.GRAVEL)

    for (let x = cx - halfX; x <= cx + halfX; x++) {
      set(x, y0 + 2, cz - halfZ, B.STONE)
      set(x, y0 + 2, cz + halfZ, B.STONE)
    }
    for (let z = cz - halfZ; z <= cz + halfZ; z++) {
      set(cx - halfX, y0 + 2, z, B.STONE)
      set(cx + halfX, y0 + 2, z, B.STONE)
    }
  }

  for (let step = 0; step < 24; step++) {
    const y = 1 + step
    const z = cz - 41 + step * 3
    fillBox(cx - 2, cx + 2, y, y, z, z + 2, B.CONCRETE)
  }

  fillWall(cx - 13, cx + 13, 25, 30, cz - 8, cz + 8, B.STONE)
  fillWall(cx - 33, cx - 18, 21, 25, cz - 17, cz - 6, B.STONE)
  fillWall(cx + 18, cx + 33, 21, 25, cz + 6, cz + 17, B.STONE)
  fillBox(cx - 5, cx + 5, 31, 31, cz - 3, cz + 3, B.CONCRETE)
}

function addVillage(builder) {
  const { set, fillBox, fillWall } = builder

  function house(x, z, w = 8, d = 7) {
    fillBox(x, x + w - 1, 1, 1, z, z + d - 1, B.STONE_BRICK)
    fillWall(x, x + w - 1, 2, 6, z, z + d - 1, B.WOOD)
    fillBox(x - 1, x + w, 7, 7, z - 1, z + d, B.STONE_BRICK)
    fillBox(x + 1, x + w - 2, 8, 8, z, z + d - 1, B.WOOD)
    set(x + Math.floor(w / 2), 2, z, B.CONCRETE)
    set(x + Math.floor(w / 2), 3, z, B.CONCRETE)
  }

  const homes = [
    [22, 238], [40, 238], [61, 241], [78, 250],
    [20, 262], [43, 265], [66, 269], [27, 288],
    [52, 292], [76, 296], [31, 314], [58, 316],
  ]
  for (const [x, z] of homes) house(x, z)

  fillBox(15, 92, 1, 1, 276, 280, B.CONCRETE)
  fillBox(53, 57, 1, 1, 232, 328, B.CONCRETE)
  fillBox(95, 116, 1, 1, 282, 286, B.WOOD)
  fillBox(99, 112, 2, 2, 283, 285, B.WOOD)
}

function addCity(builder) {
  const { set, fillBox, fillWall } = builder
  const area = FEATURE_AREAS.bigCity

  for (let x = area.x0; x <= area.x1; x++) {
    for (let z = area.z0; z <= area.z1; z++) {
      set(x, 0, z, B.STONE)
      set(x, 1, z, B.CONCRETE)
    }
  }

  for (let x = area.x0; x <= area.x1; x += 18) fillBox(x, x + 3, 2, 2, area.z0, area.z1, B.CONCRETE)
  for (let z = area.z0; z <= area.z1; z += 18) fillBox(area.x0, area.x1, 2, 2, z, z + 3, B.CONCRETE)

  function skyscraper(x, z, w, d, h) {
    fillWall(x, x + w - 1, 2, h, z, z + d - 1, B.STONE_BRICK)
    for (let y = 6; y <= h; y += 6) fillBox(x + 1, x + w - 2, y, y, z + 1, z + d - 2, B.CONCRETE)
    fillBox(x, x + w - 1, h + 1, h + 1, z, z + d - 1, B.CONCRETE)
    fillBox(x + 2, x + w - 3, h + 2, h + 3, z + 2, z + d - 3, B.CONCRETE)
  }

  skyscraper(266, 28, 12, 10, 48)
  skyscraper(288, 30, 10, 14, 66)
  skyscraper(318, 26, 14, 12, 58)
  skyscraper(350, 32, 12, 12, 72)
  skyscraper(388, 28, 10, 11, 44)
  skyscraper(270, 76, 11, 11, 54)
  skyscraper(304, 78, 13, 13, 62)
  skyscraper(338, 76, 10, 16, 50)
  skyscraper(376, 78, 14, 10, 60)
  skyscraper(292, 116, 12, 12, 40)
  skyscraper(330, 114, 16, 12, 56)
  skyscraper(372, 112, 12, 13, 46)
}

function addTree(builder, x, z, height = 5) {
  const { set } = builder
  for (let y = 1; y <= height; y++) set(x, y, z, B.WOOD)
  for (let dy = 0; dy <= 4; dy++) {
    const r = dy === 0 || dy === 4 ? 2 : 3
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= r + 2) set(x + dx, height + dy, z + dz, B.LEAVES)
      }
    }
  }
}

function addForest(builder) {
  for (let x = 164; x <= 246; x += 6) {
    for (let z = 28; z <= 134; z += 7) {
      if (rand(x, z, 14) < 0.16) continue
      addTree(builder, x + Math.floor(rand(x, z, 15) * 3), z + Math.floor(rand(x, z, 16) * 3), 5 + Math.floor(rand(x, z, 17) * 3))
    }
  }
}

function addGoldMine(builder) {
  const { set, fillBox } = builder
  const area = FEATURE_AREAS.goldMine

  for (let x = area.x0; x <= area.x1; x++) {
    for (let z = area.z0; z <= area.z1; z++) {
      const e = ellipse(x, z, 235, 257, 31, 36)
      if (e <= 1) {
        const top = 3 + Math.floor((1 - e) * 4)
        for (let y = 1; y <= top; y++) set(x, y, z, B.STONE)
        set(x, top + 1, z, B.GRAVEL)
      }
    }
  }

  fillBox(229, 241, 1, 5, 252, 261, B.STONE)
  fillBox(223, 247, 1, 2, 257, 260, B.GRAVEL)
  for (let i = 0; i < 18; i++) {
    const y = 2 + (i % 7)
    const z = 226 + i * 3
    for (let x = 211 + (i % 5); x <= 224 + (i % 5); x++) set(x, y, z, B.SAND)
  }
  for (let i = 0; i < 12; i++) {
    const x = 235 + (i % 4) * 5
    const z = 235 + Math.floor(i / 4) * 13
    fillBox(x, x, 2, 6, z, z, B.WOOD)
    fillBox(x - 2, x + 2, 6, 6, z, z, B.WOOD)
  }
}

function addNukeMine(builder) {
  const { set, fillBox } = builder
  const area = FEATURE_AREAS.nukeMine

  for (let x = area.x0; x <= area.x1; x++) {
    for (let z = area.z0; z <= area.z1; z++) {
      const e = ellipse(x, z, 331, 266, 35, 39)
      if (e <= 1) {
        const top = 2 + Math.floor((1 - e) * 5)
        for (let y = 1; y <= top; y++) set(x, y, z, y % 2 === 0 ? B.GRAVEL : B.STONE)
      }
    }
  }

  const clusters = [
    [315, 3, 244], [335, 5, 256], [350, 4, 282],
    [323, 7, 291], [305, 2, 276], [358, 6, 238],
  ]
  for (const [cx, cy, cz] of clusters) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 3) set(cx + dx, cy + dy, cz + dz, B.NUKE)
        }
      }
    }
  }
  fillBox(326, 336, 1, 2, 226, 238, B.GRAVEL)
  fillBox(330, 332, 3, 8, 230, 230, B.CONCRETE)
}

const MAZE = [
  '#########################',
  '#S....#.....#.......#...#',
  '#####.#.###.#.#####.#.#.#',
  '#.....#...#.#.....#...#.#',
  '#.#######.#.#####.#####.#',
  '#.#.....#.#.....#.....#.#',
  '#.#.###.#.#####.#####.#.#',
  '#...#...#.....#.....#...#',
  '###.#.#######.#####.###.#',
  '#...#.....#...#...#...#.#',
  '#.#######.#.###.#.###.#.#',
  '#.....#...#.....#.#...#.#',
  '#####.#.#########.#.###.#',
  '#...#.#.....#.....#...#.#',
  '#.#.#.#####.#.#######.#.#',
  '#.#...#.....#...#.....#.#',
  '#.#####.#######.#.#####.#',
  '#.....#.......#.#.....#.#',
  '#####.#######.#.#####.#.#',
  '#.............#.......#E#',
  '#########################',
]

function addLabyrinth(builder) {
  const { set, fillBox } = builder
  const startX = 170
  const startZ = 256
  const scale = 3

  for (let row = 0; row < MAZE.length; row++) {
    for (let col = 0; col < MAZE[row].length; col++) {
      const cell = MAZE[row][col]
      const x0 = startX + col * scale
      const z0 = startZ + row * scale
      if (cell === '#') {
        fillBox(x0, x0 + scale - 1, 1, 4, z0, z0 + scale - 1, B.STONE_BRICK)
      } else {
        fillBox(x0, x0 + scale - 1, 1, 1, z0, z0 + scale - 1, B.CONCRETE)
        if (cell === 'S' || cell === 'E') {
          fillBox(x0, x0 + scale - 1, 2, 2, z0, z0 + scale - 1, B.CONCRETE)
          set(x0 + 1, 3, z0 + 1, cell === 'S' ? B.GRASS : B.NUKE)
        }
      }
    }
  }
}

export function generateMap() {
  const builder = makeBuilder()
  addTerrain(builder)
  addRiver(builder)
  addLake(builder)
  addMachuPicchu(builder)
  addVillage(builder)
  addCity(builder)
  addForest(builder)
  addGoldMine(builder)
  addNukeMine(builder)
  addLabyrinth(builder)
  return builder.blocks()
}

export function publishToRelay(relayUrl, signedEvent) {
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (ok, val) => {
      if (!done) {
        done = true
        ok ? resolve(val) : reject(val)
      }
    }
    const timer = setTimeout(() => finish(false, new Error('relay timeout')), 30_000)
    const ws = new WebSocket(relayUrl)

    ws.onopen = () => ws.send(buildPublishMessage(signedEvent))
    ws.onmessage = (event) => {
      clearTimeout(timer)
      ws.close()
      finish(true, parseRelayMessage(event.data))
    }
    ws.onerror = (event) => {
      clearTimeout(timer)
      finish(false, event instanceof Error ? event : new Error('websocket error'))
    }
    ws.onclose = () => {
      clearTimeout(timer)
      if (!done) finish(false, new Error('relay closed unexpectedly'))
    }
  })
}

export async function buildSignedMapEvent({ passphrase = PASSPHRASE, createdAt = Math.floor(Date.now() / 1000) } = {}) {
  const privkey = passphraseToPrivkey(passphrase)
  const pubkey = privkeyToPubkey(privkey)
  const blocks = generateMap()
  const content = await encodeBlocks(blocks)
  const baseEvent = createMapEvent(pubkey, content)
  const mined = mineEvent({ ...baseEvent, created_at: createdAt }, MIN_POW_DIFFICULTY)
  const signed = signEvent(mined, privkey)
  if (!meetsPoW(signed.id, MIN_POW_DIFFICULTY)) throw new Error('mined event does not meet PoW')
  return { blocks, content, event: signed, pubkey }
}

async function main() {
  const outputPath = resolve(repoRoot, MAP_FILE)
  const { blocks, content, event, pubkey } = await buildSignedMapEvent()

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${content}\n`, 'utf8')

  console.log(`Identity: pubkey ${pubkey.slice(0, 16)}... (passphrase: "${PASSPHRASE}")`)
  console.log(`Blocks generated: ${blocks.length.toLocaleString()}`)
  console.log(`Map file: ${MAP_FILE}`)
  console.log(`Event id: ${event.id}  PoW: ${countLeadingZeroBits(event.id)} bits`)

  let published = false
  for (const relay of RELAYS) {
    process.stdout.write(`Publishing to ${relay}... `)
    try {
      const result = await publishToRelay(relay, event)
      if (result.type === 'OK' && result.accepted) {
        console.log('accepted')
        published = true
      } else if (result.type === 'OK') {
        console.log(`rejected: ${result.message}`)
      } else {
        console.log(JSON.stringify(result))
      }
    } catch (err) {
      console.log(`error: ${err.message}`)
    }
  }

  if (!published) {
    console.error('Failed to publish to any relay.')
    process.exit(1)
  }

  console.log(`Done. Load in-game with passphrase "${PASSPHRASE}" -> Fetch -> Load.`)
}

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  await main()
}
