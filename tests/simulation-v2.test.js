'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const base = require('../simulations/phase2-3.js');
const v2 = require('../simulations/phase2-3-v2.js');

const {TERMINATIONS, SCORINGS, Random, createState, applyMove} = base;

test('A elige uniformemente sobre jugadas legales, no sobre familias', () => {
  const termination = TERMINATIONS[1];
  const scoring = SCORINGS[0];
  const state = createState();
  state.values[0] = 8;
  state.owners[0] = 1;
  state.values[1] = 3;
  state.owners[1] = 2;
  const legal = v2.allLegalApplied(state, termination, scoring);
  const attackCount = legal.filter(candidate => candidate.move.type === 'attack').length;
  assert.ok(attackCount > 0);

  const random = new Random(7712);
  let attacks = 0;
  const samples = 20_000;
  for (let index = 0; index < samples; index++) {
    if (v2.chooseUniform(state, termination, scoring, random).move.type === 'attack') attacks++;
  }
  const observed = attacks / samples;
  const expected = attackCount / legal.length;
  assert.ok(Math.abs(observed - expected) < 0.01, `${observed} contra ${expected}`);
});

test('B elige la mayor ganancia inmediata disponible', () => {
  const termination = TERMINATIONS[1];
  const scoring = SCORINGS[0];
  const state = createState();
  state.values[0] = 1;
  state.owners[0] = 1;
  state.values[1] = 2;
  state.owners[1] = 1;
  const selected = v2.chooseGreedy(state, termination, scoring, new Random(12));
  assert.equal(selected.result.lines, 1);
  assert.equal(selected.result.state.scores[1], 4);
});

test('C usa el valor posicional únicamente para desempatar puntos', () => {
  const termination = TERMINATIONS[1];
  const scoring = SCORINGS[0];
  const state = createState();
  state.values[0] = 1;
  state.owners[0] = 1;
  const selected = v2.choosePositionalGreedy(state, termination, scoring, new Random(44));
  const before = v2.positionalValue(state, 1);
  const after = v2.positionalValue(selected.result.state, 1);
  assert.ok(after >= before);
  assert.equal(selected.result.state.scores[1], 1);
});

test('D2 y D3 siempre devuelven una jugada legal', () => {
  const termination = TERMINATIONS[1];
  const scoring = SCORINGS[0];
  let state = createState();
  state = applyMove(state, {type: 'place', index: 0, number: 5}, termination, scoring).state;
  for (const [policy, depth] of [['D2', 2], ['D3', 3]]) {
    const selected = v2.chooseSearch(state, termination, scoring, new Random(depth), depth);
    assert.ok(selected);
    assert.equal(selected.result.state.turn, state.turn + 1, policy);
  }
});

test('la lista de trabajo cubre cuatro políticas y dos criterios en 12 combinaciones', () => {
  const tasks = v2.makeTasks(1, 7);
  assert.equal(tasks.length, 72);
  assert.equal(tasks.filter(task => task.kind === 'self').length, 48);
  assert.equal(tasks.filter(task => task.kind === 'matchup').length, 24);
});
