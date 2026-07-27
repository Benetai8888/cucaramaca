# Simulación corregida de terminación y puntuación

Fecha: 2026-07-27. Partidas por combinación y enfrentamiento: 1,000.
Total: 72,000 partidas. Semilla: 20260727.

A es aleatorio uniforme sobre todas las jugadas legales. B maximiza puntos inmediatos.
C maximiza puntos y desempata por amenazas, líneas abiertas y presión de libertades.
D usa minimax alfa-beta selectivo; profundidades 2 y 3 comparten la misma cartera de
jugadas, con anchos 4, 4 y 4. La selección es explícitamente selectiva, no exhaustiva.
Las participaciones de Colocar, Go, Líneas y Ataques son porcentajes del impacto
absoluto en el marcador. “Turnos atacando” mide frecuencia de acción y evita confundir
un ataque con valor cero con una mecánica que dejó de dominar.

El filtro C×C exige 20–40 turnos, Go más líneas ≥40%, margen normalizado ≤25%,
tope técnico ≤1%, ataques <40% del impacto y ataques en menos de 50% de los turnos.
El filtro de profundidad exige D3 ≥60% contra B y más de 50% contra D2.

## Control del agente A

En una trayectoria continua de 2,400 turnos, fuera de los esquemas de terminación, hubo en promedio 33.63 jugadas legales y 14.03 ataques. A eligió ataques en 48.17% de los turnos; la proporción esperada por muestreo uniforme fue 47.27%.

Disponibilidad por turno: Go 17.8% (0.27 jugadas), líneas 95.2% (4.39 jugadas), ataques 99.3%.

Este control solo contrasta selección observada contra probabilidad uniforme dentro
de la misma trayectoria. No se usa para juzgar el diseño ni se compara con muestras
episódicas que recorren otra distribución de estados.

## Política A: aleatorio uniforme, A×A

| Terminación | Puntuación | Turnos ± DE | Margen | Empates | Tope | Colocar | Go | Líneas | Ataques | Turnos atacando |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 60.8 ± 3.5 | 5.22 | 7.7% | 0% | 70.8% | 2.8% | 17.3% | 9.1% | 11.4% |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 60.9 ± 3.6 | 63.73 | 1.9% | 0% | 9.6% | 74.9% | 15.5% | 0% | 11.5% |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 61.1 ± 3.5 | 50.89 | 2.8% | 0% | 10.5% | 63.1% | 25.7% | 0.7% | 11.4% |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 61 ± 3.5 | 43.54 | 1% | 0% | 12.8% | 54.1% | 33.1% | 0% | 11.3% |
| Límite de 30 turnos | Actual 1/2/3/+1 | 30 ± 0 | 3.35 | 57.1% | 0% | 93.1% | 0.3% | 5.7% | 1% | 1% |
| Límite de 30 turnos | Cerco .2/80/4/0 | 30 ± 0 | 11.11 | 37.5% | 0% | 43.1% | 37.2% | 19.7% | 0% | 1.1% |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 30 ± 0 | 9.83 | 39.7% | 0% | 44.3% | 27.3% | 28.2% | 0.2% | 1.1% |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 30 ± 0 | 10.77 | 39.3% | 0% | 47.9% | 21.9% | 30.2% | 0% | 1.1% |
| Meta de 20 puntos | Actual 1/2/3/+1 | 34.5 ± 3.1 | 3.11 | 0% | 0% | 89.5% | 0.5% | 8.2% | 1.7% | 1.9% |
| Meta de 20 puntos | Cerco .2/80/4/0 | 56 ± 16.4 | 57.36 | 0% | 0% | 12.8% | 67.7% | 19.5% | 0% | 10.1% |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 51.1 ± 13.9 | 37.93 | 0% | 0% | 15.8% | 53.1% | 30.4% | 0.7% | 8.1% |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 43.1 ± 10.7 | 25.17 | 0% | 0% | 23.8% | 37.8% | 38.4% | 0% | 4.9% |

## Política B: codicioso inmediato, B×B

| Terminación | Puntuación | Turnos ± DE | Margen | Empates | Tope | Colocar | Go | Líneas | Ataques | Turnos atacando |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 61.4 ± 9 | 8.18 | 2.8% | 0% | 40.9% | 7.4% | 49.4% | 2.3% | 5.3% |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 66.9 ± 11.5 | 192.79 | 1% | 0% | 2.2% | 81.4% | 16.4% | 0% | 3.8% |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 66.9 ± 11.7 | 137.64 | 1.6% | 0% | 2.5% | 69.3% | 28.2% | 0% | 3.8% |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 66.9 ± 11.7 | 110.67 | 1.9% | 0% | 3.2% | 57.8% | 38.9% | 0% | 4% |
| Límite de 30 turnos | Actual 1/2/3/+1 | 30 ± 0 | 8.4 | 9.8% | 0% | 51.2% | 2.4% | 46.1% | 0.2% | 0.4% |
| Límite de 30 turnos | Cerco .2/80/4/0 | 30 ± 0 | 62.27 | 7.7% | 0% | 5.7% | 60.9% | 33.4% | 0% | 0% |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 30 ± 0 | 54.24 | 8.7% | 0% | 5.4% | 46.7% | 47.9% | 0% | 0% |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 30 ± 0 | 46.21 | 8.3% | 0% | 6.3% | 35.3% | 58.4% | 0% | 0% |
| Meta de 20 puntos | Actual 1/2/3/+1 | 22.5 ± 3.2 | 6.16 | 0% | 0% | 60.8% | 2% | 36.9% | 0.2% | 0.3% |
| Meta de 20 puntos | Cerco .2/80/4/0 | 23.4 ± 7.1 | 46.64 | 0% | 0% | 7% | 60.7% | 32.4% | 0% | 0% |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 20.6 ± 5 | 29.45 | 0.2% | 0% | 8.5% | 45.4% | 46.2% | 0% | 0% |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 19.9 ± 5.3 | 27.02 | 0% | 0% | 9.8% | 36.4% | 53.8% | 0% | 0% |

## Política C: codicioso posicional, C×C

| Terminación | Puntuación | Turnos ± DE | Margen | Empates | Tope | Colocar | Go | Líneas | Ataques | Turnos atacando |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 74.5 ± 12.9 | 10.61 | 3.5% | 0% | 29.9% | 2.9% | 64.9% | 2.4% | 7.4% |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 73.5 ± 13.9 | 290.74 | 2.4% | 0% | 2.7% | 57.5% | 39.7% | 0% | 7.1% |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 74.2 ± 13.4 | 229.66 | 3.7% | 0% | 2.6% | 41.3% | 56% | 0.1% | 7.2% |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 74.8 ± 12.5 | 180.2 | 2% | 0% | 2.9% | 29.1% | 67.9% | 0% | 7.3% |
| Límite de 30 turnos | Actual 1/2/3/+1 | 30 ± 0 | 12.2 | 97% | 0% | 31.2% | 0.3% | 68.5% | 0% | 0% |
| Límite de 30 turnos | Cerco .2/80/4/0 | 30 ± 0 | 442.84 | 96.9% | 0% | 5.6% | 12.7% | 81.7% | 0% | 0% |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 30 ± 0 | 424.54 | 96.3% | 0% | 3.9% | 10.2% | 85.9% | 0% | 0% |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 30 ± 0 | 253.56 | 97.3% | 0% | 3.9% | 3.6% | 92.5% | 0% | 0% |
| Meta de 20 puntos | Actual 1/2/3/+1 | 13 ± 0 | 7 | 0% | 0% | 35.1% | 0% | 64.9% | 0% | 0% |
| Meta de 20 puntos | Cerco .2/80/4/0 | 13 ± 0 | 8.2 | 0% | 0% | 7.5% | 0% | 92.5% | 0% | 0% |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 13 ± 0 | 12.2 | 0% | 0% | 5.1% | 0% | 94.9% | 0% | 0% |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 11 ± 0 | 8.25 | 0% | 0% | 6.4% | 0% | 93.6% | 0% | 0% |

## Política D: búsqueda profundidad 3, D3×D3

| Terminación | Puntuación | Turnos ± DE | Margen | Empates | Tope | Colocar | Go | Líneas | Ataques | Turnos atacando |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 56.5 ± 7.7 | 7.26 | 6.2% | 0% | 31.3% | 0.2% | 63.3% | 5.2% | 14.1% |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 77 ± 8.1 | 285.37 | 2.5% | 0% | 2.8% | 55.7% | 41.5% | 0% | 7.2% |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 77 ± 8.1 | 220.67 | 3.4% | 0% | 2.6% | 39.4% | 57.9% | 0.1% | 7.2% |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 77.1 ± 8 | 198.97 | 3.7% | 0% | 2.8% | 30.3% | 66.8% | 0% | 7.1% |
| Límite de 30 turnos | Actual 1/2/3/+1 | 30 ± 0 | 22.88 | 17.7% | 0% | 25.6% | 0% | 68.9% | 5.5% | 17.7% |
| Límite de 30 turnos | Cerco .2/80/4/0 | 30 ± 0 | 4.33 | 98.8% | 0% | 6.4% | 0% | 93.6% | 0% | 0% |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 30 ± 0 | 6.35 | 98.3% | 0% | 4.4% | 0% | 95.6% | 0% | 0% |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 30 ± 0 | 8 | 98.8% | 0% | 4.1% | 0% | 95.9% | 0% | 0% |
| Meta de 20 puntos | Actual 1/2/3/+1 | 14.3 ± 2.8 | 6.89 | 0% | 0% | 35.9% | 0% | 62.2% | 1.9% | 5% |
| Meta de 20 puntos | Cerco .2/80/4/0 | 13 ± 0 | 8.2 | 0% | 0% | 7.5% | 0% | 92.5% | 0% | 0% |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 13 ± 0 | 12.2 | 0% | 0% | 5.1% | 0% | 94.9% | 0% | 0% |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 11 ± 0 | 8.25 | 0% | 0% | 6.4% | 0% | 93.6% | 0% | 0% |

## Criterio de profundidad

| Terminación | Puntuación | D3 vs B | Empates | D3 vs D2 | Empates | Criterios C×C | Profundidad | Resultado |
|---|---|---:|---:|---:|---:|---|---|---|
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 96.3% | 1.5% | 60.7% | 5.1% | No cumple | Sí | Descartado |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 92.9% | 0.4% | 68% | 2.5% | No cumple | Sí | Descartado |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 94.4% | 0.7% | 66.7% | 4.3% | No cumple | Sí | Descartado |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 96.1% | 0.1% | 64.8% | 3.5% | No cumple | Sí | Descartado |
| Límite de 30 turnos | Actual 1/2/3/+1 | 96.6% | 1.2% | 49.7% | 17.9% | Cumple | No | Descartado |
| Límite de 30 turnos | Cerco .2/80/4/0 | 99.7% | 0.1% | 5.5% | 94.2% | No cumple | No | Descartado |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 99.5% | 0% | 4.3% | 95.2% | No cumple | No | Descartado |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 99.9% | 0.1% | 4.8% | 95% | No cumple | No | Descartado |
| Meta de 20 puntos | Actual 1/2/3/+1 | 99.5% | 0% | 50% | 0% | No cumple | No | Descartado |
| Meta de 20 puntos | Cerco .2/80/4/0 | 99.6% | 0% | 50% | 0% | No cumple | No | Descartado |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 99.7% | 0% | 50% | 0% | No cumple | No | Descartado |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 99.7% | 0% | 50% | 0% | No cumple | No | Descartado |

## Finalistas

Ninguna combinación supera simultáneamente el filtro C×C y el criterio de profundidad.
No recomiendo implementar ninguna de las doce configuraciones.

La más cercana por producto es Límite de 30 turnos con Actual 1/2/3/+1, pero queda descartada porque D3 no supera a D2.
La mejor base con profundidad es 8 celdas bloqueadas con Actual 1/2/3/+1; conserva margen cerrado y Go+líneas relevantes, pero dura 74.5 turnos con C×C.
La siguiente matriz debería probar menos cicatrices (3–5) y valores intermedios
para Go/líneas. Es una nueva hipótesis, no un esquema aprobado.
