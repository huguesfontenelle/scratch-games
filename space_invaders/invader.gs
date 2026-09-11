costumes "assets/octo_a.svg";
costumes "assets/octo_b.svg";
costumes "assets/crab_a.svg";
costumes "assets/crab_b.svg";
costumes "assets/squid_a.svg";
costumes "assets/squid_b.svg";
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
