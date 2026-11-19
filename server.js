// Tiny local web server for running the app offline on this PC.
// No dependencies. Serves the project folder at http://localhost:5178
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5178;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.tflite': 'application/octet-stream',
  '.task': 'application/octet-stream', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};

// Only answer requests addressed to this PC by name, so a web page can't reach the server by
// pointing its own domain name at 127.0.0.1 (DNS rebinding).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

createServer(async (req, res) => {
  try {
    const host = (req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
    if (!LOCAL_HOSTS.has(host)) { res.writeHead(403).end(); return; }
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    // Must be inside the app folder itself (not a neighbouring folder whose name starts the same)
    if (!file.startsWith(ROOT + sep) || file.includes('node_modules')) { res.writeHead(403).end(); return; }
    const s = await stat(file);
    if (!s.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Lithophane Lamp Creator running at http://localhost:${PORT}`);
  console.log('Close this window to stop it.');
});
