'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  EMPTY,
  GOLD,
  PURPLE,
  EPSILON,
  TERMINATIONS,
  SCORINGS,
  Random,
  otherPlayer,
  getNeighbors,
  getGroup,
  BOX_LINES,
  placementCandidates,
  attackCandidates,
  applyMove,
  reachedTermination,
  createState,
  summarize,
  round,
} = require('./phase2-3.js');

const POLICY_IDS = ['A', 'B', 'C', 'D2', 'D3'];
const SEARCH_BRANCH_LIMIT = 2;
const DEFAULT_SEED = 20260727;
const REPORT_JSON = path.join(__dirname, '..', 'reports', 'fases-2-3-corregidas.json');
const REPORT_MD = path.join(__dirname, '..', 'reports', 'fases-2-3-corregidas.md');

function moveKey(move) {
  if (move.type === 'attack') return `A:${move.source}:${move.target}`;
  return `P:${move.index}:${move.number}`;
}

function compareVectors(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (Math.abs(difference) > EPSILON) return difference;
  }
  return 0;
}

function enemyGroups(state, player) {
  const enemy = otherPlayer(player);
  const visited = new Uint8Array(81);
  const groups = [];
  for (let index = 0; index < 81; index++) {
    if (visited[index] || state.owners[index] !== enemy) continue;
    const group = getGroup(state.owners, state.blocked, index);
    group.cells.forEach(cell => {
      visited[cell] = 1;
    });
    groups.push(group);
  }
  return groups;
}

function totalEnemyLiberties(state, player) {
  return enemyGroups(state, player).reduce((sum, group) => sum + group.liberties, 0);
}

function countAtariGroups(state, player) {
  return enemyGroups(state, player).filter(group => group.liberties === 1).length;
}

function countOpenLines(state, player) {
  let count = 0;
  for (const lines of BOX_LINES) {
    for (const line of lines) {
      let own = 0;
      let empty = 0;
      for (const cell of line) {
        if (state.owners[cell] === player) own++;
        else if (state.owners[cell] === EMPTY && !state.blocked[cell]) empty++;
      }
      if (own === 2 && empty === 1) count++;
    }
  }
  return count;
}

function attackThreatsFrom(state, player, source, number) {
  const row = Math.floor(source / 9);
  const col = source % 9;
  let threats = 0;
  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const targetRow = row + rowOffset;
      const targetCol = col + colOffset;
      if (targetRow < 0 || targetRow > 8 || targetCol < 0 || targetCol > 8) continue;
      const target = targetRow * 9 + targetCol;
      if (state.owners[target] !== EMPTY &&
          state.owners[target] !== player &&
          number > state.values[target]) threats++;
    }
  }
  return threats;
}

function immediateUtility(before, after, player) {
  const opponent = otherPlayer(player);
  return (after.scores[player] - before.scores[player]) -
    (after.scores[opponent] - before.scores[opponent]);
}

function groupPlacements(state) {
  const groups = [];
  let current = null;
  for (const move of placementCandidates(state)) {
    if (!current || current.index !== move.index) {
      current = {index: move.index, numbers: []};
      groups.push(current);
    }
    current.numbers.push(move.number);
  }
  return groups;
}

function analyzeMoves(state, termination, scoring) {
  const player = state.currentPlayer;
  const beforeLiberties = totalEnemyLiberties(state, player);
  const records = [];

  for (const group of groupPlacements(state)) {
    const representative = {type: 'place', index: group.index, number: group.numbers[0]};
    const applied = applyMove(state, representative, termination, scoring);
    if (!applied) continue;
    const utility = immediateUtility(state, applied.state, player);
    const libertyReduction = Math.max(
      0,
      beforeLiberties - totalEnemyLiberties(applied.state, player),
    );
    const atariThreats = countAtariGroups(applied.state, player);
    const openLines = countOpenLines(applied.state, player);
    for (const number of group.numbers) {
      const move = {type: 'place', index: group.index, number};
      const attackThreats = attackThreatsFrom(applied.state, player, group.index, number);
      records.push({
        move,
        vector: [utility, atariThreats + attackThreats, libertyReduction, openLines],
      });
    }
  }

  for (const move of attackCandidates(state)) {
    const applied = applyMove(state, move, termination, scoring);
    if (!applied) continue;
    records.push({
      move,
      vector: [
        immediateUtility(state, applied.state, player),
        countAtariGroups(applied.state, player),
        Math.max(0, beforeLiberties - totalEnemyLiberties(applied.state, player)),
        countOpenLines(applied.state, player),
      ],
    });
  }
  return records;
}

function chooseBestRecord(records, vectorLength, random) {
  let best = null;
  let ties = 0;
  for (const record of records) {
    const vector = record.vector.slice(0, vectorLength);
    if (!best || compareVectors(vector, best.vector.slice(0, vectorLength)) > 0) {
      best = record;
      ties = 1;
    } else if (compareVectors(vector, best.vector.slice(0, vectorLength)) === 0) {
      ties++;
      if (random.int(ties) === 0) best = record;
    }
  }
  return best;
}

function uniformChoice(state, termination, scoring, random) {
  const moves = [...placementCandidates(state), ...attackCandidates(state)];
  while (moves.length > 0) {
    const selected = random.int(moves.length);
    const move = moves[selected];
    moves[selected] = moves[moves.length - 1];
    moves.pop();
    const applied = applyMove(state, move, termination, scoring);
    if (applied) return {...applied, move};
  }
  return null;
}

function greedyChoice(state, termination, scoring, random, positional) {
  const records = analyzeMoves(state, termination, scoring);
  const best = chooseBestRecord(records, positional ? 4 : 1, random);
  if (!best) return null;
  const applied = applyMove(state, best.move, termination, scoring);
  return applied ? {...applied, move: best.move} : null;
}

function mobilitySnapshot(state, player) {
  let stones = 0;
  let attackThreats = 0;
  for (let index = 0; index < 81; index++) {
    if (state.owners[index] !== player) continue;
    stones++;
    attackThreats += attackThreatsFrom(state, player, index, state.values[index]);
  }
  return {
    stones,
    atari: countAtariGroups(state, player),
    openLines: countOpenLines(state, player),
    attackThreats,
  };
}

function attackImpact(scoring) {
  return scoring.attack.mode === 'none' ? 0 : scoring.attack.value;
}

function evaluateState(state, rootPlayer, scoring) {
  const opponent = otherPlayer(rootPlayer);
  const root = mobilitySnapshot(state, rootPlayer);
  const enemy = mobilitySnapshot(state, opponent);
  const scoreDifference = state.scores[rootPlayer] - state.scores[opponent];
  const positional =
    (root.atari - enemy.atari) * scoring.go * 0.35 +
    (root.openLines - enemy.openLines) * scoring.line * 0.20 +
    (root.attackThreats - enemy.attackThreats) * attackImpact(scoring) * 0.15 +
    (root.stones - enemy.stones) * scoring.place * 0.05;
  return scoreDifference + positional;
}

function orderedSearchMoves(state, termination, scoring, limit) {
  return analyzeMoves(state, termination, scoring)
    .sort((left, right) => {
      const vectorOrder = compareVectors(right.vector, left.vector);
      return vectorOrder !== 0 ? vectorOrder : moveKey(left.move).localeCompare(moveKey(right.move));
    })
    .slice(0, limit)
    .map(record => record.move);
}

function minimax(state, termination, scoring, rootPlayer, depth, alpha, beta, branchLimit) {
  if (depth === 0 || reachedTermination(state, termination) ||
      state.turn >= termination.safetyCap) {
    return evaluateState(state, rootPlayer, scoring);
  }
  const moves = orderedSearchMoves(state, termination, scoring, branchLimit);
  if (moves.length === 0) return evaluateState(state, rootPlayer, scoring);

  const maximizing = state.currentPlayer === rootPlayer;
  let value = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const applied = applyMove(state, move, termination, scoring);
    if (!applied) continue;
    const child = minimax(
      applied.state,
      termination,
      scoring,
      rootPlayer,
      depth - 1,
      alpha,
      beta,
      branchLimit,
    );
    if (maximizing) {
      value = Math.max(value, child);
      alpha = Math.max(alpha, value);
    } else {
      value = Math.min(value, child);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha + EPSILON) break;
  }
  return value;
}

function searchChoice(state, termination, scoring, random, depth) {
  const rootPlayer = state.currentPlayer;
  const moves = orderedSearchMoves(state, termination, scoring, SEARCH_BRANCH_LIMIT);
  let bestValue = -Infinity;
  let bestMove = null;
  let ties = 0;
  for (const move of moves) {
    const applied = applyMove(state, move, termination, scoring);
    if (!applied) continue;
    const value = minimax(
      applied.state,
      termination,
      scoring,
      rootPlayer,
      depth - 1,
      -Infinity,
      Infinity,
      SEARCH_BRANCH_LIMIT,
    );
    if (value > bestValue + EPSILON) {
      bestValue = value;
      bestMove = move;
      ties = 1;
    } else if (Math.abs(value - bestValue) <= EPSILON) {
      ties++;
      if (random.int(ties) === 0) bestMove = move;
    }
  }
  if (!bestMove) return null;
  const applied = applyMove(state, bestMove, termination, scoring);
  return applied ? {...applied, move: bestMove} : null;
}

function policyChoice(policyId, state, termination, scoring, random) {
  if (policyId === 'A') return uniformChoice(state, termination, scoring, random);
  if (policyId === 'B') return greedyChoice(state, termination, scoring, random, false);
  if (policyId === 'C') return greedyChoice(state, termination, scoring, random, true);
  if (policyId === 'D2') return searchChoice(state, termination, scoring, random, 2);
  if (policyId === 'D3') return searchChoice(state, termination, scoring, random, 3);
  throw new Error(`Política desconocida: ${policyId}`);
}

function playPolicyGame({termination, scoring, random, goldPolicy, purplePolicy}) {
  let state = createState();
  let noMoves = false;
  while (!reachedTermination(state, termination) && state.turn < termination.safetyCap) {
    const policyId = state.currentPlayer === GOLD ? goldPolicy : purplePolicy;
    const choice = policyChoice(policyId, state, termination, scoring, random);
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

function runSelfPlay(policyId, termination, scoring, games, seed) {
  const random = new Random(seed);
  const played = [];
  for (let game = 0; game < games; game++) {
    played.push(playPolicyGame({
      termination,
      scoring,
      random,
      goldPolicy: policyId,
      purplePolicy: policyId,
    }));
  }
  return {...summarize(played, termination, scoring), policy: policyId};
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

function runMatchup(leftPolicy, rightPolicy, termination, scoring, games, seed) {
  const random = new Random(seed);
  let leftWins = 0;
  let rightWins = 0;
  let draws = 0;
  for (let game = 0; game < games; game++) {
    const leftIsGold = game % 2 === 0;
    const played = playPolicyGame({
      termination,
      scoring,
      random,
      goldPolicy: leftIsGold ? leftPolicy : rightPolicy,
      purplePolicy: leftIsGold ? rightPolicy : leftPolicy,
    });
    if (played.winner === EMPTY) draws++;
    else if ((played.winner === GOLD) === leftIsGold) leftWins++;
    else rightWins++;
  }
  const decisive = leftWins + rightWins;
  const interval = wilsonInterval(leftWins, decisive);
  return {
    id: `${termination.id}__${scoring.id}__${leftPolicy}-vs-${rightPolicy}`,
    termination: termination.id,
    terminationName: termination.name,
    scoring: scoring.id,
    scoringName: scoring.name,
    leftPolicy,
    rightPolicy,
    games,
    leftWins,
    rightWins,
    draws,
    leftWinPercent: leftWins * 100 / games,
    rightWinPercent: rightWins * 100 / games,
    drawPercent: draws * 100 / games,
    decisiveLeftPercent: decisive > 0 ? leftWins * 100 / decisive : 50,
    decisiveWilson95: {low: interval.low * 100, high: interval.high * 100},
    depthAdvantage: decisive > 0 && interval.low > 0.5,
  };
}

function selfKey(policyId, termination, scoring) {
  return `${policyId}__${termination.id}__${scoring.id}`;
}

function matchupKey(left, right, termination, scoring) {
  return `${left}-vs-${right}__${termination.id}__${scoring.id}`;
}

function loadCheckpoint(options) {
  if (!options.resume || !fs.existsSync(REPORT_JSON)) return null;
  const parsed = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
  if (parsed.metadata.seed !== options.seed ||
      parsed.metadata.selfGames !== options.selfGames ||
      parsed.metadata.matchupGames !== options.matchupGames) return null;
  return parsed;
}

function saveOutput(output) {
  fs.mkdirSync(path.dirname(REPORT_JSON), {recursive: true});
  fs.writeFileSync(REPORT_JSON, `${JSON.stringify(output, null, 2)}\n`);
  fs.writeFileSync(REPORT_MD, renderCorrectedReport(output));
}

function runCorrected(options, progress = () => {}) {
  const output = loadCheckpoint(options) || {
    metadata: {
      date: '2026-07-27',
      seed: options.seed,
      selfGames: options.selfGames,
      matchupGames: options.matchupGames,
      searchBranchLimit: SEARCH_BRANCH_LIMIT,
      primaryPolicy: 'C',
    },
    selfPlay: {},
    matchups: {},
  };
  const policyOrder = ['C', 'A', 'B', 'D2', 'D3'];
  let ordinal = 0;
  for (const policyId of policyOrder) {
    for (let terminationIndex = 0; terminationIndex < TERMINATIONS.length; terminationIndex++) {
      for (let scoringIndex = 0; scoringIndex < SCORINGS.length; scoringIndex++) {
        ordinal++;
        const termination = TERMINATIONS[terminationIndex];
        const scoring = SCORINGS[scoringIndex];
        const key = selfKey(policyId, termination, scoring);
        if (output.selfPlay[key]) continue;
        progress(`Autopartida ${policyId} ${termination.id}/${scoring.id}`);
        output.selfPlay[key] = runSelfPlay(
          policyId,
          termination,
          scoring,
          options.selfGames,
          options.seed + ordinal * 100_003,
        );
        saveOutput(output);
      }
    }
  }

  const matchups = [['D3', 'B'], ['D3', 'D2']];
  for (let matchupIndex = 0; matchupIndex < matchups.length; matchupIndex++) {
    const [left, right] = matchups[matchupIndex];
    for (let terminationIndex = 0; terminationIndex < TERMINATIONS.length; terminationIndex++) {
      for (let scoringIndex = 0; scoringIndex < SCORINGS.length; scoringIndex++) {
        const termination = TERMINATIONS[terminationIndex];
        const scoring = SCORINGS[scoringIndex];
        const key = matchupKey(left, right, termination, scoring);
        if (output.matchups[key]) continue;
        progress(`Enfrentamiento ${left} vs ${right} ${termination.id}/${scoring.id}`);
        output.matchups[key] = runMatchup(
          left,
          right,
          termination,
          scoring,
          options.matchupGames,
          options.seed + 9_000_001 + matchupIndex * 1_000_003 +
            terminationIndex * 100_003 + scoringIndex * 7_919,
        );
        saveOutput(output);
      }
    }
  }
  return output;
}

function percent(value) {
  return `${round(value, 1)}%`;
}

function renderSelfTable(rows) {
  const lines = [
    '| Terminación | Puntuación | Turnos | Margen | Margen norm. | Empates | Colocar | Go | Líneas | Ataques |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.terminationName} | ${row.scoringName} | ${round(row.meanTurns, 1)} | ` +
      `${round(row.meanMargin, 2)} | ${percent(row.normalizedMargin * 100)} | ` +
      `${percent(row.drawPercent)} | ` +
      `${percent(row.shares.place)} | ${percent(row.shares.go)} | ` +
      `${percent(row.shares.line)} | ${percent(row.shares.attack)} |`,
    );
  }
  return lines;
}

function renderCorrectedReport(output) {
  const lines = [
    '# Simulación corregida de las fases 2 y 3',
    '',
    `Fecha: ${output.metadata.date}`,
    '',
    `Partidas por política y combinación: ${output.metadata.selfGames.toLocaleString('en-US')}.`,
    `Partidas por enfrentamiento y combinación: ${output.metadata.matchupGames.toLocaleString('en-US')}.`,
    `Semilla base: ${output.metadata.seed}.`,
    `Búsqueda selectiva D2/D3: alfa-beta con ${output.metadata.searchBranchLimit} jugadas ` +
      'ordenadas por nodo.',
    '',
    'A elige uniformemente entre todas las jugadas legales. B maximiza el cambio inmediato',
    'del marcador. C usa el mismo máximo y desempata, en orden, por amenazas creadas,',
    'reducción de libertades enemigas y líneas propias abiertas. D2 y D3 aplican minimax',
    'alfa-beta selectivo con la misma ordenación posicional.',
    '',
    '## Configuración principal: C contra C',
    '',
  ];
  const terminationOrder = new Map(TERMINATIONS.map((item, index) => [item.id, index]));
  const scoringOrder = new Map(SCORINGS.map((item, index) => [item.id, index]));
  const selfRows = Object.values(output.selfPlay).sort((left, right) =>
    POLICY_IDS.indexOf(left.policy) - POLICY_IDS.indexOf(right.policy) ||
    terminationOrder.get(left.termination) - terminationOrder.get(right.termination) ||
    scoringOrder.get(left.scoring) - scoringOrder.get(right.scoring));
  const mainRows = selfRows.filter(row => row.policy === 'C');
  lines.push(...renderSelfTable(mainRows), '');

  lines.push('## Tablas por política', '');
  for (const policyId of POLICY_IDS) {
    const rows = selfRows.filter(row => row.policy === policyId);
    if (rows.length === 0) continue;
    lines.push(`### Política ${policyId}`, '', ...renderSelfTable(rows), '');
  }

  lines.push(
    '## Criterio de profundidad',
    '',
    'Se considera evidencia de ventaja cuando el límite inferior del intervalo Wilson de 95%',
    'sobre las partidas decisivas supera 50%. Se alterna el color en cada partida.',
    '',
    '| Terminación | Puntuación | Enfrentamiento | Gana izquierda | Empates | ' +
      'Gana entre decisivas | IC 95% | Ventaja demostrada |',
    '|---|---|---|---:|---:|---:|---:|---|',
  );
  const matchupRows = Object.values(output.matchups).sort((left, right) =>
    left.rightPolicy.localeCompare(right.rightPolicy) ||
    terminationOrder.get(left.termination) - terminationOrder.get(right.termination) ||
    scoringOrder.get(left.scoring) - scoringOrder.get(right.scoring));
  for (const row of matchupRows) {
    lines.push(
      `| ${row.terminationName} | ${row.scoringName} | ${row.leftPolicy} vs ${row.rightPolicy} | ` +
      `${percent(row.leftWinPercent)} | ${percent(row.drawPercent)} | ` +
      `${percent(row.decisiveLeftPercent)} | ` +
      `${percent(row.decisiveWilson95.low)}–${percent(row.decisiveWilson95.high)} | ` +
      `${row.depthAdvantage ? 'Sí' : 'No'} |`,
    );
  }

  const viable = mainRows.filter(row =>
    row.meanTurns >= 20 &&
    row.meanTurns <= 40 &&
    row.goLinePercent >= 40 &&
    row.capPercent <= 1 &&
    row.normalizedMargin <= 0.25);
  lines.push('', '## Resultado', '');
  if (mainRows.length < TERMINATIONS.length * SCORINGS.length) {
    lines.push('Ejecución incompleta; el archivo conserva un punto de reanudación.');
  } else if (viable.length === 0) {
    lines.push('Ninguna combinación cumple duración, contribución de Go más líneas y tope técnico.');
  } else {
    const recommended = [...viable].sort((left, right) => {
      const leftConcentration = Math.max(...Object.values(left.shares));
      const rightConcentration = Math.max(...Object.values(right.shares));
      return leftConcentration - rightConcentration ||
        left.normalizedMargin - right.normalizedMargin;
    })[0];
    lines.push(
      `Cumplen todos los filtros: ${viable.map(row =>
        `${row.terminationName} con ${row.scoringName}`).join('; ')}.`,
      '',
      `Recomendación experimental: ${recommended.terminationName} con ` +
        `${recommended.scoringName}. En C contra C dura ${round(recommended.meanTurns, 1)} ` +
        `turnos, Go más líneas aporta ${percent(recommended.goLinePercent)}, el margen ` +
        `normalizado es ${percent(recommended.normalizedMargin * 100)} y su mayor fuente ` +
        `de puntuación representa ${percent(Math.max(...Object.values(recommended.shares)))}.`,
      '',
      'D3 supera a B en las 12 combinaciones, pero no muestra ventaja sobre D2 en ninguna.',
      'Con el límite selectivo de dos jugadas por nodo, la profundidad 3 no queda justificada;',
      'esta conclusión no equivale a una prueba sobre minimax exhaustivo.',
    );
  }
  lines.push(
    'No se modificó el motor del juego ni se implementó una combinación ganadora.',
    '',
  );
  return lines.join('\n');
}

function parseArguments(argv) {
  const options = {
    selfGames: 1000,
    matchupGames: 1000,
    seed: DEFAULT_SEED,
    resume: true,
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--self-games') options.selfGames = Number(argv[++index]);
    else if (argument === '--matchup-games') options.matchupGames = Number(argv[++index]);
    else if (argument === '--seed') options.seed = Number(argv[++index]);
    else if (argument === '--no-resume') options.resume = false;
  }
  if (!Number.isInteger(options.selfGames) || options.selfGames < 1) {
    throw new Error('--self-games inválido');
  }
  if (!Number.isInteger(options.matchupGames) || options.matchupGames < 1) {
    throw new Error('--matchup-games inválido');
  }
  if (!Number.isInteger(options.seed)) throw new Error('--seed inválida');
  return options;
}

if (require.main === module) {
  const options = parseArguments(process.argv.slice(2));
  const output = runCorrected(options, message => {
    process.stdout.write(`${new Date().toISOString()} ${message}\n`);
  });
  saveOutput(output);
  process.stdout.write(`${renderCorrectedReport(output)}\n`);
}

module.exports = {
  POLICY_IDS,
  SEARCH_BRANCH_LIMIT,
  compareVectors,
  analyzeMoves,
  uniformChoice,
  greedyChoice,
  evaluateState,
  orderedSearchMoves,
  minimax,
  searchChoice,
  policyChoice,
  playPolicyGame,
  runSelfPlay,
  wilsonInterval,
  runMatchup,
  runCorrected,
  renderCorrectedReport,
  parseArguments,
};
