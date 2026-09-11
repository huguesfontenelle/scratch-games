costumes "assets/blank.svg";
costumes "assets/ship.svg";
costumes "assets/boom.svg";

onflag {
    hide;
}

on "start_game" {
    say "";
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

on "game_over" {
    say "GAME OVER - press the green flag";
}

on "level_clear" {
    say "WAVE CLEARED - press the green flag";
}

on "life_lost" {
    switch_costume "boom";
    wait 0.4;
    switch_costume "ship";
}
