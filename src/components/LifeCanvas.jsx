import React, { useEffect, useRef } from 'react';

export default function LifeCanvas({ settings }){
  const canvasRef = useRef(null);
  const gridRef = useRef({ w: 0, h: 0, a: null, b: null });
  const mouseDown = useRef(false);
  const lastPaint = useRef({ x: -1, y: -1 });
  const frame = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function setupGrid(){
      const cell = (settings && settings.cell) || 4;
      const gw = Math.floor(canvas.clientWidth / cell);
      const gh = Math.floor(canvas.clientHeight / cell);
      gridRef.current = {
        w: gw, h: gh,
        a: new Uint8Array(gw*gh),
        b: new Uint8Array(gw*gh)
      };
      // seed
      const a = gridRef.current.a;
      for(let i=0;i<a.length;i++) a[i] = Math.random() < 0.12 ? 1 : 0;
    }

    function resize(){
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if(canvas.width !== w || canvas.height !== h){
        canvas.width = w; canvas.height = h;
        setupGrid();
      }
    }

    function idx(x,y){ const g=gridRef.current; return ((y+g.h)%g.h)*g.w + ((x+g.w)%g.w); }

    let acc = 0;
    function step(dt){
      const g = gridRef.current; const { w, h, a, b } = g;
      for(let y=0;y<h;y++){
        for(let x=0;x<w;x++){
          const i = y*w + x;
          let n = 0;
          n += a[idx(x-1,y-1)] + a[idx(x,y-1)] + a[idx(x+1,y-1)];
          n += a[idx(x-1,y  )]                 + a[idx(x+1,y  )];
          n += a[idx(x-1,y+1)] + a[idx(x,y+1)] + a[idx(x+1,y+1)];
          const alive = a[i] === 1;
          b[i] = (alive && (n===2||n===3)) || (!alive && n===3) ? 1 : 0;
        }
      }
      g.a = b; g.b = a; // swap refs
    }

    function draw(){
      const cell = (settings && settings.cell) || 4;
      const g = gridRef.current; const { w, h, a } = g;
      // fade
      ctx.fillStyle = 'rgba(11,15,23,0.2)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      // draw alive cells
      ctx.fillStyle = '#86e3ce';
      for(let y=0;y<h;y++){
        for(let x=0;x<w;x++){
          if(a[y*w+x]){
            ctx.fillRect(Math.floor(x*cell*dpr), Math.floor(y*cell*dpr), Math.ceil(cell*dpr), Math.ceil(cell*dpr));
          }
        }
      }
    }

    let tPrev = performance.now();
    function tick(){
      resize();
      const cell = (settings && settings.cell) || 4;
      const speed = (settings && settings.speed) || 1.0; // steps per frame approx
      const t = performance.now();
      const dt = (t - tPrev)/1000; tPrev = t;
      acc += dt * (2*speed);
      while(acc > 0.016){ step(0.016); acc -= 0.016; }
      draw();
      frame.current = requestAnimationFrame(tick);
    }

    function paintAt(e){
      const cell = (settings && settings.cell) || 4;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / cell);
      const y = Math.floor((e.clientY - rect.top) / cell);
      if(x === lastPaint.current.x && y === lastPaint.current.y) return;
      lastPaint.current = { x, y };
      const g = gridRef.current; const { w, a } = g;
      if(x>=0 && y>=0 && x<w && y<g.h) a[y*w+x] = 1;
    }

    function onDown(e){ mouseDown.current = true; paintAt(e); }
    function onMove(e){ if(mouseDown.current) paintAt(e); }
    function onUp(){ mouseDown.current = false; lastPaint.current = { x:-1, y:-1 }; }

    tick();
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if(frame.current) cancelAnimationFrame(frame.current);
    };
  }, [settings]);

  return (
    <div className="fractal-wrap">
      <canvas ref={canvasRef} className="fractal-canvas" />
      <div className="hint">Game of Life • Click/drag to add life</div>
    </div>
  );
}

