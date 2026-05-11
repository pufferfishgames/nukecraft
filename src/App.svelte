<script>
  import { onMount } from 'svelte'
  import * as THREE from 'three'
  import { createRenderer } from './game/renderer.js'
  import { createKeyboardState, computeMovement, computeMovementAxes, KEYS } from './game/controls.js'
  import { joystickAxes, touchLookDelta, JOYSTICK_RADIUS, TOUCH_SENSITIVITY } from './game/touch.js'
  import { applyGravity, applyJump, applyDescend, resolveGround, PLAYER_EYE_HEIGHT } from './game/physics.js'
  import { BlockType, BLOCK_COLORS } from './game/world.js'

  let canvas
  let overlay = true
  let selectedSlot = 0
  let isMobile = false

  const PLAYER_SPEED  = 5
  const MOUSE_SENSITIVITY = 0.002
  const REACH = 5

  const HOTBAR = [
    { type: BlockType.DIRT,        label: 'Dirt' },
    { type: BlockType.STONE,       label: 'Stone' },
    { type: BlockType.GRASS,       label: 'Grass' },
    { type: BlockType.SAND,        label: 'Sand' },
    { type: BlockType.WOOD,        label: 'Wood' },
    { type: BlockType.LEAVES,      label: 'Leaves' },
    { type: BlockType.STONE_BRICK, label: 'Brick' },
    { type: BlockType.CONCRETE,    label: 'Concrete' },
    { type: BlockType.GRAVEL,      label: 'Gravel' },
  ]

  function slotColor(slot) {
    const hex = BLOCK_COLORS[HOTBAR[slot].type] ?? 0x888888
    return '#' + hex.toString(16).padStart(6, '0')
  }

  // ── Mobile touch state ─────────────────────────────────────────────────────
  let joystickTouchId = null
  let joystickAnchor  = null
  let joystickPos     = null
  let joystickDx = 0
  let joystickDz = 0
  let lookTouchId = null
  let lookLastX = 0
  let lookLastY = 0
  let mobileJump    = false
  let mobileDescend = false

  $: joystickThumb = (() => {
    if (!joystickAnchor || !joystickPos) return null
    const dx = joystickPos.x - joystickAnchor.x
    const dz = joystickPos.y - joystickAnchor.y
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len <= JOYSTICK_RADIUS) return joystickPos
    return {
      x: joystickAnchor.x + (dx / len) * JOYSTICK_RADIUS,
      y: joystickAnchor.y + (dz / len) * JOYSTICK_RADIUS,
    }
  })()

  let _breakBlock = () => {}
  let _placeBlock = () => {}

  function startGame() {
    overlay = false
    if (!isMobile) canvas?.requestPointerLock()
  }

  onMount(() => {
    isMobile = window.matchMedia('(pointer: coarse)').matches

    const { renderer, scene, camera, resize, worldManager } = createRenderer(canvas)
    resize()
    window.addEventListener('resize', resize)

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas) overlay = true
    })

    let yaw = Math.PI * 1.25
    let pitch = -0.3
    camera.rotation.y = yaw
    camera.rotation.x = pitch

    // Physics state (frame-local, not reactive)
    let velocityY  = 0
    let isGrounded = false

    // ── Raycast helpers ──────────────────────────────────────────────────────
    function raycastTarget() {
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera({ x: 0, y: 0 }, camera)
      raycaster.far = REACH
      const hits = raycaster.intersectObjects(worldManager.getMeshes())
      return hits.length ? hits[0] : null
    }

    // ── Block highlight (cube edge outline) ──────────────────────────────────
    const highlightLine = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
      new THREE.LineBasicMaterial({ color: 0x000000, depthTest: false })
    )
    highlightLine.visible = false
    scene.add(highlightLine)

    // ── Ghost block (translucent placement preview) ──────────────────────────
    const ghostMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.38 })
    const ghostMesh = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.98, 0.98), ghostMat)
    ghostMesh.visible = false
    scene.add(ghostMesh)

    _breakBlock = () => {
      const hit = raycastTarget()
      if (!hit) return
      const block = hit.object.userData.block
      if (block.type === BlockType.WATER) return
      worldManager.removeBlock(block)
    }

    _placeBlock = () => {
      const hit = raycastTarget()
      if (!hit) return
      const block = hit.object.userData.block
      const n = hit.face.normal
      worldManager.addBlock({
        x: block.x + Math.round(n.x),
        y: block.y + Math.round(n.y),
        z: block.z + Math.round(n.z),
        type: HOTBAR[selectedSlot].type,
      })
    }

    // ── Keyboard ─────────────────────────────────────────────────────────────
    const keyboard = createKeyboardState()

    function onKeyDown(e) {
      if (e.code === 'Escape' && overlay) { startGame(); return }
      keyboard.onKeyDown(e)
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code[5]) - 1
        if (n >= 0 && n < HOTBAR.length) selectedSlot = n
      }
      if (e.code === 'KeyQ') selectedSlot = (selectedSlot - 1 + HOTBAR.length) % HOTBAR.length
      if (e.code === 'KeyE') selectedSlot = (selectedSlot + 1) % HOTBAR.length
      if (e.code === 'KeyF' || e.code === 'Enter') { e.preventDefault(); _placeBlock() }
      if (e.code === 'KeyR') _breakBlock()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', keyboard.onKeyUp)

    // ── Mouse look (desktop) ─────────────────────────────────────────────────
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return
      yaw   -= e.movementX * MOUSE_SENSITIVITY
      pitch -= e.movementY * MOUSE_SENSITIVITY
      pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch))
      camera.rotation.y = yaw
      camera.rotation.x = pitch
    })

    // ── Desktop clicks ───────────────────────────────────────────────────────
    canvas.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== canvas) return
      if (e.button === 0) _breakBlock()
      if (e.button === 2) _placeBlock()
    })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener('wheel', (e) => {
      if (document.pointerLockElement !== canvas) return
      selectedSlot = (selectedSlot + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length
    })

    // ── Mobile touch ─────────────────────────────────────────────────────────
    function onTouchStart(e) {
      e.preventDefault()
      for (const t of e.changedTouches) {
        const leftZone = t.clientX < window.innerWidth * 0.45
        if (leftZone && joystickTouchId === null) {
          joystickTouchId = t.identifier
          joystickAnchor  = { x: t.clientX, y: t.clientY }
          joystickPos     = { x: t.clientX, y: t.clientY }
          joystickDx = joystickDz = 0
        } else if (!leftZone && lookTouchId === null) {
          lookTouchId = t.identifier
          lookLastX = t.clientX
          lookLastY = t.clientY
        }
      }
    }

    function onTouchMove(e) {
      e.preventDefault()
      for (const t of e.changedTouches) {
        if (t.identifier === joystickTouchId && joystickAnchor) {
          joystickPos = { x: t.clientX, y: t.clientY }
          const axes = joystickAxes(t.clientX, t.clientY, joystickAnchor.x, joystickAnchor.y, JOYSTICK_RADIUS)
          joystickDx = axes.dx
          joystickDz = axes.dz
        }
        if (t.identifier === lookTouchId) {
          const { dyaw, dpitch } = touchLookDelta(
            t.clientX - lookLastX, t.clientY - lookLastY, TOUCH_SENSITIVITY,
          )
          yaw   += dyaw
          pitch += dpitch
          pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch))
          camera.rotation.y = yaw
          camera.rotation.x = pitch
          lookLastX = t.clientX
          lookLastY = t.clientY
        }
      }
    }

    function onTouchEnd(e) {
      for (const t of e.changedTouches) {
        if (t.identifier === joystickTouchId) {
          joystickTouchId = null; joystickAnchor = null; joystickPos = null
          joystickDx = joystickDz = 0
        }
        if (t.identifier === lookTouchId) lookTouchId = null
      }
    }

    canvas.addEventListener('touchstart',  onTouchStart,  { passive: false })
    canvas.addEventListener('touchmove',   onTouchMove,   { passive: false })
    canvas.addEventListener('touchend',    onTouchEnd)
    canvas.addEventListener('touchcancel', onTouchEnd)

    // ── Game loop ─────────────────────────────────────────────────────────────
    let last = performance.now()
    function loop(now) {
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now

      // Horizontal movement
      const move = isMobile
        ? computeMovementAxes(joystickDx, joystickDz, yaw, PLAYER_SPEED, delta)
        : computeMovement(keyboard, yaw, PLAYER_SPEED, delta)
      camera.position.x += move.x
      camera.position.z += move.z

      // Vertical physics
      velocityY = applyGravity(velocityY, delta)

      const wantsJump    = isMobile ? mobileJump    : keyboard.isDown(KEYS.JUMP)
      const wantsDescend = isMobile ? mobileDescend : keyboard.isDown(KEYS.DESCEND)
      if (wantsJump)    velocityY = applyJump(velocityY, isGrounded)
      if (wantsDescend) velocityY = applyDescend(velocityY)

      camera.position.y += velocityY * delta
      camera.position.y  = Math.max(camera.position.y, -5) // void floor

      const groundY  = worldManager.getGroundY(camera.position.x, camera.position.z)
      const resolved = resolveGround(camera.position.y, velocityY, groundY)
      camera.position.y = resolved.posY
      velocityY  = resolved.velocityY
      isGrounded = resolved.isGrounded

      // Per-frame block targeting visuals
      const hit = raycastTarget()
      if (hit) {
        const b = hit.object.userData.block
        highlightLine.position.set(b.x, b.y, b.z)
        highlightLine.visible = true
        const n = hit.face.normal
        ghostMat.color.setHex(BLOCK_COLORS[HOTBAR[selectedSlot].type] ?? 0x888888)
        ghostMesh.position.set(b.x + Math.round(n.x), b.y + Math.round(n.y), b.z + Math.round(n.z))
        ghostMesh.visible = true
      } else {
        highlightLine.visible = false
        ghostMesh.visible = false
      }

      renderer.render(scene, camera)
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', keyboard.onKeyUp)
      highlightLine.geometry.dispose()
      highlightLine.material.dispose()
      ghostMesh.geometry.dispose()
      ghostMat.dispose()
      renderer.dispose()
    }
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<canvas
  bind:this={canvas}
  class="game-canvas"
  aria-label="Nukecraft"
></canvas>

{#if overlay}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay" data-testid="overlay" onclick={startGame}>
    <h1>Nukecraft</h1>
    <p>{isMobile ? 'Tap to play' : 'Click or press Esc to play'}</p>
    <ul>
      {#if isMobile}
        <li>Left thumb — move &nbsp; Right thumb — look</li>
        <li>⬆ jump &nbsp; ⬇ descend &nbsp; ⛏ break &nbsp; + place</li>
        <li>◀ ▶ — cycle blocks</li>
      {:else}
        <li><kbd>WASD</kbd> / Arrows — move</li>
        <li>Mouse — look &nbsp; <kbd>Space</kbd> — jump &nbsp; <kbd>Shift</kbd> — descend</li>
        <li><kbd>LMB</kbd>/<kbd>R</kbd> — break &nbsp; <kbd>RMB</kbd>/<kbd>F</kbd> — place</li>
        <li><kbd>1–9</kbd> / Scroll / <kbd>Q</kbd><kbd>E</kbd> — cycle blocks</li>
        <li><kbd>Esc</kbd> — pause</li>
      {/if}
    </ul>
  </div>
{/if}

{#if !overlay}
  <div class="crosshair" aria-hidden="true">+</div>

  <div class="hotbar">
    {#each HOTBAR as item, i}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="hotbar-slot"
        class:selected={i === selectedSlot}
        style="background:{slotColor(i)}"
        title="{i + 1}: {item.label}"
        onclick={() => { selectedSlot = i }}
      >
        <span class="slot-num">{i + 1}</span>
      </div>
    {/each}
  </div>

  {#if isMobile}
    {#if joystickAnchor}
      <div class="joy-base" style="left:{joystickAnchor.x}px; top:{joystickAnchor.y}px;"></div>
      {#if joystickThumb}
        <div class="joy-thumb" style="left:{joystickThumb.x}px; top:{joystickThumb.y}px;"></div>
      {/if}
    {/if}

    <div class="mob-actions">
      <button class="mob-btn"
        ontouchstart={(e) => { e.stopPropagation(); mobileJump = true }}
        ontouchend={(e)   => { e.stopPropagation(); mobileJump = false }}
        aria-label="Jump">⬆</button>
      <button class="mob-btn"
        ontouchstart={(e) => { e.stopPropagation(); mobileDescend = true }}
        ontouchend={(e)   => { e.stopPropagation(); mobileDescend = false }}
        aria-label="Descend">⬇</button>
      <button class="mob-btn"
        ontouchstart={(e) => { e.preventDefault(); e.stopPropagation(); _breakBlock() }}
        aria-label="Break block">⛏</button>
      <button class="mob-btn"
        ontouchstart={(e) => { e.preventDefault(); e.stopPropagation(); _placeBlock() }}
        aria-label="Place block">+</button>
      <button class="mob-btn small"
        ontouchstart={(e) => { e.stopPropagation(); selectedSlot = (selectedSlot - 1 + HOTBAR.length) % HOTBAR.length }}
        aria-label="Previous block">◀</button>
      <button class="mob-btn small"
        ontouchstart={(e) => { e.stopPropagation(); selectedSlot = (selectedSlot + 1) % HOTBAR.length }}
        aria-label="Next block">▶</button>
    </div>
  {/if}
{/if}

<style>
  :global(body, html) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #000;
    font-family: monospace;
    cursor: none;
    touch-action: none;
  }

  .game-canvas {
    display: block;
    width: 100vw;
    height: 100vh;
    touch-action: none;
  }

  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    user-select: none;
    cursor: pointer;
  }

  .overlay h1 {
    font-size: clamp(1.8rem, 6vw, 3rem);
    margin: 0 0 0.75rem;
    text-shadow: 2px 2px 0 #000;
    letter-spacing: 0.05em;
  }

  .overlay p {
    font-size: clamp(1rem, 3.5vw, 1.4rem);
    margin: 0 0 1.5rem;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .overlay ul {
    list-style: none;
    padding: 0;
    font-size: clamp(0.75rem, 2.5vw, 0.95rem);
    color: #ccc;
    line-height: 2.2;
    text-align: center;
  }

  kbd {
    background: #333;
    border: 1px solid #666;
    border-radius: 3px;
    padding: 1px 5px;
    font-family: monospace;
    font-size: 0.85em;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }

  .crosshair {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 1.6rem;
    font-weight: bold;
    text-shadow: 1px 1px 2px #000;
    pointer-events: none;
    user-select: none;
  }

  .hotbar {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    pointer-events: none;
  }

  .hotbar-slot {
    width: 44px;
    height: 44px;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-radius: 4px;
    position: relative;
    box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    cursor: pointer;
  }

  .hotbar-slot.selected {
    border-color: #fff;
    box-shadow: 0 0 0 2px #fff, inset 0 0 6px rgba(0, 0, 0, 0.4);
  }

  .slot-num {
    position: absolute;
    bottom: 2px;
    right: 4px;
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.8);
    text-shadow: 1px 1px 0 #000;
  }

  .joy-base {
    position: fixed;
    width: calc(2 * 60px);
    height: calc(2 * 60px);
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.35);
    background: rgba(255, 255, 255, 0.08);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .joy-thumb {
    position: fixed;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.55);
    border: 2px solid rgba(255, 255, 255, 0.8);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .mob-actions {
    position: fixed;
    bottom: 72px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }

  .mob-btn {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    border: 2px solid rgba(255, 255, 255, 0.45);
    color: #fff;
    font-size: 1.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .mob-btn.small {
    width: 46px;
    height: 46px;
    font-size: 1rem;
  }

  .mob-btn:active {
    background: rgba(255, 255, 255, 0.25);
  }
</style>
