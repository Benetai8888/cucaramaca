'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TERMINATIONS,
  SCORINGS,
  Random,
  createState,
  placementCandidates,
  applyMove,
  playGame,
  runRandomMatrix,
} = require('../simulations/phase2-3.js');

test('la matriz contiene exactamente tres terminaciones por cuatro puntuaciones', () => {
  assert.equal(TERMINATIONS.length, 3);
  assert.equal(SCORINGS.length, 4);
  assert.equal(new Set(TERMINATIONS.map(item => item.id)).size, 3);
  assert.equal(new Set(SCORINGS.map(item => item.id)).size, 4);
});

test('las celdas capturadas quedan bloqueadas solo en el esquema de cicatrices', () => {
  const termination = TERMINATIONS.find(item => item.id === 'cicatrices-8');
  const scoring = SCORINGS.find(item => item.id === 'actual');
  const state = createState();
  state.values[0] = 8;
  state.owners[0] = 1;
  state.values[1] = 3;
  state.owners[1] = 2;

  const result = applyMove(
    state,
    {type: 'attack', source: 0, target: 1},
    termination,
    scoring,
  );
  assert.equal(result.state.blocked[1], 1);
  assert.equal(result.state.blockedCount, 1);
  assert.equal(placementCandidates(result.state).some(move => move.index === 1), false);
});

test('el esquema de desgaste resta puntos al rival al atacar', () => {
  const termination = TERMINATIONS.find(item => item.id === 'limite-30');
  const scoring = SCORINGS.find(item => item.id === 'desgaste-leve');
  const state = createState();
  state.values[0] = 8;
  state.owners[0] = 1;
  state.values[1] = 3;
  state.owners[1] = 2;

  const result = applyMove(
    state,
    {type: 'attack', source: 0, target: 1},
    termination,
    scoring,
  );
  assert.equal(result.state.scores[1], 0);
  assert.equal(result.state.scores[2], -0.1);
  assert.equal(result.state.breakdown.attack, 0.1);
});

test('una misma semilla produce la misma partida', () => {
  const termination = TERMINATIONS[1];
  const scoring = SCORINGS[3];
  const first = playGame({termination, scoring, random: new Random(12345)});
  const second = playGame({termination, scoring, random: new Random(12345)});
  assert.deepEqual(first, second);
});

test('la ejecución pequeña genera las doce filas y métricas finitas', () => {
  const results = runRandomMatrix(5, 9981);
  assert.equal(results.length, 12);
  for (const result of results) {
    assert.ok(Number.isFinite(result.meanTurns));
    assert.ok(Number.isFinite(result.stdTurns));
    assert.ok(Number.isFinite(result.meanMargin));
    assert.ok(result.drawPercent >= 0 && result.drawPercent <= 100);
    const shareTotal = Object.values(result.shares).reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(shareTotal - 100) < 1e-6 || shareTotal === 0);
  }
});
