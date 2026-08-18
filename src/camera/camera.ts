import { CONFIG } from '../config';
import { clamp } from '../core/vector';

export class Camera {
  x: number;
  y: number;
  zoom: number;
  private viewWidth: number;
  private viewHeight: number;

  constructor(viewWidth: number, viewHeight: number) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.x = CONFIG.positions.base.x;
    this.y = CONFIG.positions.base.y;
    this.zoom = 0.9;
  }

  setViewSize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewWidth / 2) / this.zoom + this.x,
      y: (sy - this.viewHeight / 2) / this.zoom + this.y,
    };
  }

  move(dx: number, dy: number): void {
    this.x = clamp(this.x + dx, 0, CONFIG.world.width);
    this.y = clamp(this.y + dy, 0, CONFIG.world.height);
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, CONFIG.camera.minZoom, CONFIG.camera.maxZoom);
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.x = clamp(this.x, 0, CONFIG.world.width);
    this.y = clamp(this.y, 0, CONFIG.world.height);
  }

  viewRect(): { x: number; y: number; w: number; h: number } {
    return {
      x: (0 - this.viewWidth / 2) / this.zoom + this.x,
      y: (0 - this.viewHeight / 2) / this.zoom + this.y,
      w: this.viewWidth / this.zoom,
      h: this.viewHeight / this.zoom,
    };
  }
}