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

// Slow-mo (perfect dodge)
var slowMoTimer = 0
var slowMoScale = 1.0

var keys         = new Set()
var mouseX       = 0
var mouseY       = 0
var mouseClicked = false
var rightClicked = false

var draftChoices = []

// ── Canvas setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('game')
canvas.width  = CANVAS_W
canvas.height = CANVAS_H
const ctx = canvas.getContext('2d')

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

  // Manual Crash (F key)
  if (k === 'f' && gameState === 'playing' && !Tempo.isCrashed && Tempo.value >= 85) {
    Tempo.manualCrash(Player.x, Player.y)
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
    if (e.button === 0) mouseClicked = true
    if (e.button === 2) rightClicked = true
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
})

// Suppress context menu so right-click works in-game
canvas.addEventListener('contextmenu', e => e.preventDefault())

// ── Game flow ──────────────────────────────────────────────────────────────────
function startGame() {
  RunState.startRun('berserker')
  Tempo.value = 50
  Tempo.isCrashed = false
  Tempo.manualCrashRadiusBonus = 1.0
  Room.load(0)
  Player.init()
  UI.vignetteAlpha = 0
  gameState = 'playing'
}

function showClassSelect() {
  startGame()
}

function openDraft() {
  gameState = 'draft'
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
  Player.hp    = RunState.hp
  Player.maxHp = RunState.maxHp

  const nextRoom = Room.index + 1
  if (nextRoom >= 3) {
    gameState = 'win'
  } else {
    // Tempo CARRIES into next room — don't reset it
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
  mouseClicked = false
  rightClicked = false
}

function update(realDt) {
  // Hit-stop: freeze game logic
  if (hitStopTimer > 0) {
    hitStopTimer = Math.max(0, hitStopTimer - realDt)
    return
  }

  // Slow-mo (perfect dodge) — scale game dt, not real dt
  let dt = realDt
  if (slowMoTimer > 0) {
    slowMoTimer = Math.max(0, slowMoTimer - realDt)
    dt = realDt * slowMoScale
  } else {
    slowMoScale = 1.0
  }

  // Camera shake (uses real dt for consistent feel)
  if (shakeElapsed < shakeDuration) {
    shakeElapsed += realDt
    const decay = 1 - shakeElapsed / shakeDuration
    shakeOffsetX = (Math.random() * 2 - 1) * shakeIntensity * decay * 14
    shakeOffsetY = (Math.random() * 2 - 1) * shakeIntensity * decay * 14
  } else {
    shakeOffsetX = 0; shakeOffsetY = 0
    shakeIntensity = 0
  }

  Tempo.update(dt)
  UI.update(dt)
  Player.update(dt)

  for (const e of enemies)     e.update(dt)
  for (const p of projectiles) p.update(dt)
  Effects.update(dt)

  for (let i = enemies.length     - 1; i >= 0; i--) if (!enemies[i].alive)     enemies.splice(i, 1)
  for (let i = projectiles.length - 1; i >= 0; i--) if (!projectiles[i].alive) projectiles.splice(i, 1)

  Room.checkClear()

  if (Room.exitOpen &&
      Player.x > FLOOR_X2 - 30 &&
      Player.y > CANVAS_H / 2 - 50 &&
      Player.y < CANVAS_H / 2 + 50) {
    openDraft()
  }
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  if (gameState === 'menu') { drawMenu(); return }
  if (gameState === 'dead') { UI.drawDead(ctx); return }
  if (gameState === 'win')  { UI.drawWin(ctx);  return }
  if (gameState === 'draft') {
    drawWorld()
    UI.drawDraft(ctx, draftChoices)
    return
  }

  ctx.save()
  ctx.translate(shakeOffsetX, shakeOffsetY)
  drawWorld()
  ctx.restore()

  UI.draw(ctx)
}

function drawWorld() {
  Room.draw(ctx)
  Effects.draw(ctx)
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
  ctx.fillText('Everything is Tempo', CANVAS_W / 2, CANVAS_H / 2)

  ctx.fillStyle = '#555'
  ctx.font = '13px monospace'
  ctx.fillText('WASD move  ·  Left click: combo  ·  Right click: heavy strike', CANVAS_W / 2, CANVAS_H / 2 + 40)
  ctx.fillText('Space: dodge (timed = perfect)  ·  F at 85+: manual crash', CANVAS_W / 2, CANVAS_H / 2 + 60)
  ctx.fillText('Cold → Flowing → Hot → Critical — every state changes everything', CANVAS_W / 2, CANVAS_H / 2 + 80)

  ctx.fillStyle = '#33dd66'
  ctx.font = 'bold 16px monospace'
  ctx.fillText('Click anywhere to start', CANVAS_W / 2, CANVAS_H / 2 + 128)
}

// ── Boot ──────────────────────────────────────────────────────────────────────
requestAnimationFrame(loop)
