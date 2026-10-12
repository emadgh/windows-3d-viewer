import { Euler, MOUSE, Vector3 } from 'three';

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']);

export class FlyControls {
  constructor(camera, orbit, element, { canStart = () => true, getSpeed = () => 1, onChange = () => {}, onActiveChange = () => {} } = {}) {
    this.camera = camera;
    this.orbit = orbit;
    orbit.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: null };
    this.element = element;
    this.canStart = canStart;
    this.getSpeed = getSpeed;
    this.onChange = onChange;
    this.onActiveChange = onActiveChange;
    this.active = false;
    this.keys = new Set();
    this.rotation = new Euler(0, 0, 0, 'YXZ');
    this.direction = new Vector3();
    this.listeners = [];
    const doc = element.ownerDocument;
    const win = doc.defaultView;
    const listen = (target, type, handler) => {
      target.addEventListener(type, handler, true);
      this.listeners.push(() => target.removeEventListener(type, handler, true));
    };
    const consume = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    listen(element, 'pointerdown', (event) => {
      if (this.active) { consume(event); return; }
      if (event.button === 1 && event.pointerType === 'mouse') {
        // OrbitControls swaps PAN/ROTATE for Ctrl/Shift/Meta. Compensate for
        // that toggle so middle-drag always pans; Alt always selects dolly.
        const modified = event.ctrlKey || event.shiftKey || event.metaKey;
        this.orbit.mouseButtons.MIDDLE = event.altKey ? MOUSE.DOLLY : (modified ? MOUSE.ROTATE : MOUSE.PAN);
        return;
      }
      if (event.button !== 2 || event.pointerType !== 'mouse') return;
      consume(event);
      if (this.orbit.enabled && this.canStart() && !(event.buttons & 1)) this.start(event);
    });
    listen(win, 'pointermove', (event) => {
      if (!this.active || event.pointerId !== this.pointerId) return;
      if (!(event.buttons & 2)) { this.stop(); return; }
      consume(event);
      this.look(event.clientX - this.lastX, event.clientY - this.lastY);
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    });
    listen(win, 'pointerup', (event) => {
      if (!this.active || event.pointerId !== this.pointerId) return;
      consume(event);
      if (!(event.buttons & 2)) this.stop();
    });
    listen(win, 'pointercancel', () => this.stop());
    listen(element, 'lostpointercapture', () => this.stop());
    listen(element, 'contextmenu', (event) => event.preventDefault());
    listen(element, 'wheel', (event) => { if (this.active) consume(event); });
    listen(win, 'keydown', (event) => {
      if (!this.active) return;
      // Capture before the viewer's shortcuts, including Ctrl+S and Tab.
      consume(event);
      if (event.code === 'Escape') { this.stop(); return; }
      if (MOVEMENT_KEYS.has(event.code)) this.keys.add(event.code);
    });
    listen(win, 'keyup', (event) => {
      if (!this.active) return;
      consume(event);
      this.keys.delete(event.code);
    });
    listen(win, 'blur', () => this.stop());
    listen(doc, 'visibilitychange', () => { if (doc.hidden) this.stop(); });
    element.tabIndex = 0;
  }

  start(event) {
    // Clear orbit damping before handing the camera to flight. OrbitControls
    // otherwise retains deltas and would move the camera again on release.
    const damping = this.orbit.enableDamping;
    const autoRotate = this.orbit.autoRotate;
    this.orbit.enableDamping = false;
    this.orbit.autoRotate = false;
    this.orbit.update();
    this.orbit.enableDamping = damping;
    this.orbit.autoRotate = autoRotate;
    this.focusDistance = Math.max(this.camera.position.distanceTo(this.orbit.target), this.orbit.minDistance, 0.0001);
    this.rotation.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.keys.clear();
    this.speed = this.getSpeed();
    this.pointerId = event.pointerId;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.previousCursor = this.element.style.cursor;
    this.element.style.cursor = 'crosshair';
    this.orbit.enabled = false;
    this.active = true;
    this.element.focus({ preventScroll: true });
    this.element.setPointerCapture(event.pointerId);
    this.onActiveChange(true);
  }

  look(dx, dy) {
    if (!this.active) return;
    this.rotation.y -= dx * 0.0025;
    this.rotation.x = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.rotation.x - dy * 0.0025));
    this.rotation.z = 0;
    this.camera.quaternion.setFromEuler(this.rotation);
    this.syncTarget();
    this.onChange();
  }

  update(delta) {
    if (!this.active) return;
    // W/S follow camera forward, A/D camera right, Q/E camera up. Pitched
    // views therefore move in the camera's local frame rather than the floor.
    this.direction.set(
      Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')),
      Number(this.keys.has('KeyE')) - Number(this.keys.has('KeyQ')),
      Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW')),
    );
    if (this.direction.lengthSq() === 0) return;
    this.direction.normalize().applyQuaternion(this.camera.quaternion);
    this.camera.position.addScaledVector(this.direction, this.speed * Math.min(Math.max(delta, 0), 0.05));
    this.syncTarget();
    this.onChange();
  }

  syncTarget() {
    this.camera.getWorldDirection(this.direction);
    this.orbit.target.copy(this.camera.position).addScaledVector(this.direction, this.focusDistance);
    this.camera.updateMatrixWorld(true);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.keys.clear();
    this.syncTarget();
    this.orbit.enabled = true;
    this.element.style.cursor = this.previousCursor;
    if (this.element.hasPointerCapture(this.pointerId)) this.element.releasePointerCapture(this.pointerId);
    this.onActiveChange(false);
  }

  dispose() {
    this.stop();
    for (const remove of this.listeners) remove();
    this.listeners = [];
  }
}
