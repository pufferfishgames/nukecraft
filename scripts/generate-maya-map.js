#!/usr/bin/env node
// Generates a Maya pyramid map with a block-built Boeing 747 and publishes it to Nostr.
// Run: node scripts/generate-maya-map.js
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BlockType } from '../src/game/world.js'
import { passphraseToPrivkey, privkeyToPubkey } from '../src/nostr/identity.js'
import { createMapEvent, signEvent } from '../src/nostr/events.js'
import { mineEvent, MIN_POW_DIFFICULTY, meetsPoW, countLeadingZeroBits } from '../src/nostr/pow.js'
import { buildPublishMessage, parseRelayMessage } from '../src/nostr/relay.js'
import { encodeBlocks } from '../src/nostr/codec.js'

export const PASSPHRASE = 'b747'
export const MAP_FILE = 'maps/b747-maya-747.json'
export const RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
]

export const FEATURE_AREAS = {
  mayanPyramid: { x0: 35, x1: 125, z0: 35, z1: 125 },
  northPyramid: { x0: 204, x1: 296, z0: 34, z1: 126 },
  terraces: { x0: 112, x1: 218, z0: 188, z1: 248 },
  runway: { x0: 70, x1: 260, z0: 141, z1: 171 },
  boeing747: { x0: 116, x1: 216, z0: 113, z1: 199 },
}

const WORLD_MAX_X = 330
const WORLD_MAX_Z = 290
const B = BlockType

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')

function makeBuilder() {
  const byKey = new Map()

  function set(x, y, z, type) {
    const block = { x: Math.round(x), y: Math.round(y), z: Math.round(z), type }
    if (block.x < 0 || block.y < 0 || block.z < 0) return
    if (block.x > 65_535 || block.y > 255 || block.z > 65_535) return
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
    for (let z = 0; z <= WORLD_MAX_Z; z++) set(x, 0, z, B.SAND)
  }
}

function addElCastillo(builder) {
  const { set, fillBox, fillWall } = builder
  const cx = 80
  const cz = 80

  for (let tier = 0; tier < 10; tier++) {
    const half = 40 - tier * 4
    const y0 = tier * 3 + 1
    fillBox(cx - half, cx + half, y0, y0 + 2, cz - half, cz + half, B.STONE_BRICK)
  }

  fillWall(cx - 4, cx + 4, 31, 35, cz - 4, cz + 4, B.STONE_BRICK)
  fillBox(cx - 4, cx + 4, 35, 35, cz - 4, cz + 4, B.STONE_BRICK)

  for (let tier = 0; tier < 10; tier++) {
    const half = 40 - tier * 4
    const y0 = tier * 3 + 1
    for (let y = y0; y < y0 + 3; y++) {
      for (let w = -1; w <= 1; w++) {
        set(cx + w, y, cz - half, B.CONCRETE)
        set(cx + w, y, cz + half, B.CONCRETE)
        set(cx - half, y, cz + w, B.CONCRETE)
        set(cx + half, y, cz + w, B.CONCRETE)
      }
    }
  }
}

function addMayanSunPyramid(builder) {
  const { set, fillBox } = builder
  const cx = 250
  const cz = 80

  for (let tier = 0; tier < 8; tier++) {
    const half = 40 - tier * 5
    if (half <= 0) break
    const y0 = tier * 4 + 1
    fillBox(cx - half, cx + half, y0, y0 + 3, cz - half, cz + half, B.STONE)
  }

  fillBox(cx - 5, cx + 5, 33, 35, cz - 5, cz + 5, B.STONE)
  fillBox(cx - 5, cx + 5, 36, 37, cz - 5, cz + 5, B.CONCRETE)

  for (let tier = 0; tier < 8; tier++) {
    const half = 40 - tier * 5
    if (half <= 0) break
    const y0 = tier * 4 + 1
    for (let y = y0; y < y0 + 4; y++) {
      for (let w = -2; w <= 2; w++) set(cx + w, y, cz - half, B.CONCRETE)
    }
  }
}

function addTerraces(builder) {
  const { fillBox, fillWall } = builder
  const cx = 165
  const cz = 220

  for (let level = 0; level < 10; level++) {
    const halfX = 50 - level * 5
    const halfZ = 25 - level * 2
    if (halfX <= 0 || halfZ <= 0) break
    const y0 = level * 2 + 1
    fillBox(cx - halfX, cx + halfX, y0, y0 + 1, cz - halfZ, cz + halfZ, B.GRAVEL)
  }

  fillWall(cx - 8, cx + 8, 21, 24, cz - 4, cz + 4, B.STONE)
  fillWall(cx - 6, cx - 3, 21, 23, cz - 2, cz + 2, B.STONE)
  fillWall(cx + 3, cx + 6, 21, 23, cz - 2, cz + 2, B.STONE)
}

function addRoads(builder) {
  const { set } = builder

  function road(x0, z0, x1, z1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) * 2
    for (let t = 0; t <= steps; t++) {
      const x = Math.round(x0 + (x1 - x0) * t / steps)
      const z = Math.round(z0 + (z1 - z0) * t / steps)
      for (let d = -1; d <= 1; d++) {
        set(x, 1, z + d, B.CONCRETE)
        set(x + d, 1, z, B.CONCRETE)
      }
    }
  }

  road(121, 80, 209, 80)
  road(80, 121, 165, 179)
  road(250, 121, 165, 179)
}

function addRunway(builder) {
  const { fillBox } = builder

  fillBox(64, 266, 0, 0, 136, 176, B.GRAVEL)
  fillBox(70, 260, 1, 1, 141, 171, B.CONCRETE)
  fillBox(70, 74, 2, 2, 145, 167, B.SAND)
  fillBox(256, 260, 2, 2, 145, 167, B.SAND)

  for (let x = 86; x <= 244; x += 16) {
    fillBox(x, x + 6, 2, 2, 155, 157, B.SAND)
  }
}

function addFuselage(builder, x0, x1, cy, cz) {
  const { set } = builder
  for (let x = x0; x <= x1; x++) {
    const taper = Math.min(1, (x - x0) / 12, (x1 - x) / 12)
    const ry = Math.max(1, Math.round(4 * taper))
    const rz = Math.max(1, Math.round(5 * taper))
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let z = cz - rz; z <= cz + rz; z++) {
        const ny = (y - cy) / (ry + 0.25)
        const nz = (z - cz) / (rz + 0.25)
        if (ny * ny + nz * nz <= 1) set(x, y, z, B.CONCRETE)
      }
    }
  }

  for (let x = 128; x <= 204; x += 4) {
    set(x, cy + 2, cz - 5, B.GRAVEL)
    set(x, cy + 2, cz + 5, B.GRAVEL)
  }
  for (let x = 205; x <= 214; x++) {
    set(x, cy + 2, cz - 4, B.GRAVEL)
    set(x, cy + 3, cz - 3, B.GRAVEL)
    set(x, cy + 2, cz + 4, B.GRAVEL)
    set(x, cy + 3, cz + 3, B.GRAVEL)
  }
}

function addWing(builder, side) {
  const { set } = builder
  const cz = 156
  for (let outward = 5; outward <= 43; outward++) {
    const z = cz + side * outward
    const x0 = 145 - Math.floor(outward * 0.18)
    const x1 = 178 - Math.floor(outward * 0.65)
    for (let x = x0; x <= x1; x++) {
      set(x, 8, z, B.CONCRETE)
      if (outward <= 34 && (x + outward) % 3 !== 0) set(x, 9, z, B.CONCRETE)
    }
  }
}

function addEngine(builder, cx, cz) {
  const { set } = builder
  for (let x = cx - 3; x <= cx + 3; x++) {
    for (let y = 5; y <= 8; y++) {
      for (let z = cz - 3; z <= cz + 3; z++) {
        const nx = (x - cx) / 3.2
        const ny = (y - 6.5) / 2.2
        const nz = (z - cz) / 3.2
        if (nx * nx + ny * ny + nz * nz <= 1) set(x, y, z, B.GRAVEL)
      }
    }
  }
  set(cx, 7, cz, B.STONE)
}

function addBoeing747(builder) {
  const { set, fillBox } = builder
  addRunway(builder)

  const cy = 10
  const cz = 156

  addFuselage(builder, 120, 216, cy, cz)
  fillBox(176, 198, 14, 16, 153, 159, B.STONE_BRICK)
  fillBox(182, 194, 17, 17, 154, 158, B.STONE_BRICK)

  addWing(builder, -1)
  addWing(builder, 1)
  for (const [x, z] of [[148, 124], [166, 132], [148, 188], [166, 180]]) addEngine(builder, x, z)

  for (let x = 116; x <= 130; x++) {
    const top = 22 - Math.floor(Math.max(0, x - 118) * 0.45)
    for (let y = 14; y <= top; y++) {
      for (let z = 154; z <= 158; z++) set(x, y, z, B.STONE_BRICK)
    }
  }
  for (let side = -1; side <= 1; side += 2) {
    for (let outward = 4; outward <= 22; outward++) {
      const z = cz + side * outward
      for (let x = 116; x <= 136 - Math.floor(outward * 0.35); x++) set(x, 13, z, B.CONCRETE)
    }
  }

  for (const [x, z] of [[141, 146], [141, 166], [186, 146], [186, 166], [207, 156]]) {
    fillBox(x - 1, x + 1, 2, 5, z - 1, z + 1, B.GRAVEL)
    fillBox(x - 3, x + 3, 2, 2, z - 2, z + 2, B.STONE)
  }

  fillBox(116, 121, 9, 11, 153, 159, B.CONCRETE)
  fillBox(212, 216, 9, 11, 154, 158, B.CONCRETE)
}

function isInsideArea(x, z, area, margin = 0) {
  return x >= area.x0 - margin && x <= area.x1 + margin && z >= area.z0 - margin && z <= area.z1 + margin
}

function addTrees(builder) {
  const { set } = builder
  for (let i = 0; i < 400; i++) {
    const tx = ((i * 317 + 89) % 320) + 5
    const tz = ((i * 431 + 53) % 270) + 5
    const dm = Math.abs(tx - 80) + Math.abs(tz - 80)
    const dn = Math.abs(tx - 250) + Math.abs(tz - 80)
    const dt = Math.abs(tx - 165) + Math.abs(tz - 220)
    if (dm < 55 || dn < 55 || dt < 45) continue
    if (isInsideArea(tx, tz, FEATURE_AREAS.runway, 8)) continue
    if (isInsideArea(tx, tz, FEATURE_AREAS.boeing747, 6)) continue

    for (let y = 1; y <= 6; y++) set(tx, y, tz, B.WOOD)
    for (let dy = 0; dy <= 5; dy++) {
      const r = Math.max(0, 3 - Math.abs(dy - 2))
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= r + 1) set(tx + dx, 6 + dy, tz + dz, B.LEAVES)
        }
      }
    }
  }
}

export function generateMap() {
  const builder = makeBuilder()
  addTerrain(builder)
  addElCastillo(builder)
  addMayanSunPyramid(builder)
  addTerraces(builder)
  addRoads(builder)
  addBoeing747(builder)
  addTrees(builder)
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
