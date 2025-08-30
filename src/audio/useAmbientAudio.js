import { useCallback, useEffect, useRef, useState } from 'react';

function midiToFreq(m){
  return 440 * Math.pow(2, (m - 69) / 12);
}

const PENTATONIC = [45, 48, 50, 52, 55, 57, 60, 62, 64]; // A minor-ish

export function useAmbientAudio(){
  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const padRef = useRef({});
  const timerRef = useRef(null);
  const [isPlaying, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.15);
  const [muted, setMuted] = useState(false);

  const setup = useCallback(() => {
    if(ctxRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = volume; // gentle, controlled
    master.connect(ctx.destination);

    // Soft pad: two detuned oscillators through lowpass with slow LFO
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 0.7;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.2;
    padGain.connect(lp);
    lp.connect(master);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'sine';
    o1.frequency.value = midiToFreq(45);
    o2.frequency.value = midiToFreq(52);
    o2.detune.value = 6;
    o1.connect(padGain);
    o2.connect(padGain);
    o1.start();
    o2.start();

    // LFO for filter movement
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 600; // sweep amount
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    lfo.start();

    ctxRef.current = ctx;
    masterRef.current = master;
    padRef.current = { o1, o2, padGain, lp, lfo, lfoGain };
  }, []);

  const scheduleNote = useCallback((ctx, when) => {
    const master = masterRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const note = PENTATONIC[Math.floor(Math.random()*PENTATONIC.length)];
    const spread = Math.random() < 0.5 ? -12 : 0; // occasional lower octave
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(midiToFreq(note + spread), when);
    gain.gain.setValueAtTime(0.0, when);
    gain.gain.linearRampToValueAtTime(0.12, when + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 2.8);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + 3.0);
  }, []);

  const start = useCallback(async () => {
    setup();
    const ctx = ctxRef.current;
    if(ctx.state === 'suspended') await ctx.resume();

    // Schedule notes periodically
    if(!timerRef.current){
      timerRef.current = setInterval(() => {
        const now = ctx.currentTime;
        scheduleNote(ctx, now + 0.05);
      }, 900 + Math.random()*400);
    }
    setPlaying(true);
  }, [scheduleNote, setup]);

  const stop = useCallback(() => {
    if(timerRef.current){
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if(isPlaying) stop(); else start();
  }, [isPlaying, start, stop]);

  const setVolume = useCallback((v) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    const master = masterRef.current;
    const ctx = ctxRef.current;
    if(master && ctx){
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.linearRampToValueAtTime(muted ? 0 : clamped, now + 0.05);
    }
  }, [muted]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    const master = masterRef.current;
    const ctx = ctxRef.current;
    if(master && ctx){
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.linearRampToValueAtTime(next ? 0 : volume, now + 0.05);
    }
  }, [muted, volume]);

  // Cleanup on unmount
  useEffect(() => () => {
    if(timerRef.current){ clearInterval(timerRef.current); }
    if(ctxRef.current){
      try { ctxRef.current.close(); } catch {}
    }
  }, []);

  return { isPlaying, start, stop, toggle, volume, setVolume, muted, toggleMute };
}
