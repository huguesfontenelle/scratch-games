costumes "assets/shot.svg";

var bx;
var by;
var c;
var r;
var k;

onflag {
    hide;
}

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
            if bullet_active == 1 {
                check_hit;
            }
        }
        hide;
    }
}
