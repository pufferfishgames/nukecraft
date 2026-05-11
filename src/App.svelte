<script>
  import { onMount } from 'svelte'
  import * as THREE from 'three'
  import { createRenderer } from './game/renderer.js'
  import { createKeyboardState, computeMovement, KEYS } from './game/controls.js'
  import { BlockType, BLOCK_COLORS } from './game/world.js'

  let canvas
  let overlay = true
  let selectedSlot = 0
  let animId

  const PLAYER_SPEED = 5
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

  // Called from overlay click OR Esc keydown — both fire from user gestures
  function startGame() {
    overlay = false
    canvas?.requestPointerLock()
  }

  onMount(() => {
    const { renderer, scene, camera, resize, worldManager } = createRenderer(canvas)
    resize()
    window.addEventListener('resize', resize)

    // Show overlay again whenever pointer lock exits (browser Esc while playing)
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas) overlay = true
    })

    const keyboard = createKeyboardState()

    function onKeyDown(e) {
      // Esc while overlay is showing → start game
      if (e.code === 'Escape' && overlay) {
        startGame()
        return
      }
      keyboard.onKeyDown(e)
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code[5]) - 1
        if (n >= 0 && n < HOTBAR.length) selectedSlot = n
      }
      if (e.code === 'KeyQ') selectedSlot = (selectedSlot - 1 + HOTBAR.length) % HOTBAR.length
      if (e.code === 'KeyE') selectedSlot = (selectedSlot + 1) % HOTBAR.length
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', keyboard.onKeyUp)

    let yaw = Math.PI * 1.25
    let pitch = -0.3
    camera.rotation.y = yaw
    camera.rotation.x = pitch

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return
      yaw -= e.movementX * MOUSE_SENSITIVITY
      pitch -= e.movementY * MOUSE_SENSITIVITY
      pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch))
      camera.rotation.y = yaw
      camera.rotation.x = pitch
    })

    function raycastTarget() {
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera({ x: 0, y: 0 }, camera)
      raycaster.far = REACH
      const hits = raycaster.intersectObjects(worldManager.getMeshes())
      return hits.length ? hits[0] : null
    }

    // Canvas click = break block (overlay is never visible when this fires)
    canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== canvas) return
      const hit = raycastTarget()
      if (!hit) return
      const block = hit.object.userData.block
      if (block.type === BlockType.WATER) return
      worldManager.removeBlock(block)
    })

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      if (document.pointerLockElement !== canvas) return
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
    })

    canvas.addEventListener('wheel', (e) => {
      if (document.pointerLockElement !== canvas) return
      selectedSlot = (selectedSlot + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length
    })

    let last = performance.now()
    function loop(now) {
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now
      const move = computeMovement(keyboard, yaw, PLAYER_SPEED, delta)
      camera.position.x += move.x
      camera.position.z += move.z
      if (keyboard.isDown(KEYS.JUMP)) {
        camera.position.y = Math.min(camera.position.y + PLAYER_SPEED * delta, 30)
      }
      renderer.render(scene, camera)
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', keyboard.onKeyUp)
      renderer.dispose()
    }
  })
</script>

<canvas bind:this={canvas} class="game-canvas" aria-label="Nikolai's Minecraft"></canvas>

{#if overlay}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay" data-testid="overlay" onclick={startGame}>
    <h1>Nikolai's Minecraft</h1>
    <p>Click or press Esc to play</p>
    <ul>
      <li><kbd>WASD</kbd> / Arrows — move</li>
      <li>Mouse — look around</li>
      <li><kbd>Space</kbd> — fly up</li>
      <li><kbd>LMB</kbd> — break block</li>
      <li><kbd>RMB</kbd> — place block</li>
      <li><kbd>1–9</kbd> / Scroll / <kbd>Q</kbd><kbd>E</kbd> — select block</li>
      <li><kbd>Esc</kbd> — pause</li>
    </ul>
  </div>
{/if}

{#if !overlay}
  <div class="crosshair">+</div>

  <div class="hotbar">
    {#each HOTBAR as item, i}
      <div
        class="hotbar-slot"
        class:selected={i === selectedSlot}
        style="background:{slotColor(i)}"
        title="{i + 1}: {item.label}"
      >
        <span class="slot-num">{i + 1}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  :global(body, html) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #000;
    font-family: monospace;
    cursor: none;
  }

  .game-canvas {
    display: block;
    width: 100vw;
    height: 100vh;
  }

  /* ── Overlay ── */
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
    font-size: 3rem;
    margin: 0 0 0.75rem;
    text-shadow: 2px 2px 0 #000;
    letter-spacing: 0.05em;
  }

  .overlay p {
    font-size: 1.4rem;
    margin: 0 0 1.5rem;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .overlay ul {
    list-style: none;
    padding: 0;
    font-size: 0.95rem;
    color: #ccc;
    line-height: 2;
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

  /* ── Crosshair ── */
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

  /* ── Hotbar ── */
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
    width: 48px;
    height: 48px;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-radius: 4px;
    position: relative;
    box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.4);
  }

  .hotbar-slot.selected {
    border-color: #fff;
    box-shadow: 0 0 0 2px #fff, inset 0 0 6px rgba(0, 0, 0, 0.4);
  }

  .slot-num {
    position: absolute;
    bottom: 2px;
    right: 4px;
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.8);
    text-shadow: 1px 1px 0 #000;
  }
</style>
