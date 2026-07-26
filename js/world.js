/*
 * world.js
 * VaultWorld — builds the room, lighting, furniture, the box wall, scattered containers, the key table, and all per-frame environment animation.
 * Depends on: Utils, Generator, Textures, THREE (global, loaded via CDN in index.html).
 */
const ROOM = { w: 18, d: 13, h: 5.2 };

class VaultWorld {
  constructor(puzzle, tweens, rng){
    this.puzzle = puzzle;
    this.tweens = tweens;
    this.rng = rng;
    this.root = new THREE.Group();
    this.boxUnits = new Map();
    this.keyUnits = new Map();
    this.envApplied = new Set();
    this.envState = { lampOn:false, fireOn:false, rainLevel:1, clockTicks:0, plants:0, photos:0, rugs:0 };
    this.mementoCount = 0;
    this.clockHands = null;
    this.fireLight = null;
    this.fireSprite = null;
    this.extraLamp = null;
    this.obstacles = [];
    this.roomBounds = { minX:-ROOM.w/2+0.7, maxX:ROOM.w/2-0.7, minZ:-ROOM.d/2+1.1, maxZ:ROOM.d/2-0.7 };

    this._materials();
    this._buildShell();
    this._buildLighting();
    this._buildWindow();
    this._buildFireplace();
    this._buildClock();
    this._buildStarterDecor();
    this._buildKeyTable();
    this._buildSortingTable(-3.2, ROOM.d/2 - 0.55, 0);
    this._buildBoxWall();
    this._buildScatteredContainers();
    this._buildMementoShelf();
  }

  static tag(obj, kind, id){
    obj.traverse(o => { o.userData.kind = kind; o.userData.id = id; });
  }

  _materials(){
    this.mat = {
      floor: new THREE.MeshStandardMaterial({ map: Textures.woodTexture(0x5a3a22, 0x2c1a0e, {repeat:[7,5]}), roughness:0.75, metalness:0.04 }),
      wall: new THREE.MeshStandardMaterial({ map: Textures.plasterTexture(0x4a3320), roughness:0.9, metalness:0.02 }),
      ceiling: new THREE.MeshStandardMaterial({ color:0x2a1e10, roughness:0.92 }),
      trim: new THREE.MeshStandardMaterial({ color:0x30200f, roughness:0.65, metalness:0.12 }),
      brass: new THREE.MeshStandardMaterial({ color:0xa9814c, roughness:0.32, metalness:0.88 }),
      brassBright: new THREE.MeshStandardMaterial({ color:0xd8ac6a, roughness:0.2, metalness:0.92 }),
      brassFrame: new THREE.MeshStandardMaterial({ color:0x8f7248, roughness:0.58, metalness:0.5 }),
      woodFurniture: new THREE.MeshStandardMaterial({ map: Textures.woodTexture(0x4a2f1a, 0x2a1a0c, {repeat:[1,1]}), roughness:0.6, metalness:0.05 }),
      wainscot: new THREE.MeshStandardMaterial({ map: Textures.woodTexture(0x3c2717, 0x20140b, {repeat:[6,1]}), roughness:0.55, metalness:0.05 }),
      felt: new THREE.MeshStandardMaterial({ color:0x3a1f28, roughness:0.95 }),
      glass: new THREE.MeshStandardMaterial({ color:0x1a2430, roughness:0.08, metalness:0.1, transparent:true, opacity:0.4 })
    };

    // shared, reused across every wall box (60-90 of them) — only the
    // materials differ per box, keeping geometry count flat regardless of
    // vault size.
    this._wallCells = this._computeWallGrid();
    const { cellW, cellH } = this._wallCells;
    this.sharedGeo = {
      wallFrame: new THREE.BoxGeometry(cellW*0.94, cellH*0.94, 0.05),
      wallPanel: new THREE.BoxGeometry(cellW*0.74, cellH*0.7, 0.06),
      knob: new THREE.SphereGeometry(0.017, 8, 6)
    };
  }

  _computeWallGrid(){
    const n = this.puzzle.wallCount;
    const cols = Math.ceil(Math.sqrt(n * (ROOM.w/9)));
    const rows = Math.ceil(n / cols);
    const cellW = Math.min(0.86, (ROOM.w - 1.6) / cols);
    const cellH = Math.min(0.56, (ROOM.h - 1.8) / rows);
    return { cols, rows, cellW, cellH };
  }

  _addObstacle(minX,maxX,minZ,maxZ){ this.obstacles.push({minX,maxX,minZ,maxZ}); }

  _buildShell(){
    const { w, d, h } = ROOM;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), this.mat.floor);
    floor.position.set(0, -0.1, 0);
    floor.receiveShadow = true;
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), this.mat.ceiling);
    ceiling.position.set(0, h + 0.1, 0);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), this.mat.wall);
    backWall.position.set(0, h/2, -d/2 - 0.1);
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), this.mat.wall);
    frontWall.position.set(0, h/2, d/2 + 0.1);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, d), this.mat.wall);
    leftWall.position.set(-w/2 - 0.1, h/2, 0);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, d), this.mat.wall);
    rightWall.position.set(w/2 + 0.1, h/2, 0);
    this.root.add(floor, ceiling, backWall, frontWall, leftWall, rightWall);

    for(let i=0;i<5;i++){
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, d - 0.6), this.mat.trim);
      beam.position.set(Utils.lerp(-w/2+1.4, w/2-1.4, i/4), h - 0.14, 0);
      this.root.add(beam);
    }

    // architectural trim — baseboard, wainscot band, chair rail, and crown
    // molding — on every wall except the box wall, which is fully occupied
    // by the grid and would hide it anyway
    this._addWallTrim(w - 0.3, 0, d/2 - 0.02, 0);
    this._addWallTrim(d - 0.3, -w/2 + 0.02, 0, Math.PI/2);
    this._addWallTrim(d - 0.3, w/2 - 0.02, 0, Math.PI/2);
  }

  _addWallTrim(length, wallX, wallZ, rotY){
    const group = new THREE.Group();
    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(length, 0.14, 0.045), this.mat.trim);
    baseboard.position.y = 0.07;
    const wainscot = new THREE.Mesh(new THREE.BoxGeometry(length, 0.86, 0.028), this.mat.wainscot);
    wainscot.position.y = 0.14 + 0.86/2;
    const chairRail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.06, 0.05), this.mat.trim);
    chairRail.position.y = 0.14 + 0.86 + 0.03;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(length, 0.1, 0.055), this.mat.trim);
    crown.position.y = ROOM.h - 0.08;
    group.add(baseboard, wainscot, chairRail, crown);
    group.position.set(wallX, 0, wallZ);
    group.rotation.y = rotY;
    this.root.add(group);
  }

  _buildLighting(){
    // brighter, warmer baseline than before — the vault should read clearly
    // even before any lamps are switched on by progress.
    this.root.add(new THREE.AmbientLight(0x8a7050, 0.88));
    const hemi = new THREE.HemisphereLight(0x9c8560, 0x241a10, 0.78);
    this.root.add(hemi);

    // a soft warm shaft of light from a ceiling grate — the room's "sunlight",
    // the only shadow-casting light so the softness stays affordable. Given a
    // visible grate fixture so it doesn't read as a light floating in mid-air.
    const sky = new THREE.PointLight(0xffdcae, 1.35, 15, 1.7);
    sky.position.set(-1.2, ROOM.h - 0.4, -1.0);
    sky.castShadow = true;
    if(sky.shadow){
      sky.shadow.mapSize.width = 1024; sky.shadow.mapSize.height = 1024;
      sky.shadow.radius = 4; sky.shadow.bias = -0.002;
    }
    this.root.add(sky);
    this.skyLight = sky;

    const grate = new THREE.Group();
    const grateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.46), this.mat.trim);
    grate.add(grateFrame);
    for(let i=-1;i<=1;i++){
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.018, 0.025), this.mat.trim);
      bar1.position.set(0, -0.01, i*0.15);
      grate.add(bar1);
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.018, 0.44), this.mat.trim);
      bar2.position.set(i*0.15, -0.01, 0);
      grate.add(bar2);
    }
    grate.position.set(sky.position.x, ROOM.h - 0.06, sky.position.z);
    this.root.add(grate);

    // sconces kept well clear of the box wall — general room coziness, not
    // wall illumination (that's the wash lights below), so they never create
    // a hot, over-reflective patch on nearby boxes
    const sconcePositions = [
      [-ROOM.w/2+0.5, 2.5, -1.4], [ROOM.w/2-0.5, 2.5, 1.2],
      [-ROOM.w/2+0.5, 2.5, 3.4], [ROOM.w/2-0.5, 2.5, -3.0]
    ];
    this.sconceLights = [];
    sconcePositions.forEach(p => {
      const l = new THREE.PointLight(0xffb878, 0.95, 7, 2);
      l.position.set(p[0], p[1], p[2]);
      this.root.add(l);

      // a physical wall bracket + shade housing the bulb, so the light source
      // reads as a fixture rather than a sphere floating near the wall
      const facingSign = p[0] < 0 ? 1 : -1;
      const fixture = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 8), this.mat.brass);
      arm.rotation.z = Math.PI/2;
      arm.position.set(facingSign*0.065, 0, 0);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 12, 1, true),
        new THREE.MeshStandardMaterial({ color:0xd8b878, side:THREE.DoubleSide, roughness:0.55, emissive:0x804010, emissiveIntensity:0.5 }));
      shade.rotation.z = facingSign > 0 ? Math.PI/2 : -Math.PI/2;
      shade.position.set(facingSign*0.13, 0, 0);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6),
        new THREE.MeshStandardMaterial({ color:0xffdca0, emissive:0xffb060, emissiveIntensity:1.3 }));
      bulb.position.set(facingSign*0.13, 0, 0);
      fixture.add(arm, shade, bulb);
      fixture.position.copy(l.position);
      this.root.add(fixture);
      this.sconceLights.push(l);
    });

    // a dedicated, evenly-spaced wash for the box wall — set back far enough,
    // and with a long soft falloff, that no single box ever sits close enough
    // to one light to blow out into a hot, over-reflective spot
    this.wallWashLights = [];
    const washCount = Math.max(4, Math.round(ROOM.w / 4));
    const washZ = -ROOM.d/2 + 2.0;
    for(let i=0;i<washCount;i++){
      const wx = Utils.lerp(-ROOM.w/2+2.2, ROOM.w/2-2.2, washCount===1?0.5:i/(washCount-1));
      const wl = new THREE.PointLight(0xffc088, 0.5, 10, 1.35);
      wl.position.set(wx, ROOM.h*0.6, washZ);
      this.root.add(wl);
      this.wallWashLights.push(wl);
    }

    const lampGroup = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 14), this.mat.woodFurniture);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 8), this.mat.brass);
    pole.position.y = 0.31;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.22, 16, 1, true), new THREE.MeshStandardMaterial({ color:0xd8b878, emissive:0x000000, emissiveIntensity:0, side:THREE.DoubleSide, roughness:0.55 }));
    shade.position.y = 0.62;
    const lampLight = new THREE.PointLight(0xffab60, 0, 4.5, 2);
    lampLight.position.y = 0.6;
    lampGroup.add(base, pole, shade, lampLight);
    lampGroup.position.set(ROOM.w/2 - 0.7, 0, ROOM.d/2 - 0.8);
    this.root.add(lampGroup);
    this.extraLamp = { light: lampLight, shade };
    this._addObstacle(lampGroup.position.x-0.2, lampGroup.position.x+0.2, lampGroup.position.z-0.2, lampGroup.position.z+0.2);
  }

  _buildWindow(){
    const frameW = 1.5, frameH = 1.9;
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color:0xb8ad9c, roughness:0.7 });
    const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.16, frameH+0.22, frameW+0.22), this.mat.trim);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, frameH, frameW), this.mat.trim);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(frameW-0.16, frameH-0.16), this.mat.glass);
    pane.rotation.y = Math.PI/2;
    pane.position.x = 0.02;
    const rainTex = Textures.rainTexture();
    const rainPane = new THREE.Mesh(new THREE.PlaneGeometry(frameW-0.2, frameH-0.2), new THREE.MeshBasicMaterial({ map:rainTex, transparent:true, opacity:0.7, side:THREE.DoubleSide }));
    rainPane.rotation.y = Math.PI/2;
    rainPane.position.x = 0.04;
    // 2x3 muntin grid
    for(let i=1;i<3;i++){
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, frameH-0.16, 0.025), this.mat.trim);
      bar.position.set(0.02, 0, -((frameW-0.16)/2) + i*((frameW-0.16)/3));
      group.add(bar);
    }
    for(let i=1;i<3;i++){
      const hbar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, frameW-0.16), this.mat.trim);
      hbar.position.set(0.02, -((frameH-0.16)/2) + i*((frameH-0.16)/3), 0);
      group.add(hbar);
    }
    // stone sill, protruding to hold the window seat cushion below
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, frameW+0.32), stoneMat);
    sill.position.set(0.12, -frameH/2-0.05, 0);
    group.add(sill);

    // curtains, tied back either side
    const curtainMat = new THREE.MeshStandardMaterial({ color:0x5c2430, roughness:0.88, side:THREE.DoubleSide });
    [-1,1].forEach(side => {
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.32, frameH+0.55), curtainMat);
      curtain.rotation.y = Math.PI/2;
      curtain.rotation.z = side*0.05;
      curtain.position.set(0.05, 0.15, side*(frameW/2+0.14));
      group.add(curtain);
      const tieback = new THREE.Mesh(new THREE.TorusGeometry(0.055,0.011,6,14), this.mat.brassBright);
      tieback.rotation.y = Math.PI/2;
      tieback.position.set(0.07, -0.25, side*(frameW/2+0.1));
      group.add(tieback);
      const rodEnd = new THREE.Mesh(new THREE.SphereGeometry(0.025,8,6), this.mat.brassFrame);
      rodEnd.position.set(0.02, frameH/2+0.18, side*(frameW/2+0.2));
      group.add(rodEnd);
    });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012, frameW+0.4, 8), this.mat.brassFrame);
    rod.rotation.z = Math.PI/2;
    rod.position.set(0.02, frameH/2+0.18, 0);
    group.add(rod);

    group.add(outerFrame, frame, pane, rainPane);
    group.position.set(ROOM.w/2 + 0.06, 2.35, -3.6);
    this.root.add(group);
    this.rainTex = rainTex;
    this.rainMat = rainPane.material;
    const outside = new THREE.PointLight(0xa8c0d8, 0.5, 4, 2);
    outside.position.set(ROOM.w/2 - 0.3, 2.3, -3.6);
    this.root.add(outside);

    // a cozy window seat below
    const seatW = 0.46, seatSpan = frameW + 0.3;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(seatW, 0.42, seatSpan), this.mat.woodFurniture);
    seat.position.set(ROOM.w/2 - seatW/2 - 0.05, 0.21, -3.6);
    this.root.add(seat);
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(seatW-0.04, 0.09, seatSpan-0.06), new THREE.MeshStandardMaterial({ color:0x6b3a4a, roughness:0.9 }));
    cushion.position.set(ROOM.w/2 - seatW/2 - 0.05, 0.47, -3.6);
    this.root.add(cushion);
    [-1,1].forEach(s => {
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.14,0.16), new THREE.MeshStandardMaterial({ color: s<0?0xc8965a:0x3a6b55, roughness:0.85 }));
      pillow.position.set(ROOM.w/2-seatW/2-0.02, 0.58, s*(seatSpan/2-0.18));
      pillow.rotation.y = s*0.3;
      this.root.add(pillow);
    });
    this._addObstacle(ROOM.w/2-seatW-0.15, ROOM.w/2, -3.6-seatSpan/2, -3.6+seatSpan/2);
  }

  _buildFireplace(){
    const group = new THREE.Group();
    const marbleMat = new THREE.MeshStandardMaterial({ map: Textures.marbleTexture(0xe4dccb, 0x9c8f78), roughness:0.4, metalness:0.04 });
    const surround = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.28), marbleMat);
    const hearthOpening = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.24), new THREE.MeshStandardMaterial({ color:0x120b07, roughness:0.9 }));
    hearthOpening.position.z = 0.03;
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.09, 0.36), marbleMat);
    mantel.position.y = 0.66;
    const hearthFloor = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.04, 0.46), marbleMat);
    hearthFloor.position.set(0, 0.02, 0.34);
    group.add(hearthFloor);

    // corbels supporting the mantel
    [-0.72, 0.72].forEach(x => {
      const corbel = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.13, 8), marbleMat);
      corbel.rotation.x = Math.PI;
      corbel.position.set(x, 0.585, 0.16);
      group.add(corbel);
    });

    for(let i=0;i<3;i++){
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), this.mat.trim);
      log.rotation.z = Math.PI/2;
      log.position.set((i-1)*0.08, -0.28, 0.05);
      group.add(log);
    }

    // andirons cradling the logs
    [-0.2, 0.2].forEach(x => {
      const andiron = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 12, Math.PI), this.mat.brassFrame);
      andiron.rotation.y = Math.PI/2;
      andiron.position.set(x, -0.18, 0.1);
      group.add(andiron);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.1,6), this.mat.brassFrame);
      foot.position.set(x, -0.23, 0.14);
      group.add(foot);
    });

    // fireplace tools leaning on a small stand
    const toolStand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.02, 10), this.mat.brassFrame);
    toolStand.position.set(0.58, -0.36, 0.16);
    group.add(toolStand);
    [{len:0.42, tilt:0.16, head:'hook'}, {len:0.36, tilt:-0.11, head:'ball'}].forEach((t,i) => {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,t.len,6), this.mat.brassFrame);
      handle.position.set(0.58+i*0.035, -0.36+Math.cos(t.tilt)*t.len/2, 0.16+Math.sin(t.tilt)*t.len/2);
      handle.rotation.x = t.tilt;
      group.add(handle);
      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.014,8,6), this.mat.brassBright);
      headMesh.position.set(0.58+i*0.035, -0.36+Math.cos(t.tilt)*t.len, 0.16+Math.sin(t.tilt)*t.len);
      group.add(headMesh);
    });

    // framed art above the mantel
    const artTex = Textures.abstractCardTexture(0x4a3a2c, this.rng);
    const artFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.46, 0.03), this.mat.brassFrame);
    artFrame.position.set(0, 1.02, 0.135);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.38), new THREE.MeshStandardMaterial({ map:artTex, roughness:0.75 }));
    art.position.set(0, 1.02, 0.152);
    group.add(artFrame, art);

    // a pair of candlesticks flanking the hearth
    [-0.62, 0.62].forEach(x => {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.02,0.14,10), this.mat.brassBright);
      stick.position.set(x, 0.66+0.045+0.07, 0.08);
      group.add(stick);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.017,0.012,0.02,10), this.mat.brassBright);
      cup.position.set(x, 0.66+0.045+0.145, 0.08);
      group.add(cup);
    });

    const glowTex = Textures.fireGlowTexture();
    const fireSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xffffff, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
    fireSprite.scale.set(0.7, 0.7, 1);
    fireSprite.position.set(0, -0.18, 0.15);
    const fireLight = new THREE.PointLight(0xff8a3c, 0, 3.5, 2);
    fireLight.position.set(0, -0.1, 0.2);
    group.add(surround, hearthOpening, mantel, fireSprite, fireLight);
    group.position.set(0, 0.75, ROOM.d/2 - 0.02);
    this.root.add(group);
    this.fireSprite = fireSprite;
    this.fireLight = fireLight;
    this._addObstacle(-0.9, 0.9, ROOM.d/2-0.5, ROOM.d/2+0.2);
  }

  _buildClock(){
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshStandardMaterial({ map: Textures.clockFaceTexture(), roughness:0.5 }));
    face.position.set(1.1, 3.0, ROOM.d/2 - 0.03);
    face.rotation.y = Math.PI;
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.005), this.mat.trim);
    hourHand.position.set(0, 0.05, 0.01);
    const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.16, 0.005), this.mat.trim);
    minuteHand.position.set(0, 0.08, 0.012);
    face.add(hourHand, minuteHand);
    this.root.add(face);
    this.clockHands = { hourHand, minuteHand, ticks:0 };
  }

  _buildStarterDecor(){
    const rugW = 3.7, rugH = rugW * (320/448);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(rugW, rugH),
      new THREE.MeshStandardMaterial({ map: Textures.ornateRugTexture({}), roughness:0.92 }));
    rug.rotation.x = -Math.PI/2;
    rug.position.set(0.4, 0.006, 1.5);
    this.root.add(rug);

    this._addPlant(-ROOM.w/2+0.6, -ROOM.d/2+1.3);
    this._addPlant(ROOM.w/2-0.6, ROOM.d/2-1.3);

    this._buildBookshelf(ROOM.w/2 - 0.16, -5.0, -Math.PI/2);
    this._buildReadingNook(ROOM.w/2 - 1.15, ROOM.d/2 - 1.7);
    this._buildCurioCabinet(-ROOM.w/2 + 0.16, 1.8, Math.PI/2);
  }

  _buildBookshelf(x, z, rotY){
    const shelfGroup = new THREE.Group();
    const unitH = 2.9, unitW = 0.85, unitD = 0.3;
    const back = new THREE.Mesh(new THREE.BoxGeometry(unitW, unitH, 0.05), this.mat.woodFurniture);
    back.position.y = unitH/2;
    shelfGroup.add(back);
    const sideMat = this.mat.woodFurniture;
    [-unitW/2+0.02, unitW/2-0.02].forEach(sx => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.04, unitH, unitD), sideMat);
      side.position.set(sx, unitH/2, unitD/2 - 0.03);
      shelfGroup.add(side);
    });
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(unitW+0.08, 0.1, unitD+0.06), this.mat.trim);
    cornice.position.set(0, unitH - 0.02, unitD/2 - 0.03);
    shelfGroup.add(cornice);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(unitW+0.06, 0.1, unitD+0.05), this.mat.trim);
    plinth.position.set(0, 0.05, unitD/2 - 0.03);
    shelfGroup.add(plinth);

    const shelfYs = [0.35, 0.85, 1.35, 1.85, 2.35, 2.7];
    const bookPalette = [0x5c2430, 0x2f4d3a, 0x33385c, 0x6b4a26, 0x4a2f4a, 0x2f5c52, 0x7a3a2a];
    shelfYs.forEach((y, si) => {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(unitW-0.06, 0.035, unitD-0.04), this.mat.woodFurniture);
      plank.position.set(0, y, unitD/2 - 0.03 - 0.02);
      shelfGroup.add(plank);

      if(si === shelfYs.length - 1){
        // top shelf styled as a display ledge — a couple of curios, not books
        const globe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshStandardMaterial({ color:0x2f6b6a, roughness:0.4 }));
        globe.position.set(-0.2, y+0.11, unitD/2-0.15);
        shelfGroup.add(globe);
        const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.05,0.16,10), new THREE.MeshStandardMaterial({ color:0x8a6a3f, roughness:0.5 }));
        vase.position.set(0.22, y+0.1, unitD/2-0.15);
        shelfGroup.add(vase);
        return;
      }

      const nBooks = 5 + Math.floor(this.rng.range(0,4));
      let cx = -unitW/2 + 0.09;
      for(let i=0;i<nBooks;i++){
        const bw = 0.028 + this.rng.range(0,0.02);
        const bh = 0.16 + this.rng.range(0,0.09);
        const leaning = this.rng.chance(0.15) ? this.rng.range(-0.15,0.15) : 0;
        const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, unitD-0.09),
          new THREE.MeshStandardMaterial({ color: this.rng.pick(bookPalette), roughness:0.75 }));
        book.position.set(cx+bw/2, y+bh/2+0.02, unitD/2-0.05);
        book.rotation.z = leaning;
        shelfGroup.add(book);
        cx += bw + 0.006;
        if(cx > unitW/2-0.12) break;
      }
      // a couple of shelves get a small stack lying flat with a curio on top
      if(si === 1 || si === 3){
        const stackH = 0.05;
        const stack = new THREE.Mesh(new THREE.BoxGeometry(0.2, stackH, unitD-0.09), new THREE.MeshStandardMaterial({ color: this.rng.pick(bookPalette), roughness:0.75 }));
        stack.position.set(unitW/2-0.16, y+stackH/2+0.02, unitD/2-0.05);
        shelfGroup.add(stack);
        const curio = new THREE.Mesh(new THREE.ConeGeometry(0.035,0.07,8), new THREE.MeshStandardMaterial({ color:0x8a6a3f, roughness:0.45, metalness:0.4 }));
        curio.position.set(unitW/2-0.16, y+stackH+0.055, unitD/2-0.05);
        shelfGroup.add(curio);
      }
    });

    shelfGroup.position.set(x, 0, z);
    shelfGroup.rotation.y = rotY;
    this.root.add(shelfGroup);
    this._addObstacle(x-unitD-0.1, x+0.1, z-unitW/2-0.3, z+unitW/2+0.3);
  }

  _buildReadingNook(x, z){
    const group = new THREE.Group();
    const armMat = new THREE.MeshStandardMaterial({ color:0x3a5c52, roughness:0.85 });
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), armMat);
    seatBase.position.y = 0.175;
    group.add(seatBase);
    const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), armMat);
    seatCushion.position.y = 0.4;
    group.add(seatCushion);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.12), armMat);
    back.position.set(0, 0.6, -0.26);
    group.add(back);
    [-1,1].forEach(s => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.5), armMat);
      arm.position.set(s*0.28, 0.42, 0);
      group.add(arm);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.02,0.18,8), this.mat.woodFurniture);
      leg.position.set(s*0.22, 0.09, 0.2);
      group.add(leg);
      const leg2 = leg.clone(); leg2.position.z = -0.2; group.add(leg2);
    });
    group.rotation.y = Math.PI*0.15;
    group.position.set(x, 0, z);
    this.root.add(group);

    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.42, 12), this.mat.woodFurniture);
    table.position.set(x+0.55, 0.21, z+0.15);
    this.root.add(table);
    const bookOnTable = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.03,0.19), new THREE.MeshStandardMaterial({color:0x5c2430, roughness:0.8}));
    bookOnTable.position.set(x+0.55, 0.435, z+0.15);
    bookOnTable.rotation.y = 0.3;
    this.root.add(bookOnTable);
    const teacup = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.025,0.035,10), new THREE.MeshStandardMaterial({color:0xece0c8, roughness:0.4}));
    teacup.position.set(x+0.5, 0.465, z+0.05);
    this.root.add(teacup);

    this._addObstacle(x-0.5, x+0.75, z-0.5, z+0.5);
  }

  _buildCurioCabinet(x, z, rotY){
    const group = new THREE.Group();
    const w=0.7, h=1.7, d=0.32;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat.woodFurniture);
    body.position.y = h/2;
    group.add(body);
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(w-0.1, h-0.14), this.mat.glass);
    glassPane.position.set(0, h/2, d/2+0.001);
    group.add(glassPane);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(w+0.06, 0.08, d+0.05), this.mat.trim);
    cornice.position.y = h - 0.02;
    group.add(cornice);
    // a few small curios visible inside, on 2 internal shelves
    [0.55, 1.05].forEach((sy,i) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(w-0.12, 0.02, d-0.08), this.mat.woodFurniture);
      shelf.position.set(0, sy, 0);
      group.add(shelf);
      const trinket = new THREE.Mesh(new THREE.TorusGeometry(0.035,0.012,8,14), this.mat.brassBright);
      trinket.position.set(i===0?-0.15:0.1, sy+0.05, 0);
      group.add(trinket);
      const trinket2 = new THREE.Mesh(new THREE.SphereGeometry(0.04,10,8), new THREE.MeshStandardMaterial({color:0x6fa8c9, roughness:0.3}));
      trinket2.position.set(i===0?0.12:-0.15, sy+0.05, 0);
      group.add(trinket2);
    });
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    this.root.add(group);
    this._addObstacle(x-0.2, x+d+0.2, z-w/2-0.15, z+w/2+0.15);
  }

  _addPlant(x, z){
    const group = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 10), new THREE.MeshStandardMaterial({ color:0x8a5a3a, roughness:0.8 }));
    pot.position.y = 0.11;
    group.add(pot);
    const leafMat = new THREE.MeshStandardMaterial({ color:0x3a6b45, roughness:0.7 });
    for(let i=0;i<6;i++){
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.32, 6), leafMat);
      const ang = (i/6)*Math.PI*2;
      leaf.position.set(Math.cos(ang)*0.06, 0.36, Math.sin(ang)*0.06);
      leaf.rotation.set((Math.random()-0.5)*0.3 + 0.15, ang, (Math.random()-0.5)*0.3);
      group.add(leaf);
    }
    group.position.set(x, 0, z);
    this.root.add(group);
    return group;
  }

  // ------------------------------------------------------------ key counter
  // One long counter holding every key in the vault, laid out in a dense
  // grid. Keys are real 3D objects the whole time — picking one up never
  // removes it from the world, it just moves to your hand.
  // ------------------------------------------------------------ key table
  // A big table holding every key in the vault, piled naturally rather than
  // arranged in a grid. Keys are visible and pickable from the very start —
  // there's nothing to open first.
  _buildKeyTable(){
    const n = this.puzzle.boxCount;
    const pileRadius = Utils.clamp(0.42 + n*0.007, 0.42, 1.15);
    const tableRadius = pileRadius + 0.32;
    const tableY = 0.82;

    const group = new THREE.Group();
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(tableRadius, tableRadius*0.97, 0.06, 28), this.mat.woodFurniture);
    tableTop.position.y = tableY;
    group.add(tableTop);
    // a deep green leather inset on top, leaving a visible wood rim border —
    // two separate meshes avoids any ambiguity about cylinder cap material order
    const leatherMat = new THREE.MeshStandardMaterial({ map: Textures.leatherInsetTexture(0x1e3d2e, 0xc8965a), roughness:0.72, metalness:0.04 });
    const leatherInset = new THREE.Mesh(new THREE.CircleGeometry(tableRadius*0.86, 28), leatherMat);
    leatherInset.rotation.x = -Math.PI/2;
    leatherInset.position.y = tableY + 0.0305;
    group.add(leatherInset);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, tableY-0.08, 16), this.mat.woodFurniture);
    pedestal.position.y = (tableY-0.06)/2;
    group.add(pedestal);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(tableRadius*0.5, tableRadius*0.58, 0.04, 20), this.mat.trim);
    base.position.y = 0.02;
    group.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(tableRadius*0.98, 0.012, 8, 28), this.mat.brass);
    rim.rotation.x = Math.PI/2;
    rim.position.y = tableY + 0.03;
    group.add(rim);

    const pileGroup = new THREE.Group();
    pileGroup.position.set(0, tableY + 0.033, 0);
    group.add(pileGroup);

    group.position.set(-ROOM.w/2 + tableRadius + 0.5, 0, -0.5);
    this.root.add(group);
    this._addObstacle(
      group.position.x - tableRadius - 0.15, group.position.x + tableRadius + 0.15,
      group.position.z - tableRadius - 0.15, group.position.z + tableRadius + 0.15
    );

    // a coarse height field approximates a natural mound — no physics engine,
    // just enough so keys resting near the centre stack a little higher than
    // ones scattered toward the rim, without hard clipping into each other
    const gridN = 16;
    const cell = (pileRadius*2) / gridN;
    const heightField = new Array(gridN*gridN).fill(0);
    const bump = (gx, gz, amt) => {
      for(let ddx=-1; ddx<=1; ddx++){
        for(let ddz=-1; ddz<=1; ddz++){
          const xx = gx+ddx, zz = gz+ddz;
          if(xx<0||xx>=gridN||zz<0||zz>=gridN) continue;
          heightField[zz*gridN+xx] += amt * ((ddx===0&&ddz===0) ? 1 : 0.35);
        }
      }
    };

    const shuffledKeys = this.rng.shuffle(this.puzzle.keys);
    shuffledKeys.forEach(keyData => {
      const rr = pileRadius * this.rng.float(); // linear radius sample -> naturally denser toward the centre, like a real mound
      const ang = this.rng.range(0, Math.PI*2);
      const px = Math.cos(ang)*rr, pz = Math.sin(ang)*rr;
      const gx = Utils.clamp(Math.floor((px+pileRadius)/cell), 0, gridN-1);
      const gz = Utils.clamp(Math.floor((pz+pileRadius)/cell), 0, gridN-1);
      const h = heightField[gz*gridN+gx];
      bump(gx, gz, 0.014 + this.rng.range(0, 0.006));

      const keyMesh = this._buildKeyMesh(keyData);
      keyMesh.position.set(px, h + 0.011, pz);
      keyMesh.rotation.set(-Math.PI/2 + this.rng.range(-0.06,0.06), this.rng.range(0, Math.PI*2), this.rng.range(-0.12,0.12));
      pileGroup.add(keyMesh);
      VaultWorld.tag(keyMesh, 'key', keyData.id);
      this.keyUnits.set(keyData.id, { group: keyMesh, data: keyData, state:'onTable' });
    });
  }

  _buildKeyMesh(keyData){
    const attrs = keyData.attrs;
    const active = d => keyData.activeDims.includes(d);
    const baseColorHex = (attrs.metal.v !== 'brass') ? attrs.metal.hex : attrs.color.hex;
    const rough = attrs.wear.rough;

    const group = new THREE.Group();
    const shaftLen = 0.115, shaftR = 0.0065;
    const metalMat = new THREE.MeshStandardMaterial({ color: baseColorHex, roughness: rough, metalness: 0.85 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftR, shaftR, shaftLen, 8), metalMat);
    group.add(shaft);

    // bit — a flat shape matching the `teeth` clue, extruded thin; this is
    // compared directly against the lock's keyhole cutout shape
    const bitShape = Textures.buildKeyholeShape3D(attrs.teeth.v, 0.02);
    const bitGeo = new THREE.ExtrudeGeometry(bitShape, { depth:0.006, bevelEnabled:false });
    bitGeo.translate(0, 0, -0.003);
    const bit = new THREE.Mesh(bitGeo, metalMat);
    bit.position.y = -shaftLen/2 - 0.014;
    group.add(bit);

    // bow (medallion) — carries the symbol / number / motif / gem clue face
    const bowTex = this._makeClueTexture(keyData, 128, 128, { circular:true });
    const capMat = new THREE.MeshStandardMaterial({ color: baseColorHex, roughness: Math.max(0.15, rough*0.65), metalness:0.75, map: bowTex });
    const sideMat = metalMat;
    const bowGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.009, 22);
    bowGeo.rotateX(Math.PI/2);
    const bow = new THREE.Mesh(bowGeo, [sideMat, capMat, capMat]);
    bow.position.y = shaftLen/2 + 0.006;
    group.add(bow);

    // cosmetic head-shape surround — purely decorative variety (not a clue),
    // so every key still looks like a distinct, handcrafted object
    const decorShapes = ['round','oval','square','diamond','arch','star','heart'];
    const decorShape = this.rng.pick(decorShapes);
    if(decorShape !== 'round'){
      const ringShape3D = Textures.buildKeyholeShape3D(decorShape, 0.036);
      const ringGeo = new THREE.ExtrudeGeometry(ringShape3D, { depth:0.004, bevelEnabled:false });
      ringGeo.translate(0,0,-0.002);
      const ring = new THREE.Mesh(ringGeo, metalMat);
      ring.position.y = shaftLen/2 + 0.004;
      ring.renderOrder = -1;
      group.add(ring);
    }

    if(active('ribbon')){
      const ribbonMat = new THREE.MeshStandardMaterial({ color: attrs.ribbon.hex, roughness:0.6, side:THREE.DoubleSide });
      const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.05), ribbonMat);
      ribbon.position.set(0.024, shaftLen/2 + 0.02, 0);
      ribbon.rotation.z = 0.5;
      group.add(ribbon);
      const ribbon2 = ribbon.clone(); ribbon2.rotation.z = -0.5; ribbon2.position.x = -0.024;
      group.add(ribbon2);
    }

    return group;
  }

  // An empty, plain utility table with a few shallow trays — unlike the key
  // table, nothing starts here. It exists purely so the player has somewhere
  // deliberate to sort keys into once they can position-and-place them.
  _buildSortingTable(x, z, rotY){
    const group = new THREE.Group();
    const tableW = 1.3, tableD = 0.6, tableH = 0.78;
    const plainWood = new THREE.MeshStandardMaterial({ map: Textures.woodTexture(0x3f2a19, 0x241608, {repeat:[2,1]}), roughness:0.7, metalness:0.03 });

    const top = new THREE.Mesh(new THREE.BoxGeometry(tableW, 0.05, tableD), plainWood);
    top.position.y = tableH;
    group.add(top);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(tableW-0.1, 0.06, tableD-0.14), plainWood);
    apron.position.y = tableH - 0.08;
    group.add(apron);
    const legGeo = new THREE.CylinderGeometry(0.025, 0.03, tableH-0.05, 8);
    [[-tableW/2+0.09,-tableD/2+0.09],[-tableW/2+0.09,tableD/2-0.09],[tableW/2-0.09,-tableD/2+0.09],[tableW/2-0.09,tableD/2-0.09]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(legGeo, plainWood);
      leg.position.set(lx, (tableH-0.05)/2, lz);
      group.add(leg);
    });

    const trayMat = new THREE.MeshStandardMaterial({ color:0x5c5244, roughness:0.92, metalness:0.02 });
    const trayCount = 3;
    const trayW = 0.34, trayD = 0.44, trayWallH = 0.032;
    const trayY = tableH + 0.025;
    for(let i=0;i<trayCount;i++){
      const tx = -tableW/2 + (tableW/(trayCount+1)) * (i+1);
      const trayBase = new THREE.Mesh(new THREE.BoxGeometry(trayW, 0.012, trayD), trayMat);
      trayBase.position.set(tx, trayY, 0);
      group.add(trayBase);
      const wallSide = new THREE.BoxGeometry(0.012, trayWallH, trayD);
      const wallL = new THREE.Mesh(wallSide, trayMat);
      wallL.position.set(tx-trayW/2, trayY+trayWallH/2, 0);
      group.add(wallL);
      const wallR = new THREE.Mesh(wallSide, trayMat);
      wallR.position.set(tx+trayW/2, trayY+trayWallH/2, 0);
      group.add(wallR);
      const wallEnd = new THREE.BoxGeometry(trayW+0.024, trayWallH, 0.012);
      const wallF = new THREE.Mesh(wallEnd, trayMat);
      wallF.position.set(tx, trayY+trayWallH/2, -trayD/2);
      group.add(wallF);
      const wallBk = new THREE.Mesh(wallEnd, trayMat);
      wallBk.position.set(tx, trayY+trayWallH/2, trayD/2);
      group.add(wallBk);
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    this.root.add(group);
    // generous, rotation-agnostic footprint — simpler and safer than computing
    // an exact rotated bounding box for a piece of static furniture
    this._addObstacle(x-0.75, x+0.75, z-0.75, z+0.75);
  }

  // ------------------------------------------------------------- box wall
  _buildBoxWall(){
    const { cols, rows, cellW, cellH } = this._wallCells;
    const totalW = cols * cellW, totalH = rows * cellH;
    const startX = -totalW/2 + cellW/2;
    const wallCenterY = ROOM.h/2 - 0.1;
    const startY = wallCenterY + totalH/2 - cellH/2;
    const wallInnerZ = -ROOM.d/2 + 0.001;

    const wallGroup = new THREE.Group();
    this.puzzle.boxes.filter(b => b.isWall).forEach(boxData => {
      const col = boxData.gridSlot % cols;
      const row = Math.floor(boxData.gridSlot / cols);
      const x = startX + col*cellW;
      const y = startY - row*cellH;
      const unit = this._buildWallBoxUnit(boxData, cellW, cellH);
      unit.group.position.set(x, y, wallInnerZ);
      wallGroup.add(unit.group);
      this.boxUnits.set(boxData.id, unit);
    });
    this.root.add(wallGroup);
  }

  _buildWallBoxUnit(boxData, cellW, cellH){
    const attrs = boxData.attrs;
    const baseColorHex = (attrs.metal.v !== 'brass') ? attrs.metal.hex : attrs.color.hex;
    const rough = attrs.wear.rough;

    const group = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({
      color: Textures.shade(0x8f7248, this.rng.range(-14,14)),
      roughness: Utils.clamp(0.58 + this.rng.range(-0.1,0.14), 0.4, 0.78),
      metalness: 0.5
    });
    const frame = new THREE.Mesh(this.sharedGeo.wallFrame, frameMat);
    frame.position.z = 0.025;
    group.add(frame);

    const panelW = cellW*0.74, panelH = cellH*0.7, panelD = 0.06;
    const doorTex = this._makeClueTexture(boxData, 176, Math.round(176*(panelH/panelW)), {});
    const plainMat = () => new THREE.MeshStandardMaterial({ color: baseColorHex, roughness: Math.max(rough,0.28), metalness:0.55 });
    const panelMats = [plainMat(), plainMat(), plainMat(), plainMat(),
      new THREE.MeshStandardMaterial({ color: baseColorHex, roughness: Math.max(0.3,rough*0.85), metalness:0.5, map: doorTex,
        emissive: 0xffb070, emissiveIntensity: 0 }),
      plainMat()
    ];
    const panel = new THREE.Mesh(this.sharedGeo.wallPanel, panelMats);
    panel.userData.slideClosedZ = 0.03;
    panel.userData.slideOpenZ = 0.03 + Math.min(0.32, panelD*5.5);
    panel.position.z = panel.userData.slideClosedZ;
    group.add(panel);

    const knob = new THREE.Mesh(this.sharedGeo.knob, this.mat.brassBright);
    knob.position.set(panelW*0.32, 0, panelD/2 + 0.012);
    panel.add(knob);

    VaultWorld.tag(frame, 'box', boxData.id);
    VaultWorld.tag(panel, 'box', boxData.id);

    return {
      group, panel, glowMat: panelMats[4], doorTex, data: boxData, state:'locked',
      animFamily: 'slideDrawer',
      lockAnchor: { x:0, y:0, z: panelD/2 + 0.02 }
    };
  }

  // -------------------------------------------------------- scattered containers
  _buildScatteredContainers(){
    const scattered = this.puzzle.boxes.filter(b => !b.isWall);
    const areaMinX = -ROOM.w/2 + 1.4, areaMaxX = ROOM.w/2 - 1.4;
    const areaMinZ = -ROOM.d/2 + 2.2, areaMaxZ = ROOM.d/2 - 2.4;

    scattered.forEach((boxData) => {
      let x, z, ok, tries = 0;
      do {
        x = this.rng.range(areaMinX, areaMaxX);
        z = this.rng.range(areaMinZ, areaMaxZ);
        ok = !this.obstacles.some(ob =>
          x > ob.minX-0.6 && x < ob.maxX+0.6 && z > ob.minZ-0.6 && z < ob.maxZ+0.6
        );
        tries++;
      } while(!ok && tries < 12);

      const rotY = this.rng.range(0, Math.PI*2); // fully random facing — no preferred direction
      const unit = this._buildContainerUnit(boxData);
      unit.group.position.set(x, 0, z);
      unit.group.rotation.y = rotY;
      this.root.add(unit.group);
      this.boxUnits.set(boxData.id, unit);
      this._addObstacle(x-0.55, x+0.55, z-0.55, z+0.55);
    });
  }

  _buildContainerUnit(boxData){
    switch(boxData.animFamily){
      case 'lidBox': return this._buildLidBoxUnit(boxData);
      case 'swingDoor': return this._buildSwingDoorUnit(boxData);
      case 'slideDrawer': return this._buildSlideCabinetUnit(boxData);
      case 'unfold': return this._buildSuitcaseUnit(boxData);
      default: return this._buildLidBoxUnit(boxData);
    }
  }

  _archScale(kind){
    return ({ jewelryBox:0.75, keepsakeBox:1.05, cashBox:0.95, lockbox:0.8,
      safe:1.15, standingVault:1.9, displayCase:1.2,
      filingDrawer:1.25, deskDrawer:0.95 })[kind] || 1;
  }

  _buildLidBoxUnit(boxData){
    const s = this._archScale(boxData.archetype);
    const w = 0.26*s, h = 0.15*s, d = 0.2*s;
    const attrs = boxData.attrs;
    const baseColorHex = (attrs.metal.v !== 'brass') ? attrs.metal.hex : attrs.color.hex;
    const rough = attrs.wear.rough;
    const isGlassy = false;

    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.65, d), new THREE.MeshStandardMaterial({ color: Textures.shade(baseColorHex,-20), roughness: rough+0.1, metalness:0.5 }));
    base.position.y = h*0.65/2;
    group.add(base);

    const lidTex = this._makeClueTexture(boxData, 140, Math.round(140*(d/w)), {});
    const lidMat = new THREE.MeshStandardMaterial({ color: baseColorHex, roughness: Math.max(0.15,rough*0.75), metalness:0.6, map:lidTex, emissive:0x000000, emissiveIntensity:0 });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.35, d), lidMat);
    const pivot = new THREE.Group();
    pivot.position.set(0, h*0.65, -d/2);
    lid.position.set(0, h*0.35/2, d/2);
    pivot.add(lid);
    group.add(pivot);

    const clasp = new THREE.Mesh(new THREE.BoxGeometry(w*0.1, h*0.12, 0.02), this.mat.brassBright);
    clasp.position.set(0, h*0.65, d/2+0.005);
    group.add(clasp);

    VaultWorld.tag(base, 'box', boxData.id);
    VaultWorld.tag(lid, 'box', boxData.id);

    return {
      group, pivot, lidMat, glowMat: lidMat, data: boxData, state:'locked', animFamily:'lidBox',
      openTarget: -1.92,
      lockAnchor: { x:0, y:h*0.65, z:d/2+0.02 }
    };
  }

  _buildSwingDoorUnit(boxData){
    const s = this._archScale(boxData.archetype);
    const w = 0.5*s, h = 0.7*s, d = 0.45*s;
    const attrs = boxData.attrs;
    const baseColorHex = (attrs.metal.v !== 'brass') ? attrs.metal.hex : attrs.color.hex;
    const rough = attrs.wear.rough;
    const glassy = boxData.archetype === 'displayCase';

    const group = new THREE.Group();
    const bodyMat = glassy ? this.mat.woodFurniture : new THREE.MeshStandardMaterial({ color: Textures.shade(baseColorHex,-25), roughness: rough+0.08, metalness:0.55 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    body.position.y = h/2;
    group.add(body);

    const doorW = w*0.86, doorH = h*0.86, doorD = 0.04;
    const doorTex = this._makeClueTexture(boxData, 150, Math.round(150*(doorH/doorW)), {});
    let doorMat;
    if(glassy){
      doorMat = new THREE.MeshStandardMaterial({ color:0x1a2430, roughness:0.1, metalness:0.1, transparent:true, opacity:0.35 });
    } else {
      doorMat = new THREE.MeshStandardMaterial({ color: baseColorHex, roughness: Math.max(0.15,rough*0.7), metalness:0.65, map:doorTex, emissive:0x000000, emissiveIntensity:0 });
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, doorD), doorMat);
    const pivot = new THREE.Group();
    pivot.position.set(-doorW/2, h/2, d/2);
    door.position.set(doorW/2, 0, 0);
    pivot.add(door);
    group.add(pivot);

    // small brass clue plate on the frame for glassy cases, since the door itself stays clear
    if(glassy){
      const plateTex = this._makeClueTexture(boxData, 90, 70, {});
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.11), new THREE.MeshStandardMaterial({ map:plateTex, roughness:0.5, metalness:0.3 }));
      plate.position.set(0, h*0.18, d/2+0.021);
      group.add(plate);
    }

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 12), this.mat.brassBright);
    handle.rotation.y = Math.PI/2;
    handle.position.set(doorW*0.4, 0, doorD/2+0.02);
    door.add(handle);
    if(!glassy){
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), this.mat.brassBright);
      dial.rotation.x = Math.PI/2;
      dial.position.set(0, h*0.1, doorD/2+0.011);
      door.add(dial);
    }

    VaultWorld.tag(body, 'box', boxData.id);
    VaultWorld.tag(door, 'box', boxData.id);

    return {
      group, pivot, lidMat: doorMat, glowMat: doorMat, data: boxData, state:'locked', animFamily:'swingDoor',
      openTarget: -1.95,
      lockAnchor: { x:0, y:h/2, z:d/2+0.03 }
    };
  }

  _buildSlideCabinetUnit(boxData){
    const s = this._archScale(boxData.archetype);
    const w = 0.5*s, h = 0.85*s, d = 0.5*s;
    const attrs = boxData.attrs;
    const baseColorHex = (attrs.metal.v !== 'brass') ? attrs.metal.hex : attrs.color.hex;
    const rough = attrs.wear.rough;

    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat.woodFurniture);
    body.position.y = h/2;
    group.add(body);

    if(boxData.archetype === 'deskDrawer'){
      const top = new THREE.Mesh(new THREE.BoxGeometry(w*1.3, 0.04, d*1.2), this.mat.woodFurniture);
      top.position.y = h + 0.02;
      group.add(top);
    }

    const frontW = w*0.86, frontH = h*0.3, frontD = 0.05;
    const frontTex = this._makeClueTexture(boxData, 150, Math.round(150*(frontH/frontW)), {});
    const frontMat = new THREE.MeshStandardMaterial({ color: baseColorHex, roughness: Math.max(0.15,rough*0.75), metalness:0.6, map:frontTex, emissive:0x000000, emissiveIntensity:0 });
    const front = new THREE.Mesh(new THREE.BoxGeometry(frontW, frontH, frontD), frontMat);
    front.userData.slideClosedZ = d/2;
    front.userData.slideOpenZ = d/2 + 0.3*s;
    front.position.set(0, h*0.62, front.userData.slideClosedZ);
    group.add(front);

    const pull = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 8, 12), this.mat.brassBright);
    pull.rotation.y = Math.PI/2;
    pull.position.set(0, 0, frontD/2+0.015);
    front.add(pull);

    VaultWorld.tag(body, 'box', boxData.id);
    VaultWorld.tag(front, 'box', boxData.id);

    return {
      group, panel: front, glowMat: frontMat, data: boxData, state:'locked', animFamily:'slideDrawer',
      lockAnchor: { x:0, y:h*0.62, z:frontD/2+0.02 }
    };
  }

  _buildSuitcaseUnit(boxData){
    const w = 0.55, h = 0.18, d = 0.36;
    const attrs = boxData.attrs;
    const baseColorHex = (attrs.metal.v !== 'brass') ? attrs.metal.hex : attrs.color.hex;
    const rough = attrs.wear.rough;

    const bodyPivot = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.55, d), new THREE.MeshStandardMaterial({ color: Textures.shade(baseColorHex,-15), roughness: rough+0.15, metalness:0.3 }));
    base.position.y = h*0.55/2;
    bodyPivot.add(base);
    bodyPivot.position.y = 0.08;

    const lidTex = this._makeClueTexture(boxData, 150, Math.round(150*(d/w)), {});
    const lidMat = new THREE.MeshStandardMaterial({ color: baseColorHex, roughness: Math.max(0.15,rough*0.75), metalness:0.4, map:lidTex, emissive:0x000000, emissiveIntensity:0 });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.45, d), lidMat);
    const pivot = new THREE.Group();
    pivot.position.set(0, h*0.55, -d/2);
    lid.position.set(0, h*0.45/2, d/2);
    pivot.add(lid);
    bodyPivot.add(pivot);

    [-w*0.35, w*0.35].forEach(cx => {
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), this.mat.brassBright);
      clasp.position.set(cx, h*0.55, d/2+0.005);
      bodyPivot.add(clasp);
    });

    const group = new THREE.Group();
    group.add(bodyPivot);

    VaultWorld.tag(base, 'box', boxData.id);
    VaultWorld.tag(lid, 'box', boxData.id);

    return {
      group, pivot, bodyPivot, lidMat, glowMat: lidMat, data: boxData, state:'locked', animFamily:'unfold',
      openTarget: -2.3,
      lockAnchor: { x:0, y:h*0.55, z:d/2+0.02 }
    };
  }

  // ------------------------------------------------------------- clue texture
  // Shared by every archetype's clue-bearing face. Nothing here is text —
  // every match is a shape, a colour, a symbol, an engraving, a gem, or a
  // scratch pattern the player can see and compare directly.
  _makeClueTexture(boxData, W, H, opts){
    const attrs = boxData.attrs;
    const active = d => boxData.activeDims.includes(d);
    const { c, ctx } = Textures.cv(W, H);
    ctx.fillStyle = '#f2ede0'; ctx.fillRect(0,0,W,H);
    Textures.drawScratches(ctx, W, H, attrs.wear.noise);

    const cx = W/2, cy = opts.circular ? H/2 : H*0.5;
    const unit = Math.min(W,H);
    const ink = 'rgba(25,18,12,0.82)';

    // keyhole / teeth cutout — always present near the lower-middle
    Textures.drawKeyholeShape(ctx, cx, opts.circular ? cy : H*0.66, unit*0.12, attrs.teeth.v, 'rgba(15,10,6,0.88)');

    if(active('symbol')) Textures.SYMBOLS[attrs.symbol.v](ctx, cx, opts.circular ? H*0.32 : H*0.3, unit*0.15, ink, '#f2ede0');
    if(active('number')) Textures.drawStampedNumber(ctx, cx, opts.circular ? H*0.32 : H*0.3, attrs.number.v, unit*0.22, ink);
    if(active('motif')){
      if(opts.circular) Textures.drawMotifBorderRing(ctx, cx, cy, unit*0.4, attrs.motif.v, ink, 8);
      else Textures.drawMotifBorderRect(ctx, W*0.08, H*0.06, W*0.84, H*0.86, attrs.motif.v, ink, unit*0.13);
    }
    if(active('gem')) Textures.drawGem(ctx, cx, opts.circular ? H*0.7 : H*0.18, unit*0.09, attrs.gem.hex);
    if(active('ribbon')){
      ctx.fillStyle = Textures.hex2css(attrs.ribbon.hex);
      ctx.fillRect(W*0.06, H*0.05, W*0.09, H*0.15);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(W*0.06, H*0.05, W*0.09, H*0.15);
    }
    return Textures.toTex(c);
  }

  // ---------------------------------------------------------- physical keys
  // Keys are never removed from the world. Picking one up reparents the
  // actual mesh to wherever it's held; dropping or successfully unlocking
  // reparents it back into the world, always visible, always real.
  insertKeyIntoLock(boxId, keyGroup){
    const unit = this.boxUnits.get(boxId);
    if(!unit) return;
    this.root.add(keyGroup);
    const worldPos = new THREE.Vector3();
    // approximate world position from the container's transform + local anchor
    const a = unit.lockAnchor || {x:0,y:0.3,z:0.1};
    worldPos.set(unit.group.position.x + a.x, unit.group.position.y + a.y, unit.group.position.z + a.z);
    keyGroup.position.copy(worldPos);
    keyGroup.rotation.set(Math.PI/2, unit.group.rotation.y, 0);
  }

  dropKeyInWorld(keyGroup, worldPos, yaw){
    this.root.add(keyGroup);
    keyGroup.position.set(worldPos.x, 0.02, worldPos.z);
    keyGroup.rotation.set(-Math.PI/2 + this.rng.range(-0.08,0.08), yaw + this.rng.range(-0.4,0.4), 0);
  }

  // ---------------------------------------------------------- open animation
  openBoxVisual(boxId, opts){
    opts = opts || {};
    const unit = this.boxUnits.get(boxId);
    if(!unit || unit.state === 'open') return;
    unit.state = 'open';
    const reduced = Utils.prefersReducedMotion();

    const glowUp = (dur) => {
      if(opts.immediate){ unit.glowMat.emissiveIntensity = 0.5; return; }
      this.tweens.add({ duration:dur||1.2, onUpdate:e=>{ unit.glowMat.emissiveIntensity = 0.5*e; } });
    };

    if(unit.animFamily === 'slideDrawer'){
      const from = unit.panel.userData.slideClosedZ, to = unit.panel.userData.slideOpenZ;
      if(opts.immediate){ unit.panel.position.z = to; glowUp(); return; }
      this.tweens.add({ duration:0.7, easing:Utils.easeOutCubic, onUpdate:e=>{ unit.panel.position.z = Utils.lerp(from,to,e); } });
      glowUp();
      return;
    }

    if(unit.animFamily === 'lidBox' || unit.animFamily === 'swingDoor' || unit.animFamily === 'unfold'){
      const target = unit.openTarget;
      if(opts.immediate){ unit.pivot.rotation.x = unit.animFamily === 'swingDoor' ? 0 : target;
        if(unit.animFamily === 'swingDoor') unit.pivot.rotation.y = target;
        glowUp(); return; }
      const axis = unit.animFamily === 'swingDoor' ? 'y' : 'x';
      this.tweens.add({
        duration: 0.85,
        easing: reduced ? Utils.easeOutCubic : Utils.easeOutBack,
        onUpdate: e => { unit.pivot.rotation[axis] = target * Math.min(e,1); }
      });
      if(unit.animFamily === 'unfold'){
        const fromTilt = 0, toTilt = -0.18;
        this.tweens.add({ duration:0.85, easing:Utils.easeOutCubic, onUpdate:e=>{ unit.bodyPivot.rotation.x = Utils.lerp(fromTilt,toTilt,e); } });
      }
      glowUp();
      return;
    }
  }

  // --------------------------------------------------------- environment
  applyEnvironmentEffect(effectId, opts){
    opts = opts || {};
    const immediate = !!opts.immediate;
    switch(effectId){
      case 'lampOn':
        this.envState.lampOn = true;
        if(immediate){ this.extraLamp.light.intensity = 1.1; this.extraLamp.shade.material.emissiveIntensity = 0.6; }
        else this.tweens.add({ duration:1.6, onUpdate:e=>{ this.extraLamp.light.intensity = 1.1*e; this.extraLamp.shade.material.emissiveIntensity = 0.6*e; } });
        break;
      case 'fireplaceLight':
        this.envState.fireOn = true;
        if(immediate){ this.fireLight.intensity = 1.3; this.fireSprite.material.opacity = 0.9; }
        else this.tweens.add({ duration:1.8, onUpdate:e=>{ this.fireLight.intensity = 1.3*e; this.fireSprite.material.opacity = 0.9*e; } });
        break;
      case 'rainStop':
        this.envState.rainLevel = 0;
        if(immediate){ this.rainMat.opacity = 0; }
        else this.tweens.add({ duration:2.2, onUpdate:e=>{ this.rainMat.opacity = 0.7*(1-e); } });
        break;
      case 'clockAdvance':
        this.clockHands.ticks++;
        { const targetHour = this.clockHands.ticks * 0.5, targetMin = this.clockHands.ticks * 1.3;
          if(immediate){ this.clockHands.hourHand.rotation.z = -targetHour; this.clockHands.minuteHand.rotation.z = -targetMin; }
          else {
            const fromH = this.clockHands.hourHand.rotation.z, fromM = this.clockHands.minuteHand.rotation.z;
            this.tweens.add({ duration:1.4, easing:Utils.easeInOutQuad, onUpdate:e=>{
              this.clockHands.hourHand.rotation.z = Utils.lerp(fromH, -targetHour, e);
              this.clockHands.minuteHand.rotation.z = Utils.lerp(fromM, -targetMin, e);
            }});
          }
        }
        break;
      case 'plantAppear': {
        this.envState.plants++;
        const spots = [[ -1.5, ROOM.d/2-0.6 ], [ 2.0, -ROOM.d/2+1.6 ], [ -ROOM.w/2+0.7, 1.8 ], [3.4, 3.0]];
        const s = spots[(this.envState.plants-1) % spots.length];
        const plant = this._addPlant(s[0], s[1]);
        if(!immediate){ plant.scale.set(0.001,0.001,0.001);
          this.tweens.add({ duration:0.7, easing:Utils.easeOutBack, onUpdate:e=>{ plant.scale.set(e,e,e); } });
        }
        break; }
      case 'photoAppear': {
        this.envState.photos++;
        const tex = Textures.abstractCardTexture(0x8a7256, this.rng);
        const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), new THREE.MeshStandardMaterial({ map:tex, roughness:0.8 }));
        const spots = [[-ROOM.w/2+0.31, 1, -1.2],[ROOM.w/2-0.31, 1, 1.4],[-ROOM.w/2+0.31,1,2.6]];
        const s = spots[(this.envState.photos-1) % spots.length];
        photo.position.set(s[0], s[1], s[2]);
        photo.rotation.y = s[0] < 0 ? Math.PI/2 : -Math.PI/2;
        this.root.add(photo);
        if(!immediate){ photo.material.opacity = 0; photo.material.transparent = true;
          this.tweens.add({ duration:0.9, onUpdate:e=>{ photo.material.opacity = e; } });
        }
        break; }
      case 'rugAppear': {
        this.envState.rugs++;
        const rugW2 = 1.7, rugH2 = rugW2 * (320/448);
        const rug = new THREE.Mesh(new THREE.PlaneGeometry(rugW2, rugH2), new THREE.MeshStandardMaterial({
          map: Textures.ornateRugTexture({ base:0x233a5c, baseLight:0x2f4d78, dark:0x0f1420, accent:0x8a3a3a, gold:0xd9b878, cream:0xece0c8 }),
          roughness:0.92
        }));
        rug.rotation.x = -Math.PI/2;
        rug.rotation.z = this.envState.rugs % 2 === 0 ? 0 : Math.PI/2;
        rug.position.set(this.envState.rugs % 2 === 0 ? -2.4 : 2.4, 0.006, -3.0);
        this.root.add(rug);
        if(!immediate){ rug.scale.set(0.001,1,0.001);
          this.tweens.add({ duration:0.8, easing:Utils.easeOutBack, onUpdate:e=>{ rug.scale.set(e,1,e); } });
        }
        break; }
      case 'chimeFlourish':
      default:
        break;
    }
  }

  // -------------------------------------------------------------- memento shelf
  _buildMementoShelf(){
    const group = new THREE.Group();
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.22), this.mat.woodFurniture);
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.28, 0.03), this.mat.wainscot);
    backPanel.position.set(0, 0.16, -0.1);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(2.66, 0.05, 0.04), this.mat.trim);
    apron.position.set(0, -0.05, -0.02);
    const guardRail = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.012, 0.012), this.mat.brassFrame);
    guardRail.position.set(0, 0.045, 0.09);
    const railPost = (px) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.045,6), this.mat.brassFrame);
      post.position.set(px, 0.02, 0.09);
      return post;
    };
    const bracketGeo = new THREE.BoxGeometry(0.05, 0.14, 0.18);
    [-1.1, 1.1].forEach(x => {
      const bkt = new THREE.Mesh(bracketGeo, this.mat.trim);
      bkt.position.set(x, -0.1, -0.02);
      group.add(bkt);
    });
    group.add(plank, backPanel, apron, guardRail, railPost(-1.15), railPost(0), railPost(1.15));
    group.position.set(ROOM.w/2 - 0.14, 1.5, 4.6);
    group.rotation.y = -Math.PI/2;
    this.root.add(group);
    this.mementoShelf = { group, plank, count:0, cols: 9 };
  }

  addMemento(reward, rng){
    const shelf = this.mementoShelf;
    const idx = shelf.count++;
    const cols = shelf.cols;
    const col = idx % cols, tier = Math.floor(idx / cols);
    const mesh = this._buildMementoMesh(reward, rng);
    const spacing = 2.4 / cols;
    mesh.position.set(-1.2 + spacing*0.5 + col*spacing, 0.05 + tier*0.15, 0);
    mesh.scale.set(0.001,0.001,0.001);
    this.mementoShelf.group.add(mesh);
    this.tweens.add({ duration:0.6, easing:Utils.easeOutBack, onUpdate:e=>{ mesh.scale.set(e,e,e); } });
  }

  _buildMementoMesh(reward, rng){
    const mat = new THREE.MeshStandardMaterial({ color: reward.hex, roughness:0.35, metalness:0.6 });
    let m;
    switch(reward.shape){
      case 'coin': case 'watch':
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.01,20), mat); break;
      case 'ring': case 'locket':
        m = new THREE.Mesh(new THREE.TorusGeometry(0.026,0.008,10,20), mat); break;
      case 'sphere': case 'shell':
        m = new THREE.Mesh(new THREE.SphereGeometry(0.032,14,10), mat); break;
      case 'cube': case 'tin': case 'box':
        m = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.045,0.05), mat); break;
      case 'cone':
        m = new THREE.Mesh(new THREE.ConeGeometry(0.028,0.065,12), mat); break;
      case 'spoon':
        m = new THREE.Mesh(new THREE.SphereGeometry(0.026,10,8), mat); m.scale.set(1,0.5,1.4); break;
      case 'card':
      default: {
        const tex = Textures.abstractCardTexture(reward.hex, rng);
        m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.007, 0.1), new THREE.MeshStandardMaterial({ map:tex, roughness:0.75 }));
      }
    }
    m.rotation.y = (rng ? rng.range(0,Math.PI*2) : Math.random()*Math.PI*2);
    return m;
  }

  // ------------------------------------------------------------- per-frame
  update(dt, elapsed){
    if(this.rainMat && this.rainTex && this.envState.rainLevel > 0){
      this.rainTex.offset.y -= dt * 1.6;
    }
    if(this.fireSprite && this.envState.fireOn){
      const flick = 1 + Math.sin(elapsed*11) * 0.08 + Math.sin(elapsed*23.7) * 0.05;
      this.fireLight.intensity = 1.3 * flick;
      this.fireSprite.material.opacity = 0.85 * flick;
      this.fireSprite.scale.set(0.7*flick, 0.7*flick, 1);
    }
    this.sconceLights && this.sconceLights.forEach((l,i) => {
      l.intensity = 0.95 + Math.sin(elapsed*2 + i*3) * 0.04;
    });
  }
}
