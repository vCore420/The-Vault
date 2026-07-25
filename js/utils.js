/*
 * utils.js
 * Seeded RNG, math/easing helpers, feature detection, and the shared Tweens animation runner.
 * No dependencies.
 */
const Utils = (() => {
  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class RNG{
    constructor(seed){ this.seed = seed >>> 0; this._f = mulberry32(this.seed); }
    float(){ return this._f(); }
    range(min, max){ return min + this._f() * (max - min); }
    int(min, max){ return Math.floor(this.range(min, max + 1)); }
    chance(p){ return this._f() < p; }
    pick(arr){ return arr[Math.floor(this._f() * arr.length)]; }
    shuffle(arr){
      const a = arr.slice();
      for(let i = a.length - 1; i > 0; i--){
        const j = Math.floor(this._f() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    // draws `count` unique items from pool (pool must have length >= count)
    drawUnique(pool, count){ return this.shuffle(pool).slice(0, count); }
  }

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function smoothstep(t){ return t * t * (3 - 2 * t); }
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function easeInOutQuad(t){ return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
  function easeOutBack(t){ const c1=1.70158, c3=c1+1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); }
  function degToRad(d){ return d * Math.PI / 180; }

  function seedFromString(str){
    let h = 1779033703 ^ str.length;
    for(let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0);
  }

  function makeSeed(){
    return (Date.now() % 2147483647) ^ Math.floor(Math.random() * 2147483647);
  }

  function prefersReducedMotion(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isTouchDevice(){
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }

  function fmtTime(ms){
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  // Small shared tween runner used by door swings, light ramps, the drawer
  // slide, camera nudges, and UI transitions alike — one clock, one place
  // that respects prefers-reduced-motion.
  class Tweens{
    constructor(){ this.list = []; }
    add({duration, onUpdate, onComplete, easing}){
      const reduced = prefersReducedMotion();
      const d = reduced ? Math.min(duration, 0.18) : duration;
      this.list.push({ duration: Math.max(0.001, d), elapsed: 0, onUpdate, onComplete, easing: easing || easeOutCubic });
      return this.list[this.list.length - 1];
    }
    update(dt){
      for(let i = this.list.length - 1; i >= 0; i--){
        const tw = this.list[i];
        tw.elapsed += dt;
        const p = clamp(tw.elapsed / tw.duration, 0, 1);
        const e = tw.easing(p);
        if(tw.onUpdate) tw.onUpdate(e, p);
        if(p >= 1){
          if(tw.onComplete) tw.onComplete();
          this.list.splice(i, 1);
        }
      }
    }
  }

  return {
    RNG, clamp, lerp, smoothstep, easeOutCubic, easeInOutQuad, easeOutBack,
    degToRad, seedFromString, makeSeed, prefersReducedMotion, isTouchDevice, fmtTime,
    Tweens
  };
})();
