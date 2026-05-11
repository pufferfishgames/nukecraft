<script>
  import { onMount } from 'svelte'
  import { createRenderer } from './game/renderer.js'
  import { createKeyboardState, computeMovement, KEYS } from './game/controls.js'

  let canvas
  let overlay = true
  let animId
  let renderer, scene, camera, resize

  const PLAYER_SPEED = 5
  const MOUSE_SENSITIVITY = 0.002

  onMount(() => {
    ;({ renderer, scene, camera, resize } = createRenderer(canvas))
    resize()
    window.addEventListener('resize', resize)

    const keyboard = createKeyboardState()
    window.addEventListener('keydown', keyboard.onKeyDown)
    window.addEventListener('keyup', keyboard.onKeyUp)

    let yaw = Math.PI * 1.25
    let pitch = -0.3
    camera.rotation.y = yaw
    camera.rotation.x = pitch

    function onMouseMove(e) {
      if (document.pointerLockElement !== canvas) return
      yaw -= e.movementX * MOUSE_SENSITIVITY
      pitch -= e.movementY * MOUSE_SENSITIVITY
      pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch))
      camera.rotation.y = yaw
      camera.rotation.x = pitch
    }
    document.addEventListener('mousemove', onMouseMove)

    canvas.addEventListener('click', () => {
      canvas.requestPointerLock()
    })
    document.addEventListener('pointerlockchange', () => {
      overlay = document.pointerLockElement !== canvas
    })

    let last = performance.now()
    function loop(now) {
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now

      const move = computeMovement(keyboard, yaw, PLAYER_SPEED, delta)
      camera.position.x += move.x
      camera.position.z += move.z

      if (keyboard.isDown(KEYS.JUMP)) {
        camera.position.y = Math.min(camera.position.y + PLAYER_SPEED * delta, 20)
      }

      renderer.render(scene, camera)
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', keyboard.onKeyDown)
      window.removeEventListener('keyup', keyboard.onKeyUp)
      document.removeEventListener('mousemove', onMouseMove)
      renderer.dispose()
    }
  })
</script>

<canvas bind:this={canvas} class="game-canvas" aria-label="Minecraft game world"></canvas>

{#if overlay}
  <div class="overlay" data-testid="overlay">
    <h1>Svelte Minecraft</h1>
    <p>Click to play</p>
    <ul>
      <li>WASD / Arrow keys — move</li>
      <li>Mouse — look around</li>
      <li>Space — fly up</li>
    </ul>
  </div>
{/if}

<style>
  :global(body, html) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #000;
    font-family: monospace;
  }

  .game-canvas {
    display: block;
    width: 100vw;
    height: 100vh;
  }

  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    user-select: none;
  }

  .overlay h1 {
    font-size: 3rem;
    margin: 0 0 1rem;
    text-shadow: 2px 2px 0 #000;
  }

  .overlay p {
    font-size: 1.4rem;
    margin: 0 0 1.5rem;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .overlay ul {
    list-style: none;
    padding: 0;
    font-size: 1rem;
    color: #ccc;
    line-height: 1.8;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
