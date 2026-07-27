# Conquista

Juego abstracto para dos jugadores que combina restricciones de Sudoku, capturas
por libertades, líneas de tres y ataques entre piezas numeradas.

## Arquitectura

El juego sigue funcionando desde un único archivo `index.html`, sin dependencias
ni proceso de compilación. Dentro de ese archivo existen dos capas separadas:

1. `ConquistaEngine`: motor puro de reglas y estado.
2. Adaptador de interfaz: convierte eventos del jugador en jugadas y renderiza el
   estado devuelto por el motor.

Toda transición de partida pasa por:

```js
ConquistaEngine.applyMove(estado, jugada)
```

El motor no utiliza DOM ni temporizadores. Las demoras se reservan para efectos
visuales y nunca modifican el estado.

Los estados de error también se devuelven como copias independientes. Un estado
nulo o estructuralmente inválido lanza `TypeError` para impedir que la interfaz
adopte un estado incompleto. Deshacer conserva el comportamiento original y se
bloquea una vez terminada la partida. El historial mantiene como máximo los 50
estados más recientes para acotar su consumo de memoria.

## Pruebas

Requiere Node.js 18 o posterior y no instala paquetes:

```bash
node --test tests/*.test.js
```

## Simulación de terminación y puntuación

La matriz corregida de las fases 2 y 3 se reproduce sin dependencias:

```bash
node simulations/phase2-3-v2.js --games 1000 --workers 8 --seed 20260727
```

El comando genera `reports/fases-2-3-v2.md` y `reports/fases-2-3-v2.json`. Ejecuta
72,000 partidas: A×A, B×B, C×C y D3×D3 para las doce combinaciones, además de
D3 contra B y D3 contra D2. D usa minimax alfa-beta selectivo de ancho cuatro;
el reporte declara la cartera táctica y sus límites. El simulador es experimental
y no modifica las reglas del `index.html`.

Los archivos `fases-2-3.md` y `fases-2-3.json` se conservan como antecedente de
la metodología descartada, que elegía primero una familia de acciones.
