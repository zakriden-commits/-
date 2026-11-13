import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { Assets } from './core/assets.js';
import { AudioSystem } from './core/audio.js';
import { Input } from './core/input.js';
import { clamp, damp, lerp, noise1 } from './core/util.js';
import { CollisionWorld } from './systems/collision.js';
import { Player } from './systems/player.js';
import { Guard, NPC, NPC_STATE } from './systems/ai.js';
import { Mission } from './systems/mission.js';
import { sampleWakePose, WAKE_DURATION } from './systems/wake.js';
import { HUD } from './ui/hud.js';
import { buildHouse } from './world/house.js';
import { buildStreet } from './world/street.js';
import { buildShop } from './world/shop.js';

/* ------------------------------------------------------------------ *
 * IslamWork — a small 3D stealth game for the phone.
 * Structure: Game owns renderer/scene, the world (house / street / shop),
 * the player, the NPC cast, the mission script and the UI wiring.
 * ------------------------------------------------------------------ */

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const screenEl = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.canvasHost = document.getElementById('app');
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isTouch, powerPreference: 'high-performance', alpha: false, stencil: false,
    });
    const dprCap = isTouch ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = !isTouch;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvasHost.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070c);
    this.scene.fog = new THREE.FogExp2(0x0a1220, 0.021);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.06, 240);
    this.scene.add(this.camera);

    this.clock = new THREE.Clock();
    this.colliders = new CollisionWorld();
    this.assets = new Assets(this.renderer);
    this.audio = new AudioSystem();
    this.input = new Input(this.renderer.domElement);
    this.hud = new HUD();

    this.lights = [];
    this.flags = {};
    this.state = 'title';
    this.time = 0;
    // A balanced, sharper profile is the default; Fast remains available in Pause.
    this.quality = 'high';
    this.muted = false;

    this.pressBuffer = 0;
    this.noiseLevel = 0;
    this.alertLevel = 0;
    this.mission = new Mission(this);
    this._forceQuality = new URLSearchParams(location.search).get('q');
  }

  /* --------------------------- boot ---------------------------- */

  async boot() {
    const fill = document.getElementById('loadFill');
    const label = document.getElementById('loadLabel');
    const steps = [
      ['ДОМ', () => this._buildWorld()],
      ['СВЕТ', () => this._buildLighting()],
      ['ЭФФЕКТЫ', () => this._buildPost()],
    ];
    for (let i = 0; i < steps.length; i++) {
      const [name, fn] = steps[i];
      label.textContent = name;
      fill.style.width = `${10 + (i / steps.length) * 80}%`;
      await new Promise((r) => setTimeout(r, 30));
      fn();
    }
    fill.style.width = '100%';
    await new Promise((r) => setTimeout(r, 220));
    document.getElementById('loading').classList.add('done');
    this._bindUI();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._resize(), 240));
    this.clock.start();
    const qualityOverride = this._forceQuality === 'high' || this._forceQuality === 'low'
      ? this._forceQuality : null;
    this.setQuality(qualityOverride || this.quality);
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _buildWorld() {
    // sky dome
    const skyGeo = new THREE.SphereGeometry(150, 32, 18);
    const skyMat = new THREE.MeshBasicMaterial({ map: this.assets.tex.sky, side: THREE.BackSide, fog: false });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
    // moon sprite
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.assets.tex.glow, color: 0xdbe8ff, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    moon.scale.setScalar(26);
    moon.position.set(-52, 46, -96);
    this.scene.add(moon);

    this.house = buildHouse(this.scene, this.assets, this.colliders, this.lights, {});
    this.street = buildStreet(this.scene, this.assets, this.colliders, this.lights, {});
    this.shop = buildShop(this.scene, this.assets, this.colliders, this.lights, {});

    // ambience: dust motes drifting in the shop
    const dustGeo = new THREE.BufferGeometry();
    const count = 220;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = Math.random() * 3.2;
      pos[i * 3 + 2] = 14 + Math.random() * 16;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      size: 0.035, map: this.assets.tex.glow, transparent: true, opacity: 0.45,
      depthWrite: false, blending: THREE.AdditiveBlending, color: 0xcfe6ff,
    }));
    this.scene.add(this.dust);

    this.player = new Player(this.assets, this.camera, this.colliders);
    this.scene.add(this.player.body.root);
    this.player.footstepCb = (surface, volume) => this.audio.footstep(surface, volume);

    this._createNPCs();
    this.interactions = [
      ...this.house.interactions.map((i) => ({ ...i, where: 'house' })),
      ...this.shop.interactions.map((i) => ({ ...i, where: 'shop' })),
    ];
    this.player.teleport(this.house.spawn.x, this.house.spawn.z, -Math.PI / 4);
  }

  _createNPCs() {
    const A = this.assets;
    this.npcs = [];
    this.guards = [];

    // cashier behind checkout A
    this.cashier = new NPC(A, {
      name: 'cashier', sitting: true, seed: 41,
      look: { skin: 0xd7a878, shirt: 0x2f6d8a, pants: 0x27303a, hair: 0x3a2a1c, apron: 0x1f4d6b, height: 0.98 },
      route: [[-6.2, 17.6]],
    });
    this.cashier.humanoid.faceYaw(Math.PI);
    this.cashier.object.position.set(-6.2, 0, 17.6);
    this.cashier.object.rotation.y = Math.PI;
    this.scene.add(this.cashier.object);
    this.npcs.push(this.cashier);

    // guard patrolling the shop floor
    this.guard = new Guard(A, {
      name: 'guard1', seed: 12, speed: 1.35, sightRange: 11, fov: 0.95, hearRange: 6.5,
      look: { skin: 0xc79068, shirt: 0x22303f, pants: 0x1c2530, hair: 0x15100c, height: 1.04, cap: 0x1b2a38 },
      route: [[-3.1, 16.2], [-3.2, 25.4], [0.0, 26.0], [3.2, 25.4], [3.1, 16.2], [0.0, 15.7]],
      pauseAt: [[-3.2, 25.4, 2.2], [3.1, 16.2, 1.4]],
    });
    this.scene.add(this.guard.object);
    this.npcs.push(this.guard);
    this.guards.push(this.guard);

    // guard in the back room (slow, short route)
    this.guard2 = new Guard(A, {
      name: 'guard2', seed: 19, speed: 0.95, sightRange: 9, fov: 0.9, hearRange: 5,
      look: { skin: 0x8f6040, shirt: 0x3a2f2a, pants: 0x22262c, hair: 0x0f0c09, height: 1.0 },
      route: [[3.0, 28.7], [-2.9, 28.7], [-2.9, 27.7], [3.0, 27.7]],
      pauseAt: [[-2.9, 28.7, 1.8]],
    });
    this.scene.add(this.guard2.object);
    this.npcs.push(this.guard2);
    this.guards.push(this.guard2);

    // a night shopper wandering the aisles (flavour + tells you when a guard is near)
    this.shopper = new NPC(A, {
      name: 'shopper', seed: 77, speed: 0.85,
      look: { skin: 0xe0b48c, shirt: 0x7a4b5a, pants: 0x2b2f3a, hair: 0x5a3a22, height: 0.96, scarf: 0x8a3b3b },
      route: [[1.2, 17.2], [1.4, 24.8], [-1.6, 26.2], [1.2, 19.5]],
      pauseAt: [[-1.6, 26.2, 2.4]],
    });
    this.scene.add(this.shopper.object);
    this.npcs.push(this.shopper);

    // someone in the window of the neighbouring house (silhouette, lives outside)
    // -> kept simple: a street NPC walking the sidewalk
    this.walker = new NPC(A, {
      name: 'walker', seed: 91, speed: 1.0,
      look: { skin: 0xb98a62, shirt: 0x3d4b5c, pants: 0x232830, hair: 0x1b1512, height: 1.0, scarf: 0x5a4a3a },
      route: [[-16, 3.2], [12, 3.2], [16, 13.0], [-16, 13.0]],
    });
    this.scene.add(this.walker.object);
    this.npcs.push(this.walker);
  }

  _buildLighting() {
    // moonlit key light with shadows
    const moon = new THREE.DirectionalLight(0x9fc6ff, 0.55);
    moon.position.set(-24, 34, -18);
    moon.castShadow = this.quality !== 'low';
    moon.shadow.mapSize.set(this.quality === 'low' ? 1024 : 2048, this.quality === 'low' ? 1024 : 2048);
    moon.shadow.camera.left = -26;
    moon.shadow.camera.right = 26;
    moon.shadow.camera.top = 26;
    moon.shadow.camera.bottom = -26;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 90;
    moon.shadow.bias = -0.0008;
    moon.shadow.normalBias = 0.03;
    this.moonLight = moon;
    this.scene.add(moon);

    // hemisphere fill keeps interiors from going pitch black
    this.hemi = new THREE.HemisphereLight(0x4a6a92, 0x1a1712, 0.42);
    this.scene.add(this.hemi);

    // ambient very low
    this.scene.add(new THREE.AmbientLight(0x233047, 0.22));

    // player's eye torch so the phone screen always reads well
    this.torch = new THREE.SpotLight(0xfff0d8, 3.2, 16, 0.72, 0.55, 1.4);
    this.torch.position.set(0, -0.1, 0);
    this.torch.castShadow = false;
    this.camera.add(this.torch);
    const target = new THREE.Object3D();
    target.position.set(0, -0.1, -6);
    this.camera.add(target);
    this.torch.target = target;

    // a little bounce light so faces/objects near the player aren't flat
    this.fillLight = new THREE.PointLight(0xbcd4ff, 0.5, 5, 2);
    this.camera.add(this.fillLight);
    this.fillLight.position.set(0, 0.1, -0.6);
  }

  _buildPost() {
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(size, 0.52, 0.85, 0.75);
    this.bloom.threshold = 0.82;
    this.bloom.strength = 0.5;
    this.bloom.radius = 0.7;
    this.composer.addPass(this.bloom);

    // grade + vignette + subtle grain + CA; also drives the alert flash
    this.grade = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        vignette: { value: 1.05 },
        grain: { value: 0.045 },
        alert: { value: 0 },
        time: { value: 0 },
        saturation: { value: 1.06 },
        warm: { value: 0.0 },
        fade: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float vignette, grain, alert, time, saturation, warm, fade;
        varying vec2 vUv;
        float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          vec2 uv = vUv;
          vec2 c = uv - 0.5;
          float d = length(c);
          // chromatic aberration grows toward the edges
          float ca = 0.0016 * d * (1.0 + alert * 3.0);
          vec3 col;
          col.r = texture2D(tDiffuse, uv + c * ca).r;
          col.g = texture2D(tDiffuse, uv).g;
          col.b = texture2D(tDiffuse, uv - c * ca).b;
          // grade
          float l = dot(col, vec3(0.299,0.587,0.114));
          col = mix(vec3(l), col, saturation);
          col += vec3(0.02,0.035,0.07) * (1.0 - l);
          col = mix(col, col * vec3(1.08,0.98,0.9), warm * 0.5);
          // vignette
          float v = smoothstep(0.95, 0.28, d * vignette);
          col *= mix(1.0, v, 0.85);
          // alert: red pulse at the edges
          float pulse = 0.5 + 0.5 * sin(time * 7.0);
          col = mix(col, vec3(0.75,0.06,0.12), smoothstep(0.42, 0.95, d) * alert * (0.35 + 0.35 * pulse));
          // grain
          float g = rand(uv * vec2(1024.0, 1024.0) + time) - 0.5;
          col += g * grain * (0.6 + 0.4 * (1.0 - l));
          col *= (1.0 - fade);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  /* ---------------------------- UI ----------------------------- */

  _bindUI() {
    const show = (id, on = true) => {
      document.querySelectorAll('.screen').forEach((s) => s.classList.remove('on'));
      if (on) screenEl(id)?.classList.add('on');
    };
    this.showScreen = show;

    screenEl('btnStart').addEventListener('click', () => this.startGame());
    screenEl('btnHelp').addEventListener('click', () => show('screenHelp'));
    screenEl('btnHelpBack').addEventListener('click', () => show('screenTitle'));
    screenEl('btnResume').addEventListener('click', () => this.resume());
    screenEl('btnPause').addEventListener('click', () => { if (this.state === 'playing') this.pause(); });
    screenEl('btnRestart').addEventListener('click', () => location.reload());
    screenEl('btnAgain').addEventListener('click', () => location.reload());
    screenEl('btnSound').addEventListener('click', (e) => {
      this.muted = !this.muted;
      this.audio.setMuted(this.muted);
      e.currentTarget.textContent = this.muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ';
      e.currentTarget.classList.toggle('on', !this.muted);
    });
    screenEl('btnQuality').addEventListener('click', (e) => {
      const next = this.quality === 'high' ? 'low' : 'high';
      this.setQuality(next);
      e.currentTarget.textContent = next === 'high' ? 'ГРАФИКА: ВЫСОКАЯ' : 'ГРАФИКА: БЫСТРАЯ';
    });

    // touch action buttons
    const btnUse = screenEl('btnUse');
    const btnCrouch = screenEl('btnCrouch');
    btnUse.addEventListener('pointerdown', (e) => { e.preventDefault(); this.input.interactPressed = true; this.pressBuffer = 0.25; });
    btnCrouch.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.toggleCrouch();
    });
    this.stickHeld = false;
    this.input.onStick = (stick) => this.hud.setStick(stick);
    this.input.onFirstGesture = () => this.audio.unlock();
    this.pressBuffer = 0;

    // pause when the app goes to the background
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    document.addEventListener('pointerdown', () => { if (!this.audio.ctx) this.audio.unlock(); }, { once: false });

    // optional service worker for offline play
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  toggleCrouch() {
    this.crouchToggle = !this.crouchToggle;
    screenEl('btnCrouch').style.borderColor = this.crouchToggle ? 'rgba(120,230,212,.8)' : '';
    screenEl('btnCrouch').style.color = this.crouchToggle ? '#bfffee' : '';
  }

  setQuality(q) {
    this.quality = q;
    const low = q === 'low';
    const dprCap = low ? (isTouch ? 1.0 : 1.25) : (isTouch ? 1.5 : 2);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    if (this.moonLight) {
      this.moonLight.castShadow = !low;
      const shadowSize = low ? 512 : isTouch ? 1024 : 2048;
      this.moonLight.shadow.mapSize.set(shadowSize, shadowSize);
    }
    this.renderer.shadowMap.enabled = !low;
    if (this.bloom) {
      this.bloom.enabled = !low;
      this.bloom.strength = low ? 0 : 0.38;
    }
    if (this.grade?.uniforms.grain) this.grade.uniforms.grain.value = low ? 0.006 : 0.012;
    const qualityButton = screenEl('btnQuality');
    if (qualityButton) qualityButton.textContent = low ? 'ГРАФИКА: БЫСТРАЯ' : 'ГРАФИКА: ВЫСОКАЯ';
    this._resize();
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
      this.bloom?.setSize(w, h);
    }
  }

  /* -------------------------- game flow ------------------------ */

  startGame() {
    this.audio.unlock();
    this.showScreen(null, false);
    this.hud.show(false);
    this.hud.setMoney(0);
    this.hud.setInventory(0, this.mission.productsNeeded);
    this.state = 'intro';
    this.wakeElapsed = 0;
    this.wakeBeat = 0;
    this.wakePose = sampleWakePose(0, 0, 0);
    this.wakeFinished = false;
    this.transitionFade = 0;

    // Start on the mattress, with the bedroom collider temporarily lifted;
    // the cinematic carries the player down to the safe standing spawn.
    const bed = this.house.bedPosition;
    const spawn = this.house.spawn;
    const drawer = this.house.interactions.find((it) => it.id === 'drawer');
    const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
    this.wakeStartYaw = yawTo(bed, drawer.position);
    // As the player stands, they look away from the bright bedside lamp toward
    // the clear doorway that leads out of the bedroom.
    this.wakeEndYaw = yawTo(spawn, this.house.bedroomDoorway);
    this.house.bedCollider.active = false;
    this.player.teleport(bed.x, bed.z, this.wakeStartYaw);
    this.player.frozen = true;
    this.player.eyeOverride = this.wakePose.eyeHeight;
    this.player.rollOverride = this.wakePose.roll;
    this.player.pitch = this.wakePose.pitch;
    this.camera.fov = this.wakePose.fov;
    this.camera.updateProjectionMatrix();
    this.blink = this.wakePose.fade;
    this.hud.setTask('Просыпайся');
  }

  _advanceWake(dt) {
    const previous = this.wakeElapsed;
    this.wakeElapsed = Math.min(WAKE_DURATION, previous + dt);
    const pose = sampleWakePose(this.wakeElapsed, this.wakeStartYaw, this.wakeEndYaw);
    this.wakePose = pose;
    this.blink = pose.fade;

    const bed = this.house.bedPosition;
    const spawn = this.house.spawn;
    this.player.position.set(
      lerp(bed.x, spawn.x, pose.stepOffBed),
      0,
      lerp(bed.z, spawn.z, pose.stepOffBed),
    );
    this.player.velocity.set(0, 0, 0);
    this.player.yaw = pose.yaw;
    this.player.pitch = pose.pitch;
    this.player.eyeOverride = pose.eyeHeight;
    this.player.rollOverride = pose.roll;
    this.player.frozen = true;

    if (previous < 1.7 && this.wakeElapsed >= 1.7) {
      this.hud.show(true);
      this.hud.say('…', 1.0);
    }
    if (previous < 2.65 && this.wakeElapsed >= 2.65) {
      this.hud.say('Утро. Точнее — четыре утра.', 2.2);
    }
    if (previous < 4.55 && this.wakeElapsed >= 4.55) {
      this.hud.say('Новый дом, старые вещи. И почти пустой кошелёк.', 2.45);
    }
    if (previous < 6.65 && this.wakeElapsed >= 6.65) {
      this.hud.say('В тумбочке у кровати что-то есть.', 2.2);
    }
  }

  _finishWake() {
    if (this.wakeFinished) return;
    this.wakeFinished = true;
    const p = this.player;
    const spawn = this.house.spawn;
    this.house.bedCollider.active = true;
    p.teleport(spawn.x, spawn.z, this.wakeEndYaw);
    p.pitch = -0.06;
    p.eyeHeight = 1.62;
    p.eyeOverride = null;
    p.rollOverride = null;
    p.fov = 72;
    p.fovTarget = 72;
    p.frozen = false;
    this.camera.fov = 72;
    this.camera.updateProjectionMatrix();
    this.blink = 0;
    this.grade.uniforms.fade.value = 0;
    this.state = 'playing';
    this.mission.stage = 'house';
    this.mission.updateObjective();
    this.audio.intensity = 0.35;
  }

  updateObjective() { this.mission.updateObjective(); }

  pause() {
    if (this.state !== 'playing' && this.state !== 'intro') return;
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.showScreen('screenPause');
    this.hud.show(false);
  }

  resume() {
    this.state = this.pausedFrom || 'playing';
    this.showScreen(null, false);
    this.hud.show(true);
    this.audio.unlock();
  }

  onDetected(guard) {
    if (this.state !== 'playing' || this.flags.alarmNow) return;
    this.flags.alarmNow = true;
    this.alertLevel = 1;
    this.audio.alarm();
    this.hud.toast('ТЕБЯ ЗАМЕТИЛИ', 'Беги или спрячься', 2.4);
    this.hud.say(guard.name === 'guard2' ? '— Эй! Кто там в подсобке?!' : '— Стой! Сюда нельзя!', 2.5);
    setTimeout(() => { this.flags.alarmNow = false; }, 2500);
  }

  onCaught(by) {
    if (this.state !== 'playing') return;
    this.mission.caught += 1;
    this.state = 'caught';
    this.player.frozen = true;
    this.audio.fail();
    this.hud.toast('ПОЙМАН', 'Охранник тебя держит', 2.6);
    this.crouchToggle = false;
    screenEl('btnCrouch').style.borderColor = '';
    screenEl('btnCrouch').style.color = '';
    // everything resets: night ends, you are back home
    setTimeout(() => this.endNight(false), 2200);
  }

  endNight(success) {
    this.state = 'end';
    this.hud.show(false);
    this.showScreen('screenEnd');
    const m = this.mission.summary();
    screenEl('endPhase').textContent = success ? 'Ночь прошла чисто' : 'Ночь закончилась';
    screenEl('endTitle').textContent = success ? 'ТИХАЯ СМЕНА' : 'ПОЙМАН';
    screenEl('endCard').innerHTML = `
      <div class="stat"><span>Товары</span><span>${m.products} / ${m.needed}</span></div>
      <div class="stat"><span>В кармане</span><span>${Math.round(m.money)} ₴</span></div>
      <div class="stat"><span>Пойман</span><span>${m.caught} раз</span></div>
      <div style="margin-top:10px;color:#9fb7c9;font-size:12.5px">
        ${success ? 'Ты вернулся домой до рассвета. Свет в окне магазина ещё горит — но уже без тебя.'
                  : 'Охранник вывел тебя за дверь. В следующий раз приседай и держись подальше от камер.'}
      </div>`;
  }

  /* --------------------------- interactions -------------------- */

  _nearestInteraction() {
    const p = this.player.position;
    const forwardX = -Math.sin(this.player.yaw);
    const forwardZ = -Math.cos(this.player.yaw);
    let best = null, bestD = Infinity;
    for (const it of this.interactions) {
      const dx = it.position.x - p.x;
      const dz = it.position.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d >= it.radius || d >= bestD) continue;
      // Don't offer an action for something directly behind the player. This
      // prevents the wake-up hint from pointing at the nightstand through the
      // player's back while the camera is facing the bedroom doorway.
      const facing = (dx * forwardX + dz * forwardZ) / Math.max(d, 1e-5);
      if (facing < -0.05) continue;
      best = it;
      bestD = d;
    }
    return best;
  }

  _doInteract(it) { this.mission.interact(it); }

  /* ----------------------------- loop -------------------------- */

  _frame() {
    const dtRaw = this.clock.getDelta();
    const dt = Math.min(dtRaw, 0.05);
    this.time += dt;

    if (this.state === 'playing' || this.state === 'intro' || this.state === 'caught') {
      this._updatePlaying(dt);
    } else if (this.state === 'end') {
      this._updateEnd(dt);
    } else {
      // title / paused: slow camera drift for a nice backdrop
      this._updateIdle(dt);
    }

    if (this.composer) this.composer.render();
  }

  _updateIdle(dt) {
    if (this.state === 'title') {
      const t = this.time * 0.06;
      this.camera.position.set(Math.sin(t) * 2.2, 1.7 + Math.sin(t * 1.7) * 0.08, 6.5 + Math.cos(t) * 1.4);
      this.camera.rotation.set(-0.02, Math.sin(t) * 0.5 + Math.PI, 0);
    }
    this.grade.uniforms.time.value = this.time;
    this.grade.uniforms.alert.value = damp(this.grade.uniforms.alert.value, 0, 3, dt);
  }

  _updateEnd(dt) {
    this.camera.position.y = damp(this.camera.position.y, 1.3, 2, dt);
    this.grade.uniforms.time.value = this.time;
  }

  _updatePlaying(dt) {
    const p = this.player;
    const input = this.input;
    const waking = this.state === 'intro';
    if (waking) this._advanceWake(dt);

    // Camera motion is scripted during the wake-up; normal touch/mouse look
    // takes over only when the player is standing and the mission begins.
    const look = input.consumeLook();
    if (!waking && this.state !== 'caught') p.look(look.dx, look.dy);

    // movement
    const inShop = p.position.z > 14.5;
    const surface = inShop ? 'tile' : (p.position.z > 1.5 && p.position.z < 14.5) ? 'concrete' : 'wood';
    p.surface = surface;
    const forceSneak = !!this.crouchToggle;
    p.update(dt, input, { forceSneak, hideHands: waking && !this.wakePose?.handsVisible });

    // footsteps noise model
    const spd = Math.hypot(p.velocity.x, p.velocity.z);
    const crouched = p.crouch > 0.5;
    const targetNoise = spd < 0.2 ? 0 : crouched ? 0.12 : spd > 3.9 ? 0.85 : spd > 2.2 ? 0.45 : 0.26;
    this.noiseLevel = damp(this.noiseLevel, Math.max(targetNoise, this.noiseLevel * 0.7), 6, dt);
    if (this.noiseLevel < 0.02) this.noiseLevel = 0;
    this.hud.setNoise(this.noiseLevel);

    // interactions
    const near = this.state === 'playing' ? this._nearestInteraction() : null;
    if (near) {
      const isTouchHint = isTouch ? 'A' : 'E';
      this.hud.showPrompt(near.label, isTouchHint);
    } else {
      this.hud.showPrompt('');
    }
    const pressed = input.consumeInteract() || this.pressBuffer > 0;
    if (pressed && near && this.state === 'playing') {
      this.pressBuffer = 0;
      this._doInteract(near);
    }
    if (input.consumePause()) this.pause();
    if (this.pressBuffer > 0) this.pressBuffer -= dt;

    // NPCs
    const gameView = {
      player: p, colliders: this.colliders, noiseLevel: this.noiseLevel,
      alertLevel: this.alertLevel,
      lightLevelAt: (pos) => this._lightAt(pos),
      onCaught: (by) => this.onCaught(by),
      onDetected: (g) => this.onDetected(g),
    };
    for (const npc of this.npcs) {
      // NPCs only think when reasonably close (perf on phone)
      const d = npc.pos.distanceTo(p.position);
      if (d > 26) continue;
      npc.update(dt, this.time, this.colliders, gameView);
    }

    // suspicion UI = the most suspicious guard
    const maxSusp = Math.max(...this.guards.map((g) => g.suspicion), 0);
    this.hud.setSuspicion(maxSusp);
    this.alertLevel = damp(this.alertLevel, this.guards.some((g) => g.state === NPC_STATE.CHASE) ? 1 : 0, 1.5, dt);
    this.grade.uniforms.alert.value = this.alertLevel;

    // heartbeat when in danger
    this._hbTimer = (this._hbTimer || 0) - dt;
    if (maxSusp > 0.55 && this._hbTimer <= 0) {
      this.audio.heartbeat();
      this._hbTimer = lerp(1.3, 0.55, maxSusp);
    }

    // camera cams animation
    for (const cam of this.shop.cameras) {
      const yaw = cam.baseYaw + Math.sin(this.time * 0.5 + cam.phase) * cam.sweep;
      cam.mesh.userData.head.rotation.y = yaw - cam.baseYaw;
      cam.mesh.userData.led.material.color.setHex(Math.sin(this.time * 3) > 0 ? 0xff2222 : 0x440808);
    }

    // dust drift
    if (this.dust) {
      const pos = this.dust.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        let y = pos.getY(i) + dt * 0.035;
        if (y > 3.3) y = 0.05;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(this.time * 0.5 + i) * dt * 0.006);
      }
      pos.needsUpdate = true;
    }

    // eyes closed intro / blink effect
    this._updateBlink(dt);

    // Objective triggers are paused until the scripted wake-up hands control
    // to the player. The cinematic itself is intentionally not a mission step.
    if (!waking) this._checkMissionProgress();

    // HUD timers and grading.
    this.hud.update(dt);
    this.grade.uniforms.time.value = this.time;
    this.sky.position.copy(this.camera.position);
    if (waking && this.wakeElapsed >= WAKE_DURATION) this._finishWake();
  }

  _updateBlink(dt) {
    const transitionTarget = this.flags.fading ? 1 : 0;
    this.transitionFade = damp(this.transitionFade || 0, transitionTarget, 3, dt);
    const wakeFade = this.state === 'intro' ? clamp(this.blink || 0, 0, 1) : 0;
    this.grade.uniforms.fade.value = Math.max(this.transitionFade, wakeFade);

    // A narrowed, softly widening view sells the shift from sleep to focus.
    const fov = this.state === 'intro' && this.wakePose ? this.wakePose.fov : this.player.fov;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  _lightAt(pos) {
    // crude "how lit is this spot" model driven by the shop interior
    if (pos.z > 14.5) {
      const back = pos.z > 27 ? 0.45 : 1;
      return clamp(back * (1 - Math.abs(pos.x) / 11), 0.15, 1);
    }
    if (pos.z < 2 && pos.z > -8) return 0.35; // house
    // outside: near lamps
    let best = 0.08;
    for (const [x, z] of this.street.lampPositions) {
      const d = Math.hypot(pos.x - x, pos.z - z);
      best = Math.max(best, clamp(1 - d / 9, 0, 1) * 0.8);
    }
    return best;
  }

  _checkMissionProgress() {
    const result = this.mission.checkProgress();
    if (result === 'win' && this.state === 'playing') this.endNight(true);
  }

}

const game = new Game();
window.__islamwork = game;
game.boot().catch((err) => {
  console.error(err);
  const label = document.getElementById('loadLabel');
  if (label) { label.textContent = 'ОШИБКА'; label.style.color = '#ff6b7a'; }
  const fill = document.getElementById('loadFill');
  if (fill) fill.style.background = '#ff4d5e';
});
