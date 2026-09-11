costumes "assets/blank.svg";

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
var i;

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
    i = 1;
    repeat 55 {
        grid[i] = 1;
        i++;
    }
    i = 1;
    repeat 11 {
        col_count[i] = 5;
        i++;
    }
    i = 1;
    repeat 5 {
        row_count[i] = 11;
        i++;
    }
}

onflag {
    hide score;
    hide lives;
    reset_state;
    show score;
    show lives;
    broadcast "start_game";
}
