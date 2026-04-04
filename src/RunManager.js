export class RunManager {
  constructor() {
    this.floor = 1;
    this.currentNodeId = 'start';
    this.layers = [];
    this.nodeMap = {};
    this.maxLayers = 8;
    this.seed = 0;
    this.rng = null;
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
        else if (i === Math.floor(this.maxLayers / 2)) type = 'rest';
        else {
          let r = rng();
          if (r < 0.40)      type = 'fight';
          else if (r < 0.60) type = 'elite';
          else if (r < 0.75) type = 'event';
          else if (r < 0.88) type = 'shop';
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
    console.log(`[Map] Generated ${this.maxLayers}-layer map for Floor ${this.floor} (seed: ${this.seed})`);
  }

  getCurrentNode() {
    if (!this.currentNodeId) return null;
    return this.nodeMap[this.currentNodeId];
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
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`FLOOR ${this.floor} MAP`, width / 2, 50);

    // Seed display
    ctx.fillStyle = '#555';
    ctx.font = '12px monospace';
    ctx.fillText(`Seed: ${this.seed}`, width / 2, 70);

    const START_Y = height - 100;
    const END_Y = 120;
    const gapY = (START_Y - END_Y) / (this.maxLayers - 1);

    this.clickSpheres = [];

    const nodeColors = {
      start: '#aaa', fight: '#cc4444', elite: '#ff6666',
      rest: '#44ffaa', boss: '#ffaa00', event: '#ff88ff', shop: '#44aaff'
    };
    const nodeLabels = {
      fight: '', elite: 'ELITE', rest: 'REST', boss: 'BOSS', event: 'EVENT', shop: 'SHOP', start: ''
    };

    // First pass: Draw connections
    ctx.lineWidth = 2;
    for (let i = 0; i < this.maxLayers; i++) {
      for (let node of this.layers[i]) {
        const cy = START_Y - (node.layer * gapY);
        const cx = (width * 0.3) + node.xPos * (width * 0.4);
        let isCurr = (this.currentNodeId === node.id);

        for (let nextId of node.next) {
          let nextNode = this.nodeMap[nextId];
          const ny = START_Y - (nextNode.layer * gapY);
          const nx = (width * 0.3) + nextNode.xPos * (width * 0.4);

          if (isCurr) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; }
          else { ctx.strokeStyle = '#444'; ctx.lineWidth = 2; }
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(nx, ny);
          ctx.stroke();
        }
      }
    }

    // Second pass: Draw nodes
    let validTargets = [];
    if (this.currentNodeId && this.nodeMap[this.currentNodeId]) {
      validTargets = this.nodeMap[this.currentNodeId].next;
    }

    for (let i = 0; i < this.maxLayers; i++) {
      for (let node of this.layers[i]) {
        const cy = START_Y - (node.layer * gapY);
        const cx = (width * 0.3) + node.xPos * (width * 0.4);

        let isCurrent = (node.id === this.currentNodeId);
        let isValidNext = validTargets.includes(node.id);
        let isPast = (node.layer < this.nodeMap[this.currentNodeId]?.layer);

        let rad = 14;
        if (node.type === 'boss') rad = 24;
        if (node.type === 'event' || node.type === 'shop') rad = 16;

        this.clickSpheres.push({ x: cx, y: cy, r: rad + 10, id: node.id });

        // Node icon
        ctx.beginPath();
        if (node.type === 'event') {
          // Diamond
          ctx.moveTo(cx, cy - rad); ctx.lineTo(cx + rad, cy);
          ctx.lineTo(cx, cy + rad); ctx.lineTo(cx - rad, cy); ctx.closePath();
        } else if (node.type === 'shop') {
          // Square with rounded corners
          ctx.beginPath();
          ctx.roundRect(cx - rad, cy - rad, rad * 2, rad * 2, 5);
        } else {
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        }

        if (isCurrent) ctx.fillStyle = '#fff';
        else if (isValidNext) ctx.fillStyle = nodeColors[node.type] || '#44aaff';
        else if (isPast) ctx.fillStyle = '#333';
        else ctx.fillStyle = '#111';
        ctx.fill();

        if (isValidNext) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = Math.sin(Date.now() / 150) * 2 + 3;
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Label
        const label = nodeLabels[node.type] || '';
        if (label) {
          ctx.fillStyle = isValidNext ? (nodeColors[node.type] || '#fff') : '#666';
          if (isCurrent) ctx.fillStyle = '#ffaa00';
          ctx.font = node.type === 'boss' ? 'bold 16px monospace' : 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(label, cx + rad + 22, cy + 4);
        }
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CLICK A GLOWING NODE TO TRAVEL', width / 2, height - 30);
  }
}
