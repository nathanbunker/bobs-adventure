// Bob's Adventure
// The top half is the game rules (no drawing), so it can be tested on its own.
// The bottom half draws the game and reads the keyboard in the browser.

const TILE = 40;
const COLS = 32;
const ROWS = 18;

// How Bob moves. Numbers are pixels and seconds (a tile is 40 pixels).
// The tuning panel (press T) changes these while playing.
const DEFAULT_TUNING = {
  runSpeed: 220,     // top walking speed
  jumpHeight: 3.2,   // in tiles
  riseTime: 0.38,    // seconds to reach the top of a jump
  fallGravity: 1000, // lower = floatier fall
  maxFall: 300,      // top falling speed; lower = floatier
};
const GROUND_ACCEL = 2400;
const GROUND_DECEL = 2600;
const AIR_ACCEL = 1500;
const AIR_DECEL = 800;
const COYOTE_TIME = 0.1;  // can still jump this long after leaving a ledge
const JUMP_BUFFER = 0.1;  // a jump pressed this early before landing still counts
const SHORT_HOP = 0.45;   // letting go of jump early cuts upward speed to this much
const BOB_W = 30;         // Bob's hitbox; the drawing is a bit bigger
const BOB_H = 32;
const SLEEPY_AFTER = 8;   // seconds with no keys pressed
const BUMP_SPEED = 180;   // hitting a wall faster than this makes Bob grumpy

// Hazards
const POOF_SCARED = 0.18;     // Scared face shows this long before the poof
const POOF_GONE = 0.6;        // time between the poof and coming back
const APPEAR_TIME = 0.35;     // fading back in at the checkpoint
const STALACTITE_SHAKE = 0.5; // warning before it falls
const STALACTITE_GRAVITY = 2000;
const MOSS_DELAY = 0.15;      // moss crumbles this long after Bob steps on it
const STUCK_AFTER = 1.2;      // seconds at the bottom of a pit before Bob gets sad

// Helpers and Frank
const ZIP_SPEED = 280;        // sliding along the zip line
const ZIP_REACH = 130;        // how far below the line Bob can be and still hook on
const SLIME_BOUNCE = 9;       // tiles high
const SLIME_BOUNCE_HELD = 10.5; // holding jump while landing on slime
const FRANK_CHANCE = 0.7;     // chance Frank shows up in a level that has F spots
const FRANK_AFTER = 0.6;      // he can appear once Bob is this far across the level
const FRANK_TIME = 2.4;       // seconds Frank stays

// Portals
const PORTAL_SPARKLE = "#c79bff";

function parseLevel(level) {
  const rows = level.grid.split("\n").filter((r) => r.trim() !== "");
  const tiles = [];
  const stalactites = [];
  const lanterns = [];
  const presents = [];
  const hooks = [];
  const frankSpots = [];
  const zipPosts = [];
  const portals = [];
  const moss = new Map();     // tile index -> { state, timer }
  const pitCells = new Map(); // tile index under moss -> moss tile index above it
  let start = { col: 1, row: 1 };
  for (let row = 0; row < ROWS; row++) {
    const line = (rows[row] || "").padEnd(COLS, ".");
    const cells = [];
    for (let col = 0; col < COLS; col++) {
      let ch = line[col].toUpperCase();
      if (ch === "O") ch = "o";
      if (ch === " ") ch = ".";
      if (ch === "B") { start = { col, row }; ch = "."; }
      if (ch === "V") { stalactites.push({ col, row }); ch = "."; }
      if (ch === "C") { lanterns.push({ col, row, lit: false }); ch = "."; }
      if (ch === "M") moss.set(row * COLS + col, { state: "intact", timer: 0 });
      if (ch === "o") { presents.push({ col, row, taken: false }); ch = "."; }
      if (ch === "H") { hooks.push({ col, row, taken: false }); ch = "."; }
      if (ch === "F") { frankSpots.push({ col, row }); ch = "."; }
      if (ch === "Z") { zipPosts.push({ col, row }); ch = "."; }
      if (ch === "P") { portals.push({ col, row }); ch = "."; }
      cells.push(ch);
    }
    tiles.push(cells);
  }
  // Zip line posts pair up left to right along each row
  const zips = [];
  for (let row = 0; row < ROWS; row++) {
    const posts = zipPosts.filter((p) => p.row === row);
    for (let i = 0; i + 1 < posts.length; i += 2) {
      zips.push({ row, c1: posts[i].col, c2: posts[i + 1].col });
    }
  }
  // The hidden holes under moss
  for (const key of moss.keys()) {
    const col = key % COLS;
    for (let row = Math.floor(key / COLS) + 1; row < ROWS && tiles[row][col] === "."; row++) {
      pitCells.set(row * COLS + col, key);
    }
  }
  return {
    name: level.name, tiles, start, stalactites, lanterns, moss, pitCells,
    presents, hooks, frankSpots, zips,
    portals: portals.length === 2 ? portals : [], // they only work as a pair
    loosePortals: portals.length === 2 ? [] : portals,
  };
}

function createWorld(level, tuning = DEFAULT_TUNING, frankChance = FRANK_CHANCE) {
  const map = parseLevel(level);
  const world = {
    map,
    tuning: { ...tuning },
    time: 0,
    bob: null,
    checkpoint: { ...map.start },
    stalactites: [],
    particles: [],
    complete: false,
    presentsFound: 0,
    hasHook: false,
    near: null,       // what Bob could use right now: { kind: "hook" | "zip" | "zip-no-hook", ... }
    slimeWobble: new Map(),
    frank: null,      // { col, row, time } while Frank is visiting
    frankChance,
    frankRolled: false,
    inPortal: -1,     // the portal Bob is standing in; it won't send him back until he steps out
  };
  resetHazards(world);
  placeBob(world);
  return world;
}

// Stalactites go back up and moss grows back (after every poof)
function resetHazards(world) {
  world.stalactites = world.map.stalactites.map((s) => ({
    col: s.col, y: s.row * TILE, vy: 0, state: "hanging", timer: 0,
  }));
  for (const m of world.map.moss.values()) { m.state = "intact"; m.timer = 0; }
}

function placeBob(world, state = "alive") {
  const { col, row } = world.checkpoint;
  world.bob = {
    x: col * TILE + (TILE - BOB_W) / 2,
    y: (row + 1) * TILE - BOB_H,
    vx: 0, vy: 0,
    onGround: true,
    coyote: 0, buffer: 0,
    rising: false,
    facing: 1,
    mood: "content", moodTimer: 0,
    idle: 0,
    squash: 0,
    state,          // "alive", "poof", "appear" or "zip"
    stateTime: 0,
    zip: null,      // { lineY, toX, dir } while riding a zip line
    poofScared: false,
    burst: false,
    pitTime: 0,
  };
  world.inPortal = portalUnder(world);
}

// The part of a portal tile that sends Bob through
function portalBox(p) {
  return { x: p.col * TILE + 10, y: p.row * TILE + 6, w: TILE - 20, h: TILE - 6 };
}

function portalUnder(world) {
  const box = bobBox(world.bob);
  return world.map.portals.findIndex((p) => overlaps(box, portalBox(p)));
}

// Walking into one portal sends Bob out of the other, still moving the same way
function stepPortals(world) {
  const bob = world.bob;
  const inside = portalUnder(world);
  if (inside !== -1 && world.inPortal === -1) {
    const from = world.map.portals[inside];
    const toIndex = 1 - inside;
    const to = world.map.portals[toIndex];
    sparkle(world, from.col * TILE + 20, from.row * TILE + 20, PORTAL_SPARKLE);
    bob.x = to.col * TILE + (TILE - BOB_W) / 2;
    bob.y = (to.row + 1) * TILE - BOB_H;
    bob.squash = 1;
    sparkle(world, to.col * TILE + 20, to.row * TILE + 20, PORTAL_SPARKLE);
    setMood(bob, "surprised", 0.6);
    world.inPortal = toIndex;
  } else {
    world.inPortal = inside;
  }
}

function tileAt(world, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return "#";
  return world.map.tiles[row][col];
}

function isSolid(world, col, row) {
  const ch = tileAt(world, col, row);
  if (ch === "#") return true;
  if (ch === "M") return world.map.moss.get(row * COLS + col).state !== "gone";
  return false;
}

// Is any solid tile under this rectangle?
function hitsSolid(world, x, y, w, h) {
  const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 0.001) / TILE);
  const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 0.001) / TILE);
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      if (isSolid(world, c, r)) return true;
  return false;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function bobBox(bob) {
  return { x: bob.x, y: bob.y, w: BOB_W, h: BOB_H };
}

function setMood(bob, mood, seconds) {
  bob.mood = mood;
  bob.moodTimer = seconds;
}

function spawn(world, count, make) {
  for (let i = 0; i < count; i++) world.particles.push(make(i));
}
const rand = (a, b) => a + Math.random() * (b - a);

// Bob poofs into little clouds and goes back to the last checkpoint.
// scared = false is for pressing R (no Scared face first).
function poof(world, scared = true) {
  const bob = world.bob;
  if (bob.state !== "alive" || world.complete) return;
  bob.state = "poof";
  bob.stateTime = 0;
  bob.vx = bob.vy = 0;
  bob.poofScared = scared;
  if (scared) setMood(bob, "scared", 1);
}

function stepPoof(world, dt) {
  const bob = world.bob;
  bob.stateTime += dt;
  if (bob.state === "poof") {
    const burstAt = bob.poofScared ? POOF_SCARED : 0;
    if (!bob.burst && bob.stateTime >= burstAt) {
      bob.burst = true;
      const cx = bob.x + BOB_W / 2, cy = bob.y + BOB_H / 2;
      spawn(world, 14, () => ({
        kind: "puff", x: cx + rand(-14, 14), y: cy + rand(-12, 12),
        vx: rand(-70, 70), vy: rand(-90, -20), gravity: -30,
        life: rand(0.5, 0.9), size: rand(5, 12), color: "#ffffff",
      }));
    }
    if (bob.stateTime >= burstAt + POOF_GONE) {
      resetHazards(world);
      placeBob(world, "appear");
    }
  } else if (bob.state === "appear" && bob.stateTime >= APPEAR_TIME) {
    bob.state = "alive";
    bob.stateTime = 0;
  }
}

function crumbleMoss(world, key) {
  // The whole patch of moss goes at once
  const todo = [key];
  while (todo.length) {
    const k = todo.pop();
    const m = world.map.moss.get(k);
    if (!m || m.state !== "intact") continue;
    m.state = "crumbling";
    m.timer = MOSS_DELAY;
    const col = k % COLS;
    if (col > 0) todo.push(k - 1);
    if (col < COLS - 1) todo.push(k + 1);
    todo.push(k - COLS, k + COLS);
  }
  setMood(world.bob, "surprised", 1.2);
}

function stepHazards(world, dt) {
  const bob = world.bob;
  const alive = bob.state === "alive" && !world.complete;
  const box = bobBox(bob);
  const bobCenter = bob.x + BOB_W / 2;

  // Moss
  for (const [key, m] of world.map.moss) {
    if (m.state === "crumbling") {
      m.timer -= dt;
      if (m.timer <= 0) {
        m.state = "gone";
        const x = (key % COLS) * TILE, y = Math.floor(key / COLS) * TILE;
        spawn(world, 8, () => ({
          kind: "bit", x: x + rand(4, 36), y: y + rand(0, 14),
          vx: rand(-30, 30), vy: rand(0, 60), gravity: 700,
          life: rand(0.4, 0.8), size: rand(3, 6), color: Math.random() < 0.6 ? "#7fb069" : "#4f5f8f",
        }));
      }
    } else if (m.state === "intact" && Math.random() < dt * 0.5) {
      // The clue: little spores drift up off the moss
      const x = (key % COLS) * TILE, y = Math.floor(key / COLS) * TILE;
      spawn(world, 1, () => ({
        kind: "spore", x: x + rand(6, 34), y: y + 4,
        vx: rand(-6, 6), vy: rand(-22, -12), gravity: 0,
        life: rand(1.2, 2), size: rand(1.5, 2.5), color: "#a8d88f",
      }));
    }
  }

  // Stalactites
  for (const s of world.stalactites) {
    const sx = s.col * TILE;
    if (s.state === "hanging") {
      if (alive && bob.x < sx + TILE - 4 && bob.x + BOB_W > sx + 4 && bob.y > s.y) {
        s.state = "shaking";
        s.timer = STALACTITE_SHAKE;
      }
    } else if (s.state === "shaking") {
      s.timer -= dt;
      if (s.timer <= 0) s.state = "falling";
    } else if (s.state === "falling") {
      s.vy += STALACTITE_GRAVITY * dt;
      s.y += s.vy * dt;
      if (alive && overlaps(box, { x: sx + 12, y: s.y + 4, w: 16, h: 30 })) poof(world);
      const tipRow = Math.floor((s.y + 36) / TILE);
      if (isSolid(world, s.col, tipRow)) {
        s.state = "gone";
        spawn(world, 7, () => ({
          kind: "bit", x: sx + 20 + rand(-8, 8), y: tipRow * TILE - 4,
          vx: rand(-140, 140), vy: rand(-220, -60), gravity: 1000,
          life: rand(0.4, 0.7), size: rand(3, 6), color: "#8e9bc9",
        }));
      }
    }
    if (alive && (s.state === "shaking" || s.state === "falling") &&
        Math.abs(bobCenter - (sx + TILE / 2)) < 2 * TILE) {
      setMood(bob, "scared", 0.25);
    }
  }

  if (!alive) return;

  // Spikes, lanterns and the exit
  const c0 = Math.floor(bob.x / TILE) - 2, c1 = Math.floor((bob.x + BOB_W) / TILE) + 2;
  const r0 = Math.floor(bob.y / TILE) - 1, r1 = Math.floor((bob.y + BOB_H) / TILE) + 1;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = tileAt(world, c, r);
      const x = c * TILE, y = r * TILE;
      if (ch === "^") {
        if (overlaps(box, { x: x + 6, y: y + 16, w: TILE - 12, h: TILE - 16 })) { poof(world); return; }
        if (bob.onGround && Math.abs(bobCenter - (x + TILE / 2)) < 1.3 * TILE) setMood(bob, "scared", 0.25);
      }
      if (ch === "X" && overlaps(box, { x: x + 8, y: y - TILE, w: TILE - 16, h: 2 * TILE })) {
        world.complete = true;
        setMood(bob, "happy", Infinity);
        return;
      }
    }
  }
  for (const lantern of world.map.lanterns) {
    if (overlaps(box, { x: lantern.col * TILE + 6, y: lantern.row * TILE, w: TILE - 12, h: TILE }) &&
        (world.checkpoint.col !== lantern.col || world.checkpoint.row !== lantern.row)) {
      lantern.lit = true;
      world.checkpoint = { col: lantern.col, row: lantern.row };
      setMood(bob, "happy", 1.2);
      spawn(world, 10, () => ({
        kind: "puff", x: lantern.col * TILE + 20, y: lantern.row * TILE + 12,
        vx: rand(-60, 60), vy: rand(-90, -10), gravity: 60,
        life: rand(0.4, 0.8), size: rand(2, 4), color: "#ffe9a8",
      }));
    }
  }

  // Stuck at the bottom of a moss pit
  const centerCell = Math.floor((bob.y + BOB_H / 2) / TILE) * COLS + Math.floor(bobCenter / TILE);
  if (bob.onGround && world.map.pitCells.has(centerCell)) {
    bob.pitTime += dt;
    if (bob.pitTime > STUCK_AFTER) setMood(bob, "sad", 0.3);
  } else {
    bob.pitTime = 0;
  }
}

function sparkle(world, x, y, color = "#ffe9a8") {
  spawn(world, 10, () => ({
    kind: "puff", x, y,
    vx: rand(-70, 70), vy: rand(-100, -10), gravity: 80,
    life: rand(0.4, 0.8), size: rand(2, 4), color,
  }));
}

function collectPresents(world) {
  const bob = world.bob;
  const box = bobBox(bob);
  for (const p of world.map.presents) {
    if (!p.taken && overlaps(box, { x: p.col * TILE + 8, y: p.row * TILE + 8, w: 24, h: 24 })) {
      p.taken = true;
      world.presentsFound++;
      setMood(bob, "happy", 0.6);
      sparkle(world, p.col * TILE + 20, p.row * TILE + 20, "#ffd27a");
    }
  }
}

// Presents, the hook, zip lines, slime and Frank
function stepThings(world, input, dt) {
  const bob = world.bob;
  const box = bobBox(bob);
  const bobCenter = bob.x + BOB_W / 2;
  const t = world.tuning;

  collectPresents(world);
  stepPortals(world);

  // What could Bob use with the interact key?
  world.near = null;
  for (const h of world.map.hooks) {
    if (!h.taken && overlaps(box, { x: h.col * TILE - 16, y: h.row * TILE - 10, w: TILE + 32, h: TILE + 20 })) {
      world.near = { kind: "hook", hook: h };
    }
  }
  for (const z of world.map.zips) {
    const lineY = z.row * TILE + 8;
    for (const [from, to] of [[z.c1, z.c2], [z.c2, z.c1]]) {
      const postX = from * TILE + TILE / 2;
      if (Math.abs(bobCenter - postX) < 28 && bob.y > lineY && bob.y - lineY < ZIP_REACH) {
        world.near = world.hasHook
          ? { kind: "zip", zip: z, from, to, lineY }
          : { kind: "zip-no-hook", zip: z, from };
      }
    }
  }
  if (world.near && world.near.kind === "zip-no-hook") setMood(bob, "surprised", 0.3);

  if (input.interactPressed && world.near) {
    const n = world.near;
    if (n.kind === "hook") {
      n.hook.taken = true;
      world.hasHook = true;
      setMood(bob, "happy", 1);
      sparkle(world, n.hook.col * TILE + 20, n.hook.row * TILE + 20);
    } else if (n.kind === "zip") {
      const dir = n.to > n.from ? 1 : -1;
      bob.state = "zip";
      bob.zip = { lineY: n.lineY, toX: n.to * TILE + (TILE - BOB_W) / 2, dir };
      bob.x = n.from * TILE + (TILE - BOB_W) / 2;
      bob.facing = dir;
      bob.vx = bob.vy = 0;
      setMood(bob, "happy", 0.5);
    }
    world.near = null;
  }

  // Bouncy slime: touching it with Bob's feet launches him
  const feetRow = Math.floor((bob.y + BOB_H - 1) / TILE);
  for (let c = Math.floor(bob.x / TILE); c <= Math.floor((bob.x + BOB_W - 0.001) / TILE); c++) {
    if (tileAt(world, c, feetRow) === "~" && bob.vy >= 0 && bob.y + BOB_H > feetRow * TILE + 16) {
      const riseGravity = (2 * t.jumpHeight * TILE) / (t.riseTime * t.riseTime);
      const height = (input.jumpHeld ? SLIME_BOUNCE_HELD : SLIME_BOUNCE) * TILE;
      bob.vy = -Math.sqrt(2 * riseGravity * height);
      bob.onGround = false;
      bob.rising = false;
      bob.coyote = 0;
      bob.squash = 1;
      world.slimeWobble.set(feetRow * COLS + c, 1);
      setMood(bob, "happy", 0.8);
      break;
    }
  }
  for (const [k, v] of world.slimeWobble) world.slimeWobble.set(k, Math.max(0, v - dt * 2));

  // Frank pops in once, maybe, near the end of the level
  if (!world.frankRolled && world.map.frankSpots.length && bobCenter > FRANK_AFTER * COLS * TILE) {
    world.frankRolled = true;
    if (Math.random() < world.frankChance) {
      const spot = world.map.frankSpots[Math.floor(Math.random() * world.map.frankSpots.length)];
      world.frank = { col: spot.col, row: spot.row, time: 0 };
    }
  }
  if (world.frank) setMood(bob, "grumpy", 0.3);
}

function stepZip(world, dt) {
  const bob = world.bob;
  const z = bob.zip;
  bob.x += z.dir * ZIP_SPEED * dt;
  bob.y = z.lineY + 14;
  collectPresents(world);
  if ((z.dir > 0 && bob.x >= z.toX) || (z.dir < 0 && bob.x <= z.toX)) {
    bob.x = z.toX;
    bob.state = "alive";
    bob.zip = null;
    bob.vx = z.dir * 60;
    bob.vy = 0;
    bob.onGround = false;
  }
}

function stepParticles(world, dt) {
  for (const p of world.particles) {
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.age = (p.age || 0) + dt;
  }
  world.particles = world.particles.filter((p) => p.age < p.life);
}

// input: { left, right, jumpHeld, jumpPressed, interactPressed, anyKey }
function step(world, input, dt) {
  const t = world.tuning;
  const bob = world.bob;
  world.time += dt;
  stepParticles(world, dt);
  if (world.frank && (world.frank.time += dt) > FRANK_TIME) world.frank = null;
  stepHazards(world, dt);
  if (bob.state === "zip") { stepZip(world, dt); return; }
  if (bob.state !== "alive") { stepPoof(world, dt); return; }
  if (world.complete) return;

  const riseGravity = (2 * t.jumpHeight * TILE) / (t.riseTime * t.riseTime);
  const jumpSpeed = riseGravity * t.riseTime;

  // Walking
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) bob.facing = dir;
  const target = dir * t.runSpeed;
  const rate = dir !== 0
    ? (bob.onGround ? GROUND_ACCEL : AIR_ACCEL)
    : (bob.onGround ? GROUND_DECEL : AIR_DECEL);
  if (bob.vx < target) bob.vx = Math.min(target, bob.vx + rate * dt);
  else if (bob.vx > target) bob.vx = Math.max(target, bob.vx - rate * dt);

  // Jumping, with coyote time and jump buffering
  bob.buffer = input.jumpPressed ? JUMP_BUFFER : bob.buffer - dt;
  bob.coyote = bob.onGround ? COYOTE_TIME : bob.coyote - dt;
  if (bob.buffer > 0 && bob.coyote > 0) {
    bob.vy = -jumpSpeed;
    bob.buffer = 0;
    bob.coyote = 0;
    bob.onGround = false;
    bob.rising = true;
  }
  if (bob.rising && !input.jumpHeld && bob.vy < 0) {
    bob.vy *= SHORT_HOP;
    bob.rising = false;
  }
  if (bob.vy >= 0) bob.rising = false;

  // Gravity: strong going up, gentle coming down (ghosts float)
  bob.vy += (bob.vy < 0 ? riseGravity : t.fallGravity) * dt;
  if (bob.vy > t.maxFall) bob.vy = t.maxFall;

  // Move sideways, stopping at walls
  bob.x += bob.vx * dt;
  if (hitsSolid(world, bob.x, bob.y, BOB_W, BOB_H)) {
    if (Math.abs(bob.vx) > BUMP_SPEED && dir !== 0) setMood(bob, "grumpy", 1);
    bob.x = bob.vx > 0
      ? Math.floor((bob.x + BOB_W) / TILE) * TILE - BOB_W
      : Math.floor(bob.x / TILE) * TILE + TILE;
    bob.vx = 0;
  }

  // Move up or down, landing on floors and bonking ceilings
  const wasOnGround = bob.onGround;
  const fallSpeed = bob.vy;
  bob.onGround = false;
  bob.y += bob.vy * dt;
  if (hitsSolid(world, bob.x, bob.y, BOB_W, BOB_H)) {
    if (bob.vy > 0) {
      bob.y = Math.floor((bob.y + BOB_H) / TILE) * TILE - BOB_H;
      bob.onGround = true;
      if (!wasOnGround && fallSpeed > 150) bob.squash = 1;
    } else {
      bob.y = Math.floor(bob.y / TILE) * TILE + TILE;
    }
    bob.vy = 0;
  }

  // Stepping on moss
  if (bob.onGround) {
    const row = Math.floor((bob.y + BOB_H + 1) / TILE);
    for (let c = Math.floor(bob.x / TILE); c <= Math.floor((bob.x + BOB_W - 0.001) / TILE); c++) {
      const m = world.map.moss.get(row * COLS + c);
      if (m && m.state === "intact" && tileAt(world, c, row) === "M") crumbleMoss(world, row * COLS + c);
    }
  }

  stepThings(world, input, dt);

  // Moods
  bob.idle = input.anyKey ? 0 : bob.idle + dt;
  if (bob.moodTimer > 0) bob.moodTimer -= dt;
  else bob.mood = bob.idle > SLEEPY_AFTER ? "sleepy" : "content";

  bob.squash = Math.max(0, bob.squash - dt * 6);
}

if (typeof module !== "undefined") {
  module.exports = { createWorld, placeBob, poof, step, TILE, COLS, BOB_W, DEFAULT_TUNING };
}

// ---------------------------------------------------------------------------
// Browser: drawing and keyboard
// ---------------------------------------------------------------------------

if (typeof window !== "undefined") {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const MOODS = ["happy", "content", "sad", "surprised", "sleepy", "grumpy", "scared", "in-love"];
  const sprites = {};
  for (const m of MOODS) {
    sprites[m] = new Image();
    sprites[m].src = `art/ghost-${m}.svg`;
  }
  const frankImg = new Image();
  frankImg.src = "art/frank.svg";
  const ruby = {};
  for (const m of ["content", "in-love"]) {
    ruby[m] = new Image();
    ruby[m].src = `art/ruby-${m}.svg`;
  }

  // Tuning is remembered in this browser so a good feel isn't lost.
  let tuning = { ...DEFAULT_TUNING };
  try {
    Object.assign(tuning, JSON.parse(localStorage.getItem("ghost-tuning") || "{}"));
  } catch (e) {}

  // The Level Workshop (editor.html) opens the game with a level in the link
  // (play.html#test=...) so it can be tried right away.
  let testMode = false;
  const testLink = location.hash.match(/^#test=(.+)$/);
  if (testLink) {
    try {
      const level = JSON.parse(decodeURIComponent(testLink[1]));
      LEVELS.length = 0;
      LEVELS.push(level);
      testMode = true;
    } catch (e) {}
  }

  let levelIndex = 0;
  let world = createWorld(LEVELS[levelIndex], tuning);
  let presentsTotal = 0; // wedding presents from finished levels
  let presentsPossible = 0;

  // Which screen is showing: "title", "story", "play" or "ending"
  let scene = testMode ? "play" : "title";
  let sceneTime = 0;
  let storyPage = 0;
  let paused = false;
  let pauseChoice = 0;
  const PAUSE_CHOICES = testMode
    ? ["Keep playing", "Restart this level"]
    : ["Keep playing", "Restart this level", "Back to the title"];

  function loadLevel(index) {
    levelIndex = index;
    world = createWorld(LEVELS[levelIndex], tuning);
  }

  function goTo(newScene) {
    scene = newScene;
    sceneTime = 0;
    paused = false;
    keys.clear();
  }

  function startGame() {
    presentsTotal = 0;
    presentsPossible = 0;
    storyPage = 0;
    goTo("story");
  }

  function startLevels() {
    loadLevel(0);
    goTo("play");
  }

  const keys = new Set();
  let jumpPressed = false;
  let interactPressed = false;
  const JUMP_KEYS = ["ArrowUp", "KeyW", "Space"];
  const INTERACT_KEYS = ["KeyE", "ArrowDown", "KeyS"];
  const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];

  addEventListener("keydown", (e) => {
    if (e.code === "KeyT") { togglePanel(); return; }
    if (e.target.tagName === "INPUT") return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    const choose = e.code === "Enter" || e.code === "Space";

    if (scene === "title") {
      if (choose) startGame();
      return;
    }
    if (scene === "story") {
      if (e.code === "Escape") startLevels(); // skip the whole story
      else if (sceneTime > 0.4) {
        storyPage++;
        sceneTime = 0;
        if (storyPage >= STORY.intro.length) startLevels();
      }
      return;
    }
    if (scene === "ending") {
      if (sceneTime > 6) goTo("title");
      return;
    }

    // Playing
    if (paused) {
      if (e.code === "ArrowUp" || e.code === "KeyW") pauseChoice = (pauseChoice + PAUSE_CHOICES.length - 1) % PAUSE_CHOICES.length;
      if (e.code === "ArrowDown" || e.code === "KeyS") pauseChoice = (pauseChoice + 1) % PAUSE_CHOICES.length;
      if (e.code === "Escape" || e.code === "KeyP") paused = false;
      if (choose) {
        paused = false;
        if (pauseChoice === 1) loadLevel(levelIndex);
        if (pauseChoice === 2) goTo("title");
      }
      return;
    }
    if (e.code === "Escape" || e.code === "KeyP") {
      paused = true;
      pauseChoice = 0;
      keys.clear();
      return;
    }
    if (world.complete) {
      // Wait a moment so a held key doesn't skip the "Level complete!" screen
      if (world.time - completeAt > 0.6) {
        if (testMode) loadLevel(0); // try it again
        else if (levelIndex === LEVELS.length - 1) goTo("ending");
        else loadLevel(levelIndex + 1);
      }
      return;
    }
    keys.add(e.code);
    if (JUMP_KEYS.includes(e.code)) jumpPressed = true;
    if (INTERACT_KEYS.includes(e.code)) interactPressed = true;
    if (e.code === "KeyR") poof(world, false);
    // Number keys jump straight to a level
    const levelKey = e.code.match(/^Digit([1-9])$/);
    if (levelKey && Number(levelKey[1]) <= LEVELS.length) loadLevel(Number(levelKey[1]) - 1);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());

  function readInput() {
    const input = {
      left: keys.has("ArrowLeft") || keys.has("KeyA"),
      right: keys.has("ArrowRight") || keys.has("KeyD"),
      jumpHeld: JUMP_KEYS.some((k) => keys.has(k)),
      jumpPressed,
      interactPressed,
      anyKey: keys.size > 0,
    };
    jumpPressed = false;
    interactPressed = false;
    return input;
  }

  // ---- Drawing ----
  const COLORS = {
    sky: "#151b30",
    rock: "#3b4675",
    rockTop: "#5a68a0",
    mossTop: "#6f9a63",
    mossTuft: "#86b277",
    outline: "#333333",
    spike: "#c9cfe8",
    stalactite: "#8e9bc9",
    lanternOff: "#6b7396",
    lanternOn: "#ffe9a8",
    exit: "#fff4cf",
    hint: "rgba(238, 241, 255, 0.28)",
    text: "#eef1ff",
    muted: "#aeb6dc",
    panel: "rgba(21, 27, 48, 0.88)",
    present: "#ffd27a",
    bow: "#ff5c8a",
    metal: "#d5dbef",
    wood: "#9a7350",
    rope: "#e2d3ad",
    slime: "#79d66f",
    slimeDark: "#4fa548",
    portal: "#c79bff",
  };
  // Things that come in later steps still show as dashed boxes
  const PLACEHOLDERS = new Set(["R"]);

  function mossIntact(key) {
    const m = world.map.moss.get(key);
    return m && m.state !== "gone";
  }

  function drawRock(x, y, topEdge) {
    ctx.fillStyle = COLORS.rock;
    ctx.fillRect(x, y, TILE, TILE);
    if (topEdge) {
      ctx.fillStyle = COLORS.rockTop;
      ctx.fillRect(x, y, TILE, 6);
    }
  }

  // Rock, moss, or a hole still hidden under moss
  function looksSolid(c, r) {
    if (r < 0) return true;
    const ch = world.map.tiles[r][c];
    const key = r * COLS + c;
    if (ch === "#") return true;
    if (ch === "M") return mossIntact(key);
    return world.map.pitCells.has(key) && mossIntact(world.map.pitCells.get(key));
  }

  function drawTiles() {
    const tiles = world.map.tiles;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = tiles[r][c];
        const key = r * COLS + c;
        const x = c * TILE, y = r * TILE;
        if (ch === "#") {
          drawRock(x, y, !looksSolid(c, r - 1));
        } else if (world.map.pitCells.has(key) && mossIntact(world.map.pitCells.get(key))) {
          drawRock(x, y, false); // the hole stays hidden until the moss goes
        } else if (ch === "M" && mossIntact(key)) {
          drawMoss(x, y, world.map.moss.get(key));
        } else if (ch === "^") {
          drawSpikes(x, y);
        } else if (ch === "~") {
          drawSlime(x, y, world.slimeWobble.get(key) || 0);
        } else if (PLACEHOLDERS.has(ch)) {
          ctx.strokeStyle = COLORS.hint;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.setLineDash([]);
          ctx.fillStyle = COLORS.hint;
          ctx.font = "bold 18px Nunito, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ch, x + TILE / 2, y + TILE / 2);
        }
      }
    }
  }

  function drawMoss(x, y, m) {
    const shake = m.state === "crumbling" ? rand(-2, 2) : 0;
    ctx.save();
    ctx.translate(shake, 0);
    drawRock(x, y, false);
    ctx.fillStyle = COLORS.mossTop;
    ctx.fillRect(x, y, TILE, 9);
    ctx.fillStyle = COLORS.mossTuft;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + 5 + i * 10, y + 2, 4, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSpikes(x, y) {
    ctx.fillStyle = COLORS.spike;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    for (let i = 0; i < 3; i++) {
      const sx = x + 2 + i * 12;
      ctx.beginPath();
      ctx.moveTo(sx, y + TILE);
      ctx.lineTo(sx + 6, y + 14);
      ctx.lineTo(sx + 12, y + TILE);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawSlime(x, y, wobble) {
    // Squishes down and springs back after a bounce
    const squish = Math.sin(wobble * Math.PI * 4) * wobble;
    const h = 22 * (1 - 0.35 * squish), w = TILE * (1 + 0.1 * squish);
    const cx = x + TILE / 2, bottom = y + TILE;
    ctx.fillStyle = COLORS.slime;
    ctx.strokeStyle = COLORS.slimeDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, bottom);
    ctx.bezierCurveTo(cx - w / 2, bottom - h * 1.3, cx + w / 2, bottom - h * 1.3, cx + w / 2, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.beginPath();
    ctx.ellipse(cx - 6, bottom - h * 0.65, 5, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // A glowing orb with a little pink bow: a wedding present
  function drawPresent(cx, cy, scale = 1, glowOn = true) {
    if (glowOn) {
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 24 * scale);
      glow.addColorStop(0, "rgba(255, 210, 122, 0.45)");
      glow.addColorStop(1, "rgba(255, 210, 122, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 26 * scale, cy - 26 * scale, 52 * scale, 52 * scale);
    }
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2;
    ctx.fillStyle = COLORS.present;
    ctx.beginPath();
    ctx.arc(cx, cy, 9 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(cx - 3 * scale, cy - 2 * scale, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    // The bow on top
    ctx.fillStyle = COLORS.bow;
    ctx.lineWidth = 1.5;
    const by = cy - 9 * scale;
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, by);
      ctx.lineTo(cx + d * 7 * scale, by - 4 * scale);
      ctx.lineTo(cx + d * 7 * scale, by + 4 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, by, 2.2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawPresents() {
    for (const p of world.map.presents) {
      if (p.taken) continue;
      const float = Math.sin(world.time * 2.5 + p.col) * 3;
      drawPresent(p.col * TILE + 20, p.row * TILE + 22 + float);
    }
  }

  function drawHookShape(cx, cy, scale = 1) {
    ctx.lineCap = "round";
    // Dark outline first, then the metal on top
    for (const [color, width] of [[COLORS.outline, 7], [COLORS.metal, 3.5]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width * scale;
      ctx.beginPath();
      ctx.arc(cx, cy - 10 * scale, 4 * scale, 0, Math.PI * 2); // ring
      ctx.moveTo(cx, cy - 6 * scale);
      ctx.lineTo(cx, cy + 4 * scale);
      ctx.arc(cx - 6 * scale, cy + 4 * scale, 6 * scale, 0, Math.PI); // the curve
      ctx.stroke();
    }
  }

  function drawHooks() {
    for (const h of world.map.hooks) {
      if (h.taken) continue;
      const cx = h.col * TILE + 22, cy = h.row * TILE + 20 + Math.sin(world.time * 2) * 3;
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28);
      glow.addColorStop(0, "rgba(213, 219, 239, 0.4)");
      glow.addColorStop(1, "rgba(213, 219, 239, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 30, cy - 30, 60, 60);
      drawHookShape(cx, cy);
    }
  }

  function drawZips() {
    for (const z of world.map.zips) {
      const lineY = z.row * TILE + 8;
      for (const c of [z.c1, z.c2]) {
        // The post goes down to the ground
        let r = z.row;
        while (r < ROWS - 1 && !isSolid(world, c, r + 1)) r++;
        const x = c * TILE + TILE / 2;
        ctx.fillStyle = COLORS.wood;
        ctx.strokeStyle = COLORS.outline;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(x - 4, lineY - 6, 8, (r + 1) * TILE - lineY + 6);
        ctx.fill();
        ctx.stroke();
      }
      const x1 = z.c1 * TILE + TILE / 2, x2 = z.c2 * TILE + TILE / 2;
      ctx.strokeStyle = COLORS.rope;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, lineY);
      ctx.quadraticCurveTo((x1 + x2) / 2, lineY + 6, x2, lineY);
      ctx.stroke();
    }
  }

  function drawFrank() {
    const f = world.frank;
    if (!f) return;
    const fade = Math.min(1, f.time / 0.3, (FRANK_TIME - f.time) / 0.3);
    const cx = f.col * TILE + TILE / 2, bottom = (f.row + 1) * TILE;
    const float = Math.sin(world.time * 4) * 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    if (frankImg.complete && frankImg.naturalWidth) ctx.drawImage(frankImg, cx - 30, bottom - 54 + float, 60, 54);
    if (f.time > 0.25) bubble(STORY.frankSays, cx, bottom - 60);
    ctx.restore();
  }

  function eKey(cx, bottom) {
    const y = bottom - 26 + Math.sin(world.time * 5) * 2;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx - 13, y, 26, 24, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.outline;
    ctx.font = "800 16px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("E", cx, y + 13);
  }

  // The "E" bubble, or Bob wondering where to find a hook
  function drawNear() {
    const n = world.near;
    const bob = world.bob;
    if (!n || bob.state !== "alive") return;
    if (n.kind === "hook") eKey(n.hook.col * TILE + 22, n.hook.row * TILE - 4);
    if (n.kind === "zip") eKey(n.from * TILE + TILE / 2, n.lineY - 10);
    if (n.kind === "zip-no-hook") {
      const cx = bob.x + BOB_W / 2, top = bob.y - 14;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2.5;
      for (const [dx, dy, r] of [[10, -2, 3], [16, -10, 5]]) {
        ctx.beginPath();
        ctx.arc(cx + dx, top + dy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(cx + 30, top - 34, 22, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawHookShape(cx + 32, top - 33, 0.8);
    }
  }

  function drawExit(x, y) {
    const pulse = 0.85 + 0.15 * Math.sin(world.time * 3);
    const cx = x + TILE / 2, top = y - TILE + 6, bottom = y + TILE;
    const glow = ctx.createRadialGradient(cx, y + 6, 4, cx, y + 6, 70 * pulse);
    glow.addColorStop(0, "rgba(255, 244, 207, 0.55)");
    glow.addColorStop(1, "rgba(255, 244, 207, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 80, y - 80, 160, 160);
    ctx.fillStyle = COLORS.exit;
    ctx.beginPath();
    ctx.moveTo(cx - 17, bottom);
    ctx.lineTo(cx - 17, top + 17);
    ctx.arc(cx, top + 17, 17, Math.PI, 0);
    ctx.lineTo(cx + 17, bottom);
    ctx.closePath();
    ctx.fill();
  }

  // A swirling purple doorway. Both portals look the same so it's clear they go together.
  function drawPortal(p, awake) {
    const cx = p.col * TILE + TILE / 2, cy = p.row * TILE + 18;
    const t = world.time;
    ctx.save();
    if (awake) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 3 + p.col);
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 46 * pulse);
      glow.addColorStop(0, "rgba(199, 155, 255, 0.55)");
      glow.addColorStop(1, "rgba(199, 155, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 50, cy - 50, 100, 100);
    } else {
      ctx.globalAlpha = 0.45;
    }
    ctx.fillStyle = awake ? "#2a1650" : "#252a40";
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 15, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = awake ? COLORS.portal : "#8c93b3";
    ctx.lineWidth = 3.5;
    ctx.stroke();
    if (awake) {
      // The swirl inside
      ctx.strokeStyle = "rgba(199, 155, 255, 0.8)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 9 - i * 2.5, 14 - i * 4, 0, a, a + Math.PI * 1.1);
        ctx.stroke();
      }
      // Sparkles going round the edge
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 5; i++) {
        const a = -t * 2 + (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 15, cy + Math.sin(a) * 22, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPortals() {
    for (const p of world.map.portals) drawPortal(p, true);
    for (const p of world.map.loosePortals) drawPortal(p, false);
  }

  function drawStalactites() {
    for (const s of world.stalactites) {
      if (s.state === "gone") continue;
      const shake = s.state === "shaking" ? rand(-2.5, 2.5) : 0;
      const x = s.col * TILE + shake;
      ctx.fillStyle = COLORS.stalactite;
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x + 6, s.y);
      ctx.lineTo(x + 34, s.y);
      ctx.lineTo(x + 20, s.y + 38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawLanterns() {
    for (const l of world.map.lanterns) {
      const x = l.col * TILE, y = l.row * TILE;
      if (l.lit) {
        const glow = ctx.createRadialGradient(x + 20, y + 14, 2, x + 20, y + 14, 60);
        glow.addColorStop(0, "rgba(255, 233, 168, 0.5)");
        glow.addColorStop(1, "rgba(255, 233, 168, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x - 40, y - 46, 120, 120);
      }
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2.5;
      ctx.fillStyle = COLORS.lanternOff;
      ctx.fillRect(x + 18, y + 22, 4, 18); // post
      ctx.beginPath();
      ctx.roundRect(x + 11, y + 4, 18, 20, 4);
      ctx.fillStyle = l.lit ? COLORS.lanternOn : COLORS.lanternOff;
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawParticles() {
    for (const p of world.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.kind === "bit") ctx.rect(p.x, p.y, p.size, p.size);
      else ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBob() {
    const bob = world.bob;
    let alpha = 1;
    if (bob.state === "poof" && bob.burst) return;
    if (bob.state === "appear") alpha = Math.min(1, bob.stateTime / APPEAR_TIME);
    const img = sprites[bob.mood];
    const w = 48, h = 43.2; // 200:180, same shape as the SVGs
    const standingStill = bob.onGround && Math.abs(bob.vx) < 10;
    // The float: up 8 pixels and back every 1.6 seconds, like the gallery
    const float = standingStill ? -4 + 4 * Math.cos((world.time / 1.6) * 2 * Math.PI) : 0;
    const shake = bob.state === "poof" ? rand(-2, 2) : 0;
    const sx = 1 + bob.squash * 0.12, sy = 1 - bob.squash * 0.12;
    const tilt = (bob.vx / world.tuning.runSpeed) * 0.08;
    if (bob.state === "zip") drawHookShape(bob.x + BOB_W / 2 + 6, bob.zip.lineY + 10, 0.7);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(bob.x + BOB_W / 2 + shake, bob.y + BOB_H + 4 + float);
    ctx.rotate(tilt);
    ctx.scale(sx * bob.facing, sy);
    if (img.complete && img.naturalWidth) ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();

    if (bob.mood === "sad") bubble("Stuck? Press R", bob.x + BOB_W / 2, bob.y - 22);
  }

  function bubble(text, cx, bottom) {
    ctx.font = "700 20px Gaegu, 'Comic Sans MS', cursive";
    const w = ctx.measureText(text).width + 22;
    cx = Math.min(Math.max(cx, w / 2 + 8), COLS * TILE - w / 2 - 8); // keep it on screen
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, bottom - 32, w, 30, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.outline;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, bottom - 16);
  }

  function drawHud() {
    ctx.fillStyle = COLORS.text;
    ctx.font = "700 22px Gaegu, 'Comic Sans MS', cursive";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(testMode ? `Testing: ${world.map.name}` : `Level ${levelIndex + 1}: ${world.map.name}`, 52, 8);

    // Presents found, and the hook once Bob has it
    const right = COLS * TILE - 52;
    const count = `${world.presentsFound} / ${world.map.presents.length}`;
    ctx.textAlign = "right";
    ctx.fillText(count, right, 8);
    const countW = ctx.measureText(count).width;
    drawPresent(right - countW - 18, 22, 0.8, false);
    if (world.hasHook) drawHookShape(right - countW - 52, 22, 0.8);

    ctx.fillStyle = COLORS.muted;
    ctx.font = "14px Nunito, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`← → move    ↑ / Space jump    E / ↓ use    R back to lantern    Esc pause    ${testMode ? "" : `1-${Math.min(9, LEVELS.length)} level    `}T tuning`, 52, ROWS * TILE - 20);
  }

  let completeAt = 0;
  function drawComplete() {
    if (!world.complete) { completeAt = world.time; return; }
    if (!world.counted) {
      presentsTotal += world.presentsFound;
      presentsPossible += world.map.presents.length;
      world.counted = true;
    }
    const last = levelIndex === LEVELS.length - 1;
    ctx.fillStyle = COLORS.panel;
    ctx.beginPath();
    ctx.roundRect(370, 210, 540, 250, 24);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.lanternOn;
    ctx.font = "700 60px Gaegu, 'Comic Sans MS', cursive";
    ctx.fillText("Level complete!", 640, 275);
    const found = `Presents found: ${world.presentsFound} of ${world.map.presents.length}`;
    ctx.fillStyle = COLORS.text;
    ctx.font = "700 26px Gaegu, 'Comic Sans MS', cursive";
    ctx.fillText(found, 652, 335);
    drawPresent(652 - ctx.measureText(found).width / 2 - 20, 337, 0.9, false);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "16px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Wedding presents for Ruby so far: ${presentsTotal}`, 640, 372);
    ctx.fillStyle = COLORS.text;
    ctx.font = "18px Nunito, sans-serif";
    ctx.fillText(testMode ? "It works! Press any key to try it again." : last ? "Press any key... Ruby is waiting!" : "Press any key for the next level", 640, 418);
  }

  // ---- Title, story and ending screens ----
  const W = COLS * TILE, H = ROWS * TILE, GROUND = 560;
  const STARS = Array.from({ length: 70 }, (_, i) => [(i * 197 + 31) % W, (i * 113 + 17) % 400, (i % 3) * 0.6 + 0.8]);
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  function drawGhost(img, cx, bottom, width = 120, flip = false, alpha = 1) {
    if (!img.complete || !img.naturalWidth) return;
    const h = width * 0.9;
    const float = Math.sin(sceneTime * 4 + cx) * 4;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, bottom - 6 + float);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -width / 2, -h, width, h);
    ctx.restore();
  }

  function drawHeart(cx, cy, size, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.bow;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + size);
    ctx.bezierCurveTo(cx - size * 1.8, cy - size * 0.1, cx - size, cy - size * 1.5, cx, cy - size * 0.5);
    ctx.bezierCurveTo(cx + size, cy - size * 1.5, cx + size * 1.8, cy - size * 0.1, cx, cy + size);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function risingHearts(cx, baseY) {
    for (let i = 0; i < 4; i++) {
      const t = (sceneTime * 0.6 + i / 4) % 1;
      drawHeart(cx + Math.sin((t + i) * 6) * 30, baseY - t * 180, 9, 1 - t);
    }
  }

  function caption(text, y = 84, color = COLORS.text) {
    ctx.fillStyle = color;
    ctx.font = "700 44px Gaegu, 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    text.split("\n").forEach((line, i) => ctx.fillText(line, W / 2, y + i * 50));
  }

  function hint(text, y = H - 40, color = COLORS.muted) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(sceneTime * 4);
    ctx.fillStyle = color;
    ctx.font = "18px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, W / 2, y);
    ctx.globalAlpha = 1;
  }

  // Ghost town at dusk
  function drawDusk(hole = false) {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#1d2540");
    sky.addColorStop(1, "#4b4a7d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    for (const [x, y, r] of STARS) {
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(sceneTime * 2 + x);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.lanternOn;
    ctx.beginPath();
    ctx.arc(1170, 220, 40, 0, Math.PI * 2);
    ctx.fill();
    // Little houses with lit windows
    for (const [x, w, h] of [[70, 120, 110], [230, 90, 150], [1000, 140, 120], [1160, 90, 90]]) {
      ctx.fillStyle = "#1a2238";
      ctx.fillRect(x, GROUND - h, w, h);
      ctx.beginPath();
      ctx.moveTo(x - 10, GROUND - h);
      ctx.lineTo(x + w / 2, GROUND - h - 50);
      ctx.lineTo(x + w + 10, GROUND - h);
      ctx.fill();
      ctx.fillStyle = "#ffd27a";
      ctx.fillRect(x + w / 2 - 12, GROUND - h + 30, 24, 24);
    }
    ctx.fillStyle = "#26324f";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#3a5a52";
    ctx.fillRect(0, GROUND, W, 8);
    if (hole) {
      ctx.fillStyle = "#0b0f1c";
      ctx.beginPath();
      ctx.ellipse(880, GROUND + 4, 70, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sunny day for the wedding
  function drawDay() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#7cc4f2");
    sky.addColorStop(1, "#d8f0ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(1100, 110, 20, 1100, 110, 140);
    glow.addColorStop(0, "rgba(255, 236, 150, 0.9)");
    glow.addColorStop(1, "rgba(255, 236, 150, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(940, 0, 320, 260);
    ctx.fillStyle = "#ffe27a";
    ctx.beginPath();
    ctx.arc(1100, 110, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    for (const [x, y] of [[220, 120], [560, 70], [860, 150]]) {
      const dx = Math.sin(sceneTime * 0.3 + x) * 20;
      for (const [ox, oy, r] of [[0, 0, 28], [30, -12, 34], [62, 0, 26]]) {
        ctx.beginPath();
        ctx.arc(x + ox + dx, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#86c86f";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#6bae58";
    ctx.fillRect(0, GROUND, W, 8);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = ["#ff8fb1", "#ffffff", "#ffe27a"][i % 3];
      ctx.beginPath();
      ctx.arc((i * 151 + 40) % W, GROUND + 30 + ((i * 67) % 120), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTitle() {
    drawDusk();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#151b30";
    ctx.font = "700 130px Gaegu, 'Comic Sans MS', cursive";
    ctx.fillText(STORY.title, W / 2 + 5, 205);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(STORY.title, W / 2, 200);
    ctx.fillStyle = COLORS.lanternOn;
    ctx.font = "700 36px Gaegu, 'Comic Sans MS', cursive";
    ctx.fillText(STORY.subtitle, W / 2, 290);
    drawGhost(sprites.content, 560, GROUND, 130);
    drawGhost(ruby.content, 720, GROUND, 130, true);
    drawHeart(640, 420 + Math.sin(sceneTime * 3) * 6, 12);
    hint("Press Space to play", 625);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "15px Nunito, sans-serif";
    ctx.fillText("Esc pauses the game    ·    T changes how Bob moves    ·    Make your own levels in the Level Workshop", W / 2, 680);
  }

  function drawStory() {
    const t = sceneTime;
    if (storyPage === 0) {
      drawDusk();
      drawGhost(sprites["in-love"], 560, GROUND, 130);
      drawGhost(ruby["in-love"], 720, GROUND, 130, true);
      risingHearts(640, 470);
    } else if (storyPage === 1) {
      drawDusk();
      drawGhost(sprites[t > 0.8 ? "grumpy" : "content"], 480, GROUND, 130);
      drawGhost(frankImg, 800, GROUND, 140, true);
      if (t > 0.4) bubble(STORY.frankSays, 800, GROUND - 140);
    } else if (storyPage === 2) {
      drawDusk(true);
      // Frank rushes over and shoves Bob into the hole
      const frankX = 380 + 260 * ease(t / 0.6);
      drawGhost(frankImg, frankX, GROUND, 140);
      let bobX = 740, bobY = GROUND;
      if (t > 0.55) {
        const s = t - 0.55;
        bobX = 740 + 140 * ease(s / 0.35);
        bobY = GROUND - 40 * Math.sin(Math.min(1, s / 0.35) * Math.PI) + (s > 0.35 ? 900 * (s - 0.35) ** 2 : 0);
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, GROUND);
      ctx.rect(810, GROUND, 140, H - GROUND);
      ctx.clip();
      drawGhost(sprites[t > 0.55 ? "scared" : "content"], bobX, bobY, 130, true);
      ctx.restore();
    } else {
      // Down in the dark cave, looking up at the light
      ctx.fillStyle = COLORS.sky;
      ctx.fillRect(0, 0, W, H);
      const beam = ctx.createLinearGradient(0, 0, 0, GROUND);
      beam.addColorStop(0, "rgba(255, 244, 207, 0.35)");
      beam.addColorStop(1, "rgba(255, 244, 207, 0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(840, 0);
      ctx.lineTo(940, 0);
      ctx.lineTo(760, GROUND);
      ctx.lineTo(540, GROUND);
      ctx.fill();
      ctx.fillStyle = COLORS.rock;
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = COLORS.rockTop;
      ctx.fillRect(0, GROUND, W, 6);
      for (const [x, y] of [[300, 330], [420, 260], [980, 300], [1080, 380]]) {
        drawPresent(x, y + Math.sin(sceneTime * 2.5 + x) * 4);
      }
      drawGhost(sprites[t > 1.2 ? "content" : "sad"], 640, GROUND, 130);
    }
    caption(STORY.intro[storyPage]);
    hint(storyPage === STORY.intro.length - 1 ? "Press any key to start!" : "Press any key    ·    Esc skips the story");
  }

  function drawEnding() {
    const t = sceneTime;
    drawDay();
    // Flower arch
    ctx.lineCap = "round";
    ctx.strokeStyle = "#5c9e4b";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(640, GROUND, 190, Math.PI, 0);
    ctx.stroke();
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI + (i / 14) * Math.PI;
      ctx.fillStyle = ["#ff8fb1", "#ffffff", "#ffe27a"][i % 3];
      ctx.beginPath();
      ctx.arc(640 + Math.cos(a) * 190, GROUND + Math.sin(a) * 190, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    // The cave Bob climbs out of
    ctx.fillStyle = COLORS.rock;
    ctx.beginPath();
    ctx.ellipse(70, GROUND, 170, 140, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#151b30";
    ctx.beginPath();
    ctx.ellipse(90, GROUND, 70, 80, 0, Math.PI, 0);
    ctx.fill();

    const together = t > 2.4;
    const bobX = 90 + 470 * ease((t - 0.3) / 2.1);
    drawGhost(ruby[together ? "in-love" : "content"], 720, GROUND, 120, true);
    drawGhost(sprites[together ? "in-love" : t > 0.3 ? "happy" : "content"], bobX, GROUND, 120);
    if (together) risingHearts(640, 460);

    if (t > 2.8) caption(STORY.endingTitle, 80, "#2b3452");
    if (t > 3.5) {
      const shown = Math.min(presentsTotal, Math.floor((t - 3.5) * 8));
      ctx.fillStyle = COLORS.outline;
      ctx.font = "700 32px Gaegu, 'Comic Sans MS', cursive";
      ctx.textAlign = "center";
      ctx.fillText(STORY.endingPresents.replace("{n}", shown), W / 2, 150);
      ctx.font = "16px Nunito, sans-serif";
      ctx.fillText(`(${presentsTotal} of ${presentsPossible} found)`, W / 2, 185);
      const perRow = 16;
      for (let i = 0; i < shown; i++) {
        const row = Math.floor(i / perRow), col = i % perRow;
        const inRow = Math.min(perRow, presentsTotal - row * perRow);
        drawPresent(640 - (inRow - 1) * 17 + col * 34, 610 + row * 36, 1, false);
      }
    }
    if (t > 5.2) {
      const fade = Math.min(1, (t - 5.2) / 0.4);
      drawGhost(frankImg, 1150, GROUND, 110, true, fade);
      if (t > 5.6) bubble(STORY.frankAtWedding, 1150, GROUND - 110);
    }
    if (t > 6) hint("Press any key to play again", H - 20, "#2b3452");
  }

  function drawPause() {
    ctx.fillStyle = "rgba(14, 18, 34, 0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORS.panel;
    ctx.beginPath();
    ctx.roundRect(440, 200, 400, 320, 24);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.lanternOn;
    ctx.font = "700 56px Gaegu, 'Comic Sans MS', cursive";
    ctx.fillText("Paused", 640, 260);
    PAUSE_CHOICES.forEach((label, i) => {
      const y = 330 + i * 52;
      if (i === pauseChoice) {
        ctx.fillStyle = "rgba(255, 233, 168, 0.15)";
        ctx.beginPath();
        ctx.roundRect(480, y - 22, 320, 44, 12);
        ctx.fill();
      }
      ctx.fillStyle = i === pauseChoice ? COLORS.lanternOn : COLORS.text;
      ctx.font = "700 30px Gaegu, 'Comic Sans MS', cursive";
      ctx.fillText(label, 640, y);
    });
    ctx.fillStyle = COLORS.muted;
    ctx.font = "15px Nunito, sans-serif";
    ctx.fillText("↑ ↓ to choose    Enter to pick    Esc to keep playing", 640, 490);
  }

  function drawPlay() {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawLanterns();
    drawTiles();
    // Exits go on top of the rock so their glow isn't cut off
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (world.map.tiles[r][c] === "X") drawExit(c * TILE, r * TILE);
    drawZips();
    drawPortals();
    drawStalactites();
    drawPresents();
    drawHooks();
    drawFrank();
    drawParticles();
    drawBob();
    drawNear();
    drawHud();
    drawComplete();
    if (paused) drawPause();
  }

  function draw() {
    if (scene === "title") drawTitle();
    else if (scene === "story") drawStory();
    else if (scene === "ending") drawEnding();
    else drawPlay();
  }

  // ---- Main loop: fixed steps so the jump feels the same on every computer ----
  const STEP = 1 / 120;
  let last = performance.now(), acc = 0;
  function frame(now) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    sceneTime += elapsed;
    if (scene === "play" && !paused) {
      acc += elapsed;
      while (acc >= STEP) {
        step(world, readInput(), STEP);
        acc -= STEP;
      }
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- Tuning panel ----
  const SLIDERS = [
    { key: "jumpHeight", label: "Jump height (tiles)", min: 1.5, max: 6, step: 0.1 },
    { key: "maxFall", label: "Floatiness (lower = floatier)", min: 120, max: 700, step: 10 },
    { key: "fallGravity", label: "How fast the fall speeds up", min: 300, max: 2500, step: 50 },
    { key: "runSpeed", label: "Walking speed", min: 100, max: 400, step: 10 },
  ];
  const panel = document.getElementById("tuning");

  function buildPanel() {
    panel.innerHTML = "<h2>How Bob moves</h2>";
    for (const s of SLIDERS) {
      const row = document.createElement("label");
      row.innerHTML = `<span>${s.label} <b id="v-${s.key}"></b></span>
        <input type="range" id="t-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}">`;
      panel.appendChild(row);
      const input = row.querySelector("input");
      input.value = tuning[s.key];
      row.querySelector("b").textContent = tuning[s.key];
      input.addEventListener("input", () => {
        tuning[s.key] = Number(input.value);
        world.tuning[s.key] = tuning[s.key];
        row.querySelector("b").textContent = input.value;
        try { localStorage.setItem("ghost-tuning", JSON.stringify(tuning)); } catch (e) {}
      });
    }
    const reset = document.createElement("button");
    reset.textContent = "Back to normal";
    reset.addEventListener("click", () => {
      tuning = { ...DEFAULT_TUNING };
      world.tuning = { ...tuning };
      try { localStorage.removeItem("ghost-tuning"); } catch (e) {}
      buildPanel();
    });
    panel.appendChild(reset);
    const close = document.createElement("p");
    close.textContent = "Press T to close";
    panel.appendChild(close);
  }

  function togglePanel() {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) buildPanel();
    else canvas.focus(); // so the arrow keys move Bob, not a slider
  }
}
