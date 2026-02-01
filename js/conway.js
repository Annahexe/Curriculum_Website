export function initConway() {
  // =========================
  // 1) DOM
  // =========================
  const canvas = document.getElementById("golCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });

  const ui = {
    toggle: document.getElementById("golToggle"),
    random: document.getElementById("golRandom"),
    clear: document.getElementById("golClear"),
    speed: document.getElementById("golSpeed"),
    placeMode: document.getElementById("golPlaceMode"),

    blinker: document.getElementById("btnCreateBlinker"),
    toad: document.getElementById("btnCreateToad"),
    beacon: document.getElementById("btnCreateBeacon"),
    glider: document.getElementById("btnCreateGlider"),
  };

  ui.overlay = document.getElementById("golOverlay");

  // =========================
  // 2) Config + state
  // =========================
  const CELL_SIZE = 10;
  const DPR_CAP = 2;

  let cols = 0;
  let rows = 0;
  let grid = new Uint8Array(0);
  let next = new Uint8Array(0);

  let running = false;
  let fps = Number(ui.speed?.value ?? 12);
  let acc = 0;

  // Pattern placement mode
  let placingPattern = null; // "blinker" | "toad" | "beacon" | "glider" | null

  // Painting mode
  let painting = false;
  let paintValue = 1;

  // =========================
  // 3) Grid helpers
  // =========================
  const toIndex = (x, y) => y * cols + x;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;

  const setCell = (x, y, v = 1) => {
    if (!inBounds(x, y)) return;
    grid[toIndex(x, y)] = v ? 1 : 0;
  };

  const cellAtWrapped = (x, y) => {
    const xx = (x + cols) % cols;
    const yy = (y + rows) % rows;
    return grid[toIndex(xx, yy)];
  };

  // =========================
  // 4) Patterns
  // =========================
  const PATTERNS = {
    blinker: [
      [-1, 0],
      [0, 0],
      [1, 0],
    ],
    toad: [
      [-1, 0],
      [0, 0],
      [1, 0],
      [0, -1],
      [1, -1],
      [2, -1],
    ],
    beacon: [
      [0, 0],
      [1, 0],
      [0, -1],
      [1, -1],
      [-2, -2],
      [-3, -2],
      [-2, -3],
      [-3, -3],
    ],
    glider: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, -1],
      [1, -2],
    ],
  };

  const stampPattern = (name, x, y) => {
    const cells = PATTERNS[name];
    if (!cells) return;

    for (const [dx, dy] of cells) {
      setCell(x + dx, y + dy, 1);
    }
  };

  const randomInt = (max) => Math.floor(Math.random() * max);

  // Choose a random spawn that keeps the whole pattern inside bounds
  const getRandomSpawn = (name) => {
    const cells = PATTERNS[name];

    let minX = 0,
      minY = 0,
      maxX = 0,
      maxY = 0;
    for (const [dx, dy] of cells) {
      if (dx < minX) minX = dx;
      if (dy < minY) minY = dy;
      if (dx > maxX) maxX = dx;
      if (dy > maxY) maxY = dy;
    }

    const xMin = -minX;
    const yMin = -minY;
    const xMax = cols - 1 - maxX;
    const yMax = rows - 1 - maxY;

    return {
      x: xMin + randomInt(Math.max(1, xMax - xMin + 1)),
      y: yMin + randomInt(Math.max(1, yMax - yMin + 1)),
    };
  };

  // =========================
  // 5) Rendering + simulation
  // =========================
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // subtle background
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // alive cells
    ctx.fillStyle = "#8c36e8";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[toIndex(x, y)]) {
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }
  };

  const tick = () => {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = 0;

        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            n += cellAtWrapped(x + ox, y + oy);
          }
        }

        const alive = grid[toIndex(x, y)] === 1;
        next[toIndex(x, y)] = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
      }
    }

    const tmp = grid;
    grid = next;
    next = tmp;
  };

  const clear = () => {
    grid.fill(0);
    draw();
  };

  const randomize = (p = 0.2) => {
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < p ? 1 : 0;
    draw();
  };

  // =========================
  // 6) Input + controls + loop
  // =========================
  const getCellFromPointer = (e) => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

    return {
      x: Math.floor(((e.clientX - r.left) * dpr) / CELL_SIZE),
      y: Math.floor(((e.clientY - r.top) * dpr) / CELL_SIZE),
    };
  };

  const showOverlay = () => {
    ui.overlay?.classList.add("is-visible");
  };

  const hideOverlay = () => {
    ui.overlay?.classList.remove("is-visible");
  };

  const setRunning = (v) => {
    running = v;
    if (ui.toggle) ui.toggle.textContent = running ? "Pausa" : "Start";

    if (running) {
      hideOverlay();
    }
  };

  const beginPlacing = (name) => {
    const placeOnClick = ui.placeMode ? ui.placeMode.checked : true;

    if (!placeOnClick) {
      const { x, y } = getRandomSpawn(name);
      stampPattern(name, x, y);
      draw();
      return;
    }

    placingPattern = name;
    canvas.style.cursor = "crosshair";
  };

  const cancelPlacing = () => {
    placingPattern = null;
    canvas.style.cursor = "";
  };

  // Canvas interactions (placing OR painting)
  canvas.addEventListener("pointerdown", (e) => {
    const placeOnClick = ui.placeMode ? ui.placeMode.checked : true;

    // Place pattern
    if (placingPattern && placeOnClick) {
      const { x, y } = getCellFromPointer(e);
      stampPattern(placingPattern, x, y);
      cancelPlacing();
      draw();
      return;
    }

    // Paint/toggle
    painting = true;
    canvas.setPointerCapture(e.pointerId);

    const { x, y } = getCellFromPointer(e);
    if (!inBounds(x, y)) return;

    const i = toIndex(x, y);
    paintValue = e.shiftKey ? 1 : grid[i] ? 0 : 1;
    grid[i] = paintValue;
    draw();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!painting) return;

    const { x, y } = getCellFromPointer(e);
    if (!inBounds(x, y)) return;

    grid[toIndex(x, y)] = paintValue;
    draw();
  });

  canvas.addEventListener("pointerup", () => (painting = false));
  canvas.addEventListener("pointercancel", () => (painting = false));

  // Buttons
  ui.blinker?.addEventListener("click", () => beginPlacing("blinker"));
  ui.toad?.addEventListener("click", () => beginPlacing("toad"));
  ui.beacon?.addEventListener("click", () => beginPlacing("beacon"));
  ui.glider?.addEventListener("click", () => beginPlacing("glider"));

  ui.toggle?.addEventListener("click", () => setRunning(!running));
  ui.random?.addEventListener("click", () => randomize(0.2));
  ui.clear?.addEventListener("click", () => clear());
  ui.speed?.addEventListener("input", () => (fps = Number(ui.speed.value)));

  const startFromOverlay = () => {
    if (!running) setRunning(true);
  };

  ui.overlay?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    startFromOverlay();
  });
  canvas.addEventListener("pointerdown", () => {
    if (ui.overlay?.classList.contains("is-visible")) startFromOverlay();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      setRunning(!running);
    }
  });

  const loop = (ts) => {
    requestAnimationFrame(loop);
    if (!running) return;

    const dt = Math.min(0.05, (ts - (loop._last || ts)) / 1000);
    loop._last = ts;

    acc += dt;
    const stepEvery = 1 / fps;

    while (acc >= stepEvery) {
      tick();
      acc -= stepEvery;
    }

    draw();
  };
  requestAnimationFrame(loop);

  // =========================
  // 7) Init / resize
  // =========================
  const resizeCanvasToCSS = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

    canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    canvas.height = Math.max(200, Math.floor(rect.height * dpr));

    cols = Math.floor(canvas.width / CELL_SIZE);
    rows = Math.floor(canvas.height / CELL_SIZE);

    grid = new Uint8Array(cols * rows);
    next = new Uint8Array(cols * rows);

    randomize(0.18);
  };

  window.addEventListener("resize", resizeCanvasToCSS);
  resizeCanvasToCSS();

  showOverlay();
}
