import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('dist');
const PORT = Number(process.env.PORT || 5173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.map': 'application/json',
};

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) throw new Error('bad path');
    if (url.pathname === '/' || url.pathname === '') file = path.join(ROOT, 'index.html');
    let body;
    try { body = await readFile(file); }
    catch { file = path.join(ROOT, 'index.html'); body = await readFile(file); }
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, '0.0.0.0', () => console.log(`IslamWork → http://0.0.0.0:${PORT}`));
