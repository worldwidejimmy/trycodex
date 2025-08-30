import React, { useEffect, useRef, useState } from 'react';

const vert = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = (a_pos + 1.0) * 0.5; // 0..1
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const frag = `#version 300 es
precision highp float;
out vec4 outColor;
in vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse; // 0..1
uniform float u_seed;
uniform float u_iter; // iterations
uniform float u_zoomAmp; // 0..0.2
uniform float u_paletteShift; // 0..1

// cosine palette by IQ
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d){
  return a + b*cos(6.28318*(c*t + d));
}

void main(){
  vec2 uv = v_uv;
  // aspect-corrected coords centered at 0
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2((uv.x - 0.5)*2.0*aspect, (uv.y - 0.5)*2.0);

  // Mouse maps to Julia constant c
  // Range chosen for nice shapes
  vec2 c = vec2(mix(-0.85, 0.85, u_mouse.x), mix(-0.85, 0.85, u_mouse.y));

  // Zoom and gentle drift
  float zoom = 0.9 + u_zoomAmp*sin(u_time*0.2 + u_seed*6.0);
  p *= zoom;

  // Iterate Julia set
  vec2 z = p;
  float maxIter = max(10.0, u_iter);
  float i;
  for(i=0.0;i<1000.0;i++){
    // z = z^2 + c
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    if(dot(z,z) > 16.0) break;
    if(i>=maxIter) break;
  }

  // Smooth iteration count
  float m2 = dot(z,z);
  float smoothIter = i - log2(max(1e-6, log(m2))) + 4.0;
  float t = smoothIter / maxIter;

  // Animated palette influenced by seed
  vec3 col = palette(
    t,
    vec3(0.5, 0.5, 0.55),
    vec3(0.5, 0.4, 0.3),
    vec3(1.0, 1.0, 1.0),
    vec3(u_paletteShift + 0.1*sin(u_time*0.05 + u_seed*3.0), 0.5, 0.7)
  );

  // Soft vignette
  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  float vig = smoothstep(0.9, 0.2, r);
  col *= vig;

  outColor = vec4(pow(col, vec3(0.92)), 1.0);
}`;

function compile(gl, type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
    throw new Error(gl.getShaderInfoLog(s) || 'Shader compile failed');
  }
  return s;
}

function program(gl, vs, fs){
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
    throw new Error(gl.getProgramInfoLog(p) || 'Program link failed');
  }
  return p;
}

export default function FractalCanvas({ settings }){
  const ref = useRef(null);
  const mouse = useRef({ x: 0.33, y: 0.66 });
  const seed = useRef(Math.random());
  const frame = useRef(null);
  const [noGl, setNoGl] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas.getContext('webgl2', { antialias: true });
    if(!gl){
      console.warn('WebGL2 not supported.');
      setNoGl(true);
      return;
    }

    // Setup program
    const vs = compile(gl, gl.VERTEX_SHADER, vert);
    const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
    const prog = program(gl, vs, fs);
    gl.useProgram(prog);

    // Fullscreen quad
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const verts = new Float32Array([
      -1, -1,  
       1, -1,  
      -1,  1,  
      -1,  1,  
       1, -1,  
       1,  1
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = 0;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');
    const uSeed = gl.getUniformLocation(prog, 'u_seed');
    const uIter = gl.getUniformLocation(prog, 'u_iter');
    const uZoomAmp = gl.getUniformLocation(prog, 'u_zoomAmp');
    const uPaletteShift = gl.getUniformLocation(prog, 'u_paletteShift');

    function resize(){
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if(canvas.width !== w || canvas.height !== h){
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    let t0 = performance.now();
    function tick(){
      resize();
      const t = (performance.now() - t0) / 1000;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, mouse.current.x, 1.0 - mouse.current.y);
      gl.uniform1f(uSeed, seed.current);
      const s = settings || { iter: 120, zoomAmp: 0.05, paletteShift: 0.2 };
      gl.uniform1f(uIter, s.iter ?? 120);
      gl.uniform1f(uZoomAmp, s.zoomAmp ?? 0.05);
      gl.uniform1f(uPaletteShift, s.paletteShift ?? 0.2);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame.current = requestAnimationFrame(tick);
    }

    tick();

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

    canvas.addEventListener('mousemove', onMouse);
    canvas.addEventListener('touchmove', onTouch, { passive: true });
    canvas.addEventListener('click', () => { seed.current = Math.random(); });

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('touchmove', onTouch);
      if(frame.current) cancelAnimationFrame(frame.current);
      gl.deleteBuffer(quad);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [settings]);

  return (
    <div className="fractal-wrap">
      <canvas ref={ref} className="fractal-canvas" />
      <div className="hint">Move mouse inside the box • Click to remix</div>
      {noGl && (
        <div className="fallback">WebGL2 not supported in this browser</div>
      )}
    </div>
  );
}
