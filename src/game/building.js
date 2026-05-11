export function removeBlock(blocks, position) {
  return blocks.filter(
    (b) => !(b.x === position.x && b.y === position.y && b.z === position.z),
  )
}

export function placeBlock(blocks, hitPosition, normal, type) {
  const nx = Math.round(normal.x)
  const ny = Math.round(normal.y)
  const nz = Math.round(normal.z)
  const tx = hitPosition.x + nx
  const ty = hitPosition.y + ny
  const tz = hitPosition.z + nz
  if (blocks.some((b) => b.x === tx && b.y === ty && b.z === tz)) return blocks
  return [...blocks, { x: tx, y: ty, z: tz, type }]
}
