costumes "assets/shot.svg";
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
