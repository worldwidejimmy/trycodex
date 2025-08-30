#!/usr/bin/env node
// Precompress dist assets to .gz and .br using Node's built-in zlib
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const distDir = path.resolve(process.cwd(), 'dist');
const exts = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml', '.wasm', '.map']);

function walk(dir){
  const out = [];
  for(const ent of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, ent.name);
    if(ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function compressBufferGzip(buf){
  return zlib.gzipSync(buf, { level: 9 });
}
function compressBufferBrotli(buf){
  return zlib.brotliCompressSync(buf, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 }
  });
}

function main(){
  if(!fs.existsSync(distDir)){
    console.error('dist/ not found. Run vite build first.');
    process.exit(1);
  }
  const files = walk(distDir).filter((f) => exts.has(path.extname(f)));
  let gz = 0, br = 0;
  for(const f of files){
    const buf = fs.readFileSync(f);
    const gzBuf = compressBufferGzip(buf);
    const brBuf = compressBufferBrotli(buf);
    if(gzBuf.length < buf.length){ fs.writeFileSync(f + '.gz', gzBuf); gz++; }
    if(brBuf.length < buf.length){ fs.writeFileSync(f + '.br', brBuf); br++; }
  }
  console.log(`Precompressed ${gz} gzip and ${br} brotli assets.`);
}

main();

