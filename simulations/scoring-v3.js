'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {Worker, isMainThread, parentPort} = require('node:worker_threads');
const {
  EMPTY,
  GOLD,
  PURPLE,
  EPSILON,
  TERMINATIONS,
  Random,
  otherPlayer,
  getNeighbors,
  getGroup,
  BOX_LINES,
  createState,
  placementCandidates,
  attackCandidates,
  applyMove: applyBaseMove,
} = require('./phase2-3.js');

const TERMINATION = TERMINATIONS.find(item => item.id === 'limite-30');
const TIE_RULES = [
  {id: 'aleatorio', name: 'Aleatorio'},
  {id: 'libertades', name: 'Libertades enemigas'},
  {id: 'lineas', name: 'Potencial de línea'},
];

const SCHEMES = [
  {
    id: 'actual',
    name: 'Control actual',
    go: 2,
    line: 3,
    place: () => 1,
    attack: () => 1,
    formula: 'Colocar 1; Go 2; línea 3; ataque 1.',
  },
  {
    id: 'numero',
    name: 'Valor del número',
    go: 12,
    line: 10,
    place: features => features.number,
    attack: features => 2 + features.strengthDifference,
    formula: 'Colocar = número; Go 12; línea 10; ataque = 2 + diferencia.',
  },
  {
    id: 'cierres',
    name: 'Cierres Sudoku',
    go: 15,
    line: 12,
    place: features => features.number +
      features.rowClosures * 0.5 +
      features.columnClosures * 0.75 +
      features.boxClosures,
    attack: features => 3 + features.strengthDifference * 1.5,
    formula: 'Colocar = número + .5 fila + .75 columna + caja; Go 15; ' +
      'línea 12; ataque = 3 + 1.5 × diferencia.',
  },
  {
    id: 'posicional',
    name: 'Control posicional',
    go: 15,
    line: 12,
    place: features => features.number +
      features.rowClosures * 0.5 +
      features.columnClosures * 0.75 +
      features.boxClosures +
      features.libertyReduction * 2 +
      features.linePotentialGain * 3,
    attack: features => 3 + features.strengthDifference * 1.5,
    formula: 'Cierres Sudoku + 2 × libertades reducidas + 3 × potencial de línea; ' +
      'Go 15; línea 12; ataque = 3 + 1.5 × diferencia.',
  },
  {
    id: 'eventos',
    name: 'Solo eventos',
    go: 10,
    line: 8,
    place: () => 0,
    attack: features => 2 + features.strengthDifference,
    formula: 'Colocar 0; Go 10; línea 8; ataque = 2 + diferencia.',
  },
  makeMultidimensionalScheme('multi-base', 'Multidimensional base', {}),
  makeMultidimensionalScheme(
    'multi-gp1-l10-a84',
    'Presión Go 1, línea 10, ataque 8+4d',
    {goPressure: 1, atari: 20, line: 10},
  ),
  makeMultidimensionalScheme(
    'multi-gp1-l30-a84',
    'Presión Go 1, línea 30, ataque 8+4d',
    {goPressure: 1, atari: 20, line: 30},
  ),
  makeMultidimensionalScheme(
    'multi-gp1-l30-d16',
    'Presión Go 1, línea 30, defensa .16',
    {goPressure: 1, atari: 20, line: 30, enemyLineReduction: 0.16},
  ),
  makeMultidimensionalScheme(
    'multi-gp1-l30-d17',
    'Presión Go 1, línea 30, defensa .17',
    {goPressure: 1, atari: 20, line: 30, enemyLineReduction: 0.17},
  ),
];

function makeMultidimensionalScheme(id, name, overrides) {
  const weights = {
    enemyLineReduction: 0,
    ownNeighbors: 0.79,
    enemyNeighbors: 0.83,
    cellConstraint: 0.89,
    numberScarcity: 0.097,
    go: 40,
    line: 30,
    atari: 0,
    goPressure: 0.53,
    goSafety: 0.61,
    groupLibertiesBonus: 0.73,
    linePotentialBonus: 0.59,
    attackThreatBonus: 0.67,
    attackBase: 8,
    attackDiff: 4,
    ...overrides,
  };
  return {
    id,
    name,
    go: weights.go,
    line: weights.line,
    atari: weights.atari,
    goPressure: weights.goPressure,
    goSafety: weights.goSafety,
    groupLibertiesBonus: weights.groupLibertiesBonus,
    linePotentialBonus: weights.linePotentialBonus,
    lineDefenseBonus: weights.enemyLineReduction,
    attackThreatBonus: weights.attackThreatBonus,
    place: features => multidimensionalPlace(features, weights),
    attack: features => weights.attackBase +
      features.strengthDifference * weights.attackDiff,
    formula: `Multidimensional: presión Go ${weights.goPressure}; ` +
      `seguridad ${weights.goSafety}; grupo ${weights.groupLibertiesBonus}; ` +
      `potencial ${weights.linePotentialBonus}; defensa ${weights.enemyLineReduction}; ` +
      `atari ${weights.atari}; Go ${weights.go}; ` +
      `línea ${weights.line}; ataque = ${weights.attackBase} + ` +
      `${weights.attackDiff} × diferencia.`,
  };
}

function multidimensionalPlace(features, weights) {
  return features.number * 0.37 +
    features.rowClosures * 0.41 +
    features.columnClosures * 0.43 +
    features.boxClosures * 0.47 +
    features.centerControl * 0.71 +
    features.ownNeighbors * weights.ownNeighbors +
    features.enemyNeighbors * weights.enemyNeighbors +
    features.cellConstraint * weights.cellConstraint +
    features.numberScarcity * weights.numberScarcity +
    features.enemyLineReduction * weights.enemyLineReduction;
}

function linePotential(state, player) {
  let threats = 0;
  let openLines = 0;
  for (const lines of BOX_LINES) {
    for (const line of lines) {
      let own = 0;
      let enemy = 0;
      let open = 0;
      for (const index of line) {
        if (state.owners[index] === player) own++;
        else if (state.owners[index] === EMPTY && !state.blocked[index]) open++;
        else enemy++;
      }
      if (enemy === 0 && own === 2 && open === 1) threats++;
      else if (enemy === 0 && own === 1 && open === 2) openLines++;
    }
  }
  return threats * 2 + openLines;
}

function enemyLiberties(state, player) {
  const enemy = otherPlayer(player);
  const visited = new Uint8Array(81);
  let liberties = 0;
  for (let index = 0; index < 81; index++) {
    if (visited[index] || state.owners[index] !== enemy) continue;
    const group = getGroup(state.owners, state.blocked, index);
    group.cells.forEach(cell => {
      visited[cell] = 1;
    });
    liberties += group.liberties;
  }
  return liberties;
}

function ownLiberties(state, player) {
  const visited = new Uint8Array(81);
  let liberties = 0;
  for (let index = 0; index < 81; index++) {
    if (visited[index] || state.owners[index] !== player) continue;
    const group = getGroup(state.owners, state.blocked, index);
    group.cells.forEach(cell => {
      visited[cell] = 1;
    });
    liberties += group.liberties;
  }
  return liberties;
}

function atariGroups(state, player) {
  const visited = new Uint8Array(81);
  let groups = 0;
  for (let index = 0; index < 81; index++) {
    if (visited[index] || state.owners[index] !== player) continue;
    const group = getGroup(state.owners, state.blocked, index);
    group.cells.forEach(cell => {
      visited[cell] = 1;
    });
    if (group.liberties === 1) groups++;
  }
  return groups;
}

function attackThreats(state, player, source, number) {
  const row = Math.floor(source / 9);
  const column = source % 9;
  let threats = 0;
  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      const targetRow = row + rowOffset;
      const targetColumn = column + columnOffset;
      if (targetRow < 0 || targetRow > 8 || targetColumn < 0 || targetColumn > 8) continue;
      const target = targetRow * 9 + targetColumn;
      if (state.owners[target] !== EMPTY &&
          state.owners[target] !== player &&
          number > state.values[target]) threats++;
    }
  }
  return threats;
}

function closureFeatures(state, move, placements) {
  if (move.type !== 'place') {
    return {rowClosures: 0, columnClosures: 0, boxClosures: 0};
  }
  const row = Math.floor(move.index / 9);
  const column = move.index % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
  let rowClosures = 0;
  let columnClosures = 0;
  let boxClosures = 0;
  for (const candidate of placements) {
    if (candidate.number !== move.number || candidate.index === move.index) continue;
    const candidateRow = Math.floor(candidate.index / 9);
    const candidateColumn = candidate.index % 9;
    const candidateBox = Math.floor(candidateRow / 3) * 3 + Math.floor(candidateColumn / 3);
    if (candidateRow === row) rowClosures++;
    if (candidateColumn === column) columnClosures++;
    if (candidateBox === box) boxClosures++;
  }
  return {rowClosures, columnClosures, boxClosures};
}

function applyScoredMove(state, move, scheme, context = null) {
  const baseScoring = {
    place: 0,
    go: scheme.go,
    line: scheme.line,
    attack: {mode: 'none', value: 0},
  };
  const result = applyBaseMove(state, move, TERMINATION, baseScoring);
  if (!result) return null;
  const player = state.currentPlayer;
  const placements = context?.placements || placementCandidates(state);
  const closures = closureFeatures(state, move, placements);
  const beforeLiberties = context?.enemyLiberties ?? enemyLiberties(state, player);
  const beforeLines = context?.linePotential ?? linePotential(state, player);
  const beforeEnemyLines = context?.enemyLinePotential ??
    linePotential(state, otherPlayer(player));
  const beforeOwnLiberties = context?.ownLiberties ?? ownLiberties(state, player);
  const beforeEnemyAtari = context?.enemyAtari ??
    atariGroups(state, otherPlayer(player));
  const row = move.type === 'place' ? Math.floor(move.index / 9) : 0;
  const column = move.type === 'place' ? move.index % 9 : 0;
  const neighbors = move.type === 'place' ? getNeighbors(move.index) : [];
  const features = {
    number: move.type === 'place' ? move.number : 0,
    strengthDifference: move.type === 'attack'
      ? state.values[move.source] - state.values[move.target]
      : 0,
    ...closures,
    libertyReduction: Math.max(0, beforeLiberties - enemyLiberties(result.state, player)),
    linePotentialGain: Math.max(0, linePotential(result.state, player) - beforeLines),
    enemyLineReduction: Math.max(
      0,
      beforeEnemyLines - linePotential(result.state, otherPlayer(player)),
    ),
    ownLibertyGain: Math.max(0, ownLiberties(result.state, player) - beforeOwnLiberties),
    atariGain: Math.max(
      0,
      atariGroups(result.state, otherPlayer(player)) - beforeEnemyAtari,
    ),
    attackThreats: move.type === 'place'
      ? attackThreats(result.state, player, move.index, move.number)
      : 0,
    centerControl: move.type === 'place'
      ? 8 - Math.abs(row - 4) - Math.abs(column - 4)
      : 0,
    groupLiberties: move.type === 'place'
      ? getGroup(result.state.owners, result.state.blocked, move.index).liberties
      : 0,
    ownNeighbors: neighbors.filter(index => state.owners[index] === player).length,
    enemyNeighbors: neighbors.filter(index =>
      state.owners[index] === otherPlayer(player)).length,
    cellConstraint: move.type === 'place'
      ? 10 - (context?.cellOptionCounts?.[move.index] || 0)
      : 0,
    numberScarcity: move.type === 'place'
      ? 82 - (context?.numberOptionCounts?.[move.number] || 0)
      : 0,
  };
  const source = move.type === 'place' ? 'place' : 'attack';
  const points = scheme[source](features);
  const goPositionPoints = move.type === 'place'
    ? (scheme.goPressure || 0) * features.libertyReduction +
      (scheme.goSafety || 0) * features.ownLibertyGain +
      (scheme.groupLibertiesBonus || 0) * features.groupLiberties +
      (scheme.atari || 0) * features.atariGain
    : 0;
  const linePositionPoints = move.type === 'place'
    ? (scheme.linePotentialBonus || 0) * features.linePotentialGain +
      (scheme.lineDefenseBonus || 0) * features.enemyLineReduction
    : 0;
  const attackPositionPoints = move.type === 'place'
    ? (scheme.attackThreatBonus || 0) * features.attackThreats
    : 0;
  const positionalPoints = goPositionPoints + linePositionPoints + attackPositionPoints;
  result.state.scores[player] += points + positionalPoints;
  result.state.breakdown[source] += Math.abs(points);
  result.state.breakdown.go += Math.abs(goPositionPoints);
  result.state.breakdown.line += Math.abs(linePositionPoints);
  result.state.breakdown.attack += Math.abs(attackPositionPoints);
  return {...result, features, immediateValue: points + positionalPoints +
    result.captured * scheme.go + result.lines * scheme.line};
}

function legalApplied(state, scheme) {
  const placements = placementCandidates(state);
  const cellOptionCounts = new Uint8Array(81);
  const numberOptionCounts = new Uint8Array(10);
  for (const move of placements) {
    cellOptionCounts[move.index]++;
    numberOptionCounts[move.number]++;
  }
  const context = {
    placements,
    enemyLiberties: enemyLiberties(state, state.currentPlayer),
    linePotential: linePotential(state, state.currentPlayer),
    enemyLinePotential: linePotential(state, otherPlayer(state.currentPlayer)),
    ownLiberties: ownLiberties(state, state.currentPlayer),
    enemyAtari: atariGroups(state, otherPlayer(state.currentPlayer)),
    cellOptionCounts,
    numberOptionCounts,
  };
  const moves = [...placements, ...attackCandidates(state)];
  const legal = [];
  for (const move of moves) {
    const result = applyScoredMove(state, move, scheme, context);
    if (result) legal.push({move, result});
  }
  return legal;
}

function valueKey(value) {
  return String(Math.round(value * 1_000_000));
}

function discrimination(legal) {
  const frequencies = new Map();
  let best = -Infinity;
  for (const candidate of legal) {
    const value = candidate.result.immediateValue;
    const key = valueKey(value);
    frequencies.set(key, (frequencies.get(key) || 0) + 1);
    best = Math.max(best, value);
  }
  let uniqueMoves = 0;
  let bestTies = 0;
  for (const candidate of legal) {
    if (frequencies.get(valueKey(candidate.result.immediateValue)) === 1) uniqueMoves++;
    if (Math.abs(candidate.result.immediateValue - best) <= EPSILON) bestTies++;
  }
  return {
    uniqueMovePercent: legal.length > 0 ? uniqueMoves * 100 / legal.length : 0,
    distinctValuePercent: legal.length > 0 ? frequencies.size * 100 / legal.length : 0,
    bestTiePercent: legal.length > 0 ? bestTies * 100 / legal.length : 0,
  };
}

function chooseGreedy(state, scheme, tieRule, random) {
  const legal = legalApplied(state, scheme);
  if (legal.length === 0) return null;
  let bestValue = -Infinity;
  let tied = [];
  for (const candidate of legal) {
    const value = candidate.result.immediateValue;
    if (value > bestValue + EPSILON) {
      bestValue = value;
      tied = [candidate];
    } else if (Math.abs(value - bestValue) <= EPSILON) {
      tied.push(candidate);
    }
  }
  if (tieRule === 'libertades') {
    const best = Math.max(...tied.map(candidate => candidate.result.features.libertyReduction));
    tied = tied.filter(candidate => candidate.result.features.libertyReduction === best);
  } else if (tieRule === 'lineas') {
    const best = Math.max(...tied.map(candidate => candidate.result.features.linePotentialGain));
    tied = tied.filter(candidate => candidate.result.features.linePotentialGain === best);
  }
  return {selected: tied[random.int(tied.length)], diagnostics: discrimination(legal)};
}

function playGame(scheme, tieRule, random) {
  let state = createState();
  const trajectory = [];
  const diagnostics = {
    turns: 0,
    uniqueMovePercent: 0,
    distinctValuePercent: 0,
    bestTiePercent: 0,
  };
  while (state.turn < TERMINATION.target) {
    const choice = chooseGreedy(state, scheme, tieRule, random);
    if (!choice) break;
    const move = choice.selected.move;
    trajectory.push(move.type === 'place'
      ? `p${move.index}:${move.number}`
      : `a${move.source}:${move.target}`);
    state = choice.selected.result.state;
    diagnostics.turns++;
    diagnostics.uniqueMovePercent += choice.diagnostics.uniqueMovePercent;
    diagnostics.distinctValuePercent += choice.diagnostics.distinctValuePercent;
    diagnostics.bestTiePercent += choice.diagnostics.bestTiePercent;
  }
  let winner = EMPTY;
  if (state.scores[GOLD] > state.scores[PURPLE] + EPSILON) winner = GOLD;
  else if (state.scores[PURPLE] > state.scores[GOLD] + EPSILON) winner = PURPLE;
  return {
    winner,
    scores: [state.scores[GOLD], state.scores[PURPLE]],
    margin: Math.abs(state.scores[GOLD] - state.scores[PURPLE]),
    breakdown: state.breakdown,
    turns: state.turn,
    diagnostics,
    trajectory: trajectory.join('|'),
  };
}

function wilsonInterval(wins, total, z = 1.96) {
  if (total === 0) return {low: 0, high: 1};
  const proportion = wins / total;
  const denominator = 1 + z ** 2 / total;
  const center = (proportion + z ** 2 / (2 * total)) / denominator;
  const spread = z * Math.sqrt(
    proportion * (1 - proportion) / total + z ** 2 / (4 * total ** 2),
  ) / denominator;
  return {low: center - spread, high: center + spread};
}

function runCombination(scheme, tieRule, games, seed) {
  const random = new Random(seed);
  const totals = {
    breakdown: {place: 0, go: 0, line: 0, attack: 0},
    firstWins: 0,
    secondWins: 0,
    draws: 0,
    decisiveMargin: 0,
    decisiveImpact: 0,
    decisiveGames: 0,
    diagnosticTurns: 0,
    uniqueMovePercent: 0,
    distinctValuePercent: 0,
    bestTiePercent: 0,
    scoreDifferences: [],
    trajectories: new Set(),
  };
  for (let game = 0; game < games; game++) {
    const played = playGame(scheme, tieRule, random);
    totals.scoreDifferences.push(played.scores[0] - played.scores[1]);
    totals.trajectories.add(played.trajectory);
    if (played.winner === GOLD) totals.firstWins++;
    else if (played.winner === PURPLE) totals.secondWins++;
    else totals.draws++;
    if (played.winner !== EMPTY) {
      totals.decisiveGames++;
      totals.decisiveMargin += played.margin;
      totals.decisiveImpact += Object.values(played.breakdown)
        .reduce((sum, value) => sum + value, 0);
    }
    for (const source of Object.keys(totals.breakdown)) {
      totals.breakdown[source] += played.breakdown[source];
    }
    totals.diagnosticTurns += played.diagnostics.turns;
    totals.uniqueMovePercent += played.diagnostics.uniqueMovePercent;
    totals.distinctValuePercent += played.diagnostics.distinctValuePercent;
    totals.bestTiePercent += played.diagnostics.bestTiePercent;
  }
  const totalImpact = Object.values(totals.breakdown).reduce((sum, value) => sum + value, 0);
  const decisive = totals.firstWins + totals.secondWins;
  const interval = wilsonInterval(totals.firstWins, decisive);
  return {
    id: `${scheme.id}__${tieRule}`,
    scheme: scheme.id,
    schemeName: scheme.name,
    tieRule,
    tieRuleName: TIE_RULES.find(item => item.id === tieRule).name,
    games,
    shares: Object.fromEntries(Object.entries(totals.breakdown)
      .map(([source, value]) => [source, totalImpact > 0 ? value * 100 / totalImpact : 0])),
    drawPercent: totals.draws * 100 / games,
    firstWinPercent: totals.firstWins * 100 / games,
    secondWinPercent: totals.secondWins * 100 / games,
    decisiveFirstPercent: decisive > 0 ? totals.firstWins * 100 / decisive : 50,
    decisiveFirstWilson95: {low: interval.low * 100, high: interval.high * 100},
    systematicFirstAdvantage: decisive > 0 && (interval.low > 0.5 || interval.high < 0.5),
    meanMargin: totals.decisiveGames > 0
      ? totals.decisiveMargin / totals.decisiveGames
      : 0,
    normalizedMargin: totals.decisiveImpact > 0
      ? totals.decisiveMargin / totals.decisiveImpact
      : 0,
    uniqueMovePercent: totals.diagnosticTurns > 0
      ? totals.uniqueMovePercent / totals.diagnosticTurns
      : 0,
    distinctValuePercent: totals.diagnosticTurns > 0
      ? totals.distinctValuePercent / totals.diagnosticTurns
      : 0,
    bestTiePercent: totals.diagnosticTurns > 0
      ? totals.bestTiePercent / totals.diagnosticTurns
      : 0,
    distinctTrajectories: totals.trajectories.size,
    scoreDifferences: totals.scoreDifferences,
  };
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function calibrateKomi(rows) {
  const calibration = [];
  for (const row of rows) {
    const split = Math.max(1, Math.floor(row.scoreDifferences.length / 2));
    calibration.push(...row.scoreDifferences.slice(0, split));
  }
  const secondPlayerKomi = median(calibration);
  const aggregate = {firstWins: 0, secondWins: 0, draws: 0, games: 0};
  for (const row of rows) {
    const split = Math.max(1, Math.floor(row.scoreDifferences.length / 2));
    const validation = row.scoreDifferences.slice(split);
    const sample = validation.length > 0 ? validation : row.scoreDifferences;
    const counts = {firstWins: 0, secondWins: 0, draws: 0};
    for (const difference of sample) {
      const adjusted = difference - secondPlayerKomi;
      if (adjusted > EPSILON) counts.firstWins++;
      else if (adjusted < -EPSILON) counts.secondWins++;
      else counts.draws++;
    }
    row.secondPlayerKomi = secondPlayerKomi;
    row.postKomiFirstWinPercent = counts.firstWins * 100 / sample.length;
    row.postKomiSecondWinPercent = counts.secondWins * 100 / sample.length;
    row.postKomiDrawPercent = counts.draws * 100 / sample.length;
    aggregate.firstWins += counts.firstWins;
    aggregate.secondWins += counts.secondWins;
    aggregate.draws += counts.draws;
    aggregate.games += sample.length;
  }
  return {
    secondPlayerKomi,
    calibrationGames: calibration.length,
    validationGames: aggregate.games,
    postKomiFirstWinPercent: aggregate.firstWins * 100 / aggregate.games,
    postKomiSecondWinPercent: aggregate.secondWins * 100 / aggregate.games,
    postKomiDrawPercent: aggregate.draws * 100 / aggregate.games,
  };
}

function assessScheme(scheme, rows) {
  const ranges = {};
  for (const source of ['place', 'go', 'line', 'attack']) {
    const values = rows.map(row => row.shares[source]);
    ranges[source] = Math.max(...values) - Math.min(...values);
  }
  const minUniqueMovePercent = Math.min(...rows.map(row => row.uniqueMovePercent));
  const minDistinctValuePercent = Math.min(...rows.map(row => row.distinctValuePercent));
  const maxPointVariation = Math.max(...Object.values(ranges));
  const attacksValid = rows.every(row => row.shares.attack >= 10 && row.shares.attack <= 25);
  const allMechanicsPresent = rows.every(row =>
    Object.values(row.shares).every(share => share >= 5));
  const komi = calibrateKomi(rows);
  return {
    scheme: scheme.id,
    schemeName: scheme.name,
    formula: scheme.formula,
    minUniqueMovePercent,
    minDistinctValuePercent,
    maxPointVariation,
    ranges,
    discriminates: minUniqueMovePercent >= 20,
    attacksValid,
    allMechanicsPresent,
    robust: maxPointVariation <= 10,
    firstAdvantage: rows.some(row => row.systematicFirstAdvantage),
    preKomiFinalist: minUniqueMovePercent >= 20 &&
      attacksValid &&
      allMechanicsPresent &&
      maxPointVariation <= 10,
    implementationReady: false,
    komi,
  };
}

function assemble(results, games, seed) {
  const assessments = SCHEMES.map(scheme =>
    assessScheme(scheme, results.filter(row => row.scheme === scheme.id)));
  return {
    metadata: {
      date: '2026-07-27',
      gamesPerTieRule: games,
      seed,
      termination: TERMINATION.id,
      uniqueDefinition: 'Jugadas cuyo valor inmediato aparece una sola vez en el turno.',
      distinctDefinition: 'Valores inmediatos distintos dividido entre jugadas legales.',
    },
    schemes: SCHEMES.map(({place, attack, ...scheme}) => scheme),
    tieRules: TIE_RULES,
    results,
    assessments,
  };
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function renderReport(data) {
  const lines = [
    '# Puntuación v3: discriminación y robustez',
    '',
    `Fecha: ${data.metadata.date}. Terminación fija: límite de 30 turnos.`,
    `Partidas por esquema y desempate: ${data.metadata.gamesPerTieRule.toLocaleString('en-US')}.`,
    `Total: ${(data.metadata.gamesPerTieRule * SCHEMES.length * TIE_RULES.length)
      .toLocaleString('en-US')} partidas. Semilla: ${data.metadata.seed}.`,
    '',
    `“Jugadas únicas”: ${data.metadata.uniqueDefinition}`,
    `“Valores distintos”: ${data.metadata.distinctDefinition}`,
    'El filtro obligatorio usa la definición estricta de jugada única y exige un mínimo',
    'de 20% en los tres desempates. Ataques debe representar 10%–25%; la variación',
    'máxima del reparto entre desempates no puede exceder 10 puntos porcentuales.',
    '',
    '## Resultados por desempate',
    '',
    '| Esquema | Desempate | Únicas | Distintas | Empate en máximo | Colocar | Go | ' +
      'Líneas | Ataques | Empates | J1 | J2 | Trayectorias |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const row of data.results) {
    lines.push(
      `| ${row.schemeName} | ${row.tieRuleName} | ${round(row.uniqueMovePercent)}% | ` +
      `${round(row.distinctValuePercent)}% | ${round(row.bestTiePercent)}% | ` +
      `${round(row.shares.place)}% | ${round(row.shares.go)}% | ` +
      `${round(row.shares.line)}% | ${round(row.shares.attack)}% | ` +
      `${round(row.drawPercent)}% | ${round(row.firstWinPercent)}% | ` +
      `${round(row.secondWinPercent)}% | ${row.distinctTrajectories} |`,
    );
  }
  lines.push(
    '',
    '## Filtro por esquema',
    '',
    '| Esquema | Mín. únicas | Mín. distintas | Variación máxima | Ataques 10–25 | ' +
      '4 mecanismos ≥5 | Robusto | Ventaja inicial | Pre-finalista |',
    '|---|---:|---:|---:|---|---|---|---|---|',
  );
  for (const row of data.assessments) {
    lines.push(
      `| ${row.schemeName} | ${round(row.minUniqueMovePercent)}% | ` +
      `${round(row.minDistinctValuePercent)}% | ${round(row.maxPointVariation)} pp | ` +
      `${row.attacksValid ? 'Sí' : 'No'} | ${row.allMechanicsPresent ? 'Sí' : 'No'} | ` +
      `${row.robust ? 'Sí' : 'No'} | ${row.firstAdvantage ? 'Sí' : 'No'} | ` +
      `${row.preKomiFinalist ? 'Sí' : 'No'} |`,
    );
  }
  lines.push(
    '',
    '## Komi calibrado y validado',
    '',
    'La primera mitad de cada corrida calibra el komi del segundo jugador; la segunda',
    'mitad lo valida. Un resultado de 100% empates con muy pocas trayectorias efectivas',
    'es un ajuste exacto de un proceso casi determinista, no evidencia de equilibrio robusto.',
    'Komi positivo bonifica a J2; negativo equivale a bonificar a J1.',
    '',
    '| Esquema | Komi J2 | Validación J1 | Validación J2 | Empates |',
    '|---|---:|---:|---:|---:|',
  );
  for (const row of data.assessments) {
    lines.push(
      `| ${row.schemeName} | ${round(row.komi.secondPlayerKomi, 3)} | ` +
      `${round(row.komi.postKomiFirstWinPercent)}% | ` +
      `${round(row.komi.postKomiSecondWinPercent)}% | ` +
      `${round(row.komi.postKomiDrawPercent)}% |`,
    );
  }
  if (data.depth) {
    const depthBreakdown = {place: 0, go: 0, line: 0, attack: 0};
    for (const game of data.depth.games) {
      for (const source of Object.keys(depthBreakdown)) {
        depthBreakdown[source] += game.breakdown[source];
      }
    }
    const depthTotal = Object.values(depthBreakdown).reduce((sum, value) => sum + value, 0);
    const depthShares = Object.fromEntries(Object.entries(depthBreakdown)
      .map(([source, value]) => [source, value * 100 / depthTotal]));
    const nodes = data.depth.games.reduce(
      (sum, game) => sum + game.diagnostics.nodes,
      0,
    );
    lines.push(
      '',
      '## Profundidad con 12 candidatos por nodo',
      '',
      `D3 ganó los dos juegos pareados contra D2 cambiando de color ` +
        `(${round(data.depth.depth3WinPercent)}% en una muestra n=2); ` +
        `se evaluaron ${nodes.toLocaleString('en-US')} nodos. El ancho observado fue ` +
        `${Math.min(...data.depth.games.map(game => game.diagnostics.minBranch))}–` +
        `${Math.max(...data.depth.games.map(game => game.diagnostics.maxBranch))}, ` +
        'incluyendo empates en el corte.',
      '',
      '| Colocar | Go | Líneas | Ataques |',
      '|---:|---:|---:|---:|',
      `| ${round(depthShares.place)}% | ${round(depthShares.go)}% | ` +
        `${round(depthShares.line)}% | ${round(depthShares.attack)}% |`,
      '',
      'D3 se separa de D2 en este pareo; se retira la conclusión anterior de empate.',
      'La muestra no basta para estimar una tasa general de victoria, pero sí demuestra que',
      'el resultado D2≈D3 con ancho 2 no era estable al ampliar candidatos.',
      'Sin embargo, los ataques caen por debajo de 10%, por lo que el esquema no conserva',
      'la mezcla mecánica bajo búsqueda y no queda listo para implementación.',
    );
  }
  lines.push(
    '',
    '## Sensibilidad de la defensa',
    '',
    'La calibración exploratoria probó pesos defensivos 0.10–0.20 en incrementos de 0.01.',
    'Entre 0.10 y 0.16 se conservó la misma ruta: J1 ganó 100% por 540.22 puntos.',
    'En 0.17 la estrategia saltó a otra ruta: J2 ganó 100% por 198.063 puntos, las',
    'jugadas estrictamente únicas bajaron a 1.3% y ataques subieron a 28.5%.',
    'No apareció una zona intermedia estable; promediar ambos regímenes ocultaría el corte.',
  );
  lines.push('', '## Fórmulas probadas', '');
  for (const scheme of data.schemes) lines.push(`- ${scheme.name}: ${scheme.formula}`);
  lines.push('', '## Resultado', '');
  const finalists = data.assessments.filter(row => row.preKomiFinalist);
  lines.push(
    `Pre-finalistas de puntuación: ${finalists.length > 0
      ? finalists.map(row => row.schemeName).join(', ')
      : 'ninguno'}.`,
  );
  lines.push('Ningún esquema queda listo para implementación: la ventaja de salida es');
  lines.push('determinista y la prueba D3 reduce ataques por debajo del mínimo de 10%.');
  lines.push('No se modificó el motor del juego.', '');
  return lines.join('\n');
}

function taskList(games, seed) {
  const tasks = [];
  for (let schemeIndex = 0; schemeIndex < SCHEMES.length; schemeIndex++) {
    for (let tieIndex = 0; tieIndex < TIE_RULES.length; tieIndex++) {
      tasks.push({
        schemeIndex,
        tieIndex,
        games,
        seed: seed + schemeIndex * 100_003 + tieIndex * 7_919,
      });
    }
  }
  return tasks;
}

function runTask(task) {
  return runCombination(
    SCHEMES[task.schemeIndex],
    TIE_RULES[task.tieIndex].id,
    task.games,
    task.seed,
  );
}

function runParallel(tasks, workerCount, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const workers = Array.from({length: Math.min(workerCount, tasks.length)}, () =>
      new Worker(__filename));
    const results = [];
    let cursor = 0;
    let finished = 0;
    function assign(worker) {
      if (cursor >= tasks.length) return;
      const task = tasks[cursor++];
      worker.once('message', result => {
        results.push(result);
        finished++;
        onProgress(finished, tasks.length, result);
        assign(worker);
        if (finished === tasks.length) {
          workers.forEach(item => item.terminate());
          resolve(results);
        }
      });
      worker.once('error', reject);
      worker.postMessage(task);
    }
    workers.forEach(assign);
  });
}

async function run(options) {
  const tasks = taskList(options.games, options.seed);
  const results = options.workers > 1
    ? await runParallel(tasks, options.workers, options.onProgress)
    : tasks.map(runTask);
  results.sort((left, right) => left.scheme.localeCompare(right.scheme) ||
    left.tieRule.localeCompare(right.tieRule));
  const data = assemble(results, options.games, options.seed);
  const depthPath = path.join(__dirname, '..', 'reports', 'profundidad-v3.json');
  if (fs.existsSync(depthPath)) data.depth = JSON.parse(fs.readFileSync(depthPath, 'utf8'));
  return data;
}

function parseArguments(argv) {
  const options = {games: 1000, seed: 20260727, workers: 8};
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--games') options.games = Number(argv[++index]);
    else if (argv[index] === '--seed') options.seed = Number(argv[++index]);
    else if (argv[index] === '--workers') options.workers = Number(argv[++index]);
  }
  return options;
}

if (!isMainThread) {
  parentPort.on('message', task => parentPort.postMessage(runTask(task)));
} else if (require.main === module) {
  const options = parseArguments(process.argv.slice(2));
  options.onProgress = (finished, total, result) => {
    process.stderr.write(`Progreso ${finished}/${total}: ${result.id}\n`);
  };
  run(options).then(data => {
    const reportDirectory = path.join(__dirname, '..', 'reports');
    fs.mkdirSync(reportDirectory, {recursive: true});
    fs.writeFileSync(
      path.join(reportDirectory, 'puntuacion-v3.json'),
      `${JSON.stringify(data, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(reportDirectory, 'puntuacion-v3.md'),
      renderReport(data),
    );
    process.stdout.write(`${renderReport(data)}\n`);
  }).catch(error => {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  SCHEMES,
  TIE_RULES,
  linePotential,
  enemyLiberties,
  closureFeatures,
  applyScoredMove,
  legalApplied,
  discrimination,
  chooseGreedy,
  playGame,
  runCombination,
  assessScheme,
  assemble,
  renderReport,
  taskList,
  runTask,
  run,
};
