// Minimal Node server: serves dist/ and /api/settings
// Usage: PORT=8080 node server.js
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, 'dist');
const settingsFile = path.resolve(process.cwd(), 'settings.json');
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
const logRequests = process.env.LOG_REQUESTS === '1' || process.env.LOG_REQUESTS === 'true';
const disablePrecomp = process.env.DISABLE_PRECOMP === '1' || process.env.DISABLE_PRECOMP === 'true';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

function safeReadJSON(file, fallback = {}){
  try {
    const s = fs.readFileSync(file, 'utf8');
    return s ? JSON.parse(s) : fallback;
  } catch { return fallback; }
}

function safeWriteJSON(file, obj){
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

function send(res, code, body, headers = {}){
  res.writeHead(code, { ...headers });
  if(body instanceof Buffer) res.end(body); else res.end(body ?? '');
}

function isHashedAsset(p){
  // crude hash check: filename contains .[hash]. before extension
  const base = path.basename(p);
  return /\.[a-f0-9]{8,}\./i.test(base);
}

function serveStatic(req, res, filePath){
  try {
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const accept = String(req.headers['accept-encoding'] || '');
    const vary = { 'Vary': 'Accept-Encoding' };

    // Prefer brotli, then gzip, if client accepts and file exists
    if(!disablePrecomp && accept.includes('br') && fs.existsSync(filePath + '.br')){
      const data = fs.readFileSync(filePath + '.br');
      const cache = ext === '.html' ? 'no-cache' : (isHashedAsset(filePath) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
      return send(res, 200, data, { 'Content-Type': type, 'Content-Encoding': 'br', 'Cache-Control': cache, ...vary });
    }
    if(!disablePrecomp && accept.includes('gzip') && fs.existsSync(filePath + '.gz')){
      const data = fs.readFileSync(filePath + '.gz');
      const cache = ext === '.html' ? 'no-cache' : (isHashedAsset(filePath) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
      return send(res, 200, data, { 'Content-Type': type, 'Content-Encoding': 'gzip', 'Cache-Control': cache, ...vary });
    }

    // Fallback: uncompressed
    const data = fs.readFileSync(filePath);
    const cache = ext === '.html' ? 'no-cache' : (isHashedAsset(filePath) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    return send(res, 200, data, { 'Content-Type': type, 'Cache-Control': cache, ...vary });
  } catch (e) {
    if(e.code === 'ENOENT') send(res, 404, 'Not Found');
    else send(res, 500, 'Internal Server Error');
  }
}

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  const parsed = url.parse(req.url || '/');
  const pathname = parsed.pathname || '/';
  if(logRequests) console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  // API: /api/settings
  if(pathname === '/api/settings'){
    if(method === 'GET'){
      const data = safeReadJSON(settingsFile, {});
      return send(res, 200, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8' });
    }
    if(method === 'POST' || method === 'PUT'){
      let body = '';
      req.on('data', (c) => { body += c; if(body.length > 5e6) req.destroy(); });
      req.on('end', () => {
        try {
          const json = JSON.parse(body || '{}');
          safeWriteJSON(settingsFile, json);
          send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': 'application/json; charset=utf-8' });
        } catch {
          send(res, 400, 'Invalid JSON');
        }
      });
      return;
    }
    return send(res, 405, 'Method Not Allowed');
  }

  // API: /api/client-log — append client errors to server stdout
  if(pathname === '/api/client-log' && method === 'POST'){
    let body = '';
    req.on('data', (c) => { body += c; if(body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const json = JSON.parse(body || '{}');
        const level = (json.level || 'log').toUpperCase();
        const msg = json.message || '';
        const stack = json.stack ? `\n${json.stack}` : '';
        console.log(`[CLIENT ${level}] ${msg}${stack}`);
        try {
          const line = `${new Date().toISOString()} [${level}] ${msg}${stack ? ' ' + stack : ''}\n`;
          fs.appendFileSync(path.resolve(process.cwd(), 'client.log'), line);
        } catch {}
      } catch (e) {
        console.log('[CLIENT LOG] invalid JSON');
      }
      return send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': 'application/json; charset=utf-8' });
    });
    return;
  }

  // Static files from dist
  let filePath = path.join(distDir, pathname);

  try {
    const stat = fs.statSync(filePath);
    if(stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    // SPA fallback to index.html for unknown routes
    filePath = path.join(distDir, 'index.html');
  }
  serveStatic(req, res, filePath);
});

server.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
