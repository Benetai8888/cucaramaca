import curses
import time
import random


def main(stdscr):
    curses.curs_set(0)
    curses.start_color()
    curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)   # paddles
    curses.init_pair(2, curses.COLOR_RED, curses.COLOR_BLACK)     # ball
    curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)  # border/score
    curses.init_pair(4, curses.COLOR_CYAN, curses.COLOR_BLACK)    # title

    while True:
        result = play_game(stdscr)
        if not game_over_screen(stdscr, result):
            break


def play_game(stdscr):
    sh, sw = stdscr.getmaxyx()

    if sh < 15 or sw < 40:
        stdscr.addstr(0, 0, "Terminal too small! Need at least 40x15.")
        stdscr.getch()
        return (0, 0)

    win = curses.newwin(sh, sw, 0, 0)
    win.keypad(True)
    win.timeout(50)

    top, left = 2, 1
    height = sh - 3
    width = sw - 2
    paddle_h = max(3, height // 5)
    winning_score = 5

    # Paddles
    p1_x = left + 2
    p2_x = left + width - 3
    p1_y = top + height // 2 - paddle_h // 2
    p2_y = top + height // 2 - paddle_h // 2

    # Ball
    ball_y = top + height // 2
    ball_x = left + width // 2
    ball_dy = random.choice([-1, 1])
    ball_dx = random.choice([-1, 1])

    score1, score2 = 0, 0

    def draw_border():
        for y in range(top, top + height):
            win.addch(y, left, '|', curses.color_pair(3))
            win.addch(y, left + width - 1, '|', curses.color_pair(3))
        for x in range(left, left + width):
            win.addch(top, x, '-', curses.color_pair(3))
            win.addch(top + height - 1, x, '-', curses.color_pair(3))
        win.addch(top, left, '+', curses.color_pair(3))
        win.addch(top, left + width - 1, '+', curses.color_pair(3))
        win.addch(top + height - 1, left, '+', curses.color_pair(3))
        win.addch(top + height - 1, left + width - 1, '+', curses.color_pair(3))
        # Center line
        for y in range(top + 1, top + height - 1):
            if y % 2 == 0:
                win.addch(y, left + width // 2, ':', curses.color_pair(3))

    def draw_paddle(x, y):
        for i in range(paddle_h):
            if top < y + i < top + height - 1:
                win.addch(y + i, x, '#', curses.color_pair(1) | curses.A_BOLD)

    def clear_paddle(x, y):
        for i in range(paddle_h):
            if top < y + i < top + height - 1:
                win.addch(y + i, x, ' ')

    tick = 0

    while True:
        key = win.getch()

        if key == 27:
            return (score1, score2)

        # Player 1: W/S
        old_p1 = p1_y
        if key in (ord('w'), ord('W')) and p1_y > top + 1:
            p1_y -= 1
        elif key in (ord('s'), ord('S')) and p1_y + paddle_h < top + height - 1:
            p1_y += 1

        # Player 2: Up/Down arrows
        old_p2 = p2_y
        if key == curses.KEY_UP and p2_y > top + 1:
            p2_y -= 1
        elif key == curses.KEY_DOWN and p2_y + paddle_h < top + height - 1:
            p2_y += 1

        # Move ball every other tick for better control
        tick += 1
        if tick % 2 == 0:
            new_by = ball_y + ball_dy
            new_bx = ball_x + ball_dx

            # Top/bottom wall bounce
            if new_by <= top or new_by >= top + height - 1:
                ball_dy = -ball_dy
                new_by = ball_y + ball_dy

            # Paddle 1 collision
            if new_bx == p1_x and p1_y <= new_by < p1_y + paddle_h:
                ball_dx = abs(ball_dx)  # go right
                new_bx = ball_x + ball_dx
            # Paddle 2 collision
            elif new_bx == p2_x and p2_y <= new_by < p2_y + paddle_h:
                ball_dx = -abs(ball_dx)  # go left
                new_bx = ball_x + ball_dx

            # Score
            if new_bx <= left:
                score2 += 1
                if score2 >= winning_score:
                    return (score1, score2)
                new_bx = left + width // 2
                new_by = top + height // 2
                ball_dx = 1
                ball_dy = random.choice([-1, 1])
            elif new_bx >= left + width - 1:
                score1 += 1
                if score1 >= winning_score:
                    return (score1, score2)
                new_bx = left + width // 2
                new_by = top + height // 2
                ball_dx = -1
                ball_dy = random.choice([-1, 1])

            # Clear old ball
            win.addch(ball_y, ball_x, ' ')
            ball_y, ball_x = new_by, new_bx

        # Redraw
        win.erase()
        draw_border()

        title = " PONG "
        win.addstr(0, (sw - len(title)) // 2, title, curses.color_pair(4) | curses.A_BOLD)
        score_str = f" P1: {score1}  |  P2: {score2} "
        win.addstr(0, (sw - len(score_str)) // 2, score_str, curses.color_pair(3) | curses.A_BOLD)
        controls = " P1: W/S  |  P2: ↑/↓  |  ESC: Quit "
        win.addstr(sh - 1, (sw - len(controls)) // 2, controls, curses.color_pair(3))

        draw_paddle(p1_x, p1_y)
        draw_paddle(p2_x, p2_y)
        win.addch(ball_y, ball_x, 'O', curses.color_pair(2) | curses.A_BOLD)

        win.refresh()


def game_over_screen(stdscr, scores):
    sh, sw = stdscr.getmaxyx()
    stdscr.clear()
    s1, s2 = scores

    if s1 > s2:
        winner = "Player 1 Wins!"
    elif s2 > s1:
        winner = "Player 2 Wins!"
    else:
        winner = "It's a Tie!"

    msg = [
        "╔══════════════════════╗",
        "║     GAME  OVER!      ║",
        f"║  {winner:<20}║",
        f"║  P1: {s1}  -  P2: {s2:<5}║",
        "║                      ║",
        "║  [R] Play Again      ║",
        "║  [Q] Quit            ║",
        "╚══════════════════════╝",
    ]

    start_y = sh // 2 - len(msg) // 2
    for i, line in enumerate(msg):
        x = (sw - len(line)) // 2
        if x < 0:
            x = 0
        stdscr.addstr(start_y + i, x, line, curses.color_pair(3) | curses.A_BOLD)

    stdscr.refresh()
    stdscr.nodelay(False)
    while True:
        key = stdscr.getch()
        if key in (ord('r'), ord('R')):
            return True
        if key in (ord('q'), ord('Q'), 27):
            return False


if __name__ == "__main__":
    curses.wrapper(main)
