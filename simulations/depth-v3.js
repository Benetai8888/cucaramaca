'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  EMPTY,
  GOLD,
  PURPLE,
  EPSILON,
  Random,
  otherPlayer,
  createState,
} = require('./phase2-3.js');
const scoring = require('./scoring-v3.js');

const WIDTH = 12;
const MAX_TURNS = 30;

function selectiveCandidates(state, scheme, width = WIDTH) {
  const legal = scoring.legalApplied(state, scheme);
  legal.sort((left, right) =>
    right.result.immediateValue - left.result.immediateValue ||
    left.move.type.localeCompare(right.move.type) ||
    (left.move.index ?? left.move.source) - (right.move.index ?? right.move.source) ||
    (left.move.number ?? left.move.target) - (right.move.number ?? right.move.target));
  if (legal.length <= width) return legal;
  const cutoff = legal[width - 1].result.immediateValue;
  let end = width;
  while (end < legal.length &&
      Math.abs(legal[end].result.immediateValue - cutoff) <= EPSILON) end++;
  return legal.slice(0, end);
}

function leafValue(state, rootPlayer) {
  return state.scores[rootPlayer] - state.scores[otherPlayer(rootPlayer)];
}

function minimax(state, scheme, depth, alpha, beta, rootPlayer, diagnostics) {
  diagnostics.nodes++;
  if (depth === 0 || state.turn >= MAX_TURNS) {
    diagnostics.leaves++;
    return leafValue(state, rootPlayer);
  }
  const candidates = selectiveCandidates(state, scheme);
  diagnostics.maxBranch = Math.max(diagnostics.maxBranch, candidates.length);
  diagnostics.minBranch = Math.min(diagnostics.minBranch, candidates.length);
  if (candidates.length === 0) {
    diagnostics.leaves++;
    return leafValue(state, rootPlayer);
  }

  const maximizing = state.currentPlayer === rootPlayer;
  let value = maximizing ? -Infinity : Infinity;
  for (const candidate of candidates) {
    const child = minimax(
      candidate.result.state,
      scheme,
      depth - 1,
      alpha,
      beta,
      rootPlayer,
      diagnostics,
    );
    if (maximizing) {
      value = Math.max(value, child);
      alpha = Math.max(alpha, value);
    } else {
      value = Math.min(value, child);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha) {
      diagnostics.cutoffs++;
      break;
    }
  }
  return value;
}

function chooseSearch(state, scheme, depth, random, diagnostics) {
  const rootPlayer = state.currentPlayer;
  const candidates = selectiveCandidates(state, scheme);
  diagnostics.maxBranch = Math.max(diagnostics.maxBranch, candidates.length);
  diagnostics.minBranch = Math.min(diagnostics.minBranch, candidates.length);
  let best = -Infinity;
  let tied = [];
  for (const candidate of candidates) {
    const value = minimax(
      candidate.result.state,
      scheme,
      depth - 1,
      -Infinity,
      Infinity,
      rootPlayer,
      diagnostics,
    );
    if (value > best + EPSILON) {
      best = value;
      tied = [candidate];
    } else if (Math.abs(value - best) <= EPSILON) {
      tied.push(candidate);
    }
  }
  if (tied.length === 0) return null;
  return tied[random.int(tied.length)];
}

function createDiagnostics() {
  return {
    nodes: 0,
    leaves: 0,
    cutoffs: 0,
    minBranch: Infinity,
    maxBranch: 0,
  };
}

function playDepthGame(scheme, goldDepth, purpleDepth, seed) {
  let state = createState();
  const random = new Random(seed);
  const diagnostics = createDiagnostics();
  while (state.turn < MAX_TURNS) {
    const depth = state.currentPlayer === GOLD ? goldDepth : purpleDepth;
    const selected = chooseSearch(state, scheme, depth, random, diagnostics);
    if (!selected) break;
    state = selected.result.state;
  }
  let winner = EMPTY;
  if (state.scores[GOLD] > state.scores[PURPLE] + EPSILON) winner = GOLD;
  else if (state.scores[PURPLE] > state.scores[GOLD] + EPSILON) winner = PURPLE;
  return {
    goldDepth,
    purpleDepth,
    winner,
    scores: [state.scores[GOLD], state.scores[PURPLE]],
    margin: Math.abs(state.scores[GOLD] - state.scores[PURPLE]),
    breakdown: state.breakdown,
    diagnostics: {
      ...diagnostics,
      minBranch: Number.isFinite(diagnostics.minBranch) ? diagnostics.minBranch : 0,
    },
  };
}

function runDepthComparison(scheme, seed = 20260727) {
  const games = [
    playDepthGame(scheme, 3, 2, seed),
    playDepthGame(scheme, 2, 3, seed + 1),
  ];
  let depth3Wins = 0;
  let depth2Wins = 0;
  let draws = 0;
  for (const game of games) {
    if (game.winner === EMPTY) draws++;
    else {
      const depth3IsGold = game.goldDepth === 3;
      if ((game.winner === GOLD) === depth3IsGold) depth3Wins++;
      else depth2Wins++;
    }
  }
  return {
    scheme: scheme.id,
    schemeName: scheme.name,
    width: WIDTH,
    cutoffTiesIncluded: true,
    evaluation: 'diferencia de puntuación reglamentaria, sin heurística posicional externa',
    games,
    depth3WinPercent: depth3Wins * 50,
    depth2WinPercent: depth2Wins * 50,
    drawPercent: draws * 50,
  };
}

function parseArguments(argv) {
  const options = {scheme: 'multi-gp1-l30-a84', seed: 20260727};
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--scheme') options.scheme = argv[++index];
    else if (argv[index] === '--seed') options.seed = Number(argv[++index]);
  }
  return options;
}

if (require.main === module) {
  const options = parseArguments(process.argv.slice(2));
  const scheme = scoring.SCHEMES.find(item => item.id === options.scheme);
  if (!scheme) throw new Error(`Esquema desconocido: ${options.scheme}`);
  const result = runDepthComparison(scheme, options.seed);
  const destination = path.join(__dirname, '..', 'reports', 'profundidad-v3.json');
  fs.writeFileSync(destination, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

module.exports = {
  WIDTH,
  selectiveCandidates,
  leafValue,
  minimax,
  chooseSearch,
  playDepthGame,
  runDepthComparison,
};
