import { CONFIG } from '../config';
import type { Camera } from '../camera/camera';
import type { FormationKind } from '../formation/formation';
import type { PlayerTroopType } from '../types';

export type InputEvent =
  | { type: 'select'; x: number; y: number }
  | { type: 'drag'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'recruit'; troopType: PlayerTroopType }
  | { type: 'formation'; kind: FormationKind }
  | { type: 'rotate' }
  | { type: 'pause' };

export interface DragRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Input {
  keys = new Set<string>();
  dragRect: DragRect | null = null;
  onWheel: ((e: WheelEvent) => void) | null = null;

  private events: InputEvent[] = [];
  private mouseX = 0;
  private mouseY = 0;
  private leftDown = false;
  private dragging = false;
  private startX = 0;
  private startY = 0;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE' && !e.repeat) this.events.push({ type: 'recruit', troopType: 'knight' });
      if (e.code === 'KeyF' && !e.repeat) this.events.push({ type: 'recruit', troopType: 'archer' });
      if (e.code === 'KeyC' && !e.repeat) this.events.push({ type: 'recruit', troopType: 'tank' });
      if (e.code === 'KeyG' && !e.repeat) this.events.push({ type: 'recruit', troopType: 'champion' });
      if (e.code === 'KeyL' && !e.repeat) this.events.push({ type: 'formation', kind: 'line' });
      if (e.code === 'KeyV' && !e.repeat) this.events.push({ type: 'formation', kind: 'v' });
      if (e.code === 'KeyQ' && !e.repeat) this.events.push({ type: 'formation', kind: 'square' });
      if (e.code === 'KeyB' && !e.repeat) this.events.push({ type: 'formation', kind: 'defense' });
      if (e.code === 'KeyR' && !e.repeat) this.events.push({ type: 'rotate' });
      if (e.code === 'Escape' && !e.repeat) this.events.push({ type: 'pause' });
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.leftDown = false;
      this.dragging = false;
      this.dragRect = null;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (this.leftDown) {
        if (!this.dragging) {
          const dx = this.mouseX - this.startX;
          const dy = this.mouseY - this.startY;
          if (Math.hypot(dx, dy) > CONFIG.selection.dragThreshold) this.dragging = true;
        }
        if (this.dragging) this.updateDragRect();
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.leftDown = true;
        this.dragging = false;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.dragRect = null;
      } else if (e.button === 2) {
        this.events.push({ type: 'move', x: e.clientX, y: e.clientY });
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.leftDown) {
        this.leftDown = false;
        if (this.dragging) {
          this.events.push({
            type: 'drag',
            x1: this.startX,
            y1: this.startY,
            x2: this.mouseX,
            y2: this.mouseY,
          });
        } else {
          this.events.push({ type: 'select', x: this.mouseX, y: this.mouseY });
        }
        this.dragging = false;
        this.dragRect = null;
      }
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.onWheel?.(e);
      },
      { passive: false },
    );
  }

  pointerScreen(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  drainEvents(): InputEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  updateCamera(camera: Camera, dt: number): void {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      const speed = CONFIG.camera.moveSpeed / camera.zoom;
      camera.move((dx / len) * speed * dt, (dy / len) * speed * dt);
    }
  }

  private updateDragRect(): void {
    this.dragRect = this.dragRect ?? { x: 0, y: 0, w: 0, h: 0 };
    this.dragRect.x = Math.min(this.startX, this.mouseX);
    this.dragRect.y = Math.min(this.startY, this.mouseY);
    this.dragRect.w = Math.abs(this.mouseX - this.startX);
    this.dragRect.h = Math.abs(this.mouseY - this.startY);
  }
}