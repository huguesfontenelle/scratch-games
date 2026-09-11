# Space Invaders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable single-level Space Invaders, written in goboscript, built and published to Scratch through the `scratch` MCP server.

**Architecture:** The invader formation's position is authoritative and lives in two global variables; 55 invader clones render themselves from it and never decide their own position. Edge detection and kill detection are pure arithmetic over a 55-entry `grid` list, which keeps racy clone-to-global signalling and `touching`-ambiguity off the critical path.

**Tech Stack:** goboscript (compiles to `.sb3`), the `scratch` MCP server (`project_*` and `social_*` tools), SVG costumes generated inline, Python + pytest for the coordinate-math oracle only.

**Spec:** `space_invaders/docs/specs/2026-09-11-space-invaders-design.md`

## Global Constraints

- Project directory: `space_invaders/` at repo root. All `project_*` tool calls target it.
- Stage is 480×360; x ∈ [-240, 240], y ∈ [-180, 180].
- `COL_SPACING = 30`, `ROW_SPACING = 24`, grid is 5 rows × 11 columns = 55.
- Formation start: `formation_x = -150`, `formation_y = 140`. Drop = 16 px. March step = 8 px. Reverse at ±230.
- Player y is fixed at -150. Lose line: bottom alive row reaching y ≤ -130.
- `march_wait = 0.03 + 0.42 * alive_total / 55`.
- `bomb_wait = 0.4 + 1.6 * alive_total / 55`; bombs fall 5 px/frame; max 3 concurrent.
- Grid index is 1-based: `idx = row * 11 + col + 1`. Scratch lists are 1-indexed.
- Scoring: row 0 → 30, rows 1–2 → 20, rows 3–4 → 10. UFO → random of 50/100/150/300.
- Clone budget: 55 invaders + ≤3 bombs = 58, against Scratch's shared cap of 300.
- Never call the `goboscript` CLI directly — always `project_build`, which surfaces compiler diagnostics with file, line and column.
- Publish **private** only. Public requires explicit user say-so.
- Commit after every task. Branch is `feat/space-invaders`; never commit to `main`.

## On testing in this project

Scratch has no unit-test runner, and goboscript compiles to a `.sb3` rather than
to anything importable. Standard TDD does not apply to the game code, and this
plan does not pretend otherwise. What replaces it, per task:

1. **`project_build`** — the compiler is the first gate. It reports file, line and column.
2. **`project_summary`** — confirms what the build actually contains: per-sprite block and script counts, costumes, variables, and warnings for unused or oversized assets and stale builds. This is how a task proves it produced what it claimed.
3. **Manual play** — the human opens the built `.sb3` in the Scratch editor at the checkpoints marked below.

Genuine automated tests exist for exactly one thing: the coordinate and index
arithmetic (Task 1). That maths is the highest-risk part of the design — an
off-by-one in `idx` or an edge-detection sign error is invisible in a build and
tedious to spot by eye. Those tests are a **design oracle**: they verify the
formulas before they are hand-translated into goboscript. They do not test
shipped code, and they can drift from it. When a formula changes in `.gs`, change
it in the oracle in the same commit.

---

### Task 1: Coordinate-math oracle

Pin the formulas down in executable form before any of them reach goboscript.

**Files:**
- Create: `space_invaders/tools/formation.py`
- Test: `space_invaders/tools/test_formation.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `grid_index(row, col) -> int`, `cell_x(formation_x, col) -> float`, `cell_y(formation_y, row) -> float`, `formation_edges(formation_x, col_count) -> tuple[float, float]`, `march_wait(alive_total) -> float`, `score_for_row(row) -> int`. Tasks 5–7 hand-translate these into `.gs`.

- [ ] **Step 1: Write the failing tests**

```python
# space_invaders/tools/test_formation.py
import pytest
from formation import (
    grid_index, cell_x, cell_y, formation_edges, march_wait, score_for_row,
)


def test_grid_index_is_one_based_and_spans_55():
    assert grid_index(0, 0) == 1
    assert grid_index(4, 10) == 55


def test_grid_index_is_unique_across_the_whole_grid():
    seen = {grid_index(r, c) for r in range(5) for c in range(11)}
    assert seen == set(range(1, 56))


def test_cell_positions_start_at_the_formation_origin():
    assert cell_x(-150, 0) == -150
    assert cell_x(-150, 10) == 150
    assert cell_y(140, 0) == 140
    assert cell_y(140, 4) == 44


def test_edges_use_the_outermost_alive_columns():
    full = [5] * 11
    assert formation_edges(-150, full) == (-161, 161)


def test_edges_ignore_cleared_columns():
    # only column 5 still alive
    sparse = [0] * 11
    sparse[5] = 1
    assert formation_edges(-150, sparse) == (-11, 11)


def test_edges_return_none_when_the_formation_is_empty():
    assert formation_edges(-150, [0] * 11) is None


def test_march_wait_spans_the_designed_range():
    assert march_wait(55) == pytest.approx(0.45)
    assert march_wait(1) == pytest.approx(0.03 + 0.42 / 55)


def test_march_wait_accelerates_as_invaders_die():
    assert march_wait(10) < march_wait(50)


def test_score_matches_the_arcade_rows():
    assert [score_for_row(r) for r in range(5)] == [30, 20, 20, 10, 10]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd space_invaders/tools && python3 -m pytest test_formation.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'formation'`

- [ ] **Step 3: Write the implementation**

```python
# space_invaders/tools/formation.py
"""Coordinate and index arithmetic for the invader formation.

This is a design oracle. The shipped game re-implements these formulas in
goboscript; keep the two in step whenever either changes.
"""

COLS = 11
ROWS = 5
COL_SPACING = 30
ROW_SPACING = 24
HALF_W = 11

MAX_WAIT = 0.45
MIN_WAIT = 0.03


def grid_index(row, col):
    """1-based index into the 55-entry `grid` list."""
    return row * COLS + col + 1


def cell_x(formation_x, col):
    return formation_x + col * COL_SPACING


def cell_y(formation_y, row):
    return formation_y - row * ROW_SPACING


def formation_edges(formation_x, col_count):
    """(left, right) hitbox edges of the outermost alive columns.

    Returns None when no column has a live invader.
    """
    alive = [c for c, n in enumerate(col_count) if n > 0]
    if not alive:
        return None
    return (
        cell_x(formation_x, alive[0]) - HALF_W,
        cell_x(formation_x, alive[-1]) + HALF_W,
    )


def march_wait(alive_total):
    return MIN_WAIT + (MAX_WAIT - MIN_WAIT) * alive_total / (ROWS * COLS)


def score_for_row(row):
    if row == 0:
        return 30
    if row <= 2:
        return 20
    return 10
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd space_invaders/tools && python3 -m pytest test_formation.py -v`
Expected: PASS, 9 passed

- [ ] **Step 5: Commit**

```bash
git add space_invaders/tools/formation.py space_invaders/tools/test_formation.py
git commit -m "test: coordinate-math oracle for the invader formation"
```

---

### Task 2: Walking skeleton — scaffold and prove globals cross sprite boundaries

The design rests on an unverified assumption: that a variable assigned in
`stage.gs` is readable *and writable* from another sprite. Everything downstream
collapses if it is not. Prove it before writing any game logic.

**Files:**
- Create: `space_invaders/` (via `project_new`)
- Modify: `space_invaders/stage.gs`, `space_invaders/player.gs`
- Delete: `space_invaders/main.gs` (the scaffold's placeholder sprite)

**Interfaces:**
- Consumes: nothing.
- Produces: an open, building project registered with the MCP server; the global-variable idiom every later task uses.

- [ ] **Step 1: Scaffold the project**

Call `project_new` with `path: "space_invaders"`. This creates `stage.gs`, `main.gs`, `goboscript.toml` and a blank costume, and makes the project active.

- [ ] **Step 2: Write `stage.gs` declaring one global**

Variables assigned in `stage.gs` become *for all sprites*.

```goboscript
var probe;

onflag {
    probe = 7;
}
```

- [ ] **Step 3: Rename the placeholder sprite to `player` and read the global from it**

```bash
mv space_invaders/main.gs space_invaders/player.gs
```

Then replace `player.gs` entirely, keeping its existing `costumes` line as the
first line (the scaffold declared a blank costume there; `project_build` fails
for a sprite with none):

```goboscript
costumes "assets/blank.svg";

onflag {
    wait 0.1;
    probe = probe + 1;
    say probe;
}
```

- [ ] **Step 4: Build**

Call `project_build`.
Expected: success. A failure naming `probe` as undefined in `player.gs` falsifies the design's central assumption — stop and report it rather than working around it.

- [ ] **Step 5: Confirm the variable is global, not per-sprite**

Call `project_summary`. Expected: `probe` appears once, as a stage/global variable, not duplicated per sprite.

- [ ] **Step 6: Commit**

```bash
git add space_invaders
git commit -m "feat: scaffold the goboscript project and verify global scoping"
```

---

### Task 3: Player ship

**Files:**
- Modify: `space_invaders/stage.gs`, `space_invaders/player.gs`
- Assets: `ship` costume via `project_add_costume`

**Interfaces:**
- Consumes: the global idiom from Task 2.
- Produces: globals `player_x`, `game_state`; sprite `player` positioned at y = -150.

- [ ] **Step 1: Replace `stage.gs` with the real global declarations**

Keep the `costumes` line as the first line. Task 2 established that the Stage is a
target like any other: a `.gs` file with no costume declaration fails the build
with `error: no costumes`. Task 10 adds the real backdrop alongside it.

```goboscript
costumes "assets/blank.svg";

var game_state;
var player_x;
var score;
var lives;
var alive_total;
var formation_x;
var formation_y;
var march_dir;
var anim_frame;
var bullet_active;
var bomb_count;

list grid = [1; 55];
list col_count = [5; 11];
list row_count = [11; 5];

proc reset_state {
    game_state = 1;
    score = 0;
    lives = 3;
    alive_total = 55;
    formation_x = -150;
    formation_y = 140;
    march_dir = 1;
    anim_frame = 0;
    bullet_active = 0;
    bomb_count = 0;
    i = 1;
    repeat 55 {
        grid[i] = 1;
        i++;
    }
    i = 1;
    repeat 11 {
        col_count[i] = 5;
        i++;
    }
    i = 1;
    repeat 5 {
        row_count[i] = 11;
        i++;
    }
}

onflag {
    hide score;
    hide lives;
    reset_state;
    show score;
    show lives;
    broadcast "start_game";
}
```

- [ ] **Step 2: Write `player.gs` (keep the existing `costumes` line at the top)**

```goboscript
onflag {
    hide;
}

on "start_game" {
    switch_costume "ship";
    set_rotation_style_do_not_rotate;
    goto 0, -150;
    show;
    forever {
        if game_state == 1 {
            if key_pressed("left arrow") or key_pressed("a") {
                change_x -5;
            }
            if key_pressed("right arrow") or key_pressed("d") {
                change_x 5;
            }
            if x_position() < -225 {
                set_x -225;
            }
            if x_position() > 225 {
                set_x 225;
            }
            player_x = x_position();
            if key_pressed("space") and bullet_active == 0 {
                broadcast "fire";
            }
        }
    }
}
```

- [ ] **Step 3: Add the ship costume**

Call `project_add_costume` with `sprite: "player"`, `name: "ship"`, and this SVG:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="26" height="16" viewBox="0 0 26 16">
  <g fill="#4ce04c">
    <rect x="12" y="0" width="2" height="4"/>
    <rect x="11" y="4" width="4" height="3"/>
    <rect x="2" y="7" width="22" height="4"/>
    <rect x="0" y="11" width="26" height="4"/>
  </g>
</svg>
```

- [ ] **Step 4: Build**

Call `project_build`. Expected: success.

- [ ] **Step 5: Verify the build contents**

Call `project_summary`. Expected: `player` declares costumes `blank` and `ship`; globals include `player_x` and `game_state`; no stale-build warning.

- [ ] **Step 6: CHECKPOINT — human plays**

Open the built `.sb3` in the Scratch editor. The ship should appear near the bottom and move left/right with the arrow keys, stopping at both edges.

- [ ] **Step 7: Commit**

```bash
git add space_invaders
git commit -m "feat: player ship with clamped horizontal movement"
```

---

### Task 4: Player shot

One shot on screen at a time — a plain sprite, not a clone, matching the original.

**Files:**
- Create: `space_invaders/bullet.gs`
- Assets: `shot` costume

**Interfaces:**
- Consumes: `player_x`, `bullet_active`, broadcast `"fire"` from Task 3.
- Produces: a travelling shot that clears `bullet_active` on expiry. Task 6 adds kill detection to the same loop.

- [ ] **Step 1: Write `bullet.gs`**

```goboscript
onflag {
    hide;
}

on "start_game" {
    hide;
}

on "fire" {
    if bullet_active == 0 {
        bullet_active = 1;
        switch_costume "shot";
        goto player_x, -138;
        show;
        until bullet_active == 0 {
            change_y 10;
            if y_position() > 175 {
                bullet_active = 0;
            }
        }
        hide;
    }
}
```

- [ ] **Step 2: Add the shot costume**

Call `project_add_costume` with `sprite: "bullet"`, `name: "shot"`, and:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="2" height="8" viewBox="0 0 2 8">
  <rect x="0" y="0" width="2" height="8" fill="#ffffff"/>
</svg>
```

- [ ] **Step 3: Build**

Call `project_build`. Expected: success.

- [ ] **Step 4: CHECKPOINT — human plays**

Space fires a shot that rises and vanishes at the top. Holding space must **not** produce a stream — exactly one shot may be airborne.

- [ ] **Step 5: Commit**

```bash
git add space_invaders
git commit -m "feat: single-shot player fire"
```

---

### Task 5: Invader formation — spawn and render

55 clones that render from the globals. No movement yet.

**Files:**
- Create: `space_invaders/invader.gs`
- Assets: six costumes (three species × two frames)

**Interfaces:**
- Consumes: `formation_x`, `formation_y`, `anim_frame`, `grid`.
- Produces: 55 clones, each holding per-clone `col`, `row`, `idx`, `species`. Spawning hangs off the existing `"start_game"` broadcast — there is no separate `"spawn_invaders"` message.

- [ ] **Step 1: Write `invader.gs`**

`col`, `row`, `idx` and `species` are assigned only here, never in `stage.gs`, so they stay *for this sprite only* — which makes them per-clone. That is the only clone-identity mechanism Scratch offers.

```goboscript
var col;
var row;
var idx;
var species;
var i;
var j;

onflag {
    hide;
}

on "start_game" {
    hide;
    i = 0;
    repeat 5 {
        j = 0;
        repeat 11 {
            row = i;
            col = j;
            idx = i * 11 + j + 1;
            if i == 0 {
                species = 2;
            } elif i <= 2 {
                species = 1;
            } else {
                species = 0;
            }
            clone;
            j++;
        }
        i++;
    }
    idx = 0;
}
```

The trailing `idx = 0;` matters: clones inherit the original's variable values at
`clone` time, so by the end of the loop the *original* sprite is left holding
`idx = 55`. Task 10 distinguishes the original from its clones with `idx == 0`,
and without this reset the original would delete itself at the first game over,
leaving nothing to spawn the next round.

```goboscript
onclone {
    show;
    forever {
        if grid[idx] == 0 {
            hide;
            delete_this_clone;
        }
        goto formation_x + col * 30, formation_y - row * 24;
        switch_costume species * 2 + anim_frame + 1;
    }
}
```

- [ ] **Step 2: Add the six costumes in this exact order**

Costume order equals declaration order, and `switch_costume <number>` indexes it. `project_add_costume` appends after the last `costumes` statement, so calling these in sequence yields octopus=1,2 crab=3,4 squid=5,6 — matching `species * 2 + anim_frame + 1`.

Call `project_add_costume` six times with `sprite: "invader"` and names `octo_a`, `octo_b`, `crab_a`, `crab_b`, `squid_a`, `squid_b`.

`octo_a`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16" viewBox="0 0 24 16">
  <g fill="#ffffff">
    <rect x="6" y="0" width="12" height="2"/><rect x="2" y="2" width="20" height="2"/>
    <rect x="0" y="4" width="24" height="4"/><rect x="0" y="8" width="4" height="2"/>
    <rect x="8" y="8" width="8" height="2"/><rect x="20" y="8" width="4" height="2"/>
    <rect x="4" y="10" width="16" height="2"/><rect x="2" y="12" width="4" height="2"/>
    <rect x="18" y="12" width="4" height="2"/><rect x="0" y="14" width="4" height="2"/>
    <rect x="20" y="14" width="4" height="2"/>
  </g>
</svg>
```

`octo_b`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16" viewBox="0 0 24 16">
  <g fill="#ffffff">
    <rect x="6" y="0" width="12" height="2"/><rect x="2" y="2" width="20" height="2"/>
    <rect x="0" y="4" width="24" height="4"/><rect x="0" y="8" width="4" height="2"/>
    <rect x="8" y="8" width="8" height="2"/><rect x="20" y="8" width="4" height="2"/>
    <rect x="4" y="10" width="16" height="2"/><rect x="6" y="12" width="4" height="2"/>
    <rect x="14" y="12" width="4" height="2"/><rect x="8" y="14" width="8" height="2"/>
  </g>
</svg>
```

`crab_a`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="16" viewBox="0 0 22 16">
  <g fill="#ffffff">
    <rect x="0" y="0" width="2" height="4"/><rect x="20" y="0" width="2" height="4"/>
    <rect x="4" y="2" width="2" height="2"/><rect x="16" y="2" width="2" height="2"/>
    <rect x="2" y="4" width="18" height="2"/><rect x="0" y="6" width="22" height="4"/>
    <rect x="0" y="10" width="4" height="2"/><rect x="8" y="10" width="6" height="2"/>
    <rect x="18" y="10" width="4" height="2"/><rect x="4" y="12" width="4" height="2"/>
    <rect x="14" y="12" width="4" height="2"/>
  </g>
</svg>
```

`crab_b`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="16" viewBox="0 0 22 16">
  <g fill="#ffffff">
    <rect x="0" y="0" width="2" height="4"/><rect x="20" y="0" width="2" height="4"/>
    <rect x="4" y="2" width="2" height="2"/><rect x="16" y="2" width="2" height="2"/>
    <rect x="2" y="4" width="18" height="2"/><rect x="0" y="6" width="22" height="4"/>
    <rect x="4" y="10" width="2" height="2"/><rect x="8" y="10" width="6" height="2"/>
    <rect x="16" y="10" width="2" height="2"/><rect x="0" y="12" width="4" height="2"/>
    <rect x="18" y="12" width="4" height="2"/>
  </g>
</svg>
```

`squid_a`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <g fill="#ffffff">
    <rect x="6" y="0" width="4" height="2"/><rect x="4" y="2" width="8" height="2"/>
    <rect x="2" y="4" width="12" height="2"/><rect x="0" y="6" width="4" height="2"/>
    <rect x="6" y="6" width="4" height="2"/><rect x="12" y="6" width="4" height="2"/>
    <rect x="0" y="8" width="16" height="2"/><rect x="2" y="10" width="2" height="2"/>
    <rect x="12" y="10" width="2" height="2"/><rect x="0" y="12" width="2" height="2"/>
    <rect x="14" y="12" width="2" height="2"/>
  </g>
</svg>
```

`squid_b`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <g fill="#ffffff">
    <rect x="6" y="0" width="4" height="2"/><rect x="4" y="2" width="8" height="2"/>
    <rect x="2" y="4" width="12" height="2"/><rect x="0" y="6" width="4" height="2"/>
    <rect x="6" y="6" width="4" height="2"/><rect x="12" y="6" width="4" height="2"/>
    <rect x="0" y="8" width="16" height="2"/><rect x="4" y="10" width="2" height="2"/>
    <rect x="10" y="10" width="2" height="2"/><rect x="6" y="12" width="4" height="2"/>
  </g>
</svg>
```

- [ ] **Step 3: Build**

Call `project_build`. Expected: success.

- [ ] **Step 4: Verify clone count and costumes**

Call `project_summary`. Expected: `invader` declares 6 costumes plus the scaffold blank; no oversized-asset warnings.

- [ ] **Step 5: CHECKPOINT — human plays**

A 5 × 11 block of invaders appears in the upper half, three visibly different species, evenly spaced and not overlapping. They do not move yet.

- [ ] **Step 6: Commit**

```bash
git add space_invaders
git commit -m "feat: invader formation spawn and render"
```

---

### Task 6: Marching, edge detection and speed-up

**Files:**
- Modify: `space_invaders/invader.gs`

**Interfaces:**
- Consumes: `col_count`, `row_count`, `alive_total`, `formation_x`, `formation_y`, `march_dir`, `anim_frame`.
- Produces: `lose_line_crossed` set when the formation reaches the player; broadcast `"game_over"`.

- [ ] **Step 1: Add the march driver to `invader.gs`**

Runs on the original (hidden) sprite, not on any clone. Hand-translated from
`space_invaders/tools/formation.py` — `formation_edges` and `march_wait` — so keep both in step.

`until` has no early exit, so the alive-column scan uses a bounded `until` loop
rather than a `repeat` with a break.

```goboscript
var lc;
var rc;
var rb;
var left_edge;
var right_edge;

proc compute_edges {
    lc = 0;
    until col_count[lc + 1] > 0 or lc > 10 {
        lc++;
    }
    rc = 10;
    until col_count[rc + 1] > 0 or rc < 0 {
        rc--;
    }
    left_edge = formation_x + lc * 30 - 11;
    right_edge = formation_x + rc * 30 + 11;
}

proc lowest_alive_row {
    rb = 4;
    until row_count[rb + 1] > 0 or rb < 0 {
        rb--;
    }
}

on "march" {
    until game_state != 1 {
        wait 0.03 + 0.42 * alive_total / 55;
        if game_state == 1 and alive_total > 0 {
            compute_edges;
            if march_dir == 1 and right_edge >= 230 {
                formation_y -= 16;
                march_dir = -1;
            } elif march_dir == -1 and left_edge <= -230 {
                formation_y -= 16;
                march_dir = 1;
            } else {
                formation_x += march_dir * 8;
            }
            anim_frame = 1 - anim_frame;
            lowest_alive_row;
            if rb >= 0 and formation_y - rb * 24 <= -130 {
                game_state = 2;
                broadcast "game_over";
            }
        }
    }
}
```

- [ ] **Step 2: Broadcast `"march"` from `stage.gs`**

Append to the `onflag` hat in `stage.gs`, after `broadcast "start_game";`:

```goboscript
    broadcast "march";
```

- [ ] **Step 3: Build**

Call `project_build`. Expected: success.

- [ ] **Step 4: CHECKPOINT — human plays**

The formation marches sideways in discrete steps, wobbling between two costumes;
on reaching either wall it drops and reverses. It keeps descending until it
reaches the ship's row, at which point it stops. Speed-up is not yet observable —
nothing can die yet.

- [ ] **Step 5: Commit**

```bash
git add space_invaders
git commit -m "feat: formation marching with arithmetic edge detection"
```

---

### Task 7: Kill detection, scoring and the win state

**Files:**
- Modify: `space_invaders/bullet.gs`

**Interfaces:**
- Consumes: `grid`, `col_count`, `row_count`, `alive_total`, `formation_x`, `formation_y`.
- Produces: `score` updates, broadcast `"level_clear"`.

- [ ] **Step 1: Add `check_hit` to `bullet.gs`**

Hand-translated from `grid_index`, `cell_x` and `cell_y` in the oracle. The
hitbox proximity test is what stops a shot passing *between* two columns from
registering on the nearer one.

```goboscript
var bx;
var by;
var c;
var r;
var k;

proc check_hit {
    bx = x_position();
    by = y_position();
    c = round((bx - formation_x) / 30);
    r = round((formation_y - by) / 24);
    if c >= 0 and c <= 10 and r >= 0 and r <= 4 {
        k = r * 11 + c + 1;
        if grid[k] == 1 and (abs (bx - (formation_x + c * 30))) <= 11 and (abs (by - (formation_y - r * 24))) <= 8 {
            grid[k] = 0;
            col_count[c + 1] -= 1;
            row_count[r + 1] -= 1;
            alive_total -= 1;
            if r == 0 {
                score += 30;
            } elif r <= 2 {
                score += 20;
            } else {
                score += 10;
            }
            bullet_active = 0;
            if alive_total == 0 {
                game_state = 3;
                broadcast "level_clear";
            }
        }
    }
}
```

- [ ] **Step 2: Call it from the travel loop**

In `bullet.gs`, inside `until bullet_active == 0 { ... }`, after the top-of-screen
check, add:

```goboscript
            if bullet_active == 1 {
                check_hit;
            }
```

- [ ] **Step 3: Build**

Call `project_build`. Expected: success.

- [ ] **Step 4: CHECKPOINT — human plays**

Shots destroy the invader they visually hit — specifically *that* one, not a
neighbour. The score rises by 30/20/10 by row. The formation visibly accelerates
as it thins, ending in the last-invader sprint. Clearing all 55 ends the round.

Shots fired into a gap between columns must pass through without scoring. This is
the single most likely place for the arithmetic to be wrong; test it deliberately.

- [ ] **Step 5: Commit**

```bash
git add space_invaders
git commit -m "feat: arithmetic kill detection, scoring and win state"
```

---

### Task 8: Invader bombs, lives and the lose state

**Files:**
- Create: `space_invaders/bomb.gs`
- Modify: `space_invaders/invader.gs`, `space_invaders/stage.gs`
- Assets: `bomb` costume

**Interfaces:**
- Consumes: `grid`, `col_count`, `alive_total`, `bomb_count`, `lives`, `game_state`.
- Produces: globals `bomb_x`, `bomb_y` (spawn origin); broadcasts `"drop_bomb"`, `"life_lost"`, `"game_over"`.

- [ ] **Step 1: Add the bomb spawner to `invader.gs`**

Picks a random alive column, then the lowest alive invader in it. Uses a bounded
`until` scan, like the edge computation.

```goboscript
var bc;
var br;
var tries;

on "bombs" {
    until game_state != 1 {
        wait 0.4 + 1.6 * alive_total / 55;
        if game_state == 1 and bomb_count < 3 and alive_total > 0 {
            tries = 0;
            bc = random(0, 10);
            until col_count[bc + 1] > 0 or tries > 20 {
                bc = random(0, 10);
                tries++;
            }
            if col_count[bc + 1] > 0 {
                br = 4;
                until grid[br * 11 + bc + 1] == 1 or br < 0 {
                    br--;
                }
                if br >= 0 {
                    bomb_x = formation_x + bc * 30;
                    bomb_y = formation_y - br * 24;
                    broadcast "drop_bomb";
                }
            }
        }
    }
}
```

- [ ] **Step 2: Declare `bomb_x` and `bomb_y` as globals in `stage.gs`**

Add alongside the other `var` declarations:

```goboscript
var bomb_x;
var bomb_y;
```

- [ ] **Step 3: Broadcast `"bombs"` from `stage.gs`**

Append to the `onflag` hat, after `broadcast "march";`:

```goboscript
    broadcast "bombs";
```

- [ ] **Step 4: Write `bomb.gs`**

```goboscript
onflag {
    hide;
}

on "drop_bomb" {
    bomb_count += 1;
    switch_costume "bomb";
    goto bomb_x, bomb_y;
    clone;
}

onclone {
    show;
    until y_position() < -172 or game_state != 1 {
        change_y -5;
        if touching("player") {
            broadcast "life_lost";
            hide;
            bomb_count -= 1;
            delete_this_clone;
        }
    }
    hide;
    bomb_count -= 1;
    delete_this_clone;
}
```

`bomb_count` is decremented on the clone's death path, never in the spawn
handler. Incrementing and decrementing either side of `clone;` would leave the
count permanently at zero and the three-bomb cap would never bind.
`delete_this_clone` ends the script, so the two decrements cannot both run.

- [ ] **Step 5: Add the bomb costume**

Call `project_add_costume` with `sprite: "bomb"`, `name: "bomb"`, and:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="6" height="12" viewBox="0 0 6 12">
  <g fill="#ffffff">
    <rect x="2" y="0" width="2" height="3"/><rect x="0" y="3" width="2" height="3"/>
    <rect x="2" y="6" width="2" height="3"/><rect x="4" y="9" width="2" height="3"/>
  </g>
</svg>
```

- [ ] **Step 6: Handle life loss in `stage.gs`**

```goboscript
on "life_lost" {
    if game_state == 1 {
        lives -= 1;
        if lives <= 0 {
            game_state = 2;
            broadcast "game_over";
        }
    }
}
```

- [ ] **Step 7: Build**

Call `project_build`. Expected: success.

- [ ] **Step 8: CHECKPOINT — human plays**

Bombs fall from the lowest invader of varied columns, never more than three at
once. Being hit costs a life; three hits ends the game. Bomb pressure visibly
rises as the formation thins.

- [ ] **Step 9: Commit**

```bash
git add space_invaders
git commit -m "feat: invader bombs, lives and lose state"
```

---

### Task 9: Bonus UFO

Self-contained: nothing else depends on it.

**Files:**
- Create: `space_invaders/ufo.gs`
- Modify: `space_invaders/bullet.gs`, `space_invaders/stage.gs`
- Assets: `saucer` costume

**Interfaces:**
- Consumes: `game_state`, `score`.
- Produces: global `ufo_active`; broadcast `"ufo_hit"`.

- [ ] **Step 1: Declare `ufo_active` in `stage.gs`** (alongside the other `var` lines)

```goboscript
var ufo_active;
```

Set it in `reset_state`:

```goboscript
    ufo_active = 0;
```

- [ ] **Step 2: Write `ufo.gs`**

```goboscript
var dir;

onflag {
    hide;
}

on "start_game" {
    hide;
    ufo_active = 0;
    until game_state != 1 {
        wait random(18, 28);
        if game_state == 1 and ufo_active == 0 {
            ufo_active = 1;
            switch_costume "saucer";
            dir = 1;
            if random(0, 1) == 0 {
                dir = -1;
            }
            goto dir * -250, 160;
            show;
            until (abs x_position()) > 245 or ufo_active == 0 {
                change_x dir * 2;
            }
            hide;
            ufo_active = 0;
        }
    }
    hide;
}

on "ufo_hit" {
    ufo_active = 0;
    hide;
}
```

- [ ] **Step 3: Add UFO collision to `check_hit` in `bullet.gs`**

At the top of the `check_hit` body, before the grid arithmetic:

```goboscript
    if ufo_active == 1 and touching("ufo") {
        score += 50 * random(1, 3);
        bullet_active = 0;
        broadcast "ufo_hit";
        stop_this_script;
    }
```

`touching` is safe here: the UFO is a single sprite, so the which-clone
ambiguity that rules it out for invaders does not arise.

- [ ] **Step 4: Add the saucer costume**

Call `project_add_costume` with `sprite: "ufo"`, `name: "saucer"`, and:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="14" viewBox="0 0 32 14">
  <g fill="#ff2d2d">
    <rect x="10" y="0" width="12" height="2"/><rect x="6" y="2" width="20" height="2"/>
    <rect x="2" y="4" width="28" height="2"/><rect x="0" y="6" width="32" height="4"/>
    <rect x="4" y="10" width="4" height="2"/><rect x="12" y="10" width="4" height="2"/>
    <rect x="20" y="10" width="4" height="2"/>
  </g>
</svg>
```

- [ ] **Step 5: Build**

Call `project_build`. Expected: success.

- [ ] **Step 6: CHECKPOINT — human plays**

A red saucer crosses the top every 18–28 seconds, from a random side. Shooting it
awards 50/100/150 and removes it. Missing it lets it exit harmlessly.

- [ ] **Step 7: Commit**

```bash
git add space_invaders
git commit -m "feat: bonus UFO"
```

---

### Task 10: Game-over and level-clear presentation, and restart

**Files:**
- Modify: `space_invaders/stage.gs`, `space_invaders/player.gs`, `space_invaders/invader.gs`
- Assets: stage backdrop

**Interfaces:**
- Consumes: `game_state`, broadcasts `"game_over"` and `"level_clear"`.
- Produces: a restartable game.

- [ ] **Step 1: Add a black backdrop**

Call `project_add_costume` with `sprite: "stage"`, `name: "space"`, and:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <rect x="0" y="0" width="480" height="360" fill="#000000"/>
</svg>
```

- [ ] **Step 2: Clear clones on both end states**

Scratch has no "delete all clones" block, so each clone must remove itself. Add
to `invader.gs`:

```goboscript
on "reset_clones" {
    if idx > 0 {
        hide;
        delete_this_clone;
    }
}
```

`idx` is 0 on the original sprite and ≥ 1 on every clone, so the original
survives to spawn the next round.

- [ ] **Step 3: Add end-state handling to `stage.gs`**

```goboscript
on "start_game" {
    switch_backdrop "space";
}

on "game_over" {
    broadcast "reset_clones";
}

on "level_clear" {
    broadcast "reset_clones";
}
```

- [ ] **Step 4: Announce the result from `player.gs`**

Append:

```goboscript
on "game_over" {
    say "GAME OVER - press the green flag";
}

on "level_clear" {
    say "WAVE CLEARED - press the green flag";
}
```

- [ ] **Step 5: Build**

Call `project_build`. Expected: success.

- [ ] **Step 6: Verify the whole build**

Call `project_summary`. Expected: six sprites, no unused-asset warnings, no stale
build. Confirm the reported block counts are non-trivial for every sprite — a
sprite reporting near-zero blocks means its file was silently not picked up.

- [ ] **Step 7: CHECKPOINT — human plays a full round**

Win and lose are both reachable. The green flag cleanly restarts from a full
formation with score and lives reset and no leftover clones from the last round.

- [ ] **Step 8: Commit**

```bash
git add space_invaders
git commit -m "feat: end states, backdrop and clean restart"
```

---

### Task 11: Publish

**Files:** none changed.

- [ ] **Step 1: Confirm with the human before uploading**

Publishing puts the project on the `6DRAGON9` account. Do not upload without an
explicit go-ahead in the conversation.

- [ ] **Step 2: Save privately**

Call `project_save_to_cloud` with `title: "Space Invaders"`, `visibility: "private"`, `build: true`.

- [ ] **Step 3: Set the thumbnail**

Call `project_set_thumbnail` with no `file`, so the Stage backdrop is used.
Scratch only generates thumbnails inside its own editor; an uploaded project
shows a grey placeholder otherwise.

- [ ] **Step 4: Report the project URL and stop**

Leave it private. Going public is the human's call, in a separate step.

---

## Deferred

Tracked so they are not silently lost:

### Open findings from the build (carried over)

- **Score and lives monitors may not display outside the Scratch editor.** The compiled
  `project.json` has an empty `monitors` array; `show variable` routes through
  `Blocks.changeBlock`, which returns early when no monitor block exists for that id. Works
  in the editor (the flyout populates `runtime.monitorBlocks`); unverified in a bare player.
  Highest-value thing to check by hand — if broken, the game has no visible score.
- **Bomb column retry can skip a firing cycle.** `invader.gs`'s `bc = random(0, 10)` retries
  22 times; with exactly one alive column that misses ~12% of the time, skipping one ~0.43 s
  cycle. At two columns it is ~1.2%. A deterministic scan from a random start would be
  strictly better if this is ever touched.
- **`space_invaders/tools/formation.py` coverage is narrower than it looks.** It has `HALF_W = 11` but no
  vertical half-height, so `bullet.gs`'s hitbox `8` is unverified. It also does not model the
  `round()` cell mapping, `bomb_wait`, the +/-230 reversal, or the lose line.
- **Invaders spawn staggered over ~1.8 s.** The nested spawn `repeat` is non-warp and yields
  once per clone, so invaders pop in one at a time. Cosmetic, but it is the first thing a
  player sees. Do NOT "fix" this by guarding the spawn hat with `if idx == 0` — that was
  tried and creates a Critical: a green flag pressed inside the spawn window strands `idx`
  non-zero and permanently stops all future spawning.
- **Two `life_lost` broadcasts in one frame coalesce**, so simultaneous hits cost one life.
  Player-favourable; left as is.
- **`game_state == 0` ("title") is unreachable.** The spec names the state; no title screen
  exists and the green flag drops straight into play.
- **Publishing through the MCP server does not work.** `scratchattach 3.0.0b3` omits the
  `?token=` query parameter that Scratch requires for unshared projects, so both
  `create_project` and `set_json` return `403 missing`. `create_project` is additionally
  marked `# not working` in the library's own source. Workaround used: load the built `.sb3`
  into the Scratch editor and save. A local patch adding the project token to those two
  calls would restore one-step publishing.

### Features scoped out of level one

- **Destructible bunkers** — needs a costume-swap or clone-chunk erosion workaround.
- **Player explosion frame** — the spec's art list includes one; no task adds it, so the ship currently just loses a life with no visual feedback. Cosmetic, one extra costume plus a costume swap in the `"life_lost"` handler.
- **Sound** — the four-note bassline that accelerates with the march. Needs sourced MP3/WAV; cannot be generated inline the way SVG art can.
- **Multiple levels** — formation starts lower each wave.
- **High-score persistence** — cloud variables, which carry a New Scratcher restriction.
