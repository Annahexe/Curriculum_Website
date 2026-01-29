import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";

import { MeshSurfaceSampler } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/math/MeshSurfaceSampler.js";

export function initScene3D() {
  // --------------------------------------------------
  // 1) Escena, cámara y renderer
  // --------------------------------------------------
  const container = document.getElementById("container3D");

  const scene = new THREE.Scene();
  scene.background = null; // transparente

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);

  // Un poco más alejado que antes
  const baseCamPos = new THREE.Vector3(2.6, 1.9, 4.2);
  camera.position.copy(baseCamPos);
  camera.lookAt(0, 0.5, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container.appendChild(renderer.domElement);

  // --------------------------------------------------
  // Barrido de color para partículas (se percibe mucho más)
  // --------------------------------------------------
  // Ajusta estos valores a tu gusto
  const particleSweepColorA = new THREE.Color(0x00ffff);
  const particleSweepColorB = new THREE.Color(0xff00ff);
  const particleSweepSpeed = 2.0;    // velocidad del barrido
  const particleSweepFreq = 3.0;     // "anchura" (más alto = más franjas)
  let particleYMin = 0;
  let particleYMax = 1;
  const _tmpSweepColor = new THREE.Color();


  // --------------------------------------------------
  // 2) Objetos (cubo + suelo) + sombras
  // --------------------------------------------------

  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 3, 0.2, 64),
    new THREE.ShadowMaterial()
  );
  ground.position.set(0, -0.1, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  function cube3d(posX) {
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x33bbff })
    );
    cube.position.set(posX, 0.5, 0);
    cube.scale.set(0.1, 0.1, 0.1);
    cube.castShadow = true;
    cube.name = "cube";
    scene.add(cube);
  }

  // GEOMETRIA PERSONALIZADA
  const loader = new GLTFLoader();

  // --- Toggle: geometría <-> partículas ---
  let modelRoot = null; // wrapper que contiene el modelo y las partículas
  let loadedModel = null;
  let particlePoints = null;
  let showingParticles = false;

  function buildParticlesFromModel(root, model, options = {}) {
    const {
      maxPoints = 12000, // límite para no matar el rendimiento
      size = 0.02,
      opacity = 0.9,
    } = options;

    // Asegura matrices al día
    root.updateMatrixWorld(true);

    const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const positions = [];

    model.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      const geo = child.geometry;
      const posAttr = geo.attributes.position;
      if (!posAttr) return;

      // Convierte los vértices a coordenadas locales de 'root'
      const mw = child.matrixWorld;
      const v = new THREE.Vector3();
      const vWorld = new THREE.Vector3();
      const vRoot = new THREE.Vector3();
      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i);
        vWorld.copy(v).applyMatrix4(mw);
        vRoot.copy(vWorld).applyMatrix4(rootInv);
        positions.push(vRoot.x, vRoot.y, vRoot.z);
      }
    });

    // Submuestreo si hay demasiados puntos
    const totalPoints = Math.floor(positions.length / 3);
    if (totalPoints > maxPoints) {
      const stride = Math.ceil(totalPoints / maxPoints);
      const sampled = [];
      for (let i = 0; i < totalPoints; i += stride) {
        const k = i * 3;
        sampled.push(positions[k], positions[k + 1], positions[k + 2]);
      }
      positions.length = 0;
      positions.push(...sampled);
    }

    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    // Colores por vértice (se actualizarán en animate para el barrido)
    const colors = new Float32Array((positions.length / 3) * 3);
    pointsGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Calcula rango Y para normalizar el barrido
    particleYMin = Infinity;
    particleYMax = -Infinity;
    for (let i = 1; i < positions.length; i += 3) {
      const y = positions[i];
      if (y < particleYMin) particleYMin = y;
      if (y > particleYMax) particleYMax = y;
    }
    if (!isFinite(particleYMin) || particleYMax === particleYMin) {
      particleYMin = 0;
      particleYMax = 1;
    }


    const pointsMat = new THREE.PointsMaterial({
      size,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
    });

    const points = new THREE.Points(pointsGeo, pointsMat);
    points.visible = false;
    points.frustumCulled = false; // evita "parpadeos" por bounding box imprecisa
    root.add(points);
    return points;
  }

  function setParticlesMode(on) {
    showingParticles = !!on;
    if (loadedModel) loadedModel.visible = !showingParticles;
    if (particlePoints) particlePoints.visible = showingParticles;
    const btn = document.getElementById("toggleParticles");
    if (btn)
      btn.textContent = showingParticles ? "Ver geometría" : "Ver partículas";
  }
  loader.load(
    `./Assets/models/PC.gltf`,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      model.position.set(0, 0, 0);
      model.scale.set(0.1, 0.1, 0.1);

      // Wrapper para poder alternar visibilidades sin tocar transforms
      modelRoot = new THREE.Group();
      modelRoot.position.set(0, 0, 0);
      modelRoot.add(model);
      scene.add(modelRoot);

      loadedModel = model;
      particlePoints = buildParticlesFromModel(modelRoot, loadedModel, {
        maxPoints: 14000,
        size: 0.06,
        opacity: 0.9,
      });

      // UI: botón + atajo teclado
      const btn = document.getElementById("toggleParticles");
      btn?.addEventListener("click", () => setParticlesMode(!showingParticles));
      window.addEventListener("keydown", (e) => {
        if (e.code === "KeyP") setParticlesMode(!showingParticles);
      });

      setParticlesMode(false);
    },
    (xhr) => {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    (error) => {
      console.error("An error happened loading the model:", error);
    }
  );

  // --------------------------------------------------
  // 3) Luces
  // --------------------------------------------------
  const ambientLight = new THREE.AmbientLight(0x404040, 5); // soft white light
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(-4, 10, 4);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  scene.add(dirLight);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  // --------------------------------------------------
  // 4) Resize al tamaño visual del canvas
  // --------------------------------------------------
  function resize() {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
  }

  resize();
  window.addEventListener("resize", resize);

  // --------------------------------------------------
  // 5) Cursor GLOBAL -> parallax de cámara
  // --------------------------------------------------
  let cursorX = 0;
  let cursorY = 0;

  const parallaxX = 0.75;
  const parallaxY = 0.5;
  const parallaxSmooth = 0.08;

  let smoothCursorX = 0;
  let smoothCursorY = 0;

  window.addEventListener(
    "pointermove",
    (e) => {
      cursorX = (e.clientX / window.innerWidth - 0.5) * 4;
      cursorY = (e.clientY / window.innerHeight - 0.5) * 4;
    },
    { passive: true }
  );

  // --------------------------------------------------
  // 6) Scroll GLOBAL -> zoom
  // --------------------------------------------------
  const baseDistance = baseCamPos.length();

  // un poco más alejado en general:
  const minDistance = 2.2;
  const maxDistance = 6.0;

  const zoomSmooth = 0.1;
  let targetDistance = Math.max(minDistance, baseDistance);
  let currentDistance = targetDistance;

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function updateZoomFromScroll() {
    const doc = document.documentElement;
    const maxScroll = Math.max(1, doc.scrollHeight - doc.clientHeight);
    const t = clamp(window.scrollY / maxScroll, 0, 1);

    // más scroll => más lejos
    targetDistance = minDistance + t * (maxDistance - minDistance);
  }

  window.addEventListener("scroll", updateZoomFromScroll, { passive: true });
  updateZoomFromScroll();

  // --------------------------------------------------
  // 7) Animación (sin giro del cubo)
  // --------------------------------------------------
  function animate() {
    requestAnimationFrame(animate);

    // Barrido de color (por vértice) cuando se muestran partículas
    if (showingParticles && particlePoints?.geometry?.attributes?.color) {
      const time = performance.now() * 0.001;

      const posAttr = particlePoints.geometry.attributes.position;
      const colAttr = particlePoints.geometry.attributes.color;

      const yRange = particleYMax - particleYMin || 1;

      for (let i = 0; i < posAttr.count; i++) {
        const yNorm = (posAttr.getY(i) - particleYMin) / yRange; // 0..1
        const t = (Math.sin((yNorm * particleSweepFreq * Math.PI * 2) + (time * particleSweepSpeed)) + 1) / 2;
        _tmpSweepColor.copy(particleSweepColorA).lerp(particleSweepColorB, t);
        colAttr.setXYZ(i, _tmpSweepColor.r, _tmpSweepColor.g, _tmpSweepColor.b);
      }

      colAttr.needsUpdate = true;
    }

    // suaviza cursor
    smoothCursorX += (cursorX - smoothCursorX) * parallaxSmooth;
    smoothCursorY += (cursorY - smoothCursorY) * parallaxSmooth;

    // suaviza zoom
    currentDistance += (targetDistance - currentDistance) * zoomSmooth;

    // dirección base + parallax
    const dir = baseCamPos.clone();
    dir.x += smoothCursorX * parallaxX;
    dir.y += -smoothCursorY * parallaxY;
    dir.normalize();

    camera.position.copy(dir.multiplyScalar(currentDistance));
    camera.lookAt(0, 0.5, 0);

    renderer.render(scene, camera);
  }

  animate();
}
