costumes "assets/blank.svg";
costumes "assets/space.svg";

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
var bomb_x;
var bomb_y;
var reset_i;
var ufo_active;

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
    ufo_active = 0;
    reset_i = 1;
    repeat 55 {
        grid[reset_i] = 1;
        reset_i++;
    }
    reset_i = 1;
    repeat 11 {
        col_count[reset_i] = 5;
        reset_i++;
    }
    reset_i = 1;
    repeat 5 {
        row_count[reset_i] = 11;
        reset_i++;
    }
}

onflag {
    hide score;
    hide lives;
    reset_state;
    show score;
    # Monitors created in the same frame get the same free spot and stack on top of each other.
    wait 0.1;
    show lives;
    broadcast "start_game";
    broadcast "march";
    broadcast "bombs";
}

on "life_lost" {
    if game_state == 1 {
        lives -= 1;
        if lives <= 0 {
            game_state = 2;
            broadcast "game_over";
        }
    }
}

on "start_game" {
    switch_backdrop "space";
}

on "game_over" {
    broadcast "reset_clones";
}

on "level_clear" {
    broadcast "reset_clones";
}
