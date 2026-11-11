# Bob's Adventure

A small 2D platformer about Bob the ghost. Mayor Frank shoves Bob down into the caves, and Bob has to find his way back up to Ruby so they can get married, picking up wedding presents on the way.

It comes with a **Level Workshop** for designing new caves and test-playing them right away.

## Play

Open `src/index.html` in a browser. There's nothing to install. You need a keyboard:

| Action | Keys |
|---|---|
| Move | ← → or A / D |
| Jump | ↑, W or Space |
| Use things | E or ↓ |
| Back to checkpoint | R |
| Pause | Esc or P |

## Layout

```
src/                 everything that ships
  index.html         home page (Play / Level Workshop)
  play.html          the game
  editor.html        the Level Workshop
  game.js            game rules and drawing
  levels.js          the level grids
  story.js           every word of the story
  art/               Bob, Ruby and Frank SVGs
docs/                design notes (not shipped)
build-war.ps1        packages src/ as dist/bobs-adventure.war
```

## Adding a level

1. Build it in the Level Workshop and press **Test play** to try it.
2. Press **Copy my level** and paste the code into `src/levels.js`, just above the final `];`.
3. Rebuild and redeploy (see below).

## Deploying to Tomcat

```powershell
powershell -ExecutionPolicy Bypass -File build-war.ps1
```

This writes `dist/bobs-adventure.war`. Put it in Tomcat's `webapps/` folder and the game is served at `/bobs-adventure/`. The build adds a version stamp to the script URLs, so browsers load the new levels after a deploy.

### Deploying to production

The live game is at https://dandelion-daily.org/bobs-adventure/, on the same server as Dandelion. One command, run from PowerShell in `C:\dev\bunker\dandelion`, builds this project, uploads it, and swaps it in without restarting Tomcat:

```powershell
.\deploy\deploy.ps1 bobs-adventure
```

Commit first; the build uses whatever is in `src/`. Details are in the Dandelion repo's `docs/Dandelion-Deployment.md`.
