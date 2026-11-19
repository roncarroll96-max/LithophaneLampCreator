// Lithophane Lamp Creator: app wiring (state, panels, preview updates, export, saving).

import { Preview } from './preview.js';
import { decodeImage, extractLuma, shrinkBase, autoAdjust, processPhoto, drawGray } from './image.js';
import { buildEllipsoidShape } from './core/shapes.js';
import { createField } from './core/field.js';
import { estimateTriangles, stlBytes } from './core/mesh.js';
import {
  defaultSettings, mergeSettings, SIZE_PRESETS, SHAPES, DETAIL_PRESETS,
  bodyAxes, collarDims, markingWidth, MAX_PHOTOS, defaultPhotoSettings, photoSlot, cubePhotoSlot,
  minCubeRound, maxOpening,
} from './core/settings.js';
import { autosave, loadAutosave, saveProjectFile, readProjectFile, projectPhotos, download } from './storage.js';
import { TEXT_FONTS, defaultTextItem, placementAt } from './core/textLayer.js';
import { buildTextMasks, masksCurrent, loadAllFonts } from './text.js';
import { loadMoon } from './moonData.js';
import { moonMap } from './core/moon.js';
import { APP_VERSION } from './version.js';
import { buildBase, SOCKETS, PANEL_BASE_KINDS } from './core/base.js';
import { buildPanel, resolvePanelSize, sizeLabel, RECT_SIZES, SIDE_SIZES, PANEL_OUTLINES, IN, panelEdgeThickness } from './core/panel.js';
import { createPanelField } from './core/panelField.js';
import { meshSdf, gridStep } from './core/sdf.js';

const OUTER_STEP = 1.0; // mm; the smooth outside needs far fewer points than the photo side

// ---------- App state (one object) ----------
const app = {
  settings: defaultSettings(),
  // Loaded pictures by photo id: { blob, name, base: { w, h, lum, alpha }, processed: { w, h, data, alpha }, dirty }
  images: {},
  selectedPhoto: null, // id of the photo being edited
  replaceTarget: null, // id whose picture the next chosen file replaces ("Change photo")
  shape: null,
  collar: null,
  field: null,
  textMasks: null,   // rendered text masks by item id
  moonPrep: null,    // prepared NASA Moon maps (loaded on first use)
  moonMap: null,     // Moon brightness for the current crater depth
  moonMapCraters: null,
  selectedText: null, // id of the text item being edited
  tab: 'photo',
  exporting: false,
  lastExport: null,
  lastBaseExport: null,
  baseInfo: null,    // sizes of the current base (see core/base.js)
  baseKey: null,     // settings the preview base was last built from
  showOriginal: false,
  dirty: { tone: false, shape: true, field: true },
  projectGen: 0,     // goes up on New / Open, so a photo still loading for the old project is dropped
  pendingPhotos: 0,  // new photos still loading (they count towards the photo limit)
  moonFailed: false, // the Moon maps could not be loaded (retry from the Shape tab)
};

const $ = (id) => document.getElementById(id);
let preview;
try {
  preview = new Preview($('viewport'));
} catch (err) {
  // No WebGL (turned off, blocked, or a very old graphics driver): explain instead of dead buttons
  $('fatalMsg').textContent = 'Your browser could not start 3D graphics (WebGL). Turn on "Use graphics acceleration" '
    + 'in the browser settings, update the browser, or try another one (Chrome, Edge, Firefox or Safari).';
  $('fatal').hidden = false;
  throw err;
}
$('appVersion').textContent = `v${APP_VERSION}`;
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

// ---------- Messages ----------
let toastTimer;
function toast(msg, kind = '', action = null) {
  const t = $('toast');
  t.textContent = msg; t.className = 'toast ' + kind; t.hidden = false;
  if (action) {
    const b = document.createElement('button');
    b.className = 'btn small toast-action'; b.textContent = action.label;
    b.addEventListener('click', () => { t.hidden = true; action.run(); });
    t.append(b);
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'err' || action ? 7000 : 3500);
}

// ---------- Settings path helpers ----------
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, val) {
  const keys = path.split('.'); const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj); target[last] = val;
}

// ---------- Update scheduling ----------
let rafPending = false, idleTimer = null, baseTimer = null;
function changed(group) {
  // A base setting doesn't change a ball or cube, only the base under it: rebuild just that.
  // (On a panel the light box's strip and slot also steer even glow, so the panel updates too.)
  if (group === 'base' && !isPanel()) {
    clearTimeout(baseTimer);
    baseTimer = setTimeout(refreshBasePreview, 280);
    scheduleAutosave();
    return;
  }
  if (group === 'tone') { const im = app.images[app.selectedPhoto]; if (im) im.dirty = true; }
  if (group === 'shape') app.dirty.shape = true;
  app.dirty.field = true;
  app.lastExport = null;
  if (!rafPending) { rafPending = true; requestAnimationFrame(() => { rafPending = false; update(true); }); }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => update(false), 280);
  scheduleAutosave();
}

function update(quick) {
  const s = app.settings;
  try {
    let toned = false;
    for (const cfg of s.photos) {
      const im = app.images[cfg.id];
      if (!im) continue;
      // While a slider moves, adjust a small copy of the photo (fast); the full-size picture
      // follows when the slider stops (and always before an export)
      if (quick && im.dirty && im.processed) {
        im.small ||= shrinkBase(im.base);
        im.processed = processPhoto(im.small, cfg); im.dirty = false; im.needFull = true; toned = true;
      } else if (!im.processed || im.dirty || (!quick && im.needFull)) {
        im.processed = processPhoto(im.base, cfg); im.dirty = false; im.needFull = false; toned = true;
      }
    }
    if (toned) { drawThumb(); drawRowThumbs(); }
    let shapeChanged = false;
    if (isPanel()) {
      // A rectangle starts in its photo's shape: keep its size in step with the photo
      const dims = resolvePanelSize(s.panel, panelPhotoAspect());
      if (dims.width !== s.panel.width || dims.height !== s.panel.height) {
        Object.assign(s.panel, dims); app.dirty.shape = true;
      }
    }
    if (app.dirty.shape && isPanel()) {
      const panel = buildPanel(s);
      const reframe = !app.shape || app.shape.kind !== 'panel';
      const sizeChanged = !reframe && (app.shape.W !== panel.W || app.shape.H !== panel.H);
      app.shape = panel; app.collar = null;
      preview.updateStand(panel, null, s);
      if (reframe) preview.frame();
      // The Shape tab shows the size: redraw it when the size (not just the curve) changed
      if (sizeChanged && app.tab === 'ball') setTimeout(renderTab);
      app.dirty.shape = false; shapeChanged = true;
    }
    if (app.dirty.shape) {
      const maxOpen = maxOpening(s);
      if (s.opening.diameter > maxOpen && maxOpen >= 20) {
        s.opening.diameter = maxOpen;
        toast(`The opening was made smaller (${maxOpen} mm) to fit this lamp size.`);
        if (app.tab === 'ball') setTimeout(renderTab);
      }
      const collar = collarDims(s);
      const shape = buildEllipsoidShape(bodyAxes(s), collar.ro);
      const firstShape = !app.shape || app.shape.kind === 'panel';
      app.shape = shape; app.collar = collar;
      preview.updateStand(shape, collar, s);
      if (firstShape) preview.frame();
      app.dirty.shape = false; shapeChanged = true;
    }
    if (!app.shape) return;
    ensureTextMasks();
    app.field = isPanel()
      ? createPanelField(s, app.shape, processedMap(), app.textMasks)
      : createField(s, app.shape, processedMap(), app.textMasks, ensureMoon());
    // A Moon-only lamp needs no photo, so don't cover it with the "choose a photo" card
    $('emptyState').classList.toggle('hidden', hasPhotos() || (isMoonShape() && s.moon.mode !== 'photo'));
    // The 3D surface only changes with the shape or raised parts (tone, photos and carved text
    // change just the glow picture on it); a quick coarse surface gets its sharp one when idle
    const raised = app.field.hasRaised;
    if (shapeChanged || raised || app._wasRaised !== raised || (!quick && !app._geomFine)) {
      preview.updateGeometry(app.field, !quick);
      app._geomFine = !quick;
    }
    app._wasRaised = raised;
    updateThicknessLegend();
    if (quick) preview.updateTexture(app.field, s, 560, 280); // fast while dragging; sharp pass follows
    else preview.updateTexture(app.field, s, 1600, 800);
    if (!quick) { app.dirty.field = false; refreshBasePreview(); if (app.tab === 'export') renderTab(); }
  } catch (err) {
    console.error(err);
    toast(err.message || String(err), 'err');
  }
}

// ---------- Photos ----------
const hasPhotos = () => app.settings.photos.some((p) => app.images[p.id]);
const isCube = () => SHAPES[app.settings.shape]?.body === 'cube';
const isPanel = () => SHAPES[app.settings.shape]?.body === 'panel';
/** "ball" or "panel", for labels. */
const where = () => (isPanel() ? 'panel' : 'ball');
/** Height / width of the photo a rectangle panel takes its shape from (the first one added). */
function panelPhotoAspect() {
  const list = app.settings.photos;
  for (let i = list.length - 1; i >= 0; i--) {
    const im = app.images[list[i].id];
    if (im && im.base) return im.base.h / im.base.w;
  }
  return null;
}
/** Where the n-th photo starts on a panel: the first fills it, later ones are smaller windows. */
function panelPhotoSlot(n) {
  if (n === 0 || !app.shape || app.shape.kind !== 'panel') return { panelW: null, panelX: 0, panelY: 0 };
  const { W, H } = app.shape;
  const spots = [[-0.22, 0.22], [0.22, 0.22], [-0.22, -0.22], [0.22, -0.22], [0, 0]];
  const [fx, fy] = spots[(n - 1) % spots.length];
  return { panelW: +(W * 0.42).toFixed(1), panelX: +(fx * W).toFixed(1), panelY: +(fy * H).toFixed(1), aspect: null, feather: 4 };
}
/** Lays the panel's photos out in a grid inside the frame, in list order. */
function arrangeCollage() {
  const s = app.settings, list = s.photos.filter((c) => app.images[c.id]);
  if (!app.shape || app.shape.kind !== 'panel' || !list.length) return;
  const { W, H } = app.shape;
  const inset = s.panel.frame ? s.panel.frameWidth + 2 : 3, gap = 3;
  // Pick the grid whose cells best match the photos' shape (and leave few empty cells)
  const n = list.length;
  const photoAspect = list.reduce((a, c) => a + Math.log(app.images[c.id].base.h / app.images[c.id].base.w), 0) / n;
  const cellOf = (cols) => {
    const rows = Math.ceil(n / cols);
    const cw = (W - 2 * inset - gap * (cols - 1)) / cols, ch = (H - 2 * inset - gap * (rows - 1)) / rows;
    return { cols, rows, cw, ch, score: Math.abs(Math.log(ch / cw) - photoAspect) + 0.25 * (rows * cols - n) };
  };
  let best = cellOf(1);
  for (let k = 2; k <= n; k++) { const c = cellOf(k); if (c.score < best.score) best = c; }
  const { cols, rows, cw, ch } = best;
  list.forEach((c, i) => {
    const r = Math.floor(i / cols), k = i % cols;
    const inRow = r === rows - 1 ? n - r * cols : cols; // centre a short last row
    const x0 = -W / 2 + inset + (W - 2 * inset - (inRow * cw + (inRow - 1) * gap)) / 2;
    Object.assign(c, {
      panelW: +cw.toFixed(1), aspect: +(ch / cw).toFixed(3), feather: 2, windowShape: 'rect',
      panelX: +(x0 + k * (cw + gap) + cw / 2).toFixed(1),
      panelY: +(H / 2 - inset - r * (ch + gap) - ch / 2).toFixed(1),
    });
  });
  changed('field'); renderTab();
}
/** Puts the photos on the cube's faces in list order: front, back, left, right, top. */
function fitPhotosToFaces() {
  if (!app.shape || app.shape.kind !== 'cube') return;
  app.settings.photos.forEach((cfg, i) => Object.assign(cfg, cubePhotoSlot(i, app.settings, app.shape)));
  changed('field'); renderTab();
}
const selectedCfg = () => app.settings.photos.find((p) => p.id === app.selectedPhoto) || null;
/** The adjusted picture of every photo, by id (what the field draws). */
function processedMap() {
  const m = {};
  for (const p of app.settings.photos) { const im = app.images[p.id]; if (im && im.processed) m[p.id] = im.processed; }
  return m;
}
const newPhotoId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Re-encodes the photo at working size: JPEG, or PNG when it has transparency to keep. */
async function normalizedBlob(image, w, h, keepAlpha) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(image, 0, 0, w, h);
  return new Promise((resolve) => (keepAlpha ? c.toBlob(resolve, 'image/png') : c.toBlob(resolve, 'image/jpeg', 0.92)));
}

/**
 * Loads a picture. With no id it becomes a new photo on the next free side (up to MAX_PHOTOS);
 * with an id it fills that photo (restoring a project, or "Change photo" when fresh).
 */
async function loadPhoto(blob, name, { fresh = true, id = null } = {}) {
  const s = app.settings, gen = app.projectGen;
  if (!id && s.photos.length + app.pendingPhotos >= MAX_PHOTOS) { toast(`A lamp can hold up to ${MAX_PHOTOS} photos. Remove one first.`, 'err'); return; }
  if (!id) app.pendingPhotos++;
  $('busy').hidden = false; $('busy').textContent = 'Loading photo…';
  try {
    const image = await decodeImage(blob);
    const base = extractLuma(image);
    const stored = fresh ? await normalizedBlob(image, base.w, base.h, !!base.alpha) : blob;
    image.close?.();
    if (gen !== app.projectGen || s !== app.settings) return; // a new project was started meanwhile
    let cfg = id ? s.photos.find((p) => p.id === id) : null;
    if (!cfg) {
      const topUp = app.shape?.elev ? Math.floor(app.shape.elev(1)) - 2 : 70;
      const slot = isPanel() ? panelPhotoSlot(s.photos.length)
        : isCube() && app.shape && app.shape.kind === 'cube'
        ? cubePhotoSlot(s.photos.length, s, app.shape) : photoSlot(s.photos.length, topUp);
      cfg = { ...defaultPhotoSettings(), ...slot, id: id || newPhotoId() };
      s.photos.unshift(cfg); // a new photo goes on top
    }
    if (fresh) {
      // A cube face is square, so its photo window stays square; elsewhere it follows the photo
      const aspect = cfg.projection === 'planar' ? (cfg.aspect ?? 1) : null;
      Object.assign(cfg, autoAdjust(base), { zoom: 1, panX: 0, panY: 0, rotate: 0, aspect, auto: true });
      if (Math.max(base.originalW, base.originalH) < 900) {
        toast('This photo is small (low resolution). It may look blurry on the ball.', 'err');
      }
    }
    app.images[cfg.id] = { blob: stored, name: name || 'photo', base, processed: null, dirty: true };
    app.selectedPhoto = cfg.id;
    $('emptyState').classList.add('hidden');
    changed('field');
    if (app.tab === 'photo') renderTab();
  } catch (err) {
    toast(err.message || 'Could not open that photo.', 'err');
  } finally {
    if (!id) app.pendingPhotos--;
    $('busy').hidden = true;
  }
}

const bgFor = (cfg) => (cfg.background === 'bright' ? 1 : cfg.background === 'dark' ? 0 : app.settings.photo.surround);

function drawThumb() {
  const c = document.getElementById('thumb');
  const cfg = selectedCfg(), im = cfg && app.images[cfg.id];
  if (!c || !im) return;
  const src = app.showOriginal ? im.base : im.processed;
  if (src) drawGray(c, src, 640, bgFor(cfg));
}
/** Small pictures in the photo list. */
function drawRowThumbs() {
  document.querySelectorAll('canvas[data-photo-thumb]').forEach((c) => {
    const cfg = app.settings.photos.find((p) => p.id === c.dataset.photoThumb);
    const im = cfg && app.images[cfg.id];
    if (im && im.processed) drawGray(c, im.processed, 56, bgFor(cfg));
  });
}

// ---------- Saving ----------
let saveTimer;
function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => autosave({ settings: app.settings, photos: photoFiles() }), 1200);
}
/** The pictures to save with the project, matching settings.photos by id. */
function photoFiles() {
  return app.settings.photos.filter((p) => app.images[p.id])
    .map((p) => ({ id: p.id, name: app.images[p.id].name, blob: app.images[p.id].blob }));
}

function projectBaseName() {
  const s = app.settings;
  const first = app.settings.photos.find((p) => app.images[p.id]);
  const n = ((first && app.images[first.id].name) || 'lamp').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 40);
  if (isPanel() && app.shape && app.shape.kind === 'panel') {
    return `${n}-panel-${app.shape.outline}-${Math.round(app.shape.W)}x${Math.round(app.shape.H)}mm`;
  }
  const size = s.shape === 'football' ? `${s.footballLength}x${s.footballWidth}mm`
    : isCube() ? `${s.cube.size}mm` : `${s.diameter}mm`;
  return `${n}-${s.shape}-${size}`;
}

// ---------- Base preview (a quick, coarse version of the base under the lamp) ----------
function refreshBasePreview() {
  const s = app.settings;
  if (!app.shape) return;
  const key = JSON.stringify([s.base, s.shape, s.diameter, s.footballLength, s.footballWidth, s.footballTip, s.cube, s.opening, s.tMax,
    isPanel() ? s.panel : null]);
  if (key === app.baseKey) return;
  app.baseKey = key;
  try {
    const base = buildBase(s, app.shape);
    if (!base) { // a panel with no base
      app.baseInfo = null; app.lastBaseExport = null; preview.clearBase();
      if (app.tab === 'base') renderTab();
      return;
    }
    app.baseInfo = base.info;
    const mesh = meshSdf(base.sdf, base.bounds, gridStep(base.bounds, 1.2, 3e6));
    preview.setBase(mesh.positions, mesh.indices, base.info);
    app.lastBaseExport = null;
    if (app.tab === 'base') renderTab();
  } catch (err) {
    console.error(err);
  }
}

// ---------- Moon maps (loaded the first time the Moon shape is chosen) ----------
let moonLoading = false;
const isMoonShape = () => SHAPES[app.settings.shape]?.markings === 'moon';
function ensureMoon() {
  if (!isMoonShape()) return null;
  if (!app.moonPrep) {
    if (!moonLoading && !app.moonFailed) {
      moonLoading = true;
      loadMoon()
        .then((prep) => { app.moonPrep = prep; changed('field'); })
        .catch((err) => {
          console.error(err); app.moonFailed = true;
          toast(`The Moon maps could not be loaded: ${err.message || err}`, 'err');
        })
        .finally(() => { moonLoading = false; if (['ball', 'export'].includes(app.tab)) renderTab(); });
    }
    return null;
  }
  const craters = app.settings.moon.craters;
  if (!app.moonMap || app.moonMapCraters !== craters) {
    app.moonMap = moonMap(app.moonPrep, craters);
    app.moonMapCraters = craters;
  }
  return app.moonMap;
}

// ---------- Text masks (drawn from the fonts in the background, then the preview updates) ----------
let textBuild = null;
function ensureTextMasks() {
  const items = app.settings.texts;
  if (textBuild || masksCurrent(items, app.textMasks)) return;
  textBuild = buildTextMasks(items)
    .then((m) => { app.textMasks = m; changed('field'); })
    .catch((err) => { console.error(err); toast(`Text could not be drawn: ${err.message || err}`, 'err'); })
    .finally(() => { textBuild = null; });
}

// ---------- Panel controls ----------
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const section = (title, ...kids) => el('div', { class: 'section' }, el('h3', {}, title), ...kids);
const note = (text, cls = '') => el('p', { class: 'note ' + cls }, text);

/** Which part of the app a setting changes: base settings only rebuild the base. */
const groupFor = (path) => (path.startsWith('base.') ? 'base' : 'field');

function slider(path, label, min, max, step, { fmt = (v) => v, group = groupFor(path), disabled = false, map } = {}) {
  const s = app.settings;
  const cur = getPath(s, path);
  const val = el('span', { class: 'val', title: 'Double-click to reset' }, fmt(cur));
  const input = el('input', { type: 'range', min, max, step, value: cur, disabled, 'aria-label': label });
  input.addEventListener('input', () => {
    let v = parseFloat(input.value);
    if (map) v = map(v);
    setPath(s, path, v); val.textContent = fmt(v); changed(group);
  });
  val.addEventListener('dblclick', () => {
    const d = defaultFor(path);
    if (typeof d !== 'number') return;
    setPath(s, path, d); input.value = d; val.textContent = fmt(d); changed(group);
  });
  return el('div', { class: 'ctl' + (disabled ? ' disabled' : '') }, el('label', {}, label), val, input);
}

/** Default value for a settings path, including per-photo and per-text settings. */
function defaultFor(path) {
  let m = path.match(/^photos\.\d+\.(.+)$/);
  if (m) return getPath(defaultPhotoSettings(), m[1]);
  m = path.match(/^texts\.\d+\.(.+)$/);
  if (m) return getPath(defaultTextItem(), m[1]);
  return getPath(defaultSettings(), path);
}

function segmented(path, options, group = groupFor(path), after) {
  const s = app.settings;
  const bar = el('div', { class: 'segbar', role: 'group' });
  for (const o of options) {
    const b = el('button', { class: 'seg' + (getPath(s, path) === o.value ? ' active' : ''), disabled: !!o.disabled, title: o.title || null }, o.label);
    b.addEventListener('click', () => {
      setPath(s, path, o.value); changed(group);
      bar.querySelectorAll('.seg').forEach((x) => x.classList.remove('active')); b.classList.add('active');
      after && after(o.value);
    });
    bar.append(b);
  }
  return bar;
}

function checkbox(path, label, group = groupFor(path), after) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!getPath(app.settings, path);
  input.addEventListener('change', () => { setPath(app.settings, path, input.checked); changed(group); after && after(input.checked); });
  return el('label', { class: 'check' }, input, label);
}

/** "Height matches the photo" on = aspect null (follow the photo); off = a fixed window height. */
function aspectToggle() {
  const p = selectedCfg(), im = p && app.images[p.id];
  const input = el('input', { type: 'checkbox' });
  input.checked = p.aspect == null;
  input.addEventListener('change', () => {
    p.aspect = input.checked ? null : +(im ? im.base.h / im.base.w : 0.75).toFixed(2);
    changed('field'); renderTab();
  });
  return el('label', { class: 'check' }, input, 'Window height matches the photo');
}

const mm = (v) => `${(+v).toFixed(1)} mm`;
const pct = (v) => `${Math.round(v * 100)}%`;
const deg = (v) => `${Math.round(v)}°`;
const num2 = (v) => (+v).toFixed(2);

// ---------- Tabs ----------
function renderTab() {
  const body = $('tabBody');
  const scroll = body.scrollTop;
  // Sections can be left out with null; skip those (replaceChildren would show them as "null")
  body.replaceChildren(...({ photo: photoTab, ball: ballTab, markings: markingsTab, text: textTab, base: baseTab, export: exportTab }[app.tab])().filter(Boolean));
  body.scrollTop = scroll;
  if (app.tab === 'photo') { drawThumb(); drawRowThumbs(); }
}

function addPhoto() { app.replaceTarget = null; $('filePhoto').click(); }

function photoTab() {
  const s = app.settings, list = s.photos;
  if (!list.some((p) => p.id === app.selectedPhoto)) app.selectedPhoto = list[0] ? list[0].id : null;
  const idx = list.findIndex((p) => p.id === app.selectedPhoto);
  const p = list[idx], im = p && app.images[p.id];
  const P = (k) => `photos.${idx}.${k}`;

  const move = (i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; changed('field'); renderTab(); };
  const rows = list.map((c, i) => el('div', { class: 'text-row photo-row' + (c.id === app.selectedPhoto ? ' active' : '') },
    el('button', { class: 'text-pick', title: 'Edit this photo', onclick: () => { app.selectedPhoto = c.id; renderTab(); } },
      el('canvas', { 'data-photo-thumb': c.id, class: 'row-thumb' }),
      el('span', {}, (app.images[c.id] && app.images[c.id].name) || 'photo')),
    el('button', { class: 'btn small', title: 'Bring forward (in front of the photo below)', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
    el('button', { class: 'btn small', title: 'Send backward', disabled: i === list.length - 1, onclick: () => move(i, 1) }, '↓'),
    el('button', { class: 'btn small', title: c.hidden ? `Show on the ${where()}` : `Hide from the ${where()}`, onclick: () => { c.hidden = !c.hidden; changed('field'); renderTab(); } }, c.hidden ? 'Show' : 'Hide'),
    el('button', {
      class: 'btn small', title: 'Make a copy a little further round', disabled: list.length >= MAX_PHOTOS,
      onclick: () => {
        const src = app.images[c.id]; if (!src) return;
        const copy = isPanel()
          ? { ...structuredClone(c), id: newPhotoId(), ...(c.panelW > 0 ? { panelX: c.panelX + 15, panelY: c.panelY - 15 } : panelPhotoSlot(1)) }
          : { ...structuredClone(c), id: newPhotoId(), around: ((c.around + 210) % 360) - 180 };
        list.splice(i, 0, copy);
        app.images[copy.id] = { ...src, processed: null, dirty: true };
        app.selectedPhoto = copy.id; changed('field'); renderTab();
      },
    }, 'Copy'),
    el('button', {
      class: 'btn small', title: 'Remove this photo',
      onclick: () => {
        const removedImage = app.images[c.id], gen = app.projectGen;
        list.splice(i, 1); delete app.images[c.id]; changed('field'); renderTab();
        toast('Photo removed.', '', {
          label: 'Undo',
          run: () => {
            if (gen !== app.projectGen || list !== app.settings.photos || list.length >= MAX_PHOTOS) return;
            list.splice(Math.min(i, list.length), 0, c); app.images[c.id] = removedImage;
            app.selectedPhoto = c.id; $('emptyState').classList.add('hidden'); changed('field'); renderTab();
          },
        });
      },
    }, 'Remove'),
  ));

  const plainBall = section(`Plain ${where()}`,
    // Show the wall it makes, in mm, so it matches the Thickness view readout
    slider('photo.surround', `Plain ${where()} brightness`, 0, 1, 0.01, {
      fmt: (v) => `${pct(v)} (${(s.tMin + (1 - v) * (s.tMax - s.tMin)).toFixed(2)} mm)`,
    }),
    note(`The ${where()} outside your photos.`));

  const out = [
    section(`Photos on the ${where()}`,
      list.length ? el('div', { class: 'text-list' }, rows) : note('No photo yet. Choose one, or drop it on the preview.'),
      el('div', { class: 'row', style: 'margin-top:8px' },
        el('button', { class: 'btn small', disabled: list.length >= MAX_PHOTOS, onclick: addPhoto }, '+ Add photo'),
        el('span', { class: 'note', style: 'margin:0' }, `${list.length} of ${MAX_PHOTOS}`)),
      list.length ? note(list.length > 1
        ? `Drag the selected photo on the ${where()} to move it (pick it in this list first). Where photos overlap, the one higher in the list is in front.`
        : `Drag the photo on the ${where()} to move it.`) : null,
      isPanel() && list.length > 1
        ? el('button', { class: 'btn small', onclick: arrangeCollage, title: 'Lay the photos out in a grid inside the frame, in list order' }, 'Arrange as collage')
        : null,
      isMoonShape() && s.moon.mode !== 'photo'
        ? note('The Moon is set to "Moon only", so photos are not used. Choose "Photo + Moon" on the Shape tab to show them.', 'warn')
        : null,
    ),
  ];
  if (!p || !im) { out.push(plainBall); return out; }

  const thumb = el('canvas', { id: 'thumb', title: 'Grey map: lighter = thinner plastic = brighter when lit' });
  const holdBtn = el('button', { class: 'btn small', title: 'Hold to compare with the original' }, 'Hold: original');
  const setOrig = (on) => { app.showOriginal = on; drawThumb(); };
  holdBtn.addEventListener('pointerdown', () => setOrig(true));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => holdBtn.addEventListener(ev, () => setOrig(false)));
  const autoBtn = el('button', {
    class: 'btn small',
    onclick: () => { Object.assign(p, autoAdjust(im.base)); changed('tone'); renderTab(); toast('Automatic adjustments applied.'); },
  }, 'Auto adjust');
  const changeBtn = el('button', { class: 'btn small', onclick: () => { app.replaceTarget = p.id; $('filePhoto').click(); } }, 'Change photo');
  const upMax = app.shape?.elev ? Math.floor(app.shape.elev(1)) : 80;
  const upMin = app.shape?.elev ? Math.ceil(app.shape.elev(0.03)) : -60;

  out.push(
    section('Selected photo',
      el('div', { class: 'thumb-wrap' }, thumb),
      el('div', { class: 'row', style: 'margin-top:8px' }, changeBtn, holdBtn, autoBtn),
      note('Lighter areas print thinner and glow brighter.'),
    ),
    im.base.alpha ? section('Background (cut-out photo)',
      note('This photo has a transparent background. Choose what shows there:'),
      segmented(P('background'), [
        { value: 'blend', label: 'Blend in', title: 'The subject floats on whatever is behind it (the ball, the Moon or another photo)' },
        { value: 'bright', label: 'Bright', title: 'A glowing halo behind the subject' },
        { value: 'dark', label: 'Dark', title: 'A dark background so the subject stands out' },
      ], 'field', () => { drawThumb(); renderTab(); }),
      slider(P('edgeSoft'), 'Edge softness', 0, 10, 0.5, { fmt: mm }),
    ) : null,
    section('Tone',
      slider(P('blackPoint'), 'Black point', 0, 0.6, 0.005, { fmt: num2, group: 'tone' }),
      slider(P('whitePoint'), 'White point', 0.4, 1, 0.005, { fmt: num2, group: 'tone' }),
      slider(P('brightness'), 'Brightness', -0.4, 0.4, 0.01, { fmt: num2, group: 'tone' }),
      slider(P('contrast'), 'Contrast', 0.5, 2, 0.01, { fmt: num2, group: 'tone' }),
      slider(P('gamma'), 'Midtones (lift shadows →)', 0.5, 2.5, 0.01, { fmt: num2, group: 'tone' }),
      slider(P('sharpen'), 'Sharpen', 0, 2, 0.05, { fmt: num2, group: 'tone' }),
      checkbox(P('invert'), 'Invert (negative)', 'tone'),
    ),
    section('Position in window',
      slider(P('zoom'), 'Zoom', 0.5, 4, 0.01, { fmt: (v) => `${(+v).toFixed(2)}×` }),
      slider(P('panX'), 'Move left / right', -0.5, 0.5, 0.005, { fmt: num2 }),
      slider(P('panY'), 'Move up / down', -0.5, 0.5, 0.005, { fmt: num2 }),
      slider(P('rotate'), 'Rotate', -180, 180, 0.5, { fmt: deg }),
    ),
    isPanel() ? panelWindowSection(p, P) : section('Photo window on the ball',
      slider(P('around'), 'Around the ball', -180, 180, 0.5, { fmt: deg }),
      slider(P('centerY'), 'Up / down', upMin, upMax, 0.5, { fmt: mm }),
      slider(P('coverage'), 'Size (how far around)', 10, 360, 0.5, {
        fmt: (v) => `${Math.round(v)}° (${app.shape ? Math.round((v / 360) * app.shape.eqPerimeter) : '?'} mm wide)`,
      }),
      aspectToggle(),
      p.aspect == null
        ? null
        : slider(P('aspect'), 'Window height', 0.25, 1.6, 0.01, { fmt: (v) => `${Math.round(v * 100)}% of width` }),
      slider(P('feather'), 'Soft edge', 0, 40, 0.5, { fmt: mm }),
      el('div', { class: 'ctl' }, el('label', {}, 'Window shape')),
      segmented(P('windowShape'), [{ value: 'rect', label: 'Rectangle' }, { value: 'oval', label: 'Oval' }]),
      el('div', { class: 'ctl' }, el('label', {}, 'Projection')),
      segmented(P('projection'), [
        { value: 'natural', label: 'Natural', title: 'No squeezing; best for a window on the side' },
        { value: 'flat', label: 'Flat', title: 'Best for the top of the ball or a small photo' },
        { value: 'planar', label: 'Straight-on', title: 'No distortion on a flat face (cube); a straight-on view on a ball' },
        { value: 'wrap', label: 'Wrap', title: 'Fills all the way around; best near 360°' },
      ]),
    ),
    plainBall,
  );
  return out;
}

/** Photo tab, flat panel: where the selected photo sits on the panel. */
function panelWindowSection(p, P) {
  const W = app.shape && app.shape.kind === 'panel' ? app.shape.W : 150;
  const H = app.shape && app.shape.kind === 'panel' ? app.shape.H : 150;
  const fill = !(p.panelW > 0);
  const fillBox = el('input', { type: 'checkbox' });
  fillBox.checked = fill;
  fillBox.addEventListener('change', () => {
    if (fillBox.checked) Object.assign(p, { panelW: null, panelX: 0, panelY: 0 });
    else Object.assign(p, { panelW: +(W * 0.6).toFixed(1), panelX: 0, panelY: 0, aspect: null });
    changed('field'); renderTab();
  });
  return section('Photo on the panel',
    el('label', { class: 'check' }, fillBox, 'Fill the whole panel'),
    fill ? note('Use Zoom and Move in "Position in window" (or drag it on the panel) to choose what shows.') : [
      slider(P('panelX'), 'Left / right', Math.round(-W / 2), Math.round(W / 2), 0.5, { fmt: mm }),
      slider(P('panelY'), 'Up / down', Math.round(-H / 2), Math.round(H / 2), 0.5, { fmt: mm }),
      slider(P('panelW'), 'Width', 10, Math.round(W), 0.5, { fmt: mm }),
      aspectToggle(),
      p.aspect == null ? null : slider(P('aspect'), 'Window height', 0.25, 2, 0.01, { fmt: (v) => `${Math.round(v * 100)}% of width` }),
      slider(P('feather'), 'Soft edge', 0, 40, 0.5, { fmt: mm }),
      el('div', { class: 'ctl' }, el('label', {}, 'Window shape')),
      segmented(P('windowShape'), [{ value: 'rect', label: 'Rectangle' }, { value: 'oval', label: 'Oval' }]),
    ],
  );
}

/** Shape tab, flat panel: outline, size, curve, frame and feet. */
function panelSections() {
  const s = app.settings, pn = s.panel;
  const shapeSeg = segmented('panel.outline', Object.entries(PANEL_OUTLINES).map(([k, label]) => ({ value: k, label })), 'shape', (v) => {
    pn.size = v === 'rect' ? 'photo' : '6';
    renderTab();
  });
  const rect = pn.outline === 'rect';
  const sizeOpts = rect
    ? [{ value: 'photo', label: 'Match photo', title: 'The photo\'s own shape: nothing is cropped' },
      ...Object.keys(RECT_SIZES).map((k) => ({ value: k, label: k.replace('x', '×'), title: `${k.replace('x', '×')} inch photo print size` })),
      { value: 'custom', label: 'Custom' }]
    : [...Object.keys(SIDE_SIZES).map((k) => ({ value: k, label: `${k} in` })), { value: 'custom', label: 'Custom' }];
  const sizeSeg = segmented('panel.size', sizeOpts, 'shape', () => renderTab());
  const num = (path, label, lo, hi) => {
    const i = el('input', { type: 'number', min: lo, max: hi, step: 1, value: Math.round(getPath(s, path)), style: 'width:76px', 'aria-label': label });
    i.addEventListener('change', () => {
      const v = Math.min(hi, Math.max(lo, parseFloat(i.value) || getPath(s, path)));
      i.value = v; setPath(s, path, v); changed('shape'); renderTab();
    });
    return el('div', { class: 'row', style: 'margin-top:8px' }, el('span', { class: 'grow' }, label), i);
  };
  const W = app.shape && app.shape.kind === 'panel' ? app.shape.W : pn.width;
  const H = app.shape && app.shape.kind === 'panel' ? app.shape.H : pn.height;
  return [
    section('Panel shape', shapeSeg,
      pn.outline === 'circle' || pn.outline === 'heart'
        ? note('It has a small flat on the bottom so it stands up and sits in a base.') : null),
    section('Size', sizeSeg,
      rect && pn.size === 'photo' ? num('panel.longSide', 'Longest side (mm)', 50, 300) : null,
      rect && pn.size === 'custom' ? [num('panel.width', 'Width (mm)', 30, 300), num('panel.height', 'Height (mm)', 30, 300)] : null,
      !rect && pn.size === 'custom' ? num('panel.side', 'Size across (mm)', 40, 300) : null,
      note(`Size: ${sizeLabel(W, H)}.` + (rect && pn.size !== 'custom' && pn.size !== 'photo' ? ' Portrait or landscape follows the photo.' : ''))),
    section('Curve',
      slider('panel.curve', 'Curve (side to side)', 0, 120, 1, { fmt: (v) => (+v < 0.5 ? 'Flat' : `${Math.round(v)}°`), group: 'shape' }),
      note('A curved panel stands on its own and spreads the light more evenly. Its left and right edges come toward you.')),
    section('Frame and feet',
      checkbox('panel.frame', 'Raised frame round the edge (on the back)', 'shape', () => renderTab()),
      pn.frame ? [
        slider('panel.frameWidth', 'Frame width', 2, 20, 0.5, { fmt: mm }),
        slider('panel.frameExtra', 'Frame thickness (above Thickest)', 0.5, 4, 0.1, { fmt: (v) => `+${(+v).toFixed(1)} mm (${(s.tMax + +v).toFixed(1)} mm)` }),
      ] : null,
      checkbox('panel.feet', 'Feet on the bottom edge (to stand without a base)', 'field', () => renderTab()),
      pn.feet && s.base.panelKind !== 'none' ? note('Turn the feet off if the panel goes into a base (Base tab): they won\'t fit the slot.', 'warn') : null,
      note('The front stays smooth; the picture and the frame are on the back. It prints standing up on its bottom edge.')),
  ];
}

function ballTab() {
  const s = app.settings;
  const shapeSel = el('select', { 'aria-label': 'Ball shape' },
    Object.entries(SHAPES).map(([k, v]) => {
      const o = el('option', { value: k, disabled: !v.ready }, v.label + (v.ready ? '' : ' (coming soon)'));
      if (k === s.shape) o.selected = true;
      return o;
    }));
  shapeSel.addEventListener('change', () => { s.shape = shapeSel.value; changed('shape'); renderTab(); });

  const sizeSeg = segmented('sizePreset', [
    ...Object.entries(SIZE_PRESETS).map(([k, v]) => ({ value: k, label: `${v.label} ${isCube() ? v.cubeSize : v.diameter}` })),
    { value: 'custom', label: 'Custom' },
  ], 'shape', (v) => {
    if (SIZE_PRESETS[v]) {
      Object.assign(s, { diameter: SIZE_PRESETS[v].diameter, footballLength: SIZE_PRESETS[v].footballLength, footballWidth: SIZE_PRESETS[v].footballWidth });
      s.cube.size = SIZE_PRESETS[v].cubeSize;
    }
    changed('shape'); renderTab();
  });
  const cubeInput = el('input', { type: 'number', min: 60, max: 200, step: 1, value: s.cube.size, 'aria-label': 'Cube size in mm' });
  cubeInput.addEventListener('change', () => {
    const v = Math.min(200, Math.max(60, parseFloat(cubeInput.value) || 100));
    cubeInput.value = v; s.cube.size = v;
    s.sizePreset = Object.keys(SIZE_PRESETS).find((k) => SIZE_PRESETS[k].cubeSize === v) || 'custom';
    changed('shape'); renderTab();
  });
  const dia = el('input', { type: 'number', min: 60, max: 250, step: 1, value: s.diameter, 'aria-label': 'Diameter in mm' });
  const footballInput = (key, lo, hi) => {
    const i = el('input', { type: 'number', min: lo, max: hi, step: 1, value: s[key], style: 'width:76px', 'aria-label': key === 'footballLength' ? 'Football length in mm' : 'Football width in mm' });
    i.addEventListener('change', () => {
      const v = Math.min(hi, Math.max(lo, parseFloat(i.value) || s[key]));
      i.value = v; s[key] = v;
      s.sizePreset = Object.keys(SIZE_PRESETS).find((k) => SIZE_PRESETS[k].footballLength === s.footballLength && SIZE_PRESETS[k].footballWidth === s.footballWidth) || 'custom';
      changed('shape'); renderTab();
    });
    return i;
  };
  dia.addEventListener('change', () => {
    const v = Math.min(250, Math.max(60, parseFloat(dia.value) || 150));
    dia.value = v; s.diameter = v; s.sizePreset = Object.keys(SIZE_PRESETS).find((k) => SIZE_PRESETS[k].diameter === v) || 'custom';
    changed('shape'); renderTab();
  });

  const wall = section('Wall thickness',
    slider('tMin', 'Thinnest (brightest)', 0.4, 2, 0.05, { fmt: mm, map: (v) => Math.min(v, s.tMax - 0.5) }),
    // The cube's edge rounding can't be tighter than the thickest wall, so tMax reshapes it
    slider('tMax', 'Thickest (darkest)', 1.5, 5, 0.05, { fmt: mm, map: (v) => Math.max(v, s.tMin + 0.5), group: isCube() ? 'shape' : 'field' }),
    note('Typical white PLA: 0.8 mm to 3.0 mm.'));
  if (isPanel()) return [section('Shape', shapeSel), ...panelSections(), wall];
  return [
    section('Shape', shapeSel),
    isCube() ? section('Cube',
      slider('cube.round', 'Edge rounding', minCubeRound(s), 15, 0.5, { fmt: (v) => mm(Math.max(v, minCubeRound(s))), group: 'shape' }),
      slider('cube.border', 'Photo border', 2, 20, 0.5, { fmt: mm }),
      el('button', { class: 'btn small', onclick: fitPhotosToFaces, disabled: !s.photos.length, title: 'Front, back, left, right, top, in list order' }, 'Fit photos to faces'),
      note('Each photo fills its face, leaving the border plain. Photos go front, back, left, right, top in list order.'),
      checkbox('evenGlow.on', 'Even glow (thinner plastic farther from the light)', 'field', () => renderTab()),
      s.evenGlow.on ? slider('evenGlow.strength', 'Even glow strength', 0, 1, 0.01, { fmt: pct }) : null,
      note('Prints upside down with its top face on the bed, so no supports are needed. The underside slopes down to the opening like a funnel.'),
    ) : null,
    isMoonShape() ? section('Moon',
      segmented('moon.mode', [
        { value: 'moon', label: 'Moon only', title: 'A classic moon lamp' },
        { value: 'photo', label: 'Photo + Moon', title: 'Your photo in a front window, fading into the Moon' },
      ], 'field', () => renderTab()),
      slider('moon.craters', 'Crater depth', 0, 1, 0.01, { fmt: pct }),
      slider('moon.spin', 'Turn the Moon', -180, 180, 1, { fmt: deg }),
      app.moonPrep ? note('Moon maps: NASA Scientific Visualization Studio (CGI Moon Kit).')
        : app.moonFailed ? [note('The Moon maps could not be loaded, so the Moon has no surface yet.', 'warn'),
          el('button', { class: 'btn small', onclick: () => { app.moonFailed = false; changed('field'); renderTab(); } }, 'Try again')]
        : note('Loading the Moon maps...'),
    ) : null,
    section('Size', sizeSeg,
      isCube()
        ? el('div', { class: 'row', style: 'margin-top:10px' }, el('span', { class: 'grow' }, 'Cube size (mm)'), cubeInput)
        : s.shape === 'football'
        ? el('div', { class: 'row', style: 'margin-top:10px;gap:8px' },
          el('span', { class: 'grow' }, 'Length × width (mm)'), footballInput('footballLength', 120, 320), footballInput('footballWidth', 70, 200))
        : el('div', { class: 'row', style: 'margin-top:10px' }, el('span', { class: 'grow' }, 'Ball diameter (mm)'), dia)),
    s.shape === 'football' ? section('Football',
      slider('footballTip', 'Tip shape (oval → pointed)', 0, 1, 0.01, { fmt: pct, group: 'shape' }),
      note('Lies on its side with the laces on top. Your photo goes on the side facing you.'),
    ) : null,
    wall,
    section('Opening and collar',
      slider('opening.diameter', 'Opening diameter', 20, Math.max(20, Math.min(90, maxOpening(s))), 0.5, { fmt: mm, group: 'shape' }),
      slider('opening.collarHeight', 'Collar height', 2, 15, 0.5, { fmt: mm, group: 'shape' }),
      slider('opening.collarWall', 'Collar wall', 1.2, 4, 0.1, { fmt: mm, group: 'shape' }),
      note('The collar drops into the base. The light shines up through the opening.')),
  ];
}

function markingsTab() {
  const s = app.settings, m = s.markings;
  const kind = SHAPES[s.shape]?.markings;
  if (!kind || kind === 'none') {
    const what = isPanel() ? 'Markings are for the ball shapes; a flat panel has none. Add words on the Text tab.'
      : isCube() ? 'The cube has no markings.' : 'The plain sphere has no markings.';
    return [section('Markings', note(what))];
  }
  if (kind === 'moon') return [section('Markings', note('The Moon has no lines. Its craters and maria come from NASA maps (Shape tab).'))];
  const autoW = markingWidth({ ...s, markings: { ...m, width: null } });
  return [
    section('Style',
      segmented('markings.style', [
        { value: 'carved', label: 'Carved (dark)', title: 'Thicker plastic: lines glow dark, outside stays smooth' },
        { value: 'raised', label: 'Raised', title: 'Lines stick out from the surface' },
        { value: 'off', label: 'Off' },
      ], 'field', () => renderTab())),
    m.style === 'off' ? null : section('Lines',
      el('div', { class: 'ctl' },
        el('label', {}, 'Line width'),
        el('span', { class: 'val' }, m.width ? mm(m.width) : `Auto (${autoW} mm)`),
        el('input', {
          type: 'range', min: 0.8, max: 10, step: 0.1, value: m.width || autoW,
          oninput: (e) => { m.width = parseFloat(e.target.value); e.target.previousSibling.textContent = mm(m.width); changed('field'); },
        })),
      m.width ? el('button', { class: 'btn small', onclick: () => { m.width = null; changed('field'); renderTab(); } }, 'Use automatic width') : null,
      m.style === 'carved' ? slider('markings.darkness', 'Darkness', 0, 1, 0.01, { fmt: pct }) : null,
      m.style === 'raised' ? slider('markings.raise', 'Raised height', 0.3, 3, 0.05, { fmt: mm }) : null,
      slider('markings.fade', 'Hide lines under photos', 0, 1, 0.01, { fmt: pct }),
      note('At 100% the lines stop at your photos (they fade back in at a photo\'s soft edge). Lower it to let them show through.'),
      kind === 'soccer' ? slider('markings.panelDark', 'Pentagon darkness', 0, 1, 0.01, { fmt: pct }) : null,
      kind === 'football' ? checkbox('footballStripes', 'End stripes (glow bright, like a college ball)') : null,
    ),
    m.style === 'off' || kind === 'football' ? null : section('Turn the markings',
      slider('markings.yaw', 'Spin', -180, 180, 1, { fmt: deg }),
      slider('markings.pitch', 'Tilt forward / back', -90, 90, 1, { fmt: deg }),
      slider('markings.roll', 'Tilt sideways', -90, 90, 1, { fmt: deg }),
      el('button', {
        class: 'btn small',
        onclick: () => { const d = defaultSettings().markings; Object.assign(m, { yaw: d.yaw, pitch: d.pitch, roll: d.roll }); changed('field'); renderTab(); },
      }, 'Reset turn')),
  ];
}

function textTab() {
  const s = app.settings;
  if (!Array.isArray(s.texts)) s.texts = [];
  const items = s.texts;
  if (app.selectedText && !items.some((t) => t.id === app.selectedText)) app.selectedText = null;
  if (!app.selectedText && items.length) app.selectedText = items[items.length - 1].id;
  const idx = items.findIndex((t) => t.id === app.selectedText);
  const it = items[idx];

  const add = () => {
    const n = defaultTextItem(items.length);
    items.push(n); app.selectedText = n.id; changed('field'); renderTab();
  };
  const list = items.map((t, i) => el('div', { class: 'text-row' + (t.id === app.selectedText ? ' active' : '') },
    el('button', {
      class: 'text-pick', title: 'Edit this text',
      style: `font-family:${TEXT_FONTS[t.font]?.family || 'inherit'};font-weight:${TEXT_FONTS[t.font]?.weight || 400}`,
      onclick: () => { app.selectedText = t.id; renderTab(); },
    }, t.text && t.text.trim() ? t.text : '(empty)'),
    el('button', {
      class: 'btn small', title: t.hidden ? 'Show on the ball' : 'Hide from the ball',
      onclick: () => { t.hidden = !t.hidden; changed('field'); renderTab(); },
    }, t.hidden ? 'Show' : 'Hide'),
    el('button', {
      class: 'btn small', title: 'Make a copy just below',
      onclick: () => {
        const c = { ...structuredClone(t), id: defaultTextItem().id, up: t.up - t.size * 1.6 };
        items.splice(i + 1, 0, c); app.selectedText = c.id; changed('field'); renderTab();
      },
    }, 'Copy'),
    el('button', {
      class: 'btn small', title: 'Remove this text',
      onclick: () => { items.splice(i, 1); changed('field'); renderTab(); },
    }, 'Remove'),
  ));

  const out = [
    section(`Text on the ${where()}`,
      items.length ? el('div', { class: 'text-list' }, list) : note('No text yet. Add a name, number or date.'),
      el('button', { class: 'btn small', style: 'margin-top:8px', onclick: add }, '+ Add text')),
  ];
  if (!it) return out;

  const p = `texts.${idx}`;
  const font = TEXT_FONTS[it.font] || TEXT_FONTS.varsity;
  const input = el('input', { type: 'text', value: it.text, maxlength: 40, class: 'text-input', 'aria-label': 'Text' });
  input.addEventListener('input', () => { it.text = input.value; changed('field'); });
  input.addEventListener('change', () => renderTab());

  const upMax = app.shape?.elev ? Math.floor(app.shape.elev(0.97)) : 60;
  const upMin = app.shape?.elev ? Math.ceil(app.shape.elev(0.03)) : -60;
  out.push(
    section('Edit text',
      input,
      el('div', { class: 'ctl' }, el('label', {}, 'Font')),
      segmented(`${p}.font`, Object.entries(TEXT_FONTS).map(([k, f]) => ({ value: k, label: f.label })), 'field', () => renderTab()),
      el('div', { class: 'ctl' }, el('label', {}, 'Style')),
      segmented(`${p}.style`, [
        { value: 'carved', label: 'Carved (dark)', title: 'Thicker plastic: glows dark, outside stays smooth' },
        { value: 'bright', label: 'Bright', title: 'Thinner plastic: glows lighter than around it' },
        // A panel's front stays smooth, so raised text isn't offered there (it prints as carved)
        isPanel() ? null : { value: 'raised', label: 'Raised', title: 'Sticks out from the outside of the ball' },
      ].filter(Boolean), 'field', () => renderTab()),
      isPanel() && it.style === 'raised' ? note('A panel\'s front stays smooth, so raised text prints as carved.', 'warn') : null,
      !isPanel() && it.style === 'raised' ? slider(`${p}.raise`, 'Raised height', 0.3, 3, 0.05, { fmt: mm }) : null,
      slider(`${p}.size`, 'Letter height', 4, 60, 0.5, { fmt: mm }),
      it.size < font.minSize ? note(`Letters under ${font.minSize} mm may not print cleanly in this font.`, 'warn') : null,
      slider(`${p}.arc`, 'Bend (smile to arch)', -180, 180, 1, { fmt: deg }),
      checkbox(`${p}.outline`, 'Bright outline around letters (helps over dark photo areas)'),
    ),
    isPanel() ? section('Place on the panel',
      note('Click the panel in the preview to move this text there, then fine-tune:'),
      slider(`${p}.panelX`, 'Left / right', Math.round(-(app.shape?.W ?? 150) / 2), Math.round((app.shape?.W ?? 150) / 2), 0.5, { fmt: mm }),
      slider(`${p}.panelY`, 'Up / down', Math.round(-(app.shape?.H ?? 150) / 2), Math.round((app.shape?.H ?? 150) / 2), 0.5, { fmt: mm }),
      slider(`${p}.rotate`, 'Rotate', -180, 180, 1, { fmt: deg }),
    ) : section('Place on the ball',
      note('Click the ball in the preview to move this text there, then fine-tune:'),
      slider(`${p}.around`, 'Around the ball', -180, 180, 0.5, { fmt: deg }),
      slider(`${p}.up`, 'Up / down', upMin, upMax, 0.5, { fmt: mm }),
      slider(`${p}.rotate`, 'Rotate', -180, 180, 1, { fmt: deg }),
    ),
  );
  return out;
}

/** Link to the printer setting tips page (opens in a new tab, so your work stays put). */
const tipsLink = () => el('p', { class: 'note' }, el('a', { href: 'tips.html', target: '_blank', rel: 'noopener', class: 'tips-link' }, 'Printer setting tips: what generally works well →'));

function numberInput(path, label, lo, hi) {
  const s = app.settings;
  const i = el('input', { type: 'number', min: lo, max: hi, step: 0.5, value: getPath(s, path), style: 'width:76px', 'aria-label': label });
  i.addEventListener('change', () => {
    const v = Math.min(hi, Math.max(lo, parseFloat(i.value) || getPath(s, path)));
    i.value = v; setPath(s, path, v); changed(groupFor(path)); renderTab();
  });
  return el('div', { class: 'row', style: 'margin-top:8px' }, el('span', { class: 'grow' }, label), i);
}

/** Base tab, flat panel: light box, slot stand or none. */
function panelBaseTab() {
  const s = app.settings, b = s.base, info = app.baseInfo;
  const kind = b.panelKind || 'lightbox';
  const progress = el('div', { class: 'progress', hidden: !app.exporting }, el('div', { id: 'exportBar' }));
  const st = app.lastBaseExport;
  const slotT = panelEdgeThickness(s);
  return [
    section('Base for the panel',
      segmented('base.panelKind', Object.entries(PANEL_BASE_KINDS).map(([k, label]) => ({
        value: k, label,
        title: { lightbox: 'A base with an LED strip inside that lights the panel from behind', stand: 'A small stand with a slot, no light', none: 'Just the panel (feet, a window or a frame)' }[k],
      })), undefined, () => renderTab()),
      kind === 'lightbox' ? [
        slider('base.stripW', 'LED strip width', 5, 20, 0.5, { fmt: mm }),
        note('Stick the LED strip on the leaning floor of the trough behind the slot; it shines up the back of the panel. A 10 mm USB strip works well. Its cable leaves through the notch at the back.'),
        checkbox('evenGlow.on', 'Even glow (thinner plastic farther from the light)', 'field', () => renderTab()),
        s.evenGlow.on ? slider('evenGlow.strength', 'Even glow strength', 0, 1, 0.01, { fmt: pct }) : null,
      ] : null,
      kind === 'none' ? note('No base: stand the panel on its feet (Shape tab), hang it in a window or put it in a frame.') : null,
      kind !== 'none' && s.panel.feet ? note('Turn the panel\'s feet off (Shape tab): they won\'t fit the slot.', 'warn') : null,
    ),
    kind === 'none' ? null : section('Fit and size',
      slider('base.clearance', 'Slot fit (extra room)', 0.1, 1.2, 0.05, { fmt: mm }),
      note(`The slot is ${(slotT + b.clearance).toFixed(1)} mm wide for a ${slotT.toFixed(1)} mm panel edge. Too tight? Add room. Too loose? Take some away.`),
      slider('base.extra', 'Extra width', 0, 40, 1, { fmt: mm }),
      kind === 'lightbox' ? slider('base.cableW', 'Cable notch width', 4, 30, 0.5, { fmt: mm }) : null,
    ),
    kind === 'none' ? null : section('Export base',
      info ? note(`Base: ${info.width.toFixed(0)} × ${info.depth.toFixed(0)} mm, ${info.height.toFixed(0)} mm tall. The panel sits ${info.slotDepth} mm deep in the slot.`) : null,
      info ? (() => { const f = fitCheck([info.width, info.depth, info.height]); return el('div', { class: 'fit ' + f.cls }, f.text); })() : null,
      info ? note('Prints standing up, as it sits on the table. No supports needed. Print it in dark, opaque filament.') : null,
      tipsLink(),
      el('button', { class: 'btn primary block', id: 'btnExportBase', disabled: app.exporting || !app.shape, onclick: exportBaseStl },
        app.exporting ? 'Building…' : 'Export base STL'),
      progress,
      st ? el('div', { class: 'stats' },
        'File', el('b', {}, `${st.fileName} (${(st.bytes / 1e6).toFixed(1)} MB)`),
        'Size', el('b', {}, `${st.size.map((v) => v.toFixed(1)).join(' × ')} mm`),
        'Plastic', el('b', {}, `≈ ${Math.round(st.volumeCm3 * 1.24)} g PLA (${st.volumeCm3.toFixed(0)} cm³)`),
      ) : null,
    ),
  ];
}

function baseTab() {
  if (isPanel()) return panelBaseTab();
  const s = app.settings, b = s.base, info = app.baseInfo;
  const col = collarDims(s);
  const kind = b.light;
  const lightSection = section('Light',
    segmented('base.light', [
      { value: 'puck', label: 'LED puck', title: 'The puck sits inside the base and shines up through the opening' },
      { value: 'strip', label: 'LED strip on a riser', title: 'A hollow post rises into the lamp; wrap an LED strip around it' },
      { value: 'bulb', label: 'Bulb socket', title: 'Holds an E12 or E26 lamp socket on a threaded nipple' },
    ], undefined, () => renderTab()),
    kind === 'puck' ? [
      numberInput('base.puckD', 'Puck diameter (mm)', 30, 160),
      numberInput('base.puckH', 'Puck height (mm)', 5, 60),
      note('Measure your puck with calipers. The base leaves a little room around it.'),
    ] : null,
    kind === 'strip' ? [
      slider('base.riserD', 'Riser diameter', 16, Math.floor(col.ri * 2 - 3), 0.5, { fmt: mm }),
      slider('base.riserH', 'Riser height', 0, 200, 1, { fmt: (v) => (+v > 0 ? mm(v) : 'Auto (middle of the lamp)') }),
      note('Wrap the LED strip around the riser. Its wire goes in through the hole near the top and down to the notch.'),
    ] : null,
    kind === 'bulb' ? [
      segmented('base.socket', Object.entries(SOCKETS).map(([k, v]) => ({ value: k, label: v.label })), undefined, () => renderTab()),
      note(`The socket screws onto a 1/8" threaded lamp nipple through the top. The bulb must fit through the ${(col.ri * 2).toFixed(0)} mm opening.`),
      info && info.socketFits === false ? note('This socket is wider than the opening. Use a smaller socket or a bigger opening (Shape tab).', 'warn') : null,
    ] : null,
  );
  const shapeOpts = segmented('base.shape', [
    { value: 'auto', label: 'Match the lamp', title: 'Round under balls, square under the cube' },
    { value: 'round', label: 'Round' },
    { value: 'square', label: 'Square' },
  ], undefined, () => renderTab());
  const progress = el('div', { class: 'progress', hidden: !app.exporting }, el('div', { id: 'exportBar' }));
  const st = app.lastBaseExport;
  return [
    lightSection,
    section('Fit and size',
      slider('base.clearance', 'Collar fit (extra room)', 0.1, 1.2, 0.05, { fmt: mm }),
      note('Too tight? Add room. Too loose? Take some away.'),
      el('div', { class: 'ctl' }, el('label', {}, 'Base shape')), shapeOpts,
      slider('base.extra', 'Extra width', 0, 40, 1, { fmt: mm }),
      slider('base.cableW', 'Cable notch width', 4, 30, 0.5, { fmt: mm }),
      slider('base.cableH', 'Cable notch height', 3, 20, 0.5, { fmt: mm }),
    ),
    section('Export base',
      info ? note(`Base: ${info.width.toFixed(0)} mm ${info.square ? 'square' : 'across'}, ${info.height.toFixed(0)} mm tall`
        + (info.riserHeight ? `, riser ${info.riserHeight.toFixed(0)} mm above it.` : '.')) : null,
      info && info.riserLimited ? note(`The riser was kept ${info.riserHeight.toFixed(0)} mm tall so it stays inside the lamp.`, 'warn') : null,
      info ? (() => { const f = fitCheck([info.width, info.width, info.totalHeight]); return el('div', { class: 'fit ' + f.cls }, f.text); })() : null,
      info ? note(info.flip
        ? 'Prints upside down (top on the bed): the STL is already turned. No supports needed.'
        : 'Prints standing up, as it sits on the table. No supports needed.') : null,
      info ? note('The base is not a lithophane: normal slicer settings are fine. Print it in dark, opaque filament.') : null,
      tipsLink(),
      el('button', { class: 'btn primary block', id: 'btnExportBase', disabled: app.exporting || !app.shape, onclick: exportBaseStl },
        app.exporting ? 'Building…' : 'Export base STL'),
      progress,
      st ? el('div', { class: 'stats' },
        'File', el('b', {}, `${st.fileName} (${(st.bytes / 1e6).toFixed(1)} MB)`),
        'Size', el('b', {}, `${st.size.map((v) => v.toFixed(1)).join(' × ')} mm`),
        'Plastic', el('b', {}, `≈ ${Math.round(st.volumeCm3 * 1.24)} g PLA (${st.volumeCm3.toFixed(0)} cm³)`),
      ) : null,
    ),
  ];
}

/**
 * A warning when the chosen detail makes a very big file. Phones and tablets (touch screens)
 * have far less memory than a computer, so they are warned sooner.
 */
function bigFileNote(bytes) {
  const touch = matchMedia('(pointer: coarse)').matches;
  const mb = Math.round(bytes / 1e6);
  if (touch && bytes > 150e6) return note(`This file will be about ${mb} MB: that may be too big for a phone or tablet, and the export could fail. Try Standard or Draft.`, 'warn');
  if (bytes > 400e6) return note(`This file will be about ${mb} MB: slow to build and slow to open in a slicer. Standard is usually enough.`, 'warn');
  return null;
}

function fitCheck(size, diag) {
  const b = app.settings.bed;
  const [x, y, z] = size;
  if (z > b.z) return { cls: 'err', text: `Too tall for your printer (${z.toFixed(0)} mm, bed height ${b.z} mm).` };
  if ((x <= b.x && y <= b.y) || (x <= b.y && y <= b.x)) return { cls: 'ok', text: `Fits your bed (${x.toFixed(0)} × ${y.toFixed(0)} × ${z.toFixed(0)} mm).` };
  if (diag && diag[0] <= b.x && diag[1] <= b.y) return { cls: 'warn', text: `Fits only placed diagonally: rotate it 45° in your slicer (${x.toFixed(0)} × ${y.toFixed(0)} mm).` };
  return { cls: 'err', text: `Too big for your bed (${x.toFixed(0)} × ${y.toFixed(0)} mm on ${b.x} × ${b.y} mm).` };
}

function exportTab() {
  const s = app.settings;
  const bedInput = (k) => {
    const i = el('input', { type: 'number', min: 50, max: 1000, step: 1, value: s.bed[k], 'aria-label': `Bed ${k}` });
    i.addEventListener('change', () => { s.bed[k] = Math.max(50, parseFloat(i.value) || 256); scheduleAutosave(); renderTab(); });
    return el('label', { class: 'row', style: 'gap:6px' }, k.toUpperCase(), i);
  };

  const ax = bodyAxes(s);
  let estSize = [ax.a * 2, ax.b * 2, ax.c * 2];
  if (isCube() && app.shape && app.shape.funnelBottom != null) estSize[2] = ax.c - app.shape.funnelBottom + s.opening.collarHeight;
  let estDiag = [2 * Math.sqrt((ax.a ** 2 + ax.b ** 2) / 2), 2 * Math.sqrt((ax.a ** 2 + ax.b ** 2) / 2)];
  const panel = isPanel() && app.shape && app.shape.kind === 'panel' ? app.shape : null;
  if (panel) { // standing up: width × depth on the bed, height up
    const T = panelEdgeThickness(s);
    const depth = panel.sag + T + (s.panel.feet ? 2 * Math.max(15, Math.min(35, panel.H * 0.12)) : 0);
    // a curved panel's back sticks out a little past the front at the ends
    const width = panel.flat ? panel.W : 2 * (panel.R + T) * Math.sin(panel.W / 2 / panel.R);
    estSize = [width, depth, panel.H];
    estDiag = [(estSize[0] + depth) * Math.SQRT1_2, (estSize[0] + depth) * Math.SQRT1_2];
  }
  const fit = app.lastExport ? fitCheck(app.lastExport.size, app.lastExport.diagonal) : fitCheck(estSize, estDiag);

  const raised = app.field ? app.field.hasRaised : s.markings.style === 'raised' && SHAPES[s.shape]?.markings !== 'none';
  const estBytes = (d) => stlBytes(estimateTriangles(app.shape, d.step, raised ? d.step : OUTER_STEP));
  const opts = Object.entries(DETAIL_PRESETS).map(([k, d]) => {
    const sizeText = app.shape ? `≈ ${(estBytes(d) / 1e6).toFixed(0)} MB` : '';
    const radio = el('input', { type: 'radio', name: 'detail', value: k });
    radio.checked = s.detail === k;
    radio.addEventListener('change', () => { s.detail = k; scheduleAutosave(); renderTab(); });
    const desc = { draft: 'Quick test prints', standard: 'Best for most prints', fine: 'Close-up portraits; big file' }[k];
    return el('label', { class: 'detail-opt' + (s.detail === k ? ' active' : '') },
      radio, el('span', {}, `${d.label} (${d.step} mm)`, el('small', {}, desc)), el('span', { class: 'size' }, sizeText));
  });

  const progress = el('div', { class: 'progress', hidden: !app.exporting }, el('div', { id: 'exportBar' }));
  const btn = el('button', { class: 'btn primary block', id: 'btnExport', disabled: app.exporting || !app.shape, onclick: exportStl },
    app.exporting ? 'Building STL…' : `Export ${where()} STL`);

  const st = app.lastExport;
  const stats = st ? el('div', { class: 'stats' },
    'File', el('b', {}, `${st.fileName} (${(st.bytes / 1e6).toFixed(1)} MB)`),
    'Triangles', el('b', {}, st.triangles.toLocaleString()),
    'Size', el('b', {}, `${st.size.map((v) => v.toFixed(1)).join(' × ')} mm`),
    'Plastic', el('b', {}, `≈ ${Math.round(st.volumeCm3 * 1.24)} g PLA (${st.volumeCm3.toFixed(0)} cm³)`),
  ) : null;

  return [
    section('Printer bed (mm)', el('div', { class: 'row' }, bedInput('x'), bedInput('y'), bedInput('z')),
      el('div', { class: 'fit ' + fit.cls }, fit.text)),
    section('Detail', ...opts, bigFileNote(app.shape && DETAIL_PRESETS[s.detail] ? estBytes(DETAIL_PRESETS[s.detail]) : 0)),
    section('Export', btn, progress, stats,
      panel
        ? note('Prints standing up on its bottom edge, as exported. No supports needed; a brim helps tall or thin panels stay put.')
        : isCube()
        ? note('The cube STL is already turned upside down: top face on the bed. No supports needed.')
        : note('Print opening-down on the bed. Turn on supports in your slicer for the curve just above the collar.'),
      !hasPhotos() ? note(panel ? 'No photo yet: this exports a plain panel.' : 'No photo yet: this exports a plain ball with markings.', 'warn') : null,
      panel && s.base.panelKind === 'none' ? null : note('The base is a separate file: Base tab, Export base STL.'),
      tipsLink()),
  ];
}

// ---------- Export ----------
/** Browsers before 2023 (e.g. Firefox before 114) can't run the export code (a module worker). */
const moduleWorkers = (() => {
  let ok = false;
  try {
    const w = new Worker(URL.createObjectURL(new Blob([''], { type: 'text/javascript' })), { get type() { ok = true; return 'module'; } });
    w.terminate();
  } catch { /* not supported */ }
  return ok;
})();

/**
 * A plain-language reason the export worker failed. The export code is loaded when the export
 * starts: on the local copy that fails if start.bat was closed, online if the internet dropped.
 */
async function workerErrorText(workerUrl, e, what, detailHint = false) {
  const reachable = await fetch(workerUrl, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok, () => false);
  if (!reachable) {
    return isLocal
      ? 'Export could not start: the app\'s local server is not running. Run start.bat again, then export.'
      : 'Export could not start: the app could not reach its website. Check the internet connection and try again.';
  }
  return `${what}${e && e.message ? ': ' + e.message : ''}.${detailHint ? ' Try a lower detail level.' : ''}`;
}

function cannotExport() {
  if (!moduleWorkers) {
    toast('This browser is too old to export. Update it, or use an up-to-date Chrome, Edge, Firefox or Safari.', 'err');
    return true;
  }
  return false;
}

function exportBaseStl() {
  if (app.exporting || !app.shape || cannotExport()) return;
  const s = app.settings;
  app.exporting = true; renderTab();
  const workerUrl = new URL('./exportWorker.js', import.meta.url);
  const worker = new Worker(workerUrl, { type: 'module' });
  const done = () => { app.exporting = false; worker.terminate(); renderTab(); };
  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'progress') {
      const bar = document.getElementById('exportBar');
      if (bar) bar.style.width = `${Math.round(msg.value * 100)}%`;
    } else if (msg.type === 'done') {
      const fileName = `${projectBaseName()}-base-${isPanel() ? s.base.panelKind : s.base.light}.stl`;
      download(new Blob(msg.stl, { type: 'model/stl' }), fileName);
      app.lastBaseExport = { ...msg.stats, fileName };
      toast(`Saved ${fileName}`);
      done();
    } else if (msg.type === 'error') {
      toast(`Base export failed: ${msg.message}`, 'err');
      done();
    }
  };
  worker.onerror = async (e) => {
    toast(await workerErrorText(workerUrl, e, 'Base export failed'), 'err');
    done();
  };
  worker.postMessage({ kind: 'base', settings: structuredClone(s) });
}

function exportStl() {
  if (app.exporting || !app.shape || cannotExport()) return;
  const s = app.settings;
  // Without its maps a Moon would export as a smooth ball
  if (isMoonShape() && !app.moonMap) {
    toast(app.moonFailed ? 'The Moon maps could not be loaded, so the Moon can\'t be exported yet. Try again from the Shape tab.'
      : 'The Moon maps are still loading. Export again in a moment.', 'err');
    return;
  }
  const step = DETAIL_PRESETS[s.detail]?.step || 0.3;
  app.exporting = true; renderTab();
  const workerUrl = new URL('./exportWorker.js', import.meta.url);
  const worker = new Worker(workerUrl, { type: 'module' });
  const done = () => { app.exporting = false; worker.terminate(); renderTab(); };
  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'progress') {
      const bar = document.getElementById('exportBar');
      if (bar) bar.style.width = `${Math.round(msg.value * 100)}%`;
    } else if (msg.type === 'done') {
      const fileName = `${projectBaseName()}-${s.detail}.stl`;
      download(new Blob(msg.stl, { type: 'model/stl' }), fileName);
      app.lastExport = { ...msg.stats, fileName };
      toast(`Saved ${fileName}`);
      done();
    } else if (msg.type === 'error') {
      toast(`Export failed: ${msg.message}`, 'err');
      done();
    }
  };
  worker.onerror = async (e) => {
    toast(await workerErrorText(workerUrl, e, 'Export failed', true), 'err');
    done();
  };
  // Copies of each visible photo's adjusted picture (the copies move to the worker), always at full size
  const photos = {}, transfer = [];
  for (const cfg of s.photos) {
    const im = app.images[cfg.id];
    if (im && (!im.processed || im.dirty || im.needFull)) {
      im.processed = processPhoto(im.base, cfg); im.dirty = false; im.needFull = false;
    }
    const pr = !cfg.hidden && app.images[cfg.id] && app.images[cfg.id].processed;
    if (!pr) continue;
    const data = pr.data.slice(), alpha = pr.alpha ? pr.alpha.slice() : null;
    photos[cfg.id] = { w: pr.w, h: pr.h, data, alpha };
    transfer.push(data.buffer); if (alpha) transfer.push(alpha.buffer);
  }
  const moon = isMoonShape() ? app.moonMap : null;
  worker.postMessage({ settings: structuredClone(s), photos, textMasks: app.textMasks, moon, stepInner: step, stepOuter: OUTER_STEP }, transfer);
}

// ---------- Wiring ----------
function setTab(tab) {
  app.tab = tab;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  renderTab();
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
document.querySelectorAll('.view-toggle .seg').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.view-toggle .seg').forEach((x) => x.classList.toggle('active', x === b));
  preview.setMode(b.dataset.view);
  $('thickLegend').hidden = b.dataset.view !== 'thickness';
  updateThicknessLegend();
}));

// ---------- Thickness view: legend and pointer readout ----------
function updateThicknessLegend() {
  const s = app.settings;
  $('thickMin').textContent = `${s.tMin.toFixed(2)} mm`;
  $('thickMax').textContent = `${s.tMax.toFixed(2)} mm`;
}
const hoverEv = {};
preview.onHover = (h) => {
  const box = $('thickReadout');
  if (!h || !app.field) { box.hidden = true; return; }
  app.field.eval(h.u * 2 * Math.PI, Math.min(1, Math.max(0, h.v)), hoverEv);
  box.textContent = hoverEv.raise > 0.01
    ? `${hoverEv.t.toFixed(2)} mm + ${hoverEv.raise.toFixed(2)} raised`
    : `${hoverEv.t.toFixed(2)} mm`;
  box.style.left = `${h.x}px`; box.style.top = `${h.y}px`;
  box.hidden = false;
};
$('btnResetView').addEventListener('click', () => preview.frame());

// Drag the selected photo on the ball (Photo tab). Pressing on it grabs it; pressing anywhere else
// (including other photos, which may cover most of the ball) turns the view as usual.
let grab = null;
const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
preview.onDragStart = (h) => {
  if (app.tab !== 'photo' || !app.field || !app.shape) return false;
  const ev = {};
  app.field.eval(h.u * 2 * Math.PI, Math.min(1, Math.max(0, h.v)), ev);
  if (!ev.photoId || ev.photoId !== app.selectedPhoto) return false;
  const cfg = app.settings.photos.find((p) => p.id === ev.photoId);
  if (!cfg) return false;
  if (app.shape.kind === 'panel') {
    // A window moves on the panel; a photo filling the panel slides inside it instead
    const im = app.images[cfg.id];
    const imgAspect = im ? im.base.h / im.base.w : 1;
    const cover = Math.max(1, (app.shape.H / app.shape.W) / imgAspect);
    grab = { cfg, panel: true, u0: ev.u, v0: ev.v, x0: cfg.panelX, y0: cfg.panelY, px0: cfg.panX, py0: cfg.panY, k: app.shape.W * Math.max(0.05, cfg.zoom) * cover, imgAspect };
    return true;
  }
  const at = placementAt(app.shape, h.u * 2 * Math.PI, Math.min(1, Math.max(0, h.v)));
  grab = { cfg, dA: wrap180(cfg.around - at.around), dY: cfg.centerY - at.up };
  return true;
};
preview.onDragMove = (h) => {
  if (!grab || !h) return;
  if (grab.panel) {
    const ev = {};
    app.field.eval(h.u * 2 * Math.PI, Math.min(1, Math.max(0, h.v)), ev);
    const du = ev.u - grab.u0, dv = ev.v - grab.v0, c = grab.cfg;
    if (c.panelW > 0) {
      const W = app.shape.W / 2, H = app.shape.H / 2;
      c.panelX = +Math.max(-W, Math.min(W, grab.x0 + du)).toFixed(1);
      c.panelY = +Math.max(-H, Math.min(H, grab.y0 + dv)).toFixed(1);
    } else {
      c.panX = +Math.max(-0.5, Math.min(0.5, grab.px0 - du / grab.k)).toFixed(3);
      c.panY = +Math.max(-0.5, Math.min(0.5, grab.py0 + dv / (grab.k * grab.imgAspect))).toFixed(3);
    }
    changed('field');
    return;
  }
  const at = placementAt(app.shape, h.u * 2 * Math.PI, Math.min(1, Math.max(0, h.v)));
  grab.cfg.around = +wrap180(at.around + grab.dA).toFixed(1);
  grab.cfg.centerY = +Math.min(app.shape.elev(1), Math.max(app.shape.elev(0.03), at.up + grab.dY)).toFixed(1);
  changed('field');
};
preview.onDragEnd = () => { if (grab) { grab = null; renderTab(); } };

// Click the ball on the Text tab: move the selected text there
preview.onPick = (h) => {
  if (app.tab !== 'text' || !app.shape) return;
  const it = (app.settings.texts || []).find((t) => t.id === app.selectedText);
  if (!it) return;
  if (app.shape.kind === 'panel') {
    const ev = {};
    app.field.eval(h.u * 2 * Math.PI, Math.min(1, Math.max(0, h.v)), ev);
    Object.assign(it, { panelX: +ev.u.toFixed(1), panelY: +ev.v.toFixed(1) });
  } else Object.assign(it, placementAt(app.shape, h.u * 2 * Math.PI, Math.min(1, Math.max(0, h.v))));
  changed('field'); renderTab();
};
loadAllFonts();

const choosePhoto = () => $('filePhoto').click();
$('btnChoosePhoto').addEventListener('click', choosePhoto);
$('btnChoosePhoto2').addEventListener('click', choosePhoto);
$('filePhoto').addEventListener('change', (e) => {
  const f = e.target.files[0]; e.target.value = '';
  const target = app.replaceTarget; app.replaceTarget = null;
  if (f) loadPhoto(f, f.name, { id: target && app.settings.photos.some((p) => p.id === target) ? target : null });
});

$('btnSaveProject').addEventListener('click', async () => {
  try {
    await saveProjectFile({ settings: app.settings, photos: photoFiles() }, `${projectBaseName()}.lithoproj`);
    toast('Project saved to your downloads.');
  } catch (err) {
    console.error(err);
    toast(`The project could not be saved: ${err.message || err}`, 'err');
  }
});
$('btnOpenProject').addEventListener('click', () => $('fileProject').click());
$('fileProject').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const proj = await readProjectFile(f);
    await applyProject(proj);
    toast(`Opened ${f.name}`);
  } catch (err) { toast(err.message, 'err'); }
});
/** True when the project has work worth asking about before it's cleared. */
function hasWork() {
  const s = app.settings, d = defaultSettings();
  if (hasPhotos() || (s.texts || []).length) return true;
  // Anything changed apart from the things New keeps
  return ['shape', 'markings', 'moon', 'footballTip', 'footballStripes', 'evenGlow', 'photo']
    .some((k) => JSON.stringify(s[k]) !== JSON.stringify(d[k]));
}
$('btnNew').addEventListener('click', () => {
  if (hasWork() && !confirm('Start a new project? The current photos, text and settings will be cleared (save a project file first if you want to keep them).')) return;
  app.projectGen++;
  // A new project starts from your own defaults: printer bed, size, wall thickness, opening and base
  const old = app.settings;
  app.settings = defaultSettings();
  for (const k of ['bed', 'sizePreset', 'diameter', 'footballLength', 'footballWidth', 'tMin', 'tMax', 'opening', 'cube', 'panel', 'base', 'detail']) {
    if (old[k] !== undefined) app.settings[k] = structuredClone(old[k]);
  }
  app.images = {}; app.selectedPhoto = null; app.selectedText = null; app.textMasks = null;
  $('emptyState').classList.remove('hidden');
  changed('shape'); renderTab();
});

const PHOTO_KEYS = Object.keys(defaultPhotoSettings());
async function applyProject(proj) {
  app.projectGen++;
  const s = mergeSettings(proj.settings);
  const files = projectPhotos(proj);
  // Projects from before several photos: the one photo's settings lived in settings.photo
  if ((!Array.isArray(s.photos) || !s.photos.length) && files.length) {
    const old = s.photo || {};
    const cfg = { ...defaultPhotoSettings(), id: files[0].id, around: 0 };
    for (const k of PHOTO_KEYS) if (k in old && k !== 'id') cfg[k] = old[k];
    s.photos = [cfg];
  }
  s.photo = { surround: s.photo?.surround ?? 0.55 };
  // Keep only well-formed entries (a damaged or hand-edited file shouldn't break the app)
  const isItem = (x) => x && typeof x === 'object' && typeof x.id === 'string';
  s.photos = (Array.isArray(s.photos) ? s.photos : []).filter(isItem).slice(0, MAX_PHOTOS)
    .map((p) => ({ ...defaultPhotoSettings(), ...p }));
  s.texts = (Array.isArray(s.texts) ? s.texts : []).filter(isItem).map((t) => ({ ...defaultTextItem(), ...t }));
  app.settings = s;
  app.images = {}; app.selectedPhoto = null; app.selectedText = null; app.textMasks = null;
  changed('shape');
  for (const f of files) if (s.photos.some((p) => p.id === f.id)) await loadPhoto(f.blob, f.name, { fresh: false, id: f.id });
  s.photos = s.photos.filter((p) => app.images[p.id]); // drop any photo whose picture is missing
  app.selectedPhoto = s.photos[0] ? s.photos[0].id : null;
  if (!hasPhotos()) $('emptyState').classList.remove('hidden');
  renderTab();
}

// Drag and drop a photo or project anywhere
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('dropHint').hidden = false; });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('dropHint').hidden = true; } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault(); dragDepth = 0; $('dropHint').hidden = true;
  const f = e.dataTransfer.files[0];
  if (!f) return;
  if (/\.(lithoproj|json)$/i.test(f.name)) {
    try { await applyProject(await readProjectFile(f)); toast(`Opened ${f.name}`); } catch (err) { toast(err.message, 'err'); }
  } else loadPhoto(f, f.name);
});

// ---------- Start ----------
(async function start() {
  renderTab();
  try {
    const saved = await loadAutosave();
    if (saved && saved.settings) {
      await applyProject(saved);
      return;
    }
  } catch (err) {
    console.error(err);
    app.settings = defaultSettings(); app.images = {};
    toast('Your last session could not be restored, so the app started fresh.', 'err');
  }
  changed('shape'); renderTab();
})();

// Debug handles for testing in the console
window.__litho = app;
window.__lithoLoadPhoto = loadPhoto;
window.__lithoPreview = preview;
