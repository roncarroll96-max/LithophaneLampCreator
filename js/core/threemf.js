// 3MF writer: several printable parts in one file, each a named object, already turned for
// printing and set out side by side (the slicer's Arrange button sorts them onto plates).
// A 3MF file is a ZIP holding an XML model. The model is written and compressed in pieces as each
// part is added, so a big lamp needs no huge block of memory. No DOM: runs in the export worker
// and in Node (tests).

const enc = new TextEncoder();

// ---------- CRC-32 (ZIP checksums) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 of bytes, continuing from an earlier result (0 to start). */
export function crc32(bytes, crc = 0) {
  let c = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

/** Compresses one ZIP entry as it is written (raw deflate), keeping its checksum and sizes. */
class Deflater {
  constructor() {
    this.chunks = []; this.size = 0; this.usize = 0; this.crc = 0;
    if (typeof CompressionStream === 'undefined') { this.method = 0; return; } // stored (very old browsers)
    this.method = 8;
    const cs = new CompressionStream('deflate-raw');
    this.writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();
    this.reading = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        this.chunks.push(value); this.size += value.byteLength;
      }
    })();
  }

  async write(bytes) {
    this.crc = crc32(bytes, this.crc);
    this.usize += bytes.byteLength;
    if (this.method) await this.writer.write(bytes);
    else { this.chunks.push(bytes); this.size += bytes.byteLength; }
  }

  async close() {
    if (this.method) { await this.writer.close(); await this.reading; }
  }
}

const xmlEscape = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
  + '</Types>';
const RELS = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
  + '</Relationships>';
const MODEL_PATH = '3D/3dmodel.model';
const GAP = 10; // mm between parts in the layout

/**
 * Sets out footprints [w, d] in rows across the bed (x), row after row (y). Parts that don't fit
 * one bed simply carry on past it; the slicer's Arrange sorts them onto plates.
 */
export function layoutParts(sizes, bed) {
  const out = [];
  let x = 0, y = 0, rowD = 0;
  for (const [w, d] of sizes) {
    if (x > 0 && x + w > bed.x) { x = 0; y += rowD + GAP; rowD = 0; }
    out.push([x, y]);
    x += w + GAP; rowD = Math.max(rowD, d);
  }
  return out;
}

/** Builds a 3MF file one part at a time: addObject(...) for each, then finish(). */
export class ThreeMFWriter {
  constructor({ title = 'Lithophane Lamp Creator' } = {}) {
    this.objects = [];   // { id, name, copies, min, max }
    this.model = new Deflater();
    this.pending = []; this.pendingLen = 0;
    this.started = this._text('<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n'
      + `<metadata name="Title">${xmlEscape(title)}</metadata>\n`
      + '<metadata name="Application">Lithophane Lamp Creator</metadata>\n<resources>\n');
  }

  async _text(s) {
    this.pending.push(s); this.pendingLen += s.length;
    if (this.pendingLen > 1 << 21) await this._flush();
  }

  async _flush() {
    if (!this.pending.length) return;
    const bytes = enc.encode(this.pending.join(''));
    this.pending = []; this.pendingLen = 0;
    await this.model.write(bytes);
  }

  /**
   * Adds one part. mesh: { positions (x,y,z per vertex), indices (3 per triangle) } in printing
   * position; copies: how many to print (one object, several placements).
   */
  async addObject(name, mesh, copies = 1) {
    await this.started;
    const { positions: p, indices: ix } = mesh;
    const id = this.objects.length + 1;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    await this._text(`<object id="${id}" name="${xmlEscape(name)}" type="model"><mesh><vertices>\n`);
    const nv = p.length / 3, BATCH = 20000;
    for (let v0 = 0; v0 < nv; v0 += BATCH) {
      const v1 = Math.min(nv, v0 + BATCH), rows = new Array(v1 - v0);
      for (let v = v0; v < v1; v++) {
        const x = p[3 * v], y = p[3 * v + 1], z = p[3 * v + 2];
        if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
        if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
        if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
        rows[v - v0] = `<vertex x="${x.toFixed(3)}" y="${y.toFixed(3)}" z="${z.toFixed(3)}"/>`;
      }
      await this._text(rows.join('\n') + '\n');
    }
    await this._text('</vertices><triangles>\n');
    let triangles = 0;
    const nt = ix.length / 3;
    for (let t0 = 0; t0 < nt; t0 += BATCH) {
      const t1 = Math.min(nt, t0 + BATCH), rows = [];
      for (let t = t0; t < t1; t++) {
        const a = ix[3 * t], b = ix[3 * t + 1], c = ix[3 * t + 2];
        if (a === b || b === c || a === c) continue; // 3MF forbids triangles with a repeated corner
        rows.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`);
      }
      triangles += rows.length;
      if (rows.length) await this._text(rows.join('\n') + '\n');
    }
    await this._text('</triangles></mesh></object>\n');
    this.objects.push({ id, name, copies: Math.max(1, copies | 0), min, max, triangles });
    return triangles;
  }

  /** Closes the model and returns the 3MF file as a list of byte arrays (for a Blob). */
  async finish(bed = { x: 256, y: 256 }) {
    await this.started;
    const placed = [];
    for (const o of this.objects) for (let k = 0; k < o.copies; k++) placed.push(o);
    const spots = layoutParts(placed.map((o) => [o.max[0] - o.min[0], o.max[1] - o.min[1]]), bed);
    const items = placed.map((o, i) => {
      const tx = spots[i][0] - o.min[0], ty = spots[i][1] - o.min[1], tz = -o.min[2];
      return `<item objectid="${o.id}" transform="1 0 0 0 1 0 0 0 1 ${tx.toFixed(3)} ${ty.toFixed(3)} ${tz.toFixed(3)}"/>`;
    });
    await this._text(`</resources>\n<build>\n${items.join('\n')}\n</build>\n</model>\n`);
    await this._flush();
    await this.model.close();
    if (this.model.usize > 0xffffffff) throw new Error('The 3MF model is too big (over 4 GB). Try a lower detail level.');
    return zip([
      storedEntry('[Content_Types].xml', enc.encode(CONTENT_TYPES)),
      storedEntry('_rels/.rels', enc.encode(RELS)),
      { name: MODEL_PATH, method: this.model.method, crc: this.model.crc, size: this.model.size, usize: this.model.usize, chunks: this.model.chunks },
    ]);
  }
}

function storedEntry(name, bytes) {
  return { name, method: 0, crc: crc32(bytes), size: bytes.byteLength, usize: bytes.byteLength, chunks: [bytes] };
}

/** A ZIP file from finished entries: local headers and data, then the central directory. */
function zip(entries) {
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const out = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const h = new DataView(new ArrayBuffer(30 + name.length));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0, true);
    h.setUint16(8, e.method, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
    h.setUint32(14, e.crc, true); h.setUint32(18, e.size, true); h.setUint32(22, e.usize, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    new Uint8Array(h.buffer).set(name, 30);
    out.push(new Uint8Array(h.buffer), ...e.chunks);
    const c = new DataView(new ArrayBuffer(46 + name.length));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0, true);
    c.setUint16(10, e.method, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
    c.setUint32(16, e.crc, true); c.setUint32(20, e.size, true); c.setUint32(24, e.usize, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    new Uint8Array(c.buffer).set(name, 46);
    central.push(new Uint8Array(c.buffer));
    offset += 30 + name.length + e.size;
  }
  if (offset > 0xffffffff) throw new Error('The 3MF file is too big (over 4 GB). Try a lower detail level.');
  const cdSize = central.reduce((n, c) => n + c.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return [...out, ...central, new Uint8Array(end.buffer)];
}
