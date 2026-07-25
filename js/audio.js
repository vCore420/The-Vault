/*
 * audio.js
 * AudioManager — every sound is synthesized at runtime with the Web Audio API. No external audio files.
 * No dependencies.
 */
// All sound is synthesized at runtime via the Web Audio API — no external
// audio files — so every jingle, click and chime is generated procedurally.
class AudioManager{
  constructor(){
    this.ctx = null;
    this.master = null;
    this.ambientNodes = null;
    this.muted = false;
    this._rainGain = null;
    this._fireGain = null;
  }

  _ensureCtx(){
    if(this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
  }

  resume(){
    this._ensureCtx();
    if(this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m){
    this.muted = m;
    if(!this.master) return;
    const g = this.master.gain;
    const now = this.ctx.currentTime;
    const current = g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(current, now);
    g.linearRampToValueAtTime(m ? 0.0001 : 0.85, now + 0.08);
  }

  now(){ return this.ctx.currentTime; }

  _env(gainNode, t0, attack, hold, release, peak){
    const g = gainNode.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(peak, t0 + attack);
    g.setValueAtTime(peak, t0 + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  }

  _tone(freq, t0, dur, {type='sine', peak=0.3, attack=0.008, detune=0, filterFreq=null} = {}){
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.value = detune;
    const g = this.ctx.createGain();
    let node = osc;
    if(filterFreq){
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      osc.connect(f); node = f;
    }
    node.connect(g);
    g.connect(this.master);
    this._env(g, t0, attack, Math.max(0.001, dur - attack - dur*0.35), dur*0.35, peak);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return { osc, gain: g };
  }

  _noiseBuffer(dur){
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.max(1, rate * dur), rate);
    const data = buf.getChannelData(0);
    for(let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  click(pitch = 1){
    if(!this.ctx) return;
    const t0 = this.now();
    this._tone(520 * pitch, t0, 0.05, { type:'triangle', peak:0.18, attack:0.002 });
    this._tone(1400 * pitch, t0 + 0.005, 0.03, { type:'sine', peak:0.06, attack:0.001 });
  }

  drawerSlide(opening = true){
    if(!this.ctx) return;
    const t0 = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.5);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(opening ? 300 : 500, t0);
    filt.frequency.linearRampToValueAtTime(opening ? 900 : 200, t0 + 0.45);
    filt.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + 0.55);
    this._tone(opening ? 200 : 160, t0 + 0.35, 0.15, { type:'sine', peak:0.12 });
  }

  keyPickup(){
    if(!this.ctx) return;
    const t0 = this.now();
    [1760, 2093, 2637].forEach((f, i) => {
      this._tone(f, t0 + i * 0.028, 0.16, { type:'sine', peak:0.09, attack:0.003 });
    });
  }

  keyReturn(){
    if(!this.ctx) return;
    const t0 = this.now();
    [1568, 1174, 880].forEach((f, i) => {
      this._tone(f, t0 + i * 0.03, 0.15, { type:'sine', peak:0.07, attack:0.003 });
    });
  }

  insertTry(){
    if(!this.ctx) return;
    const t0 = this.now();
    this._tone(180, t0, 0.09, { type:'square', peak:0.06, filterFreq:900 });
  }

  unlockFail(){
    if(!this.ctx) return;
    const t0 = this.now();
    this._tone(196, t0, 0.13, { type:'sawtooth', peak:0.1, filterFreq:500 });
    this._tone(174, t0 + 0.1, 0.16, { type:'sawtooth', peak:0.09, filterFreq:450 });
  }

  unlockSuccess(big = false){
    if(!this.ctx) return;
    const t0 = this.now();
    // mechanical turn + click
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.18);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 1200; filt.Q.value = 2.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + 0.2);
    // door creak
    this._tone(90, t0 + 0.12, 0.4, { type:'sawtooth', peak:0.05, filterFreq:260 });
    // chime arpeggio
    const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [659.25, 783.99, 987.77];
    notes.forEach((f, i) => {
      this._tone(f, t0 + 0.3 + i * 0.09, big ? 0.55 : 0.4, { type:'sine', peak: big ? 0.14 : 0.11, attack:0.01 });
    });
  }

  environmentChime(){
    if(!this.ctx) return;
    const t0 = this.now();
    [880, 1108.7, 1318.5].forEach((f, i) => {
      this._tone(f, t0 + i * 0.12, 0.9, { type:'sine', peak:0.08, attack:0.02 });
    });
  }

  uiOpen(){
    if(!this.ctx) return;
    const t0 = this.now();
    this._tone(700, t0, 0.12, { type:'sine', peak:0.08 });
    this._tone(1050, t0 + 0.05, 0.14, { type:'sine', peak:0.06 });
  }

  startAmbience(){
    this._ensureCtx();
    if(this.ambientNodes) return;
    const t0 = this.now();

    // low warm drone (two detuned sines) — the only *continuous* sound;
    // everything else below is discrete one-shot texture, which is what
    // keeps this from ever reading as a hiss/static bed
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.045;
    droneGain.connect(this.master);
    const o1 = this.ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 55.6;
    o1.connect(droneGain); o2.connect(droneGain);
    o1.start(t0); o2.start(t0);
    this.ambientNodes = { o1, o2, droneGain };

    this._rainLevel = 1;
    this._fireLevel = 0;
    this._ambienceActive = true;
    this._scheduleRainDrops();
    this._scheduleFireCrackles();
  }

  // Rain as a stream of tiny, randomly-timed droplet transients — this is
  // what real rain synthesis sounds like; a continuous filtered noise loop
  // just reads as static, which is the bug this replaces.
  _scheduleRainDrops(){
    if(!this._ambienceActive) return;
    const level = this._rainLevel || 0;
    if(this.ctx && level > 0.015 && !this.muted){
      const drops = Math.random() < 0.6 ? 1 : 2;
      for(let i=0;i<drops;i++) this._playRainDrop(level);
    }
    const nextDelay = 30 + Math.random()*90;
    this._rainTimer = setTimeout(() => this._scheduleRainDrops(), nextDelay);
  }

  _playRainDrop(level){
    const t0 = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.035);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 2000 + Math.random()*3000;
    filt.Q.value = 1.1;
    const g = this.ctx.createGain();
    const peak = (0.018 + Math.random()*0.03) * level;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak), t0+0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+0.032);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0+0.05);
  }

  // Fireplace as occasional soft crackle pops rather than a continuous hiss
  _scheduleFireCrackles(){
    if(!this._ambienceActive) return;
    const level = this._fireLevel || 0;
    if(this.ctx && level > 0.02 && !this.muted && Math.random() < 0.5){
      this._playFireCrackle(level);
    }
    const nextDelay = 110 + Math.random()*260;
    this._fireTimer = setTimeout(() => this._scheduleFireCrackles(), nextDelay);
  }

  _playFireCrackle(level){
    const t0 = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.05);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 450 + Math.random()*900;
    const g = this.ctx.createGain();
    const peak = (0.014 + Math.random()*0.028) * level;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak), t0+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+0.06);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0+0.07);
  }

  setRainLevel(level){ this._rainLevel = level; } // 0..1, thins the droplets out as rain "stops"
  setFireLevel(level){ this._fireLevel = level; } // 0..1, grows the crackle as the fire catches
}
