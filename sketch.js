const palettes = {
  '01': ['#780000', '#c1121f', '#fdf0d5', '#003049', '#669bbc'],
  '02': ['#353535', '#3c6e71', '#ffffff', '#d9d9d9', '#284b63'],
  '03': ['#f4f1de', '#e07a5f', '#3d405b', '#81b29a', '#f2cc8f'],
  '04': ['#606c38', '#283618', '#fefae0', '#dda15e', '#bc6c25'],
  '05': ['#8ecae6', '#219ebc', '#023047', '#ffb703', '#fb8500']
};

const paletteKeys = Object.keys(palettes);
let paletteIndex = 0;
let paletteHex = palettes[paletteKeys[paletteIndex]];
let palette = [];
let paletteStart = [];
let paletteTarget = [];
let paletteTransition = 1;
const paletteTransitionDuration = 45;
let grid = [];
let gridCols = 9;
let gridRows = 10;
let cellW = 0;
let cellH = 0;
let controlsContainer;
let colsSlider;
let rowsSlider;
let driftSlider;
let focusSlider;
let driftStrength = 2;
let focusStrength = 0.06;
const linkStrength = 1.2;
const propagationLag = 6;
const transitionDuration = 60;
const shapeCount = 3;
let shapeState = 0;
let hoverRow = 0;
let hoverCol = 0;
let overUI = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noCursor();
  applyPalette(paletteIndex);
  initUI();
  syncSettingsFromSliders(false);
  initGrid();
  smooth();
}

function initGrid() {
  grid = [];
  if (gridCols < 1 || gridRows < 1) {
    return;
  }
  cellW = width / (gridCols + 1);
  cellH = height / (gridRows + 1);
  for (let r = 0; r < gridRows; r++) {
    const row = [];
    for (let c = 0; c < gridCols; c++) {
      const x = (c + 1) * cellW;
      const y = (r + 1) * cellH;
      row.push({
        baseX: x,
        baseY: y,
        x,
        y,
        seed: random(1000),
        tension: 0,
        influence: 0,
        shapeOrigin: shapeState,
        shapeGoal: shapeState,
        shapeProgress: 1,
        waveStartFrame: 0,
      });
    }
    grid.push(row);
  }
}

function draw() {
  updatePaletteBlend();
  background(palette[2]);
  if (grid.length === 0) {
    return;
  }

  const time = frameCount * 0.01;
  const highlightCol = constrain(floor(map(mouseX, 0, width, 0, gridCols)), 0, gridCols - 1);
  const highlightRow = constrain(floor(map(mouseY, 0, height, 0, gridRows)), 0, gridRows - 1);
  hoverCol = highlightCol;
  hoverRow = highlightRow;

  updateGrid(time, highlightRow, highlightCol);
  drawStructuralLinks();
  drawCells(highlightRow, highlightCol, time);
  drawGuides(highlightRow, highlightCol);
  drawPointer();
}

function updateGrid(time, highlightRow, highlightCol) {
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const node = grid[r][c];
      const phase = time + node.seed * 0.2;
      const noiseX = (noise(node.seed, time * 0.35) - 0.5) * cellW * 0.55;
      const noiseY = (noise(node.seed + 200, time * 0.35) - 0.5) * cellH * 0.55;
      const columnDiscipline = map(c, 0, gridCols - 1, -cellW * 0.08, cellW * 0.08);
      const rowDiscipline = map(r, 0, gridRows - 1, -cellH * 0.08, cellH * 0.08);
      const influence = exp(-dist(mouseX, mouseY, node.baseX, node.baseY) / 180);
      const circularPull = influence * focusStrength * 5.2;
      const mousePullX = (mouseX - node.baseX) * circularPull;
      const mousePullY = (mouseY - node.baseY) * circularPull;
      const breathing = sin(phase * 1.3) * 0.5;

      node.x = node.baseX + noiseX * driftStrength + columnDiscipline + mousePullX;
      node.y = node.baseY + noiseY * driftStrength + rowDiscipline + mousePullY;
      node.tension = breathing;
      node.influence = influence;
      updateShapeTransition(node);
    }
  }
}

function drawStructuralLinks() {
  const structureColor = color(palette[3]);
  structureColor.setAlpha(110);
  stroke(structureColor);
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const node = grid[r][c];
      if (c < gridCols - 1) {
        const right = grid[r][c + 1];
        const weight = 1 + (node.influence + right.influence) * linkStrength;
        strokeWeight(weight);
        line(node.x, node.y, right.x, right.y);
      }
      if (r < gridRows - 1) {
        const below = grid[r + 1][c];
        const weight = 1 + (node.influence + below.influence) * linkStrength;
        strokeWeight(weight);
        line(node.x, node.y, below.x, below.y);
      }
    }
  }
}

function drawCells(highlightRow, highlightCol, time) {
  rectMode(CENTER);
  const focusColor = color(palette[1]);
  focusColor.setAlpha(240);

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const node = grid[r][c];
      const focus = r === highlightRow && c === highlightCol;

      push();
      translate(node.x, node.y);

      const noiseFactor = map(noise(node.seed + 400, time * 0.6), 0, 1, 0.45, 0.9);
      const baseWidth = cellW * 0.55 * noiseFactor;
      const baseHeight = cellH * 0.4 * noiseFactor;
      const baseSize = max(baseWidth, baseHeight);

      const originIndex = node.shapeOrigin;
      const targetIndex = node.shapeGoal;
      const sameShape = originIndex === targetIndex;
      const blend = sameShape ? 1 : constrain(node.shapeProgress, 0, 1);
      const originWeight = sameShape ? 1 : 1 - blend;
      const targetWeight = sameShape ? 0 : blend;

      const spinBase = node.tension * 0.4 + sin(time * 0.5 + r * 0.3) * 0.1;
      const originSpin = spinBase + originIndex * 0.22;
      const targetSpin = spinBase + targetIndex * 0.22;
      const rotation = sameShape ? originSpin : lerp(originSpin, targetSpin, blend);
      rotate(rotation);

      const dims = {
        w: baseWidth,
        h: baseHeight,
        size: baseSize,
        noiseFactor,
        node,
        time,
      };

      if (originWeight > 0.001) {
        drawShapeVariant(originIndex, originWeight, dims);
      }
      if (targetWeight > 0.001) {
        drawShapeVariant(targetIndex, targetWeight, dims);
      }

      const highlightSize = baseSize * lerp(1, 1.2, targetWeight);
      if (focus) {
        noFill();
        stroke(focusColor);
        strokeWeight(2.3);
        ellipse(0, 0, highlightSize * 1.6, highlightSize * 1.6);
        fill(focusColor);
        noStroke();
        ellipse(0, 0, highlightSize * 0.42, highlightSize * 0.42);
      } else if (node.influence > 0.25) {
        const glowScale = map(node.influence, 0.25, 1, 0.4, 1.05);
        noStroke();
        const glowColor = color(palette[1]);
        glowColor.setAlpha(120);
        fill(glowColor);
        ellipse(0, 0, highlightSize * 0.6 * glowScale, highlightSize * 0.6 * glowScale);
      }
      pop();
    }
  }
}

function drawShapeVariant(shapeIndex, weight, dims) {
  if (weight <= 0) {
    return;
  }
  switch (shapeIndex % shapeCount) {
    case 0:
      drawArrayFrameShape(weight, dims);
      break;
    case 1:
      drawHexBloomShape(weight, dims);
      break;
    case 2:
      drawTriangleWeaveShape(weight, dims);
      break;
  }
}

function drawArrayFrameShape(weight, dims) {
  const { w, h, node } = dims;
  const frameColor = color(palette[4]);
  frameColor.setAlpha(180 * weight);
  stroke(frameColor);
  strokeWeight(max(0.4, (1.2 + node.influence * 1.5) * weight));
  noFill();
  rect(0, 0, w, h, w * 0.12);

  const braceColor = color(palette[3]);
  braceColor.setAlpha(190 * weight);
  stroke(braceColor);
  strokeWeight(max(0.3, weight));
  const bracketOffset = w * 0.38;
  const bracketHeight = h * lerp(0.55, 0.85, weight);
  line(-bracketOffset, -bracketHeight, -bracketOffset, bracketHeight);
  line(bracketOffset, -bracketHeight, bracketOffset, bracketHeight);

  const coreColor = color(palette[0]);
  coreColor.setAlpha(210 * weight);
  stroke(coreColor);
  strokeWeight(max(0.3, 0.8 * weight));
  const dividerCount = 3;
  for (let i = 1; i < dividerCount; i++) {
    const y = map(i, 0, dividerCount, -h * 0.45, h * 0.45);
    line(-w * 0.35, y, w * 0.35, y);
  }
}

function drawHexBloomShape(weight, dims) {
  const { size, node, time, noiseFactor } = dims;
  const influenceFactor = constrain(node.influence, 0, 1);
  const radius = size * lerp(0.65, 1.1, noiseFactor + influenceFactor * 0.12);
  const outlineColor = color(palette[3]);
  outlineColor.setAlpha((140 + node.influence * 70) * weight);
  stroke(outlineColor);
  strokeWeight(max(0.5, (1.2 + node.influence * 2.1) * weight));
  noFill();
  const sides = 6;
  beginShape();
  for (let i = 0; i < sides; i++) {
    const angle = TWO_PI * (i / sides) + sin(time * 0.2 + node.seed) * 0.05;
    vertex(cos(angle) * radius, sin(angle) * radius);
  }
  endShape(CLOSE);

  const innerRadius = radius * lerp(0.36, 0.52, weight);
  const innerColor = color(palette[4]);
  innerColor.setAlpha(150 * weight);
  stroke(innerColor);
  strokeWeight(max(0.35, weight));
  beginShape();
  for (let i = 0; i < sides; i++) {
    const angle = TWO_PI * (i / sides) + sin(time * 0.26 + node.seed * 0.3) * 0.04;
    vertex(cos(angle) * innerRadius, sin(angle) * innerRadius);
  }
  endShape(CLOSE);

  const bridgeColor = color(palette[1]);
  bridgeColor.setAlpha(130 * weight);
  stroke(bridgeColor);
  strokeWeight(max(0.3, (0.7 + node.influence) * weight));
  for (let i = 0; i < sides; i++) {
    const baseAngle = TWO_PI * (i / sides);
    const animated = baseAngle + time * 0.08 + node.seed * 0.02;
    const bx = cos(animated) * innerRadius;
    const by = sin(animated) * innerRadius;
    const cx = cos(animated) * lerp(innerRadius, radius, 0.45);
    const cy = sin(animated) * lerp(innerRadius, radius, 0.45);
    line(bx, by, cx, cy);
  }

  noStroke();
  const coreColor = color(palette[0]);
  const visibility = pow(influenceFactor, 1.4);
  coreColor.setAlpha(200 * weight * visibility);
  fill(coreColor);
  const coreDiameter = innerRadius * lerp(0, 1.15, visibility);
  ellipse(0, 0, coreDiameter, coreDiameter);
}

function drawTriangleWeaveShape(weight, dims) {
  const { size, node, time, noiseFactor } = dims;
  const outerRadius = size * lerp(0.9, 1.15, noiseFactor);
  const innerRadius = outerRadius * 0.6;
  const jitter = sin(time * 0.7 + node.seed) * 0.08;

  const outlineColor = color(palette[3]);
  outlineColor.setAlpha(170 * weight);
  stroke(outlineColor);
  strokeWeight(max(0.5, (1 + node.influence * 1.4) * weight));
  noFill();
  beginShape();
  for (let i = 0; i < 3; i++) {
    const angle = -HALF_PI + (TWO_PI / 3) * i + jitter;
    vertex(cos(angle) * outerRadius, sin(angle) * outerRadius);
  }
  endShape(CLOSE);

  const chordColor = color(palette[4]);
  chordColor.setAlpha(140 * weight);
  stroke(chordColor);
  strokeWeight(max(0.35, 0.9 * weight));
  for (let i = 0; i < 3; i++) {
    const angle = -HALF_PI + (TWO_PI / 3) * i + jitter;
    const nextAngle = -HALF_PI + (TWO_PI / 3) * ((i + 1) % 3) + jitter;
    const ax = cos(angle) * innerRadius;
    const ay = sin(angle) * innerRadius;
    const bx = cos(nextAngle) * innerRadius;
    const by = sin(nextAngle) * innerRadius;
    line(ax, ay, bx, by);
  }

  const signalColor = color(palette[1]);
  signalColor.setAlpha(130 * weight);
  stroke(signalColor);
  strokeWeight(max(0.3, 0.8 * weight));
  const pulse = lerp(0.25, 0.5, noiseFactor);
  for (let i = 0; i < 3; i++) {
    const angle = -HALF_PI + (TWO_PI / 3) * i + time * 0.4;
    const px = cos(angle) * innerRadius * 0.8;
    const py = sin(angle) * innerRadius * 0.8;
    line(px, py, px * pulse, py * pulse);
  }

  noStroke();
  const coreColor = color(palette[0]);
  const influenceFactor = constrain(node.influence, 0, 1);
  const visibility = pow(influenceFactor, 1.4);
  coreColor.setAlpha(210 * weight * visibility);
  fill(coreColor);
  const coreSize = innerRadius * lerp(0, 1.1, visibility);
  ellipse(0, 0, coreSize, coreSize);
}

function updatePaletteBlend() {
  if (paletteTransition >= 1) {
    return;
  }

  const step = 1 / paletteTransitionDuration;
  const nextT = Math.min(1, paletteTransition + step);
  const eased = easeInOutCubic(nextT);

  const startColors = paletteStart.length ? paletteStart : paletteTarget;
  const targetColors = paletteTarget.length ? paletteTarget : paletteStart;

  if (!startColors.length && !targetColors.length) {
    paletteTransition = 1;
    return;
  }

  const maxLen = Math.max(startColors.length, targetColors.length);
  const blended = [];
  for (let i = 0; i < maxLen; i++) {
    const startColor = startColors[i] || startColors[startColors.length - 1] || targetColors[i];
    const targetColor = targetColors[i] || targetColors[targetColors.length - 1] || startColor;
    blended[i] = lerpColor(startColor, targetColor, eased);
  }

  palette = blended;
  paletteTransition = nextT;

  if (paletteTransition >= 1) {
    paletteStart = palette.map(c => color(c));
    paletteTarget = palette.map(c => color(c));
  }
}

function drawGuides(highlightRow, highlightCol) {
  if (!grid.length || !grid[0]) {
    return;
  }
  const guideColor = color(palette[4]);
  guideColor.setAlpha(120);
  stroke(guideColor);
  strokeWeight(1.6);
  noFill();

  const focusRowY = grid[highlightRow][0].y;
  line(0, focusRowY, width, focusRowY);

  const focusColX = grid[0][highlightCol].x;
  line(focusColX, 0, focusColX, height);
}

function drawPointer() {
  const orbit = color(palette[0]);
  orbit.setAlpha(220);
  const cross = color(palette[1]);
  cross.setAlpha(220);

  noFill();
  strokeWeight(1.8);
  stroke(orbit);
  ellipse(mouseX, mouseY, 18, 18);

  strokeWeight(1.2);
  stroke(cross);
  line(mouseX - 8, mouseY, mouseX + 8, mouseY);
  line(mouseX, mouseY - 8, mouseX, mouseY + 8);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initGrid();
}

function initUI() {
  controlsContainer = createDiv();
  controlsContainer.position(20, 20);
  controlsContainer.style('padding', '14px 16px');
  controlsContainer.style('background', 'rgba(0, 48, 73, 0.72)');
  controlsContainer.style('border-radius', '12px');
  controlsContainer.style('backdrop-filter', 'blur(6px)');
  controlsContainer.style('color', '#fdf0d5');
  controlsContainer.style('font-family', '"IBM Plex Mono", monospace');
  controlsContainer.style('font-size', '12px');
  controlsContainer.style('min-width', '200px');
  controlsContainer.style('user-select', 'none');
  controlsContainer.mouseOver(() => {
    overUI = true;
    cursor('default');
  });
  controlsContainer.mouseOut(() => {
    overUI = false;
    noCursor();
  });

  const title = createDiv('Array Structure Controls');
  title.parent(controlsContainer);
  title.style('letter-spacing', '0.12em');
  title.style('text-transform', 'uppercase');
  title.style('font-size', '11px');
  title.style('margin-bottom', '10px');

  colsSlider = addSlider('Columns', 4, 16, gridCols, 1);
  rowsSlider = addSlider('Rows', 3, 12, gridRows, 1);
  driftSlider = addSlider('Drift', 0.1, 5, driftStrength, 0.01);
  focusSlider = addSlider('Focus', 0.01, 0.2, focusStrength, 0.005);
}

function addSlider(label, min, max, value, step) {
  const wrapper = createDiv();
  wrapper.parent(controlsContainer);
  wrapper.style('display', 'flex');
  wrapper.style('flex-direction', 'column');
  wrapper.style('gap', '4px');
  wrapper.style('margin-bottom', '10px');

  const row = createDiv();
  row.parent(wrapper);
  row.style('display', 'flex');
  row.style('justify-content', 'space-between');

  const labelSpan = createSpan(label);
  labelSpan.parent(row);

  const slider = createSlider(min, max, value, step);
  slider.parent(wrapper);
  slider.style('width', '100%');
  slider.input(() => {
    syncSettingsFromSliders(true);
  });

  return slider;
}

function syncSettingsFromSliders(shouldRebuild) {
  if (!colsSlider) {
    return;
  }
  const newCols = colsSlider.value();
  const newRows = rowsSlider.value();
  const rebuildNeeded = shouldRebuild && (newCols !== gridCols || newRows !== gridRows);

  gridCols = newCols;
  gridRows = newRows;
  driftStrength = driftSlider.value();
  focusStrength = focusSlider.value();

  if (rebuildNeeded) {
    initGrid();
  }
}

function mousePressed() {
  if (overUI || !grid.length) {
    return;
  }
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
    return;
  }
  triggerShapeWave(hoverRow, hoverCol);
}

// advance to the next shape mode and stagger transitions outward from the clicked cell
function triggerShapeWave(row, col) {
  if (!grid.length) {
    return;
  }
  cyclePalette();
  shapeState = (shapeState + 1) % shapeCount;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const node = grid[r][c];
      const gridDistance = dist(c, r, col, row);
      const currentShape = node.shapeOrigin === node.shapeGoal
        ? node.shapeGoal
        : node.shapeProgress < 0.5
          ? node.shapeOrigin
          : node.shapeGoal;
      node.shapeOrigin = currentShape;
      node.shapeGoal = shapeState;
      if (node.shapeOrigin === node.shapeGoal) {
        node.shapeProgress = 1;
        node.waveStartFrame = frameCount;
      } else {
        node.shapeProgress = 0;
        node.waveStartFrame = frameCount + gridDistance * propagationLag;
      }
    }
  }
}

// ease each node toward its scheduled target once its delay has elapsed
function updateShapeTransition(node) {
  if (node.shapeOrigin === node.shapeGoal) {
    node.shapeProgress = 1;
    return;
  }
  const framesSinceStart = frameCount - node.waveStartFrame;
  if (framesSinceStart < 0) {
    return;
  }
  const t = constrain(framesSinceStart / transitionDuration, 0, 1);
  const eased = easeInOutCubic(t);
  node.shapeProgress = eased;
  if (t >= 1) {
    node.shapeProgress = 1;
    node.shapeOrigin = node.shapeGoal;
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2;
}

function cyclePalette() {
  applyPalette(paletteIndex + 1);
}

function applyPalette(index) {
  const count = paletteKeys.length;
  if (count === 0) {
    return;
  }
  const wrapped = ((index % count) + count) % count;
  paletteIndex = wrapped;
  const newHex = palettes[paletteKeys[paletteIndex]];
  const newTarget = newHex.map(hex => color(hex));

  if (palette.length === 0) {
    palette = newTarget.map(c => color(c));
    paletteStart = palette.map(c => color(c));
    paletteTarget = palette.map(c => color(c));
    paletteTransition = 1;
  } else {
    paletteStart = palette.map(c => color(c));
    paletteTarget = newTarget.map(c => color(c));
    paletteTransition = 0;
  }

  paletteHex = newHex;
}
