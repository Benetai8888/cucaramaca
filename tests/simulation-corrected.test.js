'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TERMINATIONS,
  SCORINGS,
  Random,
  createState,
  placementCandidates,
  attackCandidates,
  applyMove,
} = require('../simulations/phase2-3.js');
const {
  POLICY_IDS,
  analyzeMoves,
  uniformChoice,
  greedyChoice,
  searchChoice,
  wilsonInterval,
  runSelfPlay,
  runMatchup,
} = require('../simulations/phase2-3-corrected.js');

const termination = TERMINATIONS.find(item => item.id === 'limite-30');
const scoring = SCORINGS.find(item => item.id === 'actual');

test('define A, B, C y la búsqueda D en profundidades 2 y 3', () => {
  assert.deepEqual(POLICY_IDS, ['A', 'B', 'C', 'D2', 'D3']);
});

test('A elige uniformemente entre jugadas, no entre familias', () => {
  const state = createState();
  state.values[0] = 9;
  state.owners[0] = 1;
  state.values[1] = 1;
  state.owners[1] = 2;
  const legalPlacements = placementCandidates(state).filter(move =>
    applyMove(state, move, termination, scoring));
  const legalAttacks = attackCandidates(state).filter(move =>
    applyMove(state, move, termination, scoring));
  const expected = legalAttacks.length / (legalPlacements.length + legalAttacks.length);
  const random = new Random(19051977);
  let attacks = 0;
  const samples = 12000;
  for (let sample = 0; sample < samples; sample++) {
    if (uniformChoice(state, termination, scoring, random).move.type === 'attack') attacks++;
  }
  assert.ok(Math.abs(attacks / samples - expected) < 0.006);
});

test('B toma la mayor ganancia inmediata disponible', () => {
  const state = createState();
  state.values[1] = 3;
  state.owners[1] = 2;
  state.values[2] = 4;
  state.owners[2] = 1;
  state.values[10] = 5;
  state.owners[10] = 1;
  const records = analyzeMoves(state, termination, scoring);
  const choice = greedyChoice(state, termination, scoring, new Random(7), false);
  const selected = records.find(record =>
    record.move.type === choice.move.type &&
    record.move.index === choice.move.index &&
    record.move.number === choice.move.number);
  assert.equal(selected.vector[0], Math.max(...records.map(record => record.vector[0])));
});

test('C aplica todos los desempates posicionales después del valor inmediato', () => {
  const state = createState();
  state.values[0] = 2;
  state.owners[0] = 1;
  state.values[10] = 1;
  state.owners[10] = 2;
  const records = analyzeMoves(state, termination, scoring);
  const choice = greedyChoice(state, termination, scoring, new Random(11), true);
  const selected = records.find(record =>
    record.move.type === choice.move.type &&
    record.move.index === choice.move.index &&
    record.move.number === choice.move.number);
  const greater = records.some(record => {
    for (let index = 0; index < 4; index++) {
      if (record.vector[index] > selected.vector[index]) return true;
      if (record.vector[index] < selected.vector[index]) return false;
    }
    return false;
  });
  assert.equal(greater, false);
});

test('D2 y D3 producen decisiones legales y reproducibles', () => {
  const state = createState();
  state.values[0] = 7;
  state.owners[0] = 1;
  state.values[1] = 2;
  state.owners[1] = 2;
  for (const depth of [2, 3]) {
    const first = searchChoice(state, termination, scoring, new Random(99), depth);
    const second = searchChoice(state, termination, scoring, new Random(99), depth);
    assert.deepEqual(first.move, second.move);
    assert.ok(applyMove(state, first.move, termination, scoring));
  }
});

test('las ejecuciones pequeñas de autopartida y enfrentamiento son finitas', () => {
  const self = runSelfPlay('C', termination, scoring, 3, 123);
  assert.equal(self.games, 3);
  assert.ok(Number.isFinite(self.meanTurns));
  const matchup = runMatchup('D3', 'D2', termination, scoring, 4, 456);
  assert.equal(matchup.games, 4);
  assert.equal(matchup.leftWins + matchup.rightWins + matchup.draws, 4);
});

test('Wilson solo acredita ventaja cuando el límite inferior supera 50%', () => {
  assert.ok(wilsonInterval(600, 1000).low > 0.5);
  assert.ok(wilsonInterval(520, 1000).low < 0.5);
});
