import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageLightbox } from './image-lightbox.js';

class FakeClassList {
  constructor(...names) {
    this.names = new Set(names);
  }

  add(...names) {
    names.forEach((name) => this.names.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.names.delete(name));
  }

  contains(name) {
    return this.names.has(name);
  }

  toggle(name, force) {
    if (force === undefined ? !this.names.has(name) : force) {
      this.names.add(name);
      return true;
    }
    this.names.delete(name);
    return false;
  }
}

class FakeElement extends EventTarget {
  constructor({ classes = [], height = 600, width = 800 } = {}) {
    super();
    this.classList = new FakeClassList(...classes);
    this.clientHeight = height;
    this.clientWidth = width;
    this.offsetHeight = height;
    this.offsetWidth = width;
    this.style = {};
    this.capturedPointers = new Set();
  }

  getBoundingClientRect() {
    return { height: this.clientHeight, left: 0, top: 0, width: this.clientWidth };
  }

  hasPointerCapture(pointerId) {
    return this.capturedPointers.has(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.capturedPointers.delete(pointerId);
  }

  setPointerCapture(pointerId) {
    this.capturedPointers.add(pointerId);
  }
}

function pointerEvent(type, pointerType, x = 400, y = 300) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: y },
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
  });
  return event;
}

function pointerUp(pointerType, x = 400, y = 300) {
  return pointerEvent('pointerup', pointerType, x, y);
}

function createFixture() {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const modal = new FakeElement({ classes: ['hidden'] });
  const preview = new FakeElement({ height: 500, width: 700 });
  preview.src = '';
  preview.alt = '';
  const rootClassList = new FakeClassList();
  const bodyClassList = new FakeClassList();
  globalThis.document = {
    addEventListener() {},
    body: {
      classList: bodyClassList,
      style: {},
    },
    documentElement: { classList: rootClassList },
  };
  globalThis.window = {
    scrollTo() {},
    scrollX: 0,
    scrollY: 0,
  };
  const lightbox = createImageLightbox({ modal, preview });
  lightbox.open('https://i.redd.it/example.jpg');
  return {
    cleanup() {
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
    },
    modal,
    preview,
  };
}

test('desktop primary click toggles image zoom', () => {
  const fixture = createFixture();
  try {
    fixture.preview.dispatchEvent(pointerUp('mouse'));
    assert.match(fixture.preview.style.transform, /scale\(2\.5\)$/);
    assert.equal(fixture.modal.classList.contains('image-modal-zoomed'), true);

    fixture.preview.dispatchEvent(pointerUp('mouse'));
    assert.equal(fixture.preview.style.transform, '');
    assert.equal(fixture.modal.classList.contains('image-modal-zoomed'), false);
  } finally {
    fixture.cleanup();
  }
});

test('touch pointerup does not replace the existing double-tap gesture', () => {
  const fixture = createFixture();
  try {
    fixture.preview.dispatchEvent(pointerUp('touch'));
    assert.equal(fixture.preview.style.transform, '');
    assert.equal(fixture.modal.classList.contains('image-modal-zoomed'), false);
  } finally {
    fixture.cleanup();
  }
});

test('desktop drag pans a zoomed image without toggling zoom off', () => {
  const fixture = createFixture();
  try {
    fixture.preview.dispatchEvent(pointerUp('mouse'));
    fixture.preview.dispatchEvent(pointerEvent('pointerdown', 'mouse', 400, 300));
    assert.equal(fixture.modal.classList.contains('image-modal-panning'), true);
    assert.equal(fixture.preview.hasPointerCapture(1), true);

    fixture.preview.dispatchEvent(pointerEvent('pointermove', 'mouse', 520, 360));
    fixture.preview.dispatchEvent(pointerUp('mouse', 520, 360));

    assert.equal(fixture.preview.style.transform, 'translate3d(120px, 60px, 0) scale(2.5)');
    assert.equal(fixture.modal.classList.contains('image-modal-zoomed'), true);
    assert.equal(fixture.modal.classList.contains('image-modal-panning'), false);
    assert.equal(fixture.preview.hasPointerCapture(1), false);
  } finally {
    fixture.cleanup();
  }
});
