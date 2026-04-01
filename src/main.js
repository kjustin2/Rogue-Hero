// ── Main ──────────────────────────────────────────────────────────────────────
// All shared mutable globals live here (var = window scope, readable everywhere)

var enemies     = []
var projectiles = []
var effects     = []

var gameState   = 'menu'  // 'menu' | 'playing' | 'draft' | 'dead' | 'win'

var hitStopTimer    = 0
var shakeIntensity  = 0
var shakeDuration   = 0
var shakeElapsed    = 0
var shakeOffsetX    = 0
var shakeOffsetY    = 0

var keys         = new Set()
var mouseX       = 0
var mouseY       = 0
var mouseClicked = false

var draftChoices = []

// ── Canvas setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('game')
canvas.width  = CANVAS_W
canvas.height = CANVAS_H
const ctx = canvas.getContext('2d')

// Scale mouseX/Y to canvas logical coords
function canvasMousePos(e) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = CANVAS_W / rect.width
  const scaleY = CANVAS_H / rect.height
  mouseX = (e.clientX - rect.left) * scaleX
  mouseY = (e.clientY - rect.top)  * scaleY
}

// ── Input ──────────────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase()
  keys.add(k)
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    e.preventDefault()
  }

  // Draft keyboard shortcuts
  if (gameState === 'draft') {
    const idx = parseInt(k) - 1
    if (idx >= 0 && idx < draftChoices.length) pickDraftItem(idx)
  }

  // Restart
  if (k === 'r' && (gameState === 'dead' || gameState === 'win')) {
    startGame()
  }
})
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()))

window.addEventListener('mousemove', canvasMousePos)

canvas.addEventListener('mousedown', e => {
  canvasMousePos(e)
  if (gameState === 'playing') {
    mouseClicked = true
  }
  if (gameState === 'draft') {
    const cardW = 280, cardH = 160, gap = 40
    const totalW = draftChoices.length * cardW + (draftChoices.length - 1) * gap
    const startX = (CANVAS_W - totalW) / 2
    draftChoices.forEach((_, i) => {
      const cx = startX + i * (cardW + gap), cy = 220
      if (mouseX >= cx && mouseX <= cx + cardW && mouseY >= cy && mouseY <= cy + cardH) {
        pickDraftItem(i)
      }
    })
  }
  if (gameState === 'menu') {
    showClassSelect()
  }
  if ((gameState === 'dead' || gameState === 'win') && e.button === 0) {
    // click to restart handled via drawDead text, but also support click
  }
})

// ── Game flow ──────────────────────────────────────────────────────────────────
function startGame() {
  // Default to berserker for now; class select can be layered in
  RunState.startRun('berserker')
  Tempo.value = 50
  Tempo.isCrashed = false
  Room.load(0)
  Player.init()
  UI.vignetteAlpha = 0
  gameState = 'playing'
}

function showClassSelect() {
  // For now just start immediately — class select screen is a future feature
  startGame()
}

function openDraft() {
  gameState = 'draft'
  // Pick 3 random unique items
  const pool = [...ITEM_POOL]
  draftChoices = []
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    draftChoices.push(pool.splice(idx, 1)[0])
  }
}

function pickDraftItem(index) {
  if (index < 0 || index >= draftChoices.length) return
  RunState.addItem(draftChoices[index].id)
  Player.hp = RunState.hp
  Player.maxHp = RunState.maxHp

  const nextRoom = Room.index + 1
  if (nextRoom >= 3) {
    gameState = 'win'
  } else {
    Room.load(nextRoom)
    Player.init()
    gameState = 'playing'
  }
  draftChoices = []
}

// ── Game loop ──────────────────────────────────────────────────────────────────
let lastTime = 0

function loop(timestamp) {
  requestAnimationFrame(loop)

  const realDt = Math.min((timestamp - lastTime) / 1000, 0.05)
  lastTime = timestamp

  if (gameState === 'playing') {
    update(realDt)
  }

  draw()
  mouseClicked = false   // reset AFTER update() has had a chance to read it
}

function update(realDt) {
  // Hit-stop: skip game logic but still tick the timer
  if (hitStopTimer > 0) {
    hitStopTimer = Math.max(0, hitStopTimer - realDt)
    return
  }
  const dt = realDt

  // Shake
  if (shakeElapsed < shakeDuration) {
    shakeElapsed += dt
    const decay = 1 - shakeElapsed / shakeDuration
    shakeOffsetX = (Math.random() * 2 - 1) * shakeIntensity * decay * 14
    shakeOffsetY = (Math.random() * 2 - 1) * shakeIntensity * decay * 14
  } else {
    shakeOffsetX = 0; shakeOffsetY = 0
    shakeIntensity = 0
  }

  Tempo.update(dt)
  UI.update(dt)
  Pressure.update(dt)
  Player.update(dt)

  for (const e of enemies)     e.update(dt)
  for (const p of projectiles) p.update(dt)
  Effects.update(dt)

  // Prune dead
  for (let i = enemies.length     - 1; i >= 0; i--) if (!enemies[i].alive)     enemies.splice(i, 1)
  for (let i = projectiles.length - 1; i >= 0; i--) if (!projectiles[i].alive) projectiles.splice(i, 1)

  Room.checkClear()

  // Exit trigger — player reaches right wall door
  if (Room.exitOpen &&
      Player.x > FLOOR_X2 - 30 &&
      Player.y > CANVAS_H / 2 - 50 &&
      Player.y < CANVAS_H / 2 + 50) {
    openDraft()
  }
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  if (gameState === 'menu') {
    drawMenu()
    return
  }
  if (gameState === 'dead') {
    // Still show world behind overlay
    ctx.save(); ctx.translate(0, 0); ctx.restore()
    UI.drawDead(ctx)
    return
  }
  if (gameState === 'win') {
    UI.drawWin(ctx)
    return
  }
  if (gameState === 'draft') {
    // Draw last game frame frozen behind
    drawWorld()
    UI.drawDraft(ctx, draftChoices)
    return
  }

  // Playing
  ctx.save()
  ctx.translate(shakeOffsetX, shakeOffsetY)
  drawWorld()
  ctx.restore()

  UI.draw(ctx)
}

function drawWorld() {
  Room.draw(ctx)
  Pressure.draw(ctx)
  Effects.draw(ctx)   // trails behind player
  for (const e of enemies)     e.draw(ctx)
  for (const p of projectiles) p.draw(ctx)
  Player.draw(ctx)
}

function drawMenu() {
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 64px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('ROGUE HERO', CANVAS_W / 2, CANVAS_H / 2 - 60)

  ctx.fillStyle = '#888'
  ctx.font = '18px monospace'
  ctx.fillText('Tempo × Pressure', CANVAS_W / 2, CANVAS_H / 2)

  ctx.fillStyle = '#555'
  ctx.font = '14px monospace'
  ctx.fillText('WASD to move  ·  Space to dash  ·  Click to attack', CANVAS_W / 2, CANVAS_H / 2 + 44)
  ctx.fillText('Move off a charged cell to release a shockwave', CANVAS_W / 2, CANVAS_H / 2 + 66)

  ctx.fillStyle = '#33dd66'
  ctx.font = 'bold 16px monospace'
  ctx.fillText('Click anywhere to start', CANVAS_W / 2, CANVAS_H / 2 + 120)
}

// ── Boot ──────────────────────────────────────────────────────────────────────
requestAnimationFrame(loop)
