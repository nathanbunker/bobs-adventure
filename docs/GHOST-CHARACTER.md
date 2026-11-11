# Ghost Character

The main character for Bob's Adventure. The ghost was designed and drawn by hand and then traced into clean SVG files. The tracing keeps the overall shape but smooths out the wobbly lines. She chose the faces with **no mouths**: the eyes, brows and small extras show each feeling.

## Files

All eight ghost SVGs are in the `src/art/` folder.

| File | Emotion | Face | Good game moment |
|---|---|---|---|
| `ghost-happy.svg` | Happy | Eyes squeezed shut in upward arcs `^ ^` | Winning a level, collecting something |
| `ghost-content.svg` | Content | Two short vertical lines `\| \|` | Default / standing still |
| `ghost-sad.svg` | Sad | Worried brows, small dot eyes, one blue tear | Losing a life |
| `ghost-surprised.svg` | Surprised | Raised brows, big shiny eyes | Finding treasure, a sudden event |
| `ghost-sleepy.svg` | Sleepy | Closed eyes in downward arcs, floating "z z" | Idle when nobody is playing |
| `ghost-grumpy.svg` | Grumpy | Brows angled down toward the middle, dot eyes | Bumping into a wall, getting blocked (**her favorite**) |
| `ghost-scared.svg` | Scared | Wide round eyes with tiny pupils, worried brows, sweat drop | An enemy is near |
| `ghost-in-love.svg` | In Love | Pink heart eyes, rosy cheeks | Meeting another ghost or a friend |

Other files:

- `ghost-moods.html`: a gallery page showing all eight ghosts. Hovering makes a ghost float. Open it in any browser.

## How the SVGs are built

All eight files share the same canvas and body. Only the face changes, so you can switch emotions just by swapping the image and nothing shifts or jumps.

- **Canvas:** `viewBox="0 0 200 180"` (200 wide × 180 tall). The files also set `width="200" height="180"`, but SVGs scale to any size without blurring.
- **Body:** one path with a rounded dome on top and three equal bumps along the bottom:

  ```xml
  <path d="M 15 140 C 2 70, 40 12, 100 12 C 160 12, 198 70, 185 140
           C 183 168, 148 178, 130 150 C 122 174, 78 174, 70 150
           C 52 178, 17 168, 15 140 Z"
        fill="#ffffff" stroke="#333333" stroke-width="4" stroke-linejoin="round"/>
  ```

- **Face area:** the eyes are centered near `(70, 72)` and `(130, 72)`. Brows sit around y = 45–70.
- **Line style:** `stroke="#333333"`, `stroke-width="4"`, with rounded line ends and corners, so it looks like a marker drawing.

### Colors

| Use | Color |
|---|---|
| Body fill | `#ffffff` (white) |
| Outline, eyes, brows | `#333333` (dark gray) |
| Tears, sweat drop | `#8cc8f0` (light blue) |
| Sleepy z's | `#7a8db8` (soft blue) |
| Heart eyes | `#ff5c8a` (pink) |
| Cheeks | `#ffb3c6` (light pink) |

The ghost is white, so it shows up best on a darker background. The gallery uses a night-sky navy (`#1d2540`).

## The float animation

This is the floating effect from the gallery. It moves the ghost up 8 pixels and back down every 1.6 seconds:

```css
.ghost {
  animation: float 1.6s ease-in-out infinite;
}
@keyframes float {
  50% { transform: translateY(-8px); }
}
/* Turn it off for people whose computer asks for less motion */
@media (prefers-reduced-motion: reduce) {
  .ghost { animation: none; }
}
```

In the gallery it only runs on hover. For a game it probably looks best running all the time, because ghosts are always floating. A slower float (around 2–3 seconds) feels calmer for Content and Sleepy. A faster one (around 0.6 seconds) feels jittery and works well for Scared.

If the game draws on a `<canvas>` instead of using CSS, here is the same motion:

```js
const floatY = -4 + 4 * Math.cos((time / 1600) * 2 * Math.PI); // 0 at rest, -8 at the top
```

## Using the ghost in a game

**As an image** (simplest):

```html
<img id="ghost" class="ghost" src="art/ghost-content.svg" width="120" alt="Ghost">
```

```js
function setMood(mood) {
  document.getElementById("ghost").src = `art/ghost-${mood}.svg`;
}
setMood("grumpy");
```

Mood names: `happy`, `content`, `sad`, `surprised`, `sleepy`, `grumpy`, `scared`, `in-love`.

**On a canvas:** load each SVG into an `Image()` once at the start, then call `ctx.drawImage(img, x, y, width, height)`. Keep the 200:180 shape (10:9) so the ghost doesn't stretch.

**Facing left or right:** the ghost is symmetrical, so you can flip it with `transform: scaleX(-1)`. The only extras that are off to one side are the tear, the sweat drop and the z's.

## Adding a new emotion

1. Copy any ghost SVG, for example `ghost-content.svg`.
2. Keep the body path exactly as it is.
3. Replace the eye and brow shapes. Keep them inside the face area and use the same dark gray and 4px line width.
4. Remember: no mouths.
5. Save it in `art/` as `ghost-<feeling>.svg` so it works with `setMood()`.

Ideas for later: Angry (red cheeks plus Grumpy brows), Silly (one eye winking), Dizzy (spiral eyes), Proud (Happy eyes plus a sparkle).
