// Cosmetics.js — Cosmetic loot box system definitions, roll logic, and canvas helpers

export const RARITY_COLORS = {
  common:    '#aaaaaa',
  uncommon:  '#4488dd',
  rare:      '#aa44ee',
  legendary: '#ffaa00',
  superleg:  '#ff44ff',
};

export const RARITY_LABELS = {
  common:    'Common',
  uncommon:  'Uncommon',
  rare:      'Rare',
  legendary: 'Legendary',
  superleg:  'SUPER LEGENDARY',
};

export const CATEGORY_LABELS = {
  bodyColor:   'Body Color',
  outlineColor:'Outline',
  shape:       'Shape',
  trail:       'Trail',
  flash:       'Hit Flash',
  deathBurst:  'Death Burst',
  aura:        'Aura',
};

export const BOX_TIERS = {
  bronze:    { cost: 50,   label: 'Bronze Box',    color: '#cc8844', glowColor: '#ffaa66' },
  silver:    { cost: 150,  label: 'Silver Box',    color: '#aaaacc', glowColor: '#ddddff' },
  gold:      { cost: 400,  label: 'Gold Box',      color: '#ddaa00', glowColor: '#ffdd44' },
  prismatic: { cost: 1200, label: 'Prismatic Box', color: '#cc44ff', glowColor: '#ff88ff' },
};

export const BOX_WEIGHTS = {
  bronze:    { common: 60,  uncommon: 28, rare: 10, legendary: 1.5, superleg: 0.5 },
  silver:    { common: 30,  uncommon: 40, rare: 24, legendary: 5,   superleg: 1   },
  gold:      { common: 0,   uncommon: 20, rare: 55, legendary: 23,  superleg: 2   },
  prismatic: { common: 0,   uncommon: 0,  rare: 30, legendary: 60,  superleg: 10  },
};

// ── Cosmetic Definitions ────────────────────────────────────────────────────────

export const CosmeticDefinitions = [

  // ── BODY COLORS (28) ──
  { id:'body_ash',       name:'Ash Grey',          category:'bodyColor', rarity:'common',    value:'#999999' },
  { id:'body_sand',      name:'Sand',              category:'bodyColor', rarity:'common',    value:'#c8a87a' },
  { id:'body_ice',       name:'Ice Blue',          category:'bodyColor', rarity:'common',    value:'#88ccee' },
  { id:'body_mint',      name:'Mint',              category:'bodyColor', rarity:'common',    value:'#66ddaa' },
  { id:'body_white',     name:'Bleached',          category:'bodyColor', rarity:'common',    value:'#e8e8e8' },
  { id:'body_ember',     name:'Ember Orange',      category:'bodyColor', rarity:'common',    value:'#ee7722' },
  { id:'body_olive',     name:'Olive',             category:'bodyColor', rarity:'common',    value:'#889944' },
  { id:'body_slate',     name:'Slate',             category:'bodyColor', rarity:'common',    value:'#667788' },
  { id:'body_rose',      name:'Dusty Rose',        category:'bodyColor', rarity:'common',    value:'#cc8899' },
  { id:'body_teal',      name:'Teal',              category:'bodyColor', rarity:'common',    value:'#228888' },
  { id:'body_crimson',   name:'Crimson Shell',     category:'bodyColor', rarity:'uncommon',  value:'#cc2222' },
  { id:'body_violet',    name:'Violet Dusk',       category:'bodyColor', rarity:'uncommon',  value:'#8844cc' },
  { id:'body_midnight',  name:'Midnight',          category:'bodyColor', rarity:'uncommon',  value:'#112244' },
  { id:'body_plasma',    name:'Plasma Pink',       category:'bodyColor', rarity:'uncommon',  value:'#ee44aa' },
  { id:'body_copper',    name:'Burnished Copper',  category:'bodyColor', rarity:'uncommon',  value:'#bb6633' },
  { id:'body_seafoam',   name:'Seafoam',           category:'bodyColor', rarity:'uncommon',  value:'#33bb99' },
  { id:'body_lavender',  name:'Lavender',          category:'bodyColor', rarity:'uncommon',  value:'#aa88cc' },
  { id:'body_scarlet',   name:'Scarlet',           category:'bodyColor', rarity:'uncommon',  value:'#dd1144' },
  { id:'body_void',      name:'Void Black',        category:'bodyColor', rarity:'rare',      value:'#0a0a12' },
  { id:'body_gold',      name:'Gilded',            category:'bodyColor', rarity:'rare',      value:'#ddaa00' },
  { id:'body_toxic',     name:'Toxic Green',       category:'bodyColor', rarity:'rare',      value:'#44ff22' },
  { id:'body_obsidian',  name:'Obsidian',          category:'bodyColor', rarity:'rare',      value:'#1a1a2e' },
  { id:'body_neon_blue', name:'Neon Blue',         category:'bodyColor', rarity:'rare',      value:'#0044ff' },
  { id:'body_blood',     name:'Blood Pact',        category:'bodyColor', rarity:'rare',      value:'#880000' },
  { id:'body_aurora',    name:'Aurora',            category:'bodyColor', rarity:'legendary', value:'#44ffcc' },
  { id:'body_solargold', name:'Solar Gold',        category:'bodyColor', rarity:'legendary', value:'#ffdd44' },
  { id:'body_voidpulse', name:'Void Pulse',        category:'bodyColor', rarity:'legendary', value:'#220033' },
  {
    id:'body_prism', name:'Prismatic', category:'bodyColor', rarity:'superleg', value:null, animated:true,
    animFn:(ctx,x,y,r,t) => {
      ctx.fillStyle = `hsl(${(t*60)%360},90%,55%)`;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
  },

  // ── OUTLINE COLORS (18) ──
  { id:'outline_silver',   name:'Silver Rim',     category:'outlineColor', rarity:'common',    value:'#aaaaaa' },
  { id:'outline_white',    name:'Clean White',    category:'outlineColor', rarity:'common',    value:'#ffffff' },
  { id:'outline_dark',     name:'Dark Edge',      category:'outlineColor', rarity:'common',    value:'#333333' },
  { id:'outline_tan',      name:'Warm Tan',       category:'outlineColor', rarity:'common',    value:'#aa8866' },
  { id:'outline_sky',      name:'Sky Blue',       category:'outlineColor', rarity:'common',    value:'#66aadd' },
  { id:'outline_neon',     name:'Neon Pink',      category:'outlineColor', rarity:'uncommon',  value:'#ff44aa' },
  { id:'outline_lime',     name:'Lime',           category:'outlineColor', rarity:'uncommon',  value:'#88ff22' },
  { id:'outline_orange',   name:'Ember Ring',     category:'outlineColor', rarity:'uncommon',  value:'#ff8800' },
  { id:'outline_cyan',     name:'Cyan Streak',    category:'outlineColor', rarity:'uncommon',  value:'#00ddff' },
  { id:'outline_crimson',  name:'Crimson Band',   category:'outlineColor', rarity:'uncommon',  value:'#ee2222' },
  { id:'outline_void',     name:'Shadow Rim',     category:'outlineColor', rarity:'rare',      value:'#220044' },
  { id:'outline_gold',     name:'Gold Band',      category:'outlineColor', rarity:'rare',      value:'#ffcc00' },
  { id:'outline_electric', name:'Electric',       category:'outlineColor', rarity:'rare',      value:'#4400ff' },
  { id:'outline_toxic',    name:'Toxic Ring',     category:'outlineColor', rarity:'rare',      value:'#44ff00' },
  {
    id:'outline_pulse', name:'Pulse Ring', category:'outlineColor', rarity:'legendary', value:'#aa44ff', animated:true,
    animFn:(ctx,x,y,r,t) => {
      ctx.strokeStyle='#aa44ff'; ctx.lineWidth=2+Math.sin(t*3)*1.5;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
    }
  },
  {
    id:'outline_fire', name:'Fire Band', category:'outlineColor', rarity:'legendary', value:'#ff6600', animated:true,
    animFn:(ctx,x,y,r,t) => {
      const f=(Math.sin(t*20)+1)*0.5;
      ctx.strokeStyle=`hsl(${20+f*20},100%,${50+f*15}%)`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
    }
  },
  {
    id:'outline_rainbow', name:'Rainbow Band', category:'outlineColor', rarity:'legendary', value:'#ff0000', animated:true,
    animFn:(ctx,x,y,r,t) => {
      ctx.strokeStyle=`hsl(${(t*120)%360},100%,60%)`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
    }
  },
  {
    id:'outline_void_rift', name:'Void Rift Band', category:'outlineColor', rarity:'superleg', value:'#3c0050', animated:true,
    animFn:(ctx,x,y,r,t) => {
      const phase=t%4; let alpha=0.15;
      if(phase>3.5) alpha=Math.min(0.9,(phase-3.5)*18);
      else if(phase>3.42) alpha=0.9;
      ctx.strokeStyle=`rgba(255,255,255,${alpha})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
    }
  },

  // ── SHAPES (16) ──
  { id:'shape_circle',   name:'Default Circle', category:'shape', rarity:'common',    value:'circle'   },
  { id:'shape_square',   name:'Block',          category:'shape', rarity:'common',    value:'square'   },
  { id:'shape_wide',     name:'Wide Circle',    category:'shape', rarity:'common',    value:'wide'     },
  { id:'shape_tall',     name:'Tall Circle',    category:'shape', rarity:'common',    value:'tall'     },
  { id:'shape_teardrop', name:'Teardrop',       category:'shape', rarity:'uncommon',  value:'teardrop' },
  { id:'shape_triangle', name:'Triangle',       category:'shape', rarity:'uncommon',  value:'triangle' },
  { id:'shape_pentagon', name:'Pentagon',       category:'shape', rarity:'uncommon',  value:'pentagon' },
  { id:'shape_cross',    name:'Plus Sign',      category:'shape', rarity:'uncommon',  value:'cross'    },
  { id:'shape_diamond',  name:'Diamond',        category:'shape', rarity:'rare',      value:'diamond'  },
  { id:'shape_hexagon',  name:'Hexagon',        category:'shape', rarity:'rare',      value:'hexagon'  },
  { id:'shape_arrow',    name:'Arrow',          category:'shape', rarity:'rare',      value:'arrow'    },
  { id:'shape_crescent', name:'Crescent',       category:'shape', rarity:'rare',      value:'crescent' },
  { id:'shape_star',     name:'Star',           category:'shape', rarity:'legendary', value:'star5'    },
  { id:'shape_star6',    name:'Hex Star',       category:'shape', rarity:'legendary', value:'star6'    },
  { id:'shape_gear',     name:'Gear',           category:'shape', rarity:'legendary', value:'gear'     },
  {
    id:'shape_fractal', name:'Fractal Burst', category:'shape', rarity:'superleg', value:'fractal', animated:true,
    animFn:(ctx,x,y,r,t,fillColor) => {
      const lerp=(Math.sin(t*Math.PI)+1)*0.5;
      const pts=12;
      ctx.beginPath();
      for(let i=0;i<pts*2;i++){
        const angle=(i/(pts*2))*Math.PI*2-Math.PI/2;
        const isOuter=i%2===0;
        const baseR=isOuter?r:r*0.5;
        const jagged=isOuter?r+lerp*r*0.7:r*0.35;
        const rad=baseR+(jagged-baseR)*lerp;
        const px=x+Math.cos(angle)*rad, py=y+Math.sin(angle)*rad;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath();
      ctx.fillStyle=fillColor||'#44dd88';
      ctx.fill();
    }
  },

  // ── TRAILS (16) ──
  { id:'trail_white',     name:'Faint White',   category:'trail', rarity:'common',    value:'rgba(255,255,255,0.3)'  },
  { id:'trail_grey',      name:'Smoke',         category:'trail', rarity:'common',    value:'rgba(150,150,150,0.35)' },
  { id:'trail_ice',       name:'Ice Mist',      category:'trail', rarity:'common',    value:'rgba(136,204,238,0.4)'  },
  { id:'trail_ember',     name:'Ember',         category:'trail', rarity:'common',    value:'rgba(238,119,34,0.4)'   },
  { id:'trail_sand',      name:'Dust',          category:'trail', rarity:'common',    value:'rgba(200,168,100,0.3)'  },
  { id:'trail_rose',      name:'Rose Mist',     category:'trail', rarity:'common',    value:'rgba(238,136,153,0.35)' },
  { id:'trail_shadow',    name:'Shadow',        category:'trail', rarity:'uncommon',  value:'rgba(20,0,40,0.5)'      },
  { id:'trail_frost',     name:'Frost',         category:'trail', rarity:'uncommon',  value:'rgba(100,200,255,0.5)'  },
  { id:'trail_toxic',     name:'Toxic',         category:'trail', rarity:'uncommon',  value:'rgba(68,255,34,0.45)'   },
  { id:'trail_crimson',   name:'Blood Trail',   category:'trail', rarity:'uncommon',  value:'rgba(180,0,0,0.45)'     },
  { id:'trail_gold',      name:'Gold Rush',     category:'trail', rarity:'rare',      value:'rgba(255,200,0,0.5)'    },
  { id:'trail_void',      name:'Void Rift',     category:'trail', rarity:'rare',      value:'rgba(30,0,60,0.6)'      },
  { id:'trail_electric',  name:'Electric Arc',  category:'trail', rarity:'rare',      value:'rgba(100,140,255,0.55)' },
  { id:'trail_neon',      name:'Neon Streak',   category:'trail', rarity:'rare',      value:'rgba(255,0,180,0.55)'   },
  { id:'trail_supernova', name:'Supernova',     category:'trail', rarity:'legendary', value:'rgba(255,200,50,0.6)'   },
  {
    id:'trail_prism', name:'Prismatic Rift', category:'trail', rarity:'superleg', value:'prism', animated:true,
    getColor:(t) => `hsl(${(t*80)%360},100%,60%)`
  },

  // ── HIT FLASH (10) ──
  { id:'flash_white',  name:'Clean White',   category:'flash', rarity:'common',    value:'#ffffff' },
  { id:'flash_yellow', name:'Yellow Strike', category:'flash', rarity:'common',    value:'#ffee44' },
  { id:'flash_orange', name:'Orange Flare',  category:'flash', rarity:'common',    value:'#ff8800' },
  { id:'flash_teal',   name:'Teal Pop',      category:'flash', rarity:'common',    value:'#44ddbb' },
  { id:'flash_pink',   name:'Pink Burst',    category:'flash', rarity:'uncommon',  value:'#ff44cc' },
  { id:'flash_lime',   name:'Lime Snap',     category:'flash', rarity:'uncommon',  value:'#88ff00' },
  { id:'flash_gold',   name:'Gold Burst',    category:'flash', rarity:'uncommon',  value:'#ffcc00' },
  { id:'flash_violet', name:'Violet Pulse',  category:'flash', rarity:'rare',      value:'#aa00ff' },
  { id:'flash_void',   name:'Void Strike',   category:'flash', rarity:'rare',      value:'#000000' },
  {
    id:'flash_prism', name:'Prism Hit', category:'flash', rarity:'superleg', value:'prism', animated:true,
    getFlashColor:() => `hsl(${((window._prismHitIndex=(window._prismHitIndex||0)+1)*45)%360},100%,65%)`
  },

  // ── DEATH BURST (6) ──
  { id:'burst_orange', name:'Ember Burst',   category:'deathBurst', rarity:'common',    value:'#ee7722' },
  { id:'burst_blue',   name:'Frost Shatter', category:'deathBurst', rarity:'common',    value:'#88ccee' },
  { id:'burst_green',  name:'Toxic Pop',     category:'deathBurst', rarity:'uncommon',  value:'#44ff22' },
  { id:'burst_violet', name:'Shadow Burst',  category:'deathBurst', rarity:'rare',      value:'#5500aa' },
  { id:'burst_gold',   name:'Gold Shatter',  category:'deathBurst', rarity:'legendary', value:'#ffcc00' },
  { id:'burst_void',   name:'Void Collapse', category:'deathBurst', rarity:'superleg',  value:'#110022' },

  // ── AURA (6) ──
  { id:'aura_faint_blue',   name:'Ice Halo',      category:'aura', rarity:'common',    value:'faint_blue'   },
  { id:'aura_faint_gold',   name:'Warm Halo',     category:'aura', rarity:'common',    value:'faint_gold'   },
  { id:'aura_pulse_purple', name:'Pulse Ring',    category:'aura', rarity:'rare',      value:'pulse_purple' },
  { id:'aura_fire',         name:'Fire Halo',     category:'aura', rarity:'legendary', value:'fire'         },
  { id:'aura_void',         name:'Void Aura',     category:'aura', rarity:'legendary', value:'void'         },
  {
    id:'aura_reactive', name:'Reactive Crown', category:'aura', rarity:'superleg', value:'reactive', animated:true,
  },
];

// Fast lookup by id
export const CosmeticById = {};
for (const c of CosmeticDefinitions) CosmeticById[c.id] = c;

// Get a prismatic color for UI elements that need to cycle (pass performance.now()/1000)
export function getPrismaticColor(t, sat=100, lig=60) {
  return `hsl(${(t*60)%360},${sat}%,${lig}%)`;
}

// ── Roll Logic ──────────────────────────────────────────────────────────────────

const RARITY_ORDER = ['common','uncommon','rare','legendary','superleg'];

export function rollBox(tier, ownedIds = []) {
  const weights = BOX_WEIGHTS[tier] || BOX_WEIGHTS.bronze;
  const total = RARITY_ORDER.reduce((s,r) => s + (weights[r]||0), 0);
  let roll = Math.random() * total;
  let rarity = 'common';
  for (const r of RARITY_ORDER) {
    roll -= (weights[r]||0);
    if (roll <= 0) { rarity = r; break; }
  }

  let pool = CosmeticDefinitions.filter(c => c.rarity === rarity);
  const unowned = pool.filter(c => !ownedIds.includes(c.id));
  if (unowned.length > 0) pool = unowned;

  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Canvas Drawing Helpers ───────────────────────────────────────────────────────

// Draw a polygon path (does NOT call fill/stroke)
function _polygon(ctx, x, y, r, sides, startAngle=0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (i/sides)*Math.PI*2;
    if (i===0) ctx.moveTo(x+Math.cos(a)*r, y+Math.sin(a)*r);
    else ctx.lineTo(x+Math.cos(a)*r, y+Math.sin(a)*r);
  }
  ctx.closePath();
}

// Draw a star path (does NOT call fill/stroke)
function _star(ctx, x, y, outerR, innerR, points) {
  ctx.beginPath();
  for (let i = 0; i < points*2; i++) {
    const a = (i/(points*2))*Math.PI*2 - Math.PI/2;
    const r = i%2===0 ? outerR : innerR;
    if (i===0) ctx.moveTo(x+Math.cos(a)*r, y+Math.sin(a)*r);
    else ctx.lineTo(x+Math.cos(a)*r, y+Math.sin(a)*r);
  }
  ctx.closePath();
}

// Draw gear path (does NOT call fill/stroke)
function _gear(ctx, x, y, r, teeth) {
  const inner = r*0.65;
  ctx.beginPath();
  for (let i = 0; i < teeth*2; i++) {
    const a = (i/(teeth*2))*Math.PI*2 - Math.PI/2;
    const rr = i%2===0 ? r : inner;
    if (i===0) ctx.moveTo(x+Math.cos(a)*rr, y+Math.sin(a)*rr);
    else ctx.lineTo(x+Math.cos(a)*rr, y+Math.sin(a)*rr);
  }
  ctx.closePath();
}

/**
 * Build a path for the given shape. Caller is responsible for fill/stroke.
 * Exception: 'fractal' uses animFn and must be called separately.
 */
export function drawPlayerShape(ctx, x, y, r, shape) {
  switch (shape) {
    case 'square':
      ctx.beginPath();
      ctx.rect(x-r, y-r, r*2, r*2);
      break;
    case 'wide':
      ctx.beginPath();
      ctx.ellipse(x, y, r*1.4, r*0.75, 0, 0, Math.PI*2);
      break;
    case 'tall':
      ctx.beginPath();
      ctx.ellipse(x, y, r*0.75, r*1.4, 0, 0, Math.PI*2);
      break;
    case 'teardrop':
      ctx.beginPath();
      ctx.moveTo(x, y-r);
      ctx.bezierCurveTo(x+r, y-r*0.5, x+r*0.7, y+r*0.5, x, y+r);
      ctx.bezierCurveTo(x-r*0.7, y+r*0.5, x-r, y-r*0.5, x, y-r);
      ctx.closePath();
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(x, y-r);
      ctx.lineTo(x+r*0.87, y+r*0.5);
      ctx.lineTo(x-r*0.87, y+r*0.5);
      ctx.closePath();
      break;
    case 'pentagon':
      _polygon(ctx, x, y, r, 5, -Math.PI/2);
      break;
    case 'hexagon':
      _polygon(ctx, x, y, r, 6, 0);
      break;
    case 'cross':
      ctx.beginPath();
      ctx.rect(x-r*0.35, y-r, r*0.7, r*2);
      ctx.rect(x-r, y-r*0.35, r*2, r*0.7);
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(x, y-r);
      ctx.lineTo(x+r, y);
      ctx.lineTo(x, y+r);
      ctx.lineTo(x-r, y);
      ctx.closePath();
      break;
    case 'arrow':
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.lineTo(x-r*0.4, y-r);
      ctx.lineTo(x-r*0.15, y);
      ctx.lineTo(x-r*0.4, y+r);
      ctx.closePath();
      break;
    case 'crescent':
      ctx.beginPath();
      ctx.arc(x, y, r, -Math.PI*0.75, Math.PI*0.75);
      ctx.arc(x+r*0.35, y, r*0.72, Math.PI*0.75, -Math.PI*0.75, true);
      ctx.closePath();
      break;
    case 'star5':
      _star(ctx, x, y, r, r*0.42, 5);
      break;
    case 'star6':
      _star(ctx, x, y, r, r*0.5, 6);
      break;
    case 'gear':
      _gear(ctx, x, y, r, 8);
      break;
    default: // circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI*2);
      break;
  }
}

/**
 * Draw the player's aura ring (called from player.draw and cosmetic preview).
 * tempoValue is the current tempo (0-100), used only by reactive aura.
 */
export function drawPlayerAura(ctx, x, y, r, auraValue, t, tempoValue=50) {
  switch (auraValue) {
    case 'faint_blue':
      ctx.beginPath(); ctx.arc(x, y, r+7, 0, Math.PI*2);
      ctx.strokeStyle='rgba(100,160,255,0.35)'; ctx.lineWidth=5; ctx.stroke();
      break;
    case 'faint_gold':
      ctx.beginPath(); ctx.arc(x, y, r+7, 0, Math.PI*2);
      ctx.strokeStyle='rgba(255,180,50,0.35)'; ctx.lineWidth=5; ctx.stroke();
      break;
    case 'pulse_purple': {
      const pulse=(Math.sin(t*2)+1)*0.5;
      ctx.beginPath(); ctx.arc(x, y, r+6+pulse*8, 0, Math.PI*2);
      ctx.strokeStyle=`rgba(160,50,255,${0.2+pulse*0.35})`; ctx.lineWidth=3; ctx.stroke();
      break;
    }
    case 'fire': {
      const f=Math.sin(t*15+x)*0.3+0.7;
      ctx.beginPath(); ctx.arc(x, y, r+6+f*4, 0, Math.PI*2);
      ctx.strokeStyle=`rgba(255,${(100+f*80)|0},0,0.5)`; ctx.lineWidth=2+f; ctx.stroke();
      break;
    }
    case 'void':
      ctx.beginPath(); ctx.arc(x, y, r+16, 0, Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fill();
      break;
    case 'reactive': {
      let rgb;
      if (tempoValue < 30) rgb='80,140,255';
      else if (tempoValue < 70) rgb='50,220,120';
      else if (tempoValue < 90) rgb='255,130,30';
      else rgb='255,50,50';
      const rr=r+8+tempoValue*0.12;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI*2);
      ctx.strokeStyle=`rgba(${rgb},0.55)`; ctx.lineWidth=3; ctx.stroke();
      break;
    }
    default: break;
  }
}
