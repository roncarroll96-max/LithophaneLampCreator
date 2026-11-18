// Lithophane Lamp Creator: app wiring (state, panels, preview updates, export, saving).

import { Preview } from './preview.js';
import { decodeImage, extractLuma, autoAdjust, processPhoto, drawGray } from './image.js';
import { buildEllipsoidShape } from './core/shapes.js';
import { createField } from './core/field.js';
import { estimateTriangles, stlBytes } from './core/mesh.js';
import {
  defaultSettings, mergeSettings, SIZE_PRESETS, SHAPES, DETAIL_PRESETS,
  bodyAxes, collarDims, markingWidth,
} from './core/settings.js';
import { autosave, loadAutosave, saveProjectFile, readProjectFile, download } from './storage.js';

const OUTER_STEP = 1.0; // mm; the smooth outside needs far fewer points than the photo side

// ---------- App state (one object) ----------
const app = {
  settings: defaultSettings(),
  photoBlob: null,
  photoName: null,
  base: null,        // { w, h, lum } original luminance
  processed: null,   // { w, h, data } adjusted brightness map
  shape: null,
  collar: null,
  field: null,
  tab: 'photo',
  exporting: false,
  lastExport: null,
  showOriginal: false,
  dirty: { tone: false, shape: true, field: true },
};

const $ = (id) => document.getElementById(id);
const isPhone = () => matchMedia('(max-width: 820px)').matches && matchMedia('(pointer: coarse)').matches;
const preview = new Preview($('viewport'));

// ---------- Messages ----------
let toastTimer;
function toast(msg, kind = '') {
  const t = $('toast');
  t.textContent = msg; t.className = 'toast ' + kind; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'err' ? 7000 : 3500);
}

// ---------- Settings path helpers ----------
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, val) {
  const keys = path.split('.'); const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj); target[last] = val;
}

// ---------- Update scheduling ----------
let rafPending = false, idleTimer = null;
function changed(group) {
  if (group === 'tone') app.dirty.tone = true;
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
    if (app.dirty.tone && app.base) {
      app.processed = processPhoto(app.base, s.photo);
      app.dirty.tone = false;
      drawThumb();
    }
    let shapeChanged = false;
    if (app.dirty.shape) {
      const collar = collarDims(s);
      const shape = buildEllipsoidShape(bodyAxes(s), collar.ro);
      const firstShape = !app.shape;
      app.shape = shape; app.collar = collar;
      preview.updateStand(shape, collar, s);
      if (firstShape) preview.frame();
      app.dirty.shape = false; shapeChanged = true;
    }
    if (!app.shape) return;
    app.field = createField(s, app.shape, app.processed);
    const raised = s.markings.style === 'raised';
    if (shapeChanged || raised || !quick || app._wasRaised !== raised) preview.updateGeometry(app.field, !quick);
    app._wasRaised = raised;
    updateThicknessLegend();
    if (quick) preview.updateTexture(app.field, s, 560, 280); // fast while dragging; sharp pass follows
    else preview.updateTexture(app.field, s, 1600, 800);
    if (!quick) { app.dirty.field = false; if (app.tab === 'export') renderTab(); }
  } catch (err) {
    console.error(err);
    toast(err.message || String(err), 'err');
  }
}

// ---------- Photo loading ----------
async function normalizedJpeg(image, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(image, 0, 0, w, h);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.92));
}

async function loadPhoto(blob, name, { fresh = true } = {}) {
  $('busy').hidden = false; $('busy').textContent = 'Loading photo…';
  try {
    const image = await decodeImage(blob);
    const base = extractLuma(image);
    app.photoBlob = fresh ? await normalizedJpeg(image, base.w, base.h) : blob;
    app.photoName = name || 'photo';
    app.base = base;
    if (fresh) {
      const p = app.settings.photo;
      Object.assign(p, autoAdjust(base), { zoom: 1, panX: 0, panY: 0, rotate: 0, aspect: null, auto: true });
      if (Math.max(base.originalW, base.originalH) < 900) {
        toast('This photo is small (low resolution). It may look blurry on the ball.', 'err');
      }
    }
    image.close?.();
    $('emptyState').classList.add('hidden');
    changed('tone');
    if (app.tab === 'photo') renderTab();
  } catch (err) {
    toast(err.message || 'Could not open that photo.', 'err');
  } finally {
    $('busy').hidden = true;
  }
}

function drawThumb() {
  const c = document.getElementById('thumb');
  if (!c) return;
  const src = app.showOriginal ? app.base : app.processed;
  if (src) drawGray(c, src);
}

// ---------- Saving ----------
let saveTimer;
function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => autosave({
    settings: app.settings, photoBlob: app.photoBlob, photoName: app.photoName,
  }), 1200);
}

function projectBaseName() {
  const s = app.settings;
  const n = (app.photoName || 'lamp').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 40);
  return `${n}-${s.shape}-${s.diameter}mm`;
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

function slider(path, label, min, max, step, { fmt = (v) => v, group = 'field', disabled = false, map } = {}) {
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
    const d = getPath(defaultSettings(), path);
    if (typeof d !== 'number') return;
    setPath(s, path, d); input.value = d; val.textContent = fmt(d); changed(group);
  });
  return el('div', { class: 'ctl' + (disabled ? ' disabled' : '') }, el('label', {}, label), val, input);
}

function segmented(path, options, group = 'field', after) {
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

function checkbox(path, label, group = 'field', after) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!getPath(app.settings, path);
  input.addEventListener('change', () => { setPath(app.settings, path, input.checked); changed(group); after && after(input.checked); });
  return el('label', { class: 'check' }, input, label);
}

/** "Height matches the photo" on = aspect null (follow the photo); off = a fixed window height. */
function aspectToggle() {
  const p = app.settings.photo;
  const input = el('input', { type: 'checkbox' });
  input.checked = p.aspect == null;
  input.addEventListener('change', () => {
    p.aspect = input.checked ? null : +(app.base ? app.base.h / app.base.w : 0.75).toFixed(2);
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
  body.replaceChildren(...({ photo: photoTab, ball: ballTab, markings: markingsTab, export: exportTab }[app.tab])());
  body.scrollTop = scroll;
  if (app.tab === 'photo') drawThumb();
}

function photoTab() {
  const s = app.settings, p = s.photo;
  const thumb = app.base
    ? el('canvas', { id: 'thumb', title: 'Grey map: lighter = thinner plastic = brighter when lit' })
    : el('div', { class: 'thumb-empty' }, 'No photo yet. Choose one, or drop it on the preview.');
  const holdBtn = el('button', { class: 'btn small', disabled: !app.base, title: 'Hold to compare with the original' }, 'Hold: original');
  const setOrig = (on) => { app.showOriginal = on; drawThumb(); };
  holdBtn.addEventListener('pointerdown', () => setOrig(true));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => holdBtn.addEventListener(ev, () => setOrig(false)));
  const autoBtn = el('button', {
    class: 'btn small', disabled: !app.base,
    onclick: () => { Object.assign(p, autoAdjust(app.base)); changed('tone'); renderTab(); toast('Automatic adjustments applied.'); },
  }, 'Auto adjust');
  const centerMax = Math.round(Math.min(bodyAxes(s).c, 120) * 0.9);

  return [
    section('Photo',
      el('div', { class: 'thumb-wrap' }, thumb),
      el('div', { class: 'row', style: 'margin-top:8px' },
        el('button', { class: 'btn small', onclick: () => $('filePhoto').click() }, app.base ? 'Change photo' : 'Choose photo'),
        holdBtn, autoBtn),
      app.base ? note('Lighter areas print thinner and glow brighter.') : null,
    ),
    section('Tone',
      slider('photo.blackPoint', 'Black point', 0, 0.6, 0.005, { fmt: num2, group: 'tone' }),
      slider('photo.whitePoint', 'White point', 0.4, 1, 0.005, { fmt: num2, group: 'tone' }),
      slider('photo.brightness', 'Brightness', -0.4, 0.4, 0.01, { fmt: num2, group: 'tone' }),
      slider('photo.contrast', 'Contrast', 0.5, 2, 0.01, { fmt: num2, group: 'tone' }),
      slider('photo.gamma', 'Midtones (lift shadows →)', 0.5, 2.5, 0.01, { fmt: num2, group: 'tone' }),
      slider('photo.sharpen', 'Sharpen', 0, 2, 0.05, { fmt: num2, group: 'tone' }),
      checkbox('photo.invert', 'Invert (negative)', 'tone'),
    ),
    section('Position in window',
      slider('photo.zoom', 'Zoom', 0.5, 4, 0.01, { fmt: (v) => `${(+v).toFixed(2)}×` }),
      slider('photo.panX', 'Move left / right', -0.5, 0.5, 0.005, { fmt: num2 }),
      slider('photo.panY', 'Move up / down', -0.5, 0.5, 0.005, { fmt: num2 }),
      slider('photo.rotate', 'Rotate', -180, 180, 0.5, { fmt: deg }),
    ),
    section('Photo window on the ball',
      slider('photo.coverage', 'How far around', 40, 360, 1, { fmt: deg }),
      aspectToggle(),
      p.aspect == null
        ? null
        : slider('photo.aspect', 'Window height', 0.25, 1.6, 0.01, { fmt: (v) => `${Math.round(v * 100)}% of width` }),
      slider('photo.centerY', 'Raise / lower window', -centerMax, centerMax, 0.5, { fmt: mm }),
      slider('photo.feather', 'Soft edge', 0, 40, 0.5, { fmt: mm }),
      el('div', { class: 'ctl' }, el('label', {}, 'Window shape')),
      segmented('photo.windowShape', [{ value: 'rect', label: 'Rectangle' }, { value: 'oval', label: 'Oval' }]),
      el('div', { class: 'ctl' }, el('label', {}, 'Projection')),
      segmented('photo.projection', [
        { value: 'natural', label: 'Natural', title: 'No squeezing; best for a front window' },
        { value: 'wrap', label: 'Wrap', title: 'Fills all the way around; best near 360°' },
      ]),
      // Show the wall it makes, in mm, so it matches the Thickness view readout
      slider('photo.surround', 'Plain ball brightness', 0, 1, 0.01, {
        fmt: (v) => `${pct(v)} (${(s.tMin + (1 - v) * (s.tMax - s.tMin)).toFixed(2)} mm)`,
      }),
    ),
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
    ...Object.entries(SIZE_PRESETS).map(([k, v]) => ({ value: k, label: `${v.label} ${v.diameter}` })),
    { value: 'custom', label: 'Custom' },
  ], 'shape', (v) => {
    if (SIZE_PRESETS[v]) Object.assign(s, { diameter: SIZE_PRESETS[v].diameter, footballLength: SIZE_PRESETS[v].footballLength, footballWidth: SIZE_PRESETS[v].footballWidth });
    changed('shape'); renderTab();
  });
  const dia = el('input', { type: 'number', min: 60, max: 250, step: 1, value: s.diameter, 'aria-label': 'Diameter in mm' });
  dia.addEventListener('change', () => {
    const v = Math.min(250, Math.max(60, parseFloat(dia.value) || 150));
    dia.value = v; s.diameter = v; s.sizePreset = Object.keys(SIZE_PRESETS).find((k) => SIZE_PRESETS[k].diameter === v) || 'custom';
    changed('shape'); renderTab();
  });

  return [
    section('Shape', shapeSel,
      note('More shapes (soccer, football, baseball, volleyball, Moon) arrive in the next milestone.')),
    section('Size', sizeSeg,
      el('div', { class: 'row', style: 'margin-top:10px' }, el('span', { class: 'grow' }, 'Ball diameter (mm)'), dia)),
    section('Wall thickness',
      slider('tMin', 'Thinnest (brightest)', 0.4, 2, 0.05, { fmt: mm, map: (v) => Math.min(v, s.tMax - 0.5) }),
      slider('tMax', 'Thickest (darkest)', 1.5, 5, 0.05, { fmt: mm, map: (v) => Math.max(v, s.tMin + 0.5) }),
      note('Typical white PLA: 0.8 mm to 3.0 mm.')),
    section('Opening and collar',
      slider('opening.diameter', 'Opening diameter', 20, 90, 0.5, { fmt: mm, group: 'shape' }),
      slider('opening.collarHeight', 'Collar height', 2, 15, 0.5, { fmt: mm, group: 'shape' }),
      slider('opening.collarWall', 'Collar wall', 1.2, 4, 0.1, { fmt: mm, group: 'shape' }),
      note('The collar drops into the base. The light shines up through the opening.')),
  ];
}

function markingsTab() {
  const s = app.settings, m = s.markings;
  const kind = SHAPES[s.shape]?.markings;
  if (!kind || kind === 'none') return [section('Markings', note('The plain sphere has no markings.'))];
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
      slider('markings.fade', 'Fade over the photo', 0, 1, 0.01, { fmt: pct }),
    ),
    m.style === 'off' ? null : section('Turn the markings',
      slider('markings.yaw', 'Spin', -180, 180, 1, { fmt: deg }),
      slider('markings.pitch', 'Tilt forward / back', -90, 90, 1, { fmt: deg }),
      slider('markings.roll', 'Tilt sideways', -90, 90, 1, { fmt: deg }),
      el('button', {
        class: 'btn small',
        onclick: () => { const d = defaultSettings().markings; Object.assign(m, { yaw: d.yaw, pitch: d.pitch, roll: d.roll }); changed('field'); renderTab(); },
      }, 'Reset turn')),
  ];
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
  const estSize = [ax.a * 2, ax.b * 2, ax.c * 2];
  const estDiag = [2 * Math.sqrt((ax.a ** 2 + ax.b ** 2) / 2), 2 * Math.sqrt((ax.a ** 2 + ax.b ** 2) / 2)];
  const fit = app.lastExport ? fitCheck(app.lastExport.size, app.lastExport.diagonal) : fitCheck(estSize, estDiag);

  const raised = s.markings.style === 'raised' && SHAPES[s.shape]?.markings !== 'none';
  const opts = Object.entries(DETAIL_PRESETS).map(([k, d]) => {
    let sizeText = '';
    if (app.shape) {
      const tris = estimateTriangles(app.shape, d.step, raised ? d.step : OUTER_STEP);
      sizeText = `≈ ${(stlBytes(tris) / 1e6).toFixed(0)} MB`;
    }
    const radio = el('input', { type: 'radio', name: 'detail', value: k });
    radio.checked = s.detail === k;
    radio.addEventListener('change', () => { s.detail = k; scheduleAutosave(); renderTab(); });
    const desc = { draft: 'Quick test prints', standard: 'Best for most prints', fine: 'Close-up portraits; big file' }[k];
    return el('label', { class: 'detail-opt' + (s.detail === k ? ' active' : '') },
      radio, el('span', {}, `${d.label} (${d.step} mm)`, el('small', {}, desc)), el('span', { class: 'size' }, sizeText));
  });

  const progress = el('div', { class: 'progress', hidden: !app.exporting }, el('div', { id: 'exportBar' }));
  const btn = el('button', { class: 'btn primary block', id: 'btnExport', disabled: app.exporting || !app.shape, onclick: exportStl },
    app.exporting ? 'Building STL…' : 'Export ball STL');

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
    section('Detail', ...opts,
      s.detail === 'fine' && isPhone() ? note('Fine detail may be too big for a phone and could fail. Standard is recommended here.', 'warn') : null),
    section('Export', btn, progress, stats,
      note('Print opening-down on the bed. Turn on supports in your slicer for the curve just above the collar.'),
      !app.base ? note('No photo yet: this exports a plain ball with markings.', 'warn') : null),
  ];
}

// ---------- Export ----------
function exportStl() {
  if (app.exporting || !app.shape) return;
  const s = app.settings;
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
      download(new Blob([msg.stl], { type: 'model/stl' }), fileName);
      app.lastExport = { ...msg.stats, fileName };
      toast(`Saved ${fileName}`);
      done();
    } else if (msg.type === 'error') {
      toast(`Export failed: ${msg.message}`, 'err');
      done();
    }
  };
  worker.onerror = async (e) => {
    // The export code loads from the local server when the export starts. If start.bat
    // was closed, that load fails, so check the server before blaming the detail level.
    const serverUp = await fetch(workerUrl, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok, () => false);
    if (!serverUp) {
      toast('Export could not start: the app\'s local server is not running. Run start.bat again, then export.', 'err');
    } else {
      toast(`Export failed${e.message ? ': ' + e.message : ''}. Try a lower detail level.`, 'err');
    }
    done();
  };
  const photo = app.processed ? { w: app.processed.w, h: app.processed.h, data: app.processed.data.slice() } : null;
  worker.postMessage({ settings: structuredClone(s), photo, stepInner: step, stepOuter: OUTER_STEP }, photo ? [photo.data.buffer] : []);
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

const choosePhoto = () => $('filePhoto').click();
$('btnChoosePhoto').addEventListener('click', choosePhoto);
$('btnChoosePhoto2').addEventListener('click', choosePhoto);
$('filePhoto').addEventListener('change', (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (f) loadPhoto(f, f.name);
});

$('btnSaveProject').addEventListener('click', async () => {
  await saveProjectFile({ settings: app.settings, photoBlob: app.photoBlob, photoName: app.photoName }, `${projectBaseName()}.lithoproj`);
  toast('Project saved to your downloads.');
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
$('btnNew').addEventListener('click', () => {
  if (app.base && !confirm('Start a new project? The current photo and settings will be cleared (save a project file first if you want to keep them).')) return;
  const bed = app.settings.bed;
  app.settings = defaultSettings(); app.settings.bed = bed;
  app.photoBlob = null; app.photoName = null; app.base = null; app.processed = null;
  $('emptyState').classList.remove('hidden');
  changed('shape'); renderTab();
});

async function applyProject(proj) {
  app.settings = mergeSettings(proj.settings);
  app.base = null; app.processed = null; app.photoBlob = null; app.photoName = null;
  changed('shape');
  if (proj.photoBlob) await loadPhoto(proj.photoBlob, proj.photoName, { fresh: false });
  else $('emptyState').classList.remove('hidden');
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
  if (f.name.endsWith('.lithoproj')) {
    try { await applyProject(await readProjectFile(f)); toast(`Opened ${f.name}`); } catch (err) { toast(err.message, 'err'); }
  } else loadPhoto(f, f.name);
});

// ---------- Start ----------
(async function start() {
  renderTab();
  const saved = await loadAutosave();
  if (saved && saved.settings) {
    await applyProject(saved);
  } else {
    changed('shape');
  }
})();

// Debug handles for testing in the console
window.__litho = app;
window.__lithoLoadPhoto = loadPhoto;
window.__lithoPreview = preview;
