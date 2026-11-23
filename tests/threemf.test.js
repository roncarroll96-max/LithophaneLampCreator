// 3MF export (version 1.5): every part in one file, named, set out side by side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ThreeMFWriter, crc32, layoutParts } from '../js/core/threemf.js';
import { build3MF, partList } from '../js/core/exportParts.js';
import { defaultSettings } from '../js/core/settings.js';
import { checkWatertight } from '../js/core/mesh.js';

/** Reads a ZIP from byte parts: { name: Uint8Array } (deflated entries are inflated). */
async function unzip(parts) {
  const total = parts.reduce((n, p) => n + p.byteLength, 0), buf = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { buf.set(new Uint8Array(p.buffer || p, p.byteOffset || 0, p.byteLength), o); o += p.byteLength; }
  const dv = new DataView(buf.buffer);
  const end = total - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50, 'end of central directory');
  const n = dv.getUint16(end + 10, true), cdOff = dv.getUint32(end + 16, true);
  const files = {};
  let c = cdOff;
  for (let i = 0; i < n; i++) {
    assert.equal(dv.getUint32(c, true), 0x02014b50);
    const method = dv.getUint16(c + 10, true), crc = dv.getUint32(c + 16, true);
    const size = dv.getUint32(c + 20, true), usize = dv.getUint32(c + 24, true);
    const nameLen = dv.getUint16(c + 28, true), local = dv.getUint32(c + 42, true);
    const name = new TextDecoder().decode(buf.subarray(c + 46, c + 46 + nameLen));
    assert.equal(dv.getUint32(local, true), 0x04034b50, `${name}: local header`);
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    let data = buf.slice(start, start + size);
    if (method === 8) {
      const ds = new DecompressionStream('deflate-raw');
      data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer());
    }
    assert.equal(data.byteLength, usize, `${name}: size`);
    assert.equal(crc32(data), crc, `${name}: checksum`);
    files[name] = data;
    c += 46 + nameLen + dv.getUint16(c + 30, true) + dv.getUint16(c + 32, true);
  }
  return files;
}

/** The objects and build items in a 3MF model. */
function readModel(xml) {
  const objects = [...xml.matchAll(/<object id="(\d+)" name="([^"]*)" type="model">([\s\S]*?)<\/object>/g)].map((m) => {
    const verts = [...m[3].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)].map((v) => [+v[1], +v[2], +v[3]]);
    const tris = [...m[3].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)].map((t) => [+t[1], +t[2], +t[3]]);
    return { id: +m[1], name: m[2], verts, tris };
  });
  const items = [...xml.matchAll(/<item objectid="(\d+)" transform="([^"]+)"\/>/g)].map((m) => ({ id: +m[1], t: m[2].split(' ').map(Number) }));
  return { objects, items };
}

/** A closed box mesh (12 triangles) from x0..x1 etc. */
function boxMesh(x0, x1, y0, y1, z0, z1) {
  const positions = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
  const indices = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  return { positions, indices };
}

test('a 3MF opens as a ZIP with its model, and each part keeps its name, shape and copies', async () => {
  const w = new ThreeMFWriter({ title: 'Test & "lamp"' });
  await w.addObject('Box <one>', boxMesh(-5, 5, -5, 5, 2, 12));
  // a stray triangle with a repeated corner is left out (3MF forbids them)
  const two = boxMesh(0, 30, 0, 20, 0, 4); two.indices = new Uint32Array([...two.indices, 1, 1, 2]);
  assert.equal(await w.addObject('Pillar', two, 3), 12);
  const files = await unzip(await w.finish({ x: 100, y: 100 }));
  assert.deepEqual(Object.keys(files).sort(), ['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels']);
  const xml = new TextDecoder().decode(files['3D/3dmodel.model']);
  assert.match(xml, /unit="millimeter"/);
  assert.match(xml, /Test &amp; &quot;lamp&quot;/);
  const { objects, items } = readModel(xml);
  assert.deepEqual(objects.map((o) => o.name), ['Box &lt;one&gt;', 'Pillar']);
  for (const o of objects) {
    assert.equal(o.verts.length, 8); assert.equal(o.tris.length, 12);
    assert.ok(checkWatertight(new Uint32Array(o.tris.flat()), o.verts.length).ok, `${o.name} closed`);
  }
  assert.deepEqual(items.map((i) => i.id), [1, 2, 2, 2], 'one box, three pillars');
  // Every part sits on the bed (z = 0) and no two overlap
  const boxes = items.map(({ id, t }) => {
    const o = objects[id - 1], xs = o.verts.map((v) => v[0] + t[9]), ys = o.verts.map((v) => v[1] + t[10]), zs = o.verts.map((v) => v[2] + t[11]);
    assert.ok(Math.abs(Math.min(...zs)) < 1e-6, 'on the bed');
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    assert.ok(a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2], `parts ${i} and ${j} apart`);
  }
});

test('the layout fills rows across the bed, then starts a new row', () => {
  const spots = layoutParts([[100, 50], [100, 30], [100, 40], [20, 20]], { x: 256, y: 256 });
  assert.deepEqual(spots, [[0, 0], [110, 0], [0, 60], [110, 60]]);
});

test('a lantern 3MF holds all four panels, four pillars, the base and the top', async () => {
  const s = defaultSettings(); s.shape = 'lantern'; s.tMax = 3; s.base.puckHold = 'tray';
  const data = { settings: s, photos: null, textMasks: null, stepInner: 1.2, stepOuter: 2 };
  assert.deepEqual(partList(data).map((p) => [p.name, p.copies]),
    [['Front panel', 1], ['Right panel', 1], ['Back panel', 1], ['Left panel', 1], ['Pillar', 4], ['Base', 1], ['Top (Standard roof)', 1]]);
  const seen = [];
  const { parts, stats } = await build3MF(data, (v) => seen.push(v));
  assert.equal(stats.pieces, 10);
  assert.ok(seen.every((v, i) => i === 0 || v >= seen[i - 1] - 1e-9) && seen.at(-1) === 1, 'progress only goes up, to 100%');
  const files = await unzip(parts);
  const { objects, items } = readModel(new TextDecoder().decode(files['3D/3dmodel.model']));
  assert.equal(objects.length, 7); assert.equal(items.length, 10);
  for (const o of objects) {
    assert.ok(o.tris.every(([a, b, c]) => a !== b && b !== c && a !== c && Math.max(a, b, c) < o.verts.length), `${o.name}: good triangles`);
    assert.ok(checkWatertight(new Uint32Array(o.tris.flat()), o.verts.length).ok, `${o.name}: closed`);
  }
});

test('a ball 3MF holds the ball and its base; a panel with no base holds just the panel', () => {
  const s = defaultSettings();
  // the puck tray under a ball is a bottom cover, its own part
  assert.deepEqual(partList({ settings: s }).map((p) => p.name), ['Basketball', 'Base', 'Base bottom cover']);
  s.base.puckHold = 'hole';
  assert.deepEqual(partList({ settings: s }).map((p) => p.name), ['Basketball', 'Base']);
  s.shape = 'panel'; s.base.panelKind = 'none';
  assert.equal(partList({ settings: s }).length, 1);
});
