# Horizonte de turnos, tamaño de tablero y capturas Go

Fecha: 2026-07-27. Política: ε-greedy con ε=0.1.
1,000 partidas independientes por condición; 4,000 partidas totales.
Los horizontes 9x9 usan las mismas semillas: cada partida larga contiene exactamente
la trayectoria de su partida corta durante los primeros 30 o 60 turnos.

Captura Go significa exclusivamente una colocación que deja sin libertades a un grupo
enemigo. Los puntos Go posicionales se reportan aparte.

## Resultados mecánicos

| Condición | Trayectorias | Sin captura | Capturas/partida | Piedras capturadas | Primera captura | Cerco activo | Piedra inicial del borde |
|---|---:|---:|---:|---:|---:|---:|---:|
| 9x9-t30 | 973 | 22.5% | 1.61 ± 2.65 | 1.61 ± 2.65 | T17 (media 17.9 ± 4.81) | 7.19 ± 4.66 turnos | 14.81 ± 6.39 turnos |
| 9x9-t60 | 1000 | 8.9% | 5.28 ± 7.71 | 5.46 ± 7.8 | T19 (media 21.49 ± 10.19) | 6.11 ± 6.87 turnos | 22.28 ± 13.17 turnos |
| 9x9-t100 | 1000 | 3.2% | 11.06 ± 15.03 | 11.51 ± 15.1 | T19 (media 24.75 ± 16.56) | 6.25 ± 10.1 turnos | 34.11 ± 23.16 turnos |
| 6x6-t30 | 965 | 1.1% | 13.22 ± 5.82 | 13.28 ± 5.78 | T7 (media 7.87 ± 2.32) | 3.9 ± 3.95 turnos | 15.36 ± 6.35 turnos |

“Cerco activo” empieza en el primer contacto entre el grupo finalmente capturado y una
piedra sobreviviente del borde. “Piedra inicial del borde” usa retrospectivamente la
piedra más antigua que termina formando ese borde; puede haber sido colocada antes de
que existiera el grupo objetivo.

## Techo empírico de puntos Go

| Condición | Captura Go media ± DE | P95 | Máximo | Go posicional media ± DE | Go combinado media ± DE |
|---|---:|---:|---:|---:|---:|
| 9x9-t30 | 4.24 ± 6.18% | 12.91% | 42.57% | 14.74 ± 2.83% | 18.98 ± 7.71% |
| 9x9-t60 | 6.53 ± 8.67% | 27.32% | 46.89% | 13.45 ± 3.17% | 19.98 ± 9.93% |
| 9x9-t100 | 7.9 ± 9.74% | 31.2% | 50.03% | 12.3 ± 2.71% | 20.2 ± 10.48% |
| 6x6-t30 | 36.28 ± 12.62% | 50.96% | 54.14% | 22.65 ± 4.89% | 58.93 ± 12.01% |

El P95 es una referencia más estable que el máximo de una sola partida. La participación
en puntos no equivale a frecuencia mecánica: en 9x9 las capturas por partida crecen
mucho más rápido que su porcentaje del marcador.

## Reparto completo de puntos

| Condición | Colocar | Go captura | Go posicional | Líneas | Ataques |
|---|---:|---:|---:|---:|---:|
| 9x9-t30 | 40.6 ± 4.44% | 4.24 ± 6.18% | 14.74 ± 2.83% | 35.82 ± 7.29% | 4.59 ± 4.88% |
| 9x9-t60 | 33.98 ± 5.24% | 6.53 ± 8.67% | 13.45 ± 3.17% | 36.07 ± 8.51% | 9.98 ± 6.27% |
| 9x9-t100 | 30.91 ± 4.02% | 7.9 ± 9.74% | 12.3 ± 2.71% | 36.05 ± 8.68% | 12.84 ± 5.57% |
| 6x6-t30 | 32.73 ± 3.41% | 36.28 ± 12.62% | 22.65 ± 4.89% | 4.54 ± 5.76% | 3.8 ± 5.01% |

## Diagnóstico de aleatorización

| Condición | Exploración ε efectiva | Turnos con empate máximo | Trayectorias únicas |
|---|---:|---:|---:|
| 9x9-t30 | 10.26 ± 5.46% | 10.61 ± 4.6% | 973 |
| 9x9-t60 | 10.1 ± 3.72% | 6.25 ± 3.96% | 1000 |
| 9x9-t100 | 10.1 ± 2.91% | 5.09 ± 4.29% | 1000 |
| 6x6-t30 | 10.26 ± 5.46% | 3.44 ± 1.87% | 965 |

Ninguna desviación estándar de las métricas centrales es cero; la corrida no es una
repetición determinista de la misma partida.

## Distribución emparejada de la primera captura en 9x9

| Ventana | Partidas que capturan por primera vez | Porcentaje del total |
|---|---:|---:|
| Turnos 1–30 | 775 | 77.5% |
| Turnos 31–60 | 136 | 13.6% |
| Turnos 61–100 | 57 | 5.7% |
| Sin captura al turno 100 | 32 | 3.2% |

De las 225 partidas sin captura al turno 30, 136 (60.4%) capturan entre 31 y 60.
De las 89 todavía pendientes al turno 60, 57 (64%) capturan entre 61 y 100.

## Prueba de la hipótesis

Resultado: confirmada parcialmente.

En 9x9, ampliar el horizonte de 30 a 60 y 100 turnos aumenta las capturas medias de 1.61 a 5.28 y 11.06 por partida. Las partidas sin ninguna captura bajan de 22.5% a 8.9% y 3.2%.

Reducir a 6x6 con 30 turnos aumenta las capturas medias a 13.22: 8.2 veces el 9x9/30. La mediana de la primera captura pasa del turno 17 al 7, y el cerco activo medio de 7.19 a 3.9 turnos.

La afirmación literal de que 9x9 generalmente necesita más de 30 turnos para una primera captura queda refutada: 77.5% de las partidas captura antes del límite y la mediana condicional es el turno 17. Lo que sí confirma la evidencia es que 30 turnos limita la recurrencia de capturas y que el tamaño 6x6 cambia radicalmente su frecuencia.

## Limitaciones

La comparación 6x6 es una variante completa, no un aislamiento puro del área: una subcaja
2x3 contiene solo dos triples rectos, frente a ocho en una subcaja 3x3. Por tanto, también
reduce oportunidades de líneas y cambia las decisiones de la política.

La “primera piedra del cerco” no expresa intención. Se mide retrospectivamente sobre las
piedras sobrevivientes que forman el borde al capturar; por eso se acompaña con la medida
de contacto activo.

## Correcciones respecto de puntuación v3

El 14.3% anterior no era un techo de capturas: `breakdown.go` mezclaba captura y valor
posicional. Además, el selector sumaba 40 puntos Go fantasma a cada ataque de ajedrez,
aunque esos puntos no entraban al marcador. Esta corrida corrige ambas contaminaciones.

No se modificó el motor del juego ni se diseñó una puntuación nueva.
