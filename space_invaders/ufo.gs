costumes "assets/saucer.svg";
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
            until x_position() * dir > 245 or ufo_active == 0 or game_state != 1 {
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
