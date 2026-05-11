// Block codec: sort(y,x,z) → delta-encode → gzip → base64
// Sorted pyramid blocks differ only by Δz=1 in long runs → ~50:1 gzip ratio.
// Per-block wire format: dx(int16) dy(int8) dz(int16) dt(int8) = 6 bytes.
// First block stores absolute values as if previous was (0,0,0,0).
// Event content JSON: {"v":2,"n":<count>,"data":"<base64>"}
// Legacy: [{x,y,z,type},...] or [[x,y,z,type],...] array.

export async function encodeBlocks(blocks) {
  const sorted = [...blocks].sort((a, b) =>
    a.y !== b.y ? a.y - b.y : a.x !== b.x ? a.x - b.x : a.z - b.z,
  )
  const buf = new Uint8Array(sorted.length * 6)
  let px = 0, py = 0, pz = 0, pt = 0
  for (let i = 0; i < sorted.length; i++) {
    const { x, y, z, type: t } = sorted[i]
    const dx = x - px, dy = y - py, dz = z - pz, dt = t - pt
    const o = i * 6
    buf[o]   = (dx >> 8) & 0xff;  buf[o+1] = dx & 0xff
    buf[o+2] = dy & 0xff
    buf[o+3] = (dz >> 8) & 0xff; buf[o+4] = dz & 0xff
    buf[o+5] = dt & 0xff
    px = x; py = y; pz = z; pt = t
  }
  const cs = new CompressionStream('gzip')
  const w = cs.writable.getWriter()
  w.write(buf); w.close()
  const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer())
  return JSON.stringify({ v: 2, n: sorted.length, data: _toBase64(compressed) })
}

export async function decodeBlocks(content) {
  const parsed = JSON.parse(content)
  if (Array.isArray(parsed)) {
    return parsed.map((b) =>
      Array.isArray(b) ? { x: b[0], y: b[1], z: b[2], type: b[3] } : b,
    )
  }
  if (parsed.v === 2) {
    const ds = new DecompressionStream('gzip')
    const w = ds.writable.getWriter()
    w.write(_fromBase64(parsed.data)); w.close()
    const raw = new Uint8Array(await new Response(ds.readable).arrayBuffer())
    const view = new DataView(raw.buffer)
    const blocks = []
    let px = 0, py = 0, pz = 0, pt = 0
    for (let o = 0; o < raw.byteLength; o += 6) {
      px += view.getInt16(o,   false)
      py += view.getInt8 (o+2)
      pz += view.getInt16(o+3, false)
      pt += view.getInt8 (o+5)
      blocks.push({ x: px, y: py, z: pz, type: pt })
    }
    return blocks
  }
  throw new Error('unknown block content format')
}

function _toBase64(buf) {
  let s = ''
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i])
  return btoa(s)
}

function _fromBase64(b64) {
  const s = atob(b64)
  const buf = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i)
  return buf
}
