// The renderer, the camera and the level swap. One level per decision.

import * as THREE from '../vendor/three.module.js';
import { buildLevel } from './world.js';
import { updateActors } from './actors.js';
import { makeRng } from './rng.js';

export class Stage3D {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x5a6b4a, 1.1);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
    this.sun.position.set(14, 22, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const c = this.sun.shadow.camera;
    c.left = -30; c.right = 30; c.top = 30; c.bottom = -30; c.near = 1; c.far = 90;
    this.scene.add(this.sun);

    this.levelGroup = null;
    this.orbit = 0;
    this.orbitSpeed = 0.055;
    this.baseCam = new THREE.Vector3(7, 4, 9);
    this.baseAngle = Math.atan2(9, 7);
    this.interior = false;
    this.target = new THREE.Vector3(0, 1.2, 0);
    this.portrait = false;
    this.peeking = false;
    this.viewW = 1;
    this.viewH = 1;
    this.clock = new THREE.Clock();
    this.transition = 1;
    this.dragging = false;
    this.userOrbit = 0;
    this.zoom = 1;

    this._bindInput(canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _bindInput(canvas) {
    let lastX = 0;
    const down = (x) => { this.dragging = true; lastX = x; };
    const move = (x) => {
      if (!this.dragging) return;
      this.userOrbit += (x - lastX) * 0.008;
      lastX = x;
    };
    const up = () => { this.dragging = false; };

    canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); down(e.clientX); });
    canvas.addEventListener('pointermove', (e) => move(e.clientX));
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = Math.max(0.55, Math.min(2.2, this.zoom + e.deltaY * 0.0011));
    }, { passive: false });
  }

  resize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.viewW = w;
    this.viewH = h;
    // On a tall screen the question panel owns the bottom half of the canvas.
    this.portrait = h > w * 1.05;
    this.applyFraming();
  }

  setLevel(sceneId, ctx, seed) {
    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      disposeTree(this.levelGroup);
    }
    const rng = makeRng(`${seed}:${sceneId}`);
    const level = buildLevel(sceneId, ctx, rng);
    this.levelGroup = level.group;
    this.scene.add(level.group);

    this.scene.background = new THREE.Color(level.sky);
    this.scene.fog = new THREE.Fog(level.fog, 26, 130);

    if (level.dark) {
      this.hemi.intensity = 0.35;
      this.sun.intensity = 0.35;
    } else {
      this.hemi.intensity = 1.1;
      this.sun.intensity = 1.5;
    }

    this.baseCam.set(...level.camera);
    this.target.set(...level.target);
    this.baseAngle = Math.atan2(level.camera[2], level.camera[0]);
    this.interior = level.interior;
    this.orbit = 0;
    this.userOrbit = 0;
    this.zoom = 1;
    this.transition = 0;
    this.renderer.domElement.classList.add('level-in');
    setTimeout(() => this.renderer.domElement.classList.remove('level-in'), 600);
  }

  // Shifts the frustum so the scene sits in the strip of screen the question
  // panel is not covering. Cropping the projection is exact, where nudging the
  // look-at just tips the camera and shows more floor.
  applyFraming() {
    const w = this.viewW || 1;
    const h = this.viewH || 1;
    if (this.portrait && !this.peeking) {
      const shift = h * 0.2;
      this.camera.setViewOffset(w, h + shift * 2, 0, shift * 2, w, h);
    } else {
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
  }

  setPeek(on) {
    this.peeking = !!on;
    this.applyFraming();
  }

  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;

    // Rooms are built inside-out, so the camera can circle them freely — the
    // near wall simply is not drawn.
    if (!this.dragging) {
      this.orbit += dt * this.orbitSpeed * (this.interior ? 0.6 : 1);
    }
    this.transition = Math.min(1, this.transition + dt * 1.6);

    const a = this.baseAngle + this.orbit + this.userOrbit;
    // Cropping the frustum magnifies, so stand back by the same factor.
    const crop = this.portrait && !this.peeking ? 1.4 : 1;
    const radius = Math.hypot(this.baseCam.x, this.baseCam.z) * this.zoom * crop;
    const ease = 1 - Math.pow(1 - this.transition, 3);
    const height = this.baseCam.y * this.zoom * (crop > 1 ? 1.18 : 1) + (1 - ease) * 5;

    this.camera.position.set(
      Math.cos(a) * radius + this.target.x * 0.15,
      height,
      Math.sin(a) * radius + this.target.z * 0.15,
    );
    this.camera.lookAt(this.target);

    if (this.levelGroup) updateActors(this.levelGroup, t);
    this.renderer.render(this.scene, this.camera);
  }
}

function disposeTree(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m.dispose());
    }
  });
}
