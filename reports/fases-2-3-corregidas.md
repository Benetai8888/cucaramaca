# Simulación corregida de las fases 2 y 3

Fecha: 2026-07-27

Partidas por política y combinación: 1,000.
Partidas por enfrentamiento y combinación: 1,000.
Semilla base: 20260727.
Búsqueda selectiva D2/D3: alfa-beta con 2 jugadas ordenadas por nodo.

A elige uniformemente entre todas las jugadas legales. B maximiza el cambio inmediato
del marcador. C usa el mismo máximo y desempata, en orden, por amenazas creadas,
reducción de libertades enemigas y líneas propias abiertas. D2 y D3 aplican minimax
alfa-beta selectivo con la misma ordenación posicional.

## Configuración principal: C contra C

| Terminación | Puntuación | Turnos | Margen | Margen norm. | Empates | Colocar | Go | Líneas | Ataques |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Meta de 20 puntos | Actual 1/2/3/+1 | 15.2 | 9.68 | 28.7% | 0% | 45% | 28.8% | 26.1% | 0% |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 6.2 | 50.99 | 91.3% | 0% | 2.8% | 91.9% | 5.3% | 0% |
| Meta de 20 puntos | Cerco .2/80/4/0 | 6.3 | 83.48 | 96.6% | 0% | 1.5% | 96.7% | 1.8% | 0% |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 6.2 | 61.88 | 94.2% | 0% | 1.9% | 94.5% | 3.6% | 0% |
| Límite de 30 turnos | Actual 1/2/3/+1 | 30 | 17.76 | 20.9% | 6.8% | 35.5% | 41.1% | 23.3% | 0% |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 30 | 209.5 | 22.9% | 10.7% | 0.8% | 95.7% | 3.5% | 0% |
| Límite de 30 turnos | Cerco .2/80/4/0 | 30 | 323.3 | 23% | 9.7% | 0.4% | 98.5% | 1.1% | 0% |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 30 | 238.42 | 22% | 10.6% | 0.5% | 97.3% | 2.2% | 0% |
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 16.3 | 4.05 | 10% | 21.7% | 41.8% | 41.6% | 16.5% | 0.1% |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 16 | 21.16 | 5% | 28.5% | 1% | 96.3% | 2.8% | 0% |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 15.7 | 22.81 | 3.5% | 28.6% | 0.5% | 98.7% | 0.8% | 0% |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 15.8 | 22.19 | 4.5% | 28.5% | 0.6% | 97.7% | 1.7% | 0% |

## Tablas por política

### Política A

| Terminación | Puntuación | Turnos | Margen | Margen norm. | Empates | Colocar | Go | Líneas | Ataques |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Meta de 20 puntos | Actual 1/2/3/+1 | 34.6 | 3.05 | 8.1% | 0% | 89.7% | 0.7% | 7.9% | 1.6% |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 43.6 | 23.66 | 56.8% | 0% | 24.8% | 34.8% | 40.4% | 0% |
| Meta de 20 puntos | Cerco .2/80/4/0 | 55.9 | 60.9 | 73.7% | 0% | 12.2% | 69.5% | 18.4% | 0% |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 50.9 | 35.65 | 62.8% | 0% | 16.5% | 50.4% | 32.4% | 0.7% |
| Límite de 30 turnos | Actual 1/2/3/+1 | 30 | 3.12 | 9.3% | 56% | 93.2% | 0.4% | 5.4% | 1% |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 30 | 10.44 | 54.9% | 38.4% | 48.6% | 19% | 32.4% | 0% |
| Límite de 30 turnos | Cerco .2/80/4/0 | 30 | 12.23 | 65% | 39% | 41.3% | 41.8% | 17% | 0% |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 30 | 10.1 | 58.9% | 36.5% | 43.6% | 27.7% | 28.4% | 0.2% |
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 60.9 | 4.98 | 6.5% | 8.1% | 70.9% | 2.8% | 17.2% | 9.2% |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 61 | 44.19 | 41.8% | 1.4% | 12.8% | 54% | 33.2% | 0% |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 60.9 | 64.07 | 54.8% | 1.4% | 9.2% | 76% | 14.8% | 0% |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 61 | 51.62 | 48.3% | 4.2% | 10.3% | 63.8% | 25.2% | 0.7% |

### Política B

| Terminación | Puntuación | Turnos | Margen | Margen norm. | Empates | Colocar | Go | Líneas | Ataques |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Meta de 20 puntos | Actual 1/2/3/+1 | 22.4 | 6.06 | 16.5% | 0% | 60.6% | 2.2% | 37% | 0.2% |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 20.4 | 26.77 | 51.6% | 0% | 9.8% | 35.6% | 54.5% | 0% |
| Meta de 20 puntos | Cerco .2/80/4/0 | 23.9 | 48.11 | 70.1% | 0% | 7% | 61.3% | 31.7% | 0% |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 20.4 | 30.32 | 61.4% | 0% | 8.3% | 47.3% | 44.5% | 0% |
| Límite de 30 turnos | Actual 1/2/3/+1 | 30 | 8.04 | 13.6% | 9.1% | 50.9% | 2.3% | 46.6% | 0.3% |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 30 | 45.83 | 37.5% | 7.4% | 6.3% | 33.9% | 59.8% | 0% |
| Límite de 30 turnos | Cerco .2/80/4/0 | 30 | 58.63 | 52% | 8.8% | 5.6% | 61.9% | 32.5% | 0% |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 30 | 51.57 | 45.9% | 8.6% | 5.5% | 45.3% | 49.3% | 0% |
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 61.4 | 8.06 | 5.7% | 4.2% | 41% | 7.3% | 49.4% | 2.3% |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 66.4 | 111.65 | 22.1% | 1% | 3.2% | 59.3% | 37.6% | 0% |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 67.4 | 176.84 | 30.7% | 2.3% | 2.2% | 80.8% | 17% | 0% |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 66.8 | 131.68 | 25.8% | 1.9% | 2.5% | 68.9% | 28.5% | 0.1% |

### Política C

| Terminación | Puntuación | Turnos | Margen | Margen norm. | Empates | Colocar | Go | Líneas | Ataques |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Meta de 20 puntos | Actual 1/2/3/+1 | 15.2 | 9.68 | 28.7% | 0% | 45% | 28.8% | 26.1% | 0% |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 6.2 | 50.99 | 91.3% | 0% | 2.8% | 91.9% | 5.3% | 0% |
| Meta de 20 puntos | Cerco .2/80/4/0 | 6.3 | 83.48 | 96.6% | 0% | 1.5% | 96.7% | 1.8% | 0% |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 6.2 | 61.88 | 94.2% | 0% | 1.9% | 94.5% | 3.6% | 0% |
| Límite de 30 turnos | Actual 1/2/3/+1 | 30 | 17.76 | 20.9% | 6.8% | 35.5% | 41.1% | 23.3% | 0% |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 30 | 209.5 | 22.9% | 10.7% | 0.8% | 95.7% | 3.5% | 0% |
| Límite de 30 turnos | Cerco .2/80/4/0 | 30 | 323.3 | 23% | 9.7% | 0.4% | 98.5% | 1.1% | 0% |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 30 | 238.42 | 22% | 10.6% | 0.5% | 97.3% | 2.2% | 0% |
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 16.3 | 4.05 | 10% | 21.7% | 41.8% | 41.6% | 16.5% | 0.1% |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 16 | 21.16 | 5% | 28.5% | 1% | 96.3% | 2.8% | 0% |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 15.7 | 22.81 | 3.5% | 28.6% | 0.5% | 98.7% | 0.8% | 0% |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 15.8 | 22.19 | 4.5% | 28.5% | 0.6% | 97.7% | 1.7% | 0% |

### Política D2

| Terminación | Puntuación | Turnos | Margen | Margen norm. | Empates | Colocar | Go | Líneas | Ataques |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Meta de 20 puntos | Actual 1/2/3/+1 | 14 | 10.99 | 35.4% | 0% | 45.1% | 25.7% | 29.1% | 0% |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 4 | 50 | 98% | 0% | 2% | 98% | 0% | 0% |
| Meta de 20 puntos | Cerco .2/80/4/0 | 4 | 80 | 99% | 0% | 1% | 99% | 0% | 0% |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 4 | 60 | 98.7% | 0% | 1.3% | 98.7% | 0% | 0% |
| Límite de 30 turnos | Actual 1/2/3/+1 | 30 | 10.99 | 13.9% | 0% | 38% | 50.5% | 11.5% | 0% |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 30 | 50 | 4% | 0% | 0.6% | 99.4% | 0% | 0% |
| Límite de 30 turnos | Cerco .2/80/4/0 | 30 | 80 | 4% | 0% | 0.3% | 99.7% | 0% | 0% |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 30 | 60 | 4% | 0% | 0.4% | 99.6% | 0% | 0% |
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 13 | 4 | 12.5% | 0% | 40.6% | 50% | 9.4% | 0% |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 13 | 8.25 | 2% | 0% | 0.8% | 97.3% | 1.9% | 0% |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 13 | 4.2 | 0.6% | 0% | 0.4% | 99% | 0.6% | 0% |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 13 | 6.2 | 1.3% | 0% | 0.5% | 98.2% | 1.2% | 0% |

### Política D3

| Terminación | Puntuación | Turnos | Margen | Margen norm. | Empates | Colocar | Go | Líneas | Ataques |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Meta de 20 puntos | Actual 1/2/3/+1 | 14 | 10.99 | 35.4% | 0% | 45.2% | 25.8% | 29.1% | 0% |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 4 | 50 | 98% | 0% | 2% | 98% | 0% | 0% |
| Meta de 20 puntos | Cerco .2/80/4/0 | 4 | 80 | 99% | 0% | 1% | 99% | 0% | 0% |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 4 | 60 | 98.7% | 0% | 1.3% | 98.7% | 0% | 0% |
| Límite de 30 turnos | Actual 1/2/3/+1 | 30 | 11.03 | 14% | 0% | 38.1% | 50.3% | 11.7% | 0% |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 30 | 50 | 4% | 0% | 0.6% | 99.4% | 0% | 0% |
| Límite de 30 turnos | Cerco .2/80/4/0 | 30 | 80 | 4% | 0% | 0.3% | 99.7% | 0% | 0% |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 30 | 60 | 4% | 0% | 0.4% | 99.6% | 0% | 0% |
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 13 | 4 | 12.5% | 0% | 40.6% | 50% | 9.4% | 0% |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 13 | 8.25 | 2% | 0% | 0.8% | 97.3% | 1.9% | 0% |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 13 | 4.2 | 0.6% | 0% | 0.4% | 99% | 0.6% | 0% |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 13 | 6.2 | 1.3% | 0% | 0.5% | 98.2% | 1.2% | 0% |

## Criterio de profundidad

Se considera evidencia de ventaja cuando el límite inferior del intervalo Wilson de 95%
sobre las partidas decisivas supera 50%. Se alterna el color en cada partida.

| Terminación | Puntuación | Enfrentamiento | Gana izquierda | Empates | Gana entre decisivas | IC 95% | Ventaja demostrada |
|---|---|---|---:|---:|---:|---:|---|
| Meta de 20 puntos | Actual 1/2/3/+1 | D3 vs B | 89.6% | 0% | 89.6% | 87.6%–91.3% | Sí |
| Meta de 20 puntos | Objetivos .25/50/8/0 | D3 vs B | 87% | 0% | 87% | 84.8%–88.9% | Sí |
| Meta de 20 puntos | Cerco .2/80/4/0 | D3 vs B | 88.4% | 0% | 88.4% | 86.3%–90.2% | Sí |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | D3 vs B | 87.2% | 0% | 87.2% | 85%–89.1% | Sí |
| Límite de 30 turnos | Actual 1/2/3/+1 | D3 vs B | 87% | 2.3% | 89% | 86.9%–90.9% | Sí |
| Límite de 30 turnos | Objetivos .25/50/8/0 | D3 vs B | 74% | 4.6% | 77.6% | 74.8%–80.1% | Sí |
| Límite de 30 turnos | Cerco .2/80/4/0 | D3 vs B | 74.2% | 6.6% | 79.4% | 76.7%–81.9% | Sí |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | D3 vs B | 76% | 5.5% | 80.4% | 77.8%–82.8% | Sí |
| 8 celdas bloqueadas | Actual 1/2/3/+1 | D3 vs B | 81.3% | 4.3% | 85% | 82.5%–87.1% | Sí |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | D3 vs B | 82.6% | 3% | 85.2% | 82.8%–87.3% | Sí |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | D3 vs B | 84.4% | 2.3% | 86.4% | 84.1%–88.4% | Sí |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | D3 vs B | 85.7% | 1.7% | 87.2% | 84.9%–89.1% | Sí |
| Meta de 20 puntos | Actual 1/2/3/+1 | D3 vs D2 | 50% | 0% | 50% | 46.9%–53.1% | No |
| Meta de 20 puntos | Objetivos .25/50/8/0 | D3 vs D2 | 50% | 0% | 50% | 46.9%–53.1% | No |
| Meta de 20 puntos | Cerco .2/80/4/0 | D3 vs D2 | 50% | 0% | 50% | 46.9%–53.1% | No |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | D3 vs D2 | 50% | 0% | 50% | 46.9%–53.1% | No |
| Límite de 30 turnos | Actual 1/2/3/+1 | D3 vs D2 | 50.1% | 0% | 50.1% | 47%–53.2% | No |
| Límite de 30 turnos | Objetivos .25/50/8/0 | D3 vs D2 | 50% | 0% | 50% | 46.9%–53.1% | No |
| Límite de 30 turnos | Cerco .2/80/4/0 | D3 vs D2 | 50% | 0% | 50% | 46.9%–53.1% | No |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | D3 vs D2 | 50% | 0% | 50% | 46.9%–53.1% | No |
| 8 celdas bloqueadas | Actual 1/2/3/+1 | D3 vs D2 | 50% | 0% | 50% | 46.9%–53.1% | No |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | D3 vs D2 | 50% | 0% | 50% | 46.9%–53.1% | No |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | D3 vs D2 | 50% | 0% | 50% | 46.9%–53.1% | No |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | D3 vs D2 | 50% | 0% | 50% | 46.9%–53.1% | No |

## Resultado

Cumplen todos los filtros: Límite de 30 turnos con Actual 1/2/3/+1; Límite de 30 turnos con Objetivos .25/50/8/0; Límite de 30 turnos con Cerco .2/80/4/0; Límite de 30 turnos con Desgaste .2/60/6/−.1.

Recomendación experimental: Límite de 30 turnos con Actual 1/2/3/+1. En C contra C dura 30 turnos, Go más líneas aporta 64.4%, el margen normalizado es 20.9% y su mayor fuente de puntuación representa 41.1%.

D3 supera a B en las 12 combinaciones, pero no muestra ventaja sobre D2 en ninguna.
Con el límite selectivo de dos jugadas por nodo, la profundidad 3 no queda justificada;
esta conclusión no equivale a una prueba sobre minimax exhaustivo.
No se modificó el motor del juego ni se implementó una combinación ganadora.
