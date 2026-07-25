/*
 * textures.js
 * Every material in the vault is a canvas-drawn procedural texture: wood, plaster, marble, leather, the ornate rug, keyholes/teeth shapes, symbols, motifs, scratches, gems, and more.
 * Depends on: Utils.
 */
// Every material in the vault is generated at runtime with canvas 2D drawing
// — there are no external image assets. This keeps the whole game a single
// file and makes every key/lock combination genuinely one-of-a-kind.
const Textures = (() => {

  function cv(w, h){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { c, ctx: c.getContext('2d') };
  }
  function toTex(c, repeat){
    const t = new THREE.CanvasTexture(c);
    if(repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }
  function hex2css(hex){ return '#' + hex.toString(16).padStart(6, '0'); }
  function shade(hex, amt){
    const r = Utils.clamp(((hex>>16)&255) + amt, 0, 255);
    const g = Utils.clamp(((hex>>8)&255) + amt, 0, 255);
    const b = Utils.clamp((hex&255) + amt, 0, 255);
    return (r<<16)|(g<<8)|b;
  }

  // ---------- keyhole / bit shape geometry (shared by 2D + 3D) ----------
  function keyholePolygon(name, s){
    switch(name){
      case 'square': return [[-s,-s],[s,-s],[s,s],[-s,s]];
      case 'diamond': return [[0,-s*1.25],[s*1.25,0],[0,s*1.25],[-s*1.25,0]];
      case 'cross': {
        const a = s*1.15, t = s*0.4;
        return [[-t,-a],[t,-a],[t,-t],[a,-t],[a,t],[t,t],[t,a],[-t,a],[-t,t],[-a,t],[-a,-t],[-t,-t]];
      }
      case 'star': {
        const pts = []; const outer = s*1.25, inner = s*0.5;
        for(let i=0;i<10;i++){ const ang=-Math.PI/2 + i*Math.PI/5; const r=(i%2===0)?outer:inner; pts.push([Math.cos(ang)*r, Math.sin(ang)*r]); }
        return pts;
      }
      case 'heart': {
        const pts = [];
        for(let i=0;i<=24;i++){
          const t = Math.PI*2*i/24;
          const x = 16*Math.pow(Math.sin(t),3);
          const y = -(13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t));
          pts.push([x*s/15.5, y*s/15.5]);
        }
        return pts;
      }
      case 'arch': {
        const w = s*1.05, h = s*1.4;
        const pts = [[-w, h*0.55], [-w, 0]];
        const steps = 10;
        for(let i=0;i<=steps;i++){ const ang = Math.PI - Math.PI*(i/steps); pts.push([Math.cos(ang)*w, -Math.sin(ang)*w]); }
        pts.push([w, h*0.55]);
        return pts;
      }
      case 'triangle': {
        const s2 = s*1.3;
        return [[0,-s2],[s2*0.87,s2*0.5],[-s2*0.87,s2*0.5]];
      }
      case 'hexagon': {
        const pts = [];
        for(let i=0;i<6;i++){ const ang = -Math.PI/2 + i*Math.PI/3; pts.push([Math.cos(ang)*s*1.15, Math.sin(ang)*s*1.15]); }
        return pts;
      }
      default: return null;
    }
  }

  function drawKeyholeShape(ctx, cx, cy, size, name, fillStyle){
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    if(name === 'round' || !name){
      ctx.arc(0, 0, size, 0, Math.PI*2);
    } else if(name === 'oval'){
      ctx.ellipse(0, 0, size*1.25, size*0.72, 0, 0, Math.PI*2);
    } else {
      const pts = keyholePolygon(name, size);
      ctx.moveTo(pts[0][0], pts[0][1]);
      for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  function buildKeyholeShape3D(name, size){
    const shape = new THREE.Shape();
    if(name === 'round' || !name){
      shape.absarc(0, 0, size, 0, Math.PI*2, false);
    } else if(name === 'oval'){
      shape.absellipse(0, 0, size*1.25, size*0.72, 0, Math.PI*2, false, 0);
    } else {
      const pts = keyholePolygon(name, size);
      shape.moveTo(pts[0][0], pts[0][1]);
      for(let i=1;i<pts.length;i++) shape.lineTo(pts[i][0], pts[i][1]);
      shape.closePath();
    }
    return shape;
  }

  // ---------- small glyph drawers for the `symbol` clue ----------
  const SYMBOLS = {
    star(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.fillStyle = col; ctx.beginPath();
      for(let i=0;i<10;i++){ const ang=-Math.PI/2+i*Math.PI/5; const rr=(i%2===0)?r:r*0.42;
        const x=Math.cos(ang)*rr, y=Math.sin(ang)*rr; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    },
    moon(ctx, cx, cy, r, col, bgCol){
      ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = bgCol; ctx.beginPath(); ctx.arc(cx+r*0.45, cy-r*0.15, r*0.85, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    },
    leaf(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(Math.PI/4); ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0,-r); ctx.quadraticCurveTo(r*0.9,0, 0,r); ctx.quadraticCurveTo(-r*0.9,0, 0,-r); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = r*0.08;
      ctx.beginPath(); ctx.moveTo(0,-r*0.9); ctx.lineTo(0,r*0.9); ctx.stroke();
      ctx.restore();
    },
    anchor(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.lineWidth = r*0.16; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(0,-r*0.55,r*0.22,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-r*0.35); ctx.lineTo(0,r*0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r*0.55,-r*0.05); ctx.lineTo(r*0.55,-r*0.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r*0.6,r*0.35); ctx.quadraticCurveTo(-r*0.6,r*0.8,0,r*0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r*0.6,r*0.35); ctx.quadraticCurveTo(r*0.6,r*0.8,0,r*0.8); ctx.stroke();
      ctx.restore();
    },
    sun(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = r*0.14; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(0,0,r*0.5,0,Math.PI*2); ctx.fill();
      for(let i=0;i<8;i++){ const ang=i*Math.PI/4;
        ctx.beginPath(); ctx.moveTo(Math.cos(ang)*r*0.68, Math.sin(ang)*r*0.68); ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r); ctx.stroke(); }
      ctx.restore();
    },
    wave(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.strokeStyle = col; ctx.lineWidth = r*0.14; ctx.lineCap='round';
      for(let row=-1; row<=1; row++){
        ctx.beginPath();
        ctx.moveTo(-r, row*r*0.42);
        ctx.quadraticCurveTo(-r*0.5, row*r*0.42 - r*0.32, 0, row*r*0.42);
        ctx.quadraticCurveTo(r*0.5, row*r*0.42 + r*0.32, r, row*r*0.42);
        ctx.stroke();
      }
      ctx.restore();
    },
    crown(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-r, r*0.5); ctx.lineTo(-r, -r*0.1); ctx.lineTo(-r*0.5, r*0.25);
      ctx.lineTo(0, -r*0.6); ctx.lineTo(r*0.5, r*0.25); ctx.lineTo(r, -r*0.1);
      ctx.lineTo(r, r*0.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
    feather(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(-Math.PI/8); ctx.strokeStyle = col; ctx.lineWidth = r*0.1; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(0,r); ctx.stroke();
      for(let i=-3;i<=3;i++){
        if(i===0) continue;
        const y = i*r*0.25;
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(Math.sign(i)*r*0.6*(1-Math.abs(i)*0.12), y - r*0.12); ctx.stroke();
      }
      ctx.restore();
    },
    heart(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, r*0.35);
      ctx.bezierCurveTo(-r*1.1, -r*0.5, -r*0.5, -r*1.05, 0, -r*0.35);
      ctx.bezierCurveTo(r*0.5, -r*1.05, r*1.1, -r*0.5, 0, r*0.35);
      ctx.fill();
      ctx.restore();
    },
    diamond(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(r*0.68,0); ctx.lineTo(0,r); ctx.lineTo(-r*0.68,0); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
    bell(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, -r*0.05, r*0.65, Math.PI, 0, false);
      ctx.lineTo(r*0.75, r*0.5); ctx.lineTo(-r*0.75, r*0.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, r*0.65, r*0.14, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    },
    arrow(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = r*0.15; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(0,r*0.8); ctx.lineTo(0,-r*0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r*0.5,-r*0.15); ctx.lineTo(0,-r*0.85); ctx.lineTo(r*0.5,-r*0.15); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
    spiral(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.strokeStyle = col; ctx.lineWidth = r*0.1; ctx.lineCap='round';
      ctx.beginPath();
      const turns = 2.2;
      for(let i=0;i<=40;i++){ const t=i/40; const ang=t*Math.PI*2*turns; const rr=t*r;
        const x=Math.cos(ang)*rr, y=Math.sin(ang)*rr; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
      ctx.stroke();
      ctx.restore();
    },
    triangle(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(r*0.87,r*0.5); ctx.lineTo(-r*0.87,r*0.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
    drop(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0,-r);
      ctx.quadraticCurveTo(r*0.85,r*0.3,0,r*0.85);
      ctx.quadraticCurveTo(-r*0.85,r*0.3,0,-r);
      ctx.fill();
      ctx.restore();
    },
    flame(ctx, cx, cy, r, col){
      ctx.save(); ctx.translate(cx,cy); ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0,-r);
      ctx.quadraticCurveTo(r*0.7,-r*0.2,r*0.35,r*0.3);
      ctx.quadraticCurveTo(r*0.3,r*0.75,0,r*0.9);
      ctx.quadraticCurveTo(-r*0.3,r*0.75,-r*0.35,r*0.3);
      ctx.quadraticCurveTo(-r*0.7,-r*0.2,0,-r);
      ctx.fill();
      ctx.restore();
    }
  };

  function drawMotifMark(ctx, x, y, s, motif, col, rot){
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot||0); ctx.fillStyle = col; ctx.strokeStyle = col;
    ctx.lineWidth = s*0.22;
    switch(motif){
      case 'floral': ctx.beginPath(); ctx.arc(0,0,s*0.5,0,Math.PI*2); ctx.fill(); break;
      case 'geometric': ctx.beginPath(); ctx.moveTo(0,-s*0.6); ctx.lineTo(s*0.55,s*0.4); ctx.lineTo(-s*0.55,s*0.4); ctx.closePath(); ctx.fill(); break;
      case 'nautical': ctx.beginPath(); ctx.moveTo(-s*0.6,0); ctx.quadraticCurveTo(0,-s*0.7,s*0.6,0); ctx.stroke(); break;
      case 'celestial':
        ctx.beginPath();
        for(let i=0;i<4;i++){ const ang=i*Math.PI/2; ctx.moveTo(0,0); ctx.lineTo(Math.cos(ang)*s*0.6, Math.sin(ang)*s*0.6); }
        ctx.stroke(); break;
      case 'vine': ctx.beginPath(); ctx.arc(0,0,s*0.4,Math.PI*0.2,Math.PI*1.3); ctx.stroke(); break;
      case 'scroll':
        ctx.beginPath(); ctx.arc(-s*0.2,0,s*0.28,0,Math.PI*1.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(s*0.2,0,s*0.28,Math.PI,Math.PI*2.5); ctx.stroke(); break;
      case 'chevron':
        ctx.beginPath(); ctx.moveTo(-s*0.55,s*0.35); ctx.lineTo(0,-s*0.35); ctx.lineTo(s*0.55,s*0.35); ctx.stroke(); break;
      case 'starburst':
        ctx.beginPath();
        for(let i=0;i<6;i++){ const ang=i*Math.PI/3; ctx.moveTo(0,0); ctx.lineTo(Math.cos(ang)*s*0.6, Math.sin(ang)*s*0.6); }
        ctx.stroke(); break;
      default: break;
    }
    ctx.restore();
  }

  function drawMotifBorderRing(ctx, cx, cy, r, motif, col, count){
    if(!motif) return;
    for(let i=0;i<count;i++){
      const ang = (i/count)*Math.PI*2;
      drawMotifMark(ctx, cx+Math.cos(ang)*r, cy+Math.sin(ang)*r, r*0.22, motif, col, ang+Math.PI/2);
    }
  }
  function drawMotifBorderRect(ctx, x, y, w, h, motif, col, spacing){
    if(!motif) return;
    const nX = Math.max(2, Math.round(w/spacing));
    const nY = Math.max(2, Math.round(h/spacing));
    for(let i=0;i<=nX;i++){ const px = x + (i/nX)*w;
      drawMotifMark(ctx, px, y, spacing*0.32, motif, col, 0);
      drawMotifMark(ctx, px, y+h, spacing*0.32, motif, col, Math.PI);
    }
    for(let j=1;j<nY;j++){ const py = y + (j/nY)*h;
      drawMotifMark(ctx, x, py, spacing*0.32, motif, col, -Math.PI/2);
      drawMotifMark(ctx, x+w, py, spacing*0.32, motif, col, Math.PI/2);
    }
  }

  // ---------- scratches (the `wear` clue) ----------
  function drawScratches(ctx, w, h, noiseLevel){
    const count = Math.round(noiseLevel * 55);
    for(let i=0;i<count;i++){
      const x = Math.random()*w, y = Math.random()*h;
      const len = 3 + Math.random()*14*noiseLevel + 4;
      const ang = Math.random()*Math.PI*2;
      ctx.strokeStyle = 'rgba(20,15,10,' + (0.1 + Math.random()*0.22) + ')';
      ctx.lineWidth = 0.5 + Math.random()*0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang)*len, y + Math.sin(ang)*len);
      ctx.stroke();
    }
    // a few soft tarnish blotches at higher severity
    if(noiseLevel > 0.4){
      const blotches = Math.round((noiseLevel-0.4) * 10);
      for(let i=0;i<blotches;i++){
        ctx.fillStyle = 'rgba(30,22,14,' + (0.06 + Math.random()*0.1) + ')';
        ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, 4+Math.random()*10, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  // ---------- gem inlay (the `gem` clue) ----------
  function drawGem(ctx, cx, cy, r, hex){
    const col = hex2css(hex);
    const bright = hex2css(shade(hex, 70));
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(20,15,10,0.5)';
    ctx.beginPath(); ctx.arc(0, 0, r*1.18, 0, Math.PI*2); ctx.fill();
    const g = ctx.createRadialGradient(-r*0.3,-r*0.3,0,0,0,r);
    g.addColorStop(0, bright); g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(-r*0.32, -r*0.32, r*0.22, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ---------- number stamping ----------
  function drawStampedNumber(ctx, cx, cy, num, size, col){
    ctx.save(); ctx.translate(cx, cy);
    ctx.font = '700 ' + size + 'px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(String(num), size*0.03, size*0.05);
    ctx.fillStyle = col;
    ctx.fillText(String(num), 0, 0);
    ctx.restore();
  }

  // ---------- environment / material textures ----------
  function woodTexture(baseHex, plankHex, opts){
    opts = opts || {};
    const { c, ctx } = cv(256, 256);
    ctx.fillStyle = hex2css(baseHex); ctx.fillRect(0,0,256,256);
    const planks = opts.planks || 6;
    for(let i=0;i<planks;i++){
      const y = i*(256/planks);
      const bandH = 256/planks;
      // each board gets its own subtle tone shift so the floor doesn't read
      // as one flat repeated tile
      const shiftAlpha = Math.random()*0.13;
      ctx.fillStyle = Math.random() > 0.5 ? ('rgba(255,255,255,'+shiftAlpha+')') : ('rgba(0,0,0,'+shiftAlpha+')');
      ctx.fillRect(0, y, 256, bandH);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.08 + Math.random()*0.05) + ')';
      ctx.fillRect(0, y, 256, 1.5);
      for(let g=0; g<18; g++){
        const gy = y + Math.random()*bandH;
        ctx.strokeStyle = 'rgba(' + (plankHex>>16&255) + ',' + (plankHex>>8&255) + ',' + (plankHex&255) + ',' + (0.05+Math.random()*0.08) + ')';
        ctx.lineWidth = 0.6 + Math.random()*1.2;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        let x = 0;
        while(x < 256){ x += 14 + Math.random()*24; ctx.lineTo(x, gy + (Math.random()-0.5)*3); }
        ctx.stroke();
      }
      // an occasional knot for realism, not on every board
      if(Math.random() < 0.4){
        const kx = 20 + Math.random()*216, ky = y + bandH*0.5 + (Math.random()-0.5)*bandH*0.4;
        const kr = 3 + Math.random()*4;
        for(let ring=3; ring>=1; ring--){
          ctx.strokeStyle = 'rgba(' + (plankHex>>16&255) + ',' + (plankHex>>8&255) + ',' + (plankHex&255) + ',' + (0.12*ring/3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(kx, ky, kr*ring*0.5, kr*ring*0.32, 0, 0, Math.PI*2); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(' + (plankHex>>16&255) + ',' + (plankHex>>8&255) + ',' + (plankHex&255) + ',0.35)';
        ctx.beginPath(); ctx.ellipse(kx, ky, kr*0.45, kr*0.3, 0, 0, Math.PI*2); ctx.fill();
      }
    }
    return toTex(c, opts.repeat || [4,4]);
  }

  function plasterTexture(baseHex){
    const { c, ctx } = cv(256, 256);
    ctx.fillStyle = hex2css(baseHex); ctx.fillRect(0,0,256,256);
    // soft large-scale mottling for hand-plastered depth
    for(let i=0;i<26;i++){
      const x = Math.random()*256, y = Math.random()*256, r = 30+Math.random()*70;
      const warm = Math.random() > 0.5;
      const g = ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0, warm ? 'rgba(120,90,60,0.05)' : 'rgba(20,15,10,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
    for(let i=0;i<1400;i++){
      const x = Math.random()*256, y = Math.random()*256;
      const shade2 = Math.random() > 0.5 ? 255 : 0;
      ctx.fillStyle = 'rgba(' + shade2 + ',' + shade2 + ',' + shade2 + ',' + (Math.random()*0.05) + ')';
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    return toTex(c, [3,2]);
  }

  // An ornate, Persian-inspired rug pattern — layered borders, guard
  // stripes, a radiating central medallion, corner ornaments, and a fringed
  // edge. This is deliberately the richest texture in the game: the rug is
  // meant to be a genuine centerpiece.
  function ornateRugTexture(opts){
    opts = opts || {};
    const W = opts.w || 448, H = opts.h || 320;
    const base = opts.base != null ? opts.base : 0x7a2432;
    const baseLight = opts.baseLight != null ? opts.baseLight : 0x9c3a46;
    const dark = opts.dark != null ? opts.dark : 0x160f0a;
    const gold = opts.gold != null ? opts.gold : 0xd9b878;
    const accent = opts.accent != null ? opts.accent : 0x1f4a48;
    const cream = opts.cream != null ? opts.cream : 0xece0c8;

    const { c, ctx } = cv(W, H);

    const grad = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2, Math.max(W,H)*0.72);
    grad.addColorStop(0, hex2css(baseLight));
    grad.addColorStop(1, hex2css(base));
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);

    const diamond = (cx,cy,r,color) => {
      ctx.fillStyle = hex2css(color);
      ctx.beginPath();
      ctx.moveTo(cx,cy-r); ctx.lineTo(cx+r*0.62,cy); ctx.lineTo(cx,cy+r); ctx.lineTo(cx-r*0.62,cy);
      ctx.closePath(); ctx.fill();
    };

    const outerT = Math.round(Math.min(W,H)*0.05);
    ctx.fillStyle = hex2css(dark);
    ctx.fillRect(0,0,W,outerT); ctx.fillRect(0,H-outerT,W,outerT);
    ctx.fillRect(0,0,outerT,H); ctx.fillRect(W-outerT,0,outerT,H);

    const g1t = Math.max(2, Math.round(outerT*0.22));
    ctx.strokeStyle = hex2css(gold); ctx.lineWidth = g1t;
    ctx.strokeRect(outerT+g1t/2, outerT+g1t/2, W-2*(outerT+g1t/2), H-2*(outerT+g1t/2));

    const bandT = Math.round(Math.min(W,H)*0.07);
    const bandInset = outerT + g1t*2;
    ctx.fillStyle = hex2css(accent);
    ctx.fillRect(bandInset, bandInset, W-2*bandInset, bandT);
    ctx.fillRect(bandInset, H-bandInset-bandT, W-2*bandInset, bandT);
    ctx.fillRect(bandInset, bandInset, bandT, H-2*bandInset);
    ctx.fillRect(W-bandInset-bandT, bandInset, bandT, H-2*bandInset);

    const spacing = bandT*1.15;
    for(let x=bandInset+bandT; x<W-bandInset-bandT; x+=spacing){
      diamond(x, bandInset+bandT/2, bandT*0.26, gold);
      diamond(x, H-bandInset-bandT/2, bandT*0.26, gold);
    }
    for(let y=bandInset+bandT*1.4; y<H-bandInset-bandT*1.4; y+=spacing){
      diamond(bandInset+bandT/2, y, bandT*0.26, gold);
      diamond(W-bandInset-bandT/2, y, bandT*0.26, gold);
    }

    const g2 = bandInset+bandT, g2t = g1t;
    ctx.strokeStyle = hex2css(gold); ctx.lineWidth = g2t;
    ctx.strokeRect(g2+g2t/2, g2+g2t/2, W-2*(g2+g2t/2), H-2*(g2+g2t/2));

    const fieldInset = g2+g2t*2;
    const fieldW = W-2*fieldInset, fieldH = H-2*fieldInset;
    const fieldCX = W/2, fieldCY = H/2;

    ctx.globalAlpha = 0.2;
    const latticeSpacing = Math.min(W,H)*0.095;
    for(let y=fieldInset+latticeSpacing*0.5; y<H-fieldInset; y+=latticeSpacing){
      for(let x=fieldInset+latticeSpacing*0.5; x<W-fieldInset; x+=latticeSpacing){
        diamond(x,y,latticeSpacing*0.15, gold);
      }
    }
    ctx.globalAlpha = 1;

    const medR = Math.min(fieldW,fieldH)*0.27;
    for(let i=0;i<8;i++){
      const ang = i*Math.PI/4;
      const px = fieldCX+Math.cos(ang)*medR*0.78, py = fieldCY+Math.sin(ang)*medR*0.78;
      ctx.save(); ctx.translate(px,py); ctx.rotate(ang);
      ctx.fillStyle = hex2css(gold);
      ctx.beginPath(); ctx.ellipse(0,0, medR*0.34, medR*0.14, 0,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    diamond(fieldCX, fieldCY, medR, gold);
    diamond(fieldCX, fieldCY, medR*0.68, accent);
    diamond(fieldCX, fieldCY, medR*0.34, cream);
    ctx.fillStyle = hex2css(dark);
    ctx.beginPath(); ctx.arc(fieldCX,fieldCY, medR*0.08, 0, Math.PI*2); ctx.fill();

    const cornerR = medR*0.58;
    const corners = [[fieldInset,fieldInset,1,1],[W-fieldInset,fieldInset,-1,1],[fieldInset,H-fieldInset,1,-1],[W-fieldInset,H-fieldInset,-1,-1]];
    corners.forEach(([cx,cy,sx,sy]) => {
      ctx.save();
      ctx.translate(cx,cy);
      ctx.scale(sx,sy);
      ctx.fillStyle = hex2css(accent);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,cornerR,0,Math.PI/2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hex2css(gold);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,cornerR*0.6,0,Math.PI/2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hex2css(cream);
      ctx.beginPath(); ctx.arc(cornerR*0.3, cornerR*0.3, cornerR*0.15, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });

    ctx.strokeStyle = hex2css(cream);
    ctx.lineWidth = 1.4;
    const fringeN = Math.round(W/16);
    for(let i=0;i<fringeN;i++){
      const fx = (i+0.5)/fringeN * W;
      ctx.beginPath(); ctx.moveTo(fx, 1); ctx.lineTo(fx, outerT*0.55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, H-1); ctx.lineTo(fx, H-outerT*0.55); ctx.stroke();
    }

    return toTex(c);
  }

  // Deep tooled-leather look for the key table's top surface — a distinct
  // colour from the honey-wood floor, but the same warm-room family via its
  // gold tooling, so it complements rather than competes.
  function leatherInsetTexture(baseHex, borderHex){
    const { c, ctx } = cv(256, 256);
    const grad = ctx.createRadialGradient(128,128,0,128,128,190);
    grad.addColorStop(0, hex2css(shade(baseHex, 10)));
    grad.addColorStop(1, hex2css(shade(baseHex, -18)));
    ctx.fillStyle = grad; ctx.fillRect(0,0,256,256);
    for(let i=0;i<260;i++){
      const x = Math.random()*256, y = Math.random()*256;
      ctx.fillStyle = 'rgba(0,0,0,' + (0.03+Math.random()*0.05) + ')';
      ctx.beginPath(); ctx.arc(x,y,1.5+Math.random()*3.5,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle = hex2css(borderHex);
    ctx.lineWidth = 2.2;
    ctx.strokeRect(14,14,228,228);
    ctx.lineWidth = 1;
    ctx.strokeRect(21,21,214,214);
    const corner = (cx,cy,sx,sy) => {
      ctx.save(); ctx.translate(cx,cy); ctx.scale(sx,sy);
      ctx.strokeStyle = hex2css(borderHex); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0,18); ctx.quadraticCurveTo(6,6,18,0); ctx.stroke();
      ctx.restore();
    };
    corner(21,21,1,1); corner(235,21,-1,1); corner(21,235,1,-1); corner(235,235,-1,-1);
    return toTex(c);
  }

  function marbleTexture(baseHex, veinHex){
    const { c, ctx } = cv(256, 256);
    ctx.fillStyle = hex2css(baseHex); ctx.fillRect(0,0,256,256);
    for(let i=0;i<8;i++){
      ctx.strokeStyle = 'rgba(' + (veinHex>>16&255) + ',' + (veinHex>>8&255) + ',' + (veinHex&255) + ',' + (0.22+Math.random()*0.28) + ')';
      ctx.lineWidth = 0.7 + Math.random()*1.6;
      ctx.beginPath();
      let x = Math.random()*256, y = Math.random()*256;
      ctx.moveTo(x,y);
      for(let s=0;s<4;s++){
        x += (Math.random()-0.5)*150; y += (Math.random()-0.5)*150;
        ctx.quadraticCurveTo(x+(Math.random()-0.5)*50, y+(Math.random()-0.5)*50, x, y);
      }
      ctx.stroke();
    }
    for(let i=0;i<320;i++){
      ctx.fillStyle = 'rgba(255,255,255,' + (Math.random()*0.035) + ')';
      ctx.fillRect(Math.random()*256, Math.random()*256, 2, 2);
    }
    return toTex(c, [2,1]);
  }

  function rugTexture(hexA, hexB){
    const { c, ctx } = cv(256, 256);
    ctx.fillStyle = hex2css(hexA); ctx.fillRect(0,0,256,256);
    ctx.strokeStyle = hex2css(hexB); ctx.lineWidth = 6;
    ctx.strokeRect(14,14,228,228);
    ctx.lineWidth = 2;
    ctx.strokeRect(30,30,196,196);
    for(let i=0;i<10;i++){
      ctx.beginPath();
      const r = 20 + i*9;
      ctx.arc(128,128,r,0,Math.PI*2);
      ctx.globalAlpha = 0.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return toTex(c);
  }

  function rainTexture(){
    const { c, ctx } = cv(128, 256);
    ctx.clearRect(0,0,128,256);
    ctx.strokeStyle = 'rgba(200,220,235,0.5)';
    ctx.lineWidth = 1.4;
    for(let i=0;i<70;i++){
      const x = Math.random()*128;
      const y = Math.random()*256;
      const len = 14 + Math.random()*22;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x-3, y+len);
      ctx.stroke();
    }
    return toTex(c, [1,1]);
  }

  function fireGlowTexture(){
    const { c, ctx } = cv(128,128);
    const g = ctx.createRadialGradient(64,64,0,64,64,64);
    g.addColorStop(0, 'rgba(255,200,120,0.95)');
    g.addColorStop(0.4, 'rgba(255,140,60,0.65)');
    g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,128,128);
    return toTex(c);
  }

  function clockFaceTexture(){
    const { c, ctx } = cv(256,256);
    ctx.fillStyle = '#ece0c8'; ctx.beginPath(); ctx.arc(128,128,120,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#3a2615'; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = '#2a1c10';
    for(let i=0;i<12;i++){
      const ang = i*Math.PI/6;
      const x1 = 128+Math.cos(ang)*104, y1=128+Math.sin(ang)*104;
      const x2 = 128+Math.cos(ang)*116, y2=128+Math.sin(ang)*116;
      ctx.lineWidth = 3; ctx.strokeStyle = '#2a1c10';
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
    return toTex(c);
  }

  function abstractCardTexture(hex, rng){
    // used for photographs / letters / stamps — an abstract, non-representational
    // impression rather than any depicted real scene, drawn fresh from the seed.
    const { c, ctx } = cv(160, 200);
    ctx.fillStyle = '#e8dfc8'; ctx.fillRect(0,0,160,200);
    ctx.fillStyle = hex2css(hex); ctx.globalAlpha = 0.5;
    ctx.fillRect(14,14,132,150);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth=2; ctx.strokeRect(14,14,132,150);
    const n = rng ? rng.int(3,6) : 4;
    for(let i=0;i<n;i++){
      const rx = rng ? rng.range(30,130) : 60+i*10;
      const ry = rng ? rng.range(30,150) : 60+i*10;
      const rr = rng ? rng.range(6,22) : 12;
      ctx.fillStyle = 'rgba(40,30,20,' + (0.12 + (rng?rng.range(0,0.15):0.1)) + ')';
      ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI*2); ctx.fill();
    }
    return toTex(c);
  }

  return {
    cv, toTex, hex2css, shade,
    keyholePolygon, drawKeyholeShape, buildKeyholeShape3D,
    SYMBOLS, drawMotifMark, drawMotifBorderRing, drawMotifBorderRect,
    drawStampedNumber, drawScratches, drawGem,
    woodTexture, plasterTexture, rugTexture, ornateRugTexture, leatherInsetTexture, marbleTexture, rainTexture, fireGlowTexture,
    clockFaceTexture, abstractCardTexture
  };
})();
