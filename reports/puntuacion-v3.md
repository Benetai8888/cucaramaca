# Puntuación v3: discriminación y robustez

Fecha: 2026-07-27. Terminación fija: límite de 30 turnos.
Partidas por esquema y desempate: 100.
Total: 3,000 partidas. Semilla: 20260727.

“Jugadas únicas”: Jugadas cuyo valor inmediato aparece una sola vez en el turno.
“Valores distintos”: Valores inmediatos distintos dividido entre jugadas legales.
El filtro obligatorio usa la definición estricta de jugada única y exige un mínimo
de 20% en los tres desempates. Ataques debe representar 10%–25%; la variación
máxima del reparto entre desempates no puede exceder 10 puntos porcentuales.

## Resultados por desempate

| Esquema | Desempate | Únicas | Distintas | Empate en máximo | Colocar | Go | Líneas | Ataques | Empates | J1 | J2 | Trayectorias |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Control actual | Aleatorio | 0.1% | 0.4% | 56.7% | 44.5% | 0.5% | 43.4% | 11.6% | 10% | 45% | 45% | 100 |
| Control actual | Libertades enemigas | 0% | 0.2% | 53.4% | 53.2% | 1.2% | 0% | 45.6% | 84% | 8% | 8% | 100 |
| Control actual | Potencial de línea | 0.1% | 0.4% | 51% | 39.9% | 0% | 53.3% | 6.7% | 14% | 40% | 46% | 100 |
| Cierres Sudoku | Aleatorio | 0.9% | 8.5% | 1.8% | 84.8% | 0.1% | 6% | 9.1% | 0% | 50% | 50% | 100 |
| Cierres Sudoku | Libertades enemigas | 0.8% | 7.5% | 2.4% | 85.5% | 0.6% | 2.4% | 11.5% | 0% | 43% | 57% | 100 |
| Cierres Sudoku | Potencial de línea | 1.1% | 8.6% | 1.5% | 77.7% | 0% | 12.7% | 9.6% | 0% | 43% | 57% | 100 |
| Solo eventos | Aleatorio | 0.1% | 0.3% | 61.1% | 0% | 0.5% | 54.9% | 44.6% | 4% | 53% | 43% | 100 |
| Solo eventos | Libertades enemigas | 0.1% | 0.3% | 53.4% | 0% | 0.3% | 0% | 99.7% | 0% | 51% | 49% | 100 |
| Solo eventos | Potencial de línea | 0.1% | 0.4% | 49.2% | 0% | 0% | 73.5% | 26.5% | 7% | 23% | 70% | 100 |
| Multidimensional base | Aleatorio | 25% | 54.7% | 0.2% | 46.5% | 14.2% | 8.8% | 30.5% | 0% | 0% | 100% | 4 |
| Multidimensional base | Libertades enemigas | 25% | 54.7% | 0.2% | 46.5% | 14.2% | 8.8% | 30.5% | 0% | 0% | 100% | 4 |
| Multidimensional base | Potencial de línea | 25% | 54.7% | 0.2% | 46.5% | 14.2% | 8.8% | 30.5% | 0% | 0% | 100% | 4 |
| Presión Go 1, línea 10, ataque 8+4d | Aleatorio | 21.8% | 48.1% | 0.2% | 57.2% | 14.3% | 3.7% | 24.8% | 0% | 100% | 0% | 4 |
| Presión Go 1, línea 10, ataque 8+4d | Libertades enemigas | 21.8% | 48.1% | 0.2% | 57.2% | 14.3% | 3.7% | 24.8% | 0% | 100% | 0% | 4 |
| Presión Go 1, línea 10, ataque 8+4d | Potencial de línea | 21.8% | 48.1% | 0.2% | 57.2% | 14.3% | 3.7% | 24.8% | 0% | 100% | 0% | 4 |
| Presión Go 1, línea 30, ataque 8+4d | Aleatorio | 22.7% | 51.4% | 0.2% | 37% | 10.8% | 38.4% | 13.8% | 0% | 100% | 0% | 4 |
| Presión Go 1, línea 30, ataque 8+4d | Libertades enemigas | 22.7% | 51.4% | 0.2% | 37% | 10.8% | 38.4% | 13.8% | 0% | 100% | 0% | 4 |
| Presión Go 1, línea 30, ataque 8+4d | Potencial de línea | 22.7% | 51.4% | 0.2% | 37% | 10.8% | 38.4% | 13.8% | 0% | 100% | 0% | 4 |
| Presión Go 1, línea 30, defensa .16 | Aleatorio | 22.2% | 50.8% | 0.2% | 37% | 10.8% | 38.4% | 13.8% | 0% | 100% | 0% | 4 |
| Presión Go 1, línea 30, defensa .16 | Libertades enemigas | 22.2% | 50.8% | 0.2% | 37% | 10.8% | 38.4% | 13.8% | 0% | 100% | 0% | 4 |
| Presión Go 1, línea 30, defensa .16 | Potencial de línea | 22.2% | 50.8% | 0.2% | 37% | 10.8% | 38.4% | 13.8% | 0% | 100% | 0% | 4 |
| Presión Go 1, línea 30, defensa .17 | Aleatorio | 1.3% | 23.9% | 0.2% | 55.6% | 13.7% | 2.3% | 28.5% | 0% | 0% | 100% | 100 |
| Presión Go 1, línea 30, defensa .17 | Libertades enemigas | 1.3% | 23.9% | 0.2% | 55.6% | 13.7% | 2.3% | 28.5% | 0% | 0% | 100% | 100 |
| Presión Go 1, línea 30, defensa .17 | Potencial de línea | 1.3% | 23.9% | 0.2% | 55.6% | 13.7% | 2.3% | 28.5% | 0% | 0% | 100% | 100 |
| Valor del número | Aleatorio | 0.3% | 1.9% | 3.3% | 73.1% | 0.1% | 19.3% | 7.5% | 1% | 40% | 59% | 100 |
| Valor del número | Libertades enemigas | 0.1% | 1.5% | 5.8% | 82.4% | 2% | 1.4% | 14.2% | 0% | 4% | 96% | 100 |
| Valor del número | Potencial de línea | 0.5% | 2.3% | 2.5% | 61.1% | 0% | 31.5% | 7.4% | 0% | 61% | 39% | 100 |
| Control posicional | Aleatorio | 3.3% | 17% | 0.5% | 85% | 0% | 10.8% | 4.1% | 0% | 74% | 26% | 100 |
| Control posicional | Libertades enemigas | 3.3% | 17% | 0.5% | 85.8% | 0% | 10% | 4.2% | 0% | 61% | 39% | 100 |
| Control posicional | Potencial de línea | 3.4% | 17.2% | 0.5% | 85.4% | 0% | 10.6% | 4% | 0% | 71% | 29% | 100 |

## Filtro por esquema

| Esquema | Mín. únicas | Mín. distintas | Variación máxima | Ataques 10–25 | 4 mecanismos ≥5 | Robusto | Ventaja inicial | Pre-finalista |
|---|---:|---:|---:|---|---|---|---|---|
| Control actual | 0% | 0.2% | 53.3 pp | No | No | No | No | No |
| Valor del número | 0.1% | 1.5% | 30.1 pp | No | No | No | Sí | No |
| Cierres Sudoku | 0.8% | 7.5% | 10.3 pp | No | No | No | No | No |
| Control posicional | 3.3% | 17% | 0.8 pp | No | No | Sí | Sí | No |
| Solo eventos | 0.1% | 0.3% | 73.5 pp | No | No | No | Sí | No |
| Multidimensional base | 25% | 54.7% | 0 pp | No | Sí | Sí | Sí | No |
| Presión Go 1, línea 10, ataque 8+4d | 21.8% | 48.1% | 0 pp | Sí | No | Sí | Sí | No |
| Presión Go 1, línea 30, ataque 8+4d | 22.7% | 51.4% | 0 pp | Sí | Sí | Sí | Sí | Sí |
| Presión Go 1, línea 30, defensa .16 | 22.2% | 50.8% | 0 pp | Sí | Sí | Sí | Sí | Sí |
| Presión Go 1, línea 30, defensa .17 | 1.3% | 23.9% | 0 pp | No | No | Sí | Sí | No |

## Komi calibrado y validado

La primera mitad de cada corrida calibra el komi del segundo jugador; la segunda
mitad lo valida. Un resultado de 100% empates con muy pocas trayectorias efectivas
es un ajuste exacto de un proceso casi determinista, no evidencia de equilibrio robusto.
Komi positivo bonifica a J2; negativo equivale a bonificar a J1.

| Esquema | Komi J2 | Validación J1 | Validación J2 | Empates |
|---|---:|---:|---:|---:|
| Control actual | 0 | 30.7% | 32.7% | 36.7% |
| Valor del número | -31 | 46% | 54% | 0% |
| Cierres Sudoku | -34.625 | 50% | 50% | 0% |
| Control posicional | 54.125 | 54.7% | 45.3% | 0% |
| Solo eventos | -1.5 | 46% | 54% | 0% |
| Multidimensional base | -58.896 | 0% | 0% | 100% |
| Presión Go 1, línea 10, ataque 8+4d | 212.014 | 0% | 0% | 100% |
| Presión Go 1, línea 30, ataque 8+4d | 540.22 | 0% | 0% | 100% |
| Presión Go 1, línea 30, defensa .16 | 540.22 | 0% | 0% | 100% |
| Presión Go 1, línea 30, defensa .17 | -198.063 | 0% | 0% | 100% |

## Profundidad con 12 candidatos por nodo

D3 ganó los dos juegos pareados contra D2 cambiando de color (100% en una muestra n=2); se evaluaron 22,104 nodos. El ancho observado fue 12–15, incluyendo empates en el corte.

| Colocar | Go | Líneas | Ataques |
|---:|---:|---:|---:|
| 34.5% | 43.4% | 21.2% | 0.9% |

D3 se separa de D2 en este pareo; se retira la conclusión anterior de empate.
La muestra no basta para estimar una tasa general de victoria, pero sí demuestra que
el resultado D2≈D3 con ancho 2 no era estable al ampliar candidatos.
Sin embargo, los ataques caen por debajo de 10%, por lo que el esquema no conserva
la mezcla mecánica bajo búsqueda y no queda listo para implementación.

## Sensibilidad de la defensa

La calibración exploratoria probó pesos defensivos 0.10–0.20 en incrementos de 0.01.
Entre 0.10 y 0.16 se conservó la misma ruta: J1 ganó 100% por 540.22 puntos.
En 0.17 la estrategia saltó a otra ruta: J2 ganó 100% por 198.063 puntos, las
jugadas estrictamente únicas bajaron a 1.3% y ataques subieron a 28.5%.
No apareció una zona intermedia estable; promediar ambos regímenes ocultaría el corte.

## Fórmulas probadas

- Control actual: Colocar 1; Go 2; línea 3; ataque 1.
- Valor del número: Colocar = número; Go 12; línea 10; ataque = 2 + diferencia.
- Cierres Sudoku: Colocar = número + .5 fila + .75 columna + caja; Go 15; línea 12; ataque = 3 + 1.5 × diferencia.
- Control posicional: Cierres Sudoku + 2 × libertades reducidas + 3 × potencial de línea; Go 15; línea 12; ataque = 3 + 1.5 × diferencia.
- Solo eventos: Colocar 0; Go 10; línea 8; ataque = 2 + diferencia.
- Multidimensional base: Multidimensional: presión Go 0.53; seguridad 0.61; grupo 0.73; potencial 0.59; defensa 0; atari 0; Go 40; línea 30; ataque = 8 + 4 × diferencia.
- Presión Go 1, línea 10, ataque 8+4d: Multidimensional: presión Go 1; seguridad 0.61; grupo 0.73; potencial 0.59; defensa 0; atari 20; Go 40; línea 10; ataque = 8 + 4 × diferencia.
- Presión Go 1, línea 30, ataque 8+4d: Multidimensional: presión Go 1; seguridad 0.61; grupo 0.73; potencial 0.59; defensa 0; atari 20; Go 40; línea 30; ataque = 8 + 4 × diferencia.
- Presión Go 1, línea 30, defensa .16: Multidimensional: presión Go 1; seguridad 0.61; grupo 0.73; potencial 0.59; defensa 0.16; atari 20; Go 40; línea 30; ataque = 8 + 4 × diferencia.
- Presión Go 1, línea 30, defensa .17: Multidimensional: presión Go 1; seguridad 0.61; grupo 0.73; potencial 0.59; defensa 0.17; atari 20; Go 40; línea 30; ataque = 8 + 4 × diferencia.

## Resultado

Pre-finalistas de puntuación: Presión Go 1, línea 30, ataque 8+4d, Presión Go 1, línea 30, defensa .16.
Ningún esquema queda listo para implementación: la ventaja de salida es
determinista y la prueba D3 reduce ataques por debajo del mínimo de 10%.
No se modificó el motor del juego.
