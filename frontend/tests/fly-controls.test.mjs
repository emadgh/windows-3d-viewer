import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FlyControls } from '../src/fly-controls.js';

// Minimal DOM propagation harness, including capture before OrbitControls and
// window shortcut listeners. Camera/orbit math uses the actual Three.js classes.
class Surface {
  handlers = new Map();
  style = {};
  captures = new Set();
  addEventListener(type, handler, options) {
    const capture = options === true || Boolean(options?.capture);
    const entries = this.handlers.get(type) || [];
    entries.push({ handler, capture });
    this.handlers.set(type, entries);
  }
  removeEventListener(type, handler) {
    this.handlers.set(type, (this.handlers.get(type) || []).filter((entry) => entry.handler !== handler));
  }
  getRootNode() { return this.ownerDocument; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
  focus() { this.focused = true; }
  clientHeight = 600;
  clientWidth = 800;
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  emit(type, props = {}) {
    const event = {
      type, target: this, pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100,
      button: 0, buttons: 0, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false,
      prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
      ...props,
    };
    const doc = this.ownerDocument;
    const path = doc ? [doc.defaultView, doc, this] : [this];
    for (const capture of [true, false]) {
      for (const surface of capture ? path : path.toReversed()) {
        for (const entry of [...(surface.handlers.get(type) || [])]) {
          if (entry.capture === capture) entry.handler(event);
          if (event.stopped) return event;
        }
      }
    }
    return event;
  }
}
function setup(options = {}) {
  const win = new Surface();
  const doc = new Surface();
  const element = new Surface();
  doc.defaultView = win;
  element.ownerDocument = doc;
  const camera = new PerspectiveCamera(45, 1, 0.01, 1000);
  camera.position.set(3, 2, 5);
  const orbit = new OrbitControls(camera, element);
  orbit.enableDamping = true;
  orbit.mouseButtons.RIGHT = null;
  orbit.update();
  const fly = new FlyControls(camera, orbit, element, { getSpeed: () => 4, ...options });
  const start = () => element.emit('pointerdown', { button: 2, buttons: 2 });
  const key = (code, type = 'keydown') => win.emit(type, { code, key: code.slice(3).toLowerCase() });
  return { camera, orbit, fly, element, win, doc, start, key };
}
function close(a, b, epsilon = 1e-8) {
  assert.ok(a.distanceTo(b) < epsilon, `${a.toArray()} != ${b.toArray()}`);
}

test('only right hold enters flight; ordinary left drag still orbits', () => {
  const { element, camera, fly, orbit, start } = setup();
  const initial = camera.position.clone();
  element.emit('pointerdown', { button: 0, buttons: 1 });
  element.emit('pointermove', { buttons: 1, clientX: 150 });
  assert.equal(fly.active, false);
  assert.ok(camera.position.distanceTo(initial) > 0.01);
  element.emit('pointerup');
  start();
  assert.equal(fly.active, true);
  assert.equal(orbit.enabled, false);
  assert.equal(orbit._pointers.length, 0);
  const position = camera.position.clone();
  const quaternion = camera.quaternion.clone();
  element.emit('pointermove', { buttons: 2, clientX: 200, clientY: 150 });
  close(camera.position, position);
  assert.ok(camera.quaternion.angleTo(quaternion) > 0.01);
  element.emit('pointerup', { button: 2, buttons: 0 });
  assert.equal(fly.active, false);
  assert.equal(orbit.enabled, true);
});

test('WASD and Q/E follow pitched camera axes and never trigger viewer shortcuts', () => {
  for (const [code, local] of [
    ['KeyW', [0, 0, -1]], ['KeyS', [0, 0, 1]],
    ['KeyA', [-1, 0, 0]], ['KeyD', [1, 0, 0]],
    ['KeyQ', [0, -1, 0]], ['KeyE', [0, 1, 0]],
  ]) {
    const { camera, fly, win, start, key } = setup();
    let shortcutCount = 0;
    win.addEventListener('keydown', () => shortcutCount++);
    start();
    fly.look(50, -120);
    const before = camera.position.clone();
    const expected = new Vector3(...local).applyQuaternion(camera.quaternion).multiplyScalar(0.2).add(before);
    assert.equal(key(code).prevented, true);
    fly.update(0.05);
    close(camera.position, expected);
    assert.equal(shortcutCount, 0);
    key(code, 'keyup');
    const stopped = camera.position.clone();
    fly.update(0.05);
    close(camera.position, stopped);
    fly.stop();
    key(code);
    assert.equal(shortcutCount, 1);
  }
});

test('flight suppresses nonmovement shortcuts, Ctrl+S, Tab, wheel and context menus', () => {
  const { win, element, start, fly } = setup();
  let shortcuts = 0;
  win.addEventListener('keydown', () => shortcuts++);
  start();
  for (const props of [{ code: 'KeyR' }, { code: 'KeyS', ctrlKey: true }, { code: 'Tab' }, { code: 'KeyF' }]) {
    assert.equal(win.emit('keydown', props).prevented, true);
  }
  assert.equal(shortcuts, 0);
  assert.equal(element.emit('wheel', { deltaY: 100 }).prevented, true);
  assert.equal(element.emit('contextmenu').prevented, true);
  win.emit('keydown', { code: 'Escape' });
  assert.equal(fly.active, false);
});

test('diagonal movement is normalized and stops immediately on right release', () => {
  const { camera, fly, start, key, element } = setup();
  start();
  const before = camera.position.clone();
  key('KeyW'); key('KeyD'); key('KeyE');
  fly.update(0.05);
  assert.ok(Math.abs(camera.position.distanceTo(before) - 0.2) < 1e-8);
  // Releasing left while right is still down must not end flight.
  element.emit('pointerup', { button: 0, buttons: 2 });
  assert.equal(fly.active, true);
  element.emit('pointerup', { button: 2, buttons: 0 });
  const stopped = camera.position.clone();
  fly.update(0.05);
  close(camera.position, stopped);
  assert.equal(fly.keys.size, 0);
});

test('return to orbit preserves position/look direction despite previous damping', () => {
  const { camera, orbit, element, start, fly, key } = setup();
  element.emit('pointerdown', { buttons: 1 });
  element.emit('pointermove', { buttons: 1, clientX: 180 });
  element.emit('pointerup');
  start();
  fly.look(80, -40);
  key('KeyW'); fly.update(0.05);
  const position = camera.position.clone();
  const forward = camera.getWorldDirection(new Vector3());
  fly.stop();
  for (let i = 0; i < 10; i++) orbit.update();
  close(camera.position, position);
  close(camera.getWorldDirection(new Vector3()), forward);
  assert.equal(orbit.enableDamping, true);
});

test('blur, cancellation, lost capture, missing right button and hidden document safely end flight', () => {
  for (const exit of ['blur', 'pointercancel', 'lostpointercapture', 'pointermove', 'visibilitychange']) {
    const { start, fly, win, element, doc, key } = setup();
    start(); key('KeyW');
    if (exit === 'blur') win.emit(exit);
    else if (exit === 'visibilitychange') { doc.hidden = true; doc.emit(exit); }
    else element.emit(exit, { buttons: 0 });
    assert.equal(fly.active, false, exit);
    assert.equal(fly.keys.size, 0, exit);
    assert.equal(element.captures.size, 0, exit);
  }
});

test('editing/modal guards prevent flight, and disposal removes listeners', () => {
  const blocked = setup({ canStart: () => false });
  blocked.start();
  assert.equal(blocked.fly.active, false);
  const disabled = setup();
  disabled.orbit.enabled = false;
  disabled.start();
  assert.equal(disabled.fly.active, false);
  const { fly, start, orbit } = setup();
  start(); fly.dispose(); start();
  assert.equal(fly.active, false);
  assert.equal(orbit.enabled, true);
});


test('middle drag pans without rotating or zooming, including Ctrl/Shift/Meta modifiers', () => {
  for (const modifier of [{}, { ctrlKey: true }, { shiftKey: true }, { metaKey: true }]) {
    const { camera, orbit, element, fly } = setup();
    orbit.enableDamping = false;
    const position = camera.position.clone();
    const target = orbit.target.clone();
    const quaternion = camera.quaternion.clone();
    const distance = camera.position.distanceTo(orbit.target);
    element.emit('pointerdown', { button: 1, buttons: 4, ...modifier });
    element.emit('pointermove', { button: 1, buttons: 4, clientX: 160, clientY: 140, ...modifier });
    assert.equal(fly.active, false);
    assert.ok(orbit.target.distanceTo(target) > 0.01);
    close(camera.position.clone().sub(position), orbit.target.clone().sub(target));
    assert.ok(camera.quaternion.angleTo(quaternion) < 1e-7);
    assert.ok(Math.abs(camera.position.distanceTo(orbit.target) - distance) < 1e-8);
    element.emit('pointerup', { button: 1 });
  }
});

test('Alt + middle drag zooms without panning or rotating, then plain middle returns to pan', () => {
  const { camera, orbit, element, fly } = setup();
  orbit.enableDamping = false;
  const target = orbit.target.clone();
  const quaternion = camera.quaternion.clone();
  const distance = camera.position.distanceTo(orbit.target);
  element.emit('pointerdown', { button: 1, buttons: 4, altKey: true });
  element.emit('pointermove', { button: 1, buttons: 4, altKey: true, clientY: 150 });
  assert.equal(fly.active, false);
  assert.ok(Math.abs(camera.position.distanceTo(orbit.target) - distance) > 0.01);
  close(orbit.target, target);
  assert.ok(camera.quaternion.angleTo(quaternion) < 1e-7);
  element.emit('pointerup', { button: 1 });
  const afterZoom = camera.position.distanceTo(orbit.target);
  element.emit('pointerdown', { button: 1, buttons: 4 });
  element.emit('pointermove', { button: 1, buttons: 4, clientX: 170 });
  assert.ok(orbit.target.distanceTo(target) > 0.01);
  assert.ok(Math.abs(camera.position.distanceTo(orbit.target) - afterZoom) < 1e-8);
  element.emit('pointerup', { button: 1 });
});
