'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  isMainThread,
  parentPort,
  Worker,
} = require('node:worker_threads');
const base = require('./phase2-3.js');

const {
  TERMINATIONS,
  SCORINGS,
  Random,
  createState,
  placementCandidates,
  attackCandidates,
  applyMove,
  summarize,
} = base;

const EMPTY = 0;
const GOLD = 1;
const PURPLE = 2;
const EPSILON = 1e-9;
const SEARCH_WIDTHS = {3: 4, 2: 4, 1: 4};
const POLICIES = ['A', 'B', 'C', 'D3'];

function otherPlayer(player) {
  return player === GOLD ? PURPLE : GOLD;
}

function boxLines(box) {
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

const ALL_BOX_LINES = Array.from({length: 9}, (_, box) => boxLines(box));

function orthogonalNeighbors(index) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const neighbors = [];
  if (row > 0) neighbors.push(index - 9);
  if (row < 8) neighbors.push(index + 9);
  if (col > 0) neighbors.push(index - 1);
  if (col < 8) neighbors.push(index + 1);
  return neighbors;
}

function groupInfo(state, start) {
  const owner = state.owners[start];
  if (owner === EMPTY) return {cells: [], liberties: 0};
  const visited = new Uint8Array(81);
  const libertySeen = new Uint8Array(81);
  const stack = [start];
  const cells = [];
  let liberties = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (visited[current]) continue;
    visited[current] = 1;
    cells.push(current);
    for (const neighbor of orthogonalNeighbors(current)) {
      if (state.owners[neighbor] === EMPTY && !state.blocked[neighbor]) {
        if (!libertySeen[neighbor]) {
          libertySeen[neighbor] = 1;
          liberties++;
        }
      } else if (state.owners[neighbor] === owner && !visited[neighbor]) {
        stack.push(neighbor);
      }
    }
  }
  return {cells, liberties};
}

function linePotential(state, player) {
  let threats = 0;
  let openLines = 0;
  for (const lines of ALL_BOX_LINES) {
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
  return {threats, openLines};
}

function libertyTotals(state, player) {
  const visited = new Uint8Array(81);
  let own = 0;
  let enemy = 0;
  for (let index = 0; index < 81; index++) {
    if (state.owners[index] === EMPTY || visited[index]) continue;
    const group = groupInfo(state, index);
    group.cells.forEach(cell => { visited[cell] = 1; });
    if (state.owners[index] === player) own += group.liberties;
    else enemy += group.liberties;
  }
  return {own, enemy};
}

function positionalValue(state, player) {
  const lines = linePotential(state, player);
  const liberties = libertyTotals(state, player);
  return lines.threats * 12 +
    lines.openLines * 2 +
    liberties.own * 0.15 -
    liberties.enemy * 0.5;
}

function scoreSwing(previous, next, player) {
  const opponent = otherPlayer(player);
  return (next.scores[player] - previous.scores[player]) -
    (next.scores[opponent] - previous.scores[opponent]);
}

function reachedTermination(state, termination) {
  if (termination.type === 'points') {
    return state.scores[GOLD] >= termination.target ||
      state.scores[PURPLE] >= termination.target;
  }
  if (termination.type === 'turns') return state.turn >= termination.target;
  return state.blockedCount >= termination.target;
}

function allLegalApplied(state, termination, scoring) {
  const moves = [...placementCandidates(state), ...attackCandidates(state)];
  const applied = [];
  for (const move of moves) {
    const result = applyMove(state, move, termination, scoring);
    if (result) applied.push({move, result});
  }
  return applied;
}

function chooseUniform(state, termination, scoring, random) {
  const candidates = [...placementCandidates(state), ...attackCandidates(state)];
  while (candidates.length > 0) {
    const selected = random.int(candidates.length);
    const move = candidates[selected];
    const result = applyMove(state, move, termination, scoring);
    if (result) return {move, result};
    candidates[selected] = candidates[candidates.length - 1];
    candidates.pop();
  }
  return null;
}

function compressedLegalApplied(state, termination, scoring) {
  const applied = [];
  for (const [index, numbers] of placementCells(state)) {
    const move = {type: 'place', index, number: numbers[numbers.length - 1]};
    const result = applyMove(state, move, termination, scoring);
    if (result) applied.push({move, result, numbers, weight: numbers.length});
  }
  for (const move of attackCandidates(state)) {
    const result = applyMove(state, move, termination, scoring);
    if (result) applied.push({move, result, weight: 1});
  }
  return applied;
}

function chooseWeighted(candidates, state, termination, scoring, random) {
  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let selectedWeight = random.int(totalWeight);
  let selected = candidates[0];
  for (const candidate of candidates) {
    if (selectedWeight < candidate.weight) {
      selected = candidate;
      break;
    }
    selectedWeight -= candidate.weight;
  }
  if (!selected.numbers) return selected;
  const move = {
    type: 'place',
    index: selected.move.index,
    number: selected.numbers[random.int(selected.numbers.length)],
  };
  return {move, result: applyMove(state, move, termination, scoring)};
}

function chooseGreedy(state, termination, scoring, random) {
  const legal = compressedLegalApplied(state, termination, scoring);
  if (legal.length === 0) return null;
  const player = state.currentPlayer;
  let best = -Infinity;
  const tied = [];
  for (const candidate of legal) {
    const value = scoreSwing(state, candidate.result.state, player);
    if (value > best + EPSILON) {
      best = value;
      tied.length = 0;
      tied.push(candidate);
    } else if (Math.abs(value - best) <= EPSILON) {
      tied.push(candidate);
    }
  }
  return chooseWeighted(tied, state, termination, scoring, random);
}

function choosePositionalGreedy(state, termination, scoring, random) {
  const legal = compressedLegalApplied(state, termination, scoring);
  if (legal.length === 0) return null;
  const player = state.currentPlayer;
  const before = positionalValue(state, player);
  let bestPoints = -Infinity;
  let bestPosition = -Infinity;
  const tied = [];
  for (const candidate of legal) {
    const points = scoreSwing(state, candidate.result.state, player);
    const position = positionalValue(candidate.result.state, player) - before;
    if (points > bestPoints + EPSILON ||
        (Math.abs(points - bestPoints) <= EPSILON && position > bestPosition + EPSILON)) {
      bestPoints = points;
      bestPosition = position;
      tied.length = 0;
      tied.push(candidate);
    } else if (Math.abs(points - bestPoints) <= EPSILON &&
        Math.abs(position - bestPosition) <= EPSILON) {
      tied.push(candidate);
    }
  }
  return chooseWeighted(tied, state, termination, scoring, random);
}

function placementCells(state) {
  const grouped = new Map();
  for (const move of placementCandidates(state)) {
    if (!grouped.has(move.index)) grouped.set(move.index, []);
    grouped.get(move.index).push(move.number);
  }
  return grouped;
}

function representativeNumbers(numbers) {
  if (numbers.length <= 2) return numbers;
  return [...new Set([
    numbers[0],
    numbers[Math.floor(numbers.length / 2)],
    numbers[numbers.length - 1],
  ])];
}

function localPlacementValue(previous, next, index, player) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  let value = 0;
  for (const line of ALL_BOX_LINES[box]) {
    if (!line.includes(index)) continue;
    const score = state => {
      let own = 0;
      let enemy = 0;
      let open = 0;
      for (const cell of line) {
        if (state.owners[cell] === player) own++;
        else if (state.owners[cell] === EMPTY && !state.blocked[cell]) open++;
        else enemy++;
      }
      if (enemy === 0 && own === 2 && open === 1) return 12;
      if (enemy === 0 && own === 1 && open === 2) return 2;
      return 0;
    };
    value += score(next) - score(previous);
  }

  const seen = new Set();
  for (const neighbor of orthogonalNeighbors(index)) {
    if (previous.owners[neighbor] === EMPTY ||
        previous.owners[neighbor] === player ||
        seen.has(neighbor)) continue;
    const before = groupInfo(previous, neighbor);
    before.cells.forEach(cell => seen.add(cell));
    const afterLiberties = next.owners[neighbor] === EMPTY
      ? 0
      : groupInfo(next, neighbor).liberties;
    value += (before.liberties - afterLiberties) * 0.5;
  }
  return value;
}

function portfolioCellValue(state, index, player) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  let tactical = false;
  let rank = 0;
  for (const line of ALL_BOX_LINES[box]) {
    if (!line.includes(index)) continue;
    let own = 0;
    let enemy = 0;
    for (const cell of line) {
      if (state.owners[cell] === player) own++;
      else if (state.owners[cell] !== EMPTY || state.blocked[cell]) enemy++;
    }
    if (enemy === 0 && own === 2) {
      tactical = true;
      rank += 240;
    } else if (enemy === 0 && own === 1) {
      rank += 24;
    } else if (enemy === 0) {
      rank += 3;
    }
  }

  const seenEnemy = new Set();
  for (const neighbor of orthogonalNeighbors(index)) {
    if (state.owners[neighbor] === otherPlayer(player) && !seenEnemy.has(neighbor)) {
      const group = groupInfo(state, neighbor);
      group.cells.forEach(cell => seenEnemy.add(cell));
      if (group.liberties === 1) {
        tactical = true;
        rank += 300 + group.cells.length * 20;
      } else if (group.liberties === 2) {
        rank += 35 + group.cells.length * 2;
      } else {
        rank += 4;
      }
    } else if (state.owners[neighbor] === player) {
      rank += 2;
    }
  }
  const centerDistance = Math.abs(row - 4) + Math.abs(col - 4);
  rank += (8 - centerDistance) * 0.05;
  return {tactical, rank};
}

function selectiveMoves(state, termination, scoring, width) {
  const player = state.currentPlayer;
  const beforePosition = positionalValue(state, player);
  const cellOptions = [];
  for (const [index, numbers] of placementCells(state)) {
    const portfolio = portfolioCellValue(state, index, player);
    cellOptions.push({
      index,
      numbers,
      tactical: portfolio.tactical,
      rank: portfolio.rank,
    });
  }
  cellOptions.sort((left, right) =>
    Number(right.tactical) - Number(left.tactical) || right.rank - left.rank);

  const expanded = [];
  const selectedCells = cellOptions.slice(0, Math.max(width * 2, 12));
  for (const option of selectedCells) {
    for (const number of representativeNumbers(option.numbers)) {
      expanded.push({type: 'place', index: option.index, number});
    }
  }
  expanded.push(...attackCandidates(state));

  const applied = [];
  for (const move of expanded) {
    const result = applyMove(state, move, termination, scoring);
    if (!result) continue;
    const immediate = scoreSwing(state, result.state, player);
    const position = move.type === 'place'
      ? localPlacementValue(state, result.state, move.index, player)
      : positionalValue(result.state, player) - beforePosition;
    applied.push({
      move,
      result,
      ordering: immediate * 10_000 + result.lines * 200 + result.captured * 150 + position,
    });
  }
  applied.sort((left, right) => right.ordering - left.ordering);
  return applied.slice(0, width);
}

function evaluation(state, rootPlayer) {
  const opponent = otherPlayer(rootPlayer);
  const score = state.scores[rootPlayer] - state.scores[opponent];
  const position = positionalValue(state, rootPlayer) - positionalValue(state, opponent);
  return score * 1000 + position;
}

function minimax(state, termination, scoring, depth, alpha, beta, rootPlayer) {
  if (depth === 0 || reachedTermination(state, termination) ||
      state.turn >= termination.safetyCap) {
    return evaluation(state, rootPlayer);
  }
  const moves = selectiveMoves(state, termination, scoring, SEARCH_WIDTHS[depth] || 6);
  if (moves.length === 0) return evaluation(state, rootPlayer);

  const maximizing = state.currentPlayer === rootPlayer;
  let value = maximizing ? -Infinity : Infinity;
  for (const candidate of moves) {
    const child = minimax(
      candidate.result.state,
      termination,
      scoring,
      depth - 1,
      alpha,
      beta,
      rootPlayer,
    );
    if (maximizing) {
      value = Math.max(value, child);
      alpha = Math.max(alpha, value);
    } else {
      value = Math.min(value, child);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha) break;
  }
  return value;
}

function chooseSearch(state, termination, scoring, random, depth) {
  const rootPlayer = state.currentPlayer;
  const moves = selectiveMoves(state, termination, scoring, SEARCH_WIDTHS[depth]);
  if (moves.length === 0) return null;
  let best = -Infinity;
  const tied = [];
  for (const candidate of moves) {
    const value = minimax(
      candidate.result.state,
      termination,
      scoring,
      depth - 1,
      -Infinity,
      Infinity,
      rootPlayer,
    );
    if (value > best + EPSILON) {
      best = value;
      tied.length = 0;
      tied.push(candidate);
    } else if (Math.abs(value - best) <= EPSILON) {
      tied.push(candidate);
    }
  }
  return tied[random.int(tied.length)];
}

function choose(policy, state, termination, scoring, random) {
  if (policy === 'A') return chooseUniform(state, termination, scoring, random);
  if (policy === 'B') return chooseGreedy(state, termination, scoring, random);
  if (policy === 'C') return choosePositionalGreedy(state, termination, scoring, random);
  if (policy === 'D2') return chooseSearch(state, termination, scoring, random, 2);
  if (policy === 'D3') return chooseSearch(state, termination, scoring, random, 3);
  throw new Error(`Política desconocida: ${policy}`);
}

function playPolicyGame({termination, scoring, random, goldPolicy, purplePolicy}) {
  let state = createState();
  let noMoves = false;
  while (!reachedTermination(state, termination) && state.turn < termination.safetyCap) {
    const policy = state.currentPlayer === GOLD ? goldPolicy : purplePolicy;
    const selected = choose(policy, state, termination, scoring, random);
    if (!selected) {
      noMoves = true;
      break;
    }
    state = selected.result.state;
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

function summarizePolicyGames(games, termination, scoring) {
  const summary = summarize(games, termination, scoring);
  const totalTurns = games.reduce((sum, game) => sum + game.turns, 0);
  const attackTurns = games.reduce((sum, game) => sum + game.actions.attack, 0);
  return {
    ...summary,
    attackTurnPercent: totalTurns > 0 ? attackTurns * 100 / totalTurns : 0,
  };
}

function taskConfiguration(task) {
  return {
    termination: TERMINATIONS[task.terminationIndex],
    scoring: SCORINGS[task.scoringIndex],
  };
}

function runTask(task) {
  const {termination, scoring} = taskConfiguration(task);
  const random = new Random(task.seed);
  if (task.kind === 'self') {
    const games = [];
    for (let game = 0; game < task.games; game++) {
      games.push(playPolicyGame({
        termination,
        scoring,
        random,
        goldPolicy: task.policy,
        purplePolicy: task.policy,
      }));
    }
    return {
      task,
      summary: summarizePolicyGames(games, termination, scoring),
    };
  }

  let d3Wins = 0;
  let opponentWins = 0;
  let draws = 0;
  const games = [];
  for (let game = 0; game < task.games; game++) {
    const d3IsGold = game % 2 === 0;
    const played = playPolicyGame({
      termination,
      scoring,
      random,
      goldPolicy: d3IsGold ? 'D3' : task.opponent,
      purplePolicy: d3IsGold ? task.opponent : 'D3',
    });
    games.push(played);
    if (played.winner === EMPTY) draws++;
    else if ((played.winner === GOLD) === d3IsGold) d3Wins++;
    else opponentWins++;
  }
  return {
    task,
    summary: summarizePolicyGames(games, termination, scoring),
    matchup: {
      d3WinPercent: d3Wins * 100 / task.games,
      opponentWinPercent: opponentWins * 100 / task.games,
      drawPercent: draws * 100 / task.games,
    },
  };
}

function makeTasks(games, seed) {
  const tasks = [];
  let sequence = 0;
  for (let terminationIndex = 0; terminationIndex < TERMINATIONS.length; terminationIndex++) {
    for (let scoringIndex = 0; scoringIndex < SCORINGS.length; scoringIndex++) {
      for (const policy of POLICIES) {
        tasks.push({
          id: sequence,
          kind: 'self',
          policy,
          terminationIndex,
          scoringIndex,
          games,
          seed: seed + sequence++ * 7919,
        });
      }
      for (const opponent of ['B', 'D2']) {
        tasks.push({
          id: sequence,
          kind: 'matchup',
          opponent,
          terminationIndex,
          scoringIndex,
          games,
          seed: seed + sequence++ * 7919,
        });
      }
    }
  }
  return tasks;
}

function diagnoseUniform(turns, seed) {
  const termination = {
    id: 'diagnostico-continuo',
    name: 'Diagnóstico continuo',
    type: 'turns',
    target: Number.POSITIVE_INFINITY,
    safetyCap: Number.POSITIVE_INFINITY,
  };
  const scoring = SCORINGS.find(item => item.id === 'actual');
  const random = new Random(seed);
  let state = createState();
  let legalMoves = 0;
  let attackMoves = 0;
  let goMoves = 0;
  let lineMoves = 0;
  let turnsWithAttack = 0;
  let turnsWithGo = 0;
  let turnsWithLine = 0;
  let selectedAttacks = 0;
  let expectedAttackProbability = 0;

  for (let turn = 0; turn < turns; turn++) {
    const legal = allLegalApplied(state, termination, scoring);
    if (legal.length === 0) {
      state = createState();
      turn--;
      continue;
    }
    const attacks = legal.filter(candidate => candidate.move.type === 'attack').length;
    const go = legal.filter(candidate =>
      candidate.move.type === 'place' && candidate.result.captured > 0).length;
    const lines = legal.filter(candidate =>
      candidate.move.type === 'place' && candidate.result.lines > 0).length;
    legalMoves += legal.length;
    attackMoves += attacks;
    expectedAttackProbability += attacks / legal.length;
    goMoves += go;
    lineMoves += lines;
    if (attacks > 0) turnsWithAttack++;
    if (go > 0) turnsWithGo++;
    if (lines > 0) turnsWithLine++;
    const selected = legal[random.int(legal.length)];
    if (selected.move.type === 'attack') selectedAttacks++;
    state = selected.result.state;
  }

  return {
    turns,
    averageLegalMoves: legalMoves / turns,
    averageAttackMoves: attackMoves / turns,
    averageGoMoves: goMoves / turns,
    averageLineMoves: lineMoves / turns,
    attackAvailabilityPercent: turnsWithAttack * 100 / turns,
    goAvailabilityPercent: turnsWithGo * 100 / turns,
    lineAvailabilityPercent: turnsWithLine * 100 / turns,
    selectedAttackPercent: selectedAttacks * 100 / turns,
    expectedAttackPercent: expectedAttackProbability * 100 / turns,
  };
}

function runTasksSequential(tasks, onProgress = () => {}) {
  return tasks.map((task, index) => {
    const result = runTask(task);
    onProgress(index + 1, tasks.length, task);
    return result;
  });
}

function runTasksParallel(tasks, workerCount, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const results = [];
    const workers = [];
    let nextTask = 0;
    let finished = 0;

    function assign(worker) {
      if (nextTask >= tasks.length) return;
      worker.postMessage(tasks[nextTask++]);
    }

    for (let index = 0; index < Math.min(workerCount, tasks.length); index++) {
      const worker = new Worker(__filename);
      workers.push(worker);
      worker.on('message', result => {
        results.push(result);
        finished++;
        onProgress(finished, tasks.length, result.task);
        if (finished === tasks.length) {
          workers.forEach(item => item.terminate());
          resolve(results.sort((left, right) => left.task.id - right.task.id));
        } else {
          assign(worker);
        }
      });
      worker.on('error', reject);
      assign(worker);
    }
  });
}

function combinationId(terminationIndex, scoringIndex) {
  return `${TERMINATIONS[terminationIndex].id}__${SCORINGS[scoringIndex].id}`;
}

function assemble(results, games, seed, diagnostics = null) {
  const self = Object.fromEntries(POLICIES.map(policy => [policy, []]));
  const depth = [];
  for (const result of results) {
    const id = combinationId(result.task.terminationIndex, result.task.scoringIndex);
    if (result.task.kind === 'self') {
      self[result.task.policy].push({...result.summary, id});
    } else {
      depth.push({
        id,
        terminationName: result.summary.terminationName,
        scoringName: result.summary.scoringName,
        opponent: result.task.opponent,
        ...result.matchup,
      });
    }
  }
  for (const policy of POLICIES) {
    self[policy].sort((left, right) => left.id.localeCompare(right.id));
  }
  depth.sort((left, right) => left.id.localeCompare(right.id) ||
    left.opponent.localeCompare(right.opponent));
  return {
    metadata: {
      date: '2026-07-27',
      gamesPerCombination: games,
      seed,
      search: {
        type: 'minimax alfa-beta selectivo',
        depth2: 2,
        depth3: 3,
        widths: SEARCH_WIDTHS,
        portfolio: [
          'líneas completables',
          'grupos enemigos a una libertad',
          'presión a dos libertades',
          'líneas abiertas',
          'ataques legales',
        ],
      },
      totalGames: results.length * games,
    },
    diagnostics,
    self,
    depth,
  };
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function metricsTable(title, rows) {
  const output = [
    `## ${title}`,
    '',
    '| Terminación | Puntuación | Turnos ± DE | Margen | Empates | Tope | Colocar | Go | Líneas | Ataques | Turnos atacando |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const row of rows) {
    output.push(
      `| ${row.terminationName} | ${row.scoringName} | ` +
      `${round(row.meanTurns)} ± ${round(row.stdTurns)} | ${round(row.meanMargin, 2)} | ` +
      `${round(row.drawPercent)}% | ${round(row.capPercent)}% | ` +
      `${round(row.shares.place)}% | ${round(row.shares.go)}% | ` +
      `${round(row.shares.line)}% | ${round(row.shares.attack)}% | ` +
      `${round(row.attackTurnPercent)}% |`,
    );
  }
  output.push('');
  return output.join('\n');
}

function principalCandidate(row) {
  return row.meanTurns >= 20 &&
    row.meanTurns <= 40 &&
    row.goLinePercent >= 40 &&
    row.normalizedMargin <= 0.25 &&
    row.capPercent <= 1 &&
    row.shares.attack < 40 &&
    row.attackTurnPercent < 50;
}

function renderReport(data) {
  const depthById = new Map();
  for (const row of data.depth) {
    if (!depthById.has(row.id)) depthById.set(row.id, {});
    depthById.get(row.id)[row.opponent] = row;
  }
  const principalById = new Map(data.self.C.map(row => [row.id, row]));
  const depthLines = [
    '## Criterio de profundidad',
    '',
    '| Terminación | Puntuación | D3 vs B | Empates | D3 vs D2 | Empates | Criterios C×C | Profundidad | Resultado |',
    '|---|---|---:|---:|---:|---:|---|---|---|',
  ];
  const finalists = [];
  for (const principal of data.self.C) {
    const matchups = depthById.get(principal.id);
    const againstB = matchups.B.d3WinPercent;
    const againstD2 = matchups.D2.d3WinPercent;
    const designPass = principalCandidate(principal);
    const depthPass = againstB >= 60 && againstD2 > 50;
    if (designPass && depthPass) finalists.push(principal.id);
    depthLines.push(
      `| ${principal.terminationName} | ${principal.scoringName} | ` +
      `${round(againstB)}% | ${round(matchups.B.drawPercent)}% | ` +
      `${round(againstD2)}% | ${round(matchups.D2.drawPercent)}% | ` +
      `${designPass ? 'Cumple' : 'No cumple'} | ` +
      `${depthPass ? 'Sí' : 'No'} | ${designPass && depthPass ? 'Finalista' : 'Descartado'} |`,
    );
  }
  depthLines.push('');

  const output = [
    '# Simulación corregida de terminación y puntuación',
    '',
    `Fecha: ${data.metadata.date}. Partidas por combinación y enfrentamiento: ` +
      `${data.metadata.gamesPerCombination.toLocaleString('en-US')}.`,
    `Total: ${data.metadata.totalGames.toLocaleString('en-US')} partidas. Semilla: ` +
      `${data.metadata.seed}.`,
    '',
    'A es aleatorio uniforme sobre todas las jugadas legales. B maximiza puntos inmediatos.',
    'C maximiza puntos y desempata por amenazas, líneas abiertas y presión de libertades.',
    'D usa minimax alfa-beta selectivo; profundidades 2 y 3 comparten la misma cartera de',
    `jugadas, con anchos ${SEARCH_WIDTHS[3]}, ${SEARCH_WIDTHS[2]} y ` +
      `${SEARCH_WIDTHS[1]}. La selección es explícitamente selectiva, no exhaustiva.`,
    'Las participaciones de Colocar, Go, Líneas y Ataques son porcentajes del impacto',
    'absoluto en el marcador. “Turnos atacando” mide frecuencia de acción y evita confundir',
    'un ataque con valor cero con una mecánica que dejó de dominar.',
    '',
    'El filtro C×C exige 20–40 turnos, Go más líneas ≥40%, margen normalizado ≤25%,',
    'tope técnico ≤1%, ataques <40% del impacto y ataques en menos de 50% de los turnos.',
    'El filtro de profundidad exige D3 ≥60% contra B y más de 50% contra D2.',
    '',
    '## Control del agente A',
    '',
    data.diagnostics
      ? `En una trayectoria continua de ${data.diagnostics.turns.toLocaleString('en-US')} ` +
        'turnos, fuera de los esquemas de terminación, hubo en promedio ' +
        `${round(data.diagnostics.averageLegalMoves, 2)} jugadas legales y ` +
        `${round(data.diagnostics.averageAttackMoves, 2)} ataques. A eligió ataques en ` +
        `${round(data.diagnostics.selectedAttackPercent, 2)}% de los turnos; la proporción ` +
        `esperada por muestreo uniforme fue ${round(data.diagnostics.expectedAttackPercent, 2)}%.`
      : 'No se ejecutó el diagnóstico uniforme.',
    '',
    data.diagnostics
      ? `Disponibilidad por turno: Go ${round(data.diagnostics.goAvailabilityPercent, 1)}% ` +
        `(${round(data.diagnostics.averageGoMoves, 2)} jugadas), líneas ` +
        `${round(data.diagnostics.lineAvailabilityPercent, 1)}% ` +
        `(${round(data.diagnostics.averageLineMoves, 2)} jugadas), ataques ` +
        `${round(data.diagnostics.attackAvailabilityPercent, 1)}%.`
      : '',
    '',
    'Este control solo contrasta selección observada contra probabilidad uniforme dentro',
    'de la misma trayectoria. No se usa para juzgar el diseño ni se compara con muestras',
    'episódicas que recorren otra distribución de estados.',
    '',
    metricsTable('Política A: aleatorio uniforme, A×A', data.self.A),
    metricsTable('Política B: codicioso inmediato, B×B', data.self.B),
    metricsTable('Política C: codicioso posicional, C×C', data.self.C),
    metricsTable('Política D: búsqueda profundidad 3, D3×D3', data.self.D3),
    depthLines.join('\n'),
    '## Finalistas',
    '',
  ];
  if (finalists.length === 0) {
    const designOnly = data.self.C.filter(principalCandidate);
    const depthOnly = data.self.C.filter(principal => {
      const matchups = depthById.get(principal.id);
      return matchups.B.d3WinPercent >= 60 && matchups.D2.d3WinPercent > 50;
    });
    output.push(
      'Ninguna combinación supera simultáneamente el filtro C×C y el criterio de profundidad.',
      'No recomiendo implementar ninguna de las doce configuraciones.',
      '',
    );
    if (designOnly.length > 0) {
      output.push(
        `La más cercana por producto es ${designOnly[0].terminationName} con ` +
          `${designOnly[0].scoringName}, pero queda descartada porque D3 no supera a D2.`,
      );
    }
    if (depthOnly.length > 0) {
      const bestDepthBase = [...depthOnly].sort((left, right) => {
        const leftDistance = Math.abs(left.meanTurns - 30) + left.normalizedMargin * 10;
        const rightDistance = Math.abs(right.meanTurns - 30) + right.normalizedMargin * 10;
        return leftDistance - rightDistance;
      })[0];
      output.push(
        `La mejor base con profundidad es ${bestDepthBase.terminationName} con ` +
          `${bestDepthBase.scoringName}; conserva margen cerrado y Go+líneas relevantes, ` +
          `pero dura ${round(bestDepthBase.meanTurns)} turnos con C×C.`,
        'La siguiente matriz debería probar menos cicatrices (3–5) y valores intermedios',
        'para Go/líneas. Es una nueva hipótesis, no un esquema aprobado.',
      );
    }
  } else {
    finalists.forEach(id => output.push(`- ${id}`));
    const recommended = [...data.self.C]
      .filter(row => finalists.includes(row.id))
      .sort((left, right) => {
        const leftDistance = Math.abs(left.meanTurns - 30) + left.normalizedMargin * 10;
        const rightDistance = Math.abs(right.meanTurns - 30) + right.normalizedMargin * 10;
        return leftDistance - rightDistance;
      })[0];
    output.push(
      '',
      `Recomendación provisional: ${recommended.terminationName} con ` +
        `${recommended.scoringName}, por ser el finalista más cercano a 30 turnos y con ` +
        'el margen normalizado más cerrado. No se implementa sin aprobación.',
    );
  }
  output.push('');
  return output.join('\n');
}

async function run(options) {
  const tasks = makeTasks(options.games, options.seed);
  const results = options.workers > 1
    ? await runTasksParallel(tasks, options.workers, options.onProgress)
    : runTasksSequential(tasks, options.onProgress);
  const diagnostics = diagnoseUniform(options.diagnosticTurns, options.seed + 4_000_003);
  return assemble(results, options.games, options.seed, diagnostics);
}

function parseArguments(argv) {
  const options = {games: 1000, seed: 20260727, workers: 8, diagnosticTurns: 2400};
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--games') options.games = Number(argv[++index]);
    else if (argv[index] === '--seed') options.seed = Number(argv[++index]);
    else if (argv[index] === '--workers') options.workers = Number(argv[++index]);
    else if (argv[index] === '--diagnostic-turns') {
      options.diagnosticTurns = Number(argv[++index]);
    }
  }
  return options;
}

if (!isMainThread) {
  parentPort.on('message', task => parentPort.postMessage(runTask(task)));
} else if (require.main === module) {
  const options = parseArguments(process.argv.slice(2));
  let lastReported = 0;
  options.onProgress = (finished, total, task) => {
    const percent = Math.floor(finished * 100 / total);
    if (percent >= lastReported + 5 || finished === total) {
      lastReported = percent;
      process.stderr.write(`Progreso ${finished}/${total} (${percent}%) · ${task.kind}\n`);
    }
  };
  run(options).then(data => {
    const reportDirectory = path.join(__dirname, '..', 'reports');
    fs.mkdirSync(reportDirectory, {recursive: true});
    fs.writeFileSync(
      path.join(reportDirectory, 'fases-2-3-v2.json'),
      `${JSON.stringify(data, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(reportDirectory, 'fases-2-3-v2.md'),
      renderReport(data),
    );
    process.stdout.write(`${renderReport(data)}\n`);
  }).catch(error => {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  POLICIES,
  SEARCH_WIDTHS,
  positionalValue,
  allLegalApplied,
  chooseUniform,
  chooseGreedy,
  choosePositionalGreedy,
  chooseSearch,
  playPolicyGame,
  makeTasks,
  diagnoseUniform,
  runTask,
  assemble,
  renderReport,
  run,
};
