'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?: id="conquista-engine")?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]);

assert.equal(scripts.length, 2, 'index.html debe contener el motor y el adaptador de interfaz');

class MockClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach(name => this.values.add(name));
  }

  remove(...names) {
    names.forEach(name => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }

  toggle(name, force) {
    if (force === undefined) {
      if (this.values.has(name)) this.values.delete(name);
      else this.values.add(name);
      return this.values.has(name);
    }
    if (force) this.values.add(name);
    else this.values.delete(name);
    return force;
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.className = '';
    this.classList = new MockClassList();
    this.textContent = '';
    this.listeners = {};
    this._innerHTML = '';
  }

  set innerHTML(value) {
    this._innerHTML = value;
    if (value === '') this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  click() {
    if (this.listeners.click) this.listeners.click();
  }
}

function createBrowserContext() {
  const ids = [
    'board',
    'numSelector',
    'goldVal',
    'purpleVal',
    'scoreGold',
    'scorePurple',
    'status',
    'winnerOverlay',
    'winnerText',
    'winnerScore',
    'rulesPanel',
    'rulesOverlay',
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new MockElement()]));
  const document = {
    createElement: tagName => new MockElement(tagName),
    getElementById: id => elements[id],
  };
  const context = vm.createContext({
    document,
    setTimeout,
    clearTimeout,
    console,
  });
  vm.runInContext(scripts[0], context, {filename: 'conquista-engine.js'});
  vm.runInContext(scripts[1], context, {filename: 'conquista-ui.js'});
  return {context, elements};
}

test('la interfaz inicial dibuja 81 casillas y conserva el selector de números', () => {
  const {elements} = createBrowserContext();
  assert.equal(elements.board.children.length, 81);
  assert.equal(elements.numSelector.children.length, 10);
  assert.equal(elements.goldVal.textContent, 0);
  assert.equal(elements.purpleVal.textContent, 0);
  assert.match(elements.status.textContent, /Turno de Oro/);
});

test('una colocación desde la interfaz actualiza tablero, marcador y turno', () => {
  const {elements} = createBrowserContext();
  elements.numSelector.children[4].click();
  elements.board.children[0].click();
  assert.equal(elements.board.children[0].textContent, 5);
  assert.equal(elements.goldVal.textContent, 1);
  assert.match(elements.status.textContent, /Turno de Púrpura/);
});

test('pasar y deshacer restauran el turno visible', () => {
  const {context, elements} = createBrowserContext();
  context.passTurn();
  assert.match(elements.status.textContent, /Turno de Púrpura/);
  context.undoMove();
  assert.match(elements.status.textContent, /Turno de Oro/);
});

test('el flujo visual de ataque termina con el estado ya resuelto', async () => {
  const {elements} = createBrowserContext();

  elements.numSelector.children[7].click();
  elements.board.children[0].click();
  elements.numSelector.children[2].click();
  elements.board.children[1].click();

  elements.numSelector.children[9].click();
  elements.board.children[0].click();
  elements.board.children[1].click();

  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(elements.board.children[0].textContent, 8);
  assert.equal(elements.board.children[1].textContent, '');
  assert.equal(elements.goldVal.textContent, 2);
  assert.equal(elements.purpleVal.textContent, 1);
  assert.match(elements.status.textContent, /Turno de Púrpura/);
});

test('la interfaz no modifica directamente tablero, puntajes ni pases', () => {
  assert.doesNotMatch(scripts[1], /gameState\.board\[[^\]]+\]\s*=|gameState\.scores\[[^\]]+\]\s*=|consecutivePasses\s*[+\-=]/);
  assert.match(scripts[1], /Engine\.applyMove/);
});
