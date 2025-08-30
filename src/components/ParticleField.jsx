import React, { useEffect, useRef } from 'react';

export default function ParticleField({ settings }){
  const canvasRef = useRef(null);
  const frame = useRef(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize(){
      const { clientWidth, clientHeight } = canvas;
      const w = Math.floor(clientWidth * dpr);
      const h = Math.floor(clientHeight * dpr);
      if(canvas.width !== w || canvas.height !== h){
        canvas.width = w; canvas.height = h;
      }
    }

    const parts = [];
    function reset(count){
      parts.length = 0;
      for(let i=0;i<count;i++){
        parts.push({
          x: Math.random(),
          y: Math.random(),
          vx: 0, vy: 0,
          hue: (i/count)*360
        });
      }
    }

    let t0 = performance.now();
    function flow(x, y, t){
      // Simple time-varying trig flow influenced by mouse
      const m = mouse.current;
      const a = Math.sin(3.0*(x + t*0.05) + m.x*4.0);
      const b = Math.cos(3.0*(y - t*0.04) + m.y*4.0);
      const angle = a + b;
      return angle;
    }

    function tick(){
      resize();
      const w = canvas.width, h = canvas.height;
      const s = settings || { count: 800, speed: 1.0, trail: 0.08 };
      if(parts.length !== s.count) reset(s.count);

      // fade trail
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(11,15,23,${s.trail})`; // background fade
      ctx.fillRect(0,0,w,h);

      const t = (performance.now() - t0)/1000;
      const speed = 0.0005 * (0.5 + s.speed);
      ctx.globalCompositeOperation = 'lighter';

      for(let i=0;i<parts.length;i++){
        const p = parts[i];
        const ang = flow(p.x, p.y, t);
        p.vx += Math.cos(ang) * speed;
        p.vy += Math.sin(ang) * speed;
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.96; p.vy *= 0.96; // damping

        // wrap
        if(p.x < 0) p.x += 1; if(p.x > 1) p.x -= 1;
        if(p.y < 0) p.y += 1; if(p.y > 1) p.y -= 1;

        const px = p.x * w; const py = p.y * h;
        ctx.strokeStyle = `hsla(${p.hue},80%,65%,0.15)`;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + p.vx*10000, py + p.vy*10000);
        ctx.stroke();
      }

      frame.current = requestAnimationFrame(tick);
    }

    function onMouse(e){
      const rect = canvas.getBoundingClientRect();
      mouse.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
      };
    }
    function onTouch(e){
      if(!e.touches[0]) return;
      const rect = canvas.getBoundingClientRect();
      mouse.current = {
        x: (e.touches[0].clientX - rect.left) / rect.width,
        y: (e.touches[0].clientY - rect.top) / rect.height
      };
    }

    reset((settings && settings.count) || 800);
    ctx.fillStyle = '#0b0f17'; ctx.fillRect(0,0,canvas.width,canvas.height);
    tick();

    canvas.addEventListener('mousemove', onMouse);
    canvas.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('touchmove', onTouch);
      if(frame.current) cancelAnimationFrame(frame.current);
    };
  }, [settings]);

  return (
    <div className="fractal-wrap">
      <canvas ref={canvasRef} className="fractal-canvas" />
      <div className="hint">Flow field particles • Move mouse to steer</div>
    </div>
  );
}

