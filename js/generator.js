/*
 * generator.js
 * Pure data generation for the puzzle: visual clue dimensions, the collision-checked multi-attribute signature system, container archetypes, and the reward queue. No Three.js, no DOM.
 * Depends on: Utils.
 */
// Pure data generation — no Three.js, no DOM. Given the same seed this always
// produces the same puzzle, which is what makes save/load possible from just
// a seed plus a list of which containers have been opened.
const Generator = (() => {

  const MIN_WALL = 60;
  const MAX_WALL = 90;
  const MIN_SCATTERED = 10;
  const MAX_SCATTERED = 16;

  // Single source of truth for every adjustable game parameter. The settings
  // modal renders itself from this list, so adding a new adjustable feature
  // later is just adding an entry here — no UI code to hand-write.
  const SETTINGS_SCHEMA = [
    {
      key: 'wallBoxes', label: 'Deposit Boxes', type: 'range',
      min: 24, max: 100, step: 2, default: 72,
      hint: 'How many safety deposit boxes line the wall.'
    },
    {
      key: 'scatteredContainers', label: 'Extra Containers', type: 'range',
      min: 4, max: 20, step: 1, default: 12,
      hint: 'Jewelry boxes, suitcases, safes, and other containers scattered around the room.'
    },
    {
      key: 'difficulty', label: 'Pattern Difficulty', type: 'select', default: 'normal',
      options: [
        { value:'easy',   label:'Easy — usually one detail' },
        { value:'normal', label:'Normal — mostly one, sometimes two' },
        { value:'hard',   label:'Hard — often two details at once' }
      ],
      hint: 'How often a lock is identified by more than one visual detail at the same time.'
    }
  ];

  function defaultSettings(){
    const obj = {};
    SETTINGS_SCHEMA.forEach(f => { obj[f.key] = f.default; });
    return obj;
  }

  function normalizeSettings(input){
    const s = Object.assign({}, defaultSettings(), input || {});
    s.wallBoxes = Utils.clamp(Math.round(Number(s.wallBoxes) || 0) || defaultSettings().wallBoxes, 24, 100);
    s.scatteredContainers = Utils.clamp(Math.round(Number(s.scatteredContainers) || 0) || defaultSettings().scatteredContainers, 4, 20);
    if(!['easy','normal','hard'].includes(s.difficulty)) s.difficulty = 'normal';
    return s;
  }

  // How many active clue dimensions a given pair uses. Weighted by
  // difficulty rather than by attempt count, so the effect is felt across
  // the whole vault, not just in overflow containers.
  function pickSignatureSize(rng, difficulty){
    const roll = rng.float();
    if(difficulty === 'easy')  return roll < 0.90 ? 1 : (roll < 0.98 ? 2 : 3);
    if(difficulty === 'hard')  return roll < 0.15 ? 1 : (roll < 0.85 ? 2 : 3);
    return roll < 0.55 ? 1 : (roll < 0.92 ? 2 : 3); // normal
  }

  function hslToHex(h, s, l){
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2*l - 1)) * s;
    const x = c * (1 - Math.abs((h/60) % 2 - 1));
    const m = l - c/2;
    let r,g,b;
    if(h<60){ r=c;g=x;b=0; } else if(h<120){ r=x;g=c;b=0; } else if(h<180){ r=0;g=c;b=x; }
    else if(h<240){ r=0;g=x;b=c; } else if(h<300){ r=x;g=0;b=c; } else { r=c;g=0;b=x; }
    const R = Math.round((r+m)*255), G = Math.round((g+m)*255), B = Math.round((b+m)*255);
    return (R<<16)|(G<<8)|B;
  }
  function hslPalette(n, s, l, hueOffset){
    const out = [];
    for(let i=0;i<n;i++) out.push(hslToHex(hueOffset + (i*360/n), s, l));
    return out;
  }

  // Every dimension has a pool of "active" values (used only when it's really
  // the clue for a given pair) and a single decorative DEFAULT used everywhere
  // else, so a dimension only ever carries meaning when it's genuinely active —
  // nothing is left to look like a false lead. All matching is purely visual;
  // nothing here is ever rendered as UI text.
  const colorPalette = hslPalette(14, 0.5, 0.4, 6);
  const gemPalette = hslPalette(14, 0.65, 0.48, 26);
  const ribbonPalette = hslPalette(10, 0.55, 0.38, 14);

  const DIMENSIONS = {
    color: {
      active: colorPalette.map((hex,i) => ({ v:'c'+i, hex })),
      default: { v:'brass', hex:0xa9793f }
    },
    symbol: {
      active: ['star','moon','leaf','anchor','sun','wave','crown','feather',
                'heart','diamond','bell','arrow','spiral','triangle','drop','flame'].map(v => ({ v })),
      default: { v:null }
    },
    metal: {
      active: [
        {v:'silver', hex:0xc7cdd4, rough:0.3},
        {v:'copper', hex:0xb5673a, rough:0.4},
        {v:'gold',   hex:0xd8b34a, rough:0.26},
        {v:'iron',   hex:0x4d4d52, rough:0.6},
        {v:'bronze', hex:0x8a6a3f, rough:0.42},
        {v:'pewter', hex:0x8c8f92, rough:0.5},
        {v:'tin',    hex:0xa9b0ab, rough:0.46}
      ],
      default: { v:'brass', hex:0xa9793f, rough:0.34 }
    },
    wear: {
      active: [
        {v:'pristine', rough:0.14, noise:0.02},
        {v:'lightly scratched', rough:0.32, noise:0.22},
        {v:'heavily scratched', rough:0.5, noise:0.48},
        {v:'tarnished', rough:0.68, noise:0.7}
      ],
      default: { v:'average', rough:0.38, noise:0.1 }
    },
    ribbon: {
      active: ribbonPalette.map((hex,i) => ({ v:'r'+i, hex })),
      default: { v:null }
    },
    motif: {
      active: ['floral','geometric','nautical','celestial','vine','scroll','chevron','starburst'].map(v => ({ v })),
      default: { v:null }
    },
    teeth: {
      // the key's bit silhouette and the lock's keyhole cutout share this shape vocabulary
      active: ['square','diamond','cross','heart','arch','star','oval','triangle','hexagon'].map(v => ({ v })),
      default: { v:'round' }
    },
    gem: {
      active: gemPalette.map((hex,i) => ({ v:'g'+i, hex })),
      default: { v:null }
    },
    number: {
      active: null, // generated on the fly, see pickActiveValue
      default: { v:null }
    }
  };

  const CLUE_TYPES = ['color','symbol','metal','wear','ribbon','motif','teeth','gem','number'];

  const ENV_EFFECTS = [
    {id:'lampOn',        label:'A lamp flickers on somewhere in the room.'},
    {id:'fireplaceLight',label:'The fireplace catches and begins to warm the room.'},
    {id:'rainStop',      label:'Outside the window, the rain finally eases.'},
    {id:'clockAdvance',  label:'The old clock ticks forward.'},
    {id:'plantAppear',   label:'Something green has found its way onto a shelf.'},
    {id:'photoAppear',   label:'A photograph appears, leaning against the wall.'},
    {id:'rugAppear',     label:'A rug has unrolled itself across the floor.'},
    {id:'chimeFlourish', label:'Somewhere, a music box begins to play.'}
  ];

  const REWARDS_COMMON = [
    {id:'coin', name:'Tarnished Coin', desc:'Stamped with a currency no one spends anymore.', icon:'\u2726', shape:'coin', hex:0xc9a227},
    {id:'photograph', name:'Faded Photograph', desc:"Someone's ordinary afternoon, decades gone quiet.", icon:'\u2756', shape:'card', hex:0x8a7256},
    {id:'letter', name:'Sealed Letter', desc:'Never opened. Perhaps it still could be.', icon:'\u2709', shape:'card', hex:0xd8c9a3},
    {id:'thimble', name:'Silver Thimble', desc:'Worn smooth by a hand that sewed for years.', icon:'\u2727', shape:'ring', hex:0xb8bcc2},
    {id:'marble', name:'Glass Marble', desc:'A swirl of colour, trapped mid-spin.', icon:'\u25CF', shape:'sphere', hex:0x6fa8c9},
    {id:'locket', name:'Empty Locket', desc:"Whoever it was made for isn't written inside.", icon:'\u2724', shape:'locket', hex:0xc9a227},
    {id:'ribbonBundle', name:'Bundle of Ribbon', desc:'Kept for no reason except that it was pretty.', icon:'\u273B', shape:'ring', hex:0xb8546f},
    {id:'spoon', name:'Engraved Spoon', desc:'A single initial, half worn away.', icon:'\u2698', shape:'spoon', hex:0xc8c8c8},
    {id:'buttonTin', name:'Tin of Buttons', desc:'Every button from a coat long since gone.', icon:'\u29EB', shape:'tin', hex:0x8a8a8a},
    {id:'dice', name:'Bone Dice', desc:'The pips have gone yellow with age.', icon:'\u2735', shape:'cube', hex:0xe8ddc0},
    {id:'seaShell', name:'Sea Shell', desc:"Salt-bleached, holding the ocean's leftover hush.", icon:'\u272A', shape:'shell', hex:0xe0c9a8},
    {id:'matchbox', name:'Painted Matchbox', desc:'The matches are gone; the little tin remains.', icon:'\u2736', shape:'tin', hex:0x7d4a2b},
    {id:'stamp', name:'Foreign Stamp', desc:'From a country that changed its name.', icon:'\u274B', shape:'card', hex:0x5b7d6b},
    {id:'keyFob', name:'Brass Key Fob', desc:'A ring with nothing left to hold.', icon:'\u269C', shape:'ring', hex:0xa9793f}
  ];

  const REWARDS_SPECIAL = [
    {id:'musicBox', name:'Wind-Up Music Box', desc:'It still plays, thin and a little off-key.', icon:'\u266B', shape:'box', hex:0xb8935a, special:true},
    {id:'miniSculpture', name:'Tiny Bronze Dancer', desc:'Mid-turn, smaller than your thumb.', icon:'\u27E1', shape:'cone', hex:0x8a6a3f, special:true},
    {id:'pocketWatch', name:'Engraved Pocket Watch', desc:'Two initials, and a date worth remembering.', icon:'\u272A', shape:'watch', hex:0xd8b86a, special:true},
    {id:'loveLetters', name:'Bundle of Letters', desc:'Tied with string, addressed in the same hand each time.', icon:'\u2732', shape:'card', hex:0xc9a8a3, special:true},
    {id:'familyPortrait', name:'Family Portrait', desc:'Everyone in their best clothes, unsmiling, together.', icon:'\u273A', shape:'card', hex:0x8a7256, special:true},
    {id:'heirloomRing', name:'Heirloom Ring', desc:'Too small now for any hand it once fit.', icon:'\u2318', shape:'ring', hex:0xd8b86a, special:true}
  ];

  // scattered furniture pieces beyond the wall — each maps to an animation family
  const CONTAINER_ARCHETYPES = [
    {kind:'jewelryBox',   anim:'lidBox'},
    {kind:'keepsakeBox',  anim:'lidBox'},
    {kind:'cashBox',      anim:'lidBox'},
    {kind:'lockbox',      anim:'lidBox'},
    {kind:'suitcase',     anim:'unfold'},
    {kind:'safe',         anim:'swingDoor'},
    {kind:'standingVault',anim:'swingDoor'},
    {kind:'displayCase',  anim:'swingDoor'},
    {kind:'filingDrawer', anim:'slideDrawer'},
    {kind:'deskDrawer',   anim:'slideDrawer'}
  ];

  function pickActiveValue(rng, dim){
    if(dim === 'number') return { v: rng.int(100, 999) };
    return rng.pick(DIMENSIONS[dim].active);
  }

  function baseAttributes(){
    const a = {};
    for(const dim of CLUE_TYPES) a[dim] = DIMENSIONS[dim].default;
    return a;
  }

  // Finds a combination of 1 (mostly), 2, or occasionally 3 active dimensions
  // whose exact value-set has never been used before in this vault — so every
  // container's full visual "fingerprint" is globally unique. A single shared
  // dimension between two containers is fine (plenty of brass copper keys
  // exist) as long as the *complete* fingerprint always differs.
  function generateSignature(rng, used, fallbackCounter, difficulty){
    for(let attempt = 0; attempt < 600; attempt++){
      const k = pickSignatureSize(rng, difficulty);
      const dims = rng.shuffle(CLUE_TYPES).slice(0, k);
      const picked = {};
      dims.forEach(d => { picked[d] = pickActiveValue(rng, d); });
      const fp = dims.slice().sort().map(d => d + ':' + picked[d].v).join('|');
      if(!used.has(fp)){ used.add(fp); return picked; }
    }
    fallbackCounter.n++;
    return { number: { v: 9000 + fallbackCounter.n } };
  }

  function drawFromPool(rng, pool, count){
    const out = [];
    let remaining = rng.shuffle(pool);
    while(out.length < count){
      if(remaining.length === 0) remaining = rng.shuffle(pool);
      out.push(remaining.pop());
    }
    return out;
  }

  function generate(seed, settingsInput){
    const settings = normalizeSettings(settingsInput);
    const rng = new Utils.RNG(seed);
    const wallCount = settings.wallBoxes;
    const scatteredCount = settings.scatteredContainers;
    const boxCount = wallCount + scatteredCount;

    const usedFingerprints = new Set();
    const fallbackCounter = { n: 0 };
    const wallOrder = rng.shuffle([...Array(wallCount).keys()]);
    const keyOrder = rng.shuffle([...Array(boxCount).keys()]); // tray placement, fully independent of pairing

    let archCursor = 0;
    let archSequence = [];

    const boxes = [];
    const keys = [];
    for(let i = 0; i < boxCount; i++){
      const isWall = i < wallCount;
      const picked = generateSignature(rng, usedFingerprints, fallbackCounter, settings.difficulty);
      const attrs = baseAttributes();
      Object.keys(picked).forEach(d => { attrs[d] = picked[d]; });
      const activeDims = Object.keys(picked);

      let archetype = 'wall';
      if(!isWall){
        if(archSequence.length === 0) archSequence = rng.shuffle(CONTAINER_ARCHETYPES);
        archetype = archSequence[archCursor % archSequence.length].kind;
        archCursor++;
      }
      const animFamily = isWall ? 'slideDrawer' :
        CONTAINER_ARCHETYPES.find(a => a.kind === archetype).anim;

      const boxId = 'box-' + i;
      const keyId = 'key-' + i;
      boxes.push({
        id: boxId, keyId, index: i,
        isWall, archetype, animFamily,
        gridSlot: isWall ? wallOrder[i] : -1,
        attrs, activeDims
      });
      keys.push({ id: keyId, boxId, attrs, activeDims, traySlot: keyOrder[i] });
    }

    // reward queue — indexed by *how many containers the player has opened so
    // far*, not identity, so "the last few" always means the last few the
    // player actually opens, whichever containers those turn out to be.
    const specialSlots = Math.min(2, boxCount);
    const commonSlotCount = boxCount - specialSlots;
    const commonPicks = drawFromPool(rng, REWARDS_COMMON, commonSlotCount);
    const specialPicks = drawFromPool(rng, REWARDS_SPECIAL, specialSlots);

    const milestoneRange = Math.max(0, commonSlotCount);
    const milestoneCount = Utils.clamp(Math.round(milestoneRange / 9), Math.min(4, milestoneRange), Math.min(8, milestoneRange));
    const milestonePositions = new Set();
    if(milestoneRange > 0 && milestoneCount > 0){
      for(let m = 1; m <= milestoneCount; m++){
        const pos = Math.max(1, Math.round((m / (milestoneCount + 1)) * milestoneRange));
        milestonePositions.add(Utils.clamp(pos, 1, milestoneRange));
      }
    }
    const shuffledEffects = rng.shuffle(ENV_EFFECTS);
    let effectCursor = 0;
    const rewardQueue = [];
    for(let i = 0; i < commonSlotCount; i++){
      const pos = i + 1;
      let env = null;
      if(milestonePositions.has(pos)){
        env = shuffledEffects[effectCursor % shuffledEffects.length];
        effectCursor++;
      }
      rewardQueue.push({ reward: commonPicks[i], env, special:false });
    }
    for(let i = 0; i < specialSlots; i++){
      const env = shuffledEffects[effectCursor % shuffledEffects.length];
      effectCursor++;
      rewardQueue.push({ reward: specialPicks[i], env, special:true });
    }

    return { seed, settings, boxCount, wallCount, scatteredCount, boxes, keys, rewardQueue };
  }

  return {
    generate, DIMENSIONS, CLUE_TYPES, CONTAINER_ARCHETYPES, MIN_WALL, MAX_WALL, MIN_SCATTERED, MAX_SCATTERED,
    SETTINGS_SCHEMA, defaultSettings, normalizeSettings
  };
})();
