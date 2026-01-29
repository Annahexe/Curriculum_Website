export function initConway() {
  // ---------------------------------------------------------------------------
  // Conway's Game of Life (proyecto especial debajo de "Proyectos")
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById("golCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const toggleBtn = document.getElementById("golToggle");
  const randomBtn = document.getElementById("golRandom");
  const clearBtn = document.getElementById("golClear");
  const speedSlider = document.getElementById("golSpeed");

  // Grid
  const CELL = 8; // tamaño de celda en píxeles (en el canvas lógico)
  let cols = Math.floor(canvas.width / CELL);
  let rows = Math.floor(canvas.height / CELL);
  let grid = new Uint8Array(cols * rows);
  let next = new Uint8Array(cols * rows);

  function idx(x, y) {
    return y * cols + x;
  }

  function resizeCanvasToCSS() {
    // Mantiene un canvas nítido: ajusta el tamaño interno a su tamaño CSS
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    canvas.height = Math.max(200, Math.floor(rect.height * dpr));
    cols = Math.floor(canvas.width / CELL);
    rows = Math.floor(canvas.height / CELL);
    grid = new Uint8Array(cols * rows);
    next = new Uint8Array(cols * rows);
    randomize(0.18);
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // fondo ligero
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // celdas vivas
    ctx.fillStyle = "#8c36e8";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[idx(x, y)]) {
          ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      }
    }
  }

  function step() {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            const xx = x + ox;
            const yy = y + oy;
            if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue; // borde muerto
            n += grid[idx(xx, yy)];
          }
        }
        const alive = grid[idx(x, y)] === 1;
        next[idx(x, y)] =
          (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
      }
    }
    const tmp = grid;
    grid = next;
    next = tmp;
  }

  function clear() {
    grid.fill(0);
    draw();
  }

  function randomize(p = 0.2) {
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < p ? 1 : 0;
    draw();
  }

  // Interacción: click pinta/borra, shift+drag pinta
  let painting = false;
  let paintValue = 1;
  function cellFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const x = Math.floor(((e.clientX - r.left) * dpr) / CELL);
    const y = Math.floor(((e.clientY - r.top) * dpr) / CELL);
    return { x, y };
  }

  canvas.addEventListener("pointerdown", (e) => {
    painting = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = cellFromEvent(e);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const i = idx(x, y);
    paintValue = e.shiftKey ? 1 : grid[i] ? 0 : 1;
    grid[i] = paintValue;
    draw();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!painting) return;
    const { x, y } = cellFromEvent(e);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    grid[idx(x, y)] = paintValue;
    draw();
  });
  canvas.addEventListener("pointerup", () => (painting = false));
  canvas.addEventListener("pointercancel", () => (painting = false));

  // Play/Pause + velocidad
  let running = false;
  let fps = Number(speedSlider?.value ?? 12);
  let acc = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!running) return;
    const dt = Math.min(0.05, (ts - (loop._last || ts)) / 1000);
    loop._last = ts;
    acc += dt;
    const stepEvery = 1 / fps;
    while (acc >= stepEvery) {
      step();
      acc -= stepEvery;
    }
    draw();
  }
  requestAnimationFrame(loop);

  function setRunning(v) {
    running = v;
    if (toggleBtn) toggleBtn.textContent = running ? "Pausa" : "Reanudar";
  }

  toggleBtn?.addEventListener("click", () => setRunning(!running));
  randomBtn?.addEventListener("click", () => randomize(0.2));
  clearBtn?.addEventListener("click", () => clear());
  speedSlider?.addEventListener(
    "input",
    () => (fps = Number(speedSlider.value))
  );

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      setRunning(!running);
    }
  });

  // Ajuste responsivo
  window.addEventListener("resize", resizeCanvasToCSS);
  resizeCanvasToCSS();
}
