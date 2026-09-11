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
