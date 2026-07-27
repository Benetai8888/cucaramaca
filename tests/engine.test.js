'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const engineMatch = html.match(/<script id="conquista-engine">([\s\S]*?)<\/script>/);

assert.ok(engineMatch, 'El motor debe existir como módulo identificable dentro de index.html');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(engineMatch[1], sandbox, {filename: 'conquista-engine.js'});
const Engine = sandbox.ConquistaEngine;
const {EMPTY, GOLD, PURPLE} = Engine;
const plain = value => JSON.parse(JSON.stringify(value));

function boardWith(pieces) {
  const board = Array.from({length: 81}, () => ({value: 0, owner: EMPTY}));
  for (const [index, value, owner] of pieces) board[index] = {value, owner};
  return board;
}

test('el motor no depende del DOM ni de temporizadores', () => {
  assert.doesNotMatch(engineMatch[1], /\bdocument\b|\bwindow\b|\bsetTimeout\b|\bsetInterval\b/);
});

test('crea un estado inicial independiente y válido', () => {
  const first = Engine.createState();
  const second = Engine.createState();
  assert.equal(first.board.length, 81);
  assert.ok(first.board.every(cell => cell.value === 0 && cell.owner === EMPTY));
  assert.notStrictEqual(first.board, second.board);
  assert.deepEqual(plain(first.scores), {[GOLD]: 0, [PURPLE]: 0});
  assert.equal(first.currentPlayer, GOLD);
  assert.equal(first.turn, 0);
});

test('conserva las restricciones Sudoku por fila, columna y subcaja', () => {
  const state = Engine.createState({
    board: boardWith([
      [0, 5, GOLD],
      [13, 6, PURPLE],
      [20, 7, GOLD],
    ]),
  });
  assert.equal(Engine.isValidPlacement(state, 8, 5), false, 'fila');
  assert.equal(Engine.isValidPlacement(state, 45, 5), false, 'columna');
  assert.equal(Engine.isValidPlacement(state, 10, 5), false, 'subcaja');
  assert.equal(Engine.isValidPlacement(state, 80, 5), true);
});

test('applyMove coloca de forma inmutable, puntúa y cambia el turno', () => {
  const original = Engine.createState();
  const next = Engine.applyMove(original, {type: 'place', index: 0, number: 5});
  assert.notStrictEqual(next, original);
  assert.notStrictEqual(next.board, original.board);
  assert.deepEqual(plain(original.board[0]), {value: 0, owner: EMPTY});
  assert.deepEqual(plain(next.board[0]), {value: 5, owner: GOLD});
  assert.equal(next.scores[GOLD], 1);
  assert.equal(next.currentPlayer, PURPLE);
  assert.equal(next.turn, 1);
  assert.equal(next.history.length, 1);
});

test('rechaza una jugada ilegal sin alterar el estado', () => {
  const state = Engine.createState({board: boardWith([[0, 5, GOLD]])});
  const result = Engine.applyMove(state, {type: 'place', index: 8, number: 5});
  assert.equal(result.error, 'COLOCACION_INVALIDA');
  assert.notStrictEqual(result.board, state.board);
  assert.deepEqual(plain(result.board), plain(state.board));
  assert.equal(result.turn, 0);
  assert.equal(result.history.length, 0);
});

test('resuelve una captura Go dentro de la transición síncrona', () => {
  const state = Engine.createState({
    board: boardWith([
      [1, 2, PURPLE],
      [0, 1, GOLD],
      [2, 3, GOLD],
    ]),
    currentPlayer: GOLD,
  });
  const next = Engine.applyMove(state, {type: 'place', index: 10, number: 4});
  assert.equal(next.error, null);
  assert.deepEqual(plain(next.board[1]), {value: 0, owner: EMPTY});
  assert.equal(next.scores[GOLD], 3, '1 por colocar y 2 por capturar');
  assert.deepEqual(plain(next.effects), [{type: 'capture', indices: [1]}]);
});

test('un ataque válido elimina al objetivo y deja intacta la fuente', () => {
  const state = Engine.createState({
    board: boardWith([
      [0, 8, GOLD],
      [1, 3, PURPLE],
    ]),
  });
  const next = Engine.applyMove(state, {type: 'attack', source: 0, target: 1});
  assert.deepEqual(plain(next.board[0]), {value: 8, owner: GOLD});
  assert.deepEqual(plain(next.board[1]), {value: 0, owner: EMPTY});
  assert.equal(next.scores[GOLD], 1);
  assert.equal(next.currentPlayer, PURPLE);
});

test('detecta y puntúa una línea dentro de una subcaja', () => {
  const state = Engine.createState({
    board: boardWith([
      [0, 1, GOLD],
      [1, 2, GOLD],
    ]),
  });
  const next = Engine.applyMove(state, {type: 'place', index: 2, number: 3});
  assert.equal(next.scores[GOLD], 4, '1 por colocar y 3 por la línea');
  assert.deepEqual(plain(next.effects), [{type: 'line', lines: [[0, 1, 2]]}]);
});

test('deshacer restaura exactamente el estado anterior, incluidos los pases', () => {
  const initial = Engine.createState();
  const afterPass = Engine.applyMove(initial, {type: 'pass'});
  assert.equal(afterPass.consecutivePasses, 1);
  const restored = Engine.applyMove(afterPass, {type: 'undo'});
  assert.deepEqual(plain(restored.board), plain(initial.board));
  assert.deepEqual(plain(restored.scores), plain(initial.scores));
  assert.equal(restored.currentPlayer, initial.currentPlayer);
  assert.equal(restored.consecutivePasses, initial.consecutivePasses);
  assert.equal(restored.turn, initial.turn);
  assert.equal(restored.history.length, 0);
});

test('dos pases consecutivos terminan la partida', () => {
  const first = Engine.applyMove(Engine.createState(), {type: 'pass'});
  const second = Engine.applyMove(first, {type: 'pass'});
  assert.equal(second.gameOver, true);
  assert.equal(second.winner, EMPTY);
});

test('una jugada inválida devuelve un estado profundamente independiente', () => {
  const state = Engine.applyMove(Engine.createState(), {type: 'pass'});
  const result = Engine.applyMove(state, {type: 'desconocida'});

  assert.equal(result.error, 'TIPO_DESCONOCIDO');
  assert.notStrictEqual(result.board, state.board);
  assert.notStrictEqual(result.scores, state.scores);
  assert.notStrictEqual(result.completedLines, state.completedLines);
  assert.notStrictEqual(result.history, state.history);
  assert.notStrictEqual(result.history[0], state.history[0]);
  assert.notStrictEqual(result.history[0].board, state.history[0].board);
});

test('applyMove rechaza explícitamente un estado nulo o estructuralmente inválido', () => {
  assert.throws(
    () => Engine.applyMove(null, {type: 'pass'}),
    {name: 'TypeError', message: /estado/i},
  );
  assert.throws(
    () => Engine.applyMove({board: []}, {type: 'pass'}),
    {name: 'TypeError', message: /estado/i},
  );
});

test('deshacer queda bloqueado después de terminar la partida', () => {
  const first = Engine.applyMove(Engine.createState(), {type: 'pass'});
  const finished = Engine.applyMove(first, {type: 'pass'});
  const result = Engine.applyMove(finished, {type: 'undo'});

  assert.equal(result.error, 'JUEGO_TERMINADO');
  assert.equal(result.gameOver, true);
  assert.equal(result.turn, finished.turn);
  assert.equal(result.history.length, finished.history.length);
});

test('el historial y su memoria permanecen acotados durante 3,000 turnos', () => {
  let state = Engine.createState();
  for (let turn = 0; turn < 3000; turn++) {
    state = Engine.createState({
      ...state,
      gameOver: false,
      consecutivePasses: 0,
    });
    state = Engine.applyMove(state, {type: 'pass'});
  }

  const historyBytes = Buffer.byteLength(JSON.stringify(state.history), 'utf8');
  assert.ok(state.history.length <= 50, `historial sin límite: ${state.history.length}`);
  assert.ok(historyBytes <= 250_000, `historial excesivo: ${historyBytes} bytes`);
});

test('soporta partidas aleatorias prolongadas sin corromper invariantes', () => {
  let seed = 0x6d2b79f5;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const pick = values => values[Math.floor(random() * values.length)];

  function assertSudokuInvariant(state) {
    const units = [];
    for (let index = 0; index < 9; index++) {
      units.push(Array.from({length: 9}, (_, offset) => index * 9 + offset));
      units.push(Array.from({length: 9}, (_, offset) => offset * 9 + index));
      const boxRow = Math.floor(index / 3) * 3;
      const boxCol = (index % 3) * 3;
      units.push(Array.from({length: 9}, (_, offset) =>
        (boxRow + Math.floor(offset / 3)) * 9 + boxCol + offset % 3));
    }
    for (const unit of units) {
      const values = unit.map(index => state.board[index].value).filter(Boolean);
      assert.equal(new Set(values).size, values.length);
    }
  }

  for (let game = 0; game < 20; game++) {
    let state = Engine.createState();
    for (let turn = 0; turn < 200 && !state.gameOver; turn++) {
      const placements = [];
      for (let number = 1; number <= 9; number++) {
        for (const index of Engine.getLegalPlacements(state, number)) {
          placements.push({type: 'place', index, number});
        }
      }
      const attacks = Engine.getLegalAttacks(state).map(attack => ({type: 'attack', ...attack}));
      const pool = attacks.length > 0 && random() < 0.5 ? attacks : placements;
      const move = pool.length > 0 ? pick(pool) : {type: 'pass'};
      state = Engine.applyMove(state, move);

      assert.equal(state.error, null);
      assert.equal(state.board.length, 81);
      assert.ok(state.board.every(cell =>
        Number.isInteger(cell.value) && cell.value >= 0 && cell.value <= 9 &&
        [EMPTY, GOLD, PURPLE].includes(cell.owner)));
      assert.ok(state.scores[GOLD] >= 0 && state.scores[PURPLE] >= 0);
      assertSudokuInvariant(state);
    }
  }
});
