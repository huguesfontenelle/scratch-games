# Space Invaders — Level One

**Date:** 2026-09-11
**Target:** a playable Scratch project, written in goboscript, published to `6DRAGON9`
**Toolchain:** `scratch-mcp` (goboscript compiler + sb2gs decompiler), verified `ready: true`

## Goal

A faithful, single-level Space Invaders. Success means: it builds, it is fun for
sixty seconds, and the last-invader sprint feels like the arcade original.

## Scope

**In:** player ship, single player shot, 5×11 invader formation that marches and
descends, invaders that shoot back, 3 lives, score, formation speed-up as
invaders die, bonus UFO, win and lose states, restart.

**Out of level one:** destructible bunkers, multiple levels, high-score
persistence, sound. Bunkers are excluded deliberately — Scratch has no per-pixel
erase, so shield erosion needs a costume-swap or clone-chunk workaround that
would dominate the build budget for the least payoff. It is an additive
follow-up, not a foundation.

## Architecture

### Formation-driven, clones as puppets

The formation's position is authoritative and lives in two global variables.
Invader clones are rendered from it; they never decide where they are.

```
clone.x = formation_x + col * COL_SPACING
clone.y = formation_y - row * ROW_SPACING
```

Rejected alternative: clone-driven movement, where each clone steps itself and
whichever clone touches the wall sets a global `hit_edge` flag. That is the
common Scratch idiom, but clone-to-global signalling is racy and lockstep drift
between clones is its classic failure. Computing the formation arithmetically
removes that whole class of bug from the critical path.

Edge detection is therefore pure arithmetic over the leftmost and rightmost
*alive* columns — no clone ever reports anything upward.

### Sprites

One `.gs` file per sprite, in the project root.

| File | Role |
|---|---|
| `stage.gs` | Global state, game state machine, score and lives monitors |
| `player.gs` | Ship movement, firing input, death |
| `bullet.gs` | The single player shot, and all kill detection |
| `invader.gs` | 55 clones; formation marching, animation, death |
| `bomb.gs` | Invader projectiles (clones) |
| `ufo.gs` | Bonus saucer |

### Clone budget

55 invaders + at most 3 bombs = 58 concurrent clones, against Scratch's shared
cap of 300. Comfortable.

The player shot is a plain sprite, not a clone: the 1978 original permits exactly
one player shot on screen at a time, so single-instance state is both simpler and
more faithful.

## Data model

### `grid` — 55 entries, 1-indexed

```
idx = row * 11 + col + 1        # row 0 = top, col 0 = leftmost
1 = alive, 0 = dead
```

### Supporting counters

| Name | Shape | Purpose |
|---|---|---|
| `col_count` | list, 11 entries | Alive invaders per column; drives edge detection |
| `row_count` | list, 5 entries | Alive invaders per row; drives the lose-line check |
| `alive_total` | var | Drives march speed and the win condition |

Maintaining counters on kill turns per-frame edge detection into an 11-entry scan
instead of a 55-entry one, and makes the "which row is lowest" test trivial.

Scratch cannot create variables or lists at runtime, so all three are declared
statically and reset on game start.

### Per-clone identity

Scratch clones have no accessible unique ID. Each invader clone stores `col`,
`row` and `idx` in *for this sprite only* variables, which are per-clone. This
is the documented workaround and the only identity mechanism available.

## Geometry

Stage is 480×360; x ∈ [-240, 240], y ∈ [-180, 180].

| Constant | Value |
|---|---|
| `COL_SPACING` | 30 px (11 columns span 300 px) |
| `ROW_SPACING` | 24 px (5 rows span 96 px) |
| Formation start | `formation_x = -150`, `formation_y = 140` |
| Drop per edge contact | 16 px |
| Invader hitbox | 22 × 16 px |
| Player y | fixed at -150 |
| Lose line | bottom alive row reaching y = -130 |

March direction reverses when the outermost alive column's edge crosses ±230.

## Mechanics

### Marching and speed-up

The formation steps on an interval rather than every frame — that stepped,
non-smooth motion is characteristic of the original.

```
march_wait = MIN_WAIT + (MAX_WAIT - MIN_WAIT) * alive_total / 55
MAX_WAIT = 0.45s   MIN_WAIT = 0.03s
```

The final-invader sprint falls out of this formula for free; no special case.

Invaders alternate between two costumes on each step, giving the two-frame
marching wobble.

### Kill detection

The bullet maps its own position to a grid cell arithmetically, rather than using
`touching`:

```
col = round((bullet_x - formation_x) / COL_SPACING)
row = round((formation_y - bullet_y) / ROW_SPACING)
```

Guarded by a bounds check on both indices and a hitbox proximity check against
that cell's true centre. If `grid[idx]` is alive, it is cleared, the counters
decrement, and the score increases.

This avoids `touching`'s central ambiguity — it tells you *that* a clone was hit,
never *which*. Each invader clone independently polls its own `idx` and hides
when cleared, so no broadcast needs to carry data (Scratch broadcasts cannot).

UFO collision does use `touching("ufo")`, since the UFO is a single sprite and
the ambiguity does not arise.

### Scoring

Top row 30, middle two rows 20, bottom two rows 10. UFO awards a random pick of
50 / 100 / 150 / 300.

### Invader fire

Bombs spawn from the bottom-most alive invader of a randomly chosen alive column,
capped at 3 concurrent. The interval between spawn attempts uses the same
`alive_total` ratio as the march, so pressure rises as the formation thins:

```
bomb_wait = 0.4 + 1.6 * alive_total / 55     # 2.0s at full grid, 0.4s at the end
```

Bombs fall 5 px per frame. A bomb reaching the player costs a life; reaching the
stage floor deletes the clone.

### Game states

`game_state`: 0 title, 1 playing, 2 game over, 3 level clear.
Broadcasts: `start_game`, `life_lost`, `game_over`, `level_clear`.

Lose: lives exhausted, or the bottom alive row crosses the lose line.
Win: `alive_total` reaches 0.

## Art

All costumes are generated as SVG markup through `project_add_costume`, which
accepts raw SVG — no external asset files, no sourcing.

- Three invader species (row 0, rows 1–2, rows 3–4), two frames each
- Player ship, plus an explosion frame
- Bullet, bomb, UFO

Pixel-art forms drawn as SVG rectangle grids, so they stay crisp. Vector costumes
rasterize at up to 2048×2048, well beyond what these need.

## Build and verification

1. `project_build` after each sprite lands — the compiler reports file, line and
   column on failure.
2. `project_summary` to confirm block and costume counts per sprite and to catch
   stale builds or unused assets.
3. Manual play in the Scratch editor before anything is published.
4. `project_save_to_cloud` as **private** first; public only on explicit say-so.

Block and reporter names are verified against `project_goboscript_docs_help`
rather than guessed — goboscript's names differ from Scratch's block text, and a
guess costs a full build cycle.

## Known Scratch constraints this design respects

- 300 concurrent clones shared across all sprites — we use 58.
- Broadcasts carry no data, and fire at most once per frame.
- Custom blocks cannot return values; results come back via variables.
- Lists are 1-indexed.
- Variables and lists cannot be created at runtime.
- Comparison operators cast numeric-looking strings to floats.
- 30 FPS; threads have a 500 ms limit.
