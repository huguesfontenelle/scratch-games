costumes "assets/bomb.svg";

var is_clone;

onflag {
    hide;
}

on "drop_bomb" {
    if is_clone == 0 {
        bomb_count += 1;
        switch_costume "bomb";
        goto bomb_x, bomb_y;
        clone;
    }
}

onclone {
    is_clone = 1;
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
