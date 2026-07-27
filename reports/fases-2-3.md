# Simulación conjunta de terminación y puntuación

Fecha: 2026-07-27

Partidas aleatorias por combinación: 1,000.
Partidas codicioso contra aleatorio por candidato evaluado: 1,000.
Semilla base: 20260727.

La participación porcentual usa impacto absoluto en el marcador. Cuando un ataque resta
puntos al rival, esa resta se contabiliza como contribución del ataque.

Se considera margen cerrado cuando el margen medio representa como máximo 25% del
impacto total medio. Los candidatos enviados a la prueba codiciosa duran entre 20 y
40 turnos, Go más líneas aportan al menos 40%, y el tope de seguridad interviene en
como máximo 1% de las partidas. Para ser finalista deben tener además margen cerrado.

| Terminación | Puntuación | Turnos media ± DE | Margen medio | Empates | Tope | Colocar | Go | Líneas | Ataques | Codicioso gana | Resultado |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Meta de 20 puntos | Actual 1/2/3/+1 | 37.3 ± 2.6 | 1.89 | 0% | 0% | 75% | 0.1% | 3.1% | 21.8% | — | Descartado |
| Meta de 20 puntos | Objetivos .25/50/8/0 | 79.3 ± 24.4 | 14.76 | 0.3% | 8.6% | 37.9% | 10.4% | 51.7% | 0% | — | Descartado |
| Meta de 20 puntos | Cerco .2/80/4/0 | 104.3 ± 20.7 | 18.34 | 0.7% | 37.7% | 33.1% | 28.7% | 38.2% | 0% | — | Descartado |
| Meta de 20 puntos | Desgaste .2/60/6/−.1 | 95.3 ± 22.9 | 16.19 | 0.6% | 25.6% | 29.4% | 15.9% | 47.5% | 7.2% | — | Descartado |
| Límite de 30 turnos | Actual 1/2/3/+1 | 30 ± 0 | 3.17 | 78.4% | 0% | 77.8% | 0% | 2.5% | 19.7% | — | Descartado |
| Límite de 30 turnos | Objetivos .25/50/8/0 | 30 ± 0 | 3.08 | 12.7% | 0% | 69.5% | 5.8% | 24.7% | 0% | — | Descartado |
| Límite de 30 turnos | Cerco .2/80/4/0 | 30 ± 0 | 1.87 | 12% | 0% | 77.1% | 7.7% | 15.2% | 0% | — | Descartado |
| Límite de 30 turnos | Desgaste .2/60/6/−.1 | 30 ± 0 | 2.22 | 13.5% | 0% | 64.9% | 6.5% | 20.6% | 8% | — | Descartado |
| 8 celdas bloqueadas | Actual 1/2/3/+1 | 35.4 ± 4.2 | 2.09 | 36.5% | 0% | 74.8% | 0.2% | 3.3% | 21.7% | — | Descartado |
| 8 celdas bloqueadas | Objetivos .25/50/8/0 | 35.2 ± 4.2 | 5.77 | 9.9% | 0% | 54.8% | 19.7% | 25.5% | 0% | 99.4% | Margen abierto |
| 8 celdas bloqueadas | Cerco .2/80/4/0 | 35.2 ± 4.2 | 5.55 | 9.5% | 0% | 50.6% | 35.6% | 13.8% | 0% | 98.1% | Margen abierto |
| 8 celdas bloqueadas | Desgaste .2/60/6/−.1 | 35.3 ± 4.2 | 5.68 | 19.8% | 0% | 47.7% | 23.1% | 22.3% | 6.9% | 98.7% | Margen abierto |

## Controles de validez

El jugador aleatorio elige primero entre colocar y atacar con igual probabilidad cuando
ambas familias están disponibles, y después elige uniformemente dentro de la familia.
El codicioso examina todas las jugadas legales y maximiza la variación inmediata del
marcador; juega la mitad de las partidas como Oro y la mitad como Púrpura.

El modelo experimental aplica suicidio ilegal, cuenta líneas por jugador y elimina una
línea del registro activo cuando se rompe. Estos ajustes evitan medir los bugs conocidos
del motor de producción. No se implementó todavía ninguna de estas reglas en el juego.
La regla de ko no se modeló porque su variante exacta sigue pendiente de aprobación;
las tres terminaciones experimentales y el tope técnico impiden partidas infinitas.

Los esquemas de meta y bloqueo tienen un tope técnico de 120 turnos. La tasa de llegada
a ese tope está incluida en el JSON de resultados y forma parte del filtro de finalistas.

## Recomendación

Ninguna combinación satisface todos los criterios. No debe implementarse un esquema todavía.
