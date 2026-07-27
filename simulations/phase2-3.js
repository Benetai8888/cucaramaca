'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EMPTY = 0;
const GOLD = 1;
const PURPLE = 2;
const BOARD_CELLS = 81;
const ALL_NUMBERS_MASK = 0b1111111110;
const EPSILON = 1e-9;

const TERMINATIONS = [
  {
    id: 'meta-20',
    name: 'Meta de 20 puntos',
    type: 'points',
    target: 20,
    safetyCap: 120,
  },
  {
    id: 'limite-30',
    name: 'Límite de 30 turnos',
    type: 'turns',
    target: 30,
    safetyCap: 30,
  },
  {
    id: 'cicatrices-8',
    name: '8 celdas bloqueadas',
    type: 'blocked',
    target: 8,
    safetyCap: 120,
  },
];

const SCORINGS = [
  {
    id: 'actual',
    name: 'Actual 1/2/3/+1',
    place: 1,
    go: 2,
    line: 3,
    attack: {mode: 'gain', value: 1},
  },
  {
    id: 'objetivos',
    name: 'Objetivos .25/50/8/0',
    place: 0.25,
    go: 50,
    line: 8,
    attack: {mode: 'none', value: 0},
  },
  {
    id: 'cerco',
    name: 'Cerco .2/80/4/0',
    place: 0.2,
    go: 80,
    line: 4,
    attack: {mode: 'none', value: 0},
  },
  {
    id: 'desgaste-leve',
    name: 'Desgaste .2/60/6/−.1',
    place: 0.2,
    go: 60,
    line: 6,
    attack: {mode: 'penalty', value: 0.1},
  },
];

class Random {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  next() {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(maximum) {
    return Math.floor(this.next() * maximum);
  }
}

function otherPlayer(player) {
  return player === GOLD ? PURPLE : GOLD;
}

function createState(firstPlayer = GOLD) {
  return {
    values: new Uint8Array(BOARD_CELLS),
    owners: new Uint8Array(BOARD_CELLS),
    blocked: new Uint8Array(BOARD_CELLS),
    activeLines: new Set(),
    currentPlayer: firstPlayer,
    scores: new Float64Array(3),
    breakdown: {place: 0, go: 0, line: 0, attack: 0},
    actions: {place: 0, go: 0, line: 0, attack: 0},
    turn: 0,
    blockedCount: 0,
  };
}

function getNeighbors(index) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const neighbors = [];
  if (row > 0) neighbors.push(index - 9);
  if (row < 8) neighbors.push(index + 9);
  if (col > 0) neighbors.push(index - 1);
  if (col < 8) neighbors.push(index + 1);
  return neighbors;
}

function getGroup(owners, blocked, index) {
  const owner = owners[index];
  if (owner === EMPTY) return {cells: [], liberties: 0};
  const cells = [];
  const visited = new Uint8Array(BOARD_CELLS);
  const liberties = new Uint8Array(BOARD_CELLS);
  const stack = [index];
  let libertyCount = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (visited[current]) continue;
    visited[current] = 1;
    cells.push(current);
    for (const neighbor of getNeighbors(current)) {
      if (owners[neighbor] === EMPTY && !blocked[neighbor]) {
        if (!liberties[neighbor]) {
          liberties[neighbor] = 1;
          libertyCount++;
        }
      } else if (owners[neighbor] === owner && !visited[neighbor]) {
        stack.push(neighbor);
      }
    }
  }
  return {cells, liberties: libertyCount};
}

function getBoxLines(box) {
  const topLeft = Math.floor(box / 3) * 27 + (box % 3) * 3;
  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) cells.push(topLeft + row * 9 + col);
  }
  return [
    [cells[0], cells[1], cells[2]],
    [cells[3], cells[4], cells[5]],
    [cells[6], cells[7], cells[8]],
    [cells[0], cells[3], cells[6]],
    [cells[1], cells[4], cells[7]],
    [cells[2], cells[5], cells[8]],
    [cells[0], cells[4], cells[8]],
    [cells[2], cells[4], cells[6]],
  ];
}

const BOX_LINES = Array.from({length: 9}, (_, box) => getBoxLines(box));

function lineKey(player, line) {
  return `${player}:${line.join(',')}`;
}

function computeActiveLines(owners) {
  const active = new Set();
  for (const lines of BOX_LINES) {
    for (const line of lines) {
      const player = owners[line[0]];
      if (player !== EMPTY && line.every(index => owners[index] === player)) {
        active.add(lineKey(player, line));
      }
    }
  }
  return active;
}

function countNewLinesAt(owners, index, player, previousActive) {
  const box = Math.floor(Math.floor(index / 9) / 3) * 3 + Math.floor((index % 9) / 3);
  let count = 0;
  for (const line of BOX_LINES[box]) {
    if (!line.includes(index)) continue;
    const key = lineKey(player, line);
    if (!previousActive.has(key) && line.every(cell => owners[cell] === player)) count++;
  }
  return count;
}

function placementCandidates(state) {
  const rowMasks = new Uint16Array(9);
  const colMasks = new Uint16Array(9);
  const boxMasks = new Uint16Array(9);
  for (let index = 0; index < BOARD_CELLS; index++) {
    const value = state.values[index];
    if (value === 0) continue;
    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const bit = 1 << value;
    rowMasks[row] |= bit;
    colMasks[col] |= bit;
    boxMasks[box] |= bit;
  }

  const moves = [];
  for (let index = 0; index < BOARD_CELLS; index++) {
    if (state.owners[index] !== EMPTY || state.blocked[index]) continue;
    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const allowed = ALL_NUMBERS_MASK & ~(rowMasks[row] | colMasks[col] | boxMasks[box]);
    for (let number = 1; number <= 9; number++) {
      if (allowed & (1 << number)) moves.push({type: 'place', index, number});
    }
  }
  return moves;
}

function attackCandidates(state) {
  const player = state.currentPlayer;
  const moves = [];
  for (let source = 0; source < BOARD_CELLS; source++) {
    if (state.owners[source] !== player) continue;
    const sourceRow = Math.floor(source / 9);
    const sourceCol = source % 9;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        if (rowOffset === 0 && colOffset === 0) continue;
        const row = sourceRow + rowOffset;
        const col = sourceCol + colOffset;
        if (row < 0 || row > 8 || col < 0 || col > 8) continue;
        const target = row * 9 + col;
        if (state.owners[target] !== EMPTY &&
            state.owners[target] !== player &&
            state.values[source] > state.values[target]) {
          moves.push({type: 'attack', source, target});
        }
      }
    }
  }
  return moves;
}

function cloneState(state) {
  return {
    values: state.values.slice(),
    owners: state.owners.slice(),
    blocked: state.blocked.slice(),
    activeLines: new Set(state.activeLines),
    currentPlayer: state.currentPlayer,
    scores: state.scores.slice(),
    breakdown: {...state.breakdown},
    actions: {...state.actions},
    turn: state.turn,
    blockedCount: state.blockedCount,
  };
}

function award(next, scoring, player, source, units) {
  if (units <= 0) return;
  if (source === 'attack') {
    const impact = scoring.attack.value * units;
    if (scoring.attack.mode === 'gain') next.scores[player] += impact;
    else if (scoring.attack.mode === 'penalty') next.scores[otherPlayer(player)] -= impact;
    next.breakdown.attack += impact;
    next.actions.attack += units;
    return;
  }

  const impact = scoring[source] * units;
  next.scores[player] += impact;
  next.breakdown[source] += impact;
  next.actions[source] += units;
}

function applyMove(state, move, termination, scoring, updateActiveLines = true) {
  const next = cloneState(state);
  const player = state.currentPlayer;
  let captured = [];
  let newLineCount = 0;

  if (move.type === 'place') {
    if (next.owners[move.index] !== EMPTY || next.blocked[move.index]) return null;
    next.values[move.index] = move.number;
    next.owners[move.index] = player;

    const capturedSet = new Set();
    for (const neighbor of getNeighbors(move.index)) {
      const owner = next.owners[neighbor];
      if (owner !== EMPTY && owner !== player) {
        const group = getGroup(next.owners, next.blocked, neighbor);
        if (group.liberties === 0) group.cells.forEach(index => capturedSet.add(index));
      }
    }
    captured = [...capturedSet];
    for (const index of captured) {
      next.values[index] = 0;
      next.owners[index] = EMPTY;
      if (termination.type === 'blocked' && !next.blocked[index]) {
        next.blocked[index] = 1;
        next.blockedCount++;
      }
    }

    if (getGroup(next.owners, next.blocked, move.index).liberties === 0) return null;
    newLineCount = countNewLinesAt(next.owners, move.index, player, state.activeLines);
    award(next, scoring, player, 'place', 1);
    award(next, scoring, player, 'go', captured.length);
    award(next, scoring, player, 'line', newLineCount);
  } else if (move.type === 'attack') {
    if (next.owners[move.source] !== player ||
        next.owners[move.target] === EMPTY ||
        next.owners[move.target] === player ||
        next.values[move.source] <= next.values[move.target]) return null;
    next.values[move.target] = 0;
    next.owners[move.target] = EMPTY;
    captured = [move.target];
    if (termination.type === 'blocked' && !next.blocked[move.target]) {
      next.blocked[move.target] = 1;
      next.blockedCount++;
    }
    award(next, scoring, player, 'attack', 1);
  } else {
    return null;
  }

  if (updateActiveLines) next.activeLines = computeActiveLines(next.owners);
  next.currentPlayer = otherPlayer(player);
  next.turn++;
  return {state: next, captured: captured.length, lines: newLineCount};
}

function familyOrder(state, random) {
  const placements = placementCandidates(state);
  const attacks = attackCandidates(state);
  const families = [];
  if (placements.length > 0) families.push(placements);
  if (attacks.length > 0) families.push(attacks);
  if (families.length === 2 && random.next() < 0.5) families.reverse();
  return families;
}

function randomChoice(state, termination, scoring, random) {
  for (const family of familyOrder(state, random)) {
    const candidates = family.slice();
    while (candidates.length > 0) {
      const selected = random.int(candidates.length);
      const move = candidates[selected];
      candidates[selected] = candidates[candidates.length - 1];
      candidates.pop();
      const applied = applyMove(state, move, termination, scoring);
      if (applied) return {...applied, move};
    }
  }
  return null;
}

function greedyChoice(state, termination, scoring, random) {
  const moves = [...placementCandidates(state), ...attackCandidates(state)];
  let bestUtility = -Infinity;
  let bestMove = null;
  let ties = 0;
  const player = state.currentPlayer;
  const opponent = otherPlayer(player);

  for (const move of moves) {
    const applied = applyMove(state, move, termination, scoring, false);
    if (!applied) continue;
    const utility =
      (applied.state.scores[player] - state.scores[player]) -
      (applied.state.scores[opponent] - state.scores[opponent]);
    if (utility > bestUtility + EPSILON) {
      bestUtility = utility;
      bestMove = move;
      ties = 1;
    } else if (Math.abs(utility - bestUtility) <= EPSILON) {
      ties++;
      if (random.int(ties) === 0) bestMove = move;
    }
  }
  if (!bestMove) return null;
  return {...applyMove(state, bestMove, termination, scoring), move: bestMove};
}

function reachedTermination(state, termination) {
  if (termination.type === 'points') {
    return state.scores[GOLD] >= termination.target ||
      state.scores[PURPLE] >= termination.target;
  }
  if (termination.type === 'turns') return state.turn >= termination.target;
  if (termination.type === 'blocked') return state.blockedCount >= termination.target;
  return false;
}

function playGame({termination, scoring, random, greedyPlayer = EMPTY}) {
  let state = createState();
  let noMoves = false;
  while (!reachedTermination(state, termination) && state.turn < termination.safetyCap) {
    const choice = state.currentPlayer === greedyPlayer
      ? greedyChoice(state, termination, scoring, random)
      : randomChoice(state, termination, scoring, random);
    if (!choice) {
      noMoves = true;
      break;
    }
    state = choice.state;
  }

  const capped = !reachedTermination(state, termination) &&
    !noMoves &&
    state.turn >= termination.safetyCap;
  let winner = EMPTY;
  if (state.scores[GOLD] > state.scores[PURPLE] + EPSILON) winner = GOLD;
  else if (state.scores[PURPLE] > state.scores[GOLD] + EPSILON) winner = PURPLE;
  return {
    turns: state.turn,
    scores: [state.scores[GOLD], state.scores[PURPLE]],
    winner,
    margin: Math.abs(state.scores[GOLD] - state.scores[PURPLE]),
    breakdown: state.breakdown,
    actions: state.actions,
    blockedCount: state.blockedCount,
    capped,
    noMoves,
  };
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  const average = mean(values);
  return Math.sqrt(mean(values.map(value => (value - average) ** 2)));
}

function summarize(games, termination, scoring) {
  const turns = games.map(game => game.turns);
  const decisiveGames = games.filter(game => game.winner !== EMPTY);
  const margins = decisiveGames.map(game => game.margin);
  const breakdown = {place: 0, go: 0, line: 0, attack: 0};
  let draws = 0;
  let goldWins = 0;
  let capped = 0;
  let totalImpact = 0;

  for (const game of games) {
    if (game.winner === EMPTY) draws++;
    if (game.winner === GOLD) goldWins++;
    if (game.capped) capped++;
    for (const source of Object.keys(breakdown)) breakdown[source] += game.breakdown[source];
  }
  totalImpact = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const shares = Object.fromEntries(
    Object.entries(breakdown).map(([source, value]) =>
      [source, totalImpact > 0 ? value * 100 / totalImpact : 0]),
  );
  const meanMargin = margins.length > 0 ? mean(margins) : 0;
  const meanImpact = decisiveGames.length > 0
    ? mean(decisiveGames.map(game =>
      Object.values(game.breakdown).reduce((sum, value) => sum + value, 0)))
    : 0;
  return {
    id: `${termination.id}__${scoring.id}`,
    termination: termination.id,
    terminationName: termination.name,
    scoring: scoring.id,
    scoringName: scoring.name,
    games: games.length,
    meanTurns: mean(turns),
    stdTurns: standardDeviation(turns),
    meanMargin,
    normalizedMargin: meanImpact > 0 ? meanMargin / meanImpact : Infinity,
    drawPercent: draws * 100 / games.length,
    goldWinPercent: goldWins * 100 / games.length,
    capPercent: capped * 100 / games.length,
    shares,
    goLinePercent: shares.go + shares.line,
    greedy: null,
  };
}

function runRandomMatrix(gamesPerCombination, baseSeed) {
  const results = [];
  for (let terminationIndex = 0; terminationIndex < TERMINATIONS.length; terminationIndex++) {
    for (let scoringIndex = 0; scoringIndex < SCORINGS.length; scoringIndex++) {
      const termination = TERMINATIONS[terminationIndex];
      const scoring = SCORINGS[scoringIndex];
      const random = new Random(baseSeed + terminationIndex * 100_003 + scoringIndex * 7_919);
      const games = [];
      for (let game = 0; game < gamesPerCombination; game++) {
        games.push(playGame({termination, scoring, random}));
      }
      results.push(summarize(games, termination, scoring));
    }
  }
  return results;
}

function isCandidate(result) {
  return result.meanTurns >= 20 &&
    result.meanTurns <= 40 &&
    result.goLinePercent >= 40 &&
    result.capPercent <= 1;
}

function isPreFinalist(result) {
  return isCandidate(result) && result.normalizedMargin <= 0.25;
}

function finalistDistance(result) {
  const durationPenalty = result.meanTurns < 20
    ? 20 - result.meanTurns
    : Math.max(0, result.meanTurns - 40);
  const contributionPenalty = Math.max(0, 40 - result.goLinePercent) / 4;
  const marginPenalty = Math.max(0, result.normalizedMargin - 0.25) * 40;
  const capPenalty = result.capPercent;
  return durationPenalty + contributionPenalty + marginPenalty + capPenalty;
}

function selectFinalists(results) {
  const candidates = results.filter(isCandidate);
  if (candidates.length > 0) return candidates;
  return [...results].sort((a, b) => finalistDistance(a) - finalistDistance(b)).slice(0, 3);
}

function runGreedyMatchup(result, games, baseSeed) {
  const termination = TERMINATIONS.find(item => item.id === result.termination);
  const scoring = SCORINGS.find(item => item.id === result.scoring);
  const random = new Random(baseSeed);
  let greedyWins = 0;
  let randomWins = 0;
  let draws = 0;

  for (let game = 0; game < games; game++) {
    const greedyPlayer = game % 2 === 0 ? GOLD : PURPLE;
    const played = playGame({termination, scoring, random, greedyPlayer});
    if (played.winner === EMPTY) draws++;
    else if (played.winner === greedyPlayer) greedyWins++;
    else randomWins++;
  }
  return {
    games,
    greedyWinPercent: greedyWins * 100 / games,
    randomWinPercent: randomWins * 100 / games,
    drawPercent: draws * 100 / games,
    tooTactical: greedyWins * 100 / games > 85,
  };
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function renderReport(results, metadata) {
  const lines = [
    '# Simulación conjunta de terminación y puntuación',
    '',
    `Fecha: ${metadata.date}`,
    '',
    `Partidas aleatorias por combinación: ${metadata.randomGames.toLocaleString('en-US')}.`,
    `Partidas codicioso contra aleatorio por candidato evaluado: ${metadata.greedyGames.toLocaleString('en-US')}.`,
    `Semilla base: ${metadata.seed}.`,
    '',
    'La participación porcentual usa impacto absoluto en el marcador. Cuando un ataque resta',
    'puntos al rival, esa resta se contabiliza como contribución del ataque.',
    '',
    'Se considera margen cerrado cuando el margen medio representa como máximo 25% del',
    'impacto total medio. Los candidatos enviados a la prueba codiciosa duran entre 20 y',
    '40 turnos, Go más líneas aportan al menos 40%, y el tope de seguridad interviene en',
    'como máximo 1% de las partidas. Para ser finalista deben tener además margen cerrado.',
    '',
    '| Terminación | Puntuación | Turnos media ± DE | Margen medio | Empates | Tope | Colocar | Go | Líneas | Ataques | Codicioso gana | Resultado |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
  ];

  for (const result of results) {
    const candidate = isCandidate(result);
    const preliminary = isPreFinalist(result);
    const greedy = result.greedy;
    let verdict = candidate ? 'Margen abierto' : 'Descartado';
    if (preliminary) verdict = greedy?.tooTactical ? 'Demasiado táctico' : 'Finalista';
    lines.push(
      `| ${result.terminationName} | ${result.scoringName} | ` +
      `${round(result.meanTurns, 1)} ± ${round(result.stdTurns, 1)} | ` +
      `${round(result.meanMargin, 2)} | ${round(result.drawPercent, 1)}% | ` +
      `${round(result.capPercent, 1)}% | ` +
      `${round(result.shares.place, 1)}% | ${round(result.shares.go, 1)}% | ` +
      `${round(result.shares.line, 1)}% | ${round(result.shares.attack, 1)}% | ` +
      `${greedy ? `${round(greedy.greedyWinPercent, 1)}%` : '—'} | ${verdict} |`,
    );
  }

  lines.push(
    '',
    '## Controles de validez',
    '',
    'El jugador aleatorio elige primero entre colocar y atacar con igual probabilidad cuando',
    'ambas familias están disponibles, y después elige uniformemente dentro de la familia.',
    'El codicioso examina todas las jugadas legales y maximiza la variación inmediata del',
    'marcador; juega la mitad de las partidas como Oro y la mitad como Púrpura.',
    '',
    'El modelo experimental aplica suicidio ilegal, cuenta líneas por jugador y elimina una',
    'línea del registro activo cuando se rompe. Estos ajustes evitan medir los bugs conocidos',
    'del motor de producción. No se implementó todavía ninguna de estas reglas en el juego.',
    'La regla de ko no se modeló porque su variante exacta sigue pendiente de aprobación;',
    'las tres terminaciones experimentales y el tope técnico impiden partidas infinitas.',
    '',
    'Los esquemas de meta y bloqueo tienen un tope técnico de 120 turnos. La tasa de llegada',
    'a ese tope está incluida en el JSON de resultados y forma parte del filtro de finalistas.',
    '',
    '## Recomendación',
    '',
  );

  const viable = results.filter(result =>
    isPreFinalist(result) && result.greedy && !result.greedy.tooTactical);
  if (viable.length === 0) {
    lines.push('Ninguna combinación satisface todos los criterios. No debe implementarse un esquema todavía.');
  } else {
    const recommended = [...viable].sort((a, b) => {
      const aDistance = Math.abs(a.meanTurns - 30) + a.normalizedMargin * 10;
      const bDistance = Math.abs(b.meanTurns - 30) + b.normalizedMargin * 10;
      return aDistance - bDistance;
    })[0];
    lines.push(
      `La combinación mejor alineada es ${recommended.terminationName} con ` +
      `${recommended.scoringName}. Esta recomendación es experimental y requiere aprobación ` +
      'antes de modificar el motor de producción.',
    );
  }
  lines.push('');
  return lines.join('\n');
}

function parseArguments(argv) {
  const options = {games: 1000, greedyGames: 1000, seed: 20260727};
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--games') options.games = Number(argv[++index]);
    else if (argument === '--greedy-games') options.greedyGames = Number(argv[++index]);
    else if (argument === '--seed') options.seed = Number(argv[++index]);
  }
  if (!Number.isInteger(options.games) || options.games < 1) throw new Error('--games inválido');
  if (!Number.isInteger(options.greedyGames) || options.greedyGames < 1) {
    throw new Error('--greedy-games inválido');
  }
  if (!Number.isInteger(options.seed)) throw new Error('--seed inválida');
  return options;
}

function run(options) {
  const results = runRandomMatrix(options.games, options.seed);
  const finalists = selectFinalists(results);
  finalists.forEach((result, index) => {
    result.greedy = runGreedyMatchup(
      result,
      options.greedyGames,
      options.seed + 900_001 + index * 10_007,
    );
  });
  return {
    metadata: {
      date: '2026-07-27',
      randomGames: options.games,
      greedyGames: options.greedyGames,
      seed: options.seed,
      combinations: TERMINATIONS.length * SCORINGS.length,
      totalRandomGames: options.games * TERMINATIONS.length * SCORINGS.length,
      evaluatedCandidates: finalists.map(result => result.id),
    },
    terminations: TERMINATIONS,
    scorings: SCORINGS,
    results,
  };
}

if (require.main === module) {
  const options = parseArguments(process.argv.slice(2));
  const output = run(options);
  const reportDirectory = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(reportDirectory, {recursive: true});
  fs.writeFileSync(
    path.join(reportDirectory, 'fases-2-3.json'),
    `${JSON.stringify(output, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(reportDirectory, 'fases-2-3.md'),
    renderReport(output.results, output.metadata),
  );
  process.stdout.write(`${renderReport(output.results, output.metadata)}\n`);
}

module.exports = {
  EMPTY,
  GOLD,
  PURPLE,
  EPSILON,
  TERMINATIONS,
  SCORINGS,
  Random,
  otherPlayer,
  createState,
  getNeighbors,
  getGroup,
  BOX_LINES,
  computeActiveLines,
  placementCandidates,
  attackCandidates,
  cloneState,
  applyMove,
  reachedTermination,
  playGame,
  mean,
  standardDeviation,
  summarize,
  runRandomMatrix,
  selectFinalists,
  runGreedyMatchup,
  round,
  renderReport,
  run,
};
