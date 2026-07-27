'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const base = require('../simulations/phase2-3.js');
const study = require('../simulations/capture-rule-study.js');
const horizon = require('../simulations/go-horizon-study.js');

function variant(id) {
  return study.VARIANTS.find(item => item.id === id);
}

function setStone(state, index, owner, number, turn = 1) {
  state.owners[index] = owner;
  state.values[index] = number;
  state.placedAt[index] = turn;
}

function moveKey(move) {
  return move.type === 'place'
    ? `p:${move.index}:${move.number}`
    : `a:${move.source}:${move.target}`;
}

test('la puntuación visible contiene solo cuatro términos enteros', () => {
  assert.deepEqual(
    {
      place: study.SCORE_RULE.place,
      goCapturePerStone: study.SCORE_RULE.goCapturePerStone,
      line: study.SCORE_RULE.line,
      attack: study.SCORE_RULE.attack,
    },
    {place: 1, goCapturePerStone: 2, line: 3, attack: 1},
  );
  assert.ok(Object.values(study.SCORE_RULE)
    .filter(value => typeof value === 'number')
    .every(Number.isInteger));
});

test('el control reproduce tablero y marcador del motor con 1/2/3/1', () => {
  const control = variant('control');
  const termination = base.TERMINATIONS.find(item => item.id === 'limite-30');
  const scoring = {
    place: 1,
    go: 2,
    line: 3,
    attack: {mode: 'gain', value: 1},
  };
  const random = new base.Random(4917);
  let experimental = study.createState(control);
  let production = base.createState();
  for (let turn = 0; turn < 30; turn++) {
    const moves = [
      ...horizon.placementCandidates(experimental, horizon.GEOMETRIES['9x9']),
      ...horizon.attackCandidates(experimental, horizon.GEOMETRIES['9x9']),
    ];
    const move = moves[random.int(moves.length)];
    const nextExperimental = study.transition(experimental, move, control);
    const nextProduction = base.applyMove(production, move, termination, scoring);
    assert.equal(Boolean(nextExperimental), Boolean(nextProduction));
    if (!nextExperimental) {
      turn--;
      continue;
    }
    experimental = nextExperimental.state;
    production = nextProduction.state;
    assert.deepEqual([...experimental.values], [...production.values]);
    assert.deepEqual([...experimental.owners], [...production.owners]);
    assert.deepEqual([...experimental.scores], [...production.scores]);
  }
});

test('un ataque suma un punto de ataque y cero capturas Go', () => {
  const control = variant('control');
  const state = study.createState(control);
  setStone(state, 9, 1, 9);
  setStone(state, 10, 2, 1);
  const result = study.transition(
    state,
    {type: 'attack', source: 9, target: 10},
    control,
  );
  assert.ok(result);
  assert.equal(result.state.scores[1], 1);
  assert.equal(result.state.mechanics.attack[1], 1);
  assert.equal(result.state.mechanics.go[1], 0);
  assert.equal(result.captureEvents.length, 0);
});

test('V1 captura el atari si el defensor no gana libertad en su turno', () => {
  const rule = variant('v1-atari-sostenido');
  const state = study.createState(rule);
  setStone(state, 31, 1, 1, 1);
  setStone(state, 39, 1, 2, 2);
  setStone(state, 40, 2, 3, 3);
  state.turn = 3;
  const atari = study.transition(state, {type: 'place', index: 49, number: 4}, rule);
  assert.ok(atari);
  assert.equal(atari.state.owners[40], 2);
  assert.equal(atari.state.pendingAtari.length, 1);
  const failedDefense = study.transition(
    atari.state,
    {type: 'place', index: 0, number: 5},
    rule,
  );
  assert.ok(failedDefense);
  assert.equal(failedDefense.state.owners[40], 0);
  assert.equal(failedDefense.state.mechanics.go[1], 1);
  assert.equal(failedDefense.captureEvents.length, 1);
});

test('V2 captura un grupo de tres al cerrar la penúltima libertad', () => {
  const rule = variant('v2-grupo-grande');
  const state = study.createState(rule);
  setStone(state, 40, 2, 1);
  setStone(state, 41, 2, 2);
  setStone(state, 50, 2, 3);
  for (const [index, number] of [[31, 4], [39, 5], [49, 6], [32, 7], [42, 8]]) {
    setStone(state, index, 1, number);
  }
  const result = study.transition(
    state,
    {type: 'place', index: 59, number: 9},
    rule,
  );
  assert.ok(result);
  assert.equal(result.state.mechanics.go[1], 3);
  assert.equal(result.captureEvents[0].stones, 3);
});

test('V3 inicia con seis piedras válidas por bando y marcador en cero', () => {
  const rule = variant('v3-apertura-fija');
  const state = study.createState(rule);
  assert.equal([...state.owners].filter(owner => owner === 1).length, 6);
  assert.equal([...state.owners].filter(owner => owner === 2).length, 6);
  assert.deepEqual([...state.scores], [0, 0, 0]);
  assert.deepEqual([...state.mechanics.place], [0, 0, 0]);
  const candidates = horizon.placementCandidates(state, horizon.GEOMETRIES['9x9']);
  assert.ok(candidates.length > 0);
  const occupied = new Set([
    ...study.OPENING_GOLD.map(stone => stone.index),
    ...study.OPENING_PURPLE.map(stone => stone.index),
  ]);
  assert.ok(candidates.every(move => !occupied.has(move.index)));
});

test('V4 suma una sola vez los números de las piedras fronterizas', () => {
  const rule = variant('v4-presion-numerica');
  const state = study.createState(rule);
  setStone(state, 31, 1, 6);
  setStone(state, 40, 2, 3);
  const before = horizon.getGroup(state, horizon.GEOMETRIES['9x9'], 40);
  assert.equal(study.borderingNumberSum(before, state, 1), 6);
  const result = study.transition(
    state,
    {type: 'place', index: 39, number: 4},
    rule,
  );
  assert.ok(result);
  assert.equal(result.state.owners[40], 0);
  assert.equal(result.state.mechanics.go[1], 1);
});

test('la influencia usa diferenciales por jugador y excluye empates de marcador', () => {
  const games = [
    {scores: [0, 8, 3], mechanics: {go: [0, 2, 0]}},
    {scores: [0, 2, 6], mechanics: {go: [0, 0, 3]}},
    {scores: [0, 5, 5], mechanics: {go: [0, 1, 0]}},
    {scores: [0, 4, 1], mechanics: {go: [0, 0, 2]}},
  ];
  const metric = study.influence(games, 'go');
  assert.equal(metric.advantageGames, 4);
  assert.equal(metric.decisiveScores, 3);
  assert.equal(metric.winRate, 200 / 3);
  assert.equal(metric.conditionedScoreTiePercent, 25);
});

test('Wilson conserva el porcentaje observado dentro del intervalo', () => {
  const interval = study.wilsonInterval(71, 1000);
  assert.ok(interval.low < 7.1);
  assert.ok(interval.high > 7.1);
  assert.ok(interval.low > 5);
});

test('epsilon-greedy produce trayectorias y métricas no degeneradas', () => {
  const rule = variant('v4-presion-numerica');
  const games = Array.from({length: 12}, (_, index) =>
    study.playGame(rule, 0.10, 7000 + index * 101));
  const summary = study.summarize(rule, 0.10, games);
  assert.ok(summary.uniqueTrajectories > 1);
  assert.ok(summary.explorationPercent.sd > 0);
  assert.ok(summary.mechanisms.go.eventsPerGame.sd > 0);
});

test('las cinco definiciones de regla caben en una línea', () => {
  assert.equal(study.VARIANTS.length, 5);
  assert.ok(study.VARIANTS.every(item =>
    !item.rule.includes('\n') && item.rule.length < 120));
});
