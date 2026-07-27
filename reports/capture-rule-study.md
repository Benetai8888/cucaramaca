# Reglas de captura: presencia e influencia

Fecha: 2026-07-28. Tablero 9x9. Límite fijo: 30 turnos.
Política ε-greedy con ε=0.1; 1,000 partidas por variante.

Puntuación visible: Colocar 1; cada piedra capturada 2; línea 3; ataque 1.
La función de evaluación es interna del agente y no modifica el marcador.

## Reglas comparadas

- Control: cerco completo: Un grupo se captura cuando pierde su última libertad.
- V1: atari sostenido: Un grupo en atari se captura si en su siguiente turno no sube de una libertad.
- V2: penúltima libertad: Un grupo de tres o más piedras se captura al quedar con una sola libertad.
- V3: apertura fija: Cada bando empieza con seis piedras fijas y sin puntos; la captura no cambia.
- V4: presión numérica: Con hasta dos libertades, un grupo cae si los números enemigos que lo tocan suman 10.

## Captura Go

| Variante | Trayectorias | Cerco activo | Capturas/partida | Piedras/partida | Sin captura (IC 95%) | Correlación | Gana quien captura más | n decisivo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Control: cerco completo | 964 | 7.42 ± 5.07 | 1.92 ± 2.96 | 1.92 ± 2.96 | 22.4% (19.9–25.1) | 0.383 | 82.2% | 687 |
| V1: atari sostenido | 970 | 7.37 ± 3.85 | 1 ± 0.81 | 1.1 ± 1.01 | 28.5% (25.8–31.4) | 0.466 | 84.7% | 668 |
| V2: penúltima libertad | 964 | 7.46 ± 5.13 | 1.92 ± 2.95 | 1.97 ± 3.01 | 22.2% (19.7–24.9) | 0.382 | 82.4% | 688 |
| V3: apertura fija | 957 | 7.35 ± 5.69 | 1.99 ± 2.54 | 2.03 ± 2.57 | 22.6% (20.1–25.3) | 0.511 | 72.6% | 654 |
| V4: presión numérica | 991 | 3.12 ± 2.35 | 3.68 ± 3.55 | 3.75 ± 3.57 | 7.1% (5.7–8.9) | 0.625 | 90.2% | 835 |

## Presencia e influencia de las tres mecánicas

| Variante | Mecánica | Unidades/partida | Sin evento | Correlación | Gana quien tuvo más | n decisivo | Empate condicionado |
|---|---|---:|---:|---:|---:|---:|---:|
| Control: cerco completo | Go | 1.92 ± 2.96 | 22.4% | 0.383 | 82.2% | 687 | 0.1% |
| Control: cerco completo | Líneas | 15.38 ± 3.28 | 0% | 0.969 | 96% | 850 | 0.1% |
| Control: cerco completo | Ataques | 0.42 ± 1.05 | 80.6% | -0.371 | 18.1% | 188 | 3.1% |
| V1: atari sostenido | Go | 1.1 ± 1.01 | 28.5% | 0.466 | 84.7% | 668 | 0% |
| V1: atari sostenido | Líneas | 16.07 ± 3.58 | 0% | 0.963 | 99.1% | 763 | 0% |
| V1: atari sostenido | Ataques | 0.7 ± 1.46 | 72.4% | -0.468 | 19.4% | 258 | 5.8% |
| V2: penúltima libertad | Go | 1.97 ± 3.01 | 22.2% | 0.382 | 82.4% | 688 | 0.4% |
| V2: penúltima libertad | Líneas | 15.39 ± 3.28 | 0% | 0.962 | 96.1% | 848 | 0.4% |
| V2: penúltima libertad | Ataques | 0.42 ± 1.05 | 80.6% | -0.37 | 18.1% | 188 | 3.1% |
| V3: apertura fija | Go | 2.03 ± 2.57 | 22.6% | 0.511 | 72.6% | 654 | 0% |
| V3: apertura fija | Líneas | 16.78 ± 3.33 | 0% | 0.958 | 97.1% | 829 | 0% |
| V3: apertura fija | Ataques | 0.19 ± 0.56 | 86.1% | -0.197 | 38% | 129 | 6.5% |
| V4: presión numérica | Go | 3.75 ± 3.57 | 7.1% | 0.625 | 90.2% | 835 | 0.7% |
| V4: presión numérica | Líneas | 15.45 ± 3.73 | 0.1% | 0.92 | 92.7% | 840 | 0.7% |
| V4: presión numérica | Ataques | 0.39 ± 1.02 | 82.9% | -0.45 | 9.6% | 167 | 2.3% |

La correlación usa diferencial J1−J2 de unidades contra diferencial J1−J2 del marcador.
Las unidades son piedras capturadas para Go, líneas formadas y ataques ejecutados.
La tabla superior reporta además cuántas acciones de captura distintas ocurrieron.
La tasa de victoria se calcula solo cuando un jugador tuvo más eventos y el marcador no
terminó empatado; `n decisivo` muestra ese denominador.
Estas métricas son predictivas, no causales: cada mecánica también aporta directamente
al marcador fijo 1/2/3/1.

## Diagnóstico de aleatorización y escala

| Variante | Exploración efectiva | Empate en máximo | Marcador total |
|---|---:|---:|---:|
| Control: cerco completo | 10.1 ± 5.4% | 10.48 ± 4.11% | 79.99 ± 8.4 |
| V1: atari sostenido | 10.1 ± 5.4% | 11.13 ± 4.38% | 80.41 ± 10.93 |
| V2: penúltima libertad | 10.1 ± 5.4% | 10.48 ± 4.11% | 80.1 ± 8.43 |
| V3: apertura fija | 10.1 ± 5.4% | 1.93 ± 2.14% | 84.41 ± 8.93 |
| V4: presión numérica | 10.1 ± 5.4% | 14.63 ± 6.13% | 83.83 ± 8.23 |

El criterio de presencia para Go exige menos de 5% de partidas sin captura.

## Resultado

Ninguna variante cumple el criterio de presencia Go.

V4 es la única que cambia materialmente la mecánica: reduce el cerco activo por debajo
de cuatro turnos y eleva capturas e influencia, pero su intervalo de confianza de
partidas sin captura permanece por encima del umbral.

Las líneas están presentes e influyen en todas las variantes. Los ataques están ausentes
en la mayoría de las partidas y su diferencial se correlaciona negativamente con el
marcador en las cinco condiciones.

No se modificó el tablero, el límite de turnos ni el motor de producción.
