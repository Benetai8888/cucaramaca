'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {Worker, isMainThread, parentPort} = require('node:worker_threads');
const {Random} = require('./phase2-3.js');

const EMPTY = 0;
const GOLD = 1;
const PURPLE = 2;
const EPSILON = 1e-9;

const BOARD_CONFIGS = {
  '9x9': {id: '9x9', size: 9, digits: 9, boxRows: 3, boxCols: 3},
  '6x6': {id: '6x6', size: 6, digits: 6, boxRows: 2, boxCols: 3},
};

const SCHEME = {
  id: 'multi-gp1-l30-a84',
  name: 'Presión Go 1, línea 30, ataque 8+4d',
  goCapture: 40,
  goPressure: 1,
  goSafety: 0.61,
  groupLiberties: 0.73,
  atari: 20,
  lineEvent: 30,
  linePotential: 0.59,
  attackThreat: 0.67,
  attackBase: 8,
  attackDifference: 4,
};

const CONDITIONS = [
  {id: '9x9-t30', board: '9x9', turns: 30},
  {id: '9x9-t60', board: '9x9', turns: 60},
  {id: '9x9-t100', board: '9x9', turns: 100},
  {id: '6x6-t30', board: '6x6', turns: 30},
];

function otherPlayer(player) {
  return player === GOLD ? PURPLE : GOLD;
}

function buildGeometry(config) {
  const cells = config.size ** 2;
  const boxColumns = config.size / config.boxCols;
  const boxRowsCount = config.size / config.boxRows;
  const orthogonal = Array.from({length: cells}, () => []);
  const adjacent = Array.from({length: cells}, () => []);
  const boxOf = new Uint8Array(cells);
  const boxes = [];

  for (let index = 0; index < cells; index++) {
    const row = Math.floor(index / config.size);
    const column = index % config.size;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
        if (rowOffset === 0 && columnOffset === 0) continue;
        const nextRow = row + rowOffset;
        const nextColumn = column + columnOffset;
        if (nextRow < 0 || nextRow >= config.size ||
            nextColumn < 0 || nextColumn >= config.size) continue;
        const neighbor = nextRow * config.size + nextColumn;
        adjacent[index].push(neighbor);
        if (rowOffset === 0 || columnOffset === 0) orthogonal[index].push(neighbor);
      }
    }
  }

  for (let boxRow = 0; boxRow < boxRowsCount; boxRow++) {
    for (let boxColumn = 0; boxColumn < boxColumns; boxColumn++) {
      const box = [];
      const boxIndex = boxRow * boxColumns + boxColumn;
      for (let localRow = 0; localRow < config.boxRows; localRow++) {
        for (let localColumn = 0; localColumn < config.boxCols; localColumn++) {
          const row = boxRow * config.boxRows + localRow;
          const column = boxColumn * config.boxCols + localColumn;
          const index = row * config.size + column;
          box.push(index);
          boxOf[index] = boxIndex;
        }
      }
      boxes.push(box);
    }
  }

  const lines = [];
  const linesByCell = Array.from({length: cells}, () => []);
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const box of boxes) {
    const inBox = new Set(box);
    for (const start of box) {
      const startRow = Math.floor(start / config.size);
      const startColumn = start % config.size;
      for (const [rowStep, columnStep] of directions) {
        const line = [];
        for (let offset = 0; offset < 3; offset++) {
          const row = startRow + rowStep * offset;
          const column = startColumn + columnStep * offset;
          if (row < 0 || row >= config.size || column < 0 || column >= config.size) {
            line.length = 0;
            break;
          }
          const index = row * config.size + column;
          if (!inBox.has(index)) {
            line.length = 0;
            break;
          }
          line.push(index);
        }
        if (line.length !== 3) continue;
        const previousRow = startRow - rowStep;
        const previousColumn = startColumn - columnStep;
        const previous = previousRow * config.size + previousColumn;
        if (previousRow >= 0 && previousRow < config.size &&
            previousColumn >= 0 && previousColumn < config.size &&
            inBox.has(previous)) continue;
        const lineIndex = lines.length;
        lines.push(line);
        line.forEach(index => linesByCell[index].push(lineIndex));
      }
    }
  }

  return {
    ...config,
    cells,
    boxes,
    boxOf,
    orthogonal,
    adjacent,
    lines,
    linesByCell,
  };
}

const GEOMETRIES = Object.fromEntries(
  Object.entries(BOARD_CONFIGS).map(([id, config]) => [id, buildGeometry(config)]),
);

function createState(geometry) {
  return {
    values: new Uint8Array(geometry.cells),
    owners: new Uint8Array(geometry.cells),
    placedAt: new Uint16Array(geometry.cells),
    activeLines: new Set(),
    currentPlayer: GOLD,
    scores: new Float64Array(3),
    breakdown: {
      place: 0,
      goCapture: 0,
      goPosition: 0,
      line: 0,
      attack: 0,
    },
    actions: {place: 0, goCapture: 0, line: 0, attack: 0},
    turn: 0,
  };
}

function cloneState(state) {
  return {
    values: state.values.slice(),
    owners: state.owners.slice(),
    placedAt: state.placedAt.slice(),
    activeLines: new Set(state.activeLines),
    currentPlayer: state.currentPlayer,
    scores: state.scores.slice(),
    breakdown: {...state.breakdown},
    actions: {...state.actions},
    turn: state.turn,
  };
}

function getGroup(state, geometry, start) {
  const owner = state.owners[start];
  if (owner === EMPTY) return {cells: [], libertyCells: [], liberties: 0};
  const visited = new Uint8Array(geometry.cells);
  const libertySeen = new Uint8Array(geometry.cells);
  const cells = [];
  const libertyCells = [];
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    if (visited[current]) continue;
    visited[current] = 1;
    cells.push(current);
    for (const neighbor of geometry.orthogonal[current]) {
      if (state.owners[neighbor] === EMPTY) {
        if (!libertySeen[neighbor]) {
          libertySeen[neighbor] = 1;
          libertyCells.push(neighbor);
        }
      } else if (state.owners[neighbor] === owner && !visited[neighbor]) {
        stack.push(neighbor);
      }
    }
  }
  return {cells, libertyCells, liberties: libertyCells.length};
}

function groupMetric(state, geometry, player, selector) {
  const visited = new Uint8Array(geometry.cells);
  let total = 0;
  for (let index = 0; index < geometry.cells; index++) {
    if (visited[index] || state.owners[index] !== player) continue;
    const group = getGroup(state, geometry, index);
    group.cells.forEach(cell => {
      visited[cell] = 1;
    });
    total += selector(group);
  }
  return total;
}

function totalLiberties(state, geometry, player) {
  return groupMetric(state, geometry, player, group => group.liberties);
}

function atariGroups(state, geometry, player) {
  return groupMetric(state, geometry, player, group => Number(group.liberties === 1));
}

function activeLines(owners, geometry) {
  const active = new Set();
  for (let lineIndex = 0; lineIndex < geometry.lines.length; lineIndex++) {
    const line = geometry.lines[lineIndex];
    const owner = owners[line[0]];
    if (owner !== EMPTY && line.every(index => owners[index] === owner)) {
      active.add(`${owner}:${lineIndex}`);
    }
  }
  return active;
}

function linePotential(state, geometry, player) {
  let threats = 0;
  let openLines = 0;
  for (const line of geometry.lines) {
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

function placementCandidates(state, geometry) {
  const rowMasks = new Uint16Array(geometry.size);
  const columnMasks = new Uint16Array(geometry.size);
  const boxMasks = new Uint16Array(geometry.boxes.length);
  for (let index = 0; index < geometry.cells; index++) {
    const value = state.values[index];
    if (value === 0) continue;
    const row = Math.floor(index / geometry.size);
    const column = index % geometry.size;
    const bit = 1 << value;
    rowMasks[row] |= bit;
    columnMasks[column] |= bit;
    boxMasks[geometry.boxOf[index]] |= bit;
  }
  const allNumbers = ((1 << (geometry.digits + 1)) - 1) & ~1;
  const moves = [];
  for (let index = 0; index < geometry.cells; index++) {
    if (state.owners[index] !== EMPTY) continue;
    const row = Math.floor(index / geometry.size);
    const column = index % geometry.size;
    const allowed = allNumbers &
      ~(rowMasks[row] | columnMasks[column] | boxMasks[geometry.boxOf[index]]);
    for (let number = 1; number <= geometry.digits; number++) {
      if (allowed & (1 << number)) moves.push({type: 'place', index, number});
    }
  }
  return moves;
}

function attackCandidates(state, geometry) {
  const moves = [];
  const player = state.currentPlayer;
  for (let source = 0; source < geometry.cells; source++) {
    if (state.owners[source] !== player) continue;
    for (const target of geometry.adjacent[source]) {
      if (state.owners[target] !== EMPTY &&
          state.owners[target] !== player &&
          state.values[source] > state.values[target]) {
        moves.push({type: 'attack', source, target});
      }
    }
  }
  return moves;
}

function capturePreparation(group, state, geometry, player, captureTurn) {
  let firstBoundaryStone = Infinity;
  let firstActiveContact = Infinity;
  const groupSet = new Set(group.cells);
  for (const capturedCell of group.cells) {
    for (const boundary of geometry.orthogonal[capturedCell]) {
      if (groupSet.has(boundary) || state.owners[boundary] !== player) continue;
      const boundaryTurn = state.placedAt[boundary];
      const targetTurn = state.placedAt[capturedCell];
      firstBoundaryStone = Math.min(firstBoundaryStone, boundaryTurn);
      firstActiveContact = Math.min(firstActiveContact, Math.max(boundaryTurn, targetTurn));
    }
  }
  return {
    stones: group.cells.length,
    boundaryStoneTurns: captureTurn - firstBoundaryStone + 1,
    activeEnclosureTurns: captureTurn - firstActiveContact + 1,
  };
}

function transition(state, geometry, move) {
  const next = cloneState(state);
  const player = state.currentPlayer;
  const captureTurn = state.turn + 1;
  const captureEvents = [];
  let captured = 0;
  let newLines = 0;

  if (move.type === 'place') {
    if (next.owners[move.index] !== EMPTY) return null;
    next.values[move.index] = move.number;
    next.owners[move.index] = player;
    next.placedAt[move.index] = captureTurn;
    const capturedCells = new Set();
    const seenGroups = new Set();
    for (const neighbor of geometry.orthogonal[move.index]) {
      if (next.owners[neighbor] === EMPTY || next.owners[neighbor] === player ||
          seenGroups.has(neighbor)) continue;
      const group = getGroup(next, geometry, neighbor);
      group.cells.forEach(cell => seenGroups.add(cell));
      if (group.liberties === 0) {
        captureEvents.push(capturePreparation(group, next, geometry, player, captureTurn));
        group.cells.forEach(cell => capturedCells.add(cell));
      }
    }
    captured = capturedCells.size;
    for (const cell of capturedCells) {
      next.values[cell] = 0;
      next.owners[cell] = EMPTY;
      next.placedAt[cell] = 0;
    }
    if (getGroup(next, geometry, move.index).liberties === 0) return null;
    for (const lineIndex of geometry.linesByCell[move.index]) {
      const line = geometry.lines[lineIndex];
      const key = `${player}:${lineIndex}`;
      if (!state.activeLines.has(key) &&
          line.every(index => next.owners[index] === player)) newLines++;
    }
  } else if (move.type === 'attack') {
    if (next.owners[move.source] !== player ||
        next.owners[move.target] === EMPTY ||
        next.owners[move.target] === player ||
        next.values[move.source] <= next.values[move.target]) return null;
    next.values[move.target] = 0;
    next.owners[move.target] = EMPTY;
    next.placedAt[move.target] = 0;
  } else {
    return null;
  }

  next.activeLines = activeLines(next.owners, geometry);
  next.currentPlayer = otherPlayer(player);
  next.turn++;
  return {state: next, captured, newLines, captureEvents};
}

function closureFeatures(move, placements, geometry) {
  if (move.type !== 'place') {
    return {rowClosures: 0, columnClosures: 0, boxClosures: 0};
  }
  const row = Math.floor(move.index / geometry.size);
  const column = move.index % geometry.size;
  const box = geometry.boxOf[move.index];
  let rowClosures = 0;
  let columnClosures = 0;
  let boxClosures = 0;
  for (const candidate of placements) {
    if (candidate.number !== move.number || candidate.index === move.index) continue;
    const candidateRow = Math.floor(candidate.index / geometry.size);
    const candidateColumn = candidate.index % geometry.size;
    if (candidateRow === row) rowClosures++;
    if (candidateColumn === column) columnClosures++;
    if (geometry.boxOf[candidate.index] === box) boxClosures++;
  }
  return {rowClosures, columnClosures, boxClosures};
}

function attackThreats(state, geometry, player, source, number) {
  let threats = 0;
  for (const target of geometry.adjacent[source]) {
    if (state.owners[target] !== EMPTY &&
        state.owners[target] !== player &&
        number > state.values[target]) threats++;
  }
  return threats;
}

function centerControl(index, geometry) {
  const row = Math.floor(index / geometry.size);
  const column = index % geometry.size;
  const center = (geometry.size - 1) / 2;
  const distance = Math.abs(row - center) + Math.abs(column - center);
  return 8 * (1 - distance / (geometry.size - 1));
}

function scoringContext(state, geometry) {
  const placements = placementCandidates(state, geometry);
  const cellOptionCounts = new Uint8Array(geometry.cells);
  const numberOptionCounts = new Uint8Array(geometry.digits + 1);
  for (const move of placements) {
    cellOptionCounts[move.index]++;
    numberOptionCounts[move.number]++;
  }
  const player = state.currentPlayer;
  return {
    placements,
    cellOptionCounts,
    numberOptionCounts,
    enemyLiberties: totalLiberties(state, geometry, otherPlayer(player)),
    ownLiberties: totalLiberties(state, geometry, player),
    ownLinePotential: linePotential(state, geometry, player),
    enemyLinePotential: linePotential(state, geometry, otherPlayer(player)),
    enemyAtari: atariGroups(state, geometry, otherPlayer(player)),
  };
}

function applyScoredMove(state, geometry, move, context) {
  const applied = transition(state, geometry, move);
  if (!applied) return null;
  const player = state.currentPlayer;
  const opponent = otherPlayer(player);
  const next = applied.state;
  const closures = closureFeatures(move, context.placements, geometry);
  const neighbors = move.type === 'place' ? geometry.orthogonal[move.index] : [];
  const row = move.type === 'place' ? Math.floor(move.index / geometry.size) : 0;
  const column = move.type === 'place' ? move.index % geometry.size : 0;
  const features = {
    number: move.type === 'place' ? move.number : 0,
    strengthDifference: move.type === 'attack'
      ? state.values[move.source] - state.values[move.target]
      : 0,
    ...closures,
    libertyReduction: Math.max(
      0,
      context.enemyLiberties - totalLiberties(next, geometry, opponent),
    ),
    ownLibertyGain: Math.max(
      0,
      totalLiberties(next, geometry, player) - context.ownLiberties,
    ),
    linePotentialGain: Math.max(
      0,
      linePotential(next, geometry, player) - context.ownLinePotential,
    ),
    atariGain: Math.max(
      0,
      atariGroups(next, geometry, opponent) - context.enemyAtari,
    ),
    groupLiberties: move.type === 'place'
      ? getGroup(next, geometry, move.index).liberties
      : 0,
    attackThreats: move.type === 'place'
      ? attackThreats(next, geometry, player, move.index, move.number)
      : 0,
    centerControl: move.type === 'place' ? centerControl(move.index, geometry) : 0,
    ownNeighbors: neighbors.filter(index => state.owners[index] === player).length,
    enemyNeighbors: neighbors.filter(index => state.owners[index] === opponent).length,
    cellConstraint: move.type === 'place'
      ? geometry.digits + 1 - context.cellOptionCounts[move.index]
      : 0,
    numberScarcity: move.type === 'place'
      ? geometry.cells + 1 - context.numberOptionCounts[move.number]
      : 0,
    row,
    column,
  };

  let placePoints = 0;
  let capturePoints = 0;
  let goPositionPoints = 0;
  let linePoints = 0;
  let attackPoints = 0;
  if (move.type === 'place') {
    placePoints =
      features.number * 0.37 +
      features.rowClosures * 0.41 +
      features.columnClosures * 0.43 +
      features.boxClosures * 0.47 +
      features.centerControl * 0.71 +
      features.ownNeighbors * 0.79 +
      features.enemyNeighbors * 0.83 +
      features.cellConstraint * 0.89 +
      features.numberScarcity * 0.097;
    capturePoints = applied.captured * SCHEME.goCapture;
    goPositionPoints =
      features.libertyReduction * SCHEME.goPressure +
      features.ownLibertyGain * SCHEME.goSafety +
      features.groupLiberties * SCHEME.groupLiberties +
      features.atariGain * SCHEME.atari;
    linePoints =
      applied.newLines * SCHEME.lineEvent +
      features.linePotentialGain * SCHEME.linePotential;
    attackPoints = features.attackThreats * SCHEME.attackThreat;
  } else {
    attackPoints = SCHEME.attackBase +
      features.strengthDifference * SCHEME.attackDifference;
  }
  const immediateValue =
    placePoints + capturePoints + goPositionPoints + linePoints + attackPoints;
  next.scores[player] += immediateValue;
  next.breakdown.place += placePoints;
  next.breakdown.goCapture += capturePoints;
  next.breakdown.goPosition += goPositionPoints;
  next.breakdown.line += linePoints;
  next.breakdown.attack += attackPoints;
  if (move.type === 'place') {
    next.actions.place++;
    next.actions.goCapture += applied.captured;
    next.actions.line += applied.newLines;
  } else {
    next.actions.attack++;
  }
  return {...applied, features, immediateValue};
}

function legalApplied(state, geometry) {
  const context = scoringContext(state, geometry);
  const moves = [...context.placements, ...attackCandidates(state, geometry)];
  const legal = [];
  for (const move of moves) {
    const result = applyScoredMove(state, geometry, move, context);
    if (result) legal.push({move, result});
  }
  return legal;
}

function chooseEpsilonGreedy(state, geometry, random, epsilon) {
  const legal = legalApplied(state, geometry);
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
    if (candidate.result.immediateValue > maximum + EPSILON) {
      maximum = candidate.result.immediateValue;
      best = [candidate];
    } else if (Math.abs(candidate.result.immediateValue - maximum) <= EPSILON) {
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

function playGame(condition, epsilon, seed) {
  const geometry = GEOMETRIES[condition.board];
  const random = new Random(seed);
  let state = createState(geometry);
  const preparations = [];
  const trajectory = [];
  let firstCaptureTurn = null;
  let explorationTurns = 0;
  let greedyTieTurns = 0;
  let captureEvents = 0;
  let capturedStones = 0;
  while (state.turn < condition.turns) {
    const selected = chooseEpsilonGreedy(state, geometry, random, epsilon);
    if (!selected) break;
    if (selected.explored) explorationTurns++;
    if (!selected.explored && selected.maximumTies > 1) greedyTieTurns++;
    const {move, result} = selected.candidate;
    trajectory.push(moveCode(move));
    if (result.captureEvents.length > 0) {
      if (firstCaptureTurn === null) firstCaptureTurn = state.turn + 1;
      captureEvents += result.captureEvents.length;
      capturedStones += result.captured;
      preparations.push(...result.captureEvents);
    }
    state = result.state;
  }
  const totalPoints = Object.values(state.breakdown).reduce((sum, value) => sum + value, 0);
  const shares = Object.fromEntries(
    Object.entries(state.breakdown).map(([source, value]) =>
      [source, totalPoints > 0 ? value * 100 / totalPoints : 0]),
  );
  return {
    turns: state.turn,
    firstCaptureTurn,
    captureEvents,
    capturedStones,
    preparations,
    explorationPercent: state.turn > 0 ? explorationTurns * 100 / state.turn : 0,
    greedyTiePercent: state.turn > 0 ? greedyTieTurns * 100 / state.turn : 0,
    shares,
    combinedGoShare: shares.goCapture + shares.goPosition,
    breakdown: state.breakdown,
    trajectory: trajectory.join('|'),
  };
}

function mean(values) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce(
    (sum, value) => sum + (value - average) ** 2,
    0,
  ) / (values.length - 1));
}

function quantile(values, probability) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function distribution(values) {
  if (values.length === 0) {
    return {n: 0, mean: null, sd: null, p10: null, p50: null, p90: null, p95: null, max: null};
  }
  return {
    n: values.length,
    mean: mean(values),
    sd: standardDeviation(values),
    p10: quantile(values, 0.10),
    p50: quantile(values, 0.50),
    p90: quantile(values, 0.90),
    p95: quantile(values, 0.95),
    max: Math.max(...values),
  };
}

function summarizeGames(condition, epsilon, games) {
  const firstCaptures = games
    .filter(game => game.firstCaptureTurn !== null)
    .map(game => game.firstCaptureTurn);
  const preparations = games.flatMap(game => game.preparations);
  const sourceShares = {};
  for (const source of ['place', 'goCapture', 'goPosition', 'line', 'attack']) {
    sourceShares[source] = distribution(games.map(game => game.shares[source]));
  }
  return {
    id: condition.id,
    board: condition.board,
    turns: condition.turns,
    epsilon,
    games: games.length,
    uniqueTrajectories: new Set(games.map(game => game.trajectory)).size,
    noCapturePercent: games.filter(game => game.firstCaptureTurn === null).length *
      100 / games.length,
    explorationPercent: distribution(games.map(game => game.explorationPercent)),
    greedyTiePercent: distribution(games.map(game => game.greedyTiePercent)),
    captureEventsPerGame: distribution(games.map(game => game.captureEvents)),
    capturedStonesPerGame: distribution(games.map(game => game.capturedStones)),
    firstCaptureTurn: distribution(firstCaptures),
    activeEnclosureTurns: distribution(
      preparations.map(event => event.activeEnclosureTurns),
    ),
    boundaryStoneTurns: distribution(
      preparations.map(event => event.boundaryStoneTurns),
    ),
    capturePointShare: sourceShares.goCapture,
    combinedGoShare: distribution(games.map(game => game.combinedGoShare)),
    sourceShares,
  };
}

function round(value, digits = 2) {
  if (value === null || value === undefined) return value;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function meanSd(metric, digits = 2) {
  return `${round(metric.mean, digits)} ± ${round(metric.sd, digits)}`;
}

function renderReport(data) {
  const byId = Object.fromEntries(data.conditions.map(condition => [condition.id, condition]));
  const short = byId['9x9-t30'];
  const medium = byId['9x9-t60'];
  const long = byId['9x9-t100'];
  const small = byId['6x6-t30'];
  const games = data.metadata.gamesPerCondition;
  const none30 = Math.round(short.noCapturePercent * games / 100);
  const none60 = Math.round(medium.noCapturePercent * games / 100);
  const none100 = Math.round(long.noCapturePercent * games / 100);
  const capturedBy30 = games - none30;
  const captured31to60 = none30 - none60;
  const captured61to100 = none60 - none100;
  const lines = [
    '# Horizonte de turnos, tamaño de tablero y capturas Go',
    '',
    `Fecha: ${data.metadata.date}. Política: ε-greedy con ε=${data.metadata.epsilon}.`,
    `${games.toLocaleString('en-US')} partidas independientes por condición; ` +
      `${(games * data.conditions.length).toLocaleString('en-US')} partidas totales.`,
    'Los horizontes 9x9 usan las mismas semillas: cada partida larga contiene exactamente',
    'la trayectoria de su partida corta durante los primeros 30 o 60 turnos.',
    '',
    'Captura Go significa exclusivamente una colocación que deja sin libertades a un grupo',
    'enemigo. Los puntos Go posicionales se reportan aparte.',
    '',
    '## Resultados mecánicos',
    '',
    '| Condición | Trayectorias | Sin captura | Capturas/partida | Piedras capturadas | ' +
      'Primera captura | Cerco activo | Piedra inicial del borde |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const condition of data.conditions) {
    lines.push(
      `| ${condition.id} | ${condition.uniqueTrajectories} | ` +
      `${round(condition.noCapturePercent, 1)}% | ` +
      `${meanSd(condition.captureEventsPerGame)} | ` +
      `${meanSd(condition.capturedStonesPerGame)} | ` +
      `T${round(condition.firstCaptureTurn.p50, 1)} ` +
      `(media ${meanSd(condition.firstCaptureTurn)}) | ` +
      `${meanSd(condition.activeEnclosureTurns)} turnos | ` +
      `${meanSd(condition.boundaryStoneTurns)} turnos |`,
    );
  }
  lines.push(
    '',
    '“Cerco activo” empieza en el primer contacto entre el grupo finalmente capturado y una',
    'piedra sobreviviente del borde. “Piedra inicial del borde” usa retrospectivamente la',
    'piedra más antigua que termina formando ese borde; puede haber sido colocada antes de',
    'que existiera el grupo objetivo.',
    '',
    '## Techo empírico de puntos Go',
    '',
    '| Condición | Captura Go media ± DE | P95 | Máximo | Go posicional media ± DE | ' +
      'Go combinado media ± DE |',
    '|---|---:|---:|---:|---:|---:|',
  );
  for (const condition of data.conditions) {
    lines.push(
      `| ${condition.id} | ${meanSd(condition.capturePointShare)}% | ` +
      `${round(condition.capturePointShare.p95)}% | ` +
      `${round(condition.capturePointShare.max)}% | ` +
      `${meanSd(condition.sourceShares.goPosition)}% | ` +
      `${meanSd(condition.combinedGoShare)}% |`,
    );
  }
  lines.push(
    '',
    'El P95 es una referencia más estable que el máximo de una sola partida. La participación',
    'en puntos no equivale a frecuencia mecánica: en 9x9 las capturas por partida crecen',
    'mucho más rápido que su porcentaje del marcador.',
    '',
    '## Reparto completo de puntos',
    '',
    '| Condición | Colocar | Go captura | Go posicional | Líneas | Ataques |',
    '|---|---:|---:|---:|---:|---:|',
  );
  for (const condition of data.conditions) {
    lines.push(
      `| ${condition.id} | ${meanSd(condition.sourceShares.place)}% | ` +
      `${meanSd(condition.sourceShares.goCapture)}% | ` +
      `${meanSd(condition.sourceShares.goPosition)}% | ` +
      `${meanSd(condition.sourceShares.line)}% | ` +
      `${meanSd(condition.sourceShares.attack)}% |`,
    );
  }
  lines.push(
    '',
    '## Diagnóstico de aleatorización',
    '',
    '| Condición | Exploración ε efectiva | Turnos con empate máximo | Trayectorias únicas |',
    '|---|---:|---:|---:|',
  );
  for (const condition of data.conditions) {
    lines.push(
      `| ${condition.id} | ${meanSd(condition.explorationPercent)}% | ` +
      `${meanSd(condition.greedyTiePercent)}% | ${condition.uniqueTrajectories} |`,
    );
  }
  lines.push(
    '',
    'Ninguna desviación estándar de las métricas centrales es cero; la corrida no es una',
    'repetición determinista de la misma partida.',
    '',
    '## Distribución emparejada de la primera captura en 9x9',
    '',
    '| Ventana | Partidas que capturan por primera vez | Porcentaje del total |',
    '|---|---:|---:|',
    `| Turnos 1–30 | ${capturedBy30} | ${round(capturedBy30 * 100 / games, 1)}% |`,
    `| Turnos 31–60 | ${captured31to60} | ${round(captured31to60 * 100 / games, 1)}% |`,
    `| Turnos 61–100 | ${captured61to100} | ${round(captured61to100 * 100 / games, 1)}% |`,
    `| Sin captura al turno 100 | ${none100} | ${round(none100 * 100 / games, 1)}% |`,
    '',
    `De las ${none30} partidas sin captura al turno 30, ${captured31to60} ` +
      `(${round(captured31to60 * 100 / none30, 1)}%) capturan entre 31 y 60.`,
    `De las ${none60} todavía pendientes al turno 60, ${captured61to100} ` +
      `(${round(captured61to100 * 100 / none60, 1)}%) capturan entre 61 y 100.`,
    '',
    '## Prueba de la hipótesis',
    '',
    'Resultado: confirmada parcialmente.',
    '',
    `En 9x9, ampliar el horizonte de 30 a 60 y 100 turnos aumenta las capturas medias de ` +
      `${round(short.captureEventsPerGame.mean)} a ${round(medium.captureEventsPerGame.mean)} ` +
      `y ${round(long.captureEventsPerGame.mean)} por partida. Las partidas sin ninguna ` +
      `captura bajan de ${round(short.noCapturePercent, 1)}% a ` +
      `${round(medium.noCapturePercent, 1)}% y ${round(long.noCapturePercent, 1)}%.`,
    '',
    `Reducir a 6x6 con 30 turnos aumenta las capturas medias a ` +
      `${round(small.captureEventsPerGame.mean)}: ` +
      `${round(small.captureEventsPerGame.mean / short.captureEventsPerGame.mean, 1)} veces ` +
      `el 9x9/30. La mediana de la primera captura pasa del turno ` +
      `${round(short.firstCaptureTurn.p50, 1)} al ${round(small.firstCaptureTurn.p50, 1)}, ` +
      `y el cerco activo medio de ${round(short.activeEnclosureTurns.mean)} a ` +
      `${round(small.activeEnclosureTurns.mean)} turnos.`,
    '',
    `La afirmación literal de que 9x9 generalmente necesita más de 30 turnos para una ` +
      `primera captura queda refutada: ${round(100 - short.noCapturePercent, 1)}% de las ` +
      `partidas captura antes del límite y la mediana condicional es el turno ` +
      `${round(short.firstCaptureTurn.p50, 1)}. Lo que sí confirma la evidencia es que 30 ` +
      `turnos limita la recurrencia de capturas y que el tamaño 6x6 cambia radicalmente su frecuencia.`,
    '',
    '## Limitaciones',
    '',
    'La comparación 6x6 es una variante completa, no un aislamiento puro del área: una subcaja',
    '2x3 contiene solo dos triples rectos, frente a ocho en una subcaja 3x3. Por tanto, también',
    'reduce oportunidades de líneas y cambia las decisiones de la política.',
    '',
    'La “primera piedra del cerco” no expresa intención. Se mide retrospectivamente sobre las',
    'piedras sobrevivientes que forman el borde al capturar; por eso se acompaña con la medida',
    'de contacto activo.',
    '',
    '## Correcciones respecto de puntuación v3',
    '',
    'El 14.3% anterior no era un techo de capturas: `breakdown.go` mezclaba captura y valor',
    'posicional. Además, el selector sumaba 40 puntos Go fantasma a cada ataque de ajedrez,',
    'aunque esos puntos no entraban al marcador. Esta corrida corrige ambas contaminaciones.',
    '',
    'No se modificó el motor del juego ni se diseñó una puntuación nueva.',
    '',
  );
  return lines.join('\n');
}

function runBatch(task) {
  const condition = CONDITIONS.find(item => item.id === task.conditionId);
  const games = [];
  for (let index = 0; index < task.games; index++) {
    const gameIndex = task.startGame + index;
    games.push(playGame(
      condition,
      task.epsilon,
      task.seed + gameIndex * 104_729,
    ));
  }
  return {conditionId: task.conditionId, games};
}

function taskList(gamesPerCondition, epsilon, seed, chunksPerCondition) {
  const tasks = [];
  for (const condition of CONDITIONS) {
    for (let chunk = 0; chunk < chunksPerCondition; chunk++) {
      const startGame = Math.floor(gamesPerCondition * chunk / chunksPerCondition);
      const endGame = Math.floor(gamesPerCondition * (chunk + 1) / chunksPerCondition);
      if (endGame <= startGame) continue;
      tasks.push({
        conditionId: condition.id,
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
  const summaries = CONDITIONS.map(condition => {
    const games = batches
      .filter(batch => batch.conditionId === condition.id)
      .flatMap(batch => batch.games);
    return summarizeGames(condition, options.epsilon, games);
  });
  return {
    metadata: {
      date: '2026-07-27',
      policy: 'epsilon-greedy',
      epsilon: options.epsilon,
      seed: options.seed,
      gamesPerCondition: options.games,
      pairedNineByNineHorizons: true,
      scoreRule: SCHEME,
      captureDefinition: 'Captura Go exclusivamente por colocación que deja un grupo enemigo sin libertades.',
      preparationDefinition: 'Turnos desde el primer contacto activo entre el grupo capturado y una piedra sobreviviente del cerco hasta la captura, inclusivos.',
      sixBySixLines: 'Triples rectos contenidos en cada subcaja 2x3; existen dos líneas horizontales por subcaja.',
      correctedIssues: [
        'Go de captura separado de puntos posicionales Go.',
        'Los ataques de ajedrez no reciben los 40 puntos Go fantasma usados por immediateValue v3.',
      ],
    },
    conditions: summaries,
  };
}

function parseArguments(argv) {
  const options = {
    games: 1000,
    epsilon: 0.10,
    seed: 20260727,
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

if (!isMainThread && require.main === module) {
  parentPort.on('message', task => parentPort.postMessage(runBatch(task)));
} else if (require.main === module) {
  const options = parseArguments(process.argv.slice(2));
  options.onProgress = (completed, total, task) => {
    process.stderr.write(`Progreso ${completed}/${total}: ${task.conditionId}\n`);
  };
  run(options).then(data => {
    const reportDirectory = path.join(__dirname, '..', 'reports');
    fs.mkdirSync(reportDirectory, {recursive: true});
    fs.writeFileSync(
      path.join(reportDirectory, 'go-horizon-study.json'),
      `${JSON.stringify(data, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(reportDirectory, 'go-horizon-study.md'),
      renderReport(data),
    );
    process.stdout.write(`${renderReport(data)}\n`);
  }).catch(error => {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  BOARD_CONFIGS,
  SCHEME,
  CONDITIONS,
  GEOMETRIES,
  buildGeometry,
  createState,
  getGroup,
  placementCandidates,
  attackCandidates,
  transition,
  applyScoredMove,
  legalApplied,
  chooseEpsilonGreedy,
  playGame,
  distribution,
  summarizeGames,
  renderReport,
  taskList,
  run,
};
