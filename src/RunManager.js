export class RunManager {
  constructor() {
    this.floor = 1;
    this.currentNodeId = 'start';
    this.layers = [];
    this.nodeMap = {};
    this.maxLayers = 8;
  }

  generateMap() {
    this.layers = [];
    this.nodeMap = {};
    
    // Define widths per layer (Y coords)
    const layerWidths = [1, 2, 3, 2, 3, 2, 1, 1];
    
    for (let i = 0; i < this.maxLayers; i++) {
        let currentWidth = layerWidths[i];
        let layerNodes = [];

        for (let j = 0; j < currentWidth; j++) {
            let type = 'fight';
            if (i === 0) type = 'start'; // Implicit fight
            else if (i === this.maxLayers - 1) type = 'boss';
            else if (i === this.maxLayers - 2) type = 'rest';
            else if (i === Math.floor(this.maxLayers / 2)) type = 'rest';
            else {
                let r = Math.random();
                if (r < 0.6) type = 'fight';
                else if (r < 0.85) type = 'elite';
                else type = 'rest';
            }

            let id = `layer${i}_node${j}`;
            let node = { id, layer: i, index: j, type, next: [], resolved: false, xPos: j / Math.max(1, currentWidth - 1) }; // 0 to 1
            if (currentWidth === 1) node.xPos = 0.5;

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
            // Connect to nearest ones in next layer
            for (let k = 0; k < nextLayer.length; k++) {
                let nextNode = nextLayer[k];
                // Simple bridging logic: 
                // If moving from 1 to 2, it connects to both.
                // If moving from 2 to 3, 0->0,1; 1->1,2
                // Since this is a small game, nodes can just connect if their xPos is close.
                let xDist = Math.abs(node.xPos - nextNode.xPos);
                if (xDist <= 0.6) {
                    node.next.push(nextNode.id);
                }
            }
            // Fallback if no connection generated
            if (node.next.length === 0) node.next.push(nextLayer[0].id);
        }
    }

    // Player starts ON the first node — they click layer-1 nodes to begin
    this.layers[0][0].resolved = true;
    this.currentNodeId = this.layers[0][0].id;
    console.log(`[Map] Generated ${this.maxLayers}-layer map for Floor ${this.floor}. Start node: ${this.currentNodeId}. Next targets: [${this.nodeMap[this.currentNodeId].next.join(', ')}]`);
  }

  getCurrentNode() {
      if (!this.currentNodeId) return null;
      return this.nodeMap[this.currentNodeId];
  }

  handleMapClick(mx, my, width, height) {
      if (!this.clickSpheres || !this.currentNodeId) {
          console.log('[Map] Click ignored: no spheres or no currentNodeId');
          return null;
      }
      
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
                  console.log(`[Map] Advanced to node "${sphere.id}" type="${selectedNode.type}". Next: [${selectedNode.next.join(', ')}]`);
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
    ctx.fillText(`FLOOR ${this.floor} MAP`, width / 2, 60);

    const START_Y = height - 100;
    const END_Y = 120;
    const gapY = (START_Y - END_Y) / (this.maxLayers - 1);

    this.clickSpheres = [];

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
              
              if (isCurr) {
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 3;
              } else {
                  ctx.strokeStyle = '#444';
                  ctx.lineWidth = 2;
              }
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
            
            // Store collision data
            this.clickSpheres.push({x: cx, y: cy, r: rad + 10, id: node.id});

            ctx.beginPath();
            ctx.arc(cx, cy, rad, 0, Math.PI * 2);
            
            if (isCurrent) ctx.fillStyle = '#fff';
            else if (isValidNext) ctx.fillStyle = '#44aaff';
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

            ctx.fillStyle = isValidNext ? '#fff' : '#888';
            if (isCurrent) ctx.fillStyle = '#ffaa00';
            ctx.font = 'bold 12px monospace';
            
            if (node.type === 'elite') {
                ctx.fillStyle = isValidNext ? '#ff6666' : '#884444';
                ctx.fillText('ELITE', cx + rad + 15, cy + 4);
            } else if (node.type === 'rest') {
                ctx.fillStyle = isValidNext ? '#44ffaa' : '#228855';
                ctx.fillText('REST', cx + rad + 15, cy + 4);
            } else if (node.type === 'boss') {
                ctx.fillStyle = '#ffaa00';
                ctx.font = 'bold 16px monospace';
                ctx.fillText('BOSS', cx + rad + 15, cy + 5);
            }
        }
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('CLICK A GLOWING NODE TO TRAVEL', width / 2, height - 30);
  }
}
