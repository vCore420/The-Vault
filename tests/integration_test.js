'use strict';
const fs = require('fs');
const THREE_STUB = require('./three_stub.js');

const order = ['utils','audio','generator','textures','world','player','interaction','ui','save','game'];
const scriptContent = order.map(n => fs.readFileSync('../js/'+n+'.js','utf8')).join('\n');


function makeCtx(){
  const store = {};
  return new Proxy({}, {
    get(t,p){ if(p in store) return store[p];
      if(p==='createRadialGradient'||p==='createLinearGradient') return () => ({addColorStop(){}});
      return () => {}; },
    set(t,p,v){ store[p]=v; return true; }
  });
}
function fakeCanvasEl(){ return { width:0,height:0, getContext:()=>makeCtx(), style:{}, addEventListener:()=>{}, requestPointerLock:()=>{} }; }

// DOM stub with just enough real behavior (listeners, dataset, a simple
// appendChild-tracked tree, and a [data-key="x"] querySelector) to exercise
// the schema-driven settings panel, which builds real elements at runtime.
const registry = {};
function fakeDomEl(id){
  const classSet = new Set();
  const el = {
    id,
    _listeners: {},
    children: [],
    dataset: {},
    value: '',
    addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
    click(){ (this._listeners['click']||[]).forEach(fn => fn({})); },
    dispatchInput(){ (this._listeners['input']||[]).forEach(fn => fn({})); },
    classList: {
      add(...c){ c.forEach(x=>classSet.add(x)); },
      remove(...c){ c.forEach(x=>classSet.delete(x)); },
      toggle(c,force){ const has=classSet.has(c); const want = force===undefined ? !has : force; want?classSet.add(c):classSet.delete(c); return want; },
      contains(c){ return classSet.has(c); }
    },
    setAttribute(){}, getAttribute(){ return null; },
    style: {}, textContent:'', innerHTML:'',
    getBoundingClientRect:()=>({left:0,right:400,top:0,bottom:400}),
    requestPointerLock(){},
    appendChild(child){ this.children.push(child); child._parent = this; return child; },
    querySelector(sel){
      const m = sel.match(/\[data-key="([^"]+)"\]/);
      if(!m) return null;
      const key = m[1];
      const search = (node) => {
        for(const c of node.children){
          if(c.dataset && c.dataset.key === key) return c;
          const found = search(c);
          if(found) return found;
        }
        return null;
      };
      return search(this);
    }
  };
  registry[id] = el;
  return el;
}

let rafCallback = null;
global.requestAnimationFrame = fn => { rafCallback = fn; return 1; };
global.window = {
  matchMedia: () => ({matches:false}),
  addEventListener: () => {},
  AudioContext: function(){ this.currentTime=0; this.state='running'; this.destination={};
    this.createGain=()=>({gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}},connect(){}});
    this.createOscillator=()=>({type:'sine',frequency:{value:0,setValueAtTime(){}},detune:{value:0},connect(){},start(){},stop(){}});
    this.createBiquadFilter=()=>({type:'',frequency:{value:0,setValueAtTime(){},linearRampToValueAtTime(){}},Q:{value:0},connect(){}});
    this.createBuffer=(ch,len)=>({getChannelData:()=>new Float32Array(Math.max(1,len))});
    this.createBufferSource=()=>({buffer:null,loop:false,connect(){},start(){},stop(){}});
    this.resume=()=>{};
  },
  devicePixelRatio:1, innerWidth:800, innerHeight:600, requestAnimationFrame: (fn)=>global.requestAnimationFrame(fn),
  confirm: () => true
};
global.document = {
  getElementById: (id) => registry[id] || fakeDomEl(id),
  addEventListener: () => {},
  createElement: (tag) => tag === 'canvas' ? fakeCanvasEl() : fakeDomEl(undefined),
  readyState: 'loading',
  exitPointerLock: () => {},
  pointerLockElement: null
};
try { Object.defineProperty(global, 'navigator', { value:{maxTouchPoints:0}, configurable:true }); } catch(e){}
global.THREE = THREE_STUB;
global.performance = { now: () => Date.now() };

// pre-register the render-canvas element
registry['render-canvas'] = fakeCanvasEl();
registry['render-canvas'].requestPointerLock = () => {};

const harness = `
(async () => {
  const errors = [];
  function check(cond, msg){ if(!cond) errors.push(msg); }

  try{ Game.init(); }
  catch(e){ errors.push('Game.init threw: '+e.stack); }

  await new Promise(r => setTimeout(r, 10));
  for(let i=0;i<5;i++){ if(rafCallback){ const fn=rafCallback; rafCallback=null; fn(); } }

  // --- click "Enter the Vault" -> should OPEN SETTINGS, not start immediately ---
  try{ document.getElementById('begin-btn').click(); }
  catch(e){ errors.push('begin-btn click threw: '+e.stack); }
  check(!document.getElementById('settings-modal').classList.contains('hidden'),
    'settings modal did not open after clicking begin-btn');
  check(document.getElementById('settings-fields').children.length > 0,
    'settings fields were not rendered');

  // --- Randomize should not throw and should re-render fields ---
  try{ document.getElementById('settings-randomize-btn').click(); }
  catch(e){ errors.push('settings-randomize-btn click threw: '+e.stack); }

  // --- confirm settings -> should actually start the game ---
  try{ document.getElementById('settings-begin-btn').click(); }
  catch(e){ errors.push('settings-begin-btn click threw: '+e.stack); }
  for(let i=0;i<30;i++){ if(rafCallback){ const fn=rafCallback; rafCallback=null; fn(); } }
  check(document.getElementById('settings-modal').classList.contains('hidden'),
    'settings modal did not close after Begin');

  // --- reset button mid-game should open settings (not silently do nothing) ---
  try{ document.getElementById('reset-btn').click(); }
  catch(e){ errors.push('reset-btn click threw: '+e.stack); }
  check(!document.getElementById('settings-modal').classList.contains('hidden'),
    'settings modal did not open after clicking reset-btn mid-game');

  // --- Cancel from reset should close settings WITHOUT starting a fresh game ---
  try{ document.getElementById('settings-cancel-btn').click(); }
  catch(e){ errors.push('settings-cancel-btn click threw: '+e.stack); }
  check(document.getElementById('settings-modal').classList.contains('hidden'),
    'settings modal did not close after Cancel');

  // --- reset -> Begin should actually rebuild the world (world disposal + rebuild path) ---
  try{ document.getElementById('reset-btn').click(); document.getElementById('settings-begin-btn').click(); }
  catch(e){ errors.push('reset -> begin threw: '+e.stack); }
  for(let i=0;i<20;i++){ if(rafCallback){ const fn=rafCallback; rafCallback=null; fn(); } }

  // --- mute button should toggle audio.muted and update its own label ---
  const muteBtn = document.getElementById('mute-btn');
  const before = muteBtn.textContent;
  try{ muteBtn.click(); }
  catch(e){ errors.push('mute-btn click threw: '+e.stack); }
  check(muteBtn.textContent !== before, 'mute-btn label did not change after clicking it');

  // --- New Vault (win screen) should also open settings ---
  try{ document.getElementById('new-vault-btn').click(); }
  catch(e){ errors.push('new-vault-btn click threw: '+e.stack); }
  check(!document.getElementById('settings-modal').classList.contains('hidden'),
    'settings modal did not open after clicking new-vault-btn');
  try{ document.getElementById('settings-begin-btn').click(); }
  catch(e){ errors.push('settings-begin-btn (from win) click threw: '+e.stack); }
  for(let i=0;i<20;i++){ if(rafCallback){ const fn=rafCallback; rafCallback=null; fn(); } }

  try{
    window.innerWidth = 1024; window.innerHeight = 768;
  }catch(e){ errors.push('resize sim threw: '+e.stack); }

  console.log('INTEGRATION ERRORS:', errors.length);
  errors.forEach(e => console.log(' -', e));
  process.exit(0);
})();
`;

eval(scriptContent + '\n' + harness);
