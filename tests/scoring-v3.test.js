'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createState,
  Random,
} = require('../simulations/phase2-3.js');
const v3 = require('../simulations/scoring-v3.js');
const depthV3 = require('../simulations/depth-v3.js');

test('v3 compara diez esquemas con tres desempates controlados', () => {
  assert.equal(v3.SCHEMES.length, 10);
  assert.deepEqual(
    v3.TIE_RULES.map(item => item.id),
    ['aleatorio', 'libertades', 'lineas'],
  );
  assert.equal(v3.taskList(1, 7).length, 30);
});

test('la puntuación por número discrimina valores de colocación', () => {
  const state = createState();
  const scheme = v3.SCHEMES.find(item => item.id === 'numero');
  const low = v3.applyScoredMove(state, {type: 'place', index: 0, number: 1}, scheme);
  const high = v3.applyScoredMove(state, {type: 'place', index: 0, number: 9}, scheme);
  assert.equal(low.result, undefined);
  assert.equal(low.immediateValue, 1);
  assert.equal(high.immediateValue, 9);
});

test('la métrica única cuenta movimientos y valores distintos por separado', () => {
  const legal = [
    {result: {immediateValue: 1}},
    {result: {immediateValue: 1}},
    {result: {immediateValue: 2}},
    {result: {immediateValue: 3}},
  ];
  const result = v3.discrimination(legal);
  assert.equal(result.uniqueMovePercent, 50);
  assert.equal(result.distinctValuePercent, 75);
  assert.equal(result.bestTiePercent, 25);
});

test('los tres desempates conservan el máximo valor inmediato', () => {
  const scheme = v3.SCHEMES.find(item => item.id === 'posicional');
  for (const tieRule of v3.TIE_RULES.map(item => item.id)) {
    const state = createState();
    const legal = v3.legalApplied(state, scheme);
    const maximum = Math.max(...legal.map(candidate => candidate.result.immediateValue));
    const choice = v3.chooseGreedy(state, scheme, tieRule, new Random(42));
    assert.equal(choice.selected.result.immediateValue, maximum);
  }
});

test('una ejecución pequeña reporta reparto, discriminación y primer jugador', () => {
  const scheme = v3.SCHEMES.find(item => item.id === 'cierres');
  const result = v3.runCombination(scheme, 'aleatorio', 3, 123);
  assert.equal(result.games, 3);
  assert.ok(result.uniqueMovePercent >= 0 && result.uniqueMovePercent <= 100);
  assert.equal(result.firstWinPercent + result.secondWinPercent + result.drawPercent, 100);
  const total = Object.values(result.shares).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 100) < 1e-6);
});

test('la búsqueda selectiva conserva al menos doce candidatos por nodo', () => {
  const state = createState();
  const scheme = v3.SCHEMES.find(item => item.id === 'multi-gp1-l30-a84');
  const candidates = depthV3.selectiveCandidates(state, scheme);
  assert.ok(candidates.length >= 12);
  assert.equal(depthV3.WIDTH, 12);
});
