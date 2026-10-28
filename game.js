
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const $ = id => document.getElementById(id);

const game = $("game");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x83c9ef);
scene.fog = new THREE.Fog(0x83c9ef, 22, 75);

const camera = new THREE.PerspectiveCamera(
  75, innerWidth / innerHeight, 0.1, 150
);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
game.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xc5e8ff, 0x596344, 2));

const sun = new THREE.DirectionalLight(0xfff1d0, 2.3);
sun.position.set(15, 30, 12);
sun.castShadow = true;
scene.add(sun);

const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
const materials = {
  grass: new THREE.MeshLambertMaterial({ color: 0x65a843 }),
  dirt: new THREE.MeshLambertMaterial({ color: 0x805331 }),
  stone: new THREE.MeshLambertMaterial({ color: 0x858b91 }),
  wood: new THREE.MeshLambertMaterial({ color: 0x86502b }),
  leaves: new THREE.MeshLambertMaterial({ color: 0x347d39 }),
  sand: new THREE.MeshLambertMaterial({ color: 0xd7c17a }),
  water: new THREE.MeshLambertMaterial({
    color: 0x369fe0, transparent: true, opacity: 0.75
  })
};

const blocks = new Map();
const blockKey = (x, y, z) => `${x},${y},${z}`;

function addBlock(x, y, z, type = "grass") {
  const key = blockKey(x, y, z);
  if (blocks.has(key)) return;

  const mesh = new THREE.Mesh(cubeGeo, materials[type] || materials.grass);
  mesh.position.set(x, y, z);
  mesh.castShadow = type !== "water";
  mesh.receiveShadow = true;
  mesh.userData = { x, y, z, type };
  scene.add(mesh);
  blocks.set(key, mesh);
}

function removeBlock(mesh) {
  if (!mesh || !mesh.userData.type) return;
  const { x, y, z } = mesh.userData;
  scene.remove(mesh);
  blocks.delete(blockKey(x, y, z));
}

function heightAt(x, z) {
  return Math.floor(
    2 + Math.sin(x * 0.35) * 1.2 +
    Math.cos(z * 0.28) * 1.1 +
    Math.sin((x + z) * 0.17) * 0.8
  );
}

function makeTree(x, y, z) {
  for (let i = 1; i <= 4; i++) addBlock(x, y + i, z, "wood");

  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = 2; dy <= 5; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 3) <= 4) {
          if (!blocks.has(blockKey(x + dx, y + dy, z + dz))) {
            addBlock(x + dx, y + dy, z + dz, "leaves");
          }
        }
      }
    }
  }
}

function generateWorld() {
  for (let x = -18; x <= 18; x++) {
    for (let z = -18; z <= 18; z++) {
      const h = heightAt(x, z);

      for (let y = -2; y <= h; y++) {
        let type = y === h ? "grass" : y >= h - 2 ? "dirt" : "stone";
        if (h <= 1 && y === h) type = "sand";
        addBlock(x, y, z, type);
      }

      if (
        Math.abs(x) > 3 && Math.abs(z) > 3 &&
        Math.random() < 0.045 && h > 1
      ) {
        makeTree(x, h, z);
      }
    }
  }

  for (let x = -18; x <= 18; x++) {
    for (let z = -18; z <= 18; z++) {
      if (heightAt(x, z) <= 1) addBlock(x, 1, z, "water");
    }
  }
}

generateWorld();

camera.position.set(0, heightAt(0, 0) + 2.5, 5);

let yaw = 0;
let pitch = 0;
let playing = false;
let selectedBlock = "grass";
let dayTime = 0;
let velocityY = 0;
let onGround = false;

const keys = {};
const move = { forward: false, back: false, left: false, right: false };

const raycaster = new THREE.Raycaster();
raycaster.far = 6;

function getTarget() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const objects = [...blocks.values()];
  return raycaster.intersectObjects(objects, false)[0] || null;
}

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.style.opacity = "1";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.style.opacity = "0", 1800);
}

function updateHotbar() {
  const bar = $("hotbar");
  if (!bar) return;

  const items = [
    ["grass", "🟩"],
    ["dirt", "🟫"],
    ["stone", "⬜"],
    ["wood", "🪵"],
    ["leaves", "🌿"],
    ["sand", "🟨"]
  ];

  bar.innerHTML = "";
  items.forEach(([type, icon]) => {
    const slot = document.createElement("button");
    slot.className = "hotbar-slot" +
      (selectedBlock === type ? " selected" : "");
    slot.innerHTML = `<span>${icon}</span><span class="slot-name">${type}</span>`;
    slot.onclick = () => {
      selectedBlock = type;
      updateHotbar();
    };
    bar.appendChild(slot);
  });
}

updateHotbar();

function mineBlock() {
  const hit = getTarget();
  if (!hit) {
    toast("Aim at a block first!");
    return;
  }
  removeBlock(hit.object);
  toast("Block mined!");
}

function placeBlock() {
  const hit = getTarget();
  if (!hit) {
    toast("Aim at a block first!");
    return;
  }

  const normal = hit.face.normal.clone();
  normal.transformDirection(hit.object.matrixWorld);

  const p = hit.object.position.clone().add(normal);
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const z = Math.round(p.z);

  if (Math.abs(x - camera.position.x) < 0.8 &&
      Math.abs(z - camera.position.z) < 0.8 &&
      Math.abs(y - camera.position.y) < 1.5) {
    toast("You cannot place a block inside yourself!");
    return;
  }

  addBlock(x, y, z, selectedBlock);
}

function jump() {
  if (onGround) {
    velocityY = 7.5;
    onGround = false;
  }
}

function startGame() {
  playing = true;
  $("startScreen")?.classList.add("hidden");
  toast("Welcome to Wildlands!");
  renderer.domElement.requestPointerLock?.();
}

$("playBtn")?.addEventListener("click", startGame);
$("breakBtn")?.addEventListener("click", mineBlock);
$("placeBtn")?.addEventListener("click", placeBlock);
$("jumpBtn")?.addEventListener("click", jump);

$("saveBtn")?.addEventListener("click", () => {
  const saved = [...blocks.values()].map(m => ({
    x: m.userData.x, y: m.userData.y, z: m.userData.z,
    type: m.userData.type
  }));
  try {
    localStorage.setItem("voxelcraft-save", JSON.stringify(saved));
    toast("World saved!");
  } catch {
    toast("Could not save this world.");
  }
});

$("cheatBtn")?.addEventListener("click", () => {
  $("cheatPanel")?.classList.remove("hidden");
});
$("closeCheats")?.addEventListener("click", () => {
  $("cheatPanel")?.classList.add("hidden");
});

$("runCommand")?.addEventListener("click", runCommand);
$("commandInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") runCommand();
});

function runCommand() {
  const input = $("commandInput");
  const output = $("commandOutput");
  const command = input.value.trim().toLowerCase();

  if (command === "/help") {
    output.textContent = "/heal, /time day, /time night, /clear";
  } else if (command === "/heal") {
    velocityY = 0;
    output.textContent = "Health restored!";
  } else if (command === "/time day") {
    dayTime = 0;
    output.textContent = "Daytime enabled.";
  } else if (command === "/time night") {
    dayTime = Math.PI;
    output.textContent = "Nighttime enabled.";
  } else if (command === "/clear") {
    for (const mesh of [...blocks.values()]) removeBlock(mesh);
    output.textContent = "All blocks cleared.";
  } else {
    output.textContent = "Unknown command. Try /help";
  }
}

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  if (e.key === " " && playing) {
    e.preventDefault();
    jump();
  }

  if (e.key === "Escape") playing = false;

  if (e.key >= "1" && e.key <= "6") {
    const types = ["grass", "dirt", "stone", "wood", "leaves", "sand"];
    selectedBlock = types[Number(e.key) - 1];
    updateHotbar();
  }

  if (e.key.toLowerCase() === "e") {
    $("cheatPanel")?.classList.toggle("hidden");
  }
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

document.querySelectorAll("[data-move]").forEach(button => {
  const direction = button.dataset.move;

  button.addEventListener("pointerdown", e => {
    e.preventDefault();
    move[direction] = true;
    button.setPointerCapture?.(e.pointerId);
  });

  const release = () => move[direction] = false;
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

let lastTouchX = null;
let lastTouchY = null;

renderer.domElement.addEventListener("pointerdown", e => {
  if (!playing) return;

  if (e.pointerType === "mouse") {
    if (e.button === 0) mineBlock();
    if (e.button === 2) placeBlock();
    return;
  }

  lastTouchX = e.clientX;
  lastTouchY = e.clientY;
});

renderer.domElement.addEventListener("pointermove", e => {
  if (!playing || e.pointerType === "mouse") return;

  if (lastTouchX !== null) {
    const dx = e.clientX - lastTouchX;
    const dy = e.clientY - lastTouchY;
    yaw -= dx * 0.006;
    pitch -= dy * 0.006;
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
  }

  lastTouchX = e.clientX;
  lastTouchY = e.clientY;
});

renderer.domElement.addEventListener("pointerup", () => {
  lastTouchX = null;
  lastTouchY = null;
});

renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());

document.addEventListener("mousemove", e => {
  if (!playing || document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.002;
  pitch -= e.movementY * 0.002;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
});

function highestGround(x, z) {
  const bx = Math.round(x);
  const bz = Math.round(z);
  let highest = -3;

  for (let y = -2; y <= 12; y++) {
    const mesh = blocks.get(blockKey(bx, y, bz));
    if (mesh && mesh.userData.type !== "water") highest = Math.max(highest, y);
  }

  return highest;
}

function update(dt) {
  if (!playing) return;

  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  const speed = 5 * dt;
  const forward = Number(keys.w || keys.arrowup || move.forward) -
                  Number(keys.s || keys.arrowdown || move.back);
  const sideways = Number(keys.d || keys.arrowright || move.right) -
                   Number(keys.a || keys.arrowleft || move.left);

  const dx = -Math.sin(yaw) * forward + Math.cos(yaw) * sideways;
  const dz = -Math.cos(yaw) * forward - Math.sin(yaw) * sideways;

  camera.position.x += dx * speed;
  camera.position.z += dz * speed;

  const ground = highestGround(camera.position.x, camera.position.z) + 1.8;

  velocityY -= 18 * dt;
  camera.position.y += velocityY * dt;

  if (camera.position.y <= ground) {
    camera.position.y = ground;
    velocityY = 0;
    onGround = true;
  } else {
    onGround = false;
  }

  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -19, 19);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -19, 19);
}

let previousTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;

  update(dt);

  dayTime += dt * 0.025;
  const brightness = 0.45 + (Math.sin(dayTime) + 1) * 0.5;
  sun.intensity = brightness * 2;
  scene.background.setHSL(0.56, 0.55, 0.18 + brightness * 0.3);
  scene.fog.color.copy(scene.background);

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

$("status").textContent = "WORLD READY";
requestAnimationFrame(animate);
