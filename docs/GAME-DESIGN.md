# Bob's Adventure: Design Doc

*Originally called "Ghost Game" while it was being designed.*

A 2D single-screen platformer. Each level fits on one screen. Bob the ghost floats, jumps and finds his way through the caves, back to the surface to marry Ruby. Along the way he collects presents for the wedding and dodges spikes, falling stalactites and sneaky moss.

The game should also be a **game-making kit**: she can design her own levels by typing them as letter grids and add them to the game.

Character art and the mood faces are described in [GHOST-CHARACTER.md](GHOST-CHARACTER.md).

---

## Story

**Characters**
- **Bob** is our hero. He was going to marry Ruby.
- **Ruby** is the ghost Bob is going to marry. She wears a bow on the right side of her head.
- **Mayor Frank** is the town's grumpy mayor. He looks darker, with straight, heavy eyebrows. His motto is "Go to work!"

**What happened:** Bob wasn't obeying Mayor Frank's orders to go to work, so Frank shoved him down into the caves. Now Bob has to find his way back up to Ruby and collect wedding presents on the way.

**How the story shows up in the game**
1. **Intro.** Two or three simple picture screens. Frank: *"Go to work!"* *Shove.* Bob tumbles down into the dark cave.
2. **The levels.** The cave gets slowly lighter with each level as Bob gets closer to the surface.
3. **Frank cameos.** Near the end of a level, Frank sometimes pops in, shouts *"Go to work!"* in a speech bubble, and vanishes. He can't hurt Bob. It's just for laughs (see [Frank cameos](#frank-cameos)).
4. **Ending.** Bob climbs out into daylight and sees Ruby, and his face switches to In Love. The wedding scene says *"Bob brought Ruby 14 presents!"* (or however many the player collected). Frank grumps at the edge of the scene.

---

## Controls

| Action | Keys |
|---|---|
| Move left / right | ← → or A / D |
| Jump | ↑, W or Space |
| Interact (pick up, use) | E or ↓ |
| Back to checkpoint | R |
| Pause menu (restart level, quit) | Esc or P |

- When Bob is next to something he can use, a small **"E" bubble** appears above it. The player is never told the rules in text; the bubble does the teaching.
- **R (back to checkpoint)** exists because Bob can get stuck, for example at the bottom of a moss pit. It works like a poof: Bob goes back to the last checkpoint and **keeps** his hook and presents.
- **Restart level** (in the pause menu) is the full reset. Everything goes back to how the level started, including the presents and the hook.

---

## How Bob moves

Bob is a ghost, so he should feel a little floaty, but still easy to control.

- **Jump:** about 3 tiles high and about 4–5 tiles far with a running start. Releasing the jump key early gives a shorter hop.
- **Floaty fall:** Bob falls slower than he rises and has a gentle top speed, like drifting down.
- **No fall damage.** Falling any distance is safe. Only hazards poof him.
- **Jump helpers** (invisible, but they make the controls feel right):
  - *Coyote time:* Bob can still jump for about 0.1 seconds after drifting off a ledge.
  - *Jump buffering:* a jump pressed about 0.1 seconds before landing still happens when he lands.
- **The float bob:** when standing still, Bob gently floats up and down (the same animation as the gallery page).

---

## The poof (what happens when Bob gets hit)

1. Bob flashes his **Scared** face.
2. He bursts into a handful of tiny cloud puffs that drift upward and fade, as if he evaporated.
3. After a short pause, he fades back in at the **last checkpoint**, looking **Content**.

The whole poof takes about a second. Dying should never feel like a punishment.

**What Bob keeps after a poof:** his hook and all presents collected.
**What resets:** fallen stalactites go back up, and collapsed moss grows back.

---

## Bob's moods in the game

| Mood | When it shows |
|---|---|
| Content | Default: standing, walking, after respawning |
| Happy | Touching a checkpoint, picking up a present or the hook, reaching the exit |
| Surprised | Moss gives way under him; reaching the zip line without a hook |
| Scared | A stalactite starts shaking nearby; standing right next to spikes; the start of a poof |
| Grumpy | Frank appears; bumping head-first into a wall |
| Sleepy | Nobody has touched the keys for about 8 seconds |
| Sad | Stuck at the bottom of a pit (until R is pressed) |
| In Love | Seeing Ruby at the end |

Each mood stays on screen for about a second, then he goes back to Content. Sleepy and Sad stay until something changes.

---

## Things in the cave

### Ground and rock
Solid. You can stand on it and you can't pass through it. A **rock** is just a small block of solid ground to jump on.

### Checkpoint (lantern)
An unlit lantern that lights up when Bob touches it, and Bob turns Happy. Poofs send him back to the most recent lit lantern. The level start counts as the first checkpoint.

### Present (orb)
A small glowing orb with a tiny bow on it, to show it's a wedding present. Touching one collects it with a little sparkle. Presents are counted on screen and at the wedding.

### Hook
Sits somewhere a little out of the way, behind a rock or up on a ledge. **The player has to find it.** Press **E** to pick it up. A hook icon then appears in the corner of the screen to show Bob is carrying it. He keeps it after a poof.

### Zip line
A line strung between two posts across a gap.
- **With the hook:** stand at the first post and press **E** to hook on. Bob slides across automatically and drops off at the far post.
- **Without the hook:** Bob turns Surprised and a thought bubble with a hook picture appears. The player learns what's missing without any words.

### Stalactite
Hangs from the ceiling.
1. When Bob walks anywhere underneath it, it **shakes for about half a second**. That's the warning, and it makes the trap fair.
2. Then it falls straight down. If it hits Bob, he poofs.
3. If it hits the ground, it shatters and is gone.

All stalactites come back after a poof.

### Moss
Looks almost like normal ground, but is slightly different: a green, tufty top, with tiny spores drifting up from it now and then. The hole underneath stays hidden until the moss crumbles. It's *fair*, so a careful player can spot it.
- When Bob steps on it, it crumbles and he falls into the hole underneath (Bob turns Surprised).
- Some moss pits are too deep to jump out of. That's on purpose. The player presses **R** to go back to the checkpoint.

### Spikes
Sit on the ground (or at the bottom of a gap). Touching them poofs Bob.

### Bouncy slime
A wobbly green blob. Landing on it launches Bob very high, high enough to get over walls he could never jump. Holding jump while landing gives an extra-high bounce.

### Portal
A swirling purple doorway. Portals always come in a **pair**, and the pair stays inside one level.
- Walking (or falling) into one portal sends Bob straight out of the other one, still moving the same way. Bob turns Surprised, and both portals sparkle.
- Portals work **both ways**. Walking into the second one sends Bob back to the first.
- The portal Bob comes out of won't send him back until he has stepped out of it, so he never bounces back and forth.
- A level has **exactly two** portals or none. One portal on its own shows as a dim, sleeping portal that does nothing. In the Level Workshop, placing a third portal moves the closest one instead.

### Exit
A glowing opening in the cave wall. Touching it finishes the level (Bob turns Happy). A "Level complete!" screen shows the presents found in that level.

### Frank cameos
Level designers place **F** spots where Frank *might* appear. Once per level, when Bob is near the end, Frank may pop in at one of the F spots. He fades in, shouts **"Go to work!"** in a speech bubble, stays for about 2 seconds and fades out. Bob turns Grumpy. Frank can't hurt Bob or block him.

---

## Level files (the letter grid)

Every level is a grid of letters, **32 wide × 18 tall**. Each letter is one tile on the screen. With 40-pixel tiles, a level fills a 1280 × 720 screen.

| Letter | Means |
|---|---|
| `.` | Empty air |
| `#` | Ground or rock (solid) |
| `B` | Bob's start (exactly one per level) |
| `X` | Exit (at least one) |
| `C` | Checkpoint lantern |
| `o` | Present (orb) |
| `H` | Hook |
| `Z` | Zip line post (two on the same row, joined by the line) |
| `^` | Spikes |
| `V` | Stalactite (put it just under the ceiling) |
| `M` | Moss (looks like ground, but crumbles) |
| `~` | Bouncy slime |
| `F` | A spot where Frank might pop in |
| `P` | Portal (exactly two per level; walk into one to come out of the other) |
| `R` | Ruby (for the ending or a special level) |

Lowercase and uppercase both work, and the grid can be typed in any plain text editor.

### Level 1: "The Cave Floor"

Teaches one thing at a time: checkpoint → jump on a rock → stalactite → moss → spikes → exit.

```
################################
#.............V................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#.......................oo.....#
#........oo....................#
#......o.##...o.......o........#
#.B..C...##.............^^....X#
##################MMM###########
##################...###########
##################...###########
##################...###########
################################
```

- The present under the stalactite is a tempting little trap.
- The moss pit is 4 tiles deep, deeper than Bob can jump, so falling in means pressing R.
- The presents above the spikes reward a good jump.

### Level 2: "The Long Way Up"

Adds new tools (hook, zip line, slime), then brings back the earlier dangers.

```
################################
#.......................V....V.#
#..............................#
#....................oo........#
#.........................F....#
#....................##........#
#....................##........#
#....................##........#
#..oH................##........#
#..###...............##........#
#........Z.......Z...##........#
#......#.....oo......##.o......#
#.B....#C..........~~##...C...X#
##########.......##########MM###
##########.......##########..###
##########.......##########..###
##########^^^^^^^##########..###
################################
```

1. **Find the hook.** It's up on the ledge to the left. Jump on the rock, then onto the ledge.
2. **Zip line** across the spiky gap (7 tiles, just too wide to jump). Without the hook, Bob just can't get across. Two presents hang under the line to grab on the way.
3. **Bouncy slime** launches Bob over the tall wall. Presents wait at the top.
4. **The stalactite** right after the wall drops on careless ghosts.
5. **Checkpoint**, then **moss** with a pit underneath.
6. **One last stalactite** right before the exit.
7. **Frank** may pop in near the end.

*These two grids are first drafts based on her drawings. She should change anything that doesn't match what she imagined.*

### Level 5: "Through the Portal"

Shows off the portals. The cave is split into two parts with solid rock between them:
- **Downstairs:** Bob starts here. The exit is on the far side of a long spike pit with a zip line over it, but the hook is not downstairs.
- **Upstairs:** a portal takes Bob up here, where he hops a few spikes, ducks a stalactite and climbs to the hook.
- Then he goes back down through the same pair of portals, rides the zip line over the spikes (picking up presents on the way) and reaches the exit.

So the level only works by using the portals in both directions.

---

## Level Workshop (making her own levels)

This is a big part of the game: it's *her* game, and she should be able to add to it.

**Built:** `editor.html` is a separate page. Paint blocks on the cave or type letters in the grid, and each one updates the other. "Test play" opens the level in the game (`play.html#test=...`), and "Copy my level" gives the code block to paste into `levels.js`. Her work in progress is remembered in the browser. The plan below is the original idea.

**A Level Workshop screen, reached from the title screen:**
- **Left side:** a simple text box holding the letter grid. Typing changes the level.
- **Right side:** a **live preview** that redraws the level as she types, using the real game art.
- **A letter key** (the table above) along the bottom, so she doesn't have to remember the letters.
- **A "Play it!" button** to test the level right away, and Esc to come back to editing.
- **Friendly checks** with simple messages, such as "Bob needs a start (B)", "No exit (X) yet", "Row 7 is too short", or "Zip line needs two Z's on the same row".
- **Name your level** and **Save.** Saved levels appear in a **"My Levels"** list on the title screen.

**Where her levels are kept**
- The Workshop saves her levels in the browser automatically, so they're there next time she opens the game.
- Browser storage can get cleared, so there's also a **"Copy level"** button. To make a level a permanent part of the game, paste it into `levels.js`, the file holding the game's levels. You can do that together; it's just pasting a block of text.

**Later, if she wants it:** a click-to-paint mode where she picks a tile and paints it onto the grid with the mouse. The typed grid is a good start because it's simple and she can see the whole level at once.

---

## Screens

1. **Title:** the game name, Bob floating, and the buttons **Play**, **My Levels** and **Level Workshop**.
2. **Story intro:** 2–3 picture screens (Frank, "Go to work!", the shove). Any key skips.
3. **Level:** the level, with a small bar at the top showing the level name, presents count and the hook icon (once found).
4. **Level complete:** "Level complete!", the presents found in this level, and "Press any key".
5. **Ending:** Bob and Ruby, a wedding scene, "Bob brought Ruby __ presents!", and Frank grumping at the side.
6. **Pause:** Resume, Restart level, Back to title.

---

## Art still needed

- **Frank:** Bob's body shape, darker or gray, with straight, heavy, low brows and narrow eyes. Maybe a mayor's hat or sash.
- **Ruby:** Bob's body shape, with a bow on the right side of her head. Moods: Content and In Love.
- **Tiles:** cave rock, moss, spikes, stalactite, slime, zip line and posts, lantern (unlit and lit), exit.
- **Small things:** present orb, hook, poof puffs, the "E" bubble, Frank's speech bubble, the hook thought bubble.
- **Backgrounds:** dark cave for level 1, slightly lighter for level 2, and daylight for the ending.

Same style as Bob throughout: clean shapes, a dark outline and a little color.

---

## How it's built

- **Plain web pages:** everything is in `src/`. Double-click `src/index.html` to play in Chrome or Edge, with no installs. `build-war.ps1` packages it for Tomcat.
- **Files (in `src/`):**
  - `index.html`: home page (Play / Level Workshop).
  - `play.html`: the game page.
  - `game.js`: movement, hazards, screens.
  - `levels.js`: the level grids.
  - `story.js`: every word of the story (game name, intro pages, Frank's lines, the ending). Edit freely.
  - `editor.html`: the Level Workshop.
  - `art/`: all the SVGs. Includes `frank.svg`, `ruby-content.svg` and `ruby-in-love.svg`.
- **Drawing:** an HTML canvas at 1280 × 720 that scales to fit the window.
- **Sound:** optional, for later (jump, land, poof, present, "Go to work!").

### Build order

1. Bob moving and jumping on a plain grid (getting the floaty feel right).
2. Level 1 hazards: checkpoint, poof, stalactite, moss, spikes, exit.
3. Moods and presents.
4. Level 2 additions: hook, zip line, slime, Frank cameo.
5. Title, story, level-complete and ending screens.
6. Level Workshop.
7. Art for Frank, Ruby and the tiles (can happen alongside the steps above).

---

## Open questions

1. ~~**What's the game called?**~~ *Bob's Adventure.*
2. **Should the presents look like orbs with bows,** or something else?
3. **Does the story intro need words,** or just pictures?
4. **What does the ending look like?** A wedding arch? Other ghosts watching?
5. **Do Level 1 and Level 2 match her drawings?** She can edit the grids directly.
