import React, { useEffect, useMemo, useRef, useState } from 'react';
import FractalCanvas from './components/FractalCanvas.jsx';
import ParticleField from './components/ParticleField.jsx';
import LifeCanvas from './components/LifeCanvas.jsx';
import { useAmbientAudio } from './audio/useAmbientAudio.js';

const COOL_THINGS = [
  { key: 'fractal', label: 'Fractal Flow (relaxing)' },
  { key: 'particles', label: 'Flow Field Particles' },
  { key: 'life', label: 'Game of Life (glow)' }
];

export default function App() {
  const [mode, setMode] = useState('fractal');
  const [settings, setSettings] = useState({
    fractal: { iter: 120, zoomAmp: 0.05, paletteShift: 0.2 },
    particles: { count: 800, speed: 1.0, trail: 0.08 },
    life: { cell: 4, speed: 1.0 }
  });
  const { isPlaying, toggle, volume, setVolume, muted, toggleMute } = useAmbientAudio();

  const activeSettings = useMemo(() => settings[mode] || {}, [settings, mode]);

  function updateSetting(group, key, value){
    setSettings((prev) => ({
      ...prev,
      [group]: { ...prev[group], [key]: value }
    }));
  }

  // -- Persistence: load on mount, save on changes (debounced)
  const saveTimer = useRef(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if(res.ok){
          const data = await res.json();
          if(data.mode) setMode(data.mode);
          if(data.settings) setSettings((prev)=>({ ...prev, ...data.settings }));
          if(data.audio){
            if(typeof data.audio.volume === 'number') setVolume(data.audio.volume);
            // toggleMute expects a user action to change; we can approximate by ramp
            if(typeof data.audio.muted === 'boolean' && data.audio.muted !== muted){
              toggleMute();
            }
          }
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // debounce writes to avoid spamming disk
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload = { mode, settings, audio: { volume, muted } };
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(()=>{});
    }, 300);
    return () => { if(saveTimer.current) clearTimeout(saveTimer.current); };
  }, [mode, settings, volume, muted]);

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand">Cool Things</div>
        <div className="controls">
          <label className="select-wrap">
            <span>Choose:</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {COOL_THINGS.map((c) => (
                <option key={c.key} value={c.key} disabled={c.disabled}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button className="audio-btn" onClick={toggle}>
            {isPlaying ? 'Pause Music' : 'Play Music'}
          </button>
          <div className="volume-wrap">
            <button className="mute-btn" onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
            <input
              className="volume-slider"
              type="range" min="0" max="1" step="0.01"
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="stage">
          <div className="stage-header">Move your mouse inside the box to explore.</div>
          <div className="drawing-area">
            {mode === 'fractal' && <FractalCanvas settings={activeSettings} />}
            {mode === 'particles' && <ParticleField settings={activeSettings} />}
            {mode === 'life' && <LifeCanvas settings={activeSettings} />}
          </div>
        </section>
      </main>
    </div>
  );
}
