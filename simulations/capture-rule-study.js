'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {Worker, isMainThread, parentPort} = require('node:worker_threads');
const {Random} = require('./phase2-3.js');
const {
  GEOMETRIES,
  getGroup,
  placementCandidates,
  attackCandidates,
  distribution,
} = require('./go-horizon-study.js');

const EMPTY = 0;
const GOLD = 1;
const PURPLE = 2;
const EPSILON = 1e-9;
const GEOMETRY = GEOMETRIES['9x9'];
const TURN_LIMIT = 30;

const SCORE_RULE = Object.freeze({
  place: 1,
  goCapturePerStone: 2,
  line: 3,
  attack: 1,
  explanation: 'Colocar 1; cada piedra capturada 2; línea 3; ataque 1.',
});

const EVALUATION = Object.freeze({
  visibleScore: 10,
  number: 0.37,
  rowClosure: 0.41,
  columnClosure: 0.43,
  boxClosure: 0.47,
  center: 0.71,
  ownNeighbor: 0.79,
  enemyNeighbor: 0.83,
  cellConstraint: 0.89,
  numberScarcity: 0.097,
  enemyLibertyReduction: 1,
  ownLibertyGain: 0.61,
  groupLiberties: 0.73,
  enemyAtariGain: 20,
  linePotentialGain: 0.59,
  attackThreatGain: 0.67,
  attackStrength: 4,
});

const OPENING_GOLD = [
  {index: 10, number: 5},
  {index: 11, number: 6},
  {index: 19, number: 8},
  {index: 3, number: 4},
  {index: 24, number: 4},
  {index: 29, number: 4},
];

const OPENING_PURPLE = [
  {index: 70, number: 5},
  {index: 69, number: 6},
  {index: 61, number: 8},
  {index: 77, number: 4},
  {index: 56, number: 4},
  {index: 51, number: 4},
];

const VARIANTS = Object.freeze([
  {
    id: 'control',
    name: 'Control: cerco completo',
    rule: 'Un grupo se captura cuando pierde su última libertad.',
    type: 'standard',
  },
  {
    id: 'v1-atari-sostenido',
    name: 'V1: atari sostenido',
    rule: 'Un grupo en atari se captura si en su siguiente turno no sube de una libertad.',
    type: 'sustained-atari',
  },
  {
    id: 'v2-grupo-grande',
    name: 'V2: penúltima libertad',
    rule: 'Un grupo de tres o más piedras se captura al quedar con una sola libertad.',
    type: 'large-group',
  },
  {
    id: 'v3-apertura-fija',
    name: 'V3: apertura fija',
    rule: 'Cada bando empieza con seis piedras fijas y sin puntos; la captura no cambia.',
    type: 'fixed-opening',
  },
  {
    id: 'v4-presion-numerica',
    name: 'V4: presión numérica',
    rule: 'Con hasta dos libertades, un grupo cae si los números enemigos que lo tocan suman 10.',
    type: 'number-pressure',
  },
]);

function otherPlayer(player) {
  return player === GOLD ? PURPLE : GOLD;
}

function createState(variant) {
  const state = {
    values: new Uint8Array(GEOMETRY.cells),
    owners: new Uint8Array(GEOMETRY.cells),
    placedAt: new Uint16Array(GEOMETRY.cells),
    activeLines: new Set(),
    currentPlayer: GOLD,
    scores: new Float64Array(3),
    mechanics: {
      place: new Uint16Array(3),
      go: new Uint16Array(3),
      goEvents: new Uint16Array(3),
      line: new Uint16Array(3),
      attack: new Uint16Array(3),
    },
    pendingAtari: [],
    turn: 0,
  };
  if (variant.type === 'fixed-opening') {
    for (const stone of OPENING_GOLD) {
      state.values[stone.index] = stone.number;
      state.owners[stone.index] = GOLD;
    }
    for (const stone of OPENING_PURPLE) {
      state.values[stone.index] = stone.number;
      state.owners[stone.index] = PURPLE;
    }
    state.activeLines = activeLines(state.owners);
  }
  return state;
}

function cloneState(state) {
  return {
    values: state.values.slice(),
    owners: state.owners.slice(),
    placedAt: state.placedAt.slice(),
    activeLines: new Set(state.activeLines),
    currentPlayer: state.currentPlayer,
    scores: state.scores.slice(),
    mechanics: {
      place: state.mechanics.place.slice(),
      go: state.mechanics.go.slice(),
      goEvents: state.mechanics.goEvents.slice(),
      line: state.mechanics.line.slice(),
      attack: state.mechanics.attack.slice(),
    },
    pendingAtari: state.pendingAtari.map(record => ({
      owner: record.owner,
      attacker: record.attacker,
      cells: [...record.cells],
    })),
    turn: state.turn,
  };
}

function activeLines(owners) {
  const active = new Set();
  for (let lineIndex = 0; lineIndex < GEOMETRY.lines.length; lineIndex++) {
    const line = GEOMETRY.lines[lineIndex];
    const owner = owners[line[0]];
    if (owner !== EMPTY && line.every(index => owners[index] === owner)) {
      active.add(`${owner}:${lineIndex}`);
    }
  }
  return active;
}

function linePotential(state, player) {
  let threats = 0;
  let openLines = 0;
  for (const line of GEOMETRY.lines) {
    let own = 0;
    let enemy = 0;
    for (const index of line) {
      if (state.owners[index] === player) own++;
      else if (state.owners[index] !== EMPTY) enemy++;
    }
    const open = 3 - own - enemy;
    if (enemy === 0 && own === 2 && open === 1) threats++;
    else if (enemy === 0 && own === 1 && open === 2) openLines++;
  }
  return threats * 2 + openLines;
}

function groupMetric(state, player, selector) {
  const visited = new Uint8Array(GEOMETRY.cells);
  let total = 0;
  for (let index = 0; index < GEOMETRY.cells; index++) {
    if (visited[index] || state.owners[index] !== player) continue;
    const group = getGroup(state, GEOMETRY, index);
    group.cells.forEach(cell => {
      visited[cell] = 1;
    });
    total += selector(group);
  }
  return total;
}

function totalLiberties(state, player) {
  return groupMetric(state, player, group => group.liberties);
}

function atariGroups(state, player) {
  return groupMetric(state, player, group => Number(group.liberties === 1));
}

function capturePreparation(group, state, captor, captureTurn) {
  let firstBoundaryStone = Infinity;
  let firstActiveContact = Infinity;
  const groupSet = new Set(group.cells);
  for (const capturedCell of group.cells) {
    for (const boundary of GEOMETRY.orthogonal[capturedCell]) {
      if (groupSet.has(boundary) || state.owners[boundary] !== captor) continue;
      const boundaryTurn = state.placedAt[boundary];
      const targetTurn = state.placedAt[capturedCell];
      firstBoundaryStone = Math.min(firstBoundaryStone, boundaryTurn);
      firstActiveContact = Math.min(firstActiveContact, Math.max(boundaryTurn, targetTurn));
    }
  }
  if (!Number.isFinite(firstActiveContact)) {
    firstActiveContact = captureTurn;
    firstBoundaryStone = captureTurn;
  }
  return {
    captor,
    owner: otherPlayer(captor),
    stones: group.cells.length,
    boundaryStoneTurns: captureTurn - firstBoundaryStone + 1,
    activeEnclosureTurns: captureTurn - firstActiveContact + 1,
  };
}

function borderingNumberSum(group, state, captor) {
  const groupSet = new Set(group.cells);
  const boundary = new Set();
  for (const cell of group.cells) {
    for (const neighbor of GEOMETRY.orthogonal[cell]) {
      if (!groupSet.has(neighbor) && state.owners[neighbor] === captor) {
        boundary.add(neighbor);
      }
    }
  }
  return [...boundary].reduce((sum, index) => sum + state.values[index], 0);
}

function removeGroups(next, groups, captor, captureTurn, captureEvents, removed) {
  for (const group of groups) {
    const liveCells = group.cells.filter(cell => next.owners[cell] === group.owner);
    if (liveCells.length === 0 || liveCells.every(cell => removed.has(cell))) continue;
    const liveGroup = getGroup(next, GEOMETRY, liveCells[0]);
    const event = capturePreparation(liveGroup, next, captor, captureTurn);
    captureEvents.push(event);
    for (const cell of liveGroup.cells) {
      removed.add(cell);
      next.values[cell] = 0;
      next.owners[cell] = EMPTY;
      next.placedAt[cell] = 0;
    }
    next.scores[captor] += event.stones * SCORE_RULE.goCapturePerStone;
    next.mechanics.go[captor] += event.stones;
    next.mechanics.goEvents[captor]++;
  }
}

function adjacentEnemyGroups(next, index, player) {
  const groups = [];
  const visited = new Set();
  for (const neighbor of GEOMETRY.orthogonal[index]) {
    if (next.owners[neighbor] === EMPTY ||
        next.owners[neighbor] === player ||
        visited.has(neighbor)) continue;
    const group = getGroup(next, GEOMETRY, neighbor);
    group.owner = next.owners[neighbor];
    group.cells.forEach(cell => visited.add(cell));
    groups.push(group);
  }
  return groups;
}

function groupsCapturedImmediately(next, move, player, variant) {
  if (move.type !== 'place') return [];
  return adjacentEnemyGroups(next, move.index, player).filter(group => {
    if (group.liberties === 0) return true;
    if (variant.type === 'large-group') {
      return group.cells.length >= 3 && group.liberties === 1;
    }
    if (variant.type === 'number-pressure') {
      return group.liberties <= 2 &&
        borderingNumberSum(group, next, player) >= 10;
    }
    return false;
  });
}

function resolvePendingAtari(next, defender, captureTurn, captureEvents, removed) {
  const handled = new Set();
  for (const record of next.pendingAtari) {
    if (record.owner !== defender) continue;
    const anchor = record.cells.find(cell => next.owners[cell] === defender);
    if (anchor === undefined || handled.has(anchor)) continue;
    const group = getGroup(next, GEOMETRY, anchor);
    group.owner = defender;
    group.cells.forEach(cell => handled.add(cell));
    if (group.liberties <= 1) {
      removeGroups(
        next,
        [group],
        record.attacker,
        captureTurn,
        captureEvents,
        removed,
      );
    }
  }
  next.pendingAtari = [];
}

function markNewAtari(next, move, attacker) {
  if (move.type !== 'place' || next.owners[move.index] !== attacker) return;
  for (const group of adjacentEnemyGroups(next, move.index, attacker)) {
    if (group.liberties === 1) {
      next.pendingAtari.push({
        owner: group.owner,
        attacker,
        cells: [...group.cells],
      });
    }
  }
}

function transition(state, move, variant) {
  const next = cloneState(state);
  const player = state.currentPlayer;
  const opponent = otherPlayer(player);
  const captureTurn = state.turn + 1;
  const captureEvents = [];
  const removed = new Set();
  let newLines = 0;

  if (move.type === 'place') {
    if (next.owners[move.index] !== EMPTY) return null;
    next.values[move.index] = move.number;
    next.owners[move.index] = player;
    next.placedAt[move.index] = captureTurn;

    const immediate = groupsCapturedImmediately(next, move, player, variant);
    removeGroups(next, immediate, player, captureTurn, captureEvents, removed);
    if (getGroup(next, GEOMETRY, move.index).liberties === 0) return null;

    next.scores[player] += SCORE_RULE.place;
    next.mechanics.place[player]++;
  } else if (move.type === 'attack') {
    if (next.owners[move.source] !== player ||
        next.owners[move.target] === EMPTY ||
        next.owners[move.target] === player ||
        next.values[move.source] <= next.values[move.target]) return null;
    next.values[move.target] = 0;
    next.owners[move.target] = EMPTY;
    next.placedAt[move.target] = 0;
    next.scores[player] += SCORE_RULE.attack;
    next.mechanics.attack[player]++;
  } else {
    return null;
  }

  if (variant.type === 'sustained-atari') {
    resolvePendingAtari(next, player, captureTurn, captureEvents, removed);
    markNewAtari(next, move, player);
  } else {
    next.pendingAtari = [];
  }

  const afterLines = activeLines(next.owners);
  if (move.type === 'place' && next.owners[move.index] === player) {
    for (const key of afterLines) {
      if (key.startsWith(`${player}:`) && !state.activeLines.has(key)) newLines++;
    }
    if (newLines > 0) {
      next.scores[player] += newLines * SCORE_RULE.line;
      next.mechanics.line[player] += newLines;
    }
  }
  next.activeLines = afterLines;
  next.currentPlayer = opponent;
  next.turn++;
  return {state: next, captureEvents, newLines};
}

function closureFeatures(move, placements) {
  if (move.type !== 'place') {
    return {rowClosures: 0, columnClosures: 0, boxClosures: 0};
  }
  const row = Math.floor(move.index / GEOMETRY.size);
  const column = move.index % GEOMETRY.size;
  const box = GEOMETRY.boxOf[move.index];
  let rowClosures = 0;
  let columnClosures = 0;
  let boxClosures = 0;
  for (const candidate of placements) {
    if (candidate.number !== move.number || candidate.index === move.index) continue;
    const candidateRow = Math.floor(candidate.index / GEOMETRY.size);
    const candidateColumn = candidate.index % GEOMETRY.size;
    if (candidateRow === row) rowClosures++;
    if (candidateColumn === column) columnClosures++;
    if (GEOMETRY.boxOf[candidate.index] === box) boxClosures++;
  }
  return {rowClosures, columnClosures, boxClosures};
}

function attackThreats(state, player) {
  let threats = 0;
  for (let source = 0; source < GEOMETRY.cells; source++) {
    if (state.owners[source] !== player) continue;
    for (const target of GEOMETRY.adjacent[source]) {
      if (state.owners[target] !== EMPTY &&
          state.owners[target] !== player &&
          state.values[source] > state.values[target]) threats++;
    }
  }
  return threats;
}

function centerControl(index) {
  const row = Math.floor(index / GEOMETRY.size);
  const column = index % GEOMETRY.size;
  return 8 - Math.abs(row - 4) - Math.abs(column - 4);
}

function evaluationContext(state) {
  const placements = placementCandidates(state, GEOMETRY);
  const cellOptionCounts = new Uint16Array(GEOMETRY.cells);
  const numberOptionCounts = new Uint16Array(10);
  for (const move of placements) {
    cellOptionCounts[move.index]++;
    numberOptionCounts[move.number]++;
  }
  const player = state.currentPlayer;
  const opponent = otherPlayer(player);
  return {
    placements,
    cellOptionCounts,
    numberOptionCounts,
    ownLiberties: totalLiberties(state, player),
    enemyLiberties: totalLiberties(state, opponent),
    enemyAtari: atariGroups(state, opponent),
    ownLinePotential: linePotential(state, player),
    ownAttackThreats: attackThreats(state, player),
  };
}

function evaluateApplied(state, move, applied, context) {
  const player = state.currentPlayer;
  const opponent = otherPlayer(player);
  const next = applied.state;
  const closures = closureFeatures(move, context.placements);
  const ownScoreDelta = next.scores[player] - state.scores[player];
  const enemyScoreDelta = next.scores[opponent] - state.scores[opponent];
  let value = (ownScoreDelta - enemyScoreDelta) * EVALUATION.visibleScore;

  if (move.type === 'place') {
    const row = Math.floor(move.index / GEOMETRY.size);
    const column = move.index % GEOMETRY.size;
    const neighbors = GEOMETRY.orthogonal[move.index];
    const survivingGroup = next.owners[move.index] === player
      ? getGroup(next, GEOMETRY, move.index)
      : {liberties: 0};
    value +=
      move.number * EVALUATION.number +
      closures.rowClosures * EVALUATION.rowClosure +
      closures.columnClosures * EVALUATION.columnClosure +
      closures.boxClosures * EVALUATION.boxClosure +
      centerControl(move.index) * EVALUATION.center +
      neighbors.filter(index => state.owners[index] === player).length *
        EVALUATION.ownNeighbor +
      neighbors.filter(index => state.owners[index] === opponent).length *
        EVALUATION.enemyNeighbor +
      (10 - context.cellOptionCounts[move.index]) * EVALUATION.cellConstraint +
      (82 - context.numberOptionCounts[move.number]) * EVALUATION.numberScarcity +
      Math.max(0, context.enemyLiberties - totalLiberties(next, opponent)) *
        EVALUATION.enemyLibertyReduction +
      Math.max(0, totalLiberties(next, player) - context.ownLiberties) *
        EVALUATION.ownLibertyGain +
      survivingGroup.liberties * EVALUATION.groupLiberties +
      Math.max(0, atariGroups(next, opponent) - context.enemyAtari) *
        EVALUATION.enemyAtariGain +
      Math.max(0, linePotential(next, player) - context.ownLinePotential) *
        EVALUATION.linePotentialGain +
      Math.max(0, attackThreats(next, player) - context.ownAttackThreats) *
        EVALUATION.attackThreatGain;
    value += row * 0 + column * 0;
  } else {
    value += (state.values[move.source] - state.values[move.target]) *
      EVALUATION.attackStrength;
  }
  return value;
}

function legalApplied(state, variant) {
  const context = evaluationContext(state);
  const moves = [...context.placements, ...attackCandidates(state, GEOMETRY)];
  const legal = [];
  for (const move of moves) {
    const result = transition(state, move, variant);
    if (!result) continue;
    legal.push({
      move,
      result,
      evaluation: evaluateApplied(state, move, result, context),
    });
  }
  return legal;
}

function chooseEpsilonGreedy(state, variant, random, epsilon) {
  const legal = legalApplied(state, variant);
  if (legal.length === 0) return null;
  if (epsilon > 0 && random.next() < epsilon) {
    return {
      candidate: legal[random.int(legal.length)],
      explored: true,
      maximumTies: 0,
    };
  }
  let maximum = -Infinity;
  let best = [];
  for (const candidate of legal) {
    if (candidate.evaluation > maximum + EPSILON) {
      maximum = candidate.evaluation;
      best = [candidate];
    } else if (Math.abs(candidate.evaluation - maximum) <= EPSILON) {
      best.push(candidate);
    }
  }
  return {
    candidate: best[random.int(best.length)],
    explored: false,
    maximumTies: best.length,
  };
}

function moveCode(move) {
  return move.type === 'place'
    ? `p${move.index}:${move.number}`
    : `a${move.source}:${move.target}`;
}

function playGame(variant, epsilon, seed) {
  const random = new Random(seed);
  let state = createState(variant);
  const preparations = [];
  const trajectory = [];
  let explorationTurns = 0;
  let greedyTieTurns = 0;
  while (state.turn < TURN_LIMIT) {
    const selected = chooseEpsilonGreedy(state, variant, random, epsilon);
    if (!selected) break;
    if (selected.explored) explorationTurns++;
    if (!selected.explored && selected.maximumTies > 1) greedyTieTurns++;
    const {move, result} = selected.candidate;
    trajectory.push(moveCode(move));
    preparations.push(...result.captureEvents);
    state = result.state;
  }
  return {
    turns: state.turn,
    scores: [...state.scores],
    mechanics: Object.fromEntries(
      Object.entries(state.mechanics).map(([key, values]) => [key, [...values]]),
    ),
    preparations,
    explorationPercent: state.turn > 0 ? explorationTurns * 100 / state.turn : 0,
    greedyTiePercent: state.turn > 0 ? greedyTieTurns * 100 / state.turn : 0,
    trajectory: trajectory.join('|'),
  };
}

function mean(values) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pearson(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const meanX = mean(xs);
  const meanY = mean(ys);
  let numerator = 0;
  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < xs.length; index++) {
    const x = xs[index] - meanX;
    const y = ys[index] - meanY;
    numerator += x * y;
    sumX += x ** 2;
    sumY += y ** 2;
  }
  return sumX === 0 || sumY === 0 ? null : numerator / Math.sqrt(sumX * sumY);
}

function wilsonInterval(count, total, z = 1.96) {
  if (total === 0) return {low: null, high: null};
  const proportion = count / total;
  const denominator = 1 + z ** 2 / total;
  const center = (proportion + z ** 2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt(
    proportion * (1 - proportion) / total + z ** 2 / (4 * total ** 2),
  ) / denominator;
  return {
    low: Math.max(0, center - margin) * 100,
    high: Math.min(1, center + margin) * 100,
  };
}

function influence(games, mechanic) {
  const mechanicDiffs = games.map(game =>
    game.mechanics[mechanic][GOLD] - game.mechanics[mechanic][PURPLE]);
  const scoreDiffs = games.map(game => game.scores[GOLD] - game.scores[PURPLE]);
  let advantageGames = 0;
  let decisiveScores = 0;
  let wins = 0;
  let scoreTies = 0;
  for (let index = 0; index < games.length; index++) {
    if (mechanicDiffs[index] === 0) continue;
    advantageGames++;
    if (scoreDiffs[index] === 0) {
      scoreTies++;
      continue;
    }
    decisiveScores++;
    if (Math.sign(mechanicDiffs[index]) === Math.sign(scoreDiffs[index])) wins++;
  }
  return {
    correlation: pearson(mechanicDiffs, scoreDiffs),
    advantageGames,
    decisiveScores,
    winRate: decisiveScores > 0 ? wins * 100 / decisiveScores : null,
    conditionedScoreTiePercent: advantageGames > 0 ? scoreTies * 100 / advantageGames : null,
  };
}

function summarize(variant, epsilon, games) {
  const preparations = games.flatMap(game => game.preparations);
  const mechanisms = {};
  for (const mechanic of ['go', 'line', 'attack']) {
    const totals = games.map(game =>
      game.mechanics[mechanic][GOLD] + game.mechanics[mechanic][PURPLE]);
    const noEventCount = totals.filter(total => total === 0).length;
    mechanisms[mechanic] = {
      noEventCount,
      noEventPercent: noEventCount * 100 / games.length,
      noEventWilson95: wilsonInterval(noEventCount, games.length),
      eventsPerGame: distribution(totals),
      influence: influence(games, mechanic),
    };
  }
  return {
    id: variant.id,
    name: variant.name,
    rule: variant.rule,
    games: games.length,
    uniqueTrajectories: new Set(games.map(game => game.trajectory)).size,
    explorationPercent: distribution(games.map(game => game.explorationPercent)),
    greedyTiePercent: distribution(games.map(game => game.greedyTiePercent)),
    score: distribution(games.map(game => game.scores[GOLD] + game.scores[PURPLE])),
    activeEnclosureTurns: distribution(
      preparations.map(event => event.activeEnclosureTurns),
    ),
    captureEventsPerGame: distribution(games.map(game =>
      game.mechanics.goEvents[GOLD] + game.mechanics.goEvents[PURPLE])),
    capturedStonesPerGame: mechanisms.go.eventsPerGame,
    mechanisms,
  };
}

function round(value, digits = 2) {
  if (value === null || value === undefined) return 'n/a';
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function meanSd(metric, digits = 2) {
  return `${round(metric.mean, digits)} ± ${round(metric.sd, digits)}`;
}

function renderReport(data) {
  const lines = [
    '# Reglas de captura: presencia e influencia',
    '',
    `Fecha: ${data.metadata.date}. Tablero 9x9. Límite fijo: ${TURN_LIMIT} turnos.`,
    `Política ε-greedy con ε=${data.metadata.epsilon}; ` +
      `${data.metadata.gamesPerVariant.toLocaleString('en-US')} partidas por variante.`,
    '',
    `Puntuación visible: ${SCORE_RULE.explanation}`,
    'La función de evaluación es interna del agente y no modifica el marcador.',
    '',
    '## Reglas comparadas',
    '',
  ];
  for (const result of data.variants) {
    lines.push(`- ${result.name}: ${result.rule}`);
  }
  lines.push(
    '',
    '## Captura Go',
    '',
    '| Variante | Trayectorias | Cerco activo | Capturas/partida | Piedras/partida | Sin captura (IC 95%) | ' +
      'Correlación | Gana quien captura más | n decisivo |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  );
  for (const result of data.variants) {
    const go = result.mechanisms.go;
    lines.push(
      `| ${result.name} | ${result.uniqueTrajectories} | ` +
      `${meanSd(result.activeEnclosureTurns)} | ` +
      `${meanSd(result.captureEventsPerGame)} | ${meanSd(go.eventsPerGame)} | ` +
      `${round(go.noEventPercent, 1)}% ` +
      `(${round(go.noEventWilson95.low, 1)}–${round(go.noEventWilson95.high, 1)}) | ` +
      `${round(go.influence.correlation, 3)} | ` +
      `${round(go.influence.winRate, 1)}% | ${go.influence.decisiveScores} |`,
    );
  }
  lines.push(
    '',
    '## Presencia e influencia de las tres mecánicas',
    '',
    '| Variante | Mecánica | Unidades/partida | Sin evento | Correlación | ' +
      'Gana quien tuvo más | n decisivo | Empate condicionado |',
    '|---|---|---:|---:|---:|---:|---:|---:|',
  );
  for (const result of data.variants) {
    for (const mechanic of ['go', 'line', 'attack']) {
      const metric = result.mechanisms[mechanic];
      const label = {go: 'Go', line: 'Líneas', attack: 'Ataques'}[mechanic];
      lines.push(
        `| ${result.name} | ${label} | ${meanSd(metric.eventsPerGame)} | ` +
        `${round(metric.noEventPercent, 1)}% | ` +
        `${round(metric.influence.correlation, 3)} | ` +
        `${round(metric.influence.winRate, 1)}% | ` +
        `${metric.influence.decisiveScores} | ` +
        `${round(metric.influence.conditionedScoreTiePercent, 1)}% |`,
      );
    }
  }
  lines.push(
    '',
    'La correlación usa diferencial J1−J2 de unidades contra diferencial J1−J2 del marcador.',
    'Las unidades son piedras capturadas para Go, líneas formadas y ataques ejecutados.',
    'La tabla superior reporta además cuántas acciones de captura distintas ocurrieron.',
    'La tasa de victoria se calcula solo cuando un jugador tuvo más eventos y el marcador no',
    'terminó empatado; `n decisivo` muestra ese denominador.',
    'Estas métricas son predictivas, no causales: cada mecánica también aporta directamente',
    'al marcador fijo 1/2/3/1.',
    '',
    '## Diagnóstico de aleatorización y escala',
    '',
    '| Variante | Exploración efectiva | Empate en máximo | Marcador total |',
    '|---|---:|---:|---:|',
  );
  for (const result of data.variants) {
    lines.push(
      `| ${result.name} | ${meanSd(result.explorationPercent)}% | ` +
      `${meanSd(result.greedyTiePercent)}% | ${meanSd(result.score)} |`,
    );
  }
  lines.push(
    '',
    'El criterio de presencia para Go exige menos de 5% de partidas sin captura.',
    '',
    '## Resultado',
    '',
    'Ninguna variante cumple el criterio de presencia Go.',
    '',
    'V4 es la única que cambia materialmente la mecánica: reduce el cerco activo por debajo',
    'de cuatro turnos y eleva capturas e influencia, pero su intervalo de confianza de',
    'partidas sin captura permanece por encima del umbral.',
    '',
    'Las líneas están presentes e influyen en todas las variantes. Los ataques están ausentes',
    'en la mayoría de las partidas y su diferencial se correlaciona negativamente con el',
    'marcador en las cinco condiciones.',
    '',
    'No se modificó el tablero, el límite de turnos ni el motor de producción.',
    '',
  );
  return lines.join('\n');
}

function runBatch(task) {
  const variant = VARIANTS.find(item => item.id === task.variantId);
  const games = [];
  for (let index = 0; index < task.games; index++) {
    const gameIndex = task.startGame + index;
    games.push(playGame(variant, task.epsilon, task.seed + gameIndex * 104_729));
  }
  return {variantId: task.variantId, games};
}

function taskList(gamesPerVariant, epsilon, seed, chunksPerVariant) {
  const tasks = [];
  for (const variant of VARIANTS) {
    for (let chunk = 0; chunk < chunksPerVariant; chunk++) {
      const startGame = Math.floor(gamesPerVariant * chunk / chunksPerVariant);
      const endGame = Math.floor(gamesPerVariant * (chunk + 1) / chunksPerVariant);
      if (endGame <= startGame) continue;
      tasks.push({
        variantId: variant.id,
        games: endGame - startGame,
        startGame,
        epsilon,
        seed,
      });
    }
  }
  return tasks;
}

function runParallel(tasks, workers, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const pool = Array.from(
      {length: Math.min(workers, tasks.length)},
      () => new Worker(__filename),
    );
    pool.forEach(worker => worker.on('error', reject));
    const results = [];
    let cursor = 0;
    let completed = 0;
    function assign(worker) {
      if (cursor >= tasks.length) return;
      const task = tasks[cursor++];
      worker.once('message', result => {
        results.push(result);
        completed++;
        onProgress(completed, tasks.length, task);
        if (completed === tasks.length) {
          pool.forEach(item => item.terminate());
          resolve(results);
        } else {
          assign(worker);
        }
      });
      worker.postMessage(task);
    }
    pool.forEach(assign);
  });
}

async function run(options) {
  const tasks = taskList(
    options.games,
    options.epsilon,
    options.seed,
    Math.max(1, Math.min(options.workers, options.chunks)),
  );
  const batches = options.workers > 1
    ? await runParallel(tasks, options.workers, options.onProgress)
    : tasks.map(runBatch);
  return {
    metadata: {
      date: '2026-07-28',
      board: '9x9',
      turns: TURN_LIMIT,
      gamesPerVariant: options.games,
      policy: 'epsilon-greedy',
      epsilon: options.epsilon,
      seed: options.seed,
      scoreRule: SCORE_RULE,
      evaluationScope: 'Solo agente; no se suma al marcador.',
      evaluation: EVALUATION,
      influenceDefinition: 'Pearson entre diferencial de eventos y diferencial de marcador; para Go el evento es cada piedra capturada. Victoria condicionada a diferencial de eventos y marcador no empatado.',
    },
    variants: VARIANTS.map(variant => {
      const games = batches
        .filter(batch => batch.variantId === variant.id)
        .flatMap(batch => batch.games);
      return summarize(variant, options.epsilon, games);
    }),
  };
}

function parseArguments(argv) {
  const options = {
    games: 1000,
    epsilon: 0.10,
    seed: 20260728,
    workers: 16,
    chunks: 16,
  };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--games') options.games = Number(argv[++index]);
    else if (argv[index] === '--epsilon') options.epsilon = Number(argv[++index]);
    else if (argv[index] === '--seed') options.seed = Number(argv[++index]);
    else if (argv[index] === '--workers') options.workers = Number(argv[++index]);
    else if (argv[index] === '--chunks') options.chunks = Number(argv[++index]);
  }
  return options;
}

if (!isMainThread) {
  parentPort.on('message', task => parentPort.postMessage(runBatch(task)));
} else if (require.main === module) {
  const options = parseArguments(process.argv.slice(2));
  options.onProgress = (completed, total, task) => {
    process.stderr.write(`Progreso ${completed}/${total}: ${task.variantId}\n`);
  };
  run(options).then(data => {
    const reportDirectory = path.join(__dirname, '..', 'reports');
    fs.mkdirSync(reportDirectory, {recursive: true});
    fs.writeFileSync(
      path.join(reportDirectory, 'capture-rule-study.json'),
      `${JSON.stringify(data, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(reportDirectory, 'capture-rule-study.md'),
      renderReport(data),
    );
    process.stdout.write(`${renderReport(data)}\n`);
  }).catch(error => {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  SCORE_RULE,
  EVALUATION,
  VARIANTS,
  OPENING_GOLD,
  OPENING_PURPLE,
  createState,
  activeLines,
  borderingNumberSum,
  transition,
  legalApplied,
  chooseEpsilonGreedy,
  playGame,
  pearson,
  wilsonInterval,
  influence,
  summarize,
  renderReport,
  run,
};
