// A deliberately minimal stand-in for the subset of the THREE.js r128 API
// this project touches. Good enough to actually RUN the game's scene-graph
// construction and state machines offline (reparenting, tweens, counts),
// even though it draws nothing. This is a test harness, not shipped code.
'use strict';

class Vec3 {
  constructor(x=0,y=0,z=0){ this.x=x; this.y=y; this.z=z; }
  set(x,y,z){ this.x=x; this.y=y; this.z=z; return this; }
  copy(v){ this.x=v.x; this.y=v.y; this.z=v.z; return this; }
  clone(){ return new Vec3(this.x,this.y,this.z); }
}
class Rot3 {
  constructor(){ this.x=0; this.y=0; this.z=0; this.order='XYZ'; }
  set(x,y,z){ this.x=x; this.y=y; this.z=z; return this; }
  copy(r){ this.x=r.x; this.y=r.y; this.z=r.z; return this; }
  clone(){ const r = new Rot3(); r.set(this.x,this.y,this.z); return r; }
}
class Vec2 { constructor(x=0,y=0){ this.x=x; this.y=y; } set(x,y){this.x=x;this.y=y;return this;} }

class Object3D {
  constructor(){
    this.position = new Vec3();
    this.rotation = new Rot3();
    this.scale = new Vec3(1,1,1);
    this.userData = {};
    this.visible = true;
    this.children = [];
    this.parent = null;
    this.name = '';
  }
  add(...objs){ objs.forEach(o => { if(o.parent) o.parent.remove(o); o.parent=this; this.children.push(o); }); return this; }
  remove(...objs){ objs.forEach(o => { const i=this.children.indexOf(o); if(i>=0){ this.children.splice(i,1); o.parent=null; } }); return this; }
  traverse(fn){ fn(this); this.children.slice().forEach(c => c.traverse(fn)); }
  clone(){ const o = new this.constructor(); o.position.copy(this.position); return o; }
  // Simplified stand-in: ignores actual rotation and just returns "forward"
  // (-Z), which is enough to exercise the fallback floor-projection code
  // path in tests without a real transform pipeline.
  getWorldDirection(target){ target = target || new Vec3(); target.set(0,0,-1); return target; }
}
class Group extends Object3D {}
class Mesh extends Object3D { constructor(geo,mat){ super(); this.geometry=geo; this.material=mat; } }
class Sprite extends Object3D { constructor(mat){ super(); this.material=mat; } }
class Scene extends Object3D { constructor(){ super(); this.fog=null; } }

function Geo(name, paramNames){
  return class{
    constructor(...args){
      this.name = name; this.args = args;
      this.parameters = {};
      if(paramNames) paramNames.forEach((p,i) => { this.parameters[p] = args[i]; });
    }
    dispose(){} translate(){return this;} rotateX(){return this;}
  };
}
const BoxGeometry = Geo('box', ['width','height','depth']);
const CylinderGeometry = Geo('cyl', ['radiusTop','radiusBottom','height']);
const PlaneGeometry = Geo('plane', ['width','height']);
const CircleGeometry = Geo('circle', ['radius']);
const SphereGeometry = Geo('sphere', ['radius']);
const ConeGeometry = Geo('cone', ['radius','height']);
const TorusGeometry = Geo('torus', ['radius','tube']);
class ExtrudeGeometry { constructor(shape, opts){ this.shape=shape; this.opts=opts; } dispose(){} translate(){return this;} }

class Shape {
  constructor(){ this.calls=[]; }
  moveTo(x,y){ this.calls.push(['moveTo',x,y]); return this; }
  lineTo(x,y){ this.calls.push(['lineTo',x,y]); return this; }
  closePath(){ this.calls.push(['closePath']); return this; }
  absarc(cx,cy,r,a0,a1,cw){ this.calls.push(['absarc',cx,cy,r]); return this; }
  absellipse(cx,cy,rx,ry){ this.calls.push(['absellipse',cx,cy,rx,ry]); return this; }
}

function Mat(name){
  return class {
    constructor(opts){ this.name=name; Object.assign(this, opts||{}); }
    dispose(){}
  };
}
const MeshStandardMaterial = Mat('standard');
const MeshBasicMaterial = Mat('basic');
const SpriteMaterial = Mat('sprite');

class CanvasTexture {
  constructor(canvas){ this.canvas=canvas; this.needsUpdate=true; this.wrapS=null; this.wrapT=null;
    this.repeat={ set:(x,y)=>{ this._rx=x; this._ry=y; } }; this.offset={x:0,y:0}; this.anisotropy=1; }
  dispose(){}
}

class PerspectiveCamera extends Object3D {
  constructor(fov,aspect,near,far){ super(); this.fov=fov; this.aspect=aspect; this.near=near; this.far=far; }
  updateProjectionMatrix(){}
}

class WebGLRenderer {
  constructor(opts){ this.domElement = (opts&&opts.canvas) || {}; this.shadowMap={enabled:false}; }
  setPixelRatio(){} setSize(){} render(){}
}

class Light extends Object3D { constructor(color,intensity){ super(); this.color=color; this.intensity=intensity; } }
class AmbientLight extends Light {}
class HemisphereLight extends Light { constructor(c1,c2,i){ super(c1,i); this.groundColor=c2; } }
class PointLight extends Light { constructor(color,intensity,distance,decay){ super(color,intensity); this.distance=distance; this.decay=decay; } }

class FogExp2 { constructor(color,density){ this.color=color; this.density=density; } }

class Raycaster {
  constructor(){ this.far = Infinity; this._hits = []; }
  setFromCamera(){}
  intersectObject(){ return this._hits; }
}

class Clock {
  constructor(){ this._last = Date.now(); this._start = this._last; }
  getDelta(){ const now=Date.now(); const d=(now-this._last)/1000; this._last=now; return d; }
  getElapsedTime(){ return (Date.now()-this._start)/1000; }
}

module.exports = {
  Vector2:Vec2, Vector3:Vec3,
  Object3D, Group, Mesh, Sprite, Scene,
  BoxGeometry, CylinderGeometry, PlaneGeometry, CircleGeometry, SphereGeometry, ConeGeometry, TorusGeometry, ExtrudeGeometry,
  Shape,
  MeshStandardMaterial, MeshBasicMaterial, SpriteMaterial,
  CanvasTexture,
  PerspectiveCamera, WebGLRenderer,
  AmbientLight, HemisphereLight, PointLight,
  FogExp2, Raycaster, Clock,
  RepeatWrapping:'repeat', DoubleSide:'double', AdditiveBlending:'add', PCFSoftShadowMap:'pcfsoft'
};
