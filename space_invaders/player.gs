costumes "assets/blank.svg";
costumes "assets/ship.svg";

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
