import curses
import random
import time


def main(stdscr):
    curses.curs_set(0)
    curses.start_color()
    curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)   # snake
    curses.init_pair(2, curses.COLOR_RED, curses.COLOR_BLACK)     # food
    curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)  # border/score
    curses.init_pair(4, curses.COLOR_CYAN, curses.COLOR_BLACK)    # title

    while True:
        result = play_game(stdscr)
        if not game_over_screen(stdscr, result):
            break


def play_game(stdscr):
    sh, sw = stdscr.getmaxyx()
    # Game area inside border
    top, left = 2, 1
    height = sh - 3
    width = sw - 2

    if height < 10 or width < 20:
        stdscr.addstr(0, 0, "Terminal too small! Need at least 22x13.")
        stdscr.getch()
        return 0

    win = curses.newwin(sh, sw, 0, 0)
    win.keypad(True)
    win.timeout(100)

    # Draw border
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

    # Snake starts in center
    mid_y = top + height // 2
    mid_x = left + width // 2
    snake = [(mid_y, mid_x), (mid_y, mid_x - 1), (mid_y, mid_x - 2)]
    direction = curses.KEY_RIGHT
    score = 0
    speed = 100

    def place_food():
        while True:
            fy = random.randint(top + 1, top + height - 2)
            fx = random.randint(left + 1, left + width - 2)
            if (fy, fx) not in snake:
                return (fy, fx)

    food = place_food()
    win.addch(food[0], food[1], '*', curses.color_pair(2) | curses.A_BOLD)

    # Draw initial snake
    for i, (y, x) in enumerate(snake):
        ch = '@' if i == 0 else 'o'
        win.addch(y, x, ch, curses.color_pair(1) | curses.A_BOLD)

    title = " SNAKE "
    win.addstr(0, (sw - len(title)) // 2, title, curses.color_pair(4) | curses.A_BOLD)
    score_str = f" Score: {score} "
    win.addstr(0, sw - len(score_str) - 2, score_str, curses.color_pair(3) | curses.A_BOLD)

    opposite = {
        curses.KEY_UP: curses.KEY_DOWN,
        curses.KEY_DOWN: curses.KEY_UP,
        curses.KEY_LEFT: curses.KEY_RIGHT,
        curses.KEY_RIGHT: curses.KEY_LEFT,
    }

    while True:
        key = win.getch()

        if key == 27:  # ESC
            return score
        if key in (curses.KEY_UP, curses.KEY_DOWN, curses.KEY_LEFT, curses.KEY_RIGHT):
            if key != opposite.get(direction):
                direction = key
        # WASD support
        if key in (ord('w'), ord('W')):
            if direction != curses.KEY_DOWN:
                direction = curses.KEY_UP
        elif key in (ord('s'), ord('S')):
            if direction != curses.KEY_UP:
                direction = curses.KEY_DOWN
        elif key in (ord('a'), ord('A')):
            if direction != curses.KEY_RIGHT:
                direction = curses.KEY_LEFT
        elif key in (ord('d'), ord('D')):
            if direction != curses.KEY_LEFT:
                direction = curses.KEY_RIGHT

        head_y, head_x = snake[0]
        if direction == curses.KEY_UP:
            head_y -= 1
        elif direction == curses.KEY_DOWN:
            head_y += 1
        elif direction == curses.KEY_LEFT:
            head_x -= 1
        elif direction == curses.KEY_RIGHT:
            head_x += 1

        # Check collision with walls
        if head_y <= top or head_y >= top + height - 1:
            return score
        if head_x <= left or head_x >= left + width - 1:
            return score

        # Check collision with self
        if (head_y, head_x) in snake:
            return score

        snake.insert(0, (head_y, head_x))

        if (head_y, head_x) == food:
            score += 10
            speed = max(50, speed - 2)
            win.timeout(speed)
            food = place_food()
            win.addch(food[0], food[1], '*', curses.color_pair(2) | curses.A_BOLD)
            score_str = f" Score: {score} "
            win.addstr(0, sw - len(score_str) - 2, score_str, curses.color_pair(3) | curses.A_BOLD)
        else:
            tail = snake.pop()
            win.addch(tail[0], tail[1], ' ')

        # Draw new head and update previous head to body
        win.addch(snake[0][0], snake[0][1], '@', curses.color_pair(1) | curses.A_BOLD)
        if len(snake) > 1:
            win.addch(snake[1][0], snake[1][1], 'o', curses.color_pair(1))

        win.refresh()


def game_over_screen(stdscr, score):
    sh, sw = stdscr.getmaxyx()
    stdscr.clear()

    msg = [
        "╔══════════════════════╗",
        "║     GAME  OVER!      ║",
        f"║   Score: {score:<12}║",
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
