import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from './libs/OrbitControls.js';

// ---------- GLOBALS ----------
const canvas = document.getElementById('game');
const loader = document.getElementById('loader');
const screenMenu = document.getElementById('screen-menu');
const screenMaps = document.getElementById('screen-maps');
const screenGame = document.getElementById('screen-game');
const btnSelectMap = document.getElementById('btn-select-map');
const btnCloseMaps = document.getElementById('btn-close-maps');
const btnBackMenu = document.getElementById('btn-back-menu');
const btnPlay = document.getElementById('btn-play');
const mapsGrid = document.getElementById('maps-grid');
const btnReset = document.getElementById('btn-reset');
const btnMenu = document.getElementById('btn-menu');
const hudMapName = document.getElementById('hud-map-name');
const destructionPct = document.getElementById('destruction-pct');
const destructionCount = document.getElementById('destruction-count');
const destructionFill = document.getElementById('destruction-fill');
const hudCenter = document.getElementById('hud-center');

let scene, camera, renderer, controls, raycaster, pointer;
let world, groundBody, groundMesh;
let ragdoll = null; // { bodies: [], meshes: [], constraints: [] }
let dragState = null; // { body, constraint, grabBody, plane, offset, lastPos, velocity }
let city = []; // array of { body, mesh, startPos, startQuat }
let selectedMap = null;
let gameState = 'MENU'; // MENU, MAPS, PLAYING
let destructionInitialPositions = new Map();
let animationId = null;
let clock = new THREE.Clock();

// Maps config
const MAPS = [
  {
    id: 'city',
    title: 'Центр Города',
    desc: 'Плотная застройка из высоток. Идеально для мощных бросков — смотри как падают целые кварталы.',
    emoji: '🏙️',
    color: '#4a6fa5',
    accent: '#ff3b30',
    pills: ['22 здания', '6-9 этажей', 'Хардкор'],
    ground: 0x8fa3bf
  },
  {
    id: 'boxes',
    title: 'Коробочный Полигон',
    emoji: '📦',
    desc: 'Склад с кучей коробок разного размера. Всё сыпется от одного касания — кайф для комбо.',
    color: '#e6a23c',
    accent: '#ff9500',
    pills: ['42 коробки', 'Хаос', 'Легко'],
    ground: 0xc9b896
  },
  {
    id: 'village',
    title: 'Деревня Sasny',
    emoji: '🏘️',
    desc: 'Низкие домики с крышами, заборы и сараи. Ломается красиво — стены складываются, крыши улетают.',
    color: '#6a9c6a',
    accent: '#34c759',
    pills: ['12 домов', 'Заборы', 'Средне'],
    ground: 0xa8c6a8
  }
];

// ---------- INIT ----------
init();
function init(){
  buildMapCards();
  setupScene();
  setupPhysics();
  setupRenderer();
  setupControls();
  setupLights();
  createGround(0x1a2738);
  createCityPreview();
  createRagdoll(new THREE.Vector3(4.5, 2.2, 0.5), true); // menu position on right
  animate();
  // hide loader after a moment
  setTimeout(()=> loader.classList.add('hide'), 900);
  bindUI();
  onWindowResize();
  window.addEventListener('resize', onWindowResize);
  // pointer events
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);
  // touch action handled via pointer
  // keyboard
  window.addEventListener('keydown', e=>{
    if(e.code==='Space' && gameState==='PLAYING'){ resetRagdoll(); }
    if(e.code==='KeyR'){ resetRagdoll(); }
  });
}

function bindUI(){
  btnSelectMap.addEventListener('click', ()=> showScreen('MAPS'));
  btnCloseMaps.addEventListener('click', ()=> showScreen('MENU'));
  btnBackMenu.addEventListener('click', ()=> showScreen('MENU'));
  btnPlay.addEventListener('click', ()=> startGame());
  btnReset.addEventListener('click', ()=> resetRagdoll());
  btnMenu.addEventListener('click', ()=> showScreen('MENU'));
  document.getElementById('btn-throw-hint').addEventListener('click', ()=>{
    hudCenter.innerHTML = '<div class="instruction">🎯 Попробуй раскрутить куклу и отпустить на скорости — так урон больше!</div>';
    setTimeout(()=> hudCenter.innerHTML = '<div class="instruction">🖐️ Зажми голову, руку или ногу — потяни и отпусти чтобы бросить 💥</div>', 3000);
    // throw ragdoll a bit
    if(ragdoll && gameState==='PLAYING'){
      const torso = ragdoll.bodies.find(b=>b.userData.part==='torso');
      if(torso){ torso.applyImpulse(new CANNON.Vec3((Math.random()-0.5)*40, 15, (Math.random()-0.5)*40), new CANNON.Vec3(0,0,0)); }
    }
  });
}

function buildMapCards(){
  mapsGrid.innerHTML = '';
  MAPS.forEach(m=>{
    const card = document.createElement('div');
    card.className='map-card';
    card.dataset.id=m.id;
    card.innerHTML=`
      <div class="map-thumb" style="background: linear-gradient(135deg, ${m.color} 0%, #1a1a24 100%)">
        <div class="map-emoji" style="position:relative; z-index:1">${m.emoji}</div>
        <div class="map-stats"><span class="pill">${m.pills[0]}</span><span class="pill">${m.pills[1]}</span></div>
      </div>
      <div class="map-body">
        <h3>${m.title}</h3>
        <p>${m.desc}</p>
        <div style="display:flex; align-items:center; gap:8px; margin-top:8px">
          <span style="font-size:11px;font-weight:800;letter-spacing:0.06em;color:rgba(255,255,255,0.6)">${m.pills[2]}</span>
          <div class="map-check">✓</div>
        </div>
      </div>
    `;
    card.addEventListener('click', ()=>{
      document.querySelectorAll('.map-card').forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
      selectedMap = m.id;
      btnPlay.disabled = false;
      btnPlay.textContent = '▶ ИГРАТЬ — ' + m.title.toUpperCase();
      // haptic
      if(navigator.vibrate) navigator.vibrate(20);
    });
    mapsGrid.appendChild(card);
  });
  // auto select first
  setTimeout(()=>{
    const first = mapsGrid.querySelector('.map-card');
    if(first) first.click();
  }, 500);
}

function showScreen(name){
  screenMenu.classList.remove('active');
  screenMaps.classList.remove('active');
  screenGame.classList.remove('active');
  if(name==='MENU'){
    gameState='MENU';
    screenMenu.classList.add('active');
    // rebuild menu scene
    clearCity();
    createCityPreview();
    if(ragdoll) removeRagdoll();
    createRagdoll(new THREE.Vector3(4.5, 2.2, 0.5), true);
    groundMesh.visible = true;
    groundBody.position.set(0, -1, 0);
    camera.position.set(0, 4, 12);
    controls.target.set(1.5, 1.5, 0);
    controls.maxDistance = 20;
    controls.minDistance = 6;
    controls.enabled = true;
  } else if(name==='MAPS'){
    gameState='MAPS';
    screenMaps.classList.add('active');
  } else if(name==='PLAYING'){
    gameState='PLAYING';
    screenGame.classList.add('active');
  }
  if(window.handleBackPress) window._screen = name;
}
window.handleBackPress = function(){
  if(gameState==='MAPS'){ showScreen('MENU'); return false; }
  if(gameState==='PLAYING'){ showScreen('MENU'); return false; }
  return true;
};

function startGame(){
  if(!selectedMap) selectedMap = 'city';
  showScreen('PLAYING');
  const map = MAPS.find(m=>m.id===selectedMap);
  hudMapName.textContent = map ? map.title.toUpperCase() : 'ИГРА';
  clearCity();
  removeRagdoll();
  // ground color per map
  groundMesh.visible = true;
  createGround(map ? map.ground : 0x8fa3bf);
  generateMap(selectedMap);
  createRagdoll(new THREE.Vector3(0, 4, 6), false);
  camera.position.set(-10, 8, 10);
  controls.target.set(0,1,0);
  controls.update();
  // reset destruction
  destructionInitialPositions.clear();
  city.forEach(o=>{
    destructionInitialPositions.set(o.body.id, { pos: o.body.position.clone(), moved:false });
  });
  updateDestructionUI(0);
  // hide hint after 4 sec
  setTimeout(()=>{ if(gameState==='PLAYING') hudCenter.style.opacity='0'; }, 4000);
  setTimeout(()=>{ if(gameState==='PLAYING') hudCenter.style.display='none'; }, 4500);
  hudCenter.style.opacity='1'; hudCenter.style.display='flex';
}

function resetRagdoll(){
  if(!ragdoll) return;
  // move ragdoll back to spawn
  const spawn = gameState==='PLAYING' ? new THREE.Vector3(0, 4, 6) : new THREE.Vector3(4.5, 2.2, 0.5);
  removeRagdoll();
  createRagdoll(spawn, gameState==='MENU');
  if(navigator.vibrate) navigator.vibrate(15);
}

// ---------- THREE SCENE ----------
function setupScene(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f141e);
  scene.fog = new THREE.Fog(0x0f141e, 18, 42);

  camera = new THREE.PerspectiveCamera(62, window.innerWidth/window.innerHeight, 0.1, 100);
  camera.position.set(0, 4, 12);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
}

function setupRenderer(){
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

function setupControls(){
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.target.set(1, 1.5, 0);
  controls.minDistance = 4;
  controls.maxDistance = 22;
  controls.maxPolarAngle = Math.PI/2.05;
  controls.minPolarAngle = 0.15;
  controls.enablePan = false;
  // touch controls: two fingers to orbit when not grabbing
}

function setupLights(){
  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x0f141e, 0.6);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 2.2);
  dir.position.set(8, 14, 6);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048,2048);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 40;
  dir.shadow.camera.left = -18;
  dir.shadow.camera.right = 18;
  dir.shadow.camera.top = 18;
  dir.shadow.camera.bottom = -18;
  dir.shadow.bias = -0.0005;
  scene.add(dir);
  // fill
  const fill = new THREE.DirectionalLight(0xff8a65, 0.7);
  fill.position.set(-6, 8, -8);
  scene.add(fill);
}

function createGround(color){
  if(groundMesh){ scene.remove(groundMesh); }
  if(groundBody){ try{ world.removeBody(groundBody);}catch(e){} }
  const geo = new THREE.PlaneGeometry(80,80, 1,1);
  const mat = new THREE.MeshStandardMaterial({ color: color || 0x1a2738, roughness:0.92, metalness:0.02 });
  groundMesh = new THREE.Mesh(geo, mat);
  groundMesh.rotation.x = -Math.PI/2;
  groundMesh.position.y = -1;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);
  const shape = new CANNON.Plane();
  groundBody = new CANNON.Body({ mass:0, shape });
  groundBody.quaternion.setFromEuler(-Math.PI/2,0,0);
  groundBody.position.set(0,-1,0);
  groundBody.material = world._mats ? world._mats.groundMat : new CANNON.Material('ground');
  world.addBody(groundBody);
}

// ---------- PHYSICS ----------
function setupPhysics(){
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, -19.62, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 20;
  world.solver.tolerance = 0.001;
  world.allowSleep = true;

  const groundMat = new CANNON.Material('ground');
  const ragdollMat = new CANNON.Material('ragdoll');
  const boxMat = new CANNON.Material('box');

  // default
  world.defaultContactMaterial.friction = 0.35;
  world.defaultContactMaterial.restitution = 0.25;
  world.defaultContactMaterial.contactEquationStiffness = 1e7;
  world.defaultContactMaterial.contactEquationRelaxation = 3;
  world.defaultContactMaterial.frictionEquationStiffness = 1e7;

  world.addContactMaterial(new CANNON.ContactMaterial(groundMat, ragdollMat, { friction:0.55, restitution:0.15, contactEquationStiffness:1e7, contactEquationRelaxation:3 }));
  world.addContactMaterial(new CANNON.ContactMaterial(ragdollMat, boxMat, { friction:0.45, restitution:0.3, contactEquationStiffness:1e7 }));
  world.addContactMaterial(new CANNON.ContactMaterial(boxMat, boxMat, { friction:0.5, restitution:0.22, contactEquationStiffness:1e7 }));
  world.addContactMaterial(new CANNON.ContactMaterial(groundMat, boxMat, { friction:0.6, restitution:0.18 }));
  
  // store mats globally for bodies
  world._mats = { groundMat, ragdollMat, boxMat };
}

// ---------- RAGDOLL ----------
function removeRagdoll(){
  if(!ragdoll) return;
  ragdoll.bodies.forEach(b=> world.removeBody(b));
  ragdoll.constraints.forEach(c=> world.removeConstraint(c));
  ragdoll.meshes.forEach(m=> scene.remove(m));
  if(dragState && dragState.constraint){ try{ world.removeConstraint(dragState.constraint); }catch(e){} }
  if(dragState && dragState.grabBody){ try{ world.removeBody(dragState.grabBody); }catch(e){} }
  dragState=null;
  ragdoll=null;
}

function createRagdoll(pos, isMenu){
  const ragdollMat = world._mats.ragdollMat;
  const bodies = [];
  const meshes = [];
  const constraints = [];

  // helper to create body + mesh
  function addPart(name, shapeType, dims, mass, color, posOffset){
    const bodyPos = new CANNON.Vec3(pos.x+posOffset.x, pos.y+posOffset.y, pos.z+posOffset.z);
    let shape;
    if(shapeType==='box'){
      shape = new CANNON.Box(new CANNON.Vec3(dims.x/2, dims.y/2, dims.z/2));
    } else if(shapeType==='sphere'){
      shape = new CANNON.Sphere(dims.r);
    }
    const body = new CANNON.Body({ mass, shape, material: ragdollMat, linearDamping:0.08, angularDamping:0.08 });
    body.position.copy(bodyPos);
    body.allowSleep = false;
    body.sleepSpeedLimit = 0.5;
    body.userData = { part:name };
    // make less bouncy but not rubbery: moderate restitution via contact material, but set high solver
    // to avoid stretching, increase linear factor?
    world.addBody(body);
    bodies.push(body);

    // mesh
    let geo;
    if(shapeType==='sphere'){
      geo = new THREE.SphereGeometry(dims.r, 20, 16);
    } else {
      // for round look use capsule-like: box with rounded edges approximated via box + small spheres? simple box with smooth
      geo = new THREE.BoxGeometry(dims.x, dims.y, dims.z);
      // roundness via chamfer? keep box
    }
    // capsule for limbs for round aesthetic
    if(name.includes('Arm') || name.includes('Leg')){
      // use capsule
      const radius = Math.min(dims.x, dims.z)/2;
      const height = dims.y - radius*2;
      geo = new THREE.CapsuleGeometry(radius, Math.max(0.1,height), 8, 16);
    } else if(name==='torso'){
      // torso with rounded box: use box with bevel via modifier? keep box but add small radius via geometry
      geo = new THREE.BoxGeometry(dims.x, dims.y, dims.z);
    } else if(name==='head'){
      geo = new THREE.SphereGeometry(dims.r, 24, 18);
    }
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.04,
      flatShading:false
    });
    // Add outline effect via second mesh? Skip
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.body = body;
    mesh.userData.part = name;
    // add eyes for head
    if(name==='head'){
      const eyeGeo = new THREE.SphereGeometry(0.07, 12, 10);
      const eyeMat = new THREE.MeshStandardMaterial({ color:0x111111, roughness:0.2 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(0.12, 0.05, 0.28);
      const eyeR = eyeL.clone();
      eyeR.position.set(-0.12, 0.05, 0.28);
      mesh.add(eyeL); mesh.add(eyeR);
      // blush?
      const blushGeo = new THREE.CircleGeometry(0.07, 12);
      const blushMat = new THREE.MeshBasicMaterial({ color:0xff6b6b, transparent:true, opacity:0.5, side:THREE.DoubleSide });
      const blushL = new THREE.Mesh(blushGeo, blushMat);
      blushL.position.set(0.18, -0.08, 0.30); blushL.rotation.y = 0.2;
      const blushR = blushL.clone(); blushR.position.set(-0.18, -0.08, 0.30);
      mesh.add(blushL); mesh.add(blushR);
    }
    // torso logo
    if(name==='torso'){
      const canvas = document.createElement('canvas');
      canvas.width=256; canvas.height=256;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#ffffff'; ctx.font='900 42px Inter, sans-serif';
      ctx.textAlign='center'; ctx.fillText('SASNY',128,140);
      ctx.font='700 16px Inter, sans-serif'; ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillText('RAGDOLL',128,165);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const decalGeo = new THREE.PlaneGeometry(0.45,0.45);
      const decalMat = new THREE.MeshBasicMaterial({ map:tex, transparent:true });
      const decal = new THREE.Mesh(decalGeo, decalMat);
      decal.position.set(0,0.05,0.19);
      mesh.add(decal);
    }
    scene.add(mesh);
    meshes.push(mesh);
    return body;
  }

  // colors: round palette, cute
  const skinHead = 0xffe4b5; // moccasin
  const torsoColor = 0xff3b30;
  const limbColor = 0xffe4b5;
  const legColor = 0x2b2b33; // pants

  // positions relative to spawn
  const head = addPart('head', 'sphere', {r:0.35}, 1.8, skinHead, {x:0, y:1.15, z:0});
  const torso = addPart('torso', 'box', {x:0.68, y:0.78, z:0.36}, 6, torsoColor, {x:0, y:0.45, z:0});
  const upperArmL = addPart('upperArmL', 'box', {x:0.24, y:0.52, z:0.24}, 1.1, limbColor, {x:0.51, y:0.55, z:0});
  const lowerArmL = addPart('lowerArmL', 'box', {x:0.20, y:0.48, z:0.20}, 0.9, limbColor, {x:0.51, y:0.05, z:0});
  const upperArmR = addPart('upperArmR', 'box', {x:0.24, y:0.52, z:0.24}, 1.1, limbColor, {x:-0.51, y:0.55, z:0});
  const lowerArmR = addPart('lowerArmR', 'box', {x:0.20, y:0.48, z:0.20}, 0.9, limbColor, {x:-0.51, y:0.05, z:0});
  const upperLegL = addPart('upperLegL', 'box', {x:0.30, y:0.62, z:0.30}, 2.2, legColor, {x:0.22, y:-0.35, z:0});
  const lowerLegL = addPart('lowerLegL', 'box', {x:0.26, y:0.58, z:0.26}, 1.6, limbColor, {x:0.22, y:-0.95, z:0});
  const upperLegR = addPart('upperLegR', 'box', {x:0.30, y:0.62, z:0.30}, 2.2, legColor, {x:-0.22, y:-0.35, z:0});
  const lowerLegR = addPart('lowerLegR', 'box', {x:0.26, y:0.58, z:0.26}, 1.6, limbColor, {x:-0.22, y:-0.95, z:0});

  // constraints: PointToPoint for head-torso, torso-arms, torso-legs; Hinge for elbows/knees
  function p2p(bodyA, pivotA, bodyB, pivotB){
    const c = new CANNON.PointToPointConstraint(bodyA, pivotA, bodyB, pivotB, 1e6);
    // stiffness hack: set equation stiffness if exists
    if(c.equations && c.equations[0]){ c.equations.forEach(eq=>{ if(eq.equation) eq.equation.stiffness=1e7; })}
    world.addConstraint(c);
    constraints.push(c);
    return c;
  }
  function hinge(bodyA, bodyB, pivotA, axisA, pivotB, axisB){
    const c = new CANNON.HingeConstraint(bodyA, bodyB, {
      pivotA, axisA, pivotB, axisB
    });
    world.addConstraint(c);
    constraints.push(c);
    return c;
  }

  // Head - Torso
  p2p(head, new CANNON.Vec3(0, -0.35, 0), torso, new CANNON.Vec3(0, 0.39, 0));
  // Torso - Upper Arms
  p2p(torso, new CANNON.Vec3(0.45, 0.28, 0), upperArmL, new CANNON.Vec3(0, 0.26, 0));
  p2p(torso, new CANNON.Vec3(-0.45, 0.28, 0), upperArmR, new CANNON.Vec3(0, 0.26, 0));
  // Upper - Lower Arms (hinge)
  hinge(upperArmL, lowerArmL, new CANNON.Vec3(0, -0.26, 0), new CANNON.Vec3(0,0,1), new CANNON.Vec3(0, 0.24, 0), new CANNON.Vec3(0,0,1));
  hinge(upperArmR, lowerArmR, new CANNON.Vec3(0, -0.26, 0), new CANNON.Vec3(0,0,1), new CANNON.Vec3(0, 0.24, 0), new CANNON.Vec3(0,0,1));
  // Torso - Upper Legs
  p2p(torso, new CANNON.Vec3(0.22, -0.39, 0), upperLegL, new CANNON.Vec3(0, 0.31, 0));
  p2p(torso, new CANNON.Vec3(-0.22, -0.39, 0), upperLegR, new CANNON.Vec3(0, 0.31, 0));
  // Upper - Lower Legs (hinge)
  hinge(upperLegL, lowerLegL, new CANNON.Vec3(0, -0.31, 0), new CANNON.Vec3(0,0,1), new CANNON.Vec3(0, 0.29, 0), new CANNON.Vec3(0,0,1));
  hinge(upperLegR, lowerLegR, new CANNON.Vec3(0, -0.31, 0), new CANNON.Vec3(0,0,1), new CANNON.Vec3(0, 0.29, 0), new CANNON.Vec3(0,0,1));

  // Reduce rubber: set high damping for constraints? Already solver iterations high.

  // give a tiny initial pose impulse for menu to wobble
  if(isMenu){
    torso.applyImpulse(new CANNON.Vec3(0.5,0,0.2), torso.position);
    // make it slightly lean
  }

  ragdoll = { bodies, meshes, constraints };
}

function syncRagdoll(){
  if(!ragdoll) return;
  for(let i=0;i<ragdoll.bodies.length;i++){
    const b = ragdoll.bodies[i];
    const m = ragdoll.meshes[i];
    m.position.copy(b.position);
    m.quaternion.copy(b.quaternion);
  }
}

// ---------- CITY / MAPS ----------
function clearCity(){
  city.forEach(o=>{
    world.removeBody(o.body);
    scene.remove(o.mesh);
    if(o.mesh2) scene.remove(o.mesh2);
  });
  city=[];
}

function createCityPreview(){
  // Distant skyline for menu background - not physics, just visual
  const group = [];
  for(let i=0;i<18;i++){
    const w = 1.2 + Math.random()*1.6;
    const h = 3 + Math.random()*5;
    const d = 1.2 + Math.random()*1.2;
    const x = -14 + Math.random()*20;
    const z = -12 - Math.random()*14;
    const geo = new THREE.BoxGeometry(w,h,d);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.64, 0.22, 0.18 + Math.random()*0.08), roughness:0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, -1 + h/2, z);
    // windows emissive
    mesh.userData.preview = true;
    scene.add(mesh);
    // fake windows texture via small planes?
    city.push({ body: { position:new CANNON.Vec3(x, -1+h/2, z), id: 'prev'+i, userData:{} }, mesh, isPreview:true });
  }
  // pedestal for ragdoll in menu
  const pedGeo = new THREE.CylinderGeometry(1.4,1.6,0.35,24);
  const pedMat = new THREE.MeshStandardMaterial({ color:0x1e2a3a, roughness:0.7 });
  const ped = new THREE.Mesh(pedGeo, pedMat);
  ped.position.set(4.5, -0.82, 0.5);
  ped.receiveShadow=true;
  scene.add(ped);
  city.push({ body:{position:new CANNON.Vec3(4.5,-0.82,0.5), id:'ped'}, mesh:ped, isPreview:true });
  // also need to keep for clear: those are not physics, but we mark isPreview and in clearCity we handle removal without world.removeBody for preview
  // Actually clearCity expects body with world.removeBody - we need to filter
  // Override clearCity handling for preview: check isPreview
}

const originalClearCity = clearCity;
clearCity = function(){
  const toRemove = [...city];
  city=[];
  toRemove.forEach(o=>{
    if(o.mesh) scene.remove(o.mesh);
    if(o.mesh2) scene.remove(o.mesh2);
    if(o.body && !o.isPreview){
      try{ world.removeBody(o.body); }catch(e){}
    }
    if(o.roofBody) try{ world.removeBody(o.roofBody); }catch(e){}
  });
};

function generateMap(id){
  const boxMat = world._mats.boxMat;
  function addBox(pos, size, color, mass=2, rotation=null){
    const half = new CANNON.Vec3(size.x/2,size.y/2,size.z/2);
    const shape = new CANNON.Box(half);
    const body = new CANNON.Body({ mass, shape, material: boxMat, linearDamping:0.05, angularDamping:0.05 });
    body.position.set(pos.x,pos.y,pos.z);
    if(rotation) body.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.3;
    world.addBody(body);
    const geo = new THREE.BoxGeometry(size.x,size.y,size.z);
    const mat = new THREE.MeshStandardMaterial({ color, roughness:0.88, metalness:0.02 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow=true; mesh.receiveShadow=true;
    scene.add(mesh);
    city.push({ body, mesh, startPos: body.position.clone(), startQuat: body.quaternion.clone() });
    return { body, mesh };
  }

  if(id==='city'){
    // dense city
    const palette = [0x5a6d8a, 0x6b7f9c, 0x8ea0bf, 0x4a5b73, 0x7a8bae];
    let idx=0;
    for(let bx=-8; bx<=8; bx+=3.2){
      for(let bz=-10; bz<=0; bz+=3.5){
        if(Math.random()<0.15) continue;
        const w = 1.4 + Math.random()*0.9;
        const d = 1.4 + Math.random()*0.9;
        const hLevels = 4 + Math.floor(Math.random()*5); // 4-8
        const x = bx + (Math.random()-0.5)*0.6;
        const z = bz + (Math.random()-0.5)*0.6;
        const color = palette[idx++ % palette.length];
        // stack boxes
        for(let lvl=0; lvl<hLevels; lvl++){
          const y = -1 + 0.5 + lvl*1.0 + 0.5; // each box 1 height
          // add slight color variation per level
          const col = new THREE.Color(color);
          col.offsetHSL(0,0, (Math.random()-0.5)*0.06);
          addBox(new THREE.Vector3(x, y, z), new THREE.Vector3(w, 1, d), col.getHex(), 3 + lvl*0.2);
          // windows for lower levels? add emissive plane on front
          if(lvl>0 && lvl< hLevels-0 && Math.random()<0.7){
            const winGeo = new THREE.PlaneGeometry(w*0.6, 0.45);
            const winMat = new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive:0xffd27a, emissiveIntensity:0.8 + Math.random()*0.6 });
            const win = new THREE.Mesh(winGeo, winMat);
            win.position.set(x, y, z + d/2 + 0.01);
            scene.add(win);
            city[city.length-1].mesh2 = win;
            // need to sync? keep relative
            // store window offset
            city[city.length-1].winOffset = new THREE.Vector3(0,0,d/2+0.01);
          }
        }
        // roof cap
        const topY = -1 + 0.5 + hLevels*1.0 + 0.15;
        addBox(new THREE.Vector3(x, topY, z), new THREE.Vector3(w+0.2, 0.3, d+0.2), 0x2b3442, 2);
      }
    }
    // some extra debris boxes on ground
    for(let i=0;i<6;i++){
      const x = (Math.random()-0.5)*12;
      const z = (Math.random()-0.5)*12 -2;
      addBox(new THREE.Vector3(x, -0.3, z), new THREE.Vector3(0.6,0.6,0.6), 0x8ea0bf, 1.2);
    }
  } else if(id==='boxes'){
    const colors = [0xd48a3c, 0xc9b896, 0x8fa3bf, 0xa88a6a, 0xe8c9a0];
    // piles
    for(let pile=0; pile<7; pile++){
      const cx = (Math.random()-0.5)*14;
      const cz = (Math.random()-0.5)*10 -1;
      const pileH = 3 + Math.floor(Math.random()*4);
      for(let i=0;i< pileH*3;i++){
        const w = 0.9 + Math.random()*0.8;
        const h = 0.9 + Math.random()*0.6;
        const d = 0.9 + Math.random()*0.8;
        const x = cx + (Math.random()-0.5)*2.2;
        const z = cz + (Math.random()-0.5)*2.2;
        const y = -1 + h/2 + Math.floor(i/3)* (h+0.02) + Math.random()*0.1;
        const color = colors[Math.floor(Math.random()*colors.length)];
        // stagger rotation a bit
        const rot = new THREE.Euler(0, Math.random()*0.2, 0);
        addBox(new THREE.Vector3(x,y,z), new THREE.Vector3(w,h,d), color, 1.5, rot);
      }
    }
    // walls of boxes
    for(let i=0;i<12;i++){
      const x = (Math.random()-0.5)*16;
      const z = (Math.random()-0.5)*10 -1;
      const s = 1.1 + Math.random()*0.9;
      addBox(new THREE.Vector3(x, -1+s/2, z), new THREE.Vector3(s,s,s), 0xc9b896, 2);
    }
  } else if(id==='village'){
    const houseColors = [0xc2a878, 0xa8b5a2, 0xd9c7b6, 0x8fa98f];
    for(let h=0; h<12; h++){
      const x = (Math.random()-0.5)*14;
      const z = (Math.random()-0.5)*10 -1;
      if(Math.abs(x)<2 && Math.abs(z)<2) continue; // keep center clear
      const w = 2.0 + Math.random()*0.9;
      const d = 2.0 + Math.random()*0.9;
      const wallH = 1.2;
      const color = houseColors[h%houseColors.length];
      // 4 walls as boxes thickness 0.2
      const thick=0.22;
      // front
      addBox(new THREE.Vector3(x, -1+wallH/2, z+d/2), new THREE.Vector3(w, wallH, thick), color, 4);
      // back
      addBox(new THREE.Vector3(x, -1+wallH/2, z-d/2), new THREE.Vector3(w, wallH, thick), color, 4);
      // left
      addBox(new THREE.Vector3(x-w/2, -1+wallH/2, z), new THREE.Vector3(thick, wallH, d), color, 4);
      // right
      addBox(new THREE.Vector3(x+w/2, -1+wallH/2, z), new THREE.Vector3(thick, wallH, d), color, 4);
      // roof - two slanted boxes
      const roofH = 0.35;
      const roofY = -1+wallH + 0.45;
      const roof1 = addBox(new THREE.Vector3(x-0.35, roofY, z), new THREE.Vector3(w*0.7, roofH, d+0.3), 0x7a3b2e, 2.5, new THREE.Euler(0,0, 0.45));
      const roof2 = addBox(new THREE.Vector3(x+0.35, roofY, z), new THREE.Vector3(w*0.7, roofH, d+0.3), 0x8b4a3a, 2.5, new THREE.Euler(0,0, -0.45));
      // door hole? just aesthetic
    }
    // fences
    for(let i=0;i<10;i++){
      const x = (Math.random()-0.5)*12;
      const z = (Math.random()-0.5)*8 -1;
      for(let j=0;j<4;j++){
        const fx = x + j*0.65;
        addBox(new THREE.Vector3(fx, -0.5, z), new THREE.Vector3(0.12, 1.0, 0.04), 0x9c8a6a, 0.8);
      }
      addBox(new THREE.Vector3(x+1.3, -0.3, z), new THREE.Vector3(2.8, 0.18, 0.06), 0x9c8a6a, 0.9);
      addBox(new THREE.Vector3(x+1.3, -0.65, z), new THREE.Vector3(2.8, 0.18, 0.06), 0x9c8a6a, 0.9);
    }
  }

  // record initial positions for destruction calc
  destructionInitialPositions.clear();
  city.forEach(o=>{
    if(o.body && o.body.position) destructionInitialPositions.set(o.body.id, { pos: o.body.position.clone(), quat: o.body.quaternion.clone() });
  });
}

// ---------- POINTER / GRAB ----------
let lastPointerPos = new THREE.Vector2();
let dragVelocity = new THREE.Vector3();
let lastGrabPos = new THREE.Vector3();
let lastTime = performance.now();

function getPointerNDC(event){
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX !== undefined ? event.clientX : (event.touches && event.touches[0].clientX);
  const y = event.clientY !== undefined ? event.clientY : (event.touches && event.touches[0].clientY);
  const nx = ((x - rect.left)/ rect.width) *2 -1;
  const ny = -((y - rect.top)/ rect.height)*2 +1;
  return new THREE.Vector2(nx, ny);
}

function onPointerDown(e){
  if(gameState!=='PLAYING' && gameState!=='MENU') return;
  // only left pointer
  const ndc = getPointerNDC(e);
  raycaster.setFromCamera(ndc, camera);
  if(!ragdoll) return;
  const meshes = ragdoll.meshes;
  const intersects = raycaster.intersectObjects(meshes, false);
  if(intersects.length===0) return;
  // find closest hit mesh
  const hit = intersects[0];
  const hitMesh = hit.object;
  // find body
  let hitBody = null;
  let hitMeshIdx = -1;
  for(let i=0;i<ragdoll.meshes.length;i++){
    if(ragdoll.meshes[i]===hitMesh || ragdoll.meshes[i].children.includes(hitMesh)){
      hitBody = ragdoll.bodies[i];
      hitMeshIdx = i;
      break;
    }
    // check parent
    let p = hitMesh.parent;
    while(p){
      if(p===ragdoll.meshes[i]){ hitBody = ragdoll.bodies[i]; hitMeshIdx=i; break; }
      p=p.parent;
    }
    if(hitBody) break;
  }
  if(!hitBody){
    // try by distance: pick body whose mesh is closest to hit point
    let bestDist=999, best=null;
    for(let i=0;i<ragdoll.meshes.length;i++){
      const m = ragdoll.meshes[i];
      const d = m.position.distanceTo(hit.point);
      if(d<bestDist){ bestDist=d; best=ragdoll.bodies[i]; }
    }
    hitBody=best;
  }
  if(!hitBody) return;
  e.preventDefault();
  if(e.target.setPointerCapture) try{ e.target.setPointerCapture(e.pointerId); }catch(_){}

  controls.enabled = false;

  // create drag plane perpendicular to camera through hit point
  const plane = new THREE.Plane();
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), hit.point);
  // compute local pivot on body
  const worldHit = new THREE.Vector3().copy(hit.point);
  const bodyPos = new THREE.Vector3().copy(hitBody.position);
  const bodyQuat = new THREE.Quaternion().copy(hitBody.quaternion);
  const invQuat = bodyQuat.clone().invert();
  const localPivot = worldHit.clone().sub(bodyPos).applyQuaternion(invQuat);
  const cannonLocal = new CANNON.Vec3(localPivot.x, localPivot.y, localPivot.z);

  // create kinematic grab body
  const grabBody = new CANNON.Body({ mass:0, type: CANNON.Body.KINEMATIC });
  grabBody.position.set(worldHit.x, worldHit.y, worldHit.z);
  world.addBody(grabBody);

  const constraint = new CANNON.PointToPointConstraint(hitBody, cannonLocal, grabBody, new CANNON.Vec3(0,0,0), 1e6);
  // make constraint strong
  if(constraint.equations){
    constraint.equations.forEach(eq=>{
      // cannon-es: DistanceEquation etc have stiffness?
    });
  }
  world.addConstraint(constraint);

  dragState = {
    body: hitBody,
    mesh: hitMesh,
    constraint,
    grabBody,
    plane,
    hitPoint: worldHit.clone(),
    lastPos: worldHit.clone(),
    velocity: new THREE.Vector3(),
    startTime: performance.now()
  };
  lastGrabPos.copy(worldHit);
  lastTime = performance.now();
  // haptic
  if(navigator.vibrate) navigator.vibrate(12);
  // wake up all ragdoll bodies
  ragdoll.bodies.forEach(b=> b.wakeUp());
}

function onPointerMove(e){
  if(!dragState) return;
  e.preventDefault();
  const ndc = getPointerNDC(e);
  raycaster.setFromCamera(ndc, camera);
  const plane = dragState.plane;
  const intersection = new THREE.Vector3();
  if(raycaster.ray.intersectPlane(plane, intersection)){
    // limit distance to avoid huge stretch? clamp velocity
    // smooth follow: set grabBody position directly
    const now = performance.now();
    const dt = Math.max(0.001, (now - lastTime)/1000);
    const delta = intersection.clone().sub(lastGrabPos);
    const vel = delta.clone().divideScalar(dt);
    // clamp vel
    const maxVel = 22;
    if(vel.length()>maxVel) vel.normalize().multiplyScalar(maxVel);
    dragState.velocity.copy(vel);
    dragState.grabBody.position.set(intersection.x, intersection.y, intersection.z);
    dragState.grabBody.velocity.set(vel.x, vel.y, vel.z);
    // also set last pos
    lastGrabPos.copy(intersection);
    lastTime = now;
    // wake
    dragState.body.wakeUp();
    // apply some angular to make not freeze
  }
}

function onPointerUp(e){
  if(!dragState) return;
  // throw impulse based on velocity
  const vel = dragState.velocity.clone();
  const speed = vel.length();
  // boost throw
  const throwScale = 0.55; // tune to feel not rubbery but powerful
  const impulse = vel.clone().multiplyScalar(throwScale);
  // apply to grabbed body
  const body = dragState.body;
  // remove constraint first
  try{ world.removeConstraint(dragState.constraint); }catch(_){}
  try{ world.removeBody(dragState.grabBody); }catch(_){}
  // apply impulse + a bit angular
  if(speed>0.5){
    body.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z), new CANNON.Vec3(0,0,0));
    // add torque for spin
    body.angularVelocity.x += (Math.random()-0.5)*6;
    body.angularVelocity.z += (Math.random()-0.5)*6;
    // also affect neighbors slightly for natural motion
    ragdoll.bodies.forEach(b=>{
      if(b!==body){
        const dist = b.position.distanceTo(body.position);
        if(dist<1.2){
          b.applyImpulse(new CANNON.Vec3(impulse.x*0.18, impulse.y*0.18, impulse.z*0.18), new CANNON.Vec3(0,0,0));
        }
      }
    });
    if(speed>8 && navigator.vibrate) navigator.vibrate(30);
  }
  dragState = null;
  controls.enabled = true;
  // re-enable sleep after a bit?
}

// ---------- ANIMATION LOOP ----------
function animate(){
  animationId = requestAnimationFrame(animate);
  const dt = Math.min(1/30, clock.getDelta());
  const fixedDt = 1/60;

  // physics step
  world.step(fixedDt, dt, 8);

  // sync
  syncRagdoll();
  // sync city meshes
  city.forEach(o=>{
    if(o.isPreview) return;
    if(o.body && o.mesh){
      o.mesh.position.copy(o.body.position);
      o.mesh.quaternion.copy(o.body.quaternion);
      if(o.mesh2 && o.winOffset){
        // window is relative to body? For stacked buildings we placed windows as separate scene objects not attached to body, so they don't move.
        // To make them move with building, we attach as child logic: but we added as separate. Instead we should not sync window - but if building falls, window should follow.
        // So we update window position based on body + offset
        // For now, if winOffset exists, update
        // Need to compute world offset rotated by quaternion
        const offset = o.winOffset.clone().applyQuaternion(o.mesh.quaternion);
        o.mesh2.position.copy(o.mesh.position).add(offset);
        o.mesh2.quaternion.copy(o.mesh.quaternion);
      }
    }
  });

  controls.update();

  // destruction calc
  if(gameState==='PLAYING' && city.length>0){
    let moved=0;
    city.forEach(o=>{
      if(o.isPreview) return;
      const init = destructionInitialPositions.get(o.body.id);
      if(!init) return;
      const dist = o.body.position.distanceTo(init.pos);
      const rotDiff = Math.abs(o.body.quaternion.x - init.quat.x) + Math.abs(o.body.quaternion.y - init.quat.y) + Math.abs(o.body.quaternion.z - init.quat.z);
      if(dist>0.7 || rotDiff>0.25) moved++;
    });
    const total = city.filter(c=>!c.isPreview).length;
    const pct = total>0 ? Math.round((moved/total)*100) : 0;
    updateDestructionUI(pct, moved, total);
    if(pct>85 && !window._won){
      window._won=true;
      // celebrate
      hudCenter.style.display='flex';
      hudCenter.style.opacity='1';
      hudCenter.innerHTML='<div class="instruction" style="background:linear-gradient(135deg,#ff3b30,#ff6b35); border:none">🎉 ГОРОД РАЗРУШЕН! '+pct+'% — нажми СБРОС чтобы ещё!</div>';
      if(navigator.vibrate) navigator.vibrate([30,40,50]);
      setTimeout(()=>{ window._won=false; hudCenter.innerHTML='<div class="instruction">🖐️ Зажми голову, руку или ногу — потяни и отпусти чтобы бросить 💥</div>'; }, 4000);
    }
  }

  // menu camera sway
  if(gameState==='MENU'){
    const t = performance.now()*0.00035;
    camera.position.x = Math.sin(t)*1.2;
    camera.position.y = 3.8 + Math.sin(t*0.7)*0.25;
    controls.target.x = 1.5 + Math.sin(t*0.5)*0.3;
    // gentle ragdoll breathing
    if(ragdoll && ragdoll.bodies[0]){
      // small occasional nudge
      if(Math.random()<0.015){
        const b = ragdoll.bodies[Math.floor(Math.random()*ragdoll.bodies.length)];
        b.applyForce(new CANNON.Vec3((Math.random()-0.5)*6, (Math.random()-0.5)*4, (Math.random()-0.5)*6), b.position);
      }
    }
  }

  renderer.render(scene, camera);
}

function updateDestructionUI(pct, moved, total){
  if(destructionPct) destructionPct.textContent = pct || 0;
  if(destructionFill) destructionFill.style.width = (pct||0)+'%';
  if(destructionCount && moved!==undefined) destructionCount.textContent = moved + '/' + total + ' объектов сдвинуто';
}

function onWindowResize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// expose for WebView back
window._screen = 'MENU';
