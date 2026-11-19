// 3D preview (Three.js): the ball on its lighted base, shown glowing (simulated backlight),
// as a plain grey model for checking shape and raised markings, or as a thickness map.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { buildPreviewGrid, buildGlowTexture, MU } from './core/previewData.js';

const AMBER = new THREE.Color(1.0, 0.62, 0.25);

export class Preview {
  constructor(container) {
    this.container = container;
    this.mode = 'glow';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0a0f);
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(0, -480, 90);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 120;
    this.controls.maxDistance = 1500;

    // Lights only matter in plain mode
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x302830, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-300, -400, 500);
    this.scene.add(key);

    // Ball
    this.texture = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.generateMipmaps = true;
    this.glowMat = new THREE.MeshBasicMaterial({ map: this.texture, color: AMBER });
    this.raycaster = new THREE.Raycaster();
    this.onHover = null; // (u, v) on the ball surface, or null when the pointer is off the ball
    this._last = null;   // last field/settings/size, so switching views can redraw the texture
    this.plainMat = new THREE.MeshStandardMaterial({ color: 0xd9d4ca, roughness: 0.65, metalness: 0 });
    this.ballGeom = new THREE.BufferGeometry();
    this.ball = new THREE.Mesh(this.ballGeom, this.glowMat);
    this.scene.add(this.ball);

    // Collar + base
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.collarGlow = new THREE.MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(0.55) });
    this.baseMat = new THREE.MeshStandardMaterial({ color: 0x1b171d, roughness: 0.35, metalness: 0.2 });
    this.floorMat = new THREE.MeshStandardMaterial({ color: 0x120e13, roughness: 0.9 });

    const el = this.renderer.domElement;
    let hoverPending = false, lastEvt = null;
    el.addEventListener('pointermove', (e) => {
      lastEvt = e;
      if (hoverPending || !this.onHover || this.mode !== 'thickness') return;
      hoverPending = true;
      requestAnimationFrame(() => { hoverPending = false; this._hover(lastEvt); });
    });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && this.onHover) this.onHover(null); });
    // Touch screens have no hover: a tap shows the thickness readout instead
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && this.onHover && this.mode === 'thickness') this._hover(e);
    });
    // Dragging something on the ball (e.g. a photo): onDragStart(hit) returns true to take the
    // drag; the view then stays still while onDragMove(hit) follows the pointer.
    this.onDragStart = null; this.onDragMove = null; this.onDragEnd = null;
    let dragging = false;
    el.addEventListener('pointerdown', (e) => {
      if (!this.onDragStart || e.button !== 0) return;
      const hit = this._hit(e);
      if (!hit || !this.onDragStart(hit)) return;
      dragging = true;
      e.stopImmediatePropagation(); // keep the orbit controls from turning the view
      try { el.setPointerCapture(e.pointerId); } catch { /* no real pointer (e.g. synthetic events) */ }
    }, { capture: true });
    el.addEventListener('pointermove', (e) => { if (dragging && this.onDragMove) this.onDragMove(this._hit(e)); });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      if (this.onDragEnd) this.onDragEnd();
    };
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    // A click (press and release without dragging) on the ball reports where it landed
    this.onPick = null;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down || !this.onPick) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 5) return;
      const hit = this._hit(e);
      if (hit) this.onPick(hit);
    });

    this._resize = () => this.resize();
    new ResizeObserver(this._resize).observe(container);
    this.resize();
    const loop = () => { this.controls.update(); this.renderer.render(this.scene, this.camera); requestAnimationFrame(loop); };
    loop();
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setMode(mode) {
    const wasThickness = this.mode === 'thickness';
    this.mode = mode;
    this.ball.material = mode === 'plain' ? this.plainMat : this.glowMat;
    this.glowMat.color.copy(mode === 'thickness' ? new THREE.Color(1, 1, 1) : AMBER);
    this.collar && (this.collar.material = mode === 'plain' ? this.plainMat : this.collarGlow);
    this.scene.background.set(mode === 'glow' ? 0x0d0a0f : 0x1d1a20);
    if ((mode === 'thickness') !== wasThickness && this._last) {
      const { field, settings } = this._last;
      this.updateTexture(field, settings, 1600, 800);
    }
    if (mode !== 'thickness' && this.onHover) this.onHover(null);
  }

  /** Where a pointer event lands on the ball: { u, v, x, y } or null. */
  _hit(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.camera);
    const hit = this.raycaster.intersectObject(this.ball, false)[0];
    return hit && hit.uv ? { u: hit.uv.x, v: hit.uv.y, x: e.clientX - r.left, y: e.clientY - r.top } : null;
  }

  _hover(e) { this.onHover(this._hit(e)); }

  /** Rebuilds the ball surface (needed when shape, size or raised markings change). */
  updateGeometry(field, fine = true) {
    const g = buildPreviewGrid(field, fine ? 360 : 180, fine ? 180 : 90);
    this.ballGeom.dispose();
    this.ballGeom = new THREE.BufferGeometry();
    this.ballGeom.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
    this.ballGeom.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
    this.ballGeom.setIndex(new THREE.BufferAttribute(g.indices, 1));
    this.ballGeom.computeVertexNormals();
    this.ball.geometry = this.ballGeom;
  }

  /** Recomputes the glow texture. Width/height control sharpness vs speed. */
  updateTexture(field, settings, TW, TH) {
    this._last = { field, settings };
    const data = buildGlowTexture(field, settings, TW, TH, this.mode === 'thickness' ? 'thickness' : 'glow');
    const old = this.texture;
    const tex = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;
    this.texture = tex;
    this.glowMat.map = tex;
    this.glowMat.needsUpdate = true;
    old.dispose();
  }

  /** Collar, base and floor around the ball (preview only). */
  updateStand(shape, collar, settings) {
    // Panels can be turned round, so show both sides; lamps are only seen from outside
    const side = shape.kind === 'panel' ? THREE.DoubleSide : THREE.FrontSide;
    if (this.glowMat.side !== side) { this.glowMat.side = side; this.plainMat.side = side; this.glowMat.needsUpdate = true; this.plainMat.needsUpdate = true; }
    // Free the old stand's geometry and its own materials (shared ones are kept), but keep the
    // real base: it is put back below, since it only changes when the base settings change.
    const shared = new Set([this.plainMat, this.collarGlow, this.baseMat, this.floorMat]);
    for (const child of [...this.group.children]) {
      if (child === this._baseMesh) continue;
      child.geometry?.dispose();
      if (child.material && !shared.has(child.material)) child.material.dispose();
    }
    this.group.clear();
    if (this._baseMesh) this.group.add(this._baseMesh);
    if (shape.kind === 'panel') { this._panelStand(shape); return; }
    this.collar = null;
    const o = {};
    let zEdge = Infinity;
    for (let i = 0; i < 64; i++) {
      const th = (i / 64) * Math.PI * 2;
      shape.surf(th, shape.phiEdge(th), o);
      zEdge = Math.min(zEdge, o.z);
    }
    const zBot = zEdge - collar.height;
    // Collar as a tube
    const prof = [
      new THREE.Vector2(collar.ri, zBot), new THREE.Vector2(collar.ro, zBot),
      new THREE.Vector2(collar.ro, zEdge + 0.5), new THREE.Vector2(collar.ri, zEdge + 0.5),
      new THREE.Vector2(collar.ri, zBot),
    ];
    const collarGeom = new THREE.LatheGeometry(prof, 96);
    collarGeom.rotateX(Math.PI / 2);
    const tCol = Math.exp(-MU * (settings.opening.collarWall - settings.tMin));
    this.collarGlow.color.copy(AMBER).multiplyScalar(Math.max(0.15, tCol));
    this.collar = new THREE.Mesh(collarGeom, this.mode === 'plain' ? this.plainMat : this.collarGlow);
    this.group.add(this.collar);

    // A simple round base below the collar until the real one (setBase) has been built
    const baseR = collar.ro + 22, baseH = 22;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(baseR, baseR + 4, baseH, 96), this.baseMat);
    base.rotation.x = Math.PI / 2;
    base.position.z = zBot - baseH / 2;
    this.group.add(base);
    const ring = new THREE.Mesh(new THREE.RingGeometry(collar.ri, collar.ro + 2, 96),
      new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.9 }));
    ring.position.z = zBot + 0.05;
    this.group.add(ring);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(900, 64), this.floorMat);
    floor.position.z = zBot - baseH;
    this.group.add(floor);
    // Warm pool of light on the floor
    const pool = new THREE.Mesh(new THREE.CircleGeometry(baseR * 3, 64), new THREE.MeshBasicMaterial({
      color: AMBER, transparent: true, opacity: 0.08, depthWrite: false,
    }));
    pool.position.z = zBot - baseH + 0.2;
    this.group.add(pool);
    Object.assign(this, { _zBot: zBot, _standBase: base, _ring: ring, _floor: floor, _pool: pool, _lampTop: shape.c, _lampW: shape.a });

    // Frame the ball + base: fit the taller of (height, width/aspect) into the vertical field of view
    this._frameBox = { w: Math.max(shape.a, baseR) * 2, h: shape.c - (zBot - baseH) };
    this.controls.target.set(0, 0, (zBot - baseH + shape.c) / 2);
    if (this._baseMesh) this._placeBase();
  }

  /** A flat panel: a floor under its bottom edge (and a simple block until the real base is built). */
  _panelStand(panel) {
    this.collar = null;
    const zBot = panel.bottom;
    const w = panel.chordHalf * 2 + 8, d = Math.max(24, panel.sag + 24), h = 14;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), this.baseMat);
    base.position.set(0, -panel.sag / 2 + 6, zBot - h / 2 + 8);
    this.group.add(base);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(900, 64), this.floorMat);
    floor.position.z = zBot;
    this.group.add(floor);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(Math.max(120, w), 64), new THREE.MeshBasicMaterial({
      color: AMBER, transparent: true, opacity: 0.06, depthWrite: false,
    }));
    pool.position.z = zBot + 0.2;
    this.group.add(pool);
    base.visible = false; // shown only while the real base is being built (see setBase)
    Object.assign(this, { _zBot: zBot, _standBase: base, _ring: null, _floor: floor, _pool: pool, _lampTop: panel.c, _lampW: panel.chordHalf });
    this._frameBox = { w: panel.chordHalf * 2, h: panel.H };
    this.controls.target.set(0, 0, 0);
    if (this._baseMesh) this._placeBase();
  }

  /** Removes the real base (a panel with no base). */
  clearBase() {
    if (!this._baseMesh) return;
    this.group.remove(this._baseMesh); this._baseMesh.geometry.dispose(); this._baseMesh = null;
    if (this._floor && this._zBot != null) {
      this._floor.position.z = this._zBot;
      if (this._pool) this._pool.position.z = this._zBot + 0.2;
      this._frameBox = { w: this._lampW * 2, h: this._lampTop - this._zBot };
      this.controls.target.set(0, 0, (this._zBot + this._lampTop) / 2);
    }
  }

  /**
   * Shows the real base (a mesh in base coordinates: standing at z = 0) under the lamp, with its
   * seat floor where the collar's bottom is. info: { seatFloor, width }.
   */
  setBase(positions, indices, info) {
    if (this._baseMesh) { this.group.remove(this._baseMesh); this._baseMesh.geometry.dispose(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    this._baseMesh = new THREE.Mesh(g, this.baseMat);
    this._baseInfo = info;
    this.group.add(this._baseMesh);
    this._placeBase();
  }

  _placeBase() {
    if (this._zBot == null) return;
    const bottom = this._zBot - this._baseInfo.seatFloor;
    this._baseMesh.position.z = bottom;
    if (this._standBase) this._standBase.visible = false;
    if (this._ring) this._ring.visible = false;
    if (this._floor) this._floor.position.z = bottom;
    if (this._pool) this._pool.position.z = bottom + 0.2;
    this._frameBox = { w: Math.max(this._lampW, this._baseInfo.width / 2) * 2, h: this._lampTop - bottom };
    this.controls.target.set(0, 0, (bottom + this._lampTop) / 2);
  }

  frame() {
    const t = this.controls.target, box = this._frameBox || { w: 200, h: 200 };
    const vfov = (this.camera.fov * Math.PI) / 180;
    const needH = Math.max(box.h, box.w / Math.max(0.3, this.camera.aspect)) * 1.25;
    const dist = needH / 2 / Math.tan(vfov / 2) + Math.max(box.w, box.h) / 2;
    this.camera.position.set(t.x, t.y - dist, t.z + dist * 0.12);
    this.controls.update();
  }

  /** Snapshot of the current view as a data URL (used for project thumbnails). */
  snapshot() { return this.renderer.domElement.toDataURL('image/jpeg', 0.8); }
}
