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
