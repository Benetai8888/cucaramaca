#!/usr/bin/env python3
"""
 ██████╗██╗   ██╗ ██████╗ █████╗ ██████╗  █████╗ ███╗   ███╗ █████╗  ██████╗ █████╗
██╔════╝██║   ██║██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗ ████║██╔══██╗██╔════╝██╔══██╗
██║     ██║   ██║██║     ███████║██████╔╝███████║██╔████╔██║███████║██║     ███████║
██║     ██║   ██║██║     ██╔══██║██╔══██╗██╔══██║██║╚██╔╝██║██╔══██║██║     ██╔══██║
╚██████╗╚██████╔╝╚██████╗██║  ██║██║  ██║██║  ██║██║ ╚═╝ ██║██║  ██║╚██████╗██║  ██║
 ╚═════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝

Mini Arcade Retro - just for fun!
"""

import curses
import sys


GAMES = [
    ("Snake", "games.snake", "Classic snake game - eat food, grow, don't hit walls!"),
    ("Pong", "games.pong", "2-player Pong - first to 5 wins!"),
]

LOGO = [
    "  ██████╗██╗   ██╗ ██████╗ █████╗ ██████╗  █████╗ ███╗   ███╗ █████╗  ██████╗ █████╗ ",
    " ██╔════╝██║   ██║██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗ ████║██╔══██╗██╔════╝██╔══██╗",
    " ██║     ██║   ██║██║     ███████║██████╔╝███████║██╔████╔██║███████║██║     ███████║",
    " ██║     ██║   ██║██║     ██╔══██║██╔══██╗██╔══██║██║╚██╔╝██║██╔══██║██║     ██╔══██║",
    " ╚██████╗╚██████╔╝╚██████╗██║  ██║██║  ██║██║  ██║██║ ╚═╝ ██║██║  ██║╚██████╗██║  ██║",
    "  ╚═════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝",
]

SMALL_LOGO = [
    "~ CUCARAMACA ~",
    "Mini Arcade Retro",
]


def main(stdscr):
    curses.curs_set(0)
    curses.start_color()
    curses.init_pair(1, curses.COLOR_CYAN, curses.COLOR_BLACK)
    curses.init_pair(2, curses.COLOR_YELLOW, curses.COLOR_BLACK)
    curses.init_pair(3, curses.COLOR_GREEN, curses.COLOR_BLACK)
    curses.init_pair(4, curses.COLOR_RED, curses.COLOR_BLACK)
    curses.init_pair(5, curses.COLOR_MAGENTA, curses.COLOR_BLACK)

    selected = 0

    while True:
        stdscr.clear()
        sh, sw = stdscr.getmaxyx()

        # Draw logo
        logo = LOGO if sw >= 90 else SMALL_LOGO
        y = 1
        for i, line in enumerate(logo):
            x = max(0, (sw - len(line)) // 2)
            try:
                stdscr.addstr(y + i, x, line[:sw-1], curses.color_pair(1) | curses.A_BOLD)
            except curses.error:
                pass
        y += len(logo) + 1

        # Subtitle
        sub = "- just for fun! -"
        stdscr.addstr(y, max(0, (sw - len(sub)) // 2), sub, curses.color_pair(5))
        y += 2

        # Separator
        sep = "=" * min(50, sw - 4)
        stdscr.addstr(y, max(0, (sw - len(sep)) // 2), sep, curses.color_pair(2))
        y += 2

        # Game list
        header = "SELECT A GAME"
        stdscr.addstr(y, max(0, (sw - len(header)) // 2), header, curses.color_pair(2) | curses.A_BOLD)
        y += 2

        for i, (name, _, desc) in enumerate(GAMES):
            if i == selected:
                prefix = " >> "
                color = curses.color_pair(3) | curses.A_BOLD
            else:
                prefix = "    "
                color = curses.color_pair(0)

            line = f"{prefix}{name}"
            x = max(0, (sw - 40) // 2)
            try:
                stdscr.addstr(y, x, line, color)
                stdscr.addstr(y + 1, x + 4, desc[:sw-x-5], curses.color_pair(0))
            except curses.error:
                pass
            y += 3

        # Quit option
        y += 1
        if selected == len(GAMES):
            prefix = " >> "
            color = curses.color_pair(4) | curses.A_BOLD
        else:
            prefix = "    "
            color = curses.color_pair(4)

        x = max(0, (sw - 40) // 2)
        try:
            stdscr.addstr(y, x, f"{prefix}Quit", color)
        except curses.error:
            pass

        # Controls
        controls = "↑/↓ or W/S: Navigate  |  Enter: Select  |  Q: Quit"
        try:
            stdscr.addstr(sh - 1, max(0, (sw - len(controls)) // 2), controls, curses.color_pair(2))
        except curses.error:
            pass

        stdscr.refresh()

        key = stdscr.getch()

        if key in (curses.KEY_UP, ord('w'), ord('W')):
            selected = (selected - 1) % (len(GAMES) + 1)
        elif key in (curses.KEY_DOWN, ord('s'), ord('S')):
            selected = (selected + 1) % (len(GAMES) + 1)
        elif key in (10, curses.KEY_ENTER):
            if selected == len(GAMES):
                break
            launch_game(stdscr, GAMES[selected])
        elif key in (ord('q'), ord('Q'), 27):
            break


def launch_game(stdscr, game_info):
    name, module_path, _ = game_info
    import importlib
    try:
        mod = importlib.import_module(module_path)
        stdscr.clear()
        stdscr.refresh()
        mod.main(stdscr)
    except Exception as e:
        stdscr.clear()
        stdscr.addstr(0, 0, f"Error loading {name}: {e}")
        stdscr.addstr(2, 0, "Press any key to return...")
        stdscr.nodelay(False)
        stdscr.getch()


if __name__ == "__main__":
    curses.wrapper(main)
