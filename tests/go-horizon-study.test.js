'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const base = require('../simulations/phase2-3.js');
const study = require('../simulations/go-horizon-study.js');

function moveKey(move) {
  return move.type === 'place'
    ? `p:${move.index}:${move.number}`
    : `a:${move.source}:${move.target}`;
}

test('la geometría 9x9 conserva 72 líneas y 6x6 define 12 líneas en subcajas 2x3', () => {
  assert.equal(study.GEOMETRIES['9x9'].lines.length, 72);
  assert.equal(study.GEOMETRIES['6x6'].lines.length, 12);
  assert.equal(study.GEOMETRIES['9x9'].boxes.length, 9);
  assert.equal(study.GEOMETRIES['6x6'].boxes.length, 6);
});

test('el estado vacío produce todas las colocaciones Sudoku esperadas', () => {
  const nine = study.createState(study.GEOMETRIES['9x9']);
  const six = study.createState(study.GEOMETRIES['6x6']);
  assert.equal(study.placementCandidates(nine, study.GEOMETRIES['9x9']).length, 729);
  assert.equal(study.placementCandidates(six, study.GEOMETRIES['6x6']).length, 216);
});

test('la transición parametrizada 9x9 coincide con el motor parchado', () => {
  const geometry = study.GEOMETRIES['9x9'];
  const termination = base.TERMINATIONS.find(item => item.id === 'limite-30');
  const zeroScoring = {
    place: 0,
    go: 0,
    line: 0,
    attack: {mode: 'none', value: 0},
  };
  const random = new base.Random(8341);
  let experimental = study.createState(geometry);
  let production = base.createState();

  for (let turn = 0; turn < 30; turn++) {
    const experimentalMoves = [
      ...study.placementCandidates(experimental, geometry),
      ...study.attackCandidates(experimental, geometry),
    ];
    const productionMoves = [
      ...base.placementCandidates(production),
      ...base.attackCandidates(production),
    ];
    assert.deepEqual(
      experimentalMoves.map(moveKey).sort(),
      productionMoves.map(moveKey).sort(),
    );
    const move = experimentalMoves[random.int(experimentalMoves.length)];
    const nextExperimental = study.transition(experimental, geometry, move);
    const nextProduction = base.applyMove(
      production,
      move,
      termination,
      zeroScoring,
    );
    assert.equal(Boolean(nextExperimental), Boolean(nextProduction));
    if (!nextExperimental) {
      turn--;
      continue;
    }
    experimental = nextExperimental.state;
    production = nextProduction.state;
    assert.deepEqual([...experimental.values], [...production.values]);
    assert.deepEqual([...experimental.owners], [...production.owners]);
    assert.equal(experimental.currentPlayer, production.currentPlayer);
    assert.equal(experimental.turn, production.turn);
  }
});

test('un ataque puntúa solo como ataque y no recibe puntos Go fantasma', () => {
  const geometry = study.GEOMETRIES['9x9'];
  const state = study.createState(geometry);
  state.owners[9] = 1;
  state.values[9] = 9;
  state.placedAt[9] = 1;
  state.owners[10] = 2;
  state.values[10] = 1;
  state.placedAt[10] = 2;
  state.turn = 2;
  const attack = study.legalApplied(state, geometry)
    .find(candidate => candidate.move.type === 'attack' &&
      candidate.move.source === 9 &&
      candidate.move.target === 10);
  assert.ok(attack);
  assert.equal(attack.result.immediateValue, 40);
  assert.equal(attack.result.state.breakdown.attack, 40);
  assert.equal(attack.result.state.breakdown.goCapture, 0);
});

test('la preparación se mide desde el primer contacto activo del cerco', () => {
  const geometry = study.GEOMETRIES['6x6'];
  const state = study.createState(geometry);
  const target = 7;
  state.owners[1] = 1;
  state.values[1] = 1;
  state.placedAt[1] = 1;
  state.owners[6] = 1;
  state.values[6] = 2;
  state.placedAt[6] = 2;
  state.owners[target] = 2;
  state.values[target] = 3;
  state.placedAt[target] = 3;
  state.owners[13] = 1;
  state.values[13] = 4;
  state.placedAt[13] = 4;
  state.turn = 4;
  const captured = study.transition(
    state,
    geometry,
    {type: 'place', index: 8, number: 5},
  );
  assert.equal(captured.captured, 1);
  assert.equal(captured.captureEvents.length, 1);
  assert.equal(captured.captureEvents[0].boundaryStoneTurns, 5);
  assert.equal(captured.captureEvents[0].activeEnclosureTurns, 3);
});

test('epsilon-greedy produce trayectorias y resultados no degenerados', () => {
  const condition = study.CONDITIONS.find(item => item.id === '6x6-t30');
  const games = Array.from({length: 12}, (_, index) =>
    study.playGame(condition, 0.10, 9000 + index * 101));
  const summary = study.summarizeGames(condition, 0.10, games);
  assert.ok(summary.uniqueTrajectories > 1);
  assert.ok(summary.explorationPercent.sd > 0);
  assert.ok(summary.capturePointShare.sd > 0);
});

test('los horizontes 9x9 emparejados conservan exactamente el mismo prefijo', () => {
  const short = study.CONDITIONS.find(item => item.id === '9x9-t30');
  const long = study.CONDITIONS.find(item => item.id === '9x9-t60');
  const shortGame = study.playGame(short, 0.10, 778899);
  const longGame = study.playGame(long, 0.10, 778899);
  assert.deepEqual(
    longGame.trajectory.split('|').slice(0, 30),
    shortGame.trajectory.split('|'),
  );
});
