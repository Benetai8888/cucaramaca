# cucaramaca

Mini arcade retro en la terminal - just for fun!

## Juegos

- **Snake** - El clasico juego de la serpiente. Come la comida, crece, y no choques con las paredes ni contigo mismo.
- **Pong** - Pong para 2 jugadores. El primero en llegar a 5 puntos gana.

## Como jugar

```bash
python3 arcade.py
```

### Controles

**Menu:**
- `↑/↓` o `W/S` - Navegar
- `Enter` - Seleccionar
- `Q` - Salir

**Snake:**
- `↑/↓/←/→` o `W/A/S/D` - Mover la serpiente
- `ESC` - Volver al menu

**Pong:**
- Jugador 1: `W/S`
- Jugador 2: `↑/↓`
- `ESC` - Volver al menu

## Requisitos

- Python 3.6+
- Terminal con soporte para colores ANSI (la mayoria de terminales modernas)
- Modulo `curses` (incluido en Python en Linux/macOS)
