export class RunManager {
  constructor() {
    this.floor = 1;
    this.currentNodeId = 'start';
    this.layers = [];
    this.nodeMap = {};
    this.maxLayers = 8;
    this.seed = 0;
    this.rng = null;
    // PERF-02: offscreen canvas cache for map grid background
    this._mapGridCache = null;
    this._mapGridW = 0;
    this._mapGridH = 0;
  }

  // Simple seeded RNG (mulberry32)
  _createRng(seed) {
    let t = seed;
    return () => {
      t = (t + 0x6D2B79F5) | 0;
      let v = t;
      v = Math.imul(v ^ (v >>> 15), v | 1);
      v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
      return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
    };
  }

  setSeed(seed) {
    this.seed = seed;
    this.rng = this._createRng(seed);
  }

  getRng() {
    return this.rng || Math.random;
  }

  generateMap() {
    if (!this.rng) this.setSeed(Date.now());
    const rng = this.rng;

    this.layers = [];
    this.nodeMap = {};

    const layerWidths = [1, 2, 3, 2, 3, 2, 1, 1];

    for (let i = 0; i < this.maxLayers; i++) {
      let currentWidth = layerWidths[i];
      let layerNodes = [];

      for (let j = 0; j < currentWidth; j++) {
        let type = 'fight';
        if (i === 0) type = 'start';
        else if (i === this.maxLayers - 1) type = 'boss';
        else if (i === this.maxLayers - 2) type = 'rest';
        else {
          let r = rng();
          if (r < 0.40)      type = 'fight';
          else if (r < 0.60) type = 'elite';
          else if (r < 0.75) type = 'event';
          else if (r < 0.96) type = 'shop';
          else               type = 'rest';
        }

        let id = `layer${i}_node${j}`;
        let node = {
          id, layer: i, index: j, type,
          next: [], resolved: false,
          xPos: currentWidth === 1 ? 0.5 : j / Math.max(1, currentWidth - 1)
        };

        layerNodes.push(node);
        this.nodeMap[id] = node;
      }
      this.layers.push(layerNodes);
    }

    // Connect layers
    for (let i = 0; i < this.maxLayers - 1; i++) {
      let currentLayer = this.layers[i];
      let nextLayer = this.layers[i + 1];

      for (let j = 0; j < currentLayer.length; j++) {
        let node = currentLayer[j];
        for (let k = 0; k < nextLayer.length; k++) {
          let nextNode = nextLayer[k];
          let xDist = Math.abs(node.xPos - nextNode.xPos);
          if (xDist <= 0.6) {
            node.next.push(nextNode.id);
          }
        }
        if (node.next.length === 0) node.next.push(nextLayer[0].id);
      }
    }

    this.layers[0][0].resolved = true;
    this.currentNodeId = this.layers[0][0].id;
    this._mapGridCache = null; // PERF-02: invalidate cache on new floor
    console.log(`[Map] Generated ${this.maxLayers}-layer map for Floor ${this.floor} (seed: ${this.seed})`);
  }

  getCurrentNode() {
    if (!this.currentNodeId) return null;
    return this.nodeMap[this.currentNodeId];
  }

  // Returns the number of node layers remaining until the boss layer
  getLayersToEnd() {
    const curr = this.nodeMap[this.currentNodeId];
    if (!curr) return 0;
    return (this.maxLayers - 1) - curr.layer;
  }

  handleMapClick(mx, my, width, height) {
    if (!this.clickSpheres || !this.currentNodeId) return null;

    let curr = this.nodeMap[this.currentNodeId];
    if (!curr) return null;

    let validTargets = curr.next;

    for (let sphere of this.clickSpheres) {
      if (validTargets.includes(sphere.id)) {
        const dx = mx - sphere.x;
        const dy = my - sphere.y;
        if (dx*dx + dy*dy <= sphere.r * sphere.r) {
          this.currentNodeId = sphere.id;
          let selectedNode = this.nodeMap[sphere.id];
          console.log(`[Map] Advanced to node "${sphere.id}" type="${selectedNode.type}"`);
          return selectedNode;
        }
      }
    }
    return null;
  }

  drawMap(ctx, width, height) {
    // Background — darker toward the edges, act-themed
    const floorThemes = [
      { bg: '#0d0d18', col: '#44aaff', name: '' },
      { bg: '#0e0a10', col: '#cc66ff', name: '— CATACOMBS' },
      { bg: '#100808', col: '#ff6644', name: '— THE CITADEL' },
      { bg: '#060512', col: '#00eedd', name: '— THE ABYSS' },
      { bg: '#100e06', col: '#ffd700', name: '— THE APEX' },
    ];
    const theme = floorThemes[Math.min(this.floor - 1, 4)];

    // PERF-02: cache map background grid to offscreen canvas
    if (!this._mapGridCache || this._mapGridW !== width || this._mapGridH !== height) {
      const off = document.createElement('canvas');
      off.width = width; off.height = height;
      const octx = off.getContext('2d');
      octx.fillStyle = theme.bg;
      octx.fillRect(0, 0, width, height);
      octx.strokeStyle = 'rgba(255,255,255,0.02)';
      octx.lineWidth = 1;
      for (let gx = 0; gx < width; gx += 60) {
        octx.beginPath(); octx.moveTo(gx, 0); octx.lineTo(gx, height); octx.stroke();
      }
      for (let gy = 0; gy < height; gy += 60) {
        octx.beginPath(); octx.moveTo(0, gy); octx.lineTo(width, gy); octx.stroke();
      }
      this._mapGridCache = off;
      this._mapGridW = width;
      this._mapGridH = height;
    }
    ctx.drawImage(this._mapGridCache, 0, 0);

    // Header bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, width, 80);

    ctx.fillStyle = theme.col;
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ACT ${this.floor}${theme.name}`, width / 2, 46);

    ctx.fillStyle = '#555';
    ctx.font = '12px monospace';
    ctx.fillText('Choose your path — click a glowing room', width / 2, 68);

    const START_Y = height - 90;
    const END_Y = 110;
    const gapY = (START_Y - END_Y) / (this.maxLayers - 1);

    this.clickSpheres = [];

    // PERF-01: compute once instead of per-node
    const t = Date.now() / 1000;

    // Room type config: color, icon emoji, label
    const nodeConfig = {
      start:  { col: '#888888', icon: '◉', label: '' },
      fight:  { col: '#cc3333', icon: '⚔', label: 'FIGHT' },
      elite:  { col: '#ff6644', icon: '★', label: 'ELITE' },
      rest:   { col: '#44dd88', icon: '+', label: 'REST' },
      boss:   { col: '#ffaa00', icon: '☠', label: 'BOSS' },
      event:  { col: '#dd88ff', icon: '?', label: 'EVENT' },
      shop:   { col: '#44aaff', icon: '$', label: 'SHOP' },
    };

    // First pass: connections (PERF-06: setLineDash only when needed)
    ctx.setLineDash([]);
    for (let i = 0; i < this.maxLayers; i++) {
      for (const node of this.layers[i]) {
        const cy = START_Y - (node.layer * gapY);
        const cx = (width * 0.25) + node.xPos * (width * 0.5);
        for (const nextId of node.next) {
          const nextNode = this.nodeMap[nextId];
          const ny = START_Y - (nextNode.layer * gapY);
          const nx = (width * 0.25) + nextNode.xPos * (width * 0.5);
          const isPast = node.layer < (this.nodeMap[this.currentNodeId]?.layer || 0);
          ctx.strokeStyle = isPast ? '#2a2a3a' : '#333355';
          ctx.lineWidth = isPast ? 1 : 1.5;
          if (isPast) { ctx.setLineDash([4, 6]); }
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(nx, ny);
          ctx.stroke();
          if (isPast) { ctx.setLineDash([]); }
        }
      }
    }

    // Current node highlight connections
    const currNode = this.nodeMap[this.currentNodeId];
    let validTargets = currNode ? currNode.next : [];
    if (currNode) {
      const cy = START_Y - (currNode.layer * gapY);
      const cx = (width * 0.25) + currNode.xPos * (width * 0.5);
      for (const nextId of validTargets) {
        const nn = this.nodeMap[nextId];
        const ny = START_Y - (nn.layer * gapY);
        const nx = (width * 0.25) + nn.xPos * (width * 0.5);
        const pulse = 0.4 + Math.sin(t * 3) * 0.3;
        ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
    }

    // Second pass: nodes (PERF-03: default font set once, override only for boss)
    ctx.font = 'bold 13px monospace';
    for (let i = 0; i < this.maxLayers; i++) {
      for (const node of this.layers[i]) {
        const cy = START_Y - (node.layer * gapY);
        const cx = (width * 0.25) + node.xPos * (width * 0.5);
        const cfg = nodeConfig[node.type] || nodeConfig.fight;

        const isCurrent = node.id === this.currentNodeId;
        const isValidNext = validTargets.includes(node.id);
        const isPast = node.layer < (currNode?.layer || 0);
        const isBoss = node.type === 'boss';

        let rad = isBoss ? 26 : (node.type === 'elite' ? 18 : 15);
        this.clickSpheres.push({ x: cx, y: cy, r: rad + 12, id: node.id });

        // Glow for valid next nodes
        if (isValidNext) {
          const glowR = rad + 10 + Math.sin(t * 3) * 4;
          ctx.save();
          ctx.shadowColor = cfg.col;
          ctx.shadowBlur = 20;
          ctx.strokeStyle = cfg.col + 'aa';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Node body
        ctx.beginPath();
        if (node.type === 'event') {
          ctx.moveTo(cx, cy - rad);
          ctx.lineTo(cx + rad, cy);
          ctx.lineTo(cx, cy + rad);
          ctx.lineTo(cx - rad, cy);
          ctx.closePath();
        } else if (node.type === 'shop') {
          ctx.roundRect(cx - rad, cy - rad, rad * 2, rad * 2, 5);
        } else {
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        }

        if (isCurrent) {
          ctx.fillStyle = '#ffffff';
        } else if (isValidNext) {
          ctx.fillStyle = cfg.col;
        } else if (isPast) {
          ctx.fillStyle = '#1a1a28';
        } else {
          ctx.fillStyle = '#0d0d18';
        }
        ctx.fill();

        ctx.strokeStyle = isCurrent ? '#ffaa00' : (isValidNext ? '#ffffff' : (isPast ? '#222' : '#334'));
        ctx.lineWidth = isCurrent ? 3 : (isValidNext ? 2 : 1);
        ctx.stroke();

        // Icon text (PERF-03: only set font for boss nodes, others use the default set above)
        ctx.fillStyle = isCurrent ? '#000' : (isValidNext ? '#fff' : (isPast ? '#333' : '#222'));
        if (isBoss) ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(cfg.icon, cx, cy + (isBoss ? 6 : 5));
        if (isBoss) ctx.font = 'bold 13px monospace'; // restore

        // Label below node
        if (cfg.label) {
          ctx.fillStyle = isCurrent ? '#ffaa00' : (isValidNext ? cfg.col : (isPast ? '#444' : '#555566'));
          if (isBoss) ctx.font = 'bold 15px monospace';
          ctx.fillText(cfg.label, cx, cy + rad + 17);
          if (isBoss) ctx.font = 'bold 13px monospace'; // restore default
        }
      }
    }

    // IDEA-11: Boss proximity warning
    const layersLeft = this.getLayersToEnd();
    if (layersLeft <= 2 && layersLeft > 0) {
      const pulse = 0.6 + Math.sin(t * 4) * 0.4;
      ctx.save();
      ctx.fillStyle = `rgba(255,100,0,${pulse * 0.15})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      ctx.fillStyle = `rgba(255,${layersLeft === 1 ? 50 : 120},0,${0.7 + pulse * 0.3})`;
      ctx.font = `bold ${layersLeft === 1 ? 18 : 15}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(layersLeft === 1 ? '⚠ BOSS NEXT ⚠' : '⚠ BOSS NEAR', width / 2, height - 60);
    }

    // Footer
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, height - 48, width, 48);
    ctx.fillStyle = '#44ff88';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Click a glowing room to advance', width / 2, height - 18);
  }
}
