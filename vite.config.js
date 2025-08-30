import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function settingsApiPlugin(){
  const file = path.resolve(process.cwd(), 'settings.json');

  function readFile(){
    try { return JSON.parse(fs.readFileSync(file, 'utf8') || '{}'); }
    catch { return {}; }
  }
  function writeFile(obj){
    try {
      fs.writeFileSync(file, JSON.stringify(obj, null, 2));
    } catch (e) {
      // no-op
    }
  }

  function handler(req, res, next){
    if(!req.url) return next();
    if(!req.url.startsWith('/api/settings')) return next();
    if(req.method === 'GET'){
      const data = readFile();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return;
    }
    if(req.method === 'POST' || req.method === 'PUT'){
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const json = JSON.parse(body || '{}');
          writeFile(json);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 400;
          res.end('Invalid JSON');
        }
      });
      return;
    }
    res.statusCode = 405;
    res.end('Method Not Allowed');
  }

  return {
    name: 'settings-api-plugin',
    configureServer(server){
      server.middlewares.use(handler);
    },
    configurePreviewServer(server){
      server.middlewares.use(handler);
    }
  };
}

export default defineConfig({
  server: {
    host: true,
    port: 5173
  },
  plugins: [settingsApiPlugin()]
});
